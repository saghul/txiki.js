/*
 * QuickJS libuv bindings
 *
 * Copyright (c) 2019-present Saúl Ibarra Corretgé <s@saghul.net>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

#include "../quv.h"
#include "private.h"

#include <unistd.h>


static JSValue quv_new_worker(JSContext *ctx, int channel_fd, bool is_main);


static JSClassID quv_worker_class_id;

typedef struct {
    const char *path;
    uv_os_fd_t channel_fd;
    uv_sem_t *sem;
    QUVRuntime *wrt;
} worker_data_t;

typedef struct {
    JSContext *ctx;
    union {
        uv_handle_t handle;
        uv_stream_t stream;
        uv_pipe_t pipe;
    } h;
    JSValue events[3];
    uv_thread_t tid;
    QUVRuntime *wrt;
    bool is_main;
} QUVWorker;

typedef struct {
    uv_write_t req;
    uint8_t *data;
} QUVWorkerWriteReq;

static JSValue worker_eval(JSContext *ctx, int argc, JSValueConst *argv) {
    const char *filename;
    JSValue ret;

    filename = JS_ToCString(ctx, argv[0]);
    if (!filename) {
        quv_dump_error(ctx);
        goto error;
    }

    ret = QUV_EvalFile(ctx, filename, JS_EVAL_TYPE_MODULE, false);
    JS_FreeCString(ctx, filename);

    if (JS_IsException(ret)) {
        quv_dump_error(ctx);
        JS_FreeValue(ctx, ret);
        goto error;
    }

    JS_FreeValue(ctx, ret);
    return JS_UNDEFINED;

error:;
    QUVRuntime *qrt = QUV_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);
    QUV_Stop(qrt);

    return JS_UNDEFINED;
}

/* This is what the worker runs */
static void worker_entry(void *arg) {
    worker_data_t *wd = arg;

    QUVRuntime *wrt = QUV_NewRuntime2(true);
    CHECK_NOT_NULL(wrt);

    JSContext *ctx = QUV_GetJSContext(wrt);

    /* Set the 'workerThis' global object. */
    JSValue global_obj = JS_GetGlobalObject(ctx);
    JSValue worker_obj = quv_new_worker(ctx, wd->channel_fd, false);
    JS_SetPropertyStr(ctx, global_obj, "workerThis", worker_obj);
    JS_FreeValue(ctx, global_obj);

    /* Load the file and eval the file when the loop runs. */
    JSValue filename = JS_NewString(ctx, wd->path);
    CHECK_EQ(JS_EnqueueJob(ctx, worker_eval, 1, (JSValueConst *) &filename), 0);
    JS_FreeValue(ctx, filename);

    /* Notify the caller we are setup.  */
    wd->wrt = wrt;
    uv_sem_post(wd->sem);
    wd = NULL;

    QUV_Run(wrt);

    QUV_FreeRuntime(wrt);
}

static void uv__close_cb(uv_handle_t *handle) {
    QUVWorker *w = handle->data;
    CHECK_NOT_NULL(w);
    free(w);
}

static void quv_worker_finalizer(JSRuntime *rt, JSValue val) {
    QUVWorker *w = JS_GetOpaque(val, quv_worker_class_id);
    if (w) {
        JS_FreeValueRT(rt, w->events[0]);
        JS_FreeValueRT(rt, w->events[1]);
        JS_FreeValueRT(rt, w->events[2]);
        uv_close(&w->h.handle, uv__close_cb);
    }
}

static void quv_worker_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    QUVWorker *w = JS_GetOpaque(val, quv_worker_class_id);
    if (w) {
        JS_MarkValue(rt, w->events[0], mark_func);
        JS_MarkValue(rt, w->events[1], mark_func);
        JS_MarkValue(rt, w->events[2], mark_func);
    }
}

static JSClassDef quv_worker_class = {
    "Worker",
    .finalizer = quv_worker_finalizer,
    .gc_mark = quv_worker_mark,
};

static QUVWorker *quv_worker_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, quv_worker_class_id);
}

static JSValue emit_event(JSContext *ctx, int argc, JSValueConst *argv) {
    CHECK_EQ(argc, 2);

    JSValue func = argv[0];
    JSValue arg = argv[1];

    JSValue ret = JS_Call(ctx, func, JS_UNDEFINED, 1, (JSValueConst *) &arg);
    if (JS_IsException(ret))
        quv_dump_error(ctx);

    JS_FreeValue(ctx, ret);
    JS_FreeValue(ctx, func);
    JS_FreeValue(ctx, arg);

    return JS_UNDEFINED;
}

static void maybe_emit_event(QUVWorker *w, int event, JSValue arg) {
    JSContext *ctx = w->ctx;
    JSValue event_func = w->events[event];
    if (!JS_IsFunction(ctx, event_func))
        return;

    JSValue args[2];
    args[0] = JS_DupValue(ctx, event_func);
    args[1] = JS_DupValue(ctx, arg);
    CHECK_EQ(JS_EnqueueJob(ctx, emit_event, 2, (JSValueConst *) &args), 0);
}

static void uv__alloc_cb(uv_handle_t *handle, size_t suggested_size, uv_buf_t *buf) {
    QUVWorker *w = handle->data;
    CHECK_NOT_NULL(w);

    buf->base = js_malloc(w->ctx, suggested_size);
    buf->len = suggested_size;
}

static void uv__read_cb(uv_stream_t *handle, ssize_t nread, const uv_buf_t *buf) {
    QUVWorker *w = handle->data;
    CHECK_NOT_NULL(w);

    JSContext *ctx = w->ctx;

    if (nread < 0) {
        uv_read_stop(&w->h.stream);
        js_free(ctx, buf->base);
        if (nread != UV_EOF) {
            JSValue error = quv_new_error(ctx, nread);
            maybe_emit_event(w, 1, error);  // onmessageerror vs onerror?
            JS_FreeValue(ctx, error);
        }
        return;
    }

    // TODO: the entire object might not have come in a single packet. Use netstrings.
    JSValue obj = JS_ReadObject(ctx, (const uint8_t *) buf->base, buf->len, 0);
    maybe_emit_event(w, 0, obj);
    JS_FreeValue(ctx, obj);
    js_free(ctx, buf->base);
}

static JSValue quv_new_worker(JSContext *ctx, int channel_fd, bool is_main) {
    JSValue obj = JS_NewObjectClass(ctx, quv_worker_class_id);
    if (JS_IsException(obj))
        return obj;

    QUVWorker *w = calloc(1, sizeof(*w));
    if (!w) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    w->ctx = ctx;
    w->is_main = is_main;
    w->h.handle.data = w;

    CHECK_EQ(uv_pipe_init(quv_get_loop(ctx), &w->h.pipe, 0), 0);
    CHECK_EQ(uv_pipe_open(&w->h.pipe, channel_fd), 0);
    CHECK_EQ(uv_read_start(&w->h.stream, uv__alloc_cb, uv__read_cb), 0);

    w->events[0] = JS_UNDEFINED;
    w->events[1] = JS_UNDEFINED;
    w->events[2] = JS_UNDEFINED;

    JS_SetOpaque(obj, w);
    return obj;
}

static JSValue quv_worker_constructor(JSContext *ctx, JSValueConst new_target, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    // TODO: Windows support.
    int fds[2];
    int r = socketpair(AF_UNIX, SOCK_STREAM, 0, fds);
    if (r != 0)
        return quv_throw_errno(ctx, -errno);

    JSValue obj = quv_new_worker(ctx, fds[0], true);
    if (JS_IsException(obj)) {
        close(fds[0]);
        close(fds[1]);
        return JS_EXCEPTION;
    }

    QUVWorker *w = quv_worker_get(ctx, obj);

    /* We will wait for the worker to complete the creation of the VM. */
    uv_sem_t sem;
    CHECK_EQ(uv_sem_init(&sem, 0), 0);

    worker_data_t worker_data = { .channel_fd = fds[1], .path = path, .sem = &sem, .wrt = NULL };

    CHECK_EQ(uv_thread_create(&w->tid, worker_entry, (void *) &worker_data), 0);

    /* Wait for the worker to initialize. */
    uv_sem_wait(&sem);
    uv_sem_destroy(&sem);

    uv_update_time(quv_get_loop(ctx));

    worker_data.sem = NULL;
    w->wrt = worker_data.wrt;
    CHECK_NOT_NULL(w->wrt);

    return obj;
}

static void uv__write_cb(uv_write_t *req, int status) {
    QUVWorkerWriteReq *wr = req->data;
    CHECK_NOT_NULL(wr);

    QUVWorker *w = req->handle->data;
    CHECK_NOT_NULL(w);

    JSContext *ctx = w->ctx;

    if (status < 0) {
        JSValue error = quv_new_error(ctx, status);
        maybe_emit_event(w, 1, error);
        JS_FreeValue(ctx, error);
    }

    js_free(ctx, wr);
}

static JSValue quv_worker_postmessage(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    QUVWorker *w = quv_worker_get(ctx, this_val);
    if (!w)
        return JS_EXCEPTION;

    QUVWorkerWriteReq *wr = js_malloc(ctx, sizeof(*wr));
    if (!wr)
        return JS_EXCEPTION;

    size_t len;
    uint8_t *buf = JS_WriteObject(ctx, &len, argv[0], 0);
    if (!buf) {
        js_free(ctx, wr);
        return JS_EXCEPTION;
    }

    wr->req.data = wr;
    wr->data = buf;

    uv_buf_t b = uv_buf_init((char *) buf, len);
    int r = uv_write(&wr->req, &w->h.stream, &b, 1, uv__write_cb);
    if (r != 0) {
        js_free(ctx, buf);
        js_free(ctx, wr);
        return JS_EXCEPTION;
    }

    return JS_UNDEFINED;
}

static JSValue quv_worker_terminate(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    QUVWorker *w = quv_worker_get(ctx, this_val);
    if (!w)
        return JS_EXCEPTION;
    if (w->is_main && w->wrt) {
        QUV_Stop(w->wrt);
        CHECK_EQ(uv_thread_join(&w->tid), 0);
        uv_update_time(quv_get_loop(ctx));
        w->wrt = NULL;
    }
    return JS_UNDEFINED;
}

static JSValue quv_worker_event_get(JSContext *ctx, JSValueConst this_val, int magic) {
    QUVWorker *w = quv_worker_get(ctx, this_val);
    if (!w)
        return JS_EXCEPTION;
    return JS_DupValue(ctx, w->events[magic]);
}

static JSValue quv_worker_event_set(JSContext *ctx, JSValueConst this_val, JSValueConst value, int magic) {
    QUVWorker *w = quv_worker_get(ctx, this_val);
    if (!w)
        return JS_EXCEPTION;
    if (JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value)) {
        JS_FreeValue(ctx, w->events[magic]);
        w->events[magic] = JS_DupValue(ctx, value);
    }
    return JS_UNDEFINED;
}

static const JSCFunctionListEntry quv_worker_proto_funcs[] = {
    JS_CFUNC_DEF("postMessage", 1, quv_worker_postmessage),
    JS_CFUNC_DEF("terminate", 0, quv_worker_terminate),
    JS_CGETSET_MAGIC_DEF("onmessage", quv_worker_event_get, quv_worker_event_set, 0),
    JS_CGETSET_MAGIC_DEF("onmessageerror", quv_worker_event_get, quv_worker_event_set, 1),
    JS_CGETSET_MAGIC_DEF("onerror", quv_worker_event_get, quv_worker_event_set, 2),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Worker", JS_PROP_CONFIGURABLE),
};

void quv_mod_worker_init(JSContext *ctx, JSModuleDef *m) {
    JSValue proto, obj;

    /* Worker class */
    JS_NewClassID(&quv_worker_class_id);
    JS_NewClass(JS_GetRuntime(ctx), quv_worker_class_id, &quv_worker_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, quv_worker_proto_funcs, countof(quv_worker_proto_funcs));
    JS_SetClassProto(ctx, quv_worker_class_id, proto);

    /* Worker object */
    obj = JS_NewCFunction2(ctx, quv_worker_constructor, "Worker", 1, JS_CFUNC_constructor, 0);
    JS_SetModuleExport(ctx, m, "Worker", obj);
}

void quv_mod_worker_export(JSContext *ctx, JSModuleDef *m) {
    JS_AddModuleExport(ctx, m, "Worker");
}

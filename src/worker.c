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

#include "embedjs.h"
#include "private.h"
#include "tjs.h"

#include <unistd.h>

INCTXT(worker_bootstrap, "worker-bootstrap.js");

/**
 * These are defined now:
 *
 * const unsigned char tjs__code_worker_bootstrap_data[];
 * const unsigned char *const tjs__code_worker_bootstrap_end;
 * const unsigned int tjs__code_worker_bootstrap_size;
 *
 */

enum {
    WORKER_EVENT_MESSAGE = 0,
    WORKER_EVENT_MESSAGE_ERROR,
    WORKER_EVENT_ERROR,
    WORKER_EVENT_MAX,
};

static JSValue tjs_new_worker(JSContext *ctx, uv_os_sock_t channel_fd, bool is_main);

static JSClassID tjs_worker_class_id;

typedef struct {
    const char *path;
    uv_os_sock_t channel_fd;
    uv_sem_t *sem;
    TJSRuntime *wrt;
} worker_data_t;

typedef struct {
    JSContext *ctx;
    union {
        uv_handle_t handle;
        uv_stream_t stream;
        uv_tcp_t tcp;
    } h;
    JSValue events[WORKER_EVENT_MAX];
    uv_thread_t tid;
    TJSRuntime *wrt;
    bool is_main;
} TJSWorker;

typedef struct {
    uv_write_t req;
    uint8_t *data;
} TJSWorkerWriteReq;

static JSValue worker_eval(JSContext *ctx, int argc, JSValueConst *argv) {
    const char *filename;
    JSValue ret;

    filename = JS_ToCString(ctx, argv[0]);
    if (!filename) {
        tjs_dump_error(ctx);
        goto error;
    }

    ret = TJS_EvalModule(ctx, filename, false);
    JS_FreeCString(ctx, filename);

    if (JS_IsException(ret)) {
        tjs_dump_error(ctx);
        JS_FreeValue(ctx, ret);
        goto error;
    }

    JS_FreeValue(ctx, ret);
    return JS_UNDEFINED;

error:;
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);
    TJS_Stop(qrt);

    return JS_UNDEFINED;
}

/* This is what the worker runs */
static void worker_entry(void *arg) {
    worker_data_t *wd = arg;

    TJSRuntime *wrt = TJS_NewRuntimeWorker();
    CHECK_NOT_NULL(wrt);
    JSContext *ctx = TJS_GetJSContext(wrt);

    /* Bootstrap the worker scope. */
    JSValue global_obj = JS_GetGlobalObject(ctx);
    JSValue worker_obj = tjs_new_worker(ctx, wd->channel_fd, false);
    JS_DefinePropertyValueStr(ctx, global_obj, "workerThis", worker_obj, JS_PROP_C_W_E);
    JS_FreeValue(ctx, global_obj);
    CHECK_EQ(0, tjs__eval_text(ctx, tjs__code_worker_bootstrap_data, tjs__code_worker_bootstrap_size, "worker-bootstrap.js"));

    /* Load the file and eval the file when the loop runs. */
    JSValue filename = JS_NewString(ctx, wd->path);
    CHECK_EQ(JS_EnqueueJob(ctx, worker_eval, 1, (JSValueConst *) &filename), 0);
    JS_FreeValue(ctx, filename);

    /* Notify the caller we are setup.  */
    wd->wrt = wrt;
    uv_sem_post(wd->sem);
    wd = NULL;

    TJS_Run(wrt);

    TJS_FreeRuntime(wrt);
}

static void uv__close_cb(uv_handle_t *handle) {
    TJSWorker *w = handle->data;
    CHECK_NOT_NULL(w);
    free(w);
}

static void tjs_worker_finalizer(JSRuntime *rt, JSValue val) {
    TJSWorker *w = JS_GetOpaque(val, tjs_worker_class_id);
    if (w) {
        for (int i = 0; i < WORKER_EVENT_MAX; i++)
            JS_FreeValueRT(rt, w->events[i]);
        uv_close(&w->h.handle, uv__close_cb);
    }
}

static void tjs_worker_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    TJSWorker *w = JS_GetOpaque(val, tjs_worker_class_id);
    if (w) {
        for (int i = 0; i < WORKER_EVENT_MAX; i++)
            JS_MarkValue(rt, w->events[i], mark_func);
    }
}

static JSClassDef tjs_worker_class = {
    "Worker",
    .finalizer = tjs_worker_finalizer,
    .gc_mark = tjs_worker_mark,
};

static TJSWorker *tjs_worker_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, tjs_worker_class_id);
}

static JSValue emit_event(JSContext *ctx, int argc, JSValueConst *argv) {
    CHECK_EQ(argc, 2);

    JSValue func = argv[0];
    JSValue arg = argv[1];

    JSValue ret = JS_Call(ctx, func, JS_UNDEFINED, 1, (JSValueConst *) &arg);
    if (JS_IsException(ret))
        tjs_dump_error(ctx);

    JS_FreeValue(ctx, ret);
    JS_FreeValue(ctx, func);
    JS_FreeValue(ctx, arg);

    return JS_UNDEFINED;
}

static void maybe_emit_event(TJSWorker *w, int event, JSValue arg) {
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
    TJSWorker *w = handle->data;
    CHECK_NOT_NULL(w);

    buf->base = js_malloc(w->ctx, suggested_size);
    buf->len = suggested_size;
}

static void uv__read_cb(uv_stream_t *handle, ssize_t nread, const uv_buf_t *buf) {
    TJSWorker *w = handle->data;
    CHECK_NOT_NULL(w);

    JSContext *ctx = w->ctx;

    if (nread < 0) {
        uv_read_stop(&w->h.stream);
        js_free(ctx, buf->base);
        if (nread != UV_EOF) {
            JSValue error = tjs_new_error(ctx, nread);
            maybe_emit_event(w, WORKER_EVENT_ERROR, error);
            JS_FreeValue(ctx, error);
        }
        return;
    }

    // TODO: the entire object might not have come in a single packet. Use netstrings.
    JSValue obj = JS_ReadObject(ctx, (const uint8_t *) buf->base, buf->len, 0);
    maybe_emit_event(w, WORKER_EVENT_MESSAGE, obj);
    JS_FreeValue(ctx, obj);
    js_free(ctx, buf->base);
}

static JSValue tjs_new_worker(JSContext *ctx, uv_os_sock_t channel_fd, bool is_main) {
    JSValue obj = JS_NewObjectClass(ctx, tjs_worker_class_id);
    if (JS_IsException(obj))
        return obj;

    TJSWorker *w = calloc(1, sizeof(*w));
    if (!w) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    w->ctx = ctx;
    w->is_main = is_main;
    w->h.handle.data = w;

    CHECK_EQ(uv_tcp_init(tjs_get_loop(ctx), &w->h.tcp), 0);
    CHECK_EQ(uv_tcp_open(&w->h.tcp, channel_fd), 0);
    CHECK_EQ(uv_read_start(&w->h.stream, uv__alloc_cb, uv__read_cb), 0);

    w->events[0] = JS_UNDEFINED;
    w->events[1] = JS_UNDEFINED;
    w->events[2] = JS_UNDEFINED;

    JS_SetOpaque(obj, w);
    return obj;
}

static JSValue tjs_worker_constructor(JSContext *ctx, JSValueConst new_target, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    uv_os_sock_t fds[2];
    int r = uv_socketpair(SOCK_STREAM, 0, fds, UV_NONBLOCK_PIPE, UV_NONBLOCK_PIPE);
    if (r != 0) {
        JS_FreeCString(ctx, path);
        return tjs_throw_errno(ctx, r);
    }

    JSValue obj = tjs_new_worker(ctx, fds[0], true);
    if (JS_IsException(obj)) {
        close(fds[0]);
        close(fds[1]);
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    TJSWorker *w = tjs_worker_get(ctx, obj);

    /* We will wait for the worker to complete the creation of the VM. */
    uv_sem_t sem;
    CHECK_EQ(uv_sem_init(&sem, 0), 0);

    worker_data_t worker_data = { .channel_fd = fds[1], .path = path, .sem = &sem, .wrt = NULL };

    CHECK_EQ(uv_thread_create(&w->tid, worker_entry, (void *) &worker_data), 0);

    /* Wait for the worker to initialize. */
    uv_sem_wait(&sem);
    uv_sem_destroy(&sem);

    JS_FreeCString(ctx, path);

    uv_update_time(tjs_get_loop(ctx));

    worker_data.sem = NULL;
    w->wrt = worker_data.wrt;
    CHECK_NOT_NULL(w->wrt);

    return obj;
}

static void uv__write_cb(uv_write_t *req, int status) {
    TJSWorkerWriteReq *wr = req->data;
    CHECK_NOT_NULL(wr);

    TJSWorker *w = req->handle->data;
    CHECK_NOT_NULL(w);

    JSContext *ctx = w->ctx;

    if (status < 0) {
        JSValue error = tjs_new_error(ctx, status);
        maybe_emit_event(w, WORKER_EVENT_MESSAGE_ERROR, error);
        JS_FreeValue(ctx, error);
    }

    js_free(ctx, wr->data);
    js_free(ctx, wr);
}

static JSValue tjs_worker_postmessage(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSWorker *w = tjs_worker_get(ctx, this_val);
    if (!w)
        return JS_EXCEPTION;

    TJSWorkerWriteReq *wr = js_malloc(ctx, sizeof(*wr));
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

static JSValue tjs_worker_terminate(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSWorker *w = tjs_worker_get(ctx, this_val);
    if (!w)
        return JS_EXCEPTION;
    if (w->is_main && w->wrt) {
        TJS_Stop(w->wrt);
        CHECK_EQ(uv_thread_join(&w->tid), 0);
        uv_update_time(tjs_get_loop(ctx));
        w->wrt = NULL;
    }
    return JS_UNDEFINED;
}

static JSValue tjs_worker_event_get(JSContext *ctx, JSValueConst this_val, int magic) {
    TJSWorker *w = tjs_worker_get(ctx, this_val);
    if (!w)
        return JS_EXCEPTION;
    return JS_DupValue(ctx, w->events[magic]);
}

static JSValue tjs_worker_event_set(JSContext *ctx, JSValueConst this_val, JSValueConst value, int magic) {
    TJSWorker *w = tjs_worker_get(ctx, this_val);
    if (!w)
        return JS_EXCEPTION;
    if (JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value)) {
        JS_FreeValue(ctx, w->events[magic]);
        w->events[magic] = JS_DupValue(ctx, value);
    }
    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_worker_proto_funcs[] = {
    TJS_CFUNC_DEF("postMessage", 1, tjs_worker_postmessage),
    TJS_CFUNC_DEF("terminate", 0, tjs_worker_terminate),
    JS_CGETSET_MAGIC_DEF("onmessage", tjs_worker_event_get, tjs_worker_event_set, WORKER_EVENT_MESSAGE),
    JS_CGETSET_MAGIC_DEF("onmessageerror", tjs_worker_event_get, tjs_worker_event_set, WORKER_EVENT_MESSAGE_ERROR),
    JS_CGETSET_MAGIC_DEF("onerror", tjs_worker_event_get, tjs_worker_event_set, WORKER_EVENT_ERROR),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Worker", JS_PROP_CONFIGURABLE),
};

void tjs__mod_worker_init(JSContext *ctx, JSValue ns) {
    JSValue proto, obj;

    /* Worker class */
    JS_NewClassID(&tjs_worker_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_worker_class_id, &tjs_worker_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_worker_proto_funcs, countof(tjs_worker_proto_funcs));
    JS_SetClassProto(ctx, tjs_worker_class_id, proto);

    /* Worker object */
    obj = JS_NewCFunction2(ctx, tjs_worker_constructor, "Worker", 1, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, ns, "Worker", obj, JS_PROP_C_W_E);
}

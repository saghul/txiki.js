/*
 * txiki.js
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

#include "mem.h"
#include "private.h"
#include "tjs.h"

#include <string.h>


extern const uint8_t tjs__worker_bootstrap[];
extern const uint32_t tjs__worker_bootstrap_size;

enum {
    MSGPIPE_EVENT_MESSAGE = 0,
    MSGPIPE_EVENT_MESSAGE_ERROR,
    MSGPIPE_EVENT_ERROR,
    MSGPIPE_EVENT_MAX,
};

/* High bit of the on-wire frame length header marks an error frame (a worker
 * reporting an uncaught error to its parent) instead of a normal message. */
#define MSGPIPE_FRAME_ERROR_FLAG (UINT64_C(1) << 63)

static JSClassID tjs_msgpipe_class_id;

typedef struct {
    JSContext *ctx;
    union {
        uv_handle_t handle;
        uv_stream_t stream;
        uv_tcp_t tcp;
    } h;
    struct {
        union {
            uint64_t u64;
            uint8_t u8[8];
        } total_size;
        uint8_t *data;
        uint64_t nread;
        bool is_error;
    } reading;
    JSValue events[MSGPIPE_EVENT_MAX];
} TJSMessagePipe;

typedef struct {
    uv_write_t req;
    uint8_t *data;
    union {
        uint64_t u64;
        uint8_t u8[8];
    } data_size;
} TJSMessagePipeWriteReq;

static void uv__close_cb(uv_handle_t *handle) {
    TJSMessagePipe *p = handle->data;
    CHECK_NOT_NULL(p);
    tjs__free(p);
}

static void tjs_msgpipe_finalizer(JSRuntime *rt, JSValue val) {
    TJSMessagePipe *p = JS_GetOpaque(val, tjs_msgpipe_class_id);
    if (p) {
        for (int i = 0; i < MSGPIPE_EVENT_MAX; i++) {
            JS_FreeValueRT(rt, p->events[i]);
        }
        uv_close(&p->h.handle, uv__close_cb);
    }
}

static void tjs_msgpipe_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSMessagePipe *p = JS_GetOpaque(val, tjs_msgpipe_class_id);
    if (p) {
        for (int i = 0; i < MSGPIPE_EVENT_MAX; i++) {
            JS_MarkValue(rt, p->events[i], mark_func);
        }
    }
}

static JSClassDef tjs_msgpipe_class = {
    "MessagePipe",
    .finalizer = tjs_msgpipe_finalizer,
    .gc_mark = tjs_msgpipe_mark,
};

static TJSMessagePipe *tjs_msgpipe_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_msgpipe_class_id);
}

static JSValue emit_event(JSContext *ctx, int argc, JSValue *argv) {
    CHECK_EQ(argc, 2);

    JSValue func = argv[0];
    JSValue arg = argv[1];

    tjs_call_handler(ctx, func, 1, &arg);

    JS_FreeValue(ctx, func);
    JS_FreeValue(ctx, arg);

    return JS_UNDEFINED;
}

static void emit_msgpipe_event(TJSMessagePipe *p, int event, JSValue arg) {
    JSContext *ctx = p->ctx;
    JSValue event_func = p->events[event];
    if (!JS_IsFunction(ctx, event_func)) {
        return;
    }

    JSValue args[2];
    args[0] = JS_DupValue(ctx, event_func);
    args[1] = JS_DupValue(ctx, arg);
    CHECK_EQ(JS_EnqueueJob(ctx, emit_event, 2, (JSValue *) &args), 0);
}

static void uv__alloc_cb(uv_handle_t *handle, size_t suggested_size, uv_buf_t *buf) {
    TJSMessagePipe *p = handle->data;
    CHECK_NOT_NULL(p);

    if (p->reading.data) {
        buf->base = (char *) p->reading.data + p->reading.nread;
        uint64_t remaining = p->reading.total_size.u64 - p->reading.nread;
        buf->len = remaining > suggested_size ? suggested_size : remaining;
    } else {
        buf->base = (char *) p->reading.total_size.u8;
        buf->len = sizeof(p->reading.total_size.u8);
    }
}

static void uv__read_cb(uv_stream_t *handle, ssize_t nread, const uv_buf_t *buf) {
    TJSMessagePipe *p = handle->data;
    CHECK_NOT_NULL(p);

    JSContext *ctx = p->ctx;

    if (nread < 0) {
        uv_read_stop(&p->h.stream);
        if (p->reading.data) {
            js_free(ctx, p->reading.data);
        }
        memset(&p->reading, 0, sizeof(p->reading));
        if (nread != UV_EOF) {
            JSValue error = tjs_new_error(ctx, nread);
            emit_msgpipe_event(p, MSGPIPE_EVENT_MESSAGE_ERROR, error);
            JS_FreeValue(ctx, error);
        }
        return;
    }

    if (!p->reading.data) {
        size_t len_size = sizeof(p->reading.total_size.u8);

        /* This is a bogus read, likely a zero-read. Just return the buffer. */
        if (nread != len_size) {
            return;
        }

        uint64_t header = p->reading.total_size.u64;
        p->reading.is_error = (header & MSGPIPE_FRAME_ERROR_FLAG) != 0;
        uint64_t total_size = header & ~MSGPIPE_FRAME_ERROR_FLAG;
        p->reading.total_size.u64 = total_size;
        p->reading.data = js_malloc(ctx, total_size);

        return;
    }

    /* We are continuing a partial read. */
    uint64_t total_size = p->reading.total_size.u64;
    p->reading.nread += nread;

    if (p->reading.nread < total_size) {
        /* We still need to read more. */

        return;
    }

    CHECK_EQ(p->reading.nread, total_size);

    /* We have a complete buffer now. */
    JSSABTab sab_tab;
    int flags = JS_READ_OBJ_SAB | JS_READ_OBJ_REFERENCE;
    JSValue obj = JS_ReadObject2(ctx, (const uint8_t *) p->reading.data, total_size, flags, &sab_tab);
    if (JS_IsException(obj)) {
        emit_msgpipe_event(p, MSGPIPE_EVENT_MESSAGE_ERROR, JS_GetException(ctx));
    } else {
        emit_msgpipe_event(p, p->reading.is_error ? MSGPIPE_EVENT_ERROR : MSGPIPE_EVENT_MESSAGE, obj);
    }
    JS_FreeValue(ctx, obj);

    /* Decrement the SAB reference counts. */
    for (int i = 0; i < sab_tab.len; i++) {
        tjs__sab_free(NULL, sab_tab.tab[i]);
    }

    js_free(ctx, p->reading.data);
    memset(&p->reading, 0, sizeof(p->reading));
}

static JSValue tjs_new_msgpipe(JSContext *ctx, uv_os_sock_t fd) {
    JSValue obj = JS_NewObjectClass(ctx, tjs_msgpipe_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSMessagePipe *p = tjs__mallocz(sizeof(*p));
    if (!p) {
        JS_FreeValue(ctx, obj);
        return JS_ThrowOutOfMemory(ctx);
    }

    p->ctx = ctx;
    p->h.handle.data = p;
    for (int i = 0; i < MSGPIPE_EVENT_MAX; i++) {
        p->events[i] = JS_UNDEFINED;
    }

    CHECK_EQ(uv_tcp_init(tjs_get_loop(ctx), &p->h.tcp), 0);
    CHECK_EQ(uv_tcp_open(&p->h.tcp, fd), 0);
    CHECK_EQ(uv_read_start(&p->h.stream, uv__alloc_cb, uv__read_cb), 0);

    JS_SetOpaque(obj, p);
    return obj;
}

static void uv__write_cb(uv_write_t *req, int status) {
    TJSMessagePipeWriteReq *wr = req->data;
    CHECK_NOT_NULL(wr);

    TJSMessagePipe *p = req->handle->data;
    CHECK_NOT_NULL(p);

    JSContext *ctx = p->ctx;

    if (status < 0) {
        JSValue error = tjs_new_error(ctx, status);
        emit_msgpipe_event(p, MSGPIPE_EVENT_MESSAGE_ERROR, error);
        JS_FreeValue(ctx, error);
    }

    js_free(ctx, wr->data);
    js_free(ctx, wr);
}

static JSValue msgpipe_write_value(JSContext *ctx, TJSMessagePipe *p, JSValueConst value, bool is_error) {
    TJSMessagePipeWriteReq *wr = js_malloc(ctx, sizeof(*wr));
    if (!wr) {
        return JS_EXCEPTION;
    }

    size_t len;
    int flags = JS_WRITE_OBJ_SAB | JS_WRITE_OBJ_REFERENCE | JS_WRITE_OBJ_STRIP_SOURCE;
    JSSABTab sab_tab;
    uint8_t *buf = JS_WriteObject2(ctx, &len, value, flags, &sab_tab);
    if (!buf) {
        js_free(ctx, wr);
        return JS_EXCEPTION;
    }

    wr->req.data = wr;
    wr->data = buf;
    wr->data_size.u64 = is_error ? (len | MSGPIPE_FRAME_ERROR_FLAG) : len;

    uv_buf_t bufs[2] = { uv_buf_init((char *) wr->data_size.u8, sizeof(wr->data_size.u8)),
                         uv_buf_init((char *) buf, len) };
    int r = uv_write(&wr->req, &p->h.stream, bufs, 2, uv__write_cb);
    if (r != 0) {
        js_free(ctx, buf);
        js_free(ctx, wr);
        js_free(ctx, sab_tab.tab);

        return tjs_throw_errno(ctx, r);
    }

    /* Increment the SAB reference counts. */
    for (int i = 0; i < sab_tab.len; i++) {
        tjs__sab_dup(NULL, sab_tab.tab[i]);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_msgpipe_postmessage(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSMessagePipe *p = tjs_msgpipe_get(ctx, this_val);
    if (!p) {
        return JS_EXCEPTION;
    }
    return msgpipe_write_value(ctx, p, argv[0], false);
}

void tjs__worker_post_error(JSContext *ctx, JSValueConst error) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);

    if (!qrt->is_worker || qrt->freeing) {
        return;
    }

    JSValue pipe = qrt->builtins.internal_message_pipe;
    if (JS_IsUndefined(pipe)) {
        return;
    }

    TJSMessagePipe *p = JS_GetOpaque(pipe, tjs_msgpipe_class_id);
    if (!p) {
        return;
    }

    /* Build a structured-clonable description of the error: {name, message, stack}.
     * The thrown value may be any JS value, not just an Error. */
    JSValue obj = JS_NewObject(ctx);
    if (JS_IsException(obj)) {
        JS_FreeValue(ctx, JS_GetException(ctx));
        return;
    }

    JSValue message = JS_UNDEFINED;
    if (!JS_IsUndefined(error) && !JS_IsNull(error)) {
        message = JS_GetPropertyStr(ctx, error, "message");
    }
    if (!JS_IsString(message)) {
        JS_FreeValue(ctx, message);
        message = JS_ToString(ctx, error);
    }
    JS_SetPropertyStr(ctx, obj, "message", message);

    if (!JS_IsUndefined(error) && !JS_IsNull(error)) {
        JSValue name = JS_GetPropertyStr(ctx, error, "name");
        if (JS_IsString(name)) {
            JS_SetPropertyStr(ctx, obj, "name", name);
        } else {
            JS_FreeValue(ctx, name);
        }
        JSValue stack = JS_GetPropertyStr(ctx, error, "stack");
        if (JS_IsString(stack)) {
            JS_SetPropertyStr(ctx, obj, "stack", stack);
        } else {
            JS_FreeValue(ctx, stack);
        }
    }

    JSValue r = msgpipe_write_value(ctx, p, obj, true);
    JS_FreeValue(ctx, obj);
    if (JS_IsException(r)) {
        /* Best-effort: never let reporting failure mask the original error. */
        JS_FreeValue(ctx, JS_GetException(ctx));
    }
}

static JSValue tjs_msgpipe_event_get(JSContext *ctx, JSValue this_val, int magic) {
    TJSMessagePipe *p = tjs_msgpipe_get(ctx, this_val);
    if (!p) {
        return JS_EXCEPTION;
    }
    return JS_DupValue(ctx, p->events[magic]);
}

static JSValue tjs_msgpipe_event_set(JSContext *ctx, JSValue this_val, JSValue value, int magic) {
    TJSMessagePipe *p = tjs_msgpipe_get(ctx, this_val);
    if (!p) {
        return JS_EXCEPTION;
    }
    if (JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value)) {
        JS_FreeValue(ctx, p->events[magic]);
        p->events[magic] = JS_DupValue(ctx, value);
    }
    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_msgpipe_proto_funcs[] = {
    TJS_CFUNC_DEF("postMessage", 1, tjs_msgpipe_postmessage),
    JS_CGETSET_MAGIC_DEF("onmessage", tjs_msgpipe_event_get, tjs_msgpipe_event_set, MSGPIPE_EVENT_MESSAGE),
    JS_CGETSET_MAGIC_DEF("onmessageerror", tjs_msgpipe_event_get, tjs_msgpipe_event_set, MSGPIPE_EVENT_MESSAGE_ERROR),
    JS_CGETSET_MAGIC_DEF("onerror", tjs_msgpipe_event_get, tjs_msgpipe_event_set, MSGPIPE_EVENT_ERROR),
};

static JSValue tjs_new_worker(JSContext *ctx, uv_os_sock_t channel_fd);

static JSClassID tjs_worker_class_id;

typedef struct {
    const char *specifier;
    const char *source;
    uv_os_sock_t channel_fd;
    uv_sem_t *sem;
    TJSRuntime *wrt;
} worker_data_t;

typedef struct {
    JSContext *ctx;
    uv_thread_t tid;
    JSValue message_pipe;
    TJSRuntime *wrt;
} TJSWorker;

static JSValue worker_eval(JSContext *ctx, int argc, JSValue *argv) {
    const char *specifier;
    JSValue ret;

    specifier = JS_ToCString(ctx, argv[0]);
    if (!specifier) {
        goto error;
    }

    if (!JS_IsUndefined(argv[1])) {
        size_t len;
        const char *source = JS_ToCStringLen(ctx, &len, argv[1]);
        ret = TJS_EvalModuleContent(ctx, specifier, false, false, source, len);
        JS_FreeCString(ctx, source);
    } else {
        ret = TJS_EvalModule(ctx, specifier, false);
    }
    JS_FreeCString(ctx, specifier);

    if (JS_IsException(ret)) {
        JS_FreeValue(ctx, ret);
        goto error;
    }

    JS_FreeValue(ctx, ret);
    return JS_UNDEFINED;

error:;
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);

    /* Report the load/eval failure to the parent (self.onerror + Worker.onerror),
     * then restore the pending exception so it is still dumped to stderr. */
    JSValue exc = JS_GetException(ctx);
    tjs__worker_handle_uncaught(ctx, exc);
    JS_Throw(ctx, exc);

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
    JSValue message_pipe = tjs_new_msgpipe(ctx, wd->channel_fd);
    JS_FreeValue(ctx, wrt->builtins.internal_message_pipe);
    wrt->builtins.internal_message_pipe = message_pipe;

    CHECK_EQ(tjs__eval_bytecode(ctx, tjs__worker_bootstrap, tjs__worker_bootstrap_size, true), 0);

    /* Load and eval the specifier when the loop runs. */
    JSValue specifier = JS_NewString(ctx, wd->specifier);
    JSValue source = wd->source ? JS_NewString(ctx, wd->source) : JS_UNDEFINED;
    JSValue args[2] = { specifier, source };

    CHECK_EQ(JS_EnqueueJob(ctx, worker_eval, 2, (JSValue *) &args), 0);

    JS_FreeValue(ctx, source);
    JS_FreeValue(ctx, specifier);

    /* Notify the caller we are setup.  */
    wd->wrt = wrt;
    uv_sem_post(wd->sem);
    wd = NULL;

    TJS_Run(wrt);

    /* The runtime is freed by the parent (terminate()/finalizer) after joining
     * this thread, so the parent never dereferences a freed runtime — a worker
     * can stop its own loop (self.close(), an uncaught error) before the parent
     * calls terminate(). */
}

/* Stop the worker (if still running), wait for its thread to finish, then free
 * its runtime. The parent owns the worker runtime's lifetime, so this is safe to
 * call whether the worker is still running or has already stopped itself. */
static void tjs_worker_shutdown(TJSWorker *w) {
    if (w->wrt) {
        TJS_Stop(w->wrt);
        CHECK_EQ(uv_thread_join(&w->tid), 0);
        TJS_FreeRuntime(w->wrt);
        w->wrt = NULL;
    }
}

static void tjs_worker_finalizer(JSRuntime *rt, JSValue val) {
    TJSWorker *w = JS_GetOpaque(val, tjs_worker_class_id);
    if (w) {
        tjs_worker_shutdown(w);
        JS_FreeValueRT(rt, w->message_pipe);
    }
}

static void tjs_worker_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSWorker *w = JS_GetOpaque(val, tjs_worker_class_id);
    if (w) {
        JS_MarkValue(rt, w->message_pipe, mark_func);
    }
}

static JSClassDef tjs_worker_class = {
    "Worker",
    .finalizer = tjs_worker_finalizer,
    .gc_mark = tjs_worker_mark,
};

static TJSWorker *tjs_worker_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_worker_class_id);
}

static JSValue tjs_new_worker(JSContext *ctx, uv_os_sock_t channel_fd) {
    JSValue obj = JS_NewObjectClass(ctx, tjs_worker_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSWorker *w = tjs__mallocz(sizeof(*w));
    if (!w) {
        JS_FreeValue(ctx, obj);
        return JS_ThrowOutOfMemory(ctx);
    }

    w->ctx = ctx;
    w->message_pipe = tjs_new_msgpipe(ctx, channel_fd);

    if (JS_IsException(w->message_pipe)) {
        JS_FreeValue(ctx, obj);
        tjs__free(w);
        return JS_EXCEPTION;
    }

    JS_SetOpaque(obj, w);
    return obj;
}

static JSValue tjs_worker_constructor(JSContext *ctx, JSValue new_target, int argc, JSValue *argv) {
    const char *specifier = JS_ToCString(ctx, argv[0]);
    if (!specifier) {
        return JS_EXCEPTION;
    }

    uv_os_sock_t fds[2];
    int r = uv_socketpair(SOCK_STREAM, 0, fds, UV_NONBLOCK_PIPE, UV_NONBLOCK_PIPE);
    if (r != 0) {
        JS_FreeCString(ctx, specifier);
        return tjs_throw_errno(ctx, r);
    }

    JSValue obj = tjs_new_worker(ctx, fds[0]);
    if (JS_IsException(obj)) {
        close(fds[0]);
        close(fds[1]);
        JS_FreeCString(ctx, specifier);
        return JS_EXCEPTION;
    }

    TJSWorker *w = tjs_worker_get(ctx, obj);

    /* We will wait for the worker to complete the creation of the VM. */
    uv_sem_t sem;
    CHECK_EQ(uv_sem_init(&sem, 0), 0);

    const char *source = JS_IsUndefined(argv[1]) ? NULL : JS_ToCString(ctx, argv[1]);

    worker_data_t worker_data = { .channel_fd = fds[1],
                                  .specifier = specifier,
                                  .source = source,
                                  .sem = &sem,
                                  .wrt = NULL };

    CHECK_EQ(uv_thread_create(&w->tid, worker_entry, (void *) &worker_data), 0);

    /* Wait for the worker to initialize. */
    uv_sem_wait(&sem);
    uv_sem_destroy(&sem);

    JS_FreeCString(ctx, specifier);
    JS_FreeCString(ctx, source);

    uv_update_time(tjs_get_loop(ctx));

    worker_data.sem = NULL;
    w->wrt = worker_data.wrt;
    CHECK_NOT_NULL(w->wrt);

    return obj;
}

static JSValue tjs_worker_terminate(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWorker *w = tjs_worker_get(ctx, this_val);
    if (!w) {
        return JS_EXCEPTION;
    }
    if (w->wrt) {
        tjs_worker_shutdown(w);
        uv_update_time(tjs_get_loop(ctx));
    }
    return JS_UNDEFINED;
}

/* WorkerGlobalScope.close(): stop the calling worker's own runtime. */
static JSValue tjs_worker_self_close(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);
    TJS_Stop(qrt);
    return JS_UNDEFINED;
}

static JSValue tjs_worker_get_msgpipe(JSContext *ctx, JSValue this_val) {
    TJSWorker *w = tjs_worker_get(ctx, this_val);
    if (!w) {
        return JS_EXCEPTION;
    }
    return JS_DupValue(ctx, w->message_pipe);
}

static const JSCFunctionListEntry tjs_worker_proto_funcs[] = {
    TJS_CFUNC_DEF("terminate", 0, tjs_worker_terminate),
    TJS_CGETSET_DEF("messagePipe", tjs_worker_get_msgpipe, NULL),
};

void tjs__mod_worker_init(JSContext *ctx, JSValue ns) {
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSValue proto, obj;

    /* Worker class */
    JS_NewClassID(rt, &tjs_worker_class_id);
    JS_NewClass(rt, tjs_worker_class_id, &tjs_worker_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_worker_proto_funcs, countof(tjs_worker_proto_funcs));
    JS_SetClassProto(ctx, tjs_worker_class_id, proto);

    /* Worker object */
    obj = JS_NewCFunction2(ctx, tjs_worker_constructor, "Worker", 2, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, ns, "Worker", obj, JS_PROP_C_W_E);

    /* Backing for WorkerGlobalScope.close(), wired up by the worker bootstrap. */
    JS_DefinePropertyValueStr(ctx,
                              ns,
                              "workerClose",
                              JS_NewCFunction(ctx, tjs_worker_self_close, "workerClose", 0),
                              JS_PROP_C_W_E);

    /* MessagePipe class */
    JS_NewClassID(rt, &tjs_msgpipe_class_id);
    JS_NewClass(rt, tjs_msgpipe_class_id, &tjs_msgpipe_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_msgpipe_proto_funcs, countof(tjs_msgpipe_proto_funcs));
    JS_SetClassProto(ctx, tjs_msgpipe_class_id, proto);
}

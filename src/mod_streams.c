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
#include "utils.h"

#include <string.h>


/* Forward declarations */
static JSValue tjs_new_tcp(JSContext *ctx, int af);


/* Stream */

typedef struct {
    JSContext *ctx;
    int closed;
    int finalized;
    union {
        uv_handle_t handle;
        uv_stream_t stream;
        uv_tcp_t tcp;
        uv_tty_t tty;
        uv_pipe_t pipe;
    } h;
    struct {
        struct {
            JSValue tarray;
            uint8_t *data;
            size_t len;
        } b;
        TJSPromise result;
    } read;
    struct {
        JSValue on_connection;
    } listen;
} TJSStream;

typedef struct {
    uv_connect_t req;
    TJSPromise result;
} TJSConnectReq;

typedef struct {
    uv_shutdown_t req;
    TJSPromise result;
} TJSShutdownReq;

typedef struct {
    uv_write_t req;
    JSValue tarray;
    TJSPromise result;
} TJSWriteReq;

static TJSStream *tjs_tcp_get(JSContext *ctx, JSValue obj);
static TJSStream *tjs_pipe_get(JSContext *ctx, JSValue obj);

static void uv__stream_close_cb(uv_handle_t *handle) {
    TJSStream *s = handle->data;
    CHECK_NOT_NULL(s);
    s->closed = 1;
    if (s->finalized) {
        tjs__free(s);
    }
}

static void maybe_close(TJSStream *s) {
    if (!uv_is_closing(&s->h.handle)) {
        uv_close(&s->h.handle, uv__stream_close_cb);
    }
}

static JSValue tjs_stream_close(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    JSClassID class_id;
    TJSStream *s = JS_GetAnyOpaque(this_val, &class_id);
    if (!s) {
        return JS_EXCEPTION;
    }

    JSValue arg = JS_UNDEFINED;
    if (TJS_IsPromisePending(ctx, &s->read.result)) {
        TJS_SettlePromise(ctx, &s->read.result, 0, 1, &arg);
        TJS_ClearPromise(ctx, &s->read.result);
    }
    if (!JS_IsUndefined(s->listen.on_connection)) {
        JS_FreeValue(ctx, s->listen.on_connection);
        s->listen.on_connection = JS_UNDEFINED;
    }

    maybe_close(s);
    return JS_UNDEFINED;
}

static void uv__stream_alloc_cb(uv_handle_t *handle, size_t suggested_size, uv_buf_t *buf) {
    TJSStream *s = handle->data;
    CHECK_NOT_NULL(s);
    buf->base = (char *) s->read.b.data;
    buf->len = s->read.b.len;
}

static void uv__stream_read_cb(uv_stream_t *handle, ssize_t nread, const uv_buf_t *buf) {
    TJSStream *s = handle->data;
    CHECK_NOT_NULL(s);

    uv_read_stop(handle);

    JSContext *ctx = s->ctx;
    JSValue arg;
    int is_reject = 0;
    if (nread < 0) {
        if (nread == UV_EOF) {
            arg = JS_NULL;
        } else {
            arg = tjs_new_error(ctx, nread);
            is_reject = 1;
        }
    } else {
        arg = JS_NewInt32(ctx, nread);
    }

    TJS_SettlePromise(ctx, &s->read.result, is_reject, 1, &arg);
    TJS_ClearPromise(ctx, &s->read.result);

    JS_FreeValue(ctx, s->read.b.tarray);
    s->read.b.tarray = JS_UNDEFINED;
    s->read.b.data = NULL;
    s->read.b.len = 0;
}

static JSValue tjs_stream_read(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    JSClassID class_id;
    TJSStream *s = JS_GetAnyOpaque(this_val, &class_id);
    if (!s) {
        return JS_EXCEPTION;
    }
    if (TJS_IsPromisePending(ctx, &s->read.result)) {
        return tjs_throw_errno(ctx, UV_EBUSY);
    }

    size_t size;
    uint8_t *buf = JS_GetUint8Array(ctx, &size, argv[0]);
    if (!buf) {
        return JS_EXCEPTION;
    }
    s->read.b.tarray = JS_DupValue(ctx, argv[0]);
    s->read.b.data = buf;
    s->read.b.len = size;

    int r = uv_read_start(&s->h.stream, uv__stream_alloc_cb, uv__stream_read_cb);
    if (r != 0) {
        JS_FreeValue(ctx, s->read.b.tarray);
        s->read.b.tarray = JS_UNDEFINED;
        s->read.b.data = NULL;
        s->read.b.len = 0;

        return tjs_throw_errno(ctx, r);
    }

    return TJS_InitPromise(ctx, &s->read.result);
}

static void uv__stream_write_cb(uv_write_t *req, int status) {
    TJSStream *s = req->handle->data;
    CHECK_NOT_NULL(s);

    JSContext *ctx = s->ctx;
    TJSWriteReq *wr = req->data;

    int is_reject = 0;
    JSValue arg;
    if (status < 0) {
        arg = tjs_new_error(ctx, status);
        is_reject = 1;
    } else {
        arg = JS_UNDEFINED;
    }

    TJS_SettlePromise(ctx, &wr->result, is_reject, 1, &arg);
    JS_FreeValue(ctx, wr->tarray);
    js_free(ctx, wr);
}

static JSValue tjs_stream_write(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    JSClassID class_id;
    TJSStream *s = JS_GetAnyOpaque(this_val, &class_id);
    if (!s) {
        return JS_EXCEPTION;
    }

    size_t size;
    uint8_t *buf = JS_GetUint8Array(ctx, &size, argv[0]);
    if (!buf) {
        return JS_EXCEPTION;
    }

    /* First try to do the write inline */
    int r;
    uv_buf_t b;
    b = uv_buf_init((char *) buf, size);
    r = uv_try_write(&s->h.stream, &b, 1);

    if (r == size) {
        JSValue val = JS_NewInt64(ctx, size);
        return TJS_NewResolvedPromise(ctx, 1, &val);
    }

    /* Do an async write, copy the data. */
    if (r >= 0) {
        buf += r;
        size -= r;
    }

    TJSWriteReq *wr = js_malloc(ctx, sizeof(*wr));
    if (!wr) {
        return JS_EXCEPTION;
    }

    wr->req.data = wr;
    wr->tarray = JS_DupValue(ctx, argv[0]);

    b = uv_buf_init((char *) buf, size);
    r = uv_write(&wr->req, &s->h.stream, &b, 1, uv__stream_write_cb);
    if (r != 0) {
        JS_FreeValue(ctx, wr->tarray);
        js_free(ctx, wr);
        return tjs_throw_errno(ctx, r);
    }

    return TJS_InitPromise(ctx, &wr->result);
}

static void uv__stream_shutdown_cb(uv_shutdown_t *req, int status) {
    TJSStream *s = req->handle->data;
    CHECK_NOT_NULL(s);

    JSContext *ctx = s->ctx;
    TJSShutdownReq *sr = req->data;
    JSValue arg;
    int is_reject = 0;
    if (status == 0) {
        arg = JS_UNDEFINED;
    } else {
        arg = tjs_new_error(ctx, status);
        is_reject = 1;
    }

    TJS_SettlePromise(ctx, &sr->result, is_reject, 1, &arg);

    js_free(ctx, sr);
}

static JSValue tjs_stream_shutdown(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    JSClassID class_id;
    TJSStream *s = JS_GetAnyOpaque(this_val, &class_id);
    if (!s) {
        return JS_EXCEPTION;
    }

    TJSShutdownReq *sr = js_malloc(ctx, sizeof(*sr));
    if (!sr) {
        return JS_EXCEPTION;
    }
    sr->req.data = sr;

    int r = uv_shutdown(&sr->req, &s->h.stream, uv__stream_shutdown_cb);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return TJS_InitPromise(ctx, &sr->result);
}

static JSValue tjs_stream_fileno(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    JSClassID class_id;
    TJSStream *s = JS_GetAnyOpaque(this_val, &class_id);
    if (!s) {
        return JS_EXCEPTION;
    }
    int r;
    uv_os_fd_t fd;
    r = uv_fileno(&s->h.handle, &fd);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }
    int32_t rfd;
#if defined(_WIN32)
    rfd = (int32_t) (intptr_t) fd;
#else
    rfd = fd;
#endif
    return JS_NewInt32(ctx, rfd);
}

static void uv__stream_connect_cb(uv_connect_t *req, int status) {
    TJSStream *s = req->handle->data;
    CHECK_NOT_NULL(s);

    JSContext *ctx = s->ctx;
    TJSConnectReq *cr = req->data;
    JSValue arg;
    int is_reject = 0;
    if (status == 0) {
        arg = JS_UNDEFINED;
    } else {
        arg = tjs_new_error(ctx, status);
        is_reject = 1;
    }

    TJS_SettlePromise(ctx, &cr->result, is_reject, 1, &arg);

    js_free(ctx, cr);
}

static void uv__stream_connection_cb(uv_stream_t *handle, int status) {
    TJSStream *s = handle->data;
    CHECK_NOT_NULL(s);
    JSContext *ctx = s->ctx;
    JSValue arg;
    if (status == 0) {
        TJSStream *t2;
        switch (handle->type) {
            case UV_TCP:
                arg = tjs_new_tcp(ctx, AF_UNSPEC);
                t2 = tjs_tcp_get(ctx, arg);
                break;
            case UV_NAMED_PIPE:
                arg = tjs_new_pipe(ctx);
                t2 = tjs_pipe_get(ctx, arg);
                break;
            default:
                abort();
        }

        int r = uv_accept(handle, &t2->h.stream);
        if (r != 0) {
            JS_FreeValue(ctx, arg);
            arg = tjs_new_error(ctx, r);
        }
    } else {
        arg = tjs_new_error(ctx, status);
    }

    JS_Call(ctx, s->listen.on_connection, JS_UNDEFINED, 1, &arg);
}

static JSValue tjs_stream_listen(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    JSClassID class_id;
    TJSStream *s = JS_GetAnyOpaque(this_val, &class_id);
    if (!s) {
        return JS_EXCEPTION;
    }
    uint32_t backlog = 511;
    if (!JS_IsFunction(ctx, argv[0])) {
        return JS_EXCEPTION;
    } else {
        s->listen.on_connection = JS_DupValue(ctx, argv[0]);
    }
    if (!JS_IsUndefined(argv[1])) {
        if (JS_ToUint32(ctx, &backlog, argv[1])) {
            return JS_EXCEPTION;
        }
    }
    int r = uv_listen(&s->h.stream, (int) backlog, uv__stream_connection_cb);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }
    return JS_UNDEFINED;
}


static JSValue tjs_stream_set_blocking(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    JSClassID class_id;
    TJSStream *s = JS_GetAnyOpaque(this_val, &class_id);
    if (!s) {
        return JS_EXCEPTION;
    }

    int blocking;
    if ((blocking = JS_ToBool(ctx, argv[0])) == -1) {
        return JS_EXCEPTION;
    }

    int r = uv_stream_set_blocking(&s->h.stream, blocking);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }
    return JS_UNDEFINED;
}

static JSValue tjs_init_stream(JSContext *ctx, JSValue obj, TJSStream *s) {
    s->ctx = ctx;
    s->h.handle.data = s;
    s->read.b.tarray = JS_UNDEFINED;
    s->read.b.data = NULL;
    s->read.b.len = 0;

    TJS_ClearPromise(ctx, &s->read.result);
    s->listen.on_connection = JS_UNDEFINED;

    JS_SetOpaque(obj, s);
    return obj;
}

static void tjs_stream_finalizer(JSRuntime *rt, TJSStream *s) {
    if (s) {
        if (!JS_IsUndefined(s->listen.on_connection)) {
            JS_FreeValueRT(rt, s->listen.on_connection);
        }
        TJS_FreePromiseRT(rt, &s->read.result);
        JS_FreeValueRT(rt, s->read.b.tarray);
        s->finalized = 1;
        if (s->closed) {
            js_free_rt(rt, s);
        } else {
            maybe_close(s);
        }
    }
}

static void tjs_stream_mark(JSRuntime *rt, TJSStream *s, JS_MarkFunc *mark_func) {
    if (s) {
        JS_MarkValue(rt, s->read.b.tarray, mark_func);
        TJS_MarkPromise(rt, &s->read.result, mark_func);
    }
}


/* TCP object  */

static JSClassID tjs_tcp_class_id;

static void tjs_tcp_finalizer(JSRuntime *rt, JSValue val) {
    TJSStream *t = JS_GetOpaque(val, tjs_tcp_class_id);
    tjs_stream_finalizer(rt, t);
}

static void tjs_tcp_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSStream *t = JS_GetOpaque(val, tjs_tcp_class_id);
    tjs_stream_mark(rt, t, mark_func);
}

static JSClassDef tjs_tcp_class = {
    "TCP",
    .finalizer = tjs_tcp_finalizer,
    .gc_mark = tjs_tcp_mark,
};

static JSValue tjs_new_tcp(JSContext *ctx, int af) {
    TJSStream *s;
    JSValue obj;
    int r;

    obj = JS_NewObjectClass(ctx, tjs_tcp_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    s = tjs__mallocz(sizeof(*s));
    if (!s) {
        JS_FreeValue(ctx, obj);
        return JS_ThrowOutOfMemory(ctx);
    }

    r = uv_tcp_init_ex(tjs_get_loop(ctx), &s->h.tcp, af);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        tjs__free(s);
        return JS_ThrowInternalError(ctx, "couldn't initialize TCP handle");
    }

    return tjs_init_stream(ctx, obj, s);
}

static JSValue tjs_tcp_constructor(JSContext *ctx, JSValue new_target, int argc, JSValue *argv) {
    int af = AF_UNSPEC;
    if (!JS_IsUndefined(argv[0]) && JS_ToInt32(ctx, &af, argv[0])) {
        return JS_EXCEPTION;
    }
    return tjs_new_tcp(ctx, af);
}

static TJSStream *tjs_tcp_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_tcp_class_id);
}

static JSValue tjs_tcp_getsockpeername(JSContext *ctx, JSValue this_val, int argc, JSValue *argv, int magic) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    if (!t) {
        return JS_EXCEPTION;
    }
    int r;
    int namelen;
    struct sockaddr_storage addr;
    namelen = sizeof(addr);
    if (magic == 0) {
        r = uv_tcp_getsockname(&t->h.tcp, (struct sockaddr *) &addr, &namelen);
    } else {
        r = uv_tcp_getpeername(&t->h.tcp, (struct sockaddr *) &addr, &namelen);
    }
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);
    tjs_addr2obj(ctx, obj, (struct sockaddr *) &addr, false);
    return obj;
}

static JSValue tjs_tcp_connect(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    if (!t) {
        return JS_EXCEPTION;
    }

    struct sockaddr_storage ss;
    int r;
    r = tjs_obj2addr(ctx, argv[0], &ss);
    if (r != 0) {
        return JS_EXCEPTION;
    }

    TJSConnectReq *cr = js_malloc(ctx, sizeof(*cr));
    if (!cr) {
        return JS_EXCEPTION;
    }
    cr->req.data = cr;

    r = uv_tcp_connect(&cr->req, &t->h.tcp, (struct sockaddr *) &ss, uv__stream_connect_cb);
    if (r != 0) {
        js_free(ctx, cr);
        return tjs_throw_errno(ctx, r);
    }

    return TJS_InitPromise(ctx, &cr->result);
}

static JSValue tjs_tcp_bind(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    if (!t) {
        return JS_EXCEPTION;
    }

    struct sockaddr_storage ss;
    int r;
    r = tjs_obj2addr(ctx, argv[0], &ss);
    if (r != 0) {
        return JS_EXCEPTION;
    }

    int flags = 0;
    if (!JS_IsUndefined(argv[1]) && JS_ToInt32(ctx, &flags, argv[1])) {
        return JS_EXCEPTION;
    }

    r = uv_tcp_bind(&t->h.tcp, (struct sockaddr *) &ss, flags);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_tcp_keepalive(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    if (!t) {
        return JS_EXCEPTION;
    }

    int enable;
    if ((enable = JS_ToBool(ctx, argv[0])) == -1) {
        return JS_EXCEPTION;
    }

    int delay;
    if (JS_ToInt32(ctx, &delay, argv[1])) {
        return JS_EXCEPTION;
    }

    int r = uv_tcp_keepalive(&t->h.tcp, enable, delay);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_tcp_nodelay(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    if (!t) {
        return JS_EXCEPTION;
    }

    int enable;
    if ((enable = JS_ToBool(ctx, argv[0])) == -1) {
        return JS_EXCEPTION;
    }

    int r = uv_tcp_nodelay(&t->h.tcp, enable);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}


/* TTY */

static JSClassID tjs_tty_class_id;

static void tjs_tty_finalizer(JSRuntime *rt, JSValue val) {
    TJSStream *t = JS_GetOpaque(val, tjs_tty_class_id);
    tjs_stream_finalizer(rt, t);
}

static void tjs_tty_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSStream *t = JS_GetOpaque(val, tjs_tty_class_id);
    tjs_stream_mark(rt, t, mark_func);
}

static JSClassDef tjs_tty_class = {
    "TTY",
    .finalizer = tjs_tty_finalizer,
    .gc_mark = tjs_tty_mark,
};

static JSValue tjs_tty_constructor(JSContext *ctx, JSValue new_target, int argc, JSValue *argv) {
    TJSStream *s;
    JSValue obj;
    int fd, r, readable;

    if (JS_ToInt32(ctx, &fd, argv[0])) {
        return JS_EXCEPTION;
    }

    if ((readable = JS_ToBool(ctx, argv[1])) == -1) {
        return JS_EXCEPTION;
    }

    obj = JS_NewObjectClass(ctx, tjs_tty_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    s = tjs__mallocz(sizeof(*s));
    if (!s) {
        JS_FreeValue(ctx, obj);
        return JS_ThrowOutOfMemory(ctx);
    }

    r = uv_tty_init(tjs_get_loop(ctx), &s->h.tty, fd, readable);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        tjs__free(s);
        return JS_ThrowInternalError(ctx, "couldn't initialize TTY handle");
    }

    return tjs_init_stream(ctx, obj, s);
}

static TJSStream *tjs_tty_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_tty_class_id);
}

static JSValue tjs_tty_setMode(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSStream *s = tjs_tty_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }

    int mode;
    if (JS_ToInt32(ctx, &mode, argv[0])) {
        return JS_EXCEPTION;
    }

    int r = uv_tty_set_mode(&s->h.tty, mode);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_tty_getWinSize(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSStream *s = tjs_tty_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }

    int r, width, height;
    r = uv_tty_get_winsize(&s->h.tty, &width, &height);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);
    JS_DefinePropertyValueStr(ctx, obj, "width", JS_NewInt32(ctx, width), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, obj, "height", JS_NewInt32(ctx, height), JS_PROP_C_W_E);
    return obj;
}


/* Pipe */

static JSClassID tjs_pipe_class_id;

static void tjs_pipe_finalizer(JSRuntime *rt, JSValue val) {
    TJSStream *t = JS_GetOpaque(val, tjs_pipe_class_id);
    tjs_stream_finalizer(rt, t);
}

static void tjs_pipe_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSStream *t = JS_GetOpaque(val, tjs_pipe_class_id);
    tjs_stream_mark(rt, t, mark_func);
}

static JSClassDef tjs_pipe_class = {
    "Pipe",
    .finalizer = tjs_pipe_finalizer,
    .gc_mark = tjs_pipe_mark,
};

JSValue tjs_new_pipe(JSContext *ctx) {
    TJSStream *s;
    JSValue obj;
    int r;

    obj = JS_NewObjectClass(ctx, tjs_pipe_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    s = tjs__mallocz(sizeof(*s));
    if (!s) {
        JS_FreeValue(ctx, obj);
        return JS_ThrowOutOfMemory(ctx);
    }

    r = uv_pipe_init(tjs_get_loop(ctx), &s->h.pipe, 0);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        tjs__free(s);
        return JS_ThrowInternalError(ctx, "couldn't initialize Pipe handle");
    }

    return tjs_init_stream(ctx, obj, s);
}

static JSValue tjs_pipe_constructor(JSContext *ctx, JSValue new_target, int argc, JSValue *argv) {
    return tjs_new_pipe(ctx);
}

static TJSStream *tjs_pipe_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_pipe_class_id);
}

uv_stream_t *tjs_pipe_get_stream(JSContext *ctx, JSValue obj) {
    TJSStream *s = tjs_pipe_get(ctx, obj);
    if (s) {
        return &s->h.stream;
    }
    return NULL;
}

static JSValue tjs_pipe_getsockpeername(JSContext *ctx, JSValue this_val, int argc, JSValue *argv, int magic) {
    TJSStream *t = tjs_pipe_get(ctx, this_val);
    if (!t) {
        return JS_EXCEPTION;
    }

    char buf[1024];
    size_t len = sizeof(buf);
    int r;

    if (magic == 0) {
        r = uv_pipe_getsockname(&t->h.pipe, buf, &len);
    } else {
        r = uv_pipe_getpeername(&t->h.pipe, buf, &len);
    }
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_NewStringLen(ctx, buf, len);
}

static JSValue tjs_pipe_connect(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSStream *t = tjs_pipe_get(ctx, this_val);
    if (!t) {
        return JS_EXCEPTION;
    }

    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "the pipe name must be a string");
    }

    size_t len;
    const char *name = JS_ToCStringLen(ctx, &len, argv[0]);
    if (!name) {
        return JS_EXCEPTION;
    }

    TJSConnectReq *cr = js_malloc(ctx, sizeof(*cr));
    if (!cr) {
        JS_FreeCString(ctx, name);
        return JS_EXCEPTION;
    }
    cr->req.data = cr;

    int r = uv_pipe_connect2(&cr->req, &t->h.pipe, name, len, 0, uv__stream_connect_cb);
    JS_FreeCString(ctx, name);
    if (r != 0) {
        js_free(ctx, cr);
        return tjs_throw_errno(ctx, r);
    }

    return TJS_InitPromise(ctx, &cr->result);
}

static JSValue tjs_pipe_bind(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSStream *t = tjs_pipe_get(ctx, this_val);
    if (!t) {
        return JS_EXCEPTION;
    }

    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "the pipe name must be a string");
    }

    size_t len;
    const char *name = JS_ToCStringLen(ctx, &len, argv[0]);
    if (!name) {
        return JS_EXCEPTION;
    }

    int r = uv_pipe_bind2(&t->h.pipe, name, len, 0);
    JS_FreeCString(ctx, name);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_pipe_open(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSStream *t = tjs_pipe_get(ctx, this_val);
    if (!t) {
        return JS_EXCEPTION;
    }

    int fd;
    if (JS_ToInt32(ctx, &fd, argv[0])) {
        return JS_EXCEPTION;
    }

    int r = uv_pipe_open(&t->h.pipe, fd);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

/* clang-format off */
static const JSCFunctionListEntry tjs_stream_proto_funcs[] = {
    TJS_CFUNC_DEF("listen", 1, tjs_stream_listen),
    TJS_CFUNC_DEF("shutdown", 0, tjs_stream_shutdown),
    TJS_CFUNC_DEF("setBlocking", 1, tjs_stream_set_blocking),
    TJS_CFUNC_DEF("close", 0, tjs_stream_close),
    TJS_CFUNC_DEF("read", 1, tjs_stream_read),
    TJS_CFUNC_DEF("write", 1, tjs_stream_write),
    TJS_CFUNC_DEF("fileno", 0, tjs_stream_fileno),
};
/* clang-format on */

static const JSCFunctionListEntry tjs_tcp_proto_funcs[] = {
    JS_CFUNC_MAGIC_DEF("getsockname", 0, tjs_tcp_getsockpeername, 0),
    JS_CFUNC_MAGIC_DEF("getpeername", 0, tjs_tcp_getsockpeername, 1),
    TJS_CFUNC_DEF("connect", 1, tjs_tcp_connect),
    TJS_CFUNC_DEF("bind", 2, tjs_tcp_bind),
    TJS_CFUNC_DEF("setKeepAlive", 2, tjs_tcp_keepalive),
    TJS_CFUNC_DEF("setNoDelay", 1, tjs_tcp_nodelay),
};

static const JSCFunctionListEntry tjs_tty_proto_funcs[] = {
    TJS_CFUNC_DEF("setMode", 1, tjs_tty_setMode),
    TJS_CFUNC_DEF("getWinSize", 0, tjs_tty_getWinSize),
};

static const JSCFunctionListEntry tjs_pipe_proto_funcs[] = {
    TJS_CFUNC_DEF("open", 1, tjs_pipe_open),
    JS_CFUNC_MAGIC_DEF("getsockname", 0, tjs_pipe_getsockpeername, 0),
    JS_CFUNC_MAGIC_DEF("getpeername", 0, tjs_pipe_getsockpeername, 1),
    TJS_CFUNC_DEF("connect", 1, tjs_pipe_connect),
    TJS_CFUNC_DEF("bind", 1, tjs_pipe_bind),
};

static const JSCFunctionListEntry tjs_streams_funcs[] = {
    TJS_UVCONST(TCP_IPV6ONLY),
    TJS_UVCONST(TTY_MODE_NORMAL),
    TJS_UVCONST(TTY_MODE_RAW),
};

void tjs__mod_streams_init(JSContext *ctx, JSValue ns) {
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSValue proto, obj, stream_proto;

    /* Stream prototype */
    stream_proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, stream_proto, tjs_stream_proto_funcs, countof(tjs_stream_proto_funcs));

    /* TCP class */
    JS_NewClassID(rt, &tjs_tcp_class_id);
    JS_NewClass(rt, tjs_tcp_class_id, &tjs_tcp_class);
    proto = JS_NewObjectProto(ctx, stream_proto);
    JS_SetPropertyFunctionList(ctx, proto, tjs_tcp_proto_funcs, countof(tjs_tcp_proto_funcs));
    JS_SetClassProto(ctx, tjs_tcp_class_id, proto);

    /* TCP object */
    obj = JS_NewCFunction2(ctx, tjs_tcp_constructor, "TCP", 1, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, ns, "TCP", obj, JS_PROP_C_W_E);

    /* TTY class */
    JS_NewClassID(rt, &tjs_tty_class_id);
    JS_NewClass(rt, tjs_tty_class_id, &tjs_tty_class);
    proto = JS_NewObjectProto(ctx, stream_proto);
    JS_SetPropertyFunctionList(ctx, proto, tjs_tty_proto_funcs, countof(tjs_tty_proto_funcs));
    JS_SetClassProto(ctx, tjs_tty_class_id, proto);

    /* TTY object */
    obj = JS_NewCFunction2(ctx, tjs_tty_constructor, "TTY", 1, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, ns, "TTY", obj, JS_PROP_C_W_E);

    /* Pipe class */
    JS_NewClassID(rt, &tjs_pipe_class_id);
    JS_NewClass(rt, tjs_pipe_class_id, &tjs_pipe_class);
    proto = JS_NewObjectProto(ctx, stream_proto);
    JS_SetPropertyFunctionList(ctx, proto, tjs_pipe_proto_funcs, countof(tjs_pipe_proto_funcs));
    JS_SetClassProto(ctx, tjs_pipe_class_id, proto);

    /* Pipe object */
    obj = JS_NewCFunction2(ctx, tjs_pipe_constructor, "Pipe", 1, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, ns, "Pipe", obj, JS_PROP_C_W_E);

    JS_SetPropertyFunctionList(ctx, ns, tjs_streams_funcs, countof(tjs_streams_funcs));

    JS_FreeValue(ctx, stream_proto);
}

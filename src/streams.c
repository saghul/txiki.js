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
        TJSPromise result;
    } accept;
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

static TJSStream *tjs_tcp_get(JSContext *ctx, JSValueConst obj);
static TJSStream *tjs_pipe_get(JSContext *ctx, JSValueConst obj);

static void uv__stream_close_cb(uv_handle_t *handle) {
    TJSStream *s = handle->data;
    CHECK_NOT_NULL(s);
    s->closed = 1;
    if (s->finalized)
        free(s);
}

static void maybe_close(TJSStream *s) {
    if (!uv_is_closing(&s->h.handle))
        uv_close(&s->h.handle, uv__stream_close_cb);
}

static JSValue tjs_stream_close(JSContext *ctx, TJSStream *s, int argc, JSValueConst *argv) {
    if (!s)
        return JS_EXCEPTION;

    JSValue arg = JS_UNDEFINED;
    if (TJS_IsPromisePending(ctx, &s->read.result)) {
        TJS_SettlePromise(ctx, &s->read.result, 0, 1, (JSValueConst *) &arg);
        TJS_ClearPromise(ctx, &s->read.result);
    }
    if (TJS_IsPromisePending(ctx, &s->accept.result)) {
        TJS_SettlePromise(ctx, &s->accept.result, 0, 1, (JSValueConst *) &arg);
        TJS_ClearPromise(ctx, &s->accept.result);
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
            arg = JS_UNDEFINED;
        } else {
            arg = tjs_new_error(ctx, nread);
            is_reject = 1;
        }
    } else {
        arg = JS_NewInt32(ctx, nread);
    }

    TJS_SettlePromise(ctx, &s->read.result, is_reject, 1, (JSValueConst *) &arg);
    TJS_ClearPromise(ctx, &s->read.result);

    JS_FreeValue(ctx, s->read.b.tarray);
    s->read.b.tarray = JS_UNDEFINED;
    s->read.b.data = NULL;
    s->read.b.len = 0;
}

static JSValue tjs_stream_read(JSContext *ctx, TJSStream *s, int argc, JSValueConst *argv) {
    if (!s)
        return JS_EXCEPTION;
    if (TJS_IsPromisePending(ctx, &s->read.result))
        return tjs_throw_errno(ctx, UV_EBUSY);

    size_t size;
    uint8_t *buf = JS_GetUint8Array(ctx, &size, argv[0]);
    if (!buf)
        return JS_EXCEPTION;
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

    TJS_SettlePromise(ctx, &wr->result, is_reject, 1, (JSValueConst *) &arg);
    JS_FreeValue(ctx, wr->tarray);
    js_free(ctx, wr);
}

static JSValue tjs_stream_write(JSContext *ctx, TJSStream *s, int argc, JSValueConst *argv) {
    if (!s)
        return JS_EXCEPTION;

    size_t size;
    uint8_t *buf = JS_GetUint8Array(ctx, &size, argv[0]);
    if (!buf)
        return JS_EXCEPTION;

    /* First try to do the write inline */
    int r;
    uv_buf_t b;
    b = uv_buf_init((char *)buf, size);
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
    if (!wr)
        return JS_EXCEPTION;

    wr->req.data = wr;
    wr->tarray = JS_DupValue(ctx, argv[0]);

    b = uv_buf_init((char *)buf, size);
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

    TJS_SettlePromise(ctx, &sr->result, is_reject, 1, (JSValueConst *) &arg);

    js_free(ctx, sr);
}

static JSValue tjs_stream_shutdown(JSContext *ctx, TJSStream *s, int argc, JSValueConst *argv) {
    if (!s)
        return JS_EXCEPTION;

    TJSShutdownReq *sr = js_malloc(ctx, sizeof(*sr));
    if (!sr)
        return JS_EXCEPTION;
    sr->req.data = sr;

    int r = uv_shutdown(&sr->req, &s->h.stream, uv__stream_shutdown_cb);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return TJS_InitPromise(ctx, &sr->result);
}

static JSValue tjs_stream_fileno(JSContext *ctx, TJSStream *s, int argc, JSValueConst *argv) {
    if (!s)
        return JS_EXCEPTION;
    int r;
    uv_os_fd_t fd;
    r = uv_fileno(&s->h.handle, &fd);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }
    int32_t rfd;
#if defined(_WIN32)
    rfd = (int32_t)(intptr_t) fd;
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

    TJS_SettlePromise(ctx, &cr->result, is_reject, 1, (JSValueConst *) &arg);

    js_free(ctx, cr);
}

static void uv__stream_connection_cb(uv_stream_t *handle, int status) {
    TJSStream *s = handle->data;
    CHECK_NOT_NULL(s);

    if (!TJS_IsPromisePending(s->ctx, &s->accept.result)) {
        // TODO - handle this.
        return;
    }
    JSContext *ctx = s->ctx;
    JSValue arg;
    int is_reject = 0;
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
            is_reject = 1;
        }
    } else {
        arg = tjs_new_error(ctx, status);
        is_reject = 1;
    }

    TJS_SettlePromise(ctx, &s->accept.result, is_reject, 1, (JSValueConst *) &arg);
    TJS_ClearPromise(ctx, &s->accept.result);
}

static JSValue tjs_stream_listen(JSContext *ctx, TJSStream *s, int argc, JSValueConst *argv) {
    if (!s)
        return JS_EXCEPTION;
    uint32_t backlog = 511;
    if (!JS_IsUndefined(argv[0])) {
        if (JS_ToUint32(ctx, &backlog, argv[0]))
            return JS_EXCEPTION;
    }
    int r = uv_listen(&s->h.stream, (int) backlog, uv__stream_connection_cb);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }
    return JS_UNDEFINED;
}

static JSValue tjs_stream_accept(JSContext *ctx, TJSStream *s, int argc, JSValueConst *argv) {
    if (!s)
        return JS_EXCEPTION;
    if (TJS_IsPromisePending(ctx, &s->accept.result))
        return tjs_throw_errno(ctx, UV_EBUSY);
    return TJS_InitPromise(ctx, &s->accept.result);
}

static JSValue tjs_init_stream(JSContext *ctx, JSValue obj, TJSStream *s) {
    s->ctx = ctx;
    s->closed = 0;
    s->finalized = 0;

    s->h.handle.data = s;

    s->read.b.tarray = JS_UNDEFINED;
    s->read.b.data = NULL;
    s->read.b.len = 0;

    TJS_ClearPromise(ctx, &s->read.result);
    TJS_ClearPromise(ctx, &s->accept.result);

    JS_SetOpaque(obj, s);
    return obj;
}

static void tjs_stream_finalizer(JSRuntime *rt, TJSStream *s) {
    if (s) {
        TJS_FreePromiseRT(rt, &s->accept.result);
        TJS_FreePromiseRT(rt, &s->read.result);
        JS_FreeValueRT(rt, s->read.b.tarray);
        s->finalized = 1;
        if (s->closed)
            free(s);
        else
            maybe_close(s);
    }
}

static void tjs_stream_mark(JSRuntime *rt, TJSStream *s, JS_MarkFunc *mark_func) {
    if (s) {
        JS_MarkValue(rt, s->read.b.tarray, mark_func);
        TJS_MarkPromise(rt, &s->read.result, mark_func);
        TJS_MarkPromise(rt, &s->accept.result, mark_func);
    }
}


/* TCP object  */

static JSClassID tjs_tcp_class_id;

static void tjs_tcp_finalizer(JSRuntime *rt, JSValue val) {
    TJSStream *t = JS_GetOpaque(val, tjs_tcp_class_id);
    tjs_stream_finalizer(rt, t);
}

static void tjs_tcp_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
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
    if (JS_IsException(obj))
        return obj;

    s = calloc(1, sizeof(*s));
    if (!s) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    r = uv_tcp_init_ex(tjs_get_loop(ctx), &s->h.tcp, af);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        free(s);
        return JS_ThrowInternalError(ctx, "couldn't initialize TCP handle");
    }

    return tjs_init_stream(ctx, obj, s);
}

static JSValue tjs_tcp_constructor(JSContext *ctx, JSValueConst new_target, int argc, JSValueConst *argv) {
    int af = AF_UNSPEC;
    if (!JS_IsUndefined(argv[0]) && JS_ToInt32(ctx, &af, argv[0]))
        return JS_EXCEPTION;
    return tjs_new_tcp(ctx, af);
}

static TJSStream *tjs_tcp_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, tjs_tcp_class_id);
}

static JSValue tjs_tcp_getsockpeername(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv, int magic) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;
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
    tjs_addr2obj(ctx, obj, (struct sockaddr *) &addr);
    return obj;
}

static JSValue tjs_tcp_connect(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;

    struct sockaddr_storage ss;
    int r;
    r = tjs_obj2addr(ctx, argv[0], &ss);
    if (r != 0)
        return JS_EXCEPTION;

    TJSConnectReq *cr = js_malloc(ctx, sizeof(*cr));
    if (!cr)
        return JS_EXCEPTION;
    cr->req.data = cr;

    r = uv_tcp_connect(&cr->req, &t->h.tcp, (struct sockaddr *) &ss, uv__stream_connect_cb);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return TJS_InitPromise(ctx, &cr->result);
}

static JSValue tjs_tcp_bind(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;

    struct sockaddr_storage ss;
    int r;
    r = tjs_obj2addr(ctx, argv[0], &ss);
    if (r != 0)
        return JS_EXCEPTION;

    int flags = 0;
    if (!JS_IsUndefined(argv[1]) && JS_ToInt32(ctx, &flags, argv[1]))
        return JS_EXCEPTION;

    r = uv_tcp_bind(&t->h.tcp, (struct sockaddr *) &ss, flags);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static JSValue tjs_tcp_keepalive(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;

    int enable;
    if ((enable = JS_ToBool(ctx, argv[0])) == -1)
        return JS_EXCEPTION;

    int r = uv_tcp_keepalive(&t->h.tcp, enable, 0);
    if (r != 0 && r != UV_EINVAL) // Filter out EINVAL: https://github.com/libuv/libuv/pull/3488#issuecomment-1057836172
        return tjs_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static JSValue tjs_tcp_nodelay(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;

    int enable;
    if ((enable = JS_ToBool(ctx, argv[0])) == -1)
        return JS_EXCEPTION;

    int r = uv_tcp_nodelay(&t->h.tcp, enable);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static JSValue tjs_tcp_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    return tjs_stream_close(ctx, t, argc, argv);
}

static JSValue tjs_tcp_read(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    return tjs_stream_read(ctx, t, argc, argv);
}

static JSValue tjs_tcp_write(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    return tjs_stream_write(ctx, t, argc, argv);
}

static JSValue tjs_tcp_shutdown(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    return tjs_stream_shutdown(ctx, t, argc, argv);
}

static JSValue tjs_tcp_fileno(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    return tjs_stream_fileno(ctx, t, argc, argv);
}

static JSValue tjs_tcp_listen(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    return tjs_stream_listen(ctx, t, argc, argv);
}

static JSValue tjs_tcp_accept(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_tcp_get(ctx, this_val);
    return tjs_stream_accept(ctx, t, argc, argv);
}


/* TTY */

static JSClassID tjs_tty_class_id;

static void tjs_tty_finalizer(JSRuntime *rt, JSValue val) {
    TJSStream *t = JS_GetOpaque(val, tjs_tty_class_id);
    tjs_stream_finalizer(rt, t);
}

static void tjs_tty_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    TJSStream *t = JS_GetOpaque(val, tjs_tty_class_id);
    tjs_stream_mark(rt, t, mark_func);
}

static JSClassDef tjs_tty_class = {
    "TTY",
    .finalizer = tjs_tty_finalizer,
    .gc_mark = tjs_tty_mark,
};

static JSValue tjs_tty_constructor(JSContext *ctx, JSValueConst new_target, int argc, JSValueConst *argv) {
    TJSStream *s;
    JSValue obj;
    int fd, r, readable;

    if (JS_ToInt32(ctx, &fd, argv[0]))
        return JS_EXCEPTION;

    if ((readable = JS_ToBool(ctx, argv[1])) == -1)
        return JS_EXCEPTION;

    obj = JS_NewObjectClass(ctx, tjs_tty_class_id);
    if (JS_IsException(obj))
        return obj;

    s = calloc(1, sizeof(*s));
    if (!s) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    r = uv_tty_init(tjs_get_loop(ctx), &s->h.tty, fd, readable);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        free(s);
        return JS_ThrowInternalError(ctx, "couldn't initialize TTY handle");
    }

    return tjs_init_stream(ctx, obj, s);
}

static TJSStream *tjs_tty_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, tjs_tty_class_id);
}

static JSValue tjs_tty_setMode(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *s = tjs_tty_get(ctx, this_val);
    if (!s)
        return JS_EXCEPTION;

    int mode;
    if (JS_ToInt32(ctx, &mode, argv[0]))
        return JS_EXCEPTION;

    int r = uv_tty_set_mode(&s->h.tty, mode);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static JSValue tjs_tty_getWinSize(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *s = tjs_tty_get(ctx, this_val);
    if (!s)
        return JS_EXCEPTION;

    int r, width, height;
    r = uv_tty_get_winsize(&s->h.tty, &width, &height);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);
    JS_DefinePropertyValueStr(ctx, obj, "width", JS_NewInt32(ctx, width), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, obj, "height", JS_NewInt32(ctx, height), JS_PROP_C_W_E);
    return obj;
}

static JSValue tjs_tty_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_tty_get(ctx, this_val);
    return tjs_stream_close(ctx, t, argc, argv);
}

static JSValue tjs_tty_read(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_tty_get(ctx, this_val);
    return tjs_stream_read(ctx, t, argc, argv);
}

static JSValue tjs_tty_write(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_tty_get(ctx, this_val);
    return tjs_stream_write(ctx, t, argc, argv);
}

static JSValue tjs_tty_fileno(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_tty_get(ctx, this_val);
    return tjs_stream_fileno(ctx, t, argc, argv);
}


/* Pipe */

static JSClassID tjs_pipe_class_id;

static void tjs_pipe_finalizer(JSRuntime *rt, JSValue val) {
    TJSStream *t = JS_GetOpaque(val, tjs_pipe_class_id);
    tjs_stream_finalizer(rt, t);
}

static void tjs_pipe_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
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
    if (JS_IsException(obj))
        return obj;

    s = calloc(1, sizeof(*s));
    if (!s) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    r = uv_pipe_init(tjs_get_loop(ctx), &s->h.pipe, 0);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        free(s);
        return JS_ThrowInternalError(ctx, "couldn't initialize Pipe handle");
    }

    return tjs_init_stream(ctx, obj, s);
}

static JSValue tjs_pipe_constructor(JSContext *ctx, JSValueConst new_target, int argc, JSValueConst *argv) {
    return tjs_new_pipe(ctx);
}

static TJSStream *tjs_pipe_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, tjs_pipe_class_id);
}

uv_stream_t *tjs_pipe_get_stream(JSContext *ctx, JSValueConst obj) {
    TJSStream *s = tjs_pipe_get(ctx, obj);
    if (s)
        return &s->h.stream;
    return NULL;
}

static JSValue tjs_pipe_getsockpeername(JSContext *ctx,
                                        JSValueConst this_val,
                                        int argc,
                                        JSValueConst *argv,
                                        int magic) {
    TJSStream *t = tjs_pipe_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;

    char buf[1024];
    size_t len = sizeof(buf);
    int r;

    if (magic == 0) {
        r = uv_pipe_getsockname(&t->h.pipe, buf, &len);
    } else {
        r = uv_pipe_getpeername(&t->h.pipe, buf, &len);
    }
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return JS_NewStringLen(ctx, buf, len);
}

static JSValue tjs_pipe_connect(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_pipe_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;

    if (!JS_IsString(argv[0]))
        return JS_ThrowTypeError(ctx, "the pipe name must be a string");

    const char *name = JS_ToCString(ctx, argv[0]);
    if (!name)
        return JS_EXCEPTION;

    TJSConnectReq *cr = js_malloc(ctx, sizeof(*cr));
    if (!cr) {
        JS_FreeCString(ctx, name);
        return JS_EXCEPTION;
    }
    cr->req.data = cr;

    uv_pipe_connect(&cr->req, &t->h.pipe, name, uv__stream_connect_cb);

    JS_FreeCString(ctx, name);

    return TJS_InitPromise(ctx, &cr->result);
}

static JSValue tjs_pipe_bind(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_pipe_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;

    if (!JS_IsString(argv[0]))
        return JS_ThrowTypeError(ctx, "the pipe name must be a string");

    const char *name = JS_ToCString(ctx, argv[0]);
    if (!name)
        return JS_EXCEPTION;

    int r = uv_pipe_bind(&t->h.pipe, name);
    JS_FreeCString(ctx, name);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static JSValue tjs_pipe_open(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_pipe_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;

    int fd;
    if (JS_ToInt32(ctx, &fd, argv[0]))
        return JS_EXCEPTION;

    int r = uv_pipe_open(&t->h.pipe, fd);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static JSValue tjs_pipe_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_pipe_get(ctx, this_val);
    return tjs_stream_close(ctx, t, argc, argv);
}

static JSValue tjs_pipe_read(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_pipe_get(ctx, this_val);
    return tjs_stream_read(ctx, t, argc, argv);
}

static JSValue tjs_pipe_write(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_pipe_get(ctx, this_val);
    return tjs_stream_write(ctx, t, argc, argv);
}

static JSValue tjs_pipe_fileno(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_pipe_get(ctx, this_val);
    return tjs_stream_fileno(ctx, t, argc, argv);
}

static JSValue tjs_pipe_listen(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_pipe_get(ctx, this_val);
    return tjs_stream_listen(ctx, t, argc, argv);
}

static JSValue tjs_pipe_accept(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSStream *t = tjs_pipe_get(ctx, this_val);
    return tjs_stream_accept(ctx, t, argc, argv);
}

static const JSCFunctionListEntry tjs_tcp_proto_funcs[] = {
    /* Stream functions */
    TJS_CFUNC_DEF("close", 0, tjs_tcp_close),
    TJS_CFUNC_DEF("read", 1, tjs_tcp_read),
    TJS_CFUNC_DEF("write", 1, tjs_tcp_write),
    TJS_CFUNC_DEF("shutdown", 0, tjs_tcp_shutdown),
    TJS_CFUNC_DEF("fileno", 0, tjs_tcp_fileno),
    TJS_CFUNC_DEF("listen", 1, tjs_tcp_listen),
    TJS_CFUNC_DEF("accept", 0, tjs_tcp_accept),
    /* TCP functions */
    JS_CFUNC_MAGIC_DEF("getsockname", 0, tjs_tcp_getsockpeername, 0),
    JS_CFUNC_MAGIC_DEF("getpeername", 0, tjs_tcp_getsockpeername, 1),
    TJS_CFUNC_DEF("connect", 1, tjs_tcp_connect),
    TJS_CFUNC_DEF("bind", 2, tjs_tcp_bind),
    TJS_CFUNC_DEF("setKeepAlive", 1, tjs_tcp_keepalive),
    TJS_CFUNC_DEF("setNoDelay", 1, tjs_tcp_nodelay),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "TCP", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_tcp_class_funcs[] = {
    JS_PROP_INT32_DEF("IPV6ONLY", UV_TCP_IPV6ONLY, 0),
};

static const JSCFunctionListEntry tjs_tty_proto_funcs[] = {
    /* Stream functions */
    TJS_CFUNC_DEF("close", 0, tjs_tty_close),
    TJS_CFUNC_DEF("read", 1, tjs_tty_read),
    TJS_CFUNC_DEF("write", 1, tjs_tty_write),
    TJS_CFUNC_DEF("fileno", 0, tjs_tty_fileno),
    /* TTY functions */
    TJS_CFUNC_DEF("setMode", 1, tjs_tty_setMode),
    TJS_CFUNC_DEF("getWinSize", 0, tjs_tty_getWinSize),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "TTY", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_tty_class_funcs[] = {
    TJS_UVCONST(TTY_MODE_NORMAL),
    TJS_UVCONST(TTY_MODE_RAW),
};

static const JSCFunctionListEntry tjs_pipe_proto_funcs[] = {
    /* Stream functions */
    TJS_CFUNC_DEF("close", 0, tjs_pipe_close),
    TJS_CFUNC_DEF("read", 1, tjs_pipe_read),
    TJS_CFUNC_DEF("write", 1, tjs_pipe_write),
    TJS_CFUNC_DEF("fileno", 0, tjs_pipe_fileno),
    TJS_CFUNC_DEF("listen", 1, tjs_pipe_listen),
    TJS_CFUNC_DEF("accept", 0, tjs_pipe_accept),
    TJS_CFUNC_DEF("open", 1, tjs_pipe_open),
    /* Pipe functions */
    JS_CFUNC_MAGIC_DEF("getsockname", 0, tjs_pipe_getsockpeername, 0),
    JS_CFUNC_MAGIC_DEF("getpeername", 0, tjs_pipe_getsockpeername, 1),
    TJS_CFUNC_DEF("connect", 1, tjs_pipe_connect),
    TJS_CFUNC_DEF("bind", 1, tjs_pipe_bind),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Pipe", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_streams_funcs[] = {
    TJS_UVCONST(TCP_IPV6ONLY),
};

void tjs__mod_streams_init(JSContext *ctx, JSValue ns) {
    JSValue proto, obj;

    /* TCP class */
    JS_NewClassID(&tjs_tcp_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_tcp_class_id, &tjs_tcp_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_tcp_proto_funcs, countof(tjs_tcp_proto_funcs));
    JS_SetClassProto(ctx, tjs_tcp_class_id, proto);

    /* TCP object */
    obj = JS_NewCFunction2(ctx, tjs_tcp_constructor, "TCP", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, obj, tjs_tcp_class_funcs, countof(tjs_tcp_class_funcs));
    JS_DefinePropertyValueStr(ctx, ns, "TCP", obj, JS_PROP_C_W_E);

    /* TTY class */
    JS_NewClassID(&tjs_tty_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_tty_class_id, &tjs_tty_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_tty_proto_funcs, countof(tjs_tty_proto_funcs));
    JS_SetClassProto(ctx, tjs_tty_class_id, proto);

    /* TTY object */
    obj = JS_NewCFunction2(ctx, tjs_tty_constructor, "TTY", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, obj, tjs_tty_class_funcs, countof(tjs_tty_class_funcs));
    JS_DefinePropertyValueStr(ctx, ns, "TTY", obj, JS_PROP_C_W_E);

    /* Pipe class */
    JS_NewClassID(&tjs_pipe_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_pipe_class_id, &tjs_pipe_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_pipe_proto_funcs, countof(tjs_pipe_proto_funcs));
    JS_SetClassProto(ctx, tjs_pipe_class_id, proto);

    /* Pipe object */
    obj = JS_NewCFunction2(ctx, tjs_pipe_constructor, "Pipe", 1, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, ns, "Pipe", obj, JS_PROP_C_W_E);

    JS_SetPropertyFunctionList(ctx, ns, tjs_streams_funcs, countof(tjs_streams_funcs));
}

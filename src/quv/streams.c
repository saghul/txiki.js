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

#include "../cutils.h"
#include "error.h"
#include "streams.h"
#include "timers.h"
#include "utils.h"


/* Forward declarations */
static JSValue js_new_uv_tcp(JSContext *ctx, int af);
static JSValue js_new_uv_pipe(JSContext *ctx);


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
        uv_connect_t req;
        JSValue promise;
        JSValue resolving_funcs[2];
    } connect;
    struct {
        JSValue promise;
        JSValue resolving_funcs[2];
    } read;
    struct {
        uv_shutdown_t req;
        JSValue promise;
        JSValue resolving_funcs[2];
    } shutdown;
    struct {
        JSValue promise;
        JSValue resolving_funcs[2];
    } accept;
} JSUVStream;

typedef struct {
    uv_write_t req;
    char data[];
} JSUVWriteReq;

static JSUVStream *js_uv_tcp_get(JSContext *ctx, JSValueConst obj);
static JSUVStream *js_uv_pipe_get(JSContext *ctx, JSValueConst obj);

static void uv__stream_close_cb(uv_handle_t* handle) {
    JSUVStream *s = handle->data;
    if (s) {
        s->closed = 1;
        if (s->finalized) {
            JSContext *ctx = s->ctx;
            js_free(ctx, s);
        }
    }
}

static JSValue js_uv_stream_close(JSContext *ctx, JSUVStream *s, int argc, JSValueConst *argv) {
    if (!s)
        return JS_EXCEPTION;
    if (!uv_is_closing(&s->h.handle)) {
        uv_close(&s->h.handle, uv__stream_close_cb);
    }
    return JS_UNDEFINED;
}

static void uv__stream_free_read_buf(JSRuntime *rt, void *opaque, void *ptr) {
    js_free_rt(rt, ptr);
}

static void uv__stream_alloc_cb(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
    JSUVStream *s = handle->data;
    if (s) {
        buf->base = js_mallocz(s->ctx, suggested_size);
        buf->len = suggested_size;
        return;
    }

    buf->base = NULL;
    buf->len = 0;
}

static void uv__stream_read_cb(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf) {
    JSUVStream *s = handle->data;
    if (s) {
        uv_read_stop(handle);

        JSContext *ctx = s->ctx;
        JSValue arg;
        JSValue ret;
        int is_reject = 0;
        if (nread < 0) {
            if (nread == UV_EOF) {
                arg = JS_UNDEFINED;
            } else {
                arg = js_new_uv_error(ctx, nread);
                is_reject = 1;
            }
            js_free(ctx, buf->base);
        } else {
            arg = JS_NewArrayBuffer(ctx, (uint8_t *)buf->base, buf->len, uv__stream_free_read_buf, NULL, 0);
        }

        ret = JS_Call(ctx, s->read.resolving_funcs[is_reject], JS_UNDEFINED, 1, (JSValueConst *)&arg);
        JS_FreeValue(ctx, arg);
        JS_FreeValue(ctx, ret); /* XXX: what to do if exception ? */

        JS_FreeValue(ctx, s->read.promise);
        JS_FreeValue(ctx, s->read.resolving_funcs[0]);
        JS_FreeValue(ctx, s->read.resolving_funcs[1]);

        s->read.promise = JS_UNDEFINED;
        s->read.resolving_funcs[0] = JS_UNDEFINED;
        s->read.resolving_funcs[1] = JS_UNDEFINED;
    }
}

static JSValue js_uv_stream_read(JSContext *ctx, JSUVStream *s, int argc, JSValueConst *argv) {
    if (!s)
        return JS_EXCEPTION;
    if (!JS_IsUndefined(s->read.promise))
        return js_uv_throw_errno(ctx, UV_EBUSY);
    int r = uv_read_start(&s->h.stream, uv__stream_alloc_cb, uv__stream_read_cb);
    if (r != 0) {
        return js_uv_throw_errno(ctx, r);
    }
    JSValue promise = JS_NewPromiseCapability(ctx, s->read.resolving_funcs);
    s->read.promise = JS_DupValue(ctx, promise);
    return promise;
}

static void uv__stream_write_cb(uv_write_t* req, int status) {
    JSUVStream *s = req->handle->data;
    if (s) {
        JSContext *ctx = s->ctx;
        JSUVWriteReq *wr = req->data;
        js_free(ctx, wr);
    }
}

static JSValue js_uv_stream_write(JSContext *ctx, JSUVStream *s, int argc, JSValueConst *argv) {
    if (!s)
        return JS_EXCEPTION;

    JSValue jsData = argv[0];

    size_t size;
    char *tmp;

    if (JS_IsString(jsData)) {
        int len;
        tmp = (char*) JS_ToCStringLen(ctx, &len, jsData, 0);
        size = len;
    } else {
        tmp = (char*) JS_GetArrayBuffer(ctx, &size, jsData);
    }

    if (!tmp)
        return JS_EXCEPTION;

    int r;
    uv_buf_t buf;

    /* First try to do the write inline */
    buf = uv_buf_init(tmp, size);
    r = uv_try_write(&s->h.stream, &buf, 1);

    if (r == size)
        return JS_UNDEFINED;

    /* Do an async write, copy the data. */
    if (r >= 0) {
        tmp += r;
        size -= r;
    }

    JSUVWriteReq *wr = js_malloc(ctx, sizeof(*wr) + size);
    if (!wr)
        return JS_EXCEPTION;

    wr->req.data = wr;

    memcpy(wr->data, tmp, size);
    buf = uv_buf_init(wr->data, size);

    r = uv_write(&wr->req, &s->h.stream, &buf, 1, uv__stream_write_cb);
    if (r != 0) {
        js_free(ctx, wr);
        return js_uv_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

static void uv__stream_shutdown_cb(uv_shutdown_t* req, int status) {
    JSUVStream *s = req->handle->data;
    if (s) {
        JSContext *ctx = s->ctx;
        JSValue ret;
        if (status == 0) {
            ret = JS_Call(ctx, s->shutdown.resolving_funcs[0], JS_UNDEFINED, 0, NULL);
        } else {
            JSValue error = js_new_uv_error(ctx, status);
            ret = JS_Call(ctx, s->shutdown.resolving_funcs[1], JS_UNDEFINED, 1, (JSValueConst *)&error);
            JS_FreeValue(ctx, error);
        }

        JS_FreeValue(ctx, ret); /* XXX: what to do if exception ? */

        JS_FreeValue(ctx, s->shutdown.promise);
        JS_FreeValue(ctx, s->shutdown.resolving_funcs[0]);
        JS_FreeValue(ctx, s->shutdown.resolving_funcs[1]);

        s->shutdown.promise = JS_UNDEFINED;
        s->shutdown.resolving_funcs[0] = JS_UNDEFINED;
        s->shutdown.resolving_funcs[1] = JS_UNDEFINED;
    }
}

static JSValue js_uv_stream_shutdown(JSContext *ctx, JSUVStream *s, int argc, JSValueConst *argv) {
    if (!s)
        return JS_EXCEPTION;
    if (!JS_IsUndefined(s->shutdown.promise))
        return js_uv_throw_errno(ctx, UV_EBUSY);
    int r = uv_shutdown(&s->shutdown.req, &s->h.stream, uv__stream_shutdown_cb);
    if (r != 0) {
        return js_uv_throw_errno(ctx, r);
    }
    JSValue promise = JS_NewPromiseCapability(ctx, s->shutdown.resolving_funcs);
    s->shutdown.promise = JS_DupValue(ctx, promise);
    return promise;
}

static JSValue js_uv_stream_fileno(JSContext *ctx, JSUVStream *s, int argc, JSValueConst *argv) {
    if (!s)
        return JS_EXCEPTION;
    int r;
    uv_os_fd_t fd;
    r = uv_fileno(&s->h.handle, &fd);
    if (r != 0) {
        return js_uv_throw_errno(ctx, r);
    }
    return JS_NewInt32(ctx, fd);
}

static void uv__stream_connect_cb(uv_connect_t* req, int status) {
    JSUVStream *t = req->handle->data;
    if (t) {
        JSContext *ctx = t->ctx;
        JSValue ret;
        if (status == 0) {
            ret = JS_Call(ctx, t->connect.resolving_funcs[0], JS_UNDEFINED, 0, NULL);
        } else {
            JSValue error = js_new_uv_error(ctx, status);
            ret = JS_Call(ctx, t->connect.resolving_funcs[1], JS_UNDEFINED, 1, (JSValueConst *)&error);
            JS_FreeValue(ctx, error);
        }

        JS_FreeValue(ctx, ret); /* XXX: what to do if exception ? */

        JS_FreeValue(ctx, t->connect.promise);
        JS_FreeValue(ctx, t->connect.resolving_funcs[0]);
        JS_FreeValue(ctx, t->connect.resolving_funcs[1]);

        t->connect.promise = JS_UNDEFINED;
        t->connect.resolving_funcs[0] = JS_UNDEFINED;
        t->connect.resolving_funcs[1] = JS_UNDEFINED;
    }
}

static void uv__stream_connection_cb(uv_stream_t* handle, int status) {
    JSUVStream *s = handle->data;
    if (s) {
        if (JS_IsUndefined(s->accept.promise)) {
            // TODO - handle this.
            return;
        }
        JSContext *ctx = s->ctx;
        JSValue arg;
        JSValue ret;
        int is_error = 0;
        if (status == 0) {
            JSUVStream *t2;
            switch (handle->type) {
                case UV_TCP:
                    arg = js_new_uv_tcp(ctx, AF_UNSPEC);
                    t2 = js_uv_tcp_get(ctx, arg);
                    break;
                case UV_NAMED_PIPE:
                    arg = js_new_uv_pipe(ctx);
                    t2 = js_uv_pipe_get(ctx, arg);
                    break;
                default:
                    abort();
            }

            int r = uv_accept(handle, &t2->h.stream);
            if (r != 0) {
                JS_FreeValue(ctx, arg);
                arg = js_new_uv_error(ctx, r);
                is_error = 1;
            }
        } else {
            arg = js_new_uv_error(ctx, status);
            is_error = 1;
        }

        ret = JS_Call(ctx, s->accept.resolving_funcs[is_error], JS_UNDEFINED, 1, (JSValueConst *)&arg);
        JS_FreeValue(ctx, arg);
        JS_FreeValue(ctx, ret); /* XXX: what to do if exception ? */

        JS_FreeValue(ctx, s->accept.promise);
        JS_FreeValue(ctx, s->accept.resolving_funcs[0]);
        JS_FreeValue(ctx, s->accept.resolving_funcs[1]);

        s->accept.promise = JS_UNDEFINED;
        s->accept.resolving_funcs[0] = JS_UNDEFINED;
        s->accept.resolving_funcs[1] = JS_UNDEFINED;
    }
}

static JSValue js_uv_stream_listen(JSContext *ctx, JSUVStream *s, int argc, JSValueConst *argv) {
    if (!s)
        return JS_EXCEPTION;
    uint32_t backlog = 511;
    if (!JS_IsUndefined(argv[0])) {
        if (JS_ToUint32(ctx, &backlog, argv[0]))
            return JS_EXCEPTION;
    }
    int r = uv_listen(&s->h.stream, (int) backlog, uv__stream_connection_cb);
    if (r != 0) {
        return js_uv_throw_errno(ctx, r);
    }
    return JS_UNDEFINED;
}

static JSValue js_uv_stream_accept(JSContext *ctx, JSUVStream *s, int argc, JSValueConst *argv) {
    if (!s)
        return JS_EXCEPTION;
    if (!JS_IsUndefined(s->accept.promise))
        return js_uv_throw_errno(ctx, UV_EBUSY);
    JSValue promise = JS_NewPromiseCapability(ctx, s->accept.resolving_funcs);
    s->accept.promise = JS_DupValue(ctx, promise);
    return promise;
}

static JSValue js_uv_init_stream(JSContext *ctx, JSValue obj, JSUVStream *s) {
    s->ctx = ctx;
    s->closed = 0;
    s->finalized = 0;

    s->h.handle.data = s;

    s->connect.promise = JS_UNDEFINED;
    s->connect.resolving_funcs[0] = JS_UNDEFINED;
    s->connect.resolving_funcs[1] = JS_UNDEFINED;
    s->read.promise = JS_UNDEFINED;
    s->read.resolving_funcs[0] = JS_UNDEFINED;
    s->read.resolving_funcs[1] = JS_UNDEFINED;
    s->shutdown.promise = JS_UNDEFINED;
    s->shutdown.resolving_funcs[0] = JS_UNDEFINED;
    s->shutdown.resolving_funcs[1] = JS_UNDEFINED;
    s->accept.promise = JS_UNDEFINED;
    s->accept.resolving_funcs[0] = JS_UNDEFINED;
    s->accept.resolving_funcs[1] = JS_UNDEFINED;

    JS_SetOpaque(obj, s);

    return obj;
}

static void js_uv_stream_finalizer(JSUVStream *s) {
    if (s) {
        s->finalized = 1;
        if (s->closed) {
            JSContext *ctx = s->ctx;
            js_free(ctx, s);
        } else if (!uv_is_closing(&s->h.handle)) {
            uv_close(&s->h.handle, uv__stream_close_cb);
        }
    }
}

static void js_uv_stream_mark(JSRuntime *rt, JSUVStream *s, JS_MarkFunc *mark_func) {
    if (s) {
        JS_MarkValue(rt, s->connect.promise, mark_func);
        JS_MarkValue(rt, s->connect.resolving_funcs[0], mark_func);
        JS_MarkValue(rt, s->connect.resolving_funcs[1], mark_func);
        JS_MarkValue(rt, s->read.promise, mark_func);
        JS_MarkValue(rt, s->read.resolving_funcs[0], mark_func);
        JS_MarkValue(rt, s->read.resolving_funcs[1], mark_func);
        JS_MarkValue(rt, s->shutdown.promise, mark_func);
        JS_MarkValue(rt, s->shutdown.resolving_funcs[0], mark_func);
        JS_MarkValue(rt, s->shutdown.resolving_funcs[1], mark_func);
        JS_MarkValue(rt, s->accept.promise, mark_func);
        JS_MarkValue(rt, s->accept.resolving_funcs[0], mark_func);
        JS_MarkValue(rt, s->accept.resolving_funcs[1], mark_func);
    }
}


/* TCP object  */

static JSClassID js_uv_tcp_class_id;

static void js_uv_tcp_finalizer(JSRuntime *rt, JSValue val) {
    JSUVStream *t = JS_GetOpaque(val, js_uv_tcp_class_id);
    js_uv_stream_finalizer(t);
}

static void js_uv_tcp_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    JSUVStream *t = JS_GetOpaque(val, js_uv_tcp_class_id);
    js_uv_stream_mark(rt, t, mark_func);
}

static JSClassDef js_uv_tcp_class = {
    "TCP",
    .finalizer = js_uv_tcp_finalizer,
    .gc_mark = js_uv_tcp_mark,
};

static JSValue js_new_uv_tcp(JSContext *ctx, int af)
{
    JSUVStream *s;
    JSValue obj;
    uv_loop_t *loop;
    int r;

    loop = js_uv_get_loop(ctx);
    if (!loop) {
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");
    }

    obj = JS_NewObjectClass(ctx, js_uv_tcp_class_id);
    if (JS_IsException(obj))
        return obj;

    s = js_mallocz(ctx, sizeof(*s));
    if (!s) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    r = uv_tcp_init_ex(loop, &s->h.tcp, af);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        js_free(ctx, s);
        return JS_ThrowInternalError(ctx, "couldn't initialize TCP handle");
    }

    return js_uv_init_stream(ctx, obj, s);
}

static JSValue js_uv_tcp_constructor(JSContext *ctx, JSValueConst new_target,
                                     int argc, JSValueConst *argv)
{
    int af = AF_UNSPEC;
    if (!JS_IsUndefined(argv[0]) && JS_ToInt32(ctx, &af, argv[0]))
        return JS_EXCEPTION;
    return js_new_uv_tcp(ctx, af);
}

static JSUVStream *js_uv_tcp_get(JSContext *ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, js_uv_tcp_class_id);
}

static JSValue js_uv_tcp_getsockpeername(JSContext *ctx, JSValueConst this_val,
                                         int argc, JSValueConst *argv, int magic)
{
    JSUVStream *t = js_uv_tcp_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;
    int r;
    int namelen;
    struct sockaddr_storage addr;
    namelen = sizeof(addr);
    if (magic == 0) {
        r = uv_tcp_getsockname(&t->h.tcp, (struct sockaddr *)&addr, &namelen);
    } else {
        r = uv_tcp_getpeername(&t->h.tcp, (struct sockaddr *)&addr, &namelen);
    }
    if (r != 0) {
        return js_uv_throw_errno(ctx, r);
    }

    return js_uv_addr2obj(ctx, (struct sockaddr*)&addr);
}

static JSValue js_uv_tcp_connect(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_tcp_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;
    if (!JS_IsUndefined(t->connect.promise))
        return js_uv_throw_errno(ctx, UV_EALREADY);
    struct sockaddr_storage ss;
    int r;
    r = js_uv_obj2addr(ctx, argv[0], &ss);
    if (r != 0) {
        return JS_EXCEPTION;
    }
    r = uv_tcp_connect(&t->connect.req, &t->h.tcp, (struct sockaddr *)&ss, uv__stream_connect_cb);
    if (r != 0) {
        return js_uv_throw_errno(ctx, r);
    }
    JSValue promise = JS_NewPromiseCapability(ctx, t->connect.resolving_funcs);
    t->connect.promise = JS_DupValue(ctx, promise);
    return promise;
}

static JSValue js_uv_tcp_bind(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_tcp_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;
    struct sockaddr_storage ss;
    int r;
    r = js_uv_obj2addr(ctx, argv[0], &ss);
    if (r != 0) {
        return JS_EXCEPTION;
    }
    r = uv_tcp_bind(&t->h.tcp, (struct sockaddr *)&ss, 0);
    if (r != 0) {
        return js_uv_throw_errno(ctx, r);
    }
    return JS_UNDEFINED;
}

static JSValue js_uv_tcp_close(JSContext *ctx, JSValueConst this_val,
                               int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_tcp_get(ctx, this_val);
    return js_uv_stream_close(ctx, t, argc, argv);
}

static JSValue js_uv_tcp_read(JSContext *ctx, JSValueConst this_val,
                              int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_tcp_get(ctx, this_val);
    return js_uv_stream_read(ctx, t, argc, argv);
}

static JSValue js_uv_tcp_write(JSContext *ctx, JSValueConst this_val,
                               int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_tcp_get(ctx, this_val);
    return js_uv_stream_write(ctx, t, argc, argv);
}

static JSValue js_uv_tcp_shutdown(JSContext *ctx, JSValueConst this_val,
                                  int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_tcp_get(ctx, this_val);
    return js_uv_stream_shutdown(ctx, t, argc, argv);
}

static JSValue js_uv_tcp_fileno(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_tcp_get(ctx, this_val);
    return js_uv_stream_fileno(ctx, t, argc, argv);
}

static JSValue js_uv_tcp_listen(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_tcp_get(ctx, this_val);
    return js_uv_stream_listen(ctx, t, argc, argv);
}

static JSValue js_uv_tcp_accept(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_tcp_get(ctx, this_val);
    return js_uv_stream_accept(ctx, t, argc, argv);
}


/* TTY */

static JSClassID js_uv_tty_class_id;

static void js_uv_tty_finalizer(JSRuntime *rt, JSValue val) {
    JSUVStream *t = JS_GetOpaque(val, js_uv_tty_class_id);
    js_uv_stream_finalizer(t);
}

static void js_uv_tty_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    JSUVStream *t = JS_GetOpaque(val, js_uv_tty_class_id);
    js_uv_stream_mark(rt, t, mark_func);
}

static JSClassDef js_uv_tty_class = {
    "TTY",
    .finalizer = js_uv_tty_finalizer,
    .gc_mark = js_uv_tty_mark,
};

static JSValue js_uv_tty_constructor(JSContext *ctx, JSValueConst new_target,
                                     int argc, JSValueConst *argv)
{
    JSUVStream *s;
    JSValue obj;
    uv_loop_t *loop;
    int fd, r, readable;

    if (JS_ToInt32(ctx, &fd, argv[0]))
        return JS_EXCEPTION;

    if ((readable = JS_ToBool(ctx, argv[1])) == -1)
        return JS_EXCEPTION;

    loop = js_uv_get_loop(ctx);
    if (!loop) {
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");
    }

    obj = JS_NewObjectClass(ctx, js_uv_tty_class_id);
    if (JS_IsException(obj))
        return obj;

    s = js_mallocz(ctx, sizeof(*s));
    if (!s) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    r = uv_tty_init(loop, &s->h.tty, fd, readable);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        js_free(ctx, s);
        return JS_ThrowInternalError(ctx, "couldn't initialize TTY handle");
    }

    return js_uv_init_stream(ctx, obj, s);
}

static JSUVStream *js_uv_tty_get(JSContext *ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, js_uv_tty_class_id);
}

static JSValue js_uv_tty_setMode(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValueConst *argv)
{
    JSUVStream *s = js_uv_tty_get(ctx, this_val);
    if (!s)
        return JS_EXCEPTION;

    int mode;
    if (JS_ToInt32(ctx, &mode, argv[0]))
        return JS_EXCEPTION;

    int r = uv_tty_set_mode(&s->h.tty, mode);
    if (r != 0)
        return js_uv_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static JSValue js_uv_tty_getWinSize(JSContext *ctx, JSValueConst this_val,
                                    int argc, JSValueConst *argv)
{
    JSUVStream *s = js_uv_tty_get(ctx, this_val);
    if (!s)
        return JS_EXCEPTION;

    int r, width, height;
    r = uv_tty_get_winsize(&s->h.tty, &width, &height);
    if (r != 0)
        return js_uv_throw_errno(ctx, r);

    JSValue obj = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, obj, "width", JS_NewInt32(ctx, width));
    JS_SetPropertyStr(ctx, obj, "height", JS_NewInt32(ctx, height));
    return obj;
}

static JSValue js_uv_tty_close(JSContext *ctx, JSValueConst this_val,
                               int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_tty_get(ctx, this_val);
    return js_uv_stream_close(ctx, t, argc, argv);
}

static JSValue js_uv_tty_read(JSContext *ctx, JSValueConst this_val,
                              int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_tty_get(ctx, this_val);
    return js_uv_stream_read(ctx, t, argc, argv);
}

static JSValue js_uv_tty_write(JSContext *ctx, JSValueConst this_val,
                               int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_tty_get(ctx, this_val);
    return js_uv_stream_write(ctx, t, argc, argv);
}

static JSValue js_uv_tty_fileno(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_tty_get(ctx, this_val);
    return js_uv_stream_fileno(ctx, t, argc, argv);
}


/* Pipe */

static JSClassID js_uv_pipe_class_id;

static void js_uv_pipe_finalizer(JSRuntime *rt, JSValue val) {
    JSUVStream *t = JS_GetOpaque(val, js_uv_pipe_class_id);
    js_uv_stream_finalizer(t);
}

static void js_uv_pipe_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    JSUVStream *t = JS_GetOpaque(val, js_uv_pipe_class_id);
    js_uv_stream_mark(rt, t, mark_func);
}

static JSClassDef js_uv_pipe_class = {
    "Pipe",
    .finalizer = js_uv_pipe_finalizer,
    .gc_mark = js_uv_pipe_mark,
};

static JSValue js_new_uv_pipe(JSContext *ctx)
{
    JSUVStream *s;
    JSValue obj;
    uv_loop_t *loop;
    int r;

    loop = js_uv_get_loop(ctx);
    if (!loop) {
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");
    }

    obj = JS_NewObjectClass(ctx, js_uv_pipe_class_id);
    if (JS_IsException(obj))
        return obj;

    s = js_mallocz(ctx, sizeof(*s));
    if (!s) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    r = uv_pipe_init(loop, &s->h.pipe, 0);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        js_free(ctx, s);
        return JS_ThrowInternalError(ctx, "couldn't initialize TTY handle");
    }

    return js_uv_init_stream(ctx, obj, s);
}

static JSValue js_uv_pipe_constructor(JSContext *ctx, JSValueConst new_target,
                                      int argc, JSValueConst *argv)
{
    return js_new_uv_pipe(ctx);
}

static JSUVStream *js_uv_pipe_get(JSContext *ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, js_uv_pipe_class_id);
}

static JSValue js_uv_pipe_getsockpeername(JSContext *ctx, JSValueConst this_val,
                                          int argc, JSValueConst *argv, int magic)
{
    JSUVStream *t = js_uv_pipe_get(ctx, this_val);
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
        return js_uv_throw_errno(ctx, r);

    return JS_NewStringLen(ctx, buf, len);
}

static JSValue js_uv_pipe_connect(JSContext *ctx, JSValueConst this_val,
                                  int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_pipe_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;

    const char *name = JS_ToCString(ctx, argv[0]);
    if (!name)
        return JS_EXCEPTION;

    uv_pipe_connect(&t->connect.req, &t->h.pipe, name, uv__stream_connect_cb);

    JSValue promise = JS_NewPromiseCapability(ctx, t->connect.resolving_funcs);
    t->connect.promise = JS_DupValue(ctx, promise);
    return promise;
}

static JSValue js_uv_pipe_bind(JSContext *ctx, JSValueConst this_val,
                               int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_pipe_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;

    const char *name = JS_ToCString(ctx, argv[0]);
    if (!name)
        return JS_EXCEPTION;

    int r = uv_pipe_bind(&t->h.pipe, name);
    if (r != 0)
        return js_uv_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static JSValue js_uv_pipe_close(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_pipe_get(ctx, this_val);
    return js_uv_stream_close(ctx, t, argc, argv);
}

static JSValue js_uv_pipe_read(JSContext *ctx, JSValueConst this_val,
                               int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_pipe_get(ctx, this_val);
    return js_uv_stream_read(ctx, t, argc, argv);
}

static JSValue js_uv_pipe_write(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_pipe_get(ctx, this_val);
    return js_uv_stream_write(ctx, t, argc, argv);
}

static JSValue js_uv_pipe_fileno(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_pipe_get(ctx, this_val);
    return js_uv_stream_fileno(ctx, t, argc, argv);
}

static JSValue js_uv_pipe_listen(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_pipe_get(ctx, this_val);
    return js_uv_stream_listen(ctx, t, argc, argv);
}

static JSValue js_uv_pipe_accept(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv)
{
    JSUVStream *t = js_uv_pipe_get(ctx, this_val);
    return js_uv_stream_accept(ctx, t, argc, argv);
}

static const JSCFunctionListEntry js_uv_tcp_proto_funcs[] = {
    /* Stream functions */
    JS_CFUNC_DEF("close", 0, js_uv_tcp_close ),
    JS_CFUNC_DEF("read", 0, js_uv_tcp_read ),
    JS_CFUNC_DEF("write", 1, js_uv_tcp_write ),
    JS_CFUNC_DEF("shutdown", 0, js_uv_tcp_shutdown ),
    JS_CFUNC_DEF("fileno", 0, js_uv_tcp_fileno ),
    JS_CFUNC_DEF("listen", 1, js_uv_tcp_listen ),
    JS_CFUNC_DEF("accept", 0, js_uv_tcp_accept ),
    /* TCP functions */
    JS_CFUNC_MAGIC_DEF("getsockname", 0, js_uv_tcp_getsockpeername, 0 ),
    JS_CFUNC_MAGIC_DEF("getpeername", 0, js_uv_tcp_getsockpeername, 1 ),
    JS_CFUNC_DEF("connect", 1, js_uv_tcp_connect ),
    JS_CFUNC_DEF("bind", 1, js_uv_tcp_bind ),
};

static const JSCFunctionListEntry js_uv_tty_proto_funcs[] = {
    /* Stream functions */
    JS_CFUNC_DEF("close", 0, js_uv_tty_close ),
    JS_CFUNC_DEF("read", 0, js_uv_tty_read ),
    JS_CFUNC_DEF("write", 1, js_uv_tty_write ),
    JS_CFUNC_DEF("fileno", 0, js_uv_tty_fileno ),
    /* TTY functions */
    JS_CFUNC_DEF("setMode", 1, js_uv_tty_setMode ),
    JS_CFUNC_DEF("getWinSize", 0, js_uv_tty_getWinSize ),
};

static const JSCFunctionListEntry js_uv_pipe_proto_funcs[] = {
    /* Stream functions */
    JS_CFUNC_DEF("close", 0, js_uv_pipe_close ),
    JS_CFUNC_DEF("read", 0, js_uv_pipe_read ),
    JS_CFUNC_DEF("write", 1, js_uv_pipe_write ),
    JS_CFUNC_DEF("fileno", 0, js_uv_pipe_fileno ),
    JS_CFUNC_DEF("listen", 1, js_uv_pipe_listen ),
    JS_CFUNC_DEF("accept", 0, js_uv_pipe_accept ),
    /* Pipe functions */
    JS_CFUNC_MAGIC_DEF("getsockname", 0, js_uv_pipe_getsockpeername, 0 ),
    JS_CFUNC_MAGIC_DEF("getpeername", 0, js_uv_pipe_getsockpeername, 1 ),
    JS_CFUNC_DEF("connect", 1, js_uv_pipe_connect ),
    JS_CFUNC_DEF("bind", 1, js_uv_pipe_bind ),
};

void js_uv_mod_streams_init(JSContext *ctx, JSModuleDef *m) {
    JSValue proto, obj;

    /* TCP class */
    JS_NewClassID(&js_uv_tcp_class_id);
    JS_NewClass(JS_GetRuntime(ctx), js_uv_tcp_class_id, &js_uv_tcp_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, js_uv_tcp_proto_funcs, countof(js_uv_tcp_proto_funcs));
    JS_SetClassProto(ctx, js_uv_tcp_class_id, proto);

    /* TCP object */
    obj = JS_NewCFunction2(ctx, js_uv_tcp_constructor, "TCP", 1, JS_CFUNC_constructor, 0);
    JS_SetModuleExport(ctx, m, "TCP", obj);

    /* TTY class */
    JS_NewClassID(&js_uv_tty_class_id);
    JS_NewClass(JS_GetRuntime(ctx), js_uv_tty_class_id, &js_uv_tty_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, js_uv_tty_proto_funcs, countof(js_uv_tty_proto_funcs));
    JS_SetClassProto(ctx, js_uv_tty_class_id, proto);

    /* TTY object */
    obj = JS_NewCFunction2(ctx, js_uv_tty_constructor, "TTY", 1, JS_CFUNC_constructor, 0);
    JS_SetModuleExport(ctx, m, "TTY", obj);

    /* Pipe class */
    JS_NewClassID(&js_uv_pipe_class_id);
    JS_NewClass(JS_GetRuntime(ctx), js_uv_pipe_class_id, &js_uv_pipe_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, js_uv_pipe_proto_funcs, countof(js_uv_pipe_proto_funcs));
    JS_SetClassProto(ctx, js_uv_pipe_class_id, proto);

    /* Pipe object */
    obj = JS_NewCFunction2(ctx, js_uv_pipe_constructor, "Pipe", 1, JS_CFUNC_constructor, 0);
    JS_SetModuleExport(ctx, m, "Pipe", obj);
}

void js_uv_mod_streams_export(JSContext *ctx, JSModuleDef *m) {
    JS_AddModuleExport(ctx, m, "TCP");
    JS_AddModuleExport(ctx, m, "TTY");
    JS_AddModuleExport(ctx, m, "Pipe");
}

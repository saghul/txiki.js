/*
 * QuickJS libuv bindings
 * 
 * Copyright (c) 2019-present Saúl Ibarra Corretgé
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

#include <unistd.h>

#include "cutils.h"
#include "quickjs-libc.h"
#include "quickjs-libuv.h"


/* Forward declarations */
static JSValue js_uv_throw_errno(JSContext *ctx, int err);
static JSValue js_new_uv_tcp(JSContext *ctx, int af);


/* Utility functions  */

static uv_loop_t *js_uv_get_loop(JSContext *ctx) {
    quv_state_t *quv_state;
    quv_state = JS_GetContextOpaque(ctx);
    if (!quv_state) {
        return NULL;
    }
    return &quv_state->uvloop;
}

static int js_uv_obj2addr(JSContext *ctx, JSValueConst obj, struct sockaddr_storage *ss) {
    JSValue js_ip;
    JSValue js_port;
    const char *ip;
    uint32_t port;
    int r;

    js_ip = JS_GetPropertyStr(ctx, obj, "ip");
    ip = JS_ToCString(ctx, js_ip);
    JS_FreeValue(ctx, js_ip);
    if (!ip) {
        return -1;
    }

    js_port = JS_GetPropertyStr(ctx, obj, "port");
    r = JS_ToUint32(ctx, &port, js_port);
    JS_FreeValue(ctx, js_port);
    if (r != 0) {
        return -1;
    }

    memset(ss, 0, sizeof(*ss));

    if (uv_inet_pton(AF_INET, ip, &((struct sockaddr_in *)ss)->sin_addr) == 0) {
        ss->ss_family = AF_INET;
        ((struct sockaddr_in *)ss)->sin_port = htons(port);
    } else if (uv_inet_pton(AF_INET6, ip, &((struct sockaddr_in6 *)ss)->sin6_addr) == 0) {
        ss->ss_family = AF_INET6;
        ((struct sockaddr_in6 *)ss)->sin6_port = htons(port);
    } else {
        js_uv_throw_errno(ctx, UV_EAFNOSUPPORT);
        JS_FreeCString(ctx, ip);
        return -1;
    }

    JS_FreeCString(ctx, ip);
    return 0;
}

static JSValue js_uv_addr2obj(JSContext *ctx, struct sockaddr *sa) {
    char buf[INET6_ADDRSTRLEN+1];
    JSValue obj;

    switch (sa->sa_family) {
    case AF_INET:
    {
        struct sockaddr_in *addr4 = (struct sockaddr_in*)sa;
        uv_ip4_name(addr4, buf, sizeof(buf));

        obj = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, obj, "ip", JS_NewString(ctx, buf));
        JS_SetPropertyStr(ctx, obj, "port", JS_NewInt32(ctx, ntohs(addr4->sin_port)));
        
        return obj;
    }

    case AF_INET6:
    {
        struct sockaddr_in6 *addr6 = (struct sockaddr_in6*)sa;
        uv_ip6_name(addr6, buf, sizeof(buf));

        obj = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, obj, "ip", JS_NewString(ctx, buf));
        JS_SetPropertyStr(ctx, obj, "port", JS_NewInt32(ctx, ntohs(addr6->sin6_port)));
        JS_SetPropertyStr(ctx, obj, "flowinfo", JS_NewInt32(ctx, ntohl(addr6->sin6_flowinfo)));
        JS_SetPropertyStr(ctx, obj, "scopeId", JS_NewInt32(ctx, addr6->sin6_scope_id));
        
        return obj;
    }

    default:
        /* If we don't know the address family, don't raise an exception -- return undefined. */
        return JS_UNDEFINED;
    }
}

static void js_uv_call_handler(JSContext *ctx, JSValueConst func) {
    JSValue ret, func1;
    /* 'func' might be destroyed when calling itself (if it frees the
       handler), so must take extra care */
    func1 = JS_DupValue(ctx, func);
    ret = JS_Call(ctx, func1, JS_UNDEFINED, 0, NULL);
    JS_FreeValue(ctx, func1);
    if (JS_IsException(ret))
        js_std_dump_error(ctx);
    JS_FreeValue(ctx, ret);
}

/* Error object */

static JSValue js_new_uv_error(JSContext *ctx, int err)
{
    JSValue obj;
    obj = JS_NewError(ctx);
    JS_DefinePropertyValueStr(ctx, obj, "message",
                              JS_NewString(ctx, uv_strerror(err)),
                              JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);
    JS_DefinePropertyValueStr(ctx, obj, "errno",
                              JS_NewInt32(ctx, err),
                              JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);
    return obj;
}

static JSValue js_uv_error_constructor(JSContext *ctx, JSValueConst new_target,
                                        int argc, JSValueConst *argv)
{
    int err;
    if (JS_ToInt32(ctx, &err, argv[0]))
        return JS_EXCEPTION;
    return js_new_uv_error(ctx, err);
}

static JSValue js_uv_error_strerror(JSContext *ctx, JSValueConst this_val,
                                    int argc, JSValueConst *argv)
{
    int err;
    if (JS_ToInt32(ctx, &err, argv[0]))
        return JS_EXCEPTION;
    return JS_NewString(ctx, uv_strerror(err));
}

static JSValue js_uv_throw_errno(JSContext *ctx, int err)
{
    JSValue obj;
    obj = js_new_uv_error(ctx, err);
    if (JS_IsException(obj))
        obj = JS_NULL;
    return JS_Throw(ctx, obj);
}


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
        } else {
            arg = JS_NewArrayBufferCopy(ctx, (const uint8_t *)buf->base, buf->len);
        }

        ret = JS_Call(ctx, s->read.resolving_funcs[is_reject], JS_UNDEFINED, 1, (JSValueConst *)&arg);
        JS_FreeValue(ctx, arg);
        JS_FreeValue(ctx, ret); /* XXX: what to do if exception ? */

        js_free(ctx, buf->base);

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
    uint8_t *tmp;

    if (JS_IsString(jsData)) {
        int len;
        tmp = (uint8_t*) JS_ToCStringLen(ctx, &len, jsData, 0);
        size = len;
    } else {
        tmp = JS_GetArrayBuffer(ctx, &size, jsData);
    }

    if (!tmp)
        return JS_EXCEPTION;

    int r;
    uv_buf_t buf;

    /* First try to do the write inline */
    buf = uv_buf_init((char*) tmp, size);
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
            // TODO - adjust when support for pipes is added.
            arg = js_new_uv_tcp(ctx, AF_UNSPEC);
            JSUVStream *t2 = js_uv_tcp_get(ctx, arg);
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

static void uv__tcp_connect_cb(uv_connect_t* req, int status) {
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
    r = uv_tcp_connect(&t->connect.req, &t->h.tcp, (struct sockaddr *)&ss, uv__tcp_connect_cb);
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


/* Timers */

typedef struct {
    uv_timer_t handle;
    JSValue func;
    JSValue obj;
    JSContext *ctx;
    int interval;
} JSUVTimer;

static void uv__timer_close(uv_handle_t *handle) {
    JSUVTimer *th = handle->data;
    if (th) {
        JSContext *ctx = th->ctx;
        js_free(ctx, th);
    }
}

static void uv__timer_cb(uv_timer_t *handle) {
    JSUVTimer *th = handle->data;
    if (th) {
        JSContext *ctx = th->ctx;
        JSValue func = th->func;
        js_uv_call_handler(ctx, func);
        if (!th->interval) {
            th->func = JS_UNDEFINED;
            JS_FreeValue(ctx, func);
            JSValue obj = th->obj;
            th->obj = JS_UNDEFINED;
            JS_FreeValue(ctx, obj);  // decref
        }
    }
}

static JSClassID js_uv_timer_class_id;

static void js_uv_timer_finalizer(JSRuntime *rt, JSValue val)
{
    JSUVTimer *th = JS_GetOpaque(val, js_uv_timer_class_id);
    if (th) {
        uv_close((uv_handle_t*)&th->handle, uv__timer_close);
    }
}

static void js_uv_timer_mark(JSRuntime *rt, JSValueConst val,
                             JS_MarkFunc *mark_func)
{
    JSUVTimer *th = JS_GetOpaque(val, js_uv_timer_class_id);
    if (th) {
        JS_MarkValue(rt, th->func, mark_func);
    }
}

static JSClassDef js_uv_timer_class = {
    "UVTimer",
    .finalizer = js_uv_timer_finalizer,
    .gc_mark = js_uv_timer_mark,
}; 

static JSValue js_uv_setTimeout(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv, int magic)
{
    int64_t delay;
    JSValueConst func;
    JSUVTimer *th;
    JSValue obj;
    quv_state_t *quv_state;

    quv_state = JS_GetContextOpaque(ctx);
    if (!quv_state) {
        return JS_ThrowInternalError(ctx, "couldn't find uv state");
    }

    func = argv[0];
    if (!JS_IsFunction(ctx, func))
        return JS_ThrowTypeError(ctx, "not a function");
    if (JS_ToInt64(ctx, &delay, argv[1]))
        return JS_EXCEPTION;
    obj = JS_NewObjectClass(ctx, js_uv_timer_class_id);
    if (JS_IsException(obj))
        return obj;
    th = js_mallocz(ctx, sizeof(*th));
    if (!th) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }
    th->ctx = ctx;
    uv_timer_init(&quv_state->uvloop, &th->handle);
    th->handle.data = th;
    uv_timer_start(&th->handle, uv__timer_cb, delay, magic ? delay : 0 /* repeat */);
    th->interval = magic;
    th->func = JS_DupValue(ctx, func);
    th->obj = JS_DupValue(ctx, obj);  // incref
    JS_SetOpaque(obj, th);
    return obj;
}

static JSValue js_uv_clearTimeout(JSContext *ctx, JSValueConst this_val,
                                  int argc, JSValueConst *argv)
{
    JSUVTimer *th = JS_GetOpaque2(ctx, argv[0], js_uv_timer_class_id);
    if (!th)
        return JS_EXCEPTION;
    uv_timer_stop(&th->handle);
    JSValue func = th->func;
    if (!JS_IsUndefined(func)) {
        th->func = JS_UNDEFINED;
        JS_FreeValue(ctx, func);
    }
    JSValue obj = th->obj;
    if (!JS_IsUndefined(obj)) {
        th->obj = JS_UNDEFINED;
        JS_FreeValue(ctx, obj);  // decref
    }
    return JS_UNDEFINED;
}


/* Signal handling */

typedef struct {
    struct list_head link;
    uv_signal_t handle;
    int sig_num;
    JSValue func;
    JSContext *ctx;
} JSUVSignalHandler;

static JSUVSignalHandler *find_sh(JSContext *ctx, int sig_num)
{
    JSUVSignalHandler *sh;
    quv_state_t *quv_state;
    struct list_head *el;
    quv_state = JS_GetContextOpaque(ctx);
    list_for_each(el, &quv_state->signal_handlers) {
        sh = list_entry(el, JSUVSignalHandler, link);
        if (sh->sig_num == sig_num)
            return sh;
    }
    return NULL;
}

static void uv__signal_close(uv_handle_t *handle) {
    JSUVSignalHandler *sh = handle->data;
    if (sh) {
        JSContext *ctx = sh->ctx;
        JS_FreeValue(ctx, sh->func);
        js_free(ctx, sh);
    }
}

static void uv__signal_cb(uv_signal_t *handle, int sig_num) {
    JSUVSignalHandler *sh = handle->data;
    if (sh) {
        JSContext *ctx = sh->ctx;
        js_uv_call_handler(ctx, sh->func);
    }
}

static JSValue js_uv_signal(JSContext *ctx, JSValueConst this_val,
                            int argc, JSValueConst *argv)
{
    JSUVSignalHandler *sh;
    uint32_t sig_num;
    JSValueConst func;
    quv_state_t *quv_state;

    quv_state = JS_GetContextOpaque(ctx);
    if (!quv_state) {
        return JS_ThrowInternalError(ctx, "couldn't find uv state");
    }

    if (JS_ToUint32(ctx, &sig_num, argv[0]))
        return JS_EXCEPTION;
    if (sig_num >= 64)
        return JS_ThrowRangeError(ctx, "invalid signal number");
    func = argv[1];
    if (JS_IsNull(func) || JS_IsUndefined(func)) {
        sh = find_sh(ctx, sig_num);
        if (sh) {
            list_del(&sh->link);
            uv_close((uv_handle_t*)&sh->handle, uv__signal_close);
        }
    } else {
        if (!JS_IsFunction(ctx, func))
            return JS_ThrowTypeError(ctx, "not a function");
        sh = find_sh(ctx, sig_num);
        if (!sh) {
            sh = js_mallocz(ctx, sizeof(*sh));
            if (!sh)
                return JS_EXCEPTION;
            sh->ctx = ctx;
            uv_signal_init(&quv_state->uvloop, &sh->handle);
            sh->handle.data = sh;
            sh->sig_num = sig_num;
            list_add_tail(&sh->link, &quv_state->signal_handlers);
        }
        JS_FreeValue(ctx, sh->func);
        sh->func = JS_DupValue(ctx, func);
        uv_signal_start(&sh->handle, uv__signal_cb, sig_num);
        uv_unref((uv_handle_t*)&sh->handle);
    }
    return JS_UNDEFINED;
}

/* Misc functions */

static JSValue js_uv_hrtime(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv)
{
    return JS_NewBigUint64(ctx, uv_hrtime());
}

static JSValue js_uv_uname(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv)
{
    JSValue obj;
    int r;
    uv_utsname_t utsname;

    r = uv_os_uname(&utsname);
    if (r != 0)
        return js_uv_throw_errno(ctx, r);

    obj = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, obj, "sysname", JS_NewString(ctx, utsname.sysname));
    JS_SetPropertyStr(ctx, obj, "release", JS_NewString(ctx, utsname.release));
    JS_SetPropertyStr(ctx, obj, "version", JS_NewString(ctx, utsname.version));
    JS_SetPropertyStr(ctx, obj, "machine", JS_NewString(ctx, utsname.machine));

    return obj;
}

static JSValue js_uv_isatty(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv)
{
    int fd, type;
    if (JS_ToInt32(ctx, &fd, argv[0]))
        return JS_EXCEPTION;

    type = uv_guess_handle(fd);
    return JS_NewBool(ctx, type == UV_TTY);
}

static JSValue js_uv_environ(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv)
{
    uv_env_item_t *env;
    int envcount, r;

    r = uv_os_environ(&env, &envcount);
    if (r != 0)
        return js_uv_throw_errno(ctx, r);

    JSValue obj = JS_NewObject(ctx);

    for (int i = 0; i < envcount; i++) {
        JS_SetPropertyStr(ctx, obj, env[i].name, JS_NewString(ctx, env[i].value));
    }

    uv_os_free_environ(env, envcount);

    return obj;
}

#define JSUV_CONST(x) JS_PROP_INT32_DEF(#x, x, JS_PROP_ENUMERABLE )
#define JSUV_CFUNC_DEF(name, length, func1) { name, JS_PROP_ENUMERABLE, JS_DEF_CFUNC, 0, .u.func = { length, JS_CFUNC_generic, { .generic = func1 } } }
#define JSUV_CFUNC_MAGIC_DEF(name, length, func1, magic) { name, JS_PROP_ENUMERABLE, JS_DEF_CFUNC, magic, .u.func = { length, JS_CFUNC_generic_magic, { .generic_magic = func1 } } }

static const JSCFunctionListEntry js_uv_funcs[] = {
    JSUV_CONST(AF_INET),
    JSUV_CONST(AF_INET6),
    JSUV_CONST(AF_UNSPEC),
    JSUV_CONST(STDIN_FILENO),
    JSUV_CONST(STDOUT_FILENO),
    JSUV_CONST(STDERR_FILENO),
    JSUV_CONST(UV_TTY_MODE_NORMAL),
    JSUV_CONST(UV_TTY_MODE_RAW),
    JSUV_CONST(UV_TTY_MODE_IO),
    JSUV_CFUNC_DEF("hrtime", 0, js_uv_hrtime ),
    JSUV_CFUNC_DEF("uname", 0, js_uv_uname ),
    JSUV_CFUNC_MAGIC_DEF("setTimeout", 2, js_uv_setTimeout, 0 ),
    JSUV_CFUNC_DEF("clearTimeout", 1, js_uv_clearTimeout ),
    JSUV_CFUNC_MAGIC_DEF("setInterval", 2, js_uv_setTimeout, 1 ),
    JSUV_CFUNC_DEF("clearInterval", 1, js_uv_clearTimeout ),
    JSUV_CFUNC_DEF("signal", 2, js_uv_signal ),
    JSUV_CFUNC_DEF("isatty", 1, js_uv_isatty ),
    JSUV_CFUNC_DEF("environ", 0, js_uv_environ ),
};

static const JSCFunctionListEntry js_uv_tcp_proto_funcs[] = {
    /* Stream functions */
    JSUV_CFUNC_DEF("close", 0, js_uv_tcp_close ),
    JSUV_CFUNC_DEF("read", 0, js_uv_tcp_read ),
    JSUV_CFUNC_DEF("write", 1, js_uv_tcp_write ),
    JSUV_CFUNC_DEF("shutdown", 0, js_uv_tcp_shutdown ),
    JSUV_CFUNC_DEF("fileno", 0, js_uv_tcp_fileno ),
    JSUV_CFUNC_DEF("listen", 1, js_uv_tcp_listen ),
    JSUV_CFUNC_DEF("accept", 0, js_uv_tcp_accept ),
    /* TCP functions */
    JSUV_CFUNC_MAGIC_DEF("getsockname", 0, js_uv_tcp_getsockpeername, 0 ),
    JSUV_CFUNC_MAGIC_DEF("getpeername", 0, js_uv_tcp_getsockpeername, 1 ),
    JSUV_CFUNC_DEF("connect", 1, js_uv_tcp_connect ),
    JSUV_CFUNC_DEF("bind", 1, js_uv_tcp_bind ),
};

static const JSCFunctionListEntry js_uv_tty_proto_funcs[] = {
    /* Stream functions */
    JSUV_CFUNC_DEF("close", 0, js_uv_tty_close ),
    JSUV_CFUNC_DEF("read", 0, js_uv_tty_read ),
    JSUV_CFUNC_DEF("write", 1, js_uv_tty_write ),
    JSUV_CFUNC_DEF("fileno", 0, js_uv_tty_fileno ),
    /* TTY functions */
    JSUV_CFUNC_DEF("setMode", 1, js_uv_tty_setMode ),
    JSUV_CFUNC_DEF("getWinSize", 0, js_uv_tty_getWinSize ),
};

static const JSCFunctionListEntry js_uv_error_funcs[] = {
    JSUV_CFUNC_DEF("strerror", 1, js_uv_error_strerror ),
    /* various errno values */
#define DEF(x, s) JS_PROP_INT32_DEF(stringify(UV_##x), UV_##x, JS_PROP_CONFIGURABLE ),
    UV_ERRNO_MAP(DEF)
#undef DEF
};

static int js_uv_init(JSContext *ctx, JSModuleDef *m)
{
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

    /* Error object */    
    obj = JS_NewCFunction2(ctx, js_uv_error_constructor, "Error", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, obj, js_uv_error_funcs, countof(js_uv_error_funcs));
    JS_SetModuleExport(ctx, m, "Error", obj);

    /* OSTimer class */
    JS_NewClassID(&js_uv_timer_class_id);
    JS_NewClass(JS_GetRuntime(ctx), js_uv_timer_class_id, &js_uv_timer_class);

    /* Module functions */
    JS_SetModuleExportList(ctx, m, js_uv_funcs, countof(js_uv_funcs));

    return 0;
}

JSModuleDef *js_init_module_uv(JSContext *ctx)
{
    JSModuleDef *m;
    m = JS_NewCModule(ctx, "uv", js_uv_init);
    if (!m)
        return NULL;
    JS_AddModuleExportList(ctx, m, js_uv_funcs, countof(js_uv_funcs));
    JS_AddModuleExport(ctx, m, "TCP");
    JS_AddModuleExport(ctx, m, "TTY");
    JS_AddModuleExport(ctx, m, "Error");
    return m;
}

void JSUV_InitCtxOpaque(JSContext *ctx) {
    quv_state_t *state = js_mallocz(ctx, sizeof(*state));
    if (!state)
        abort();

    uv_loop_init(&state->uvloop);

    state->ctx = ctx;

    /* handle to prevent the loop from blocking for i/o when there are pending jobs */
    uv_idle_init(&state->uvloop, &state->jobs.idle);
    state->jobs.idle.data = state;

    /* handle which runs the job queue */
    uv_check_init(&state->uvloop, &state->jobs.check);
    state->jobs.check.data = state;

    /* signal handlers list */
    init_list_head(&state->signal_handlers);

    JS_SetContextOpaque(ctx, state);
}

static void uv__idle_cb(uv_idle_t *handle) {
    // Noop
}

static void uv__maybe_idle(JSContext *ctx) {
    quv_state_t *state = JS_GetContextOpaque(ctx);
    JSRuntime *rt = JS_GetRuntime(ctx);

    if (JS_IsJobPending(rt))
        uv_idle_start(&state->jobs.idle, uv__idle_cb);
    else
        uv_idle_stop(&state->jobs.idle);
}

static void uv__check_cb(uv_check_t *handle) {
    quv_state_t *state = handle->data;

    if (!state)
        abort();

    JSContext *ctx = state->ctx;
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSContext *ctx1;
    int err;

    /* execute the pending jobs */
    for(;;) {
        err = JS_ExecutePendingJob(rt, &ctx1);
        if (err <= 0) {
            if (err < 0) {
                js_std_dump_error(ctx1);
            }
            break;
        }
    }

    uv__maybe_idle(ctx);
}

/* main loop which calls the user JS callbacks */
void js_uv_loop(JSContext *ctx) {
    quv_state_t *state = JS_GetContextOpaque(ctx);

    uv_check_start(&state->jobs.check, uv__check_cb);
    uv_unref((uv_handle_t*) &state->jobs.check);

    uv__maybe_idle(ctx);

    uv_run(&state->uvloop, UV_RUN_DEFAULT);

    // TODO: cleanup.
}

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
#include "cutils.h"
#include "quickjs-libuv.h"
#include "quv.h"

#include <uv.h>


/* Forward declarations */
static JSValue js_uv_throw_errno(JSContext *ctx, int err);
static void uv__tcp_close_cb(uv_handle_t* handle);


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


/* TCP object  */

static JSClassID js_uv_tcp_class_id;

typedef struct {
    JSContext *ctx;
    int closed;
    int finalized;
    union {
        uv_handle_t handle;
        uv_stream_t stream;
        uv_tcp_t tcp;
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
        uv_write_t req;
        uint8_t *data;
        JSValue promise;
        JSValue resolving_funcs[2];
    } write;
    struct {
        uv_shutdown_t req;
        JSValue promise;
        JSValue resolving_funcs[2];
    } shutdown;
    struct {
        JSValue promise;
        JSValue resolving_funcs[2];
    } accept;
} JSUVTcp;

static void js_uv_tcp_finalizer(JSRuntime *rt, JSValue val)
{
    JSUVTcp *t = JS_GetOpaque(val, js_uv_tcp_class_id);
    if (t) {
        t->finalized = 1;
        if (t->closed) {
            JSContext *ctx = t->ctx;
            js_free(ctx, t);
        } else if (!uv_is_closing(&t->h.handle)) {
            uv_close(&t->h.handle, uv__tcp_close_cb);
        }
    }
}

static void js_uv_tcp_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func)
{
    JSUVTcp *t = JS_GetOpaque(val, js_uv_tcp_class_id);
    if (t) {
        JS_MarkValue(rt, t->connect.promise, mark_func);
        JS_MarkValue(rt, t->connect.resolving_funcs[0], mark_func);
        JS_MarkValue(rt, t->connect.resolving_funcs[1], mark_func);
        JS_MarkValue(rt, t->read.promise, mark_func);
        JS_MarkValue(rt, t->read.resolving_funcs[0], mark_func);
        JS_MarkValue(rt, t->read.resolving_funcs[1], mark_func);
        JS_MarkValue(rt, t->write.promise, mark_func);
        JS_MarkValue(rt, t->write.resolving_funcs[0], mark_func);
        JS_MarkValue(rt, t->write.resolving_funcs[1], mark_func);
        JS_MarkValue(rt, t->shutdown.promise, mark_func);
        JS_MarkValue(rt, t->shutdown.resolving_funcs[0], mark_func);
        JS_MarkValue(rt, t->shutdown.resolving_funcs[1], mark_func);
        JS_MarkValue(rt, t->accept.promise, mark_func);
        JS_MarkValue(rt, t->accept.resolving_funcs[0], mark_func);
        JS_MarkValue(rt, t->accept.resolving_funcs[1], mark_func);
    }
}

static JSClassDef js_uv_tcp_class = {
    "TCP",
    .finalizer = js_uv_tcp_finalizer,
    .gc_mark = js_uv_tcp_mark,
}; 

static JSValue js_new_uv_tcp(JSContext *ctx)
{
    JSUVTcp *h;
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

    h = js_mallocz(ctx, sizeof(*h));
    if (!h) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    r = uv_tcp_init(loop, &h->h.tcp);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        js_free(ctx, h);
        return JS_ThrowInternalError(ctx, "couldn't initialize TCP handle");
    }

    h->ctx = ctx;
    h->closed = 0;
    h->finalized = 0;

    h->h.handle.data = h;

    h->connect.promise = JS_UNDEFINED;
    h->connect.resolving_funcs[0] = JS_UNDEFINED;
    h->connect.resolving_funcs[1] = JS_UNDEFINED;
    h->read.promise = JS_UNDEFINED;
    h->read.resolving_funcs[0] = JS_UNDEFINED;
    h->read.resolving_funcs[1] = JS_UNDEFINED;
    h->write.promise = JS_UNDEFINED;
    h->write.resolving_funcs[0] = JS_UNDEFINED;
    h->write.resolving_funcs[1] = JS_UNDEFINED;
    h->shutdown.promise = JS_UNDEFINED;
    h->shutdown.resolving_funcs[0] = JS_UNDEFINED;
    h->shutdown.resolving_funcs[1] = JS_UNDEFINED;
    h->accept.promise = JS_UNDEFINED;
    h->accept.resolving_funcs[0] = JS_UNDEFINED;
    h->accept.resolving_funcs[1] = JS_UNDEFINED;

    JS_SetOpaque(obj, h);
    return obj;
}

static JSValue js_uv_tcp_constructor(JSContext *ctx, JSValueConst new_target,
                                     int argc, JSValueConst *argv)
{
    return js_new_uv_tcp(ctx);
}

static JSUVTcp *js_uv_tcp_get(JSContext *ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, js_uv_tcp_class_id);
}

static void uv__tcp_close_cb(uv_handle_t* handle) {
    JSUVTcp *t = handle->data;
    if (t) {
        t->closed = 1;
        if (t->finalized) {
            JSContext *ctx = t->ctx;
            js_free(ctx, t);
        }
    }
}

static JSValue js_uv_tcp_close(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValueConst *argv)
{
    JSUVTcp *t = js_uv_tcp_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;
    if (!uv_is_closing(&t->h.handle)) {
        uv_close(&t->h.handle, uv__tcp_close_cb);
    }
    return JS_UNDEFINED;
}

static void uv__tcp_alloc_cb(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
    JSUVTcp *t = handle->data;
    if (t) {
        buf->base = js_mallocz(t->ctx, suggested_size);
        buf->len = suggested_size;
        return;
    }

    buf->base = NULL;
    buf->len = 0;
}

static void uv__tcp_read_cb(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf) {
    JSUVTcp *t = handle->data;
    if (t) {
        uv_read_stop(handle);

        JSContext *ctx = t->ctx;
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

        ret = JS_Call(ctx, t->read.resolving_funcs[is_reject], JS_UNDEFINED, 1, (JSValueConst *)&arg);
        JS_FreeValue(ctx, arg);
        JS_FreeValue(ctx, ret); /* XXX: what to do if exception ? */

        js_free(ctx, buf->base);

        JS_FreeValue(ctx, t->read.promise);
        JS_FreeValue(ctx, t->read.resolving_funcs[0]);
        JS_FreeValue(ctx, t->read.resolving_funcs[1]);

        t->read.promise = JS_UNDEFINED;
        t->read.resolving_funcs[0] = JS_UNDEFINED;
        t->read.resolving_funcs[1] = JS_UNDEFINED;
    }
}

static JSValue js_uv_tcp_read(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValueConst *argv)
{
    JSUVTcp *t = js_uv_tcp_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;
    if (!JS_IsUndefined(t->read.promise))
        return js_uv_throw_errno(ctx, UV_EBUSY);
    int r = uv_read_start(&t->h.stream, uv__tcp_alloc_cb, uv__tcp_read_cb);
    if (r != 0) {
        return js_uv_throw_errno(ctx, r);
    }
    JSValue promise = JS_NewPromise(ctx, t->read.resolving_funcs);
    t->read.promise = JS_DupValue(ctx, promise);
    return promise;
}

static void uv__tcp_write_cb(uv_write_t* req, int status) {
    JSUVTcp *t = req->handle->data;
    if (t) {
        JSContext *ctx = t->ctx;
        JSValue ret;
        if (status == 0) {
            ret = JS_Call(ctx, t->write.resolving_funcs[0], JS_UNDEFINED, 0, NULL);
        } else {
            JSValue error = js_new_uv_error(ctx, status);
            ret = JS_Call(ctx, t->write.resolving_funcs[1], JS_UNDEFINED, 1, (JSValueConst *)&error);
            JS_FreeValue(ctx, error);
        }

        js_free(ctx, t->write.data);
        t->write.data = NULL;

        JS_FreeValue(ctx, ret); /* XXX: what to do if exception ? */

        JS_FreeValue(ctx, t->write.promise);
        JS_FreeValue(ctx, t->write.resolving_funcs[0]);
        JS_FreeValue(ctx, t->write.resolving_funcs[1]);

        t->write.promise = JS_UNDEFINED;
        t->write.resolving_funcs[0] = JS_UNDEFINED;
        t->write.resolving_funcs[1] = JS_UNDEFINED;
    }
}

static JSValue js_uv_tcp_write(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValueConst *argv)
{
    JSUVTcp *t = js_uv_tcp_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;
    if (!JS_IsUndefined(t->write.promise))
        return js_uv_throw_errno(ctx, UV_EBUSY);

    size_t size;
    uint8_t *tmp = JS_GetArrayBuffer(ctx, &size, argv[0]);
    if (!tmp) {
        return JS_EXCEPTION;
    }

    uint8_t *data = js_malloc(ctx, size);
    if (!data) {
        return JS_EXCEPTION;
    }
    memcpy(data, tmp, size);

    uv_buf_t buf = uv_buf_init((char*) data, size);
    // TODO: use uv_try_write first.
    int r = uv_write(&t->write.req, &t->h.stream, &buf, 1, uv__tcp_write_cb);
    if (r != 0) {
        js_free(ctx, data);
        return js_uv_throw_errno(ctx, r);
    }

    t->write.data = data;
    JSValue promise = JS_NewPromise(ctx, t->write.resolving_funcs);
    t->write.promise = JS_DupValue(ctx, promise);
    return promise;
}

static void uv__tcp_shutdown_cb(uv_shutdown_t* req, int status) {
    JSUVTcp *t = req->handle->data;
    if (t) {
        JSContext *ctx = t->ctx;
        JSValue ret;
        if (status == 0) {
            ret = JS_Call(ctx, t->shutdown.resolving_funcs[0], JS_UNDEFINED, 0, NULL);
        } else {
            JSValue error = js_new_uv_error(ctx, status);
            ret = JS_Call(ctx, t->shutdown.resolving_funcs[1], JS_UNDEFINED, 1, (JSValueConst *)&error);
            JS_FreeValue(ctx, error);
        }

        JS_FreeValue(ctx, ret); /* XXX: what to do if exception ? */

        JS_FreeValue(ctx, t->shutdown.promise);
        JS_FreeValue(ctx, t->shutdown.resolving_funcs[0]);
        JS_FreeValue(ctx, t->shutdown.resolving_funcs[1]);

        t->shutdown.promise = JS_UNDEFINED;
        t->shutdown.resolving_funcs[0] = JS_UNDEFINED;
        t->shutdown.resolving_funcs[1] = JS_UNDEFINED;
    }
}

static JSValue js_uv_tcp_shutdown(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValueConst *argv)
{
    JSUVTcp *t = js_uv_tcp_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;
    if (!JS_IsUndefined(t->shutdown.promise))
        return js_uv_throw_errno(ctx, UV_EBUSY);
    int r = uv_shutdown(&t->shutdown.req, &t->h.stream, uv__tcp_shutdown_cb);
    if (r != 0) {
        return js_uv_throw_errno(ctx, r);
    }
    JSValue promise = JS_NewPromise(ctx, t->shutdown.resolving_funcs);
    t->shutdown.promise = JS_DupValue(ctx, promise);
    return promise;
}

static JSValue js_uv_tcp_getsockpeername(JSContext *ctx, JSValueConst this_val,
                                         int argc, JSValueConst *argv, int magic)
{
    JSUVTcp *t = js_uv_tcp_get(ctx, this_val);
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

static JSValue js_uv_tcp_fileno(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValueConst *argv)
{
    JSUVTcp *t = js_uv_tcp_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;
    int r;
    uv_os_fd_t fd;
    r = uv_fileno(&t->h.handle, &fd);
    if (r != 0) {
        return js_uv_throw_errno(ctx, r);
    }
    return JS_NewInt32(ctx, fd);
}

static void uv__tcp_connect_cb(uv_connect_t* req, int status) {
    JSUVTcp *t = req->handle->data;
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
    JSUVTcp *t = js_uv_tcp_get(ctx, this_val);
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
    JSValue promise = JS_NewPromise(ctx, t->connect.resolving_funcs);
    t->connect.promise = JS_DupValue(ctx, promise);
    return promise;
}

static JSValue js_uv_tcp_bind(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValueConst *argv)
{
    JSUVTcp *t = js_uv_tcp_get(ctx, this_val);
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

static void uv__tcp_connection_cb(uv_stream_t* handle, int status) {
    JSUVTcp *t = handle->data;
    if (t) {
        if (JS_IsUndefined(t->accept.promise)) {
            // TODO - handle this.
            return;
        }
        JSContext *ctx = t->ctx;
        JSValue arg;
        JSValue ret;
        int is_error = 0;
        if (status == 0) {
            arg = js_new_uv_tcp(ctx);
            JSUVTcp *t2 = js_uv_tcp_get(ctx, arg);
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

        ret = JS_Call(ctx, t->accept.resolving_funcs[is_error], JS_UNDEFINED, 1, (JSValueConst *)&arg);
        JS_FreeValue(ctx, arg);
        JS_FreeValue(ctx, ret); /* XXX: what to do if exception ? */

        JS_FreeValue(ctx, t->accept.promise);
        JS_FreeValue(ctx, t->accept.resolving_funcs[0]);
        JS_FreeValue(ctx, t->accept.resolving_funcs[1]);

        t->accept.promise = JS_UNDEFINED;
        t->accept.resolving_funcs[0] = JS_UNDEFINED;
        t->accept.resolving_funcs[1] = JS_UNDEFINED;
    }
}

static JSValue js_uv_tcp_listen(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValueConst *argv)
{
    JSUVTcp *t = js_uv_tcp_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;
    uint32_t backlog = 511;
    if (!JS_IsUndefined(argv[0])) {
        if (JS_ToUint32(ctx, &backlog, argv[0]))
            return JS_EXCEPTION;
    }
    int r = uv_listen(&t->h.stream, (int) backlog, uv__tcp_connection_cb);
    if (r != 0) {
        return js_uv_throw_errno(ctx, r);
    }
    return JS_UNDEFINED;
}

static JSValue js_uv_tcp_accept(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValueConst *argv)
{
    JSUVTcp *t = js_uv_tcp_get(ctx, this_val);
    if (!t)
        return JS_EXCEPTION;
    if (!JS_IsUndefined(t->accept.promise))
        return js_uv_throw_errno(ctx, UV_EBUSY);
    JSValue promise = JS_NewPromise(ctx, t->accept.resolving_funcs);
    t->accept.promise = JS_DupValue(ctx, promise);
    return promise;
}

static JSValue js_uv_hrtime(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv)
{
    return JS_NewBigUint64(ctx, uv_hrtime());
}

static const JSCFunctionListEntry js_uv_funcs[] = {
    JS_CFUNC_DEF("hrtime", 0, js_uv_hrtime ),
};

static const JSCFunctionListEntry js_uv_tcp_proto_funcs[] = {
    JS_CFUNC_DEF("close", 0, js_uv_tcp_close ),
    JS_CFUNC_DEF("read", 0, js_uv_tcp_read ),
    JS_CFUNC_DEF("write", 1, js_uv_tcp_write ),
    JS_CFUNC_DEF("shutdown", 0, js_uv_tcp_shutdown ),
    JS_CFUNC_MAGIC_DEF("getsockname", 0, js_uv_tcp_getsockpeername, 0 ),
    JS_CFUNC_MAGIC_DEF("getpeername", 0, js_uv_tcp_getsockpeername, 1 ),
    JS_CFUNC_DEF("fileno", 0, js_uv_tcp_fileno ),
    JS_CFUNC_DEF("connect", 1, js_uv_tcp_connect ),
    JS_CFUNC_DEF("bind", 1, js_uv_tcp_bind ),
    JS_CFUNC_DEF("listen", 1, js_uv_tcp_listen ),
    JS_CFUNC_DEF("accept", 0, js_uv_tcp_accept ),
};

static const JSCFunctionListEntry js_uv_error_funcs[] = {
    JS_CFUNC_DEF("strerror", 1, js_uv_error_strerror ),
    /* various errno values */
#define DEF(x, s) JS_PROP_INT32_DEF(stringify(UV_##x), UV_##x, JS_PROP_CONFIGURABLE ),
    UV_ERRNO_MAP(DEF)
#undef DEF
};

static int js_uv_init(JSContext *ctx, JSModuleDef *m)
{
    JSValue proto, obj;
    
    /* Tcp class */
    /* the class ID is created once */
    JS_NewClassID(&js_uv_tcp_class_id);
    /* the class is created once per runtime */
    JS_NewClass(JS_GetRuntime(ctx), js_uv_tcp_class_id, &js_uv_tcp_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, js_uv_tcp_proto_funcs, countof(js_uv_tcp_proto_funcs));
    JS_SetClassProto(ctx, js_uv_tcp_class_id, proto);

    /* Module functions */
    JS_SetModuleExportList(ctx, m, js_uv_funcs, countof(js_uv_funcs));

    /* TCP object */
    obj = JS_NewCFunction2(ctx, js_uv_tcp_constructor, "TCP", 0, JS_CFUNC_constructor, 0);
    JS_SetModuleExport(ctx, m, "TCP", obj);

    /* Error object */    
    obj = JS_NewCFunction2(ctx, js_uv_error_constructor, "Error", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, obj, js_uv_error_funcs, countof(js_uv_error_funcs));
    JS_SetModuleExport(ctx, m, "Error", obj);

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
    JS_AddModuleExport(ctx, m, "Error");
    return m;
}

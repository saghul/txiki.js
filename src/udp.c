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


typedef struct {
    JSContext *ctx;
    int closed;
    int finalized;
    uv_udp_t udp;
    struct {
        struct {
            JSValue tarray;
            uint8_t *data;
            size_t len;
        } b;
        TJSPromise result;
    } read;
} TJSUdp;

typedef struct {
    uv_udp_send_t req;
    TJSPromise result;
    JSValue tarray;
} TJSSendReq;

static JSClassID tjs_udp_class_id;

static void uv__udp_close_cb(uv_handle_t *handle) {
    TJSUdp *u = handle->data;
    CHECK_NOT_NULL(u);
    u->closed = 1;
    if (u->finalized)
        free(u);
}

static void maybe_close(TJSUdp *u) {
    if (!uv_is_closing((uv_handle_t *) &u->udp))
        uv_close((uv_handle_t *) &u->udp, uv__udp_close_cb);
}

static void tjs_udp_finalizer(JSRuntime *rt, JSValue val) {
    TJSUdp *u = JS_GetOpaque(val, tjs_udp_class_id);
    if (u) {
        TJS_FreePromiseRT(rt, &u->read.result);
        JS_FreeValueRT(rt, u->read.b.tarray);
        u->finalized = 1;
        if (u->closed)
            free(u);
        else
            maybe_close(u);
    }
}

static void tjs_udp_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    TJSUdp *u = JS_GetOpaque(val, tjs_udp_class_id);
    if (u) {
        TJS_MarkPromise(rt, &u->read.result, mark_func);
        JS_MarkValue(rt, u->read.b.tarray, mark_func);
    }
}

static JSClassDef tjs_udp_class = {
    "UDP",
    .finalizer = tjs_udp_finalizer,
    .gc_mark = tjs_udp_mark,
};

static TJSUdp *tjs_udp_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, tjs_udp_class_id);
}

static JSValue tjs_udp_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSUdp *u = tjs_udp_get(ctx, this_val);
    if (!u)
        return JS_EXCEPTION;
    if (TJS_IsPromisePending(ctx, &u->read.result)) {
        JSValue arg = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, arg, "nread", JS_NULL, JS_PROP_C_W_E);
        TJS_SettlePromise(ctx, &u->read.result, false, 1, (JSValueConst *) &arg);
        TJS_ClearPromise(ctx, &u->read.result);
    }
    maybe_close(u);
    return JS_UNDEFINED;
}

static void uv__udp_alloc_cb(uv_handle_t *handle, size_t suggested_size, uv_buf_t *buf) {
    TJSUdp *u = handle->data;
    CHECK_NOT_NULL(u);
    buf->base = (char *) u->read.b.data;
    buf->len = u->read.b.len;
}

static void uv__udp_recv_cb(uv_udp_t *handle,
                            ssize_t nread,
                            const uv_buf_t *buf,
                            const struct sockaddr *addr,
                            unsigned flags) {
    TJSUdp *u = handle->data;
    CHECK_NOT_NULL(u);

    uv_udp_recv_stop(handle);

    JSContext *ctx = u->ctx;
    JSValue arg;
    int is_reject = 0;
    if (nread < 0) {
        arg = tjs_new_error(ctx, nread);
        is_reject = 1;
    } else {
        arg = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, arg, "nread", JS_NewInt32(ctx, nread), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, arg, "partial", JS_NewBool(ctx, flags & UV_UDP_PARTIAL), JS_PROP_C_W_E);
        JSValue addrobj = JS_NewObjectProto(ctx, JS_NULL);
        tjs_addr2obj(ctx, addrobj, addr);
        JS_DefinePropertyValueStr(ctx, arg, "addr", addrobj, JS_PROP_C_W_E);
    }

    TJS_SettlePromise(ctx, &u->read.result, is_reject, 1, (JSValueConst *) &arg);
    TJS_ClearPromise(ctx, &u->read.result);

    JS_FreeValue(ctx, u->read.b.tarray);
    u->read.b.tarray = JS_UNDEFINED;
    u->read.b.data = NULL;
    u->read.b.len = 0;
}

static JSValue tjs_udp_recv(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSUdp *u = tjs_udp_get(ctx, this_val);
    if (!u)
        return JS_EXCEPTION;

    if (TJS_IsPromisePending(ctx, &u->read.result))
        return tjs_throw_errno(ctx, UV_EBUSY);

    size_t size;
    uint8_t *buf = JS_GetUint8Array(ctx, &size, argv[0]);
    if (!buf)
        return JS_EXCEPTION;
    u->read.b.tarray = JS_DupValue(ctx, argv[0]);
    u->read.b.data = buf;
    u->read.b.len = size;

    int r = uv_udp_recv_start(&u->udp, uv__udp_alloc_cb, uv__udp_recv_cb);
    if (r != 0)  {
        JS_FreeValue(ctx, u->read.b.tarray);
        u->read.b.tarray = JS_UNDEFINED;
        u->read.b.data = NULL;
        u->read.b.len = 0;

        return tjs_throw_errno(ctx, r);
    }

    return TJS_InitPromise(ctx, &u->read.result);
}

static void uv__udp_send_cb(uv_udp_send_t *req, int status) {
    TJSUdp *u = req->handle->data;
    CHECK_NOT_NULL(u);

    JSContext *ctx = u->ctx;
    TJSSendReq *sr = req->data;

    int is_reject = 0;
    JSValue arg;
    if (status < 0) {
        arg = tjs_new_error(ctx, status);
        is_reject = 1;
    } else {
        arg = JS_UNDEFINED;
    }

    TJS_SettlePromise(ctx, &sr->result, is_reject, 1, (JSValueConst *) &arg);
    JS_FreeValue(ctx, sr->tarray);
    js_free(ctx, sr);
}

static JSValue tjs_udp_send(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSUdp *u = tjs_udp_get(ctx, this_val);
    if (!u)
        return JS_EXCEPTION;

    /* arg 0: data buffer */
    size_t size;
    uint8_t *buf = JS_GetUint8Array(ctx, &size, argv[0]);
    if (!buf)
        return JS_EXCEPTION;

    /* arg 1: target address */
    struct sockaddr_storage ss;
    struct sockaddr *sa = NULL;
    int r;
    if (!JS_IsUndefined(argv[1])) {
        r = tjs_obj2addr(ctx, argv[1], &ss);
        if (r != 0)
            return JS_EXCEPTION;
        sa = (struct sockaddr *) &ss;
    }

    /* First try to do the write inline */
    uv_buf_t b;
    b = uv_buf_init((char *)buf, size);
    r = uv_udp_try_send(&u->udp, &b, 1, sa);
    if (r == size) {
        JSValue val = JS_NewInt64(ctx, size);
        return TJS_NewResolvedPromise(ctx, 1, &val);
    }

    /* Do an async write, copy the data. */
    if (r >= 0) {
        buf += r;
        size -= r;
    }

    TJSSendReq *sr = js_malloc(ctx, sizeof(*sr));
    if (!sr)
        return JS_EXCEPTION;

    sr->req.data = sr;
    sr->tarray = JS_DupValue(ctx, argv[0]);

    b = uv_buf_init((char *)buf, size);
    r = uv_udp_send(&sr->req, &u->udp, &b, 1, sa, uv__udp_send_cb);
    if (r != 0) {
        JS_FreeValue(ctx, sr->tarray);
        js_free(ctx, sr);
        return tjs_throw_errno(ctx, r);
    }

    return TJS_InitPromise(ctx, &sr->result);
}

static JSValue tjs_udp_fileno(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSUdp *u = tjs_udp_get(ctx, this_val);
    if (!u)
        return JS_EXCEPTION;
    int r;
    uv_os_fd_t fd;
    r = uv_fileno((uv_handle_t *) &u->udp, &fd);
    if (r != 0)
        return tjs_throw_errno(ctx, r);
    int32_t rfd;
#if defined(_WIN32)
    rfd = (int32_t)(intptr_t) fd;
#else
    rfd = fd;
#endif
    return JS_NewInt32(ctx, rfd);
}

static JSValue tjs_new_udp(JSContext *ctx, int af) {
    TJSUdp *u;
    JSValue obj;
    int r;

    obj = JS_NewObjectClass(ctx, tjs_udp_class_id);
    if (JS_IsException(obj))
        return obj;

    u = calloc(1, sizeof(*u));
    if (!u) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    r = uv_udp_init_ex(tjs_get_loop(ctx), &u->udp, af);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        free(u);
        return JS_ThrowInternalError(ctx, "couldn't initialize UDP handle");
    }

    u->ctx = ctx;
    u->closed = 0;
    u->finalized = 0;

    u->udp.data = u;

    u->read.b.tarray = JS_UNDEFINED;
    u->read.b.data = NULL;
    u->read.b.len = 0;

    TJS_ClearPromise(ctx, &u->read.result);

    JS_SetOpaque(obj, u);
    return obj;
}

static JSValue tjs_udp_constructor(JSContext *ctx, JSValueConst new_target, int argc, JSValueConst *argv) {
    int af = AF_UNSPEC;
    if (!JS_IsUndefined(argv[0]) && JS_ToInt32(ctx, &af, argv[0]))
        return JS_EXCEPTION;
    return tjs_new_udp(ctx, af);
}

static JSValue tjs_udp_getsockpeername(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv, int magic) {
    TJSUdp *u = tjs_udp_get(ctx, this_val);
    if (!u)
        return JS_EXCEPTION;

    int r;
    int namelen;
    struct sockaddr_storage addr;
    namelen = sizeof(addr);
    if (magic == 0)
        r = uv_udp_getsockname(&u->udp, (struct sockaddr *) &addr, &namelen);
    else
        r = uv_udp_getpeername(&u->udp, (struct sockaddr *) &addr, &namelen);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);
    tjs_addr2obj(ctx, obj, (struct sockaddr *) &addr);
    return obj;
}

static JSValue tjs_udp_connect(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSUdp *u = tjs_udp_get(ctx, this_val);
    if (!u)
        return JS_EXCEPTION;

    struct sockaddr_storage ss;
    int r;
    r = tjs_obj2addr(ctx, argv[0], &ss);
    if (r != 0)
        return JS_EXCEPTION;

    r = uv_udp_connect(&u->udp, (struct sockaddr *) &ss);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static JSValue tjs_udp_bind(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSUdp *u = tjs_udp_get(ctx, this_val);
    if (!u)
        return JS_EXCEPTION;

    struct sockaddr_storage ss;
    int r;
    r = tjs_obj2addr(ctx, argv[0], &ss);
    if (r != 0)
        return JS_EXCEPTION;

    int flags = 0;
    if (!JS_IsUndefined(argv[1]) && JS_ToInt32(ctx, &flags, argv[1]))
        return JS_EXCEPTION;

    r = uv_udp_bind(&u->udp, (struct sockaddr *) &ss, flags);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_udp_proto_funcs[] = {
    TJS_CFUNC_DEF("close", 0, tjs_udp_close),
    TJS_CFUNC_DEF("recv", 1, tjs_udp_recv),
    TJS_CFUNC_DEF("send", 2, tjs_udp_send),
    TJS_CFUNC_DEF("fileno", 0, tjs_udp_fileno),
    JS_CFUNC_MAGIC_DEF("getsockname", 0, tjs_udp_getsockpeername, 0),
    JS_CFUNC_MAGIC_DEF("getpeername", 0, tjs_udp_getsockpeername, 1),
    TJS_CFUNC_DEF("connect", 1, tjs_udp_connect),
    TJS_CFUNC_DEF("bind", 2, tjs_udp_bind),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "UDP", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_udp_funcs[] = {
    TJS_UVCONST(UDP_IPV6ONLY),
    TJS_UVCONST(UDP_REUSEADDR),
};

void tjs__mod_udp_init(JSContext *ctx, JSValue ns) {
    JSValue proto, obj;

    /* UDP class */
    JS_NewClassID(&tjs_udp_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_udp_class_id, &tjs_udp_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_udp_proto_funcs, countof(tjs_udp_proto_funcs));
    JS_SetClassProto(ctx, tjs_udp_class_id, proto);

    /* UDP object */
    obj = JS_NewCFunction2(ctx, tjs_udp_constructor, "UDP", 1, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, ns, "UDP", obj, JS_PROP_C_W_E);

    JS_SetPropertyFunctionList(ctx, ns, tjs_udp_funcs, countof(tjs_udp_funcs));
}

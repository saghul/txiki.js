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

#include "private.h"
#include "utils.h"

#include <string.h>


typedef struct {
    JSContext *ctx;
    uv_getaddrinfo_t req;
    QUVPromise result;
} QUVGetAddrInfoReq;

static JSValue quv_addrinfo2obj(JSContext *ctx, struct addrinfo *ai) {
    JSValue obj = JS_NewArray(ctx);

    struct addrinfo *ptr;
    int i = 0;
    for (ptr = ai; ptr; ptr = ptr->ai_next) {
        if (!ptr->ai_addrlen)
            continue;

        JSValue item = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, item, "addr", quv_addr2obj(ctx, ptr->ai_addr), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, item, "socktype", JS_NewInt32(ctx, ptr->ai_socktype), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, item, "protocol", JS_NewInt32(ctx, ptr->ai_protocol), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx,
                                  item,
                                  "canonname",
                                  ptr->ai_canonname ? JS_NewString(ctx, ptr->ai_canonname) : JS_UNDEFINED,
                                  JS_PROP_C_W_E);

        JS_DefinePropertyValueUint32(ctx, obj, i, item, JS_PROP_C_W_E);
        i++;
    }

    return obj;
}

static void quv_obj2addrinfo(JSContext *ctx, JSValue obj, struct addrinfo *ai) {
    JSValue family = JS_GetPropertyStr(ctx, obj, "family");
    if (!JS_IsUndefined(family))
        JS_ToInt32(ctx, &ai->ai_family, family);
    JS_FreeValue(ctx, family);

    JSValue socktype = JS_GetPropertyStr(ctx, obj, "socktype");
    if (!JS_IsUndefined(socktype))
        JS_ToInt32(ctx, &ai->ai_socktype, socktype);
    JS_FreeValue(ctx, socktype);

    JSValue protocol = JS_GetPropertyStr(ctx, obj, "protocol");
    if (!JS_IsUndefined(protocol))
        JS_ToInt32(ctx, &ai->ai_protocol, protocol);
    JS_FreeValue(ctx, protocol);

    JSValue flags = JS_GetPropertyStr(ctx, obj, "flags");
    if (!JS_IsUndefined(flags))
        JS_ToInt32(ctx, &ai->ai_flags, flags);
    JS_FreeValue(ctx, flags);
}

static void uv__getaddrinfo_cb(uv_getaddrinfo_t *req, int status, struct addrinfo *res) {
    QUVGetAddrInfoReq *gr = req->data;
    CHECK_NOT_NULL(gr);

    JSContext *ctx = gr->ctx;
    JSValue arg;
    bool is_reject = status != 0;

    if (status != 0)
        arg = quv_new_error(ctx, status);
    else
        arg = quv_addrinfo2obj(ctx, res);

    QUV_SettlePromise(ctx, &gr->result, is_reject, 1, (JSValueConst *) &arg);

    uv_freeaddrinfo(res);
    js_free(ctx, gr);
}

static JSValue quv_dns_getaddrinfo(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *service = NULL;
    const char *node = JS_ToCString(ctx, argv[0]);
    if (!node)
        return JS_EXCEPTION;

    QUVGetAddrInfoReq *gr = js_malloc(ctx, sizeof(*gr));
    if (!gr)
        return JS_EXCEPTION;

    gr->ctx = ctx;
    gr->req.data = gr;

    struct addrinfo hints;
    memset(&hints, 0, sizeof(hints));
    JSValue opts = argv[1];
    if (JS_IsObject(opts)) {
        quv_obj2addrinfo(ctx, opts, &hints);
        JSValue js_service = JS_GetPropertyStr(ctx, opts, "service");
        if (!JS_IsUndefined(js_service))
            service = JS_ToCString(ctx, js_service);
        JS_FreeValue(ctx, js_service);
    }

    int r = uv_getaddrinfo(quv_get_loop(ctx), &gr->req, uv__getaddrinfo_cb, node, service, &hints);
    if (r != 0) {
        js_free(ctx, gr);
        return quv_throw_errno(ctx, r);
    }

    return QUV_InitPromise(ctx, &gr->result);
}

static const JSCFunctionListEntry quv_dns_funcs[] = {
    JS_CFUNC_DEF("getaddrinfo", 2, quv_dns_getaddrinfo),
#ifdef AI_PASSIVE
    QUV_CONST(AI_PASSIVE),
#endif
#ifdef AI_CANONNAME
    QUV_CONST(AI_CANONNAME),
#endif
#ifdef AI_NUMERICHOST
    QUV_CONST(AI_NUMERICHOST),
#endif
#ifdef AI_V4MAPPED
    QUV_CONST(AI_V4MAPPED),
#endif
#ifdef AI_ALL
    QUV_CONST(AI_ALL),
#endif
#ifdef AI_ADDRCONFIG
    QUV_CONST(AI_ADDRCONFIG),
#endif
#ifdef AI_NUMERICSERV
    QUV_CONST(AI_NUMERICSERV),
#endif
};

void quv_mod_dns_init(JSContext *ctx, JSModuleDef *m) {
    JSValue obj = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, obj, quv_dns_funcs, countof(quv_dns_funcs));
    JS_SetModuleExport(ctx, m, "dns", obj);
}

void quv_mod_dns_export(JSContext *ctx, JSModuleDef *m) {
    JS_AddModuleExport(ctx, m, "dns");
}

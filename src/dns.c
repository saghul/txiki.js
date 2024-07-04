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
    uv_getaddrinfo_t req;
    TJSPromise result;
} TJSGetAddrInfoReq;

static JSValue tjs_addrinfo2obj(JSContext *ctx, struct addrinfo *ai) {
    JSValue obj = JS_NewArray(ctx);

    struct addrinfo *ptr;
    int i = 0;
    for (ptr = ai; ptr; ptr = ptr->ai_next) {
        CHECK_EQ(ptr->ai_socktype, SOCK_STREAM);
        JSValue item = JS_NewObjectProto(ctx, JS_NULL);
        tjs_addr2obj(ctx, item, ptr->ai_addr, true);
        JS_DefinePropertyValueUint32(ctx, obj, i, item, JS_PROP_C_W_E);
        i++;
    }

    return obj;
}

static void uv__getaddrinfo_cb(uv_getaddrinfo_t *req, int status, struct addrinfo *res) {
    TJSGetAddrInfoReq *gr = req->data;
    CHECK_NOT_NULL(gr);

    JSContext *ctx = gr->ctx;
    JSValue arg;
    bool is_reject = status != 0;

    if (status != 0)
        arg = tjs_new_error(ctx, status);
    else
        arg = tjs_addrinfo2obj(ctx, res);

    TJS_SettlePromise(ctx, &gr->result, is_reject, 1, &arg);

    uv_freeaddrinfo(res);
    js_free(ctx, gr);
}

static JSValue tjs_dns_getaddrinfo(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    const char *node = NULL;

    if (!JS_IsUndefined(argv[0])) {
        node = JS_ToCString(ctx, argv[0]);
        if (!node)
            return JS_EXCEPTION;
    }

    JSValue opts = argv[1];
    JSValue js_family = JS_GetPropertyStr(ctx, opts, "family");
    int family;
    CHECK_EQ(0, JS_ToInt32(ctx, &family, js_family));
    JS_FreeValue(ctx, js_family);

    TJSGetAddrInfoReq *gr = js_malloc(ctx, sizeof(*gr));
    if (!gr) {
        JS_FreeCString(ctx, node);
        return JS_EXCEPTION;
    }

    gr->ctx = ctx;
    gr->req.data = gr;

    struct addrinfo hints;
    memset(&hints, 0, sizeof(hints));
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_family = family;
    hints.ai_flags = AI_ADDRCONFIG | AI_V4MAPPED;

    int r = uv_getaddrinfo(tjs_get_loop(ctx), &gr->req, uv__getaddrinfo_cb, node, NULL, &hints);

    JS_FreeCString(ctx, node);

    if (r != 0) {
        js_free(ctx, gr);
        return tjs_throw_errno(ctx, r);
    }

    return TJS_InitPromise(ctx, &gr->result);
}

static const JSCFunctionListEntry tjs_dns_funcs[] = {
    TJS_CFUNC_DEF("getaddrinfo", 2, tjs_dns_getaddrinfo),
};

void tjs__mod_dns_init(JSContext *ctx, JSValue ns) {
    JS_SetPropertyFunctionList(ctx, ns, tjs_dns_funcs, countof(tjs_dns_funcs));
}

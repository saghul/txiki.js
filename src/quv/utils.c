
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

#include <stdlib.h>

#include "error.h"
#include "utils.h"
#include "vm.h"


void quv_assert(const struct AssertionInfo info) {
  fprintf(stderr,
          "%s:%s%s Assertion `%s' failed.\n",
          info.file_line,
          info.function,
          *info.function ? ":" : "",
          info.message);
  fflush(stderr);
  abort();
}

// TODO: remove this.
uv_loop_t *quv_get_loop(JSContext *ctx) {
    QUVRuntime *qrt = JS_GetContextOpaque(ctx);
    CHECK_NOT_NULL(qrt);

    return QUV_GetLoop(qrt);
}

int quv_obj2addr(JSContext *ctx, JSValueConst obj, struct sockaddr_storage *ss) {
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
        quv_throw_errno(ctx, UV_EAFNOSUPPORT);
        JS_FreeCString(ctx, ip);
        return -1;
    }

    JS_FreeCString(ctx, ip);
    return 0;
}

JSValue quv_addr2obj(JSContext *ctx, const struct sockaddr *sa) {
    char buf[INET6_ADDRSTRLEN+1];
    JSValue obj;

    switch (sa->sa_family) {
    case AF_INET:
    {
        struct sockaddr_in *addr4 = (struct sockaddr_in*)sa;
        uv_ip4_name(addr4, buf, sizeof(buf));

        obj = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, obj, "family", JS_NewInt32(ctx, AF_INET), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, obj, "ip", JS_NewString(ctx, buf), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, obj, "port", JS_NewInt32(ctx, ntohs(addr4->sin_port)), JS_PROP_C_W_E);
        
        return obj;
    }

    case AF_INET6:
    {
        struct sockaddr_in6 *addr6 = (struct sockaddr_in6*)sa;
        uv_ip6_name(addr6, buf, sizeof(buf));

        obj = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, obj, "family", JS_NewInt32(ctx, AF_INET6), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, obj, "ip", JS_NewString(ctx, buf), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, obj, "port", JS_NewInt32(ctx, ntohs(addr6->sin6_port)), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, obj, "flowinfo", JS_NewInt32(ctx, ntohl(addr6->sin6_flowinfo)), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, obj, "scopeId", JS_NewInt32(ctx, addr6->sin6_scope_id), JS_PROP_C_W_E);
        
        return obj;
    }

    default:
        /* If we don't know the address family, don't raise an exception -- return undefined. */
        return JS_UNDEFINED;
    }
}

static void js__print(JSContext *ctx, JSValueConst this_val,
                              int argc, JSValueConst *argv)
{
    int i;
    const char *str;

    for(i = 0; i < argc; i++) {
        if (i != 0)
            putchar(' ');
        str = JS_ToCString(ctx, argv[i]);
        if (!str)
            return;
        fputs(str, stdout);
        JS_FreeCString(ctx, str);
    }
    putchar('\n');
}

void quv_dump_error(JSContext *ctx)
{
    JSValue exception_val, val;
    const char *stack;
    int is_error;
    
    exception_val = JS_GetException(ctx);
    is_error = JS_IsError(ctx, exception_val);
    if (!is_error)
        printf("Throw: ");
    js__print(ctx, JS_NULL, 1, (JSValueConst *)&exception_val);
    if (is_error) {
        val = JS_GetPropertyStr(ctx, exception_val, "stack");
        if (!JS_IsUndefined(val)) {
            stack = JS_ToCString(ctx, val);
            printf("%s\n", stack);
            JS_FreeCString(ctx, stack);
        }
        JS_FreeValue(ctx, val);
    }
    JS_FreeValue(ctx, exception_val);
}

void quv_call_handler(JSContext *ctx, JSValueConst func) {
    JSValue ret, func1;
    /* 'func' might be destroyed when calling itself (if it frees the
       handler), so must take extra care */
    func1 = JS_DupValue(ctx, func);
    ret = JS_Call(ctx, func1, JS_UNDEFINED, 0, NULL);
    JS_FreeValue(ctx, func1);
    if (JS_IsException(ret))
        quv_dump_error(ctx);
    JS_FreeValue(ctx, ret);
}

static inline JSValue quv__completed_promise(JSContext *ctx, JSValueConst arg, int is_reject) {
    JSValue promise, resolving_funcs[2], ret;

    promise = JS_NewPromiseCapability(ctx, resolving_funcs);
    if (JS_IsException(promise))
        return JS_EXCEPTION;

    ret = JS_Call(ctx, resolving_funcs[is_reject], JS_UNDEFINED, 1, (JSValueConst *)&arg);

    JS_FreeValue(ctx, arg);
    JS_FreeValue(ctx, ret);
    JS_FreeValue(ctx, resolving_funcs[0]);
    JS_FreeValue(ctx, resolving_funcs[1]);

    return promise;
}

JSValue QUV_NewResolvedPromise(JSContext *ctx, JSValueConst arg) {
    return quv__completed_promise(ctx, arg, 0);
}

JSValue QUV_NewRejectedPromise(JSContext *ctx, JSValueConst arg) {
    return quv__completed_promise(ctx, arg, 1);
}

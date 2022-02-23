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


JSValue tjs_new_error(JSContext *ctx, int err) {
    JSValue obj;
    obj = JS_NewError(ctx);
    JS_DefinePropertyValueStr(ctx,
                              obj,
                              "message",
                              JS_NewString(ctx, uv_strerror(err)),
                              JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);
    JS_DefinePropertyValueStr(ctx, obj, "errno", JS_NewInt32(ctx, err), JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);
    return obj;
}

static JSValue tjs_error_constructor(JSContext *ctx, JSValueConst new_target, int argc, JSValueConst *argv) {
    int err;
    if (JS_ToInt32(ctx, &err, argv[0]))
        return JS_EXCEPTION;
    return tjs_new_error(ctx, err);
}

static JSValue tjs_error_strerror(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    int err;
    if (JS_ToInt32(ctx, &err, argv[0]))
        return JS_EXCEPTION;
    return JS_NewString(ctx, uv_strerror(err));
}

JSValue tjs_throw_errno(JSContext *ctx, int err) {
    JSValue obj;
    obj = tjs_new_error(ctx, err);
    if (JS_IsException(obj))
        obj = JS_NULL;
    return JS_Throw(ctx, obj);
}

static const JSCFunctionListEntry tjs_error_funcs[] = { TJS_CFUNC_DEF("strerror", 1, tjs_error_strerror),
/* various errno values */
#define DEF(x, s) JS_PROP_INT32_DEF(#x, UV_##x, JS_PROP_C_W_E),
                                                        UV_ERRNO_MAP(DEF)
#undef DEF
};

void tjs__mod_error_init(JSContext *ctx, JSValue ns) {
    JSValue obj = JS_NewCFunction2(ctx, tjs_error_constructor, "Error", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, obj, tjs_error_funcs, countof(tjs_error_funcs));
    JS_DefinePropertyValueStr(ctx, ns, "Error", obj, JS_PROP_C_W_E);
}

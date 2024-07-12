/*
 * txiki.js
 *
 * Copyright (c) 2022-present Saúl Ibarra Corretgé <s@saghul.net>
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
#include "version.h"

#include <string.h>
#include <unistd.h>
#include <uv.h>

extern const uint8_t tjs__run_repl[];
extern const uint32_t tjs__run_repl_size;


static JSValue tjs_evalFile(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    const char *filename;
    size_t len;
    JSValue ret;
    filename = JS_ToCStringLen(ctx, &len, argv[0]);
    if (!filename)
        return JS_EXCEPTION;
    ret = TJS_EvalModule(ctx, filename, true);
    JS_FreeCString(ctx, filename);
    return ret;
}

static JSValue tjs_evalScript(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    const char *str;
    size_t len;
    JSValue ret;
    str = JS_ToCStringLen(ctx, &len, argv[0]);
    if (!str)
        return JS_EXCEPTION;
    ret = JS_Eval(ctx, str, len, "<evalScript>", JS_EVAL_TYPE_GLOBAL | JS_EVAL_FLAG_ASYNC);
    JS_FreeCString(ctx, str);
    return ret;
}

static JSValue tjs_runRepl(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    tjs__eval_bytecode(ctx, tjs__run_repl, tjs__run_repl_size, false);

    return JS_UNDEFINED;
}

static JSValue tjs_isArrayBuffer(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    return JS_NewBool(ctx, JS_IsArrayBuffer(argv[0]));
}

static JSValue tjs_detachArrayBuffer(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    JS_DetachArrayBuffer(ctx, argv[0]);

    return JS_UNDEFINED;
}

static JSValue tjs_exepath(JSContext *ctx, JSValue this_val) {
    char buf[1024];
    size_t size = sizeof(buf);
    char *dbuf = buf;
    int r;

    r = uv_exepath(dbuf, &size);
    if (r != 0) {
        if (r != UV_ENOBUFS)
            return tjs_throw_errno(ctx, r);
        dbuf = js_malloc(ctx, size);
        if (!dbuf)
            return JS_EXCEPTION;
        r = uv_exepath(dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            return tjs_throw_errno(ctx, r);
        }
    }

    JSValue ret = JS_NewStringLen(ctx, dbuf, size);

    if (dbuf != buf)
        js_free(ctx, dbuf);

    return ret;
}

static JSValue tjs_randomUUID(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    char v[37];
    unsigned char u[16];

    int r = uv_random(NULL, NULL, u, sizeof(u), 0, NULL);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    u[6] &= 15;
    u[6] |= 64;  // '4x'

    u[8] &= 63;
    u[8] |= 128;  // 0b10xxxxxx

    snprintf(v,
             sizeof(v),
             "%02x%02x%02x%02x-%02x%02x-%02x%02x-"
             "%02x%02x-%02x%02x%02x%02x%02x%02x",
             u[0],
             u[1],
             u[2],
             u[3],
             u[4],
             u[5],
             u[6],
             u[7],
             u[8],
             u[9],
             u[10],
             u[11],
             u[12],
             u[13],
             u[14],
             u[15]);

    return JS_NewString(ctx, v);
}

/* clang-format off */
static const JSCFunctionListEntry tjs_sys_funcs[] = {
    TJS_CFUNC_DEF("evalFile", 1, tjs_evalFile),
    TJS_CFUNC_DEF("evalScript", 1, tjs_evalScript),
    TJS_CFUNC_DEF("randomUUID", 0, tjs_randomUUID),
    TJS_CFUNC_DEF("runRepl", 0, tjs_runRepl),
    TJS_CFUNC_DEF("isArrayBuffer", 1, tjs_isArrayBuffer),
    TJS_CFUNC_DEF("detachArrayBuffer", 1, tjs_detachArrayBuffer),
    TJS_CGETSET_DEF("exePath", tjs_exepath, NULL),
};
/* clang-format on */

void tjs__mod_sys_init(JSContext *ctx, JSValue ns) {
    JS_SetPropertyFunctionList(ctx, ns, tjs_sys_funcs, countof(tjs_sys_funcs));
    JS_DefinePropertyValueStr(ctx, ns, "args", tjs__get_args(ctx), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, ns, "version", JS_NewString(ctx, tjs_version()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, ns, "platform", JS_NewString(ctx, TJS__PLATFORM), JS_PROP_C_W_E);
}

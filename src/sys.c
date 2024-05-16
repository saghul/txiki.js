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


typedef struct{
    JSValue callback;
    JSValue this;
    JSContext *jsctx;
} tjs_gc_cb_t;

static tjs_gc_cb_t tjs_gc_on_before = {JS_NULL, JS_NULL, NULL};
static tjs_gc_cb_t tjs_gc_on_after = {JS_NULL, JS_NULL, NULL};

static JSValue js_std_gcRun(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    JS_RunGC(JS_GetRuntime(ctx));
    return JS_UNDEFINED;
}

static JSValue js_std_gcSetThreshold(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    int64_t value;

    if(JS_ToInt64(ctx, &value, argv[0]))
        return JS_EXCEPTION;
    JS_SetGCThreshold(JS_GetRuntime(ctx),value);

    return JS_UNDEFINED;
}

static JSValue js_std_gcFixThreshold(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    int64_t value;

    if(JS_ToInt64(ctx, &value, argv[0]))
        return JS_EXCEPTION;
    JS_SetGCThresholdFixed(JS_GetRuntime(ctx),value);

    return JS_UNDEFINED;
}

static JSValue js_std_gcGetThreshold(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    return JS_NewNumber(ctx,JS_GetGCThreshold(JS_GetRuntime(ctx)));
}

static BOOL js_std_gc_before_cb(){
    JSValue args[] = {};
    JSValue ret = JS_Call(tjs_gc_on_before.jsctx, tjs_gc_on_before.callback, tjs_gc_on_before.this, 0, args);
    return ret.u.int32;
}

static JSValue js_std_gcSetBeforeCallback(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJS_CHECK_ARG_RET(ctx, JS_IsFunction(ctx, argv[0]), 0, "function");

    if(!JS_IsUndefined(tjs_gc_on_before.callback))JS_FreeValue(ctx,tjs_gc_on_before.callback);
    tjs_gc_on_before.callback = JS_DupValue(ctx, argv[0]);
    tjs_gc_on_before.this = this_val;
    tjs_gc_on_before.jsctx = ctx;
    
    if (JS_IsUndefined(tjs_gc_on_before.callback))JS_SetGCBeforeCallback(JS_GetRuntime(ctx),NULL);
    else{
        JS_SetGCBeforeCallback(JS_GetRuntime(ctx),js_std_gc_before_cb);
    }

    return JS_UNDEFINED;
}

static void js_std_gc_after_cb(){
    JSValue args[] = {};
    JS_Call(tjs_gc_on_after.jsctx, tjs_gc_on_after.callback, tjs_gc_on_after.this, 0, args);
    return;
}

static JSValue js_std_gcSetAfterCallback(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJS_CHECK_ARG_RET(ctx, JS_IsFunction(ctx, argv[0]), 0, "function");

    if(!JS_IsUndefined(tjs_gc_on_after.callback))JS_FreeValue(ctx,tjs_gc_on_after.callback);
    tjs_gc_on_after.callback = JS_DupValue(ctx, argv[0]);
    tjs_gc_on_after.this = this_val;
    tjs_gc_on_after.jsctx = ctx;
    
    if (JS_IsUndefined(tjs_gc_on_after.callback))JS_SetGCAfterCallback(JS_GetRuntime(ctx),NULL);
    else{
        JS_SetGCAfterCallback(JS_GetRuntime(ctx),js_std_gc_after_cb);
    }

    return JS_UNDEFINED;
}


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
    ret = JS_Eval(ctx, str, len, "<evalScript>", JS_EVAL_TYPE_GLOBAL);
    JS_FreeCString(ctx, str);
    return ret;
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

static JSValue tjs_isStdinTty(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    return JS_NewBool(ctx, uv_guess_handle(STDIN_FILENO) == UV_TTY);
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

static JSValue tjs_setMemoryLimit(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    uint32_t v;
    if (JS_ToUint32(ctx, &v, argv[0]))
        return JS_EXCEPTION;
    JS_SetMemoryLimit(JS_GetRuntime(ctx), v);
    return JS_UNDEFINED;
}

static JSValue tjs_setMaxStackSize(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    uint32_t v;
    if (JS_ToUint32(ctx, &v, argv[0]))
        return JS_EXCEPTION;
    JS_SetMaxStackSize(JS_GetRuntime(ctx), v);
    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_sys_funcs[] = {
    TJS_CFUNC_DEF("gcRun", 0, js_std_gcRun),
    TJS_CFUNC_DEF("gcSetThreshold", 1, js_std_gcSetThreshold),
    TJS_CFUNC_DEF("gcGetThreshold", 0, js_std_gcGetThreshold),
    TJS_CFUNC_DEF("gcFixThreshold", 1, js_std_gcFixThreshold),
    TJS_CFUNC_DEF("gcSetBeforeCallback", 1, js_std_gcSetBeforeCallback),
    TJS_CFUNC_DEF("gcSetAfterCallback", 1, js_std_gcSetAfterCallback),
    TJS_CFUNC_DEF("evalFile", 1, tjs_evalFile),
    TJS_CFUNC_DEF("evalScript", 1, tjs_evalScript),
    TJS_CFUNC_DEF("isStdinTty", 0, tjs_isStdinTty),
    TJS_CFUNC_DEF("randomUUID", 0, tjs_randomUUID),
    TJS_CFUNC_DEF("setMemoryLimit", 1, tjs_setMemoryLimit),
    TJS_CFUNC_DEF("setMaxStackSize", 1, tjs_setMaxStackSize),
    TJS_CGETSET_DEF("exepath", tjs_exepath, NULL),
};

void tjs__mod_sys_init(JSContext *ctx, JSValue ns) {
    JS_SetPropertyFunctionList(ctx, ns, tjs_sys_funcs, countof(tjs_sys_funcs));
    JS_DefinePropertyValueStr(ctx, ns, "args", tjs__get_args(ctx), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, ns, "version", JS_NewString(ctx, tjs_version()), JS_PROP_C_W_E);
    JSValue versions = JS_NewObjectProto(ctx, JS_NULL);
    JS_DefinePropertyValueStr(ctx, versions, "quickjs", JS_NewString(ctx, JS_GetVersion()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "tjs", JS_NewString(ctx, tjs_version()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "uv", JS_NewString(ctx, uv_version_string()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "curl", JS_NewString(ctx, curl_version()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "wasm3", JS_NewString(ctx, M3_VERSION), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, ns, "versions", versions, JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, ns, "platform", JS_NewString(ctx, TJS__PLATFORM), JS_PROP_C_W_E);
}

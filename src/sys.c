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

static JSValue js_textDecode(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    size_t size;
    uint8_t *buf = JS_GetUint8Array(ctx, &size, argv[0]);
    if (!buf)
        return JS_EXCEPTION;

    return JS_NewStringLen(ctx, (const char *) buf, size);
    ;
}

static JSValue js_textEncode(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *str;
    size_t len;
    uint8_t *buf;

    str = JS_ToCStringLen(ctx, &len, argv[0]);
    if (!str)
        return JS_EXCEPTION;

    buf = js_malloc(ctx, len);
    if (!buf)
        return JS_EXCEPTION;

    // memcpy(buf, str, len);
    unsigned int i;
    for (i = 0; i < len; i++) {
        buf[i] = 256 + str[i];
    }

    return TJS_NewUint8Array(ctx, buf, len);
    // return JS_UNDEFINED;
}

static JSValue js_std_gc(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    JS_RunGC(JS_GetRuntime(ctx));
    return JS_UNDEFINED;
}

static JSValue tjs_evalFile(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
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

static JSValue tjs_evalScript(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
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

static JSValue tjs_exepath(JSContext *ctx, JSValueConst this_val) {
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

static JSValue tjs_isStdinTty(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    return JS_NewBool(ctx, uv_guess_handle(STDIN_FILENO) == UV_TTY);
}

static JSValue tjs_setMemoryLimit(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    uint32_t v;
    if (JS_ToUint32(ctx, &v, argv[0]))
        return JS_EXCEPTION;
    JS_SetMemoryLimit(JS_GetRuntime(ctx), v);
    return JS_UNDEFINED;
}

static JSValue tjs_setMaxStackSize(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    uint32_t v;
    if (JS_ToUint32(ctx, &v, argv[0]))
        return JS_EXCEPTION;
    JS_SetMaxStackSize(JS_GetRuntime(ctx), v);
    return JS_UNDEFINED;
}

static JSValue js_require(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    
    JSModuleDef *m;
    JSAtom basename_atom;
    JSValue basename_val;
    JSValue ns;
    const char *filename;



    basename_atom = JS_GetScriptOrModuleName(ctx, 0);
    if (basename_atom == JS_ATOM_NULL)
        basename_val = JS_NULL;
    else
        basename_val = JS_AtomToValue(ctx, basename_atom);
    JS_FreeAtom(ctx, basename_atom);
    if (JS_IsException(basename_val))
        return basename_val;

    const char *basename = NULL;
    basename = JS_ToCString(ctx, basename_val);

    

    filename = JS_ToCString(ctx, argv[0]);

    m = JS_RunModule(ctx, basename, filename);
    JS_FreeCString(ctx, filename);
    if (!m)
        goto exception;

    /* return the module namespace */
    ns = js_get_module_ns(ctx, m);
    if (JS_IsException(ns))
        goto exception;

    return ns;

 exception:
    return JS_GetException(ctx);
    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_sys_funcs[] = {
    TJS_CFUNC_DEF("gc", 0, js_std_gc),
    TJS_CFUNC_DEF("evalFile", 1, tjs_evalFile),
    TJS_CFUNC_DEF("evalScript", 1, tjs_evalScript),
    TJS_CFUNC_DEF("isStdinTty", 0, tjs_isStdinTty),
    TJS_CFUNC_DEF("setMemoryLimit", 1, tjs_setMemoryLimit),
    TJS_CFUNC_DEF("setMaxStackSize", 1, tjs_setMaxStackSize),
    TJS_CGETSET_DEF("exepath", tjs_exepath, NULL),
    TJS_CFUNC_DEF("textDecode", 1, js_textDecode),
    TJS_CFUNC_DEF("textEncode", 1, js_textEncode),
    TJS_CFUNC_DEF("require", 1, js_require),
};

void tjs__mod_sys_init(JSContext *ctx, JSValue ns) {
    JS_SetPropertyFunctionList(ctx, ns, tjs_sys_funcs, countof(tjs_sys_funcs));
    JS_DefinePropertyValueStr(ctx, ns, "args", tjs__get_args(ctx), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, ns, "version", JS_NewString(ctx, tjs_version()), JS_PROP_C_W_E);
    JSValue versions = JS_NewObjectProto(ctx, JS_NULL);
    JS_DefinePropertyValueStr(ctx, versions, "quickjs", JS_NewString(ctx, QJS_VERSION_STR), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "tjs", JS_NewString(ctx, tjs_version()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "uv", JS_NewString(ctx, uv_version_string()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "curl", JS_NewString(ctx, curl_version()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "wasm3", JS_NewString(ctx, M3_VERSION), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, ns, "versions", versions, JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, ns, "platform", JS_NewString(ctx, TJS__PLATFORM), JS_PROP_C_W_E);
}

/*
 * txiki.js
 *
 * Copyright (c) 2024-present Saúl Ibarra Corretgé <s@saghul.net>
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

#ifdef TJS__HAS_MIMALLOC
#include <mimalloc.h>
#endif


static JSValue tjs_gc_run(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    JS_RunGC(JS_GetRuntime(ctx));
    return JS_UNDEFINED;
}

static JSValue tjs_gc_setThreshold(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    int64_t value;

    if (JS_ToInt64(ctx, &value, argv[0]))
        return JS_EXCEPTION;

    JS_SetGCThreshold(JS_GetRuntime(ctx), value);

    return JS_UNDEFINED;
}

static JSValue tjs_gc_getThreshold(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    return JS_NewNumber(ctx, JS_GetGCThreshold(JS_GetRuntime(ctx)));
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

static JSValue tjs_compile(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    size_t len = 0;
    const uint8_t *tmp = JS_GetUint8Array(ctx, &len, argv[0]);
    if (!tmp)
        return JS_EXCEPTION;
    // We need to copy the buffer in order to null-terminate it, which JS_Eval needs.
    uint8_t *buf = js_malloc(ctx, len + 1);
    if (!buf)
        return JS_EXCEPTION;
    memcpy(buf, tmp, len);
    buf[len] = '\0';
    const char *module_name = JS_ToCString(ctx, argv[1]);
    if (!module_name) {
        js_free(ctx, buf);
        return JS_EXCEPTION;
    }
    int eval_flags = JS_EVAL_FLAG_COMPILE_ONLY | JS_EVAL_TYPE_MODULE;
    JSValue obj = JS_Eval(ctx, (const char *) buf, len, module_name, eval_flags);
    JS_FreeCString(ctx, module_name);
    js_free(ctx, buf);
    return obj;
}

static JSValue tjs_serialize(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    size_t len = 0;
    int flags = JS_WRITE_OBJ_BYTECODE | JS_WRITE_OBJ_REFERENCE | JS_WRITE_OBJ_SAB | JS_WRITE_OBJ_STRIP_SOURCE;
    uint8_t *buf = JS_WriteObject(ctx, &len, argv[0], flags);
    if (!buf)
        return JS_EXCEPTION;
    JSValue ret = TJS_NewUint8Array(ctx, buf, len);
    if (JS_IsException(ret))
        js_free(ctx, buf);
    return ret;
}

static JSValue tjs_deserialize(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    size_t len = 0;
    int flags = JS_READ_OBJ_BYTECODE | JS_READ_OBJ_REFERENCE | JS_READ_OBJ_SAB;
    const uint8_t *buf = JS_GetUint8Array(ctx, &len, argv[0]);
    if (!buf)
        return JS_EXCEPTION;
    return JS_ReadObject(ctx, buf, len, flags);
}

static JSValue tjs_evalBytecode(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    JSValue obj = argv[0];

    if (JS_IsException(obj))
        return JS_EXCEPTION;

    if (JS_VALUE_GET_TAG(obj) == JS_TAG_MODULE) {
        if (JS_ResolveModule(ctx, obj) < 0)
            return JS_EXCEPTION;

        js_module_set_import_meta(ctx, obj, FALSE, FALSE);
    }

    return JS_EvalFunction(ctx, obj);
}

static const JSCFunctionListEntry tjs_engine_funcs[] = {
    TJS_CFUNC_DEF("setMemoryLimit", 1, tjs_setMemoryLimit),
    TJS_CFUNC_DEF("setMaxStackSize", 1, tjs_setMaxStackSize),
    TJS_CFUNC_DEF("compile", 2, tjs_compile),
    TJS_CFUNC_DEF("serialize", 1, tjs_serialize),
    TJS_CFUNC_DEF("deserialize", 1, tjs_deserialize),
    TJS_CFUNC_DEF("evalBytecode", 1, tjs_evalBytecode),
};

/* clang-format off */
static const JSCFunctionListEntry tjs_gc_funcs[] = {
    TJS_CFUNC_DEF("run", 0, tjs_gc_run),
    TJS_CFUNC_DEF("setThreshold", 1, tjs_gc_setThreshold),
    TJS_CFUNC_DEF("getThreshold", 0, tjs_gc_getThreshold)
};
/* clang-format on */

void tjs__mod_engine_init(JSContext *ctx, JSValue ns) {
    JS_SetPropertyFunctionList(ctx, ns, tjs_engine_funcs, countof(tjs_engine_funcs));

    JSValue versions = JS_NewObjectProto(ctx, JS_NULL);
    JS_DefinePropertyValueStr(ctx, versions, "quickjs", JS_NewString(ctx, JS_GetVersion()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "tjs", JS_NewString(ctx, tjs_version()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "uv", JS_NewString(ctx, uv_version_string()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "curl", JS_NewString(ctx, curl_version()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "wasm3", JS_NewString(ctx, M3_VERSION), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "sqlite3", JS_NewString(ctx, sqlite3_libversion()), JS_PROP_C_W_E);
#ifdef TJS__HAS_MIMALLOC
    JS_DefinePropertyValueStr(ctx, versions, "mimalloc", JS_NewInt32(ctx, mi_version()), JS_PROP_C_W_E);
#endif

    JSValue gc = JS_NewObjectProto(ctx, JS_NULL);
    JS_SetPropertyFunctionList(ctx, gc, tjs_gc_funcs, countof(tjs_gc_funcs));
    JS_DefinePropertyValueStr(ctx, ns, "gc", gc, JS_PROP_C_W_E);

    JS_DefinePropertyValueStr(ctx, ns, "versions", versions, JS_PROP_C_W_E);
}

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

#include "wasm.h"

#include "private.h"
#include "tjs.h"
#include "utils.h"

#define TJS__WASM_MAX_ARGS 32

static JSClassID tjs_wasm_module_class_id;

typedef struct {
    IM3Module module;
    struct {
        uint8_t *bytes;
        size_t size;
    } data;
} TJSWasmModule;

static void tjs_wasm_module_finalizer(JSRuntime *rt, JSValue val) {
    TJSWasmModule *m = JS_GetOpaque(val, tjs_wasm_module_class_id);
    if (m) {
        if (m->module)
            m3_FreeModule(m->module);
        js_free_rt(rt, m->data.bytes);
        js_free_rt(rt, m);
    }
}

static JSClassDef tjs_wasm_module_class = {
    "Module",
    .finalizer = tjs_wasm_module_finalizer,
};

static JSClassID tjs_wasm_instance_class_id;

typedef struct {
    IM3Runtime runtime;
    IM3Module module;
    bool loaded;
} TJSWasmInstance;

static void tjs_wasm_instance_finalizer(JSRuntime *rt, JSValue val) {
    TJSWasmInstance *i = JS_GetOpaque(val, tjs_wasm_instance_class_id);
    if (i) {
        if (i->module) {
            // Free the module, only if it wasn't previously loaded.
            if (!i->loaded)
                m3_FreeModule(i->module);
        }
        if (i->runtime)
            m3_FreeRuntime(i->runtime);
        js_free_rt(rt, i);
    }
}

static JSClassDef tjs_wasm_instance_class = {
    "Instance",
    .finalizer = tjs_wasm_instance_finalizer,
};

static JSValue tjs_new_wasm_module(JSContext *ctx) {
    TJSWasmModule *m;
    JSValue obj;

    obj = JS_NewObjectClass(ctx, tjs_wasm_module_class_id);
    if (JS_IsException(obj))
        return obj;

    m = js_mallocz(ctx, sizeof(*m));
    if (!m) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    JS_SetOpaque(obj, m);
    return obj;
}

static TJSWasmModule *tjs_wasm_module_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, tjs_wasm_module_class_id);
}

static JSValue tjs_new_wasm_instance(JSContext *ctx) {
    TJSWasmInstance *i;
    JSValue obj;

    obj = JS_NewObjectClass(ctx, tjs_wasm_instance_class_id);
    if (JS_IsException(obj))
        return obj;

    i = js_mallocz(ctx, sizeof(*i));
    if (!i) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    JS_SetOpaque(obj, i);
    return obj;
}

static TJSWasmInstance *tjs_wasm_instance_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, tjs_wasm_instance_class_id);
}

JSValue tjs_throw_wasm_error(JSContext *ctx, const char *name, M3Result r) {
    CHECK_NOT_NULL(r);
    JSValue obj = JS_NewError(ctx);
    JS_DefinePropertyValueStr(ctx, obj, "message", JS_NewString(ctx, r), JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);
    JS_DefinePropertyValueStr(ctx, obj, "wasmError", JS_NewString(ctx, name), JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);
    if (JS_IsException(obj))
        obj = JS_NULL;
    return JS_Throw(ctx, obj);
}

static JSValue tjs__wasm_result(JSContext *ctx, M3ValueType type, const void *stack) {
    switch (type) {
        case c_m3Type_i32: {
            int32_t val = *(int32_t *) stack;
            return JS_NewInt32(ctx, val);
        }
        case c_m3Type_i64: {
            int64_t val = *(int64_t *) stack;
            if (val == (int32_t) val)
                return JS_NewInt32(ctx, (int32_t) val);
            else
                return JS_NewBigInt64(ctx, val);
        }
        case c_m3Type_f32: {
            float val = *(float *) stack;
            return JS_NewFloat64(ctx, (double) val);
        }
        case c_m3Type_f64: {
            double val = *(double *) stack;
            return JS_NewFloat64(ctx, val);
        }
        default:
            return JS_UNDEFINED;
    }
}

static JSValue tjs_wasm_callfunction(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, this_val);
    if (!i)
        return JS_EXCEPTION;

    const char *fname = JS_ToCString(ctx, argv[0]);
    if (!fname)
        return JS_EXCEPTION;

    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);

    IM3Function func;
    M3Result r = m3_FindFunction(&func, i->runtime, fname);
    if (r) {
        JS_FreeCString(ctx, fname);
        return tjs_throw_wasm_error(ctx, "RuntimeError", r);
    }

    JS_FreeCString(ctx, fname);

    int nargs = argc - 1;
    if (nargs == 0) {
        r = m3_Call(func, 0, NULL);
    } else {
        const char *m3_argv[nargs + 1];
        for (int i = 0; i < nargs; i++) {
            m3_argv[i] = JS_ToCString(ctx, argv[i + 1]);
        }
        m3_argv[nargs] = NULL;
        r = m3_CallArgv(func, nargs, m3_argv);
        for (int i = 0; i < nargs; i++) {
            JS_FreeCString(ctx, m3_argv[i]);
        }
    }

    if (r)
        return tjs_throw_wasm_error(ctx, "RuntimeError", r);

    // https://webassembly.org/docs/js/ See "ToJSValue"
    // NOTE: here we support returning BigInt, because we can.

    int ret_count = m3_GetRetCount(func);

    if (ret_count > TJS__WASM_MAX_ARGS)
        return tjs_throw_wasm_error(ctx, "RuntimeError", "Too many return values");

    uint64_t valbuff[TJS__WASM_MAX_ARGS];
    const void *valptrs[TJS__WASM_MAX_ARGS];
    memset(valbuff, 0, sizeof(valbuff));
    for (int i = 0; i < ret_count; i++) {
        valptrs[i] = &valbuff[i];
    }

    r = m3_GetResults(func, ret_count, valptrs);
    if (r)
        return tjs_throw_wasm_error(ctx, "RuntimeError", r);

    if (ret_count == 1) {
        return tjs__wasm_result(ctx, m3_GetRetType(func, 0), valptrs[0]);
    } else {
        JSValue rets = JS_NewArray(ctx);
        for (int i = 0; i < ret_count; i++) {
            JS_SetPropertyUint32(ctx, rets, i, tjs__wasm_result(ctx, m3_GetRetType(func, i), valptrs[i]));
        }
        return rets;
    }
}

static JSValue tjs_wasm_linkwasi(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, this_val);
    if (!i)
        return JS_EXCEPTION;

    M3Result r = m3_LinkWASI(i->module);
    if (r)
        return tjs_throw_wasm_error(ctx, "LinkError", r);

    return JS_UNDEFINED;
}

static JSValue tjs_wasm_buildinstance(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSWasmModule *m = tjs_wasm_module_get(ctx, argv[0]);
    if (!m)
        return JS_EXCEPTION;

    JSValue obj = tjs_new_wasm_instance(ctx);
    if (JS_IsException(obj))
        return obj;

    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, obj);

    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);

    M3Result r = m3_ParseModule(qrt->wasm_ctx.env, &i->module, m->data.bytes, m->data.size);
    CHECK_NULL(r);  // Should never fail because we already parsed it. TODO: clone it?

    /* Create a runtime per module to avoid symbol clash. */
    i->runtime = m3_NewRuntime(qrt->wasm_ctx.env, /* TODO: adjust */ 512 * 1024, NULL);
    if (!i->runtime) {
        JS_FreeValue(ctx, obj);
        return JS_ThrowOutOfMemory(ctx);
    }

    r = m3_LoadModule(i->runtime, i->module);
    if (r) {
        JS_FreeValue(ctx, obj);
        return tjs_throw_wasm_error(ctx, "LinkError", r);
    }

    i->loaded = true;

    return obj;
}

static JSValue tjs_wasm_moduleexports(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSWasmModule *m = tjs_wasm_module_get(ctx, argv[0]);
    if (!m)
        return JS_EXCEPTION;

    JSValue exports = JS_NewArray(ctx);
    if (JS_IsException(exports))
        return exports;

    for (size_t i = 0, j = 0; i < m->module->numFunctions; ++i) {
        IM3Function f = &m->module->functions[i];
        const char *name = m3_GetFunctionName(f);
        if (name) {
            JSValue item = JS_NewObjectProto(ctx, JS_NULL);
            JS_DefinePropertyValueStr(ctx, item, "name", JS_NewString(ctx, name), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, item, "kind", JS_NewString(ctx, "function"), JS_PROP_C_W_E);
            JS_DefinePropertyValueUint32(ctx, exports, j, item, JS_PROP_C_W_E);
            j++;
        }
    }

    // TODO: other export types.

    return exports;
}

static JSValue tjs_wasm_parsemodule(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);

    size_t size;
    uint8_t *buf = JS_GetArrayBuffer(ctx, &size, argv[0]);

    if (!buf) {
        /* Reset the exception. */
        JS_FreeValue(ctx, JS_GetException(ctx));

        /* Check if it's a typed array. */
        size_t aoffset, asize;
        JSValue abuf = JS_GetTypedArrayBuffer(ctx, argv[0], &aoffset, &asize, NULL);
        if (JS_IsException(abuf))
            return abuf;
        buf = JS_GetArrayBuffer(ctx, &size, abuf);
        JS_FreeValue(ctx, abuf);
        if (!buf)
            return JS_EXCEPTION;
        buf += aoffset;
        size = asize;
    }

    JSValue obj = tjs_new_wasm_module(ctx);
    TJSWasmModule *m = tjs_wasm_module_get(ctx, obj);
    m->data.bytes = js_malloc(ctx, size);
    if (!m->data.bytes) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }
    memcpy(m->data.bytes, buf, size);
    m->data.size = size;

    M3Result r = m3_ParseModule(qrt->wasm_ctx.env, &m->module, m->data.bytes, m->data.size);
    if (r) {
        JS_FreeValue(ctx, obj);
        return tjs_throw_wasm_error(ctx, "CompileError", r);
    }

    return obj;
}

static const JSCFunctionListEntry tjs_wasm_funcs[] = {
    TJS_CFUNC_DEF("buildInstance", 1, tjs_wasm_buildinstance),
    TJS_CFUNC_DEF("moduleExports", 1, tjs_wasm_moduleexports),
    TJS_CFUNC_DEF("parseModule", 1, tjs_wasm_parsemodule),
};

static const JSCFunctionListEntry tjs_wasm_instance_funcs[] = {
    TJS_CFUNC_DEF("callFunction", 1, tjs_wasm_callfunction),
    TJS_CFUNC_DEF("linkWasi", 0, tjs_wasm_linkwasi),
};

void tjs__mod_wasm_init(JSContext *ctx, JSValue ns) {
    /* Module object */
    JS_NewClassID(&tjs_wasm_module_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_wasm_module_class_id, &tjs_wasm_module_class);
    JS_SetClassProto(ctx, tjs_wasm_module_class_id, JS_NULL);

    /* Instance object */
    JS_NewClassID(&tjs_wasm_instance_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_wasm_instance_class_id, &tjs_wasm_instance_class);
    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_wasm_instance_funcs, countof(tjs_wasm_instance_funcs));
    JS_SetClassProto(ctx, tjs_wasm_instance_class_id, proto);

    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);
    JS_SetPropertyFunctionList(ctx, obj, tjs_wasm_funcs, countof(tjs_wasm_funcs));

    JS_DefinePropertyValueStr(ctx, ns, "wasm", obj, JS_PROP_C_W_E);
}

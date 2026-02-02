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
#include "tjs.h"
#include "utils.h"

#include <string.h>
#include <wasm_export.h>

#define TJS__WASM_MAX_ARGS       32
#define TJS__WASM_ERROR_BUF_SIZE 256

static JSClassID tjs_wasm_module_class_id;

typedef struct {
    wasm_module_t module;
    struct {
        uint8_t *bytes;
        size_t size;
    } data;
} TJSWasmModule;

static void tjs_wasm_module_finalizer(JSRuntime *rt, JSValue val) {
    TJSWasmModule *m = JS_GetOpaque(val, tjs_wasm_module_class_id);
    if (m) {
        if (m->module) {
            wasm_runtime_unload(m->module);
        }
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
    wasm_module_inst_t module_inst;
    wasm_exec_env_t exec_env;
    uint32_t stack_size;
} TJSWasmInstance;

static void tjs_wasm_instance_finalizer(JSRuntime *rt, JSValue val) {
    TJSWasmInstance *i = JS_GetOpaque(val, tjs_wasm_instance_class_id);
    if (i) {
        if (i->exec_env) {
            wasm_runtime_destroy_exec_env(i->exec_env);
        }
        if (i->module_inst) {
            wasm_runtime_deinstantiate(i->module_inst);
        }
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
    if (JS_IsException(obj)) {
        return obj;
    }

    m = js_mallocz(ctx, sizeof(*m));
    if (!m) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    JS_SetOpaque(obj, m);
    return obj;
}

static TJSWasmModule *tjs_wasm_module_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_wasm_module_class_id);
}

static JSValue tjs_new_wasm_instance(JSContext *ctx) {
    TJSWasmInstance *i;
    JSValue obj;

    obj = JS_NewObjectClass(ctx, tjs_wasm_instance_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    i = js_mallocz(ctx, sizeof(*i));
    if (!i) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    JS_SetOpaque(obj, i);
    return obj;
}

static TJSWasmInstance *tjs_wasm_instance_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_wasm_instance_class_id);
}

JSValue tjs_throw_wasm_error(JSContext *ctx, const char *name, const char *msg) {
    CHECK_NOT_NULL(msg);
    JSValue obj = JS_NewError(ctx);
    JS_DefinePropertyValueStr(ctx, obj, "message", JS_NewString(ctx, msg), JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);
    JS_DefinePropertyValueStr(ctx, obj, "wasmError", JS_NewString(ctx, name), JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);
    if (JS_IsException(obj)) {
        obj = JS_NULL;
    }
    return JS_Throw(ctx, obj);
}

static JSValue tjs__wasm_val_to_js(JSContext *ctx, const wasm_val_t *val) {
    switch (val->kind) {
        case WASM_I32:
            return JS_NewInt32(ctx, val->of.i32);
        case WASM_I64:
            if (val->of.i64 == (int32_t) val->of.i64) {
                return JS_NewInt32(ctx, (int32_t) val->of.i64);
            } else {
                return JS_NewBigInt64(ctx, val->of.i64);
            }
        case WASM_F32:
            return JS_NewFloat64(ctx, (double) val->of.f32);
        case WASM_F64:
            return JS_NewFloat64(ctx, val->of.f64);
        default:
            return JS_UNDEFINED;
    }
}

static bool tjs__js_to_wasm_val(JSContext *ctx, JSValue jsval, wasm_valkind_t type, wasm_val_t *val) {
    val->kind = type;
    switch (type) {
        case WASM_I32: {
            int32_t i32;
            if (JS_ToInt32(ctx, &i32, jsval)) {
                return false;
            }
            val->of.i32 = i32;
            return true;
        }
        case WASM_I64: {
            int64_t i64;
            // Try BigInt first
            if (!JS_ToBigInt64(ctx, &i64, jsval)) {
                val->of.i64 = i64;
                return true;
            }
            // Clear the exception from BigInt attempt
            JS_FreeValue(ctx, JS_GetException(ctx));
            // Try as regular integer
            int32_t i32;
            if (JS_ToInt32(ctx, &i32, jsval)) {
                return false;
            }
            val->of.i64 = i32;
            return true;
        }
        case WASM_F32: {
            double f64;
            if (JS_ToFloat64(ctx, &f64, jsval)) {
                return false;
            }
            val->of.f32 = (float) f64;
            return true;
        }
        case WASM_F64: {
            double f64;
            if (JS_ToFloat64(ctx, &f64, jsval)) {
                return false;
            }
            val->of.f64 = f64;
            return true;
        }
        default:
            return false;
    }
}

static JSValue tjs_wasm_callfunction(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, this_val);
    if (!i) {
        return JS_EXCEPTION;
    }

    const char *fname = JS_ToCString(ctx, argv[0]);
    if (!fname) {
        return JS_EXCEPTION;
    }

    // Lookup function
    wasm_function_inst_t func = wasm_runtime_lookup_function(i->module_inst, fname);
    if (!func) {
        JS_FreeCString(ctx, fname);
        return tjs_throw_wasm_error(ctx, "RuntimeError", "function not found");
    }
    JS_FreeCString(ctx, fname);

    // Get function signature
    uint32_t param_count = wasm_func_get_param_count(func, i->module_inst);
    uint32_t result_count = wasm_func_get_result_count(func, i->module_inst);

    if (param_count > TJS__WASM_MAX_ARGS || result_count > TJS__WASM_MAX_ARGS) {
        return tjs_throw_wasm_error(ctx, "RuntimeError", "too many parameters or results");
    }

    // Get parameter types
    wasm_valkind_t param_types[TJS__WASM_MAX_ARGS];
    if (param_count > 0) {
        wasm_func_get_param_types(func, i->module_inst, param_types);
    }

    // Convert JS arguments to wasm values
    wasm_val_t params[TJS__WASM_MAX_ARGS];
    int nargs = argc - 1;
    for (uint32_t j = 0; j < param_count; j++) {
        if ((int) j < nargs) {
            if (!tjs__js_to_wasm_val(ctx, argv[j + 1], param_types[j], &params[j])) {
                return JS_EXCEPTION;
            }
        } else {
            // Default to 0 for missing arguments
            params[j].kind = param_types[j];
            params[j].of.i64 = 0;
        }
    }

    // Prepare results
    wasm_val_t results[TJS__WASM_MAX_ARGS];

    // Call the function
    if (!wasm_runtime_call_wasm_a(i->exec_env, func, result_count, results, param_count, params)) {
        const char *exception = wasm_runtime_get_exception(i->module_inst);
        wasm_runtime_clear_exception(i->module_inst);
        return tjs_throw_wasm_error(ctx, "RuntimeError", exception ? exception : "call failed");
    }

    // Return results
    if (result_count == 0) {
        return JS_UNDEFINED;
    } else if (result_count == 1) {
        return tjs__wasm_val_to_js(ctx, &results[0]);
    } else {
        JSValue rets = JS_NewArray(ctx);
        for (uint32_t j = 0; j < result_count; j++) {
            JS_SetPropertyUint32(ctx, rets, j, tjs__wasm_val_to_js(ctx, &results[j]));
        }
        return rets;
    }
}

static JSValue tjs_wasm_buildinstance(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmModule *m = tjs_wasm_module_get(ctx, argv[0]);
    if (!m) {
        return JS_EXCEPTION;
    }

    JSValue obj = tjs_new_wasm_instance(ctx);
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, obj);

    char error_buf[TJS__WASM_ERROR_BUF_SIZE];

    // Set default stack and heap sizes
    uint32_t stack_size = 64 * 1024;  // 64KB stack
    uint32_t heap_size = 512 * 1024;  // 512KB heap

    // Instantiate the module
    i->module_inst = wasm_runtime_instantiate(m->module, stack_size, heap_size, error_buf, sizeof(error_buf));
    if (!i->module_inst) {
        JS_FreeValue(ctx, obj);
        return tjs_throw_wasm_error(ctx, "LinkError", error_buf);
    }

    // Create execution environment
    i->exec_env = wasm_runtime_create_exec_env(i->module_inst, stack_size);
    if (!i->exec_env) {
        wasm_runtime_deinstantiate(i->module_inst);
        i->module_inst = NULL;
        JS_FreeValue(ctx, obj);
        return JS_ThrowOutOfMemory(ctx);
    }

    i->stack_size = stack_size;

    return obj;
}

static JSValue tjs_wasm_moduleexports(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmModule *m = tjs_wasm_module_get(ctx, argv[0]);
    if (!m) {
        return JS_EXCEPTION;
    }

    JSValue exports = JS_NewArray(ctx);
    if (JS_IsException(exports)) {
        return exports;
    }

    int32_t export_count = wasm_runtime_get_export_count(m->module);
    if (export_count < 0) {
        return exports;  // Return empty array on error
    }

    uint32_t j = 0;
    for (int32_t idx = 0; idx < export_count; idx++) {
        wasm_export_t export_type;
        wasm_runtime_get_export_type(m->module, idx, &export_type);

        if (export_type.kind == WASM_IMPORT_EXPORT_KIND_FUNC) {
            JSValue item = JS_NewObjectProto(ctx, JS_NULL);
            JS_DefinePropertyValueStr(ctx, item, "name", JS_NewString(ctx, export_type.name), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, item, "kind", JS_NewString(ctx, "function"), JS_PROP_C_W_E);
            JS_DefinePropertyValueUint32(ctx, exports, j, item, JS_PROP_C_W_E);
            j++;
        }
    }

    // TODO: other export types (memory, table, global)

    return exports;
}

static JSValue tjs_wasm_parsemodule(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    size_t size;
    uint8_t *buf = JS_GetArrayBuffer(ctx, &size, argv[0]);

    if (!buf) {
        /* Reset the exception. */
        JS_FreeValue(ctx, JS_GetException(ctx));

        /* Check if it's a typed array. */
        size_t aoffset, asize;
        JSValue abuf = JS_GetTypedArrayBuffer(ctx, argv[0], &aoffset, &asize, NULL);
        if (JS_IsException(abuf)) {
            return abuf;
        }
        buf = JS_GetArrayBuffer(ctx, &size, abuf);
        JS_FreeValue(ctx, abuf);
        if (!buf) {
            // It's possible the buffer is NULL and there is no exception, in case of
            // an array buffer of size 0.
            JS_FreeValue(ctx, JS_GetException(ctx));
            JS_ThrowTypeError(ctx, "invalid buffer");
            return JS_EXCEPTION;
        }
        buf += aoffset;
        size = asize;
    }

    JSValue obj = tjs_new_wasm_module(ctx);
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSWasmModule *m = tjs_wasm_module_get(ctx, obj);

    // WAMR requires the buffer to be writable and kept alive until unload
    m->data.bytes = js_malloc(ctx, size);
    if (!m->data.bytes) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }
    memcpy(m->data.bytes, buf, size);
    m->data.size = size;

    char error_buf[TJS__WASM_ERROR_BUF_SIZE];
    m->module = wasm_runtime_load(m->data.bytes, (uint32_t) size, error_buf, sizeof(error_buf));
    if (!m->module) {
        JS_FreeValue(ctx, obj);
        return tjs_throw_wasm_error(ctx, "CompileError", error_buf);
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
};

void tjs__mod_wasm_init(JSContext *ctx, JSValue ns) {
    JSRuntime *rt = JS_GetRuntime(ctx);

    /* Module object */
    JS_NewClassID(rt, &tjs_wasm_module_class_id);
    JS_NewClass(rt, tjs_wasm_module_class_id, &tjs_wasm_module_class);
    JS_SetClassProto(ctx, tjs_wasm_module_class_id, JS_NULL);

    /* Instance object */
    JS_NewClassID(rt, &tjs_wasm_instance_class_id);
    JS_NewClass(rt, tjs_wasm_instance_class_id, &tjs_wasm_instance_class);
    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_wasm_instance_funcs, countof(tjs_wasm_instance_funcs));
    JS_SetClassProto(ctx, tjs_wasm_instance_class_id, proto);

    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);
    JS_SetPropertyFunctionList(ctx, obj, tjs_wasm_funcs, countof(tjs_wasm_funcs));

    JS_DefinePropertyValueStr(ctx, ns, "wasm", obj, JS_PROP_C_W_E);
}

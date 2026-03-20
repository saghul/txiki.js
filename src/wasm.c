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

/* Internal WAMR headers for direct access to import/instance structures */
#include "wasm.h"
#include "wasm_runtime.h"

#define TJS__WASM_MAX_ARGS       32
#define TJS__WASM_ERROR_BUF_SIZE 256

typedef struct TJSWasmImportGroup TJSWasmImportGroup;

static JSClassID tjs_wasm_module_class_id;

typedef struct {
    wasm_module_t module;
    struct {
        uint8_t *bytes;
        size_t size;
    } data;
    struct {
        char **argv;
        uint32_t argc;
        char **env;
        uint32_t env_count;
        char **map_dir_list;
        uint32_t map_dir_count;
    } wasi;
    TJSWasmImportGroup *pending_imports; /* Set by resolveImports, moved to instance by buildInstance */
} TJSWasmModule;

static void tjs_wasm_module_finalizer(JSRuntime *rt, JSValue val) {
    TJSWasmModule *m = JS_GetOpaque(val, tjs_wasm_module_class_id);
    if (m) {
        if (m->module) {
            wasm_runtime_unload(m->module);
        }
        js_free_rt(rt, m->data.bytes);
        /* Free WASI allocations */
        if (m->wasi.argv) {
            for (uint32_t i = 0; i < m->wasi.argc; i++) {
                js_free_rt(rt, m->wasi.argv[i]);
            }
            js_free_rt(rt, m->wasi.argv);
        }
        if (m->wasi.env) {
            for (uint32_t i = 0; i < m->wasi.env_count; i++) {
                js_free_rt(rt, m->wasi.env[i]);
            }
            js_free_rt(rt, m->wasi.env);
        }
        if (m->wasi.map_dir_list) {
            for (uint32_t i = 0; i < m->wasi.map_dir_count; i++) {
                js_free_rt(rt, m->wasi.map_dir_list[i]);
            }
            js_free_rt(rt, m->wasi.map_dir_list);
        }
        js_free_rt(rt, m);
    }
}

static JSClassDef tjs_wasm_module_class = {
    "Module",
    .finalizer = tjs_wasm_module_finalizer,
};

/* Import trampoline context: bridges WAMR native calls to JS functions */
typedef struct {
    JSContext *ctx;
    JSValue func;          /* The JS callback function */
    wasm_func_type_t type; /* WAMR function type for param/result conversion */
} TJSWasmImportCtx;

/* Registered native symbols for a single import module name */
typedef struct TJSWasmImportGroup {
    char *module_name;
    NativeSymbol *symbols;
    uint32_t count;
    TJSWasmImportCtx *ctxs;
    struct TJSWasmImportGroup *next;
} TJSWasmImportGroup;

static JSClassID tjs_wasm_instance_class_id;

typedef struct {
    wasm_module_inst_t module_inst;
    wasm_exec_env_t exec_env;
    TJSWasmImportGroup *import_groups;
    bool has_pending_exception;
    JSValue pending_exception;
    /* externref: JSValues boxed for WAMR's externref map */
    JSValue *externrefs;
    uint32_t externref_count;
    uint32_t externref_capacity;
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
        /* Free import groups */
        TJSWasmImportGroup *g = i->import_groups;
        while (g) {
            TJSWasmImportGroup *next = g->next;
            wasm_runtime_unregister_natives(g->module_name, g->symbols);
            for (uint32_t j = 0; j < g->count; j++) {
                JS_FreeValueRT(rt, g->ctxs[j].func);
                js_free_rt(rt, (char *) g->symbols[j].symbol);
                js_free_rt(rt, (char *) g->symbols[j].signature);
            }
            js_free_rt(rt, g->ctxs);
            js_free_rt(rt, g->symbols);
            js_free_rt(rt, g->module_name);
            js_free_rt(rt, g);
            g = next;
        }
        /* Free externref boxes */
        for (uint32_t j = 0; j < i->externref_count; j++) {
            JS_FreeValueRT(rt, i->externrefs[j]);
        }
        js_free_rt(rt, i->externrefs);
        js_free_rt(rt, i);
    }
}

static void tjs_wasm_instance_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSWasmInstance *i = JS_GetOpaque(val, tjs_wasm_instance_class_id);
    if (i) {
        TJSWasmImportGroup *g = i->import_groups;
        while (g) {
            for (uint32_t j = 0; j < g->count; j++) {
                JS_MarkValue(rt, g->ctxs[j].func, mark_func);
            }
            g = g->next;
        }
        if (i->has_pending_exception) {
            JS_MarkValue(rt, i->pending_exception, mark_func);
        }
        for (uint32_t j = 0; j < i->externref_count; j++) {
            JS_MarkValue(rt, i->externrefs[j], mark_func);
        }
    }
}

static JSClassDef tjs_wasm_instance_class = {
    "Instance",
    .finalizer = tjs_wasm_instance_finalizer,
    .gc_mark = tjs_wasm_instance_mark,
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
        case WASM_EXTERNREF:
            /* Handled separately with instance context */
            val->of.foreign = 0;
            return true;
        default:
            return false;
    }
}

/* Register a JSValue as an externref. Returns the WAMR externref index via p_idx. */
static bool tjs__externref_box(TJSWasmInstance *inst, JSContext *ctx, JSValue val, uint32_t *p_idx) {
    if (JS_IsNull(val) || JS_IsUndefined(val)) {
        *p_idx = NULL_REF;
        return true;
    }

    if (inst->externref_count >= inst->externref_capacity) {
        uint32_t new_cap = inst->externref_capacity ? inst->externref_capacity * 2 : 16;
        JSValue *new_arr = js_realloc(ctx, inst->externrefs, sizeof(JSValue) * new_cap);
        if (!new_arr) {
            return false;
        }
        inst->externrefs = new_arr;
        inst->externref_capacity = new_cap;
    }

    uint32_t slot = inst->externref_count;
    void *key = (void *) (uintptr_t) (slot + 1); /* +1 to avoid NULL */

    if (!wasm_externref_obj2ref(inst->module_inst, key, p_idx)) {
        return false;
    }

    inst->externrefs[slot] = JS_DupValue(ctx, val);
    inst->externref_count++;
    return true;
}

/* Retrieve a JSValue from a host key pointer. Returns a non-dup'd value. */
static JSValue tjs__externref_unbox_key(TJSWasmInstance *inst, void *key) {
    if (!key) {
        return JS_NULL;
    }

    uint32_t slot = (uint32_t) (uintptr_t) key - 1;
    if (slot >= inst->externref_count) {
        return JS_UNDEFINED;
    }

    return inst->externrefs[slot];
}

/* Retrieve a JSValue from a WAMR externref index. Returns a non-dup'd value. */
static JSValue tjs__externref_unbox(TJSWasmInstance *inst, uint32_t externref_idx) {
    if (externref_idx == (uint32_t) NULL_REF) {
        return JS_NULL;
    }

    void *key;
    if (!wasm_externref_ref2obj(externref_idx, &key)) {
        return JS_UNDEFINED;
    }

    return tjs__externref_unbox_key(inst, key);
}

/* Raw native trampoline: called by WAMR, forwards to a JS function.
 *
 * NOTE: externref params/returns are not supported in import trampolines due to:
 * 1. WAMR 2.4.4 bug: wasm_func_type_get_param_valkind asserts for externref
 *    (fixed on WAMR master, not yet in our pinned version)
 * 2. WAMR bug: invoke_native_raw passes garbage for externref params
 *    (still unfixed upstream as of 2026-03)
 * Externref works fine for exported functions, globals, and tables.
 */
static void tjs__wasm_import_trampoline(wasm_exec_env_t exec_env, uint64_t *args) {
    TJSWasmImportCtx *import_ctx = wasm_runtime_get_function_attachment(exec_env);
    if (!import_ctx) {
        return;
    }

    JSContext *ctx = import_ctx->ctx;
    wasm_func_type_t func_type = import_ctx->type;

    uint32_t param_count = wasm_func_type_get_param_count(func_type);
    uint32_t result_count = wasm_func_type_get_result_count(func_type);

    /* Convert WASM args to JS values */
    JSValue js_args[TJS__WASM_MAX_ARGS];
    for (uint32_t i = 0; i < param_count && i < TJS__WASM_MAX_ARGS; i++) {
        wasm_valkind_t kind = wasm_func_type_get_param_valkind(func_type, i);
        wasm_val_t val;
        val.kind = kind;
        switch (kind) {
            case WASM_I32:
                val.of.i32 = (int32_t) args[i];
                break;
            case WASM_I64:
                val.of.i64 = (int64_t) args[i];
                break;
            case WASM_F32: {
                union {
                    uint32_t i;
                    float f;
                } u;
                u.i = (uint32_t) args[i];
                val.of.f32 = u.f;
                break;
            }
            case WASM_F64: {
                union {
                    uint64_t i;
                    double f;
                } u;
                u.i = args[i];
                val.of.f64 = u.f;
                break;
            }
            default:
                js_args[i] = JS_UNDEFINED;
                continue;
        }
        js_args[i] = tjs__wasm_val_to_js(ctx, &val);
    }

    /* Call the JS function */
    JSValue global_obj = JS_GetGlobalObject(ctx);
    JSValue ret = JS_Call(ctx, import_ctx->func, global_obj, param_count, js_args);
    JS_FreeValue(ctx, global_obj);

    for (uint32_t i = 0; i < param_count; i++) {
        JS_FreeValue(ctx, js_args[i]);
    }

    if (JS_IsException(ret)) {
        /* Save the JS exception on the instance so tjs__call_wasm_func_inst can re-throw it */
        TJSWasmInstance *inst = wasm_runtime_get_user_data(exec_env);
        if (inst) {
            inst->pending_exception = JS_GetException(ctx);
            inst->has_pending_exception = true;
        }
        wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env), "imported function threw an exception");
        return;
    }

    /* Convert return value back to WASM */
    if (result_count > 0) {
        wasm_valkind_t ret_kind = wasm_func_type_get_result_valkind(func_type, 0);
        switch (ret_kind) {
            case WASM_I32: {
                int32_t i32;
                JS_ToInt32(ctx, &i32, ret);
                args[0] = (uint64_t) (uint32_t) i32;
                break;
            }
            case WASM_I64: {
                int64_t i64;
                if (JS_ToBigInt64(ctx, &i64, ret)) {
                    JS_FreeValue(ctx, JS_GetException(ctx));
                    int32_t i32;
                    JS_ToInt32(ctx, &i32, ret);
                    i64 = i32;
                }
                args[0] = (uint64_t) i64;
                break;
            }
            case WASM_F32: {
                double f64;
                JS_ToFloat64(ctx, &f64, ret);
                union {
                    uint32_t i;
                    float f;
                } u;
                u.f = (float) f64;
                args[0] = u.i;
                break;
            }
            case WASM_F64: {
                double f64;
                JS_ToFloat64(ctx, &f64, ret);
                union {
                    uint64_t i;
                    double f;
                } u;
                u.f = f64;
                args[0] = u.i;
                break;
            }
            default:
                args[0] = 0;
                break;
        }
    }

    JS_FreeValue(ctx, ret);
}

static JSValue tjs_wasm_setwasioptions(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmModule *m = tjs_wasm_module_get(ctx, argv[0]);
    if (!m) {
        return JS_EXCEPTION;
    }

    JSValue js_args = argv[1];
    JSValue js_env = argv[2];
    JSValue js_preopens = argv[3];

    char **wasi_argv = NULL;
    uint32_t wasi_argc = 0;
    char **wasi_env = NULL;
    uint32_t wasi_env_count = 0;
    char **wasi_map_dir_list = NULL;
    uint32_t wasi_map_dir_count = 0;

    /* Parse args array */
    if (JS_IsArray(js_args)) {
        JSValue js_length = JS_GetPropertyStr(ctx, js_args, "length");
        uint64_t len;
        if (JS_ToIndex(ctx, &len, js_length)) {
            JS_FreeValue(ctx, js_length);
            goto fail;
        }
        JS_FreeValue(ctx, js_length);

        wasi_argv = js_mallocz(ctx, sizeof(*wasi_argv) * (len + 1));
        if (!wasi_argv) {
            goto fail;
        }
        wasi_argc = (uint32_t) len;

        for (uint32_t i = 0; i < len; i++) {
            JSValue v = JS_GetPropertyUint32(ctx, js_args, i);
            if (JS_IsException(v)) {
                goto fail;
            }
            const char *arg_str = JS_ToCString(ctx, v);
            JS_FreeValue(ctx, v);
            if (!arg_str) {
                goto fail;
            }
            wasi_argv[i] = js_strdup(ctx, arg_str);
            JS_FreeCString(ctx, arg_str);
            if (!wasi_argv[i]) {
                goto fail;
            }
        }
    }

    /* Parse env object */
    if (JS_IsObject(js_env) && !JS_IsNull(js_env)) {
        JSPropertyEnum *ptab;
        uint32_t plen;
        if (JS_GetOwnPropertyNames(ctx, &ptab, &plen, js_env, JS_GPN_STRING_MASK | JS_GPN_ENUM_ONLY)) {
            goto fail;
        }

        wasi_env = js_mallocz(ctx, sizeof(*wasi_env) * (plen + 1));
        if (!wasi_env) {
            JS_FreePropertyEnum(ctx, ptab, plen);
            goto fail;
        }
        wasi_env_count = plen;

        for (uint32_t i = 0; i < plen; i++) {
            JSValue prop = JS_GetProperty(ctx, js_env, ptab[i].atom);
            if (JS_IsException(prop)) {
                JS_FreePropertyEnum(ctx, ptab, plen);
                goto fail;
            }
            const char *key = JS_AtomToCString(ctx, ptab[i].atom);
            const char *value = JS_ToCString(ctx, prop);
            JS_FreeValue(ctx, prop);
            if (!key || !value) {
                JS_FreeCString(ctx, key);
                JS_FreeCString(ctx, value);
                JS_FreePropertyEnum(ctx, ptab, plen);
                goto fail;
            }
            size_t entry_len = strlen(key) + strlen(value) + 2; /* KEY=VALUE\0 */
            wasi_env[i] = js_malloc(ctx, entry_len);
            if (!wasi_env[i]) {
                JS_FreeCString(ctx, key);
                JS_FreeCString(ctx, value);
                JS_FreePropertyEnum(ctx, ptab, plen);
                goto fail;
            }
            snprintf(wasi_env[i], entry_len, "%s=%s", key, value);
            JS_FreeCString(ctx, key);
            JS_FreeCString(ctx, value);
        }
        JS_FreePropertyEnum(ctx, ptab, plen);
    }

    /* Parse preopens object - format: { "/guest": "/host" } -> "guest::host" */
    if (JS_IsObject(js_preopens) && !JS_IsNull(js_preopens)) {
        JSPropertyEnum *ptab;
        uint32_t plen;
        if (JS_GetOwnPropertyNames(ctx, &ptab, &plen, js_preopens, JS_GPN_STRING_MASK | JS_GPN_ENUM_ONLY)) {
            goto fail;
        }

        wasi_map_dir_list = js_mallocz(ctx, sizeof(*wasi_map_dir_list) * (plen + 1));
        if (!wasi_map_dir_list) {
            JS_FreePropertyEnum(ctx, ptab, plen);
            goto fail;
        }
        wasi_map_dir_count = plen;

        for (uint32_t i = 0; i < plen; i++) {
            JSValue prop = JS_GetProperty(ctx, js_preopens, ptab[i].atom);
            if (JS_IsException(prop)) {
                JS_FreePropertyEnum(ctx, ptab, plen);
                goto fail;
            }
            const char *guest_path = JS_AtomToCString(ctx, ptab[i].atom);
            const char *host_path = JS_ToCString(ctx, prop);
            JS_FreeValue(ctx, prop);
            if (!guest_path || !host_path) {
                JS_FreeCString(ctx, guest_path);
                JS_FreeCString(ctx, host_path);
                JS_FreePropertyEnum(ctx, ptab, plen);
                goto fail;
            }
            /* Format: guest_path::host_path */
            size_t entry_len = strlen(guest_path) + strlen(host_path) + 3; /* guest::host\0 */
            wasi_map_dir_list[i] = js_malloc(ctx, entry_len);
            if (!wasi_map_dir_list[i]) {
                JS_FreeCString(ctx, guest_path);
                JS_FreeCString(ctx, host_path);
                JS_FreePropertyEnum(ctx, ptab, plen);
                goto fail;
            }
            snprintf(wasi_map_dir_list[i], entry_len, "%s::%s", guest_path, host_path);
            JS_FreeCString(ctx, guest_path);
            JS_FreeCString(ctx, host_path);
        }
        JS_FreePropertyEnum(ctx, ptab, plen);
    }

    /* Call WAMR to set WASI args - must happen before instantiate */
    wasm_runtime_set_wasi_args(m->module,
                               NULL,
                               0, /* dir_list - not used, we use map_dir_list */
                               (const char **) wasi_map_dir_list,
                               wasi_map_dir_count,
                               (const char **) wasi_env,
                               wasi_env_count,
                               wasi_argv,
                               (int) wasi_argc);

    /* Store allocations in module struct for cleanup */
    m->wasi.argv = wasi_argv;
    m->wasi.argc = wasi_argc;
    m->wasi.env = wasi_env;
    m->wasi.env_count = wasi_env_count;
    m->wasi.map_dir_list = wasi_map_dir_list;
    m->wasi.map_dir_count = wasi_map_dir_count;

    return JS_UNDEFINED;

fail:
    if (wasi_argv) {
        for (uint32_t i = 0; i < wasi_argc; i++) {
            js_free(ctx, wasi_argv[i]);
        }
        js_free(ctx, wasi_argv);
    }
    if (wasi_env) {
        for (uint32_t i = 0; i < wasi_env_count; i++) {
            js_free(ctx, wasi_env[i]);
        }
        js_free(ctx, wasi_env);
    }
    if (wasi_map_dir_list) {
        for (uint32_t i = 0; i < wasi_map_dir_count; i++) {
            js_free(ctx, wasi_map_dir_list[i]);
        }
        js_free(ctx, wasi_map_dir_list);
    }
    return JS_EXCEPTION;
}

static JSValue tjs__call_wasm_func_inst(JSContext *ctx,
                                        TJSWasmInstance *inst,
                                        wasm_function_inst_t func,
                                        int argc,
                                        JSValue *argv) {
    uint32_t param_count = wasm_func_get_param_count(func, inst->module_inst);
    uint32_t result_count = wasm_func_get_result_count(func, inst->module_inst);

    if (param_count > TJS__WASM_MAX_ARGS || result_count > TJS__WASM_MAX_ARGS) {
        return tjs_throw_wasm_error(ctx, "RuntimeError", "too many parameters or results");
    }

    wasm_valkind_t param_types[TJS__WASM_MAX_ARGS];
    if (param_count > 0) {
        wasm_func_get_param_types(func, inst->module_inst, param_types);
    }

    wasm_val_t params[TJS__WASM_MAX_ARGS];
    for (uint32_t j = 0; j < param_count; j++) {
        if ((int) j < argc) {
            if (!tjs__js_to_wasm_val(ctx, argv[j], param_types[j], &params[j])) {
                return JS_EXCEPTION;
            }
            /* For externref, box the JSValue and store the host pointer */
            if (param_types[j] == WASM_EXTERNREF) {
                if (JS_IsNull(argv[j]) || JS_IsUndefined(argv[j])) {
                    params[j].of.foreign = (uintptr_t) (void *) NULL;
                } else {
                    uint32_t idx;
                    if (!tjs__externref_box(inst, ctx, argv[j], &idx)) {
                        return JS_ThrowInternalError(ctx, "failed to register externref");
                    }
                    /* Store the key pointer as foreign — WAMR will convert it to an index */
                    uint32_t slot = inst->externref_count - 1;
                    params[j].of.foreign = (uintptr_t) (void *) (uintptr_t) (slot + 1);
                }
            }
        } else {
            params[j].kind = param_types[j];
            params[j].of.i64 = 0;
        }
    }

    wasm_val_t results[TJS__WASM_MAX_ARGS];

    if (!wasm_runtime_call_wasm_a(inst->exec_env, func, result_count, results, param_count, params)) {
        /* If an imported JS function threw, re-throw the original JS exception */
        if (inst->has_pending_exception) {
            JSValue exc = inst->pending_exception;
            inst->has_pending_exception = false;
            wasm_runtime_clear_exception(inst->module_inst);
            return JS_Throw(ctx, exc);
        }

        const char *exception = wasm_runtime_get_exception(inst->module_inst);
        /* Use the exception string before clearing, since clear zeroes the buffer */
        JSValue err = tjs_throw_wasm_error(ctx, "RuntimeError", exception ? exception : "call failed");
        wasm_runtime_clear_exception(inst->module_inst);
        return err;
    }

    wasm_valkind_t result_types[TJS__WASM_MAX_ARGS];
    if (result_count > 0) {
        wasm_func_get_result_types(func, inst->module_inst, result_types);
    }

    if (result_count == 0) {
        return JS_UNDEFINED;
    } else if (result_count == 1) {
        if (result_types[0] == WASM_EXTERNREF) {
            void *key = (void *) results[0].of.foreign;
            return JS_DupValue(ctx, tjs__externref_unbox_key(inst, key));
        }
        return tjs__wasm_val_to_js(ctx, &results[0]);
    } else {
        JSValue rets = JS_NewArray(ctx);
        for (uint32_t j = 0; j < result_count; j++) {
            if (result_types[j] == WASM_EXTERNREF) {
                void *key = (void *) results[j].of.foreign;
                JS_SetPropertyUint32(ctx, rets, j, JS_DupValue(ctx, tjs__externref_unbox_key(inst, key)));
            } else {
                JS_SetPropertyUint32(ctx, rets, j, tjs__wasm_val_to_js(ctx, &results[j]));
            }
        }
        return rets;
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

    wasm_function_inst_t func = wasm_runtime_lookup_function(i->module_inst, fname);
    if (!func) {
        JS_FreeCString(ctx, fname);
        return tjs_throw_wasm_error(ctx, "RuntimeError", "function not found");
    }
    JS_FreeCString(ctx, fname);

    return tjs__call_wasm_func_inst(ctx, i, func, argc - 1, argv + 1);
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

    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    uint32_t stack_size = qrt->wasm_ctx.stack_size;

    // Resolve any remaining symbols (WASI, etc.) if not already resolved
    wasm_runtime_resolve_symbols(m->module);

    // Instantiate the module
    i->module_inst = wasm_runtime_instantiate(m->module, stack_size, 0, error_buf, sizeof(error_buf));
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

#ifdef TJS__HAS_ASAN
    // ASAN moves local variables to a fake stack, which breaks WAMR's
    // native stack overflow check (it compares &local against the real
    // thread stack boundary — addresses in completely different regions).
    // Disable the check; OS guard pages still catch real overflows.
    wasm_runtime_set_native_stack_boundary(i->exec_env, (uint8_t *) 1);
#endif

    // Set user data so the import trampoline can find the instance
    wasm_runtime_set_user_data(i->exec_env, i);

    // Move pending imports from module to instance for lifetime management
    i->import_groups = m->pending_imports;
    m->pending_imports = NULL;

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

        const char *kind_str = NULL;

        switch (export_type.kind) {
            case WASM_IMPORT_EXPORT_KIND_FUNC:
                kind_str = "function";
                break;
            case WASM_IMPORT_EXPORT_KIND_MEMORY:
                kind_str = "memory";
                break;
            case WASM_IMPORT_EXPORT_KIND_TABLE:
                kind_str = "table";
                break;
            case WASM_IMPORT_EXPORT_KIND_GLOBAL:
                kind_str = "global";
                break;
        }

        if (kind_str) {
            JSValue item = JS_NewObjectProto(ctx, JS_NULL);
            JS_DefinePropertyValueStr(ctx, item, "name", JS_NewString(ctx, export_type.name), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, item, "kind", JS_NewString(ctx, kind_str), JS_PROP_C_W_E);
            JS_DefinePropertyValueUint32(ctx, exports, j, item, JS_PROP_C_W_E);
            j++;
        }
    }

    return exports;
}

static JSValue tjs_wasm_moduleimports(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmModule *m = tjs_wasm_module_get(ctx, argv[0]);
    if (!m) {
        return JS_EXCEPTION;
    }

    JSValue imports = JS_NewArray(ctx);
    if (JS_IsException(imports)) {
        return imports;
    }

    int32_t import_count = wasm_runtime_get_import_count(m->module);
    if (import_count < 0) {
        return imports;
    }

    for (int32_t idx = 0; idx < import_count; idx++) {
        wasm_import_t import_type;
        wasm_runtime_get_import_type(m->module, idx, &import_type);

        const char *kind_str = NULL;

        switch (import_type.kind) {
            case WASM_IMPORT_EXPORT_KIND_FUNC:
                kind_str = "function";
                break;
            case WASM_IMPORT_EXPORT_KIND_MEMORY:
                kind_str = "memory";
                break;
            case WASM_IMPORT_EXPORT_KIND_TABLE:
                kind_str = "table";
                break;
            case WASM_IMPORT_EXPORT_KIND_GLOBAL:
                kind_str = "global";
                break;
        }

        if (kind_str) {
            JSValue item = JS_NewObjectProto(ctx, JS_NULL);
            JS_DefinePropertyValueStr(ctx, item, "module", JS_NewString(ctx, import_type.module_name), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, item, "name", JS_NewString(ctx, import_type.name), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, item, "kind", JS_NewString(ctx, kind_str), JS_PROP_C_W_E);
            JS_DefinePropertyValueUint32(ctx, imports, idx, item, JS_PROP_C_W_E);
        }
    }

    return imports;
}

static char tjs__wasm_valkind_to_sig(wasm_valkind_t kind) {
    switch (kind) {
        case WASM_I32:
            return 'i';
        case WASM_I64:
            return 'I';
        case WASM_F32:
            return 'f';
        case WASM_F64:
            return 'F';
        /* NOTE: WASM_EXTERNREF ('r') not supported in import signatures
         * due to WAMR bugs in invoke_native_raw for externref. */
        default:
            return 'i';
    }
}

/*
 * resolveImports(module, instance, importDescs)
 *
 * importDescs is an array of { module: string, name: string, func: Function }
 * Groups imports by module name, registers native trampolines, then resolves.
 * Returns the import groups linked list head (stored on the instance for cleanup).
 */
static JSValue tjs_wasm_resolveimports(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmModule *m = tjs_wasm_module_get(ctx, argv[0]);
    if (!m) {
        return JS_EXCEPTION;
    }

    /* argv[1] is the array of import descriptors */
    JSValue arr = argv[1];
    JSValue js_length = JS_GetPropertyStr(ctx, arr, "length");
    uint64_t total;
    if (JS_ToIndex(ctx, &total, js_length)) {
        JS_FreeValue(ctx, js_length);
        return JS_EXCEPTION;
    }
    JS_FreeValue(ctx, js_length);

    if (total == 0) {
        /* No imports to resolve, just resolve symbols (for WASI etc.) */
        wasm_runtime_resolve_symbols(m->module);
        return JS_UNDEFINED;
    }

    /* Get import type info from the module for signature building */
    int32_t import_count = wasm_runtime_get_import_count(m->module);

    /* First pass: count imports per module name */
    /* We'll use a simple approach: collect all imports, group by module name */

    /* Temporary storage for parsed import descriptors */
    typedef struct {
        const char *module_name;
        const char *func_name;
        JSValue js_module_name;
        JSValue js_func_name;
        JSValue func;
        wasm_func_type_t func_type;
    } ImportDesc;

    ImportDesc *descs = js_mallocz(ctx, sizeof(ImportDesc) * total);
    if (!descs) {
        return JS_EXCEPTION;
    }

    /* Parse all descriptors and find matching WAMR import types */
    for (uint64_t i = 0; i < total; i++) {
        JSValue item = JS_GetPropertyUint32(ctx, arr, (uint32_t) i);
        if (JS_IsException(item)) {
            goto fail_descs;
        }

        descs[i].js_module_name = JS_GetPropertyStr(ctx, item, "module");
        descs[i].js_func_name = JS_GetPropertyStr(ctx, item, "name");
        descs[i].func = JS_GetPropertyStr(ctx, item, "func");
        JS_FreeValue(ctx, item);

        descs[i].module_name = JS_ToCString(ctx, descs[i].js_module_name);
        descs[i].func_name = JS_ToCString(ctx, descs[i].js_func_name);

        if (!descs[i].module_name || !descs[i].func_name) {
            goto fail_descs;
        }

        /* Find matching import in the WAMR module to get the function type */
        descs[i].func_type = NULL;
        for (int32_t j = 0; j < import_count; j++) {
            wasm_import_t imp;
            wasm_runtime_get_import_type(m->module, j, &imp);
            if (imp.kind == WASM_IMPORT_EXPORT_KIND_FUNC && strcmp(imp.module_name, descs[i].module_name) == 0 &&
                strcmp(imp.name, descs[i].func_name) == 0) {
                descs[i].func_type = imp.u.func_type;
                break;
            }
        }

        if (!descs[i].func_type) {
            JS_FreeCString(ctx, descs[i].module_name);
            JS_FreeCString(ctx, descs[i].func_name);
            JS_FreeValue(ctx, descs[i].js_module_name);
            JS_FreeValue(ctx, descs[i].js_func_name);
            JS_FreeValue(ctx, descs[i].func);
            js_free(ctx, descs);
            return tjs_throw_wasm_error(ctx, "LinkError", "imported function not found in module");
        }
    }

    /* Group by module name and register */
    bool *processed = js_mallocz(ctx, sizeof(bool) * total);
    if (!processed) {
        goto fail_descs;
    }

    TJSWasmImportGroup *groups_head = NULL;

    for (uint64_t i = 0; i < total; i++) {
        if (processed[i]) {
            continue;
        }

        /* Count how many imports share this module name */
        uint32_t group_count = 0;
        for (uint64_t j = i; j < total; j++) {
            if (!processed[j] && strcmp(descs[i].module_name, descs[j].module_name) == 0) {
                group_count++;
            }
        }

        /* Allocate group */
        TJSWasmImportGroup *group = js_mallocz(ctx, sizeof(TJSWasmImportGroup));
        if (!group) {
            goto fail_groups;
        }
        group->module_name = js_strdup(ctx, descs[i].module_name);
        group->symbols = js_mallocz(ctx, sizeof(NativeSymbol) * group_count);
        group->ctxs = js_mallocz(ctx, sizeof(TJSWasmImportCtx) * group_count);
        group->count = group_count;
        group->next = groups_head;
        groups_head = group;

        if (!group->module_name || !group->symbols || !group->ctxs) {
            goto fail_groups;
        }

        /* Fill in the symbols */
        uint32_t si = 0;
        for (uint64_t j = i; j < total; j++) {
            if (processed[j] || strcmp(descs[i].module_name, descs[j].module_name) != 0) {
                continue;
            }
            processed[j] = true;

            /* Build signature string, e.g., "(iI)f" */
            wasm_func_type_t ft = descs[j].func_type;
            uint32_t pc = wasm_func_type_get_param_count(ft);
            uint32_t rc = wasm_func_type_get_result_count(ft);

            /* sig: "(" + params + ")" + result (or nothing) + null */
            char *sig = js_malloc(ctx, pc + rc + 3);
            if (!sig) {
                goto fail_groups;
            }
            uint32_t pos = 0;
            sig[pos++] = '(';
            for (uint32_t k = 0; k < pc; k++) {
                sig[pos++] = tjs__wasm_valkind_to_sig(wasm_func_type_get_param_valkind(ft, k));
            }
            sig[pos++] = ')';
            if (rc > 0) {
                sig[pos++] = tjs__wasm_valkind_to_sig(wasm_func_type_get_result_valkind(ft, 0));
            }
            sig[pos] = '\0';

            /* Set up the import context */
            group->ctxs[si].ctx = ctx;
            group->ctxs[si].func = JS_DupValue(ctx, descs[j].func);
            group->ctxs[si].type = ft;

            /* Set up the native symbol */
            group->symbols[si].symbol = js_strdup(ctx, descs[j].func_name);
            group->symbols[si].func_ptr = tjs__wasm_import_trampoline;
            group->symbols[si].signature = sig;
            group->symbols[si].attachment = &group->ctxs[si];

            si++;
        }

        /* Register this group */
        if (!wasm_runtime_register_natives_raw(group->module_name, group->symbols, group->count)) {
            goto fail_groups;
        }
    }

    /* Now resolve all symbols */
    wasm_runtime_resolve_symbols(m->module);

    /* Store groups on the module temporarily; buildInstance moves them to the instance */
    m->pending_imports = groups_head;

    /* Cleanup temporary data */
    js_free(ctx, processed);
    for (uint64_t i = 0; i < total; i++) {
        JS_FreeCString(ctx, descs[i].module_name);
        JS_FreeCString(ctx, descs[i].func_name);
        JS_FreeValue(ctx, descs[i].js_module_name);
        JS_FreeValue(ctx, descs[i].js_func_name);
        JS_FreeValue(ctx, descs[i].func);
    }
    js_free(ctx, descs);

    return JS_UNDEFINED;

fail_groups:
    /* Unregister and free any groups we already created */
    while (groups_head) {
        TJSWasmImportGroup *next = groups_head->next;
        wasm_runtime_unregister_natives(groups_head->module_name, groups_head->symbols);
        for (uint32_t j = 0; j < groups_head->count; j++) {
            JS_FreeValue(ctx, groups_head->ctxs[j].func);
            js_free(ctx, (char *) groups_head->symbols[j].symbol);
            js_free(ctx, (char *) groups_head->symbols[j].signature);
        }
        js_free(ctx, groups_head->ctxs);
        js_free(ctx, groups_head->symbols);
        js_free(ctx, groups_head->module_name);
        js_free(ctx, groups_head);
        groups_head = next;
    }
    js_free(ctx, processed);

fail_descs:
    for (uint64_t i = 0; i < total; i++) {
        JS_FreeCString(ctx, descs[i].module_name);
        JS_FreeCString(ctx, descs[i].func_name);
        JS_FreeValue(ctx, descs[i].js_module_name);
        JS_FreeValue(ctx, descs[i].js_func_name);
        JS_FreeValue(ctx, descs[i].func);
    }
    js_free(ctx, descs);
    return tjs_throw_wasm_error(ctx, "LinkError", "failed to register imports");
}

/*
 * resolveGlobalImports(module, globalDescs)
 *
 * globalDescs is an array of { module: string, name: string, value: number|bigint, type: string, mutable: bool }
 * Directly sets the global value on the module's internal import structures.
 */
static JSValue tjs_wasm_resolveglobalimports(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmModule *m = tjs_wasm_module_get(ctx, argv[0]);
    if (!m) {
        return JS_EXCEPTION;
    }

    JSValue arr = argv[1];
    JSValue js_length = JS_GetPropertyStr(ctx, arr, "length");
    uint64_t total;
    if (JS_ToIndex(ctx, &total, js_length)) {
        JS_FreeValue(ctx, js_length);
        return JS_EXCEPTION;
    }
    JS_FreeValue(ctx, js_length);

    if (total == 0) {
        return JS_UNDEFINED;
    }

    WASMModule *wasm_module = (WASMModule *) m->module;

    for (uint64_t i = 0; i < total; i++) {
        JSValue item = JS_GetPropertyUint32(ctx, arr, (uint32_t) i);
        if (JS_IsException(item)) {
            return JS_EXCEPTION;
        }

        JSValue js_mod = JS_GetPropertyStr(ctx, item, "module");
        JSValue js_name = JS_GetPropertyStr(ctx, item, "name");
        JSValue js_value = JS_GetPropertyStr(ctx, item, "value");
        JS_FreeValue(ctx, item);

        const char *mod_name = JS_ToCString(ctx, js_mod);
        const char *field_name = JS_ToCString(ctx, js_name);
        JS_FreeValue(ctx, js_mod);
        JS_FreeValue(ctx, js_name);

        if (!mod_name || !field_name) {
            JS_FreeCString(ctx, mod_name);
            JS_FreeCString(ctx, field_name);
            JS_FreeValue(ctx, js_value);
            return JS_EXCEPTION;
        }

        /* Find matching import global in the module */
        bool found = false;
        for (uint32_t j = 0; j < wasm_module->import_global_count; j++) {
            WASMGlobalImport *gi = &wasm_module->import_globals[j].u.global;
            if (strcmp(gi->module_name, mod_name) == 0 && strcmp(gi->field_name, field_name) == 0) {
                /* Set the value based on type */
                switch (gi->type.val_type) {
                    case VALUE_TYPE_I32: {
                        int32_t v;
                        JS_ToInt32(ctx, &v, js_value);
                        gi->global_data_linked.i32 = v;
                        break;
                    }
                    case VALUE_TYPE_I64: {
                        int64_t v;
                        if (JS_ToBigInt64(ctx, &v, js_value)) {
                            JS_FreeValue(ctx, JS_GetException(ctx));
                            int32_t i32;
                            JS_ToInt32(ctx, &i32, js_value);
                            v = i32;
                        }
                        gi->global_data_linked.i64 = v;
                        break;
                    }
                    case VALUE_TYPE_F32: {
                        double f64;
                        JS_ToFloat64(ctx, &f64, js_value);
                        gi->global_data_linked.f32 = (float) f64;
                        break;
                    }
                    case VALUE_TYPE_F64: {
                        double f64;
                        JS_ToFloat64(ctx, &f64, js_value);
                        gi->global_data_linked.f64 = f64;
                        break;
                    }
                    default:
                        break;
                }
                gi->is_linked = true;
                found = true;
                break;
            }
        }

        JS_FreeCString(ctx, mod_name);
        JS_FreeCString(ctx, field_name);
        JS_FreeValue(ctx, js_value);

        if (!found) {
            return tjs_throw_wasm_error(ctx, "LinkError", "imported global not found in module");
        }
    }

    return JS_UNDEFINED;
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
            return JS_ThrowTypeError(ctx, "invalid buffer");
        }
        buf += aoffset;
        size = asize;
    }

    if (size == 0) {
        return JS_ThrowTypeError(ctx, "invalid buffer");
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
    LoadArgs load_args = { 0 };
    load_args.no_resolve = true;
    m->module = wasm_runtime_load_ex(m->data.bytes, (uint32_t) size, &load_args, error_buf, sizeof(error_buf));
    if (!m->module) {
        JS_FreeValue(ctx, obj);
        return tjs_throw_wasm_error(ctx, "CompileError", error_buf);
    }

    return obj;
}

/* No-op free function: WAMR owns the memory, not JS */
static void tjs__wasm_memory_free(JSRuntime *rt, void *opaque, void *ptr) {
    /* intentionally empty */
}

static JSValue tjs_wasm_getmemorybuffer(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, argv[0]);
    if (!i) {
        return JS_EXCEPTION;
    }

    wasm_memory_inst_t mem = wasm_runtime_get_default_memory(i->module_inst);
    if (!mem) {
        return tjs_throw_wasm_error(ctx, "RuntimeError", "no memory instance");
    }

    void *base = wasm_memory_get_base_address(mem);
    uint64_t page_count = wasm_memory_get_cur_page_count(mem);
    uint64_t bytes_per_page = wasm_memory_get_bytes_per_page(mem);
    size_t byte_length = (size_t) (page_count * bytes_per_page);

    return JS_NewArrayBuffer(ctx, (uint8_t *) base, byte_length, tjs__wasm_memory_free, NULL, false);
}

static JSValue tjs_wasm_growmemory(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, argv[0]);
    if (!i) {
        return JS_EXCEPTION;
    }

    uint32_t delta;
    if (JS_ToUint32(ctx, &delta, argv[1])) {
        return JS_EXCEPTION;
    }

    wasm_memory_inst_t mem = wasm_runtime_get_default_memory(i->module_inst);
    if (!mem) {
        return tjs_throw_wasm_error(ctx, "RuntimeError", "no memory instance");
    }

    uint64_t old_pages = wasm_memory_get_cur_page_count(mem);

    if (delta == 0) {
        return JS_NewUint32(ctx, (uint32_t) old_pages);
    }

    if (!wasm_memory_enlarge(mem, delta)) {
        return JS_ThrowRangeError(ctx, "failed to grow memory");
    }

    return JS_NewUint32(ctx, (uint32_t) old_pages);
}

static JSValue tjs_wasm_getglobal(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, argv[0]);
    if (!i) {
        return JS_EXCEPTION;
    }

    const char *name = JS_ToCString(ctx, argv[1]);
    if (!name) {
        return JS_EXCEPTION;
    }

    wasm_global_inst_t global_inst;
    if (!wasm_runtime_get_export_global_inst(i->module_inst, name, &global_inst)) {
        JS_FreeCString(ctx, name);
        return tjs_throw_wasm_error(ctx, "RuntimeError", "global not found");
    }
    JS_FreeCString(ctx, name);

    switch (global_inst.kind) {
        case WASM_I32:
        case WASM_I64:
        case WASM_F32:
        case WASM_F64: {
            wasm_val_t val;
            val.kind = global_inst.kind;
            switch (global_inst.kind) {
                case WASM_I32:
                    memcpy(&val.of.i32, global_inst.global_data, sizeof(val.of.i32));
                    break;
                case WASM_I64:
                    memcpy(&val.of.i64, global_inst.global_data, sizeof(val.of.i64));
                    break;
                case WASM_F32:
                    memcpy(&val.of.f32, global_inst.global_data, sizeof(val.of.f32));
                    break;
                case WASM_F64:
                    memcpy(&val.of.f64, global_inst.global_data, sizeof(val.of.f64));
                    break;
                default:
                    break;
            }
            return tjs__wasm_val_to_js(ctx, &val);
        }
        case WASM_EXTERNREF: {
            uint32_t idx = *(uint32_t *) global_inst.global_data;
            return JS_DupValue(ctx, tjs__externref_unbox(i, idx));
        }
        default:
            return JS_UNDEFINED;
    }
}

static JSValue tjs_wasm_setglobal(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, argv[0]);
    if (!i) {
        return JS_EXCEPTION;
    }

    const char *name = JS_ToCString(ctx, argv[1]);
    if (!name) {
        return JS_EXCEPTION;
    }

    wasm_global_inst_t global_inst;
    if (!wasm_runtime_get_export_global_inst(i->module_inst, name, &global_inst)) {
        JS_FreeCString(ctx, name);
        return tjs_throw_wasm_error(ctx, "RuntimeError", "global not found");
    }
    JS_FreeCString(ctx, name);

    if (!global_inst.is_mutable) {
        return JS_ThrowTypeError(ctx, "cannot set an immutable global");
    }

    switch (global_inst.kind) {
        case WASM_I32: {
            int32_t v;
            if (JS_ToInt32(ctx, &v, argv[2])) {
                return JS_EXCEPTION;
            }
            memcpy(global_inst.global_data, &v, sizeof(v));
            break;
        }
        case WASM_I64: {
            int64_t v;
            if (!JS_ToBigInt64(ctx, &v, argv[2])) {
                memcpy(global_inst.global_data, &v, sizeof(v));
                break;
            }
            JS_FreeValue(ctx, JS_GetException(ctx));
            int32_t i32;
            if (JS_ToInt32(ctx, &i32, argv[2])) {
                return JS_EXCEPTION;
            }
            int64_t i64 = i32;
            memcpy(global_inst.global_data, &i64, sizeof(i64));
            break;
        }
        case WASM_F32: {
            double f64;
            if (JS_ToFloat64(ctx, &f64, argv[2])) {
                return JS_EXCEPTION;
            }
            float f32 = (float) f64;
            memcpy(global_inst.global_data, &f32, sizeof(f32));
            break;
        }
        case WASM_F64: {
            double f64;
            if (JS_ToFloat64(ctx, &f64, argv[2])) {
                return JS_EXCEPTION;
            }
            memcpy(global_inst.global_data, &f64, sizeof(f64));
            break;
        }
        case WASM_EXTERNREF: {
            uint32_t idx;
            if (!tjs__externref_box(i, ctx, argv[2], &idx)) {
                return JS_ThrowInternalError(ctx, "failed to register externref");
            }
            memcpy(global_inst.global_data, &idx, sizeof(idx));
            break;
        }
        default:
            return JS_ThrowTypeError(ctx, "unsupported global type");
    }

    return JS_UNDEFINED;
}

static JSValue tjs_wasm_getglobalinfo(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, argv[0]);
    if (!i) {
        return JS_EXCEPTION;
    }

    const char *name = JS_ToCString(ctx, argv[1]);
    if (!name) {
        return JS_EXCEPTION;
    }

    wasm_global_inst_t global_inst;
    if (!wasm_runtime_get_export_global_inst(i->module_inst, name, &global_inst)) {
        JS_FreeCString(ctx, name);
        return tjs_throw_wasm_error(ctx, "RuntimeError", "global not found");
    }
    JS_FreeCString(ctx, name);

    const char *type_str;
    switch (global_inst.kind) {
        case WASM_I32:
            type_str = "i32";
            break;
        case WASM_I64:
            type_str = "i64";
            break;
        case WASM_F32:
            type_str = "f32";
            break;
        case WASM_F64:
            type_str = "f64";
            break;
        case WASM_EXTERNREF:
            type_str = "externref";
            break;
        case WASM_FUNCREF:
            type_str = "funcref";
            break;
        default:
            type_str = "unknown";
            break;
    }

    JSValue obj = JS_NewObject(ctx);
    JS_DefinePropertyValueStr(ctx, obj, "type", JS_NewString(ctx, type_str), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, obj, "mutable", JS_NewBool(ctx, global_inst.is_mutable), JS_PROP_C_W_E);

    return obj;
}

/* Table operations using internal WAMR structures */

static JSValue tjs_wasm_gettableinfo(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, argv[0]);
    if (!i) {
        return JS_EXCEPTION;
    }

    const char *name = JS_ToCString(ctx, argv[1]);
    if (!name) {
        return JS_EXCEPTION;
    }

    wasm_table_inst_t tbl;
    if (!wasm_runtime_get_export_table_inst(i->module_inst, name, &tbl)) {
        JS_FreeCString(ctx, name);
        return tjs_throw_wasm_error(ctx, "RuntimeError", "table not found");
    }
    JS_FreeCString(ctx, name);

    const char *elem_kind_str;
    switch (tbl.elem_kind) {
        case WASM_FUNCREF:
            elem_kind_str = "funcref";
            break;
        case WASM_EXTERNREF:
            elem_kind_str = "externref";
            break;
        default:
            elem_kind_str = "unknown";
            break;
    }

    JSValue obj = JS_NewObject(ctx);
    JS_DefinePropertyValueStr(ctx, obj, "element", JS_NewString(ctx, elem_kind_str), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, obj, "cur_size", JS_NewUint32(ctx, tbl.cur_size), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, obj, "max_size", JS_NewUint32(ctx, tbl.max_size), JS_PROP_C_W_E);

    return obj;
}

static JSValue tjs_wasm_tablesize(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, argv[0]);
    if (!i) {
        return JS_EXCEPTION;
    }

    const char *name = JS_ToCString(ctx, argv[1]);
    if (!name) {
        return JS_EXCEPTION;
    }

    wasm_table_inst_t tbl;
    if (!wasm_runtime_get_export_table_inst(i->module_inst, name, &tbl)) {
        JS_FreeCString(ctx, name);
        return tjs_throw_wasm_error(ctx, "RuntimeError", "table not found");
    }
    JS_FreeCString(ctx, name);

    return JS_NewUint32(ctx, tbl.cur_size);
}

static JSValue tjs_wasm_tableget(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, argv[0]);
    if (!i) {
        return JS_EXCEPTION;
    }

    const char *name = JS_ToCString(ctx, argv[1]);
    if (!name) {
        return JS_EXCEPTION;
    }

    uint32_t index;
    if (JS_ToUint32(ctx, &index, argv[2])) {
        JS_FreeCString(ctx, name);
        return JS_EXCEPTION;
    }

    /* Get the public table info for bounds and type */
    wasm_table_inst_t tbl;
    if (!wasm_runtime_get_export_table_inst(i->module_inst, name, &tbl)) {
        JS_FreeCString(ctx, name);
        return tjs_throw_wasm_error(ctx, "RuntimeError", "table not found");
    }
    JS_FreeCString(ctx, name);

    if (index >= tbl.cur_size) {
        return tjs_throw_wasm_error(ctx, "RangeError", "table index out of bounds");
    }

    /* Access the internal table elements (use memcpy for potentially misaligned WAMR data) */
    table_elem_type_t elem;
    memcpy(&elem, (uint8_t *) tbl.elems + index * sizeof(table_elem_type_t), sizeof(elem));

    if (tbl.elem_kind == WASM_FUNCREF) {
        if ((uint32_t) elem == (uint32_t) NULL_REF) {
            return JS_NULL;
        }
        /* Return the function index; JS side wraps it */
        return JS_NewUint32(ctx, (uint32_t) elem);
    } else if (tbl.elem_kind == WASM_EXTERNREF) {
        if ((uint32_t) elem == (uint32_t) NULL_REF) {
            return JS_NULL;
        }
        return JS_DupValue(ctx, tjs__externref_unbox(i, (uint32_t) elem));
    }

    return JS_NULL;
}

static JSValue tjs_wasm_tableset(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, argv[0]);
    if (!i) {
        return JS_EXCEPTION;
    }

    const char *name = JS_ToCString(ctx, argv[1]);
    if (!name) {
        return JS_EXCEPTION;
    }

    uint32_t index;
    if (JS_ToUint32(ctx, &index, argv[2])) {
        JS_FreeCString(ctx, name);
        return JS_EXCEPTION;
    }

    wasm_table_inst_t tbl;
    if (!wasm_runtime_get_export_table_inst(i->module_inst, name, &tbl)) {
        JS_FreeCString(ctx, name);
        return tjs_throw_wasm_error(ctx, "RuntimeError", "table not found");
    }
    JS_FreeCString(ctx, name);

    if (index >= tbl.cur_size) {
        return tjs_throw_wasm_error(ctx, "RangeError", "table index out of bounds");
    }

    JSValue val = argv[3];
    uint8_t *elem_ptr = (uint8_t *) tbl.elems + index * sizeof(table_elem_type_t);

    if (tbl.elem_kind == WASM_FUNCREF) {
        if (JS_IsNull(val)) {
            table_elem_type_t null_elem = (table_elem_type_t) (uint32_t) NULL_REF;
            memcpy(elem_ptr, &null_elem, sizeof(null_elem));
        } else {
            uint32_t func_idx;
            if (JS_ToUint32(ctx, &func_idx, val)) {
                return JS_EXCEPTION;
            }
            table_elem_type_t elem = (table_elem_type_t) func_idx;
            memcpy(elem_ptr, &elem, sizeof(elem));
        }
    } else if (tbl.elem_kind == WASM_EXTERNREF) {
        if (JS_IsNull(val) || JS_IsUndefined(val)) {
            table_elem_type_t null_elem = (table_elem_type_t) (uint32_t) NULL_REF;
            memcpy(elem_ptr, &null_elem, sizeof(null_elem));
        } else {
            uint32_t idx;
            if (!tjs__externref_box(i, ctx, val, &idx)) {
                return JS_ThrowInternalError(ctx, "failed to register externref");
            }
            table_elem_type_t elem = (table_elem_type_t) idx;
            memcpy(elem_ptr, &elem, sizeof(elem));
        }
    }

    return JS_UNDEFINED;
}

static JSValue tjs_wasm_tablegrow(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, argv[0]);
    if (!i) {
        return JS_EXCEPTION;
    }

    const char *name = JS_ToCString(ctx, argv[1]);
    if (!name) {
        return JS_EXCEPTION;
    }

    uint32_t delta;
    if (JS_ToUint32(ctx, &delta, argv[2])) {
        JS_FreeCString(ctx, name);
        return JS_EXCEPTION;
    }

    /* Find the table index by name */
    WASMModuleInstance *module_inst = (WASMModuleInstance *) i->module_inst;
    int32_t export_count = wasm_runtime_get_export_count((wasm_module_t) module_inst->module);
    uint32_t table_idx = UINT32_MAX;

    for (int32_t j = 0; j < export_count; j++) {
        wasm_export_t exp;
        wasm_runtime_get_export_type((wasm_module_t) module_inst->module, j, &exp);
        if (exp.kind == WASM_IMPORT_EXPORT_KIND_TABLE && strcmp(exp.name, name) == 0) {
            /* The table index in the export matches the internal table index */
            WASMExport *exports = module_inst->module->exports;
            table_idx = exports[j].index;
            break;
        }
    }

    JS_FreeCString(ctx, name);

    if (table_idx == UINT32_MAX) {
        return tjs_throw_wasm_error(ctx, "RuntimeError", "table not found");
    }

    /* Get old size before grow */
    WASMTableInstance *tbl_inst = module_inst->tables[table_idx];
    uint32_t old_size = tbl_inst->cur_size;

    table_elem_type_t init_val = NULL_REF;

    if (!wasm_enlarge_table(module_inst, table_idx, delta, init_val)) {
        return JS_NewInt32(ctx, -1);
    }

    return JS_NewUint32(ctx, old_size);
}

/* Get WAMR function index by export name */
static JSValue tjs_wasm_getfuncindex(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, argv[0]);
    if (!i) {
        return JS_EXCEPTION;
    }

    const char *name = JS_ToCString(ctx, argv[1]);
    if (!name) {
        return JS_EXCEPTION;
    }

    WASMModuleInstance *module_inst = (WASMModuleInstance *) i->module_inst;
    int32_t export_count = wasm_runtime_get_export_count((wasm_module_t) module_inst->module);

    for (int32_t j = 0; j < export_count; j++) {
        wasm_export_t exp;
        wasm_runtime_get_export_type((wasm_module_t) module_inst->module, j, &exp);
        if (exp.kind == WASM_IMPORT_EXPORT_KIND_FUNC && strcmp(exp.name, name) == 0) {
            WASMExport *exports = module_inst->module->exports;
            JS_FreeCString(ctx, name);
            return JS_NewUint32(ctx, exports[j].index);
        }
    }

    JS_FreeCString(ctx, name);
    return JS_NewInt32(ctx, -1);
}

/* Call a WASM function by index (for funcref table entries) */
static JSValue tjs_wasm_callfuncbyindex(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWasmInstance *i = tjs_wasm_instance_get(ctx, argv[0]);
    if (!i) {
        return JS_EXCEPTION;
    }

    uint32_t func_idx;
    if (JS_ToUint32(ctx, &func_idx, argv[1])) {
        return JS_EXCEPTION;
    }

    WASMModuleInstance *module_inst = (WASMModuleInstance *) i->module_inst;
    uint32_t total_funcs = module_inst->module->import_function_count + module_inst->module->function_count;

    if (func_idx >= total_funcs) {
        return tjs_throw_wasm_error(ctx, "RuntimeError", "function index out of bounds");
    }

    wasm_function_inst_t func = (wasm_function_inst_t) &module_inst->e->functions[func_idx];

    return tjs__call_wasm_func_inst(ctx, i, func, argc - 2, argv + 2);
}

static JSValue tjs_wasm_validate(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    size_t buf_len;
    uint8_t *buf = JS_GetUint8Array(ctx, &buf_len, argv[0]);
    if (!buf) {
        JS_FreeValue(ctx, JS_GetException(ctx));
        return JS_FALSE;
    }

    if (buf_len == 0) {
        return JS_FALSE;
    }

    char error_buf[TJS__WASM_ERROR_BUF_SIZE];

    /* Make a copy using WAMR's allocator since wasm_runtime_load takes ownership on success */
    uint8_t *copy = wasm_runtime_malloc(buf_len);
    if (!copy) {
        return JS_FALSE;
    }
    memcpy(copy, buf, buf_len);

    wasm_module_t module = wasm_runtime_load(copy, (uint32_t) buf_len, error_buf, sizeof(error_buf));
    if (module) {
        wasm_runtime_unload(module);
        return JS_TRUE;
    }

    wasm_runtime_free(copy);
    return JS_FALSE;
}

static const JSCFunctionListEntry tjs_wasm_funcs[] = {
    TJS_CFUNC_DEF("buildInstance", 1, tjs_wasm_buildinstance),
    TJS_CFUNC_DEF("callFuncByIndex", 3, tjs_wasm_callfuncbyindex),
    TJS_CFUNC_DEF("getFuncIndex", 2, tjs_wasm_getfuncindex),
    TJS_CFUNC_DEF("getGlobal", 2, tjs_wasm_getglobal),
    TJS_CFUNC_DEF("getGlobalInfo", 2, tjs_wasm_getglobalinfo),
    TJS_CFUNC_DEF("getMemoryBuffer", 1, tjs_wasm_getmemorybuffer),
    TJS_CFUNC_DEF("getTableInfo", 2, tjs_wasm_gettableinfo),
    TJS_CFUNC_DEF("growMemory", 2, tjs_wasm_growmemory),
    TJS_CFUNC_DEF("moduleExports", 1, tjs_wasm_moduleexports),
    TJS_CFUNC_DEF("moduleImports", 1, tjs_wasm_moduleimports),
    TJS_CFUNC_DEF("parseModule", 1, tjs_wasm_parsemodule),
    TJS_CFUNC_DEF("resolveGlobalImports", 2, tjs_wasm_resolveglobalimports),
    TJS_CFUNC_DEF("resolveImports", 2, tjs_wasm_resolveimports),
    TJS_CFUNC_DEF("setGlobal", 3, tjs_wasm_setglobal),
    TJS_CFUNC_DEF("setWasiOptions", 4, tjs_wasm_setwasioptions),
    TJS_CFUNC_DEF("tableGet", 3, tjs_wasm_tableget),
    TJS_CFUNC_DEF("tableGrow", 3, tjs_wasm_tablegrow),
    TJS_CFUNC_DEF("tableSet", 4, tjs_wasm_tableset),
    TJS_CFUNC_DEF("tableSize", 2, tjs_wasm_tablesize),
    TJS_CFUNC_DEF("validate", 1, tjs_wasm_validate),
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

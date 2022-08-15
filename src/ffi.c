/*
MIT License

Copyright (c) 2022 lal12

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

#include "private.h"

#include <ffi.h>
#include <stdint.h>

#define TJS_CONST_STRING_DEF(x) JS_PROP_STRING_DEF(#x, x, JS_PROP_ENUMERABLE)

#define JS_PTR_TYPE       t_bigint
#define JS_IS_PTR(ctx, x) JS_IsBigInt(ctx, x)

#if UINTPTR_MAX == UINT32_MAX
#define JS_TO_UINTPTR_T(ctx, pres, val)                                                                                \
    {                                                                                                                  \
        uint64_t v;                                                                                                    \
        JS_ToBigInt64(ctx, &v, val);                                                                                   \
        *(uint32_t *) (pres) = (uint32_t) v;                                                                           \
    }
#define JS_NEW_UINTPTR_T(ctx, val) JS_NewBigUint64(ctx, (int32_t) (val))
#define ffi_type_ptr               ffi_type_uint32
#elif UINTPTR_MAX == UINT64_MAX
#define JS_TO_UINTPTR_T(ctx, pres, val) JS_ToBigInt64(ctx, (int64_t *) (pres), val)
#define JS_NEW_UINTPTR_T(ctx, val)      JS_NewBigUint64(ctx, (int64_t) (val))
#define ffi_type_ptr                    ffi_type_uint64
#else
#error "'uintptr_t' neither 32bit nor 64 bit, I don't know how to handle it."
#endif

#if SIZE_MAX == UINT32_MAX
#define JS_TO_SIZE_T(ctx, pres, val)  JS_ToInt32(ctx, (int32_t *) (pres), val)
#define JS_NEW_SIZE_T(ctx, val)       JS_NewInt32(ctx, (int32_t) (val))
#define JS_PROP_SIZE_T_DEF(name, val) JS_PROP_INT32_DEF(name, (int32_t) (val), JS_PROP_CONFIGURABLE)
#define C_SIZEOF_DEF(x)               JS_PROP_INT32_DEF(STRINGIFY(sizeof_##x), (int32_t) (sizeof(x)), JS_PROP_CONFIGURABLE)
#define ffi_type_size_t               ffi_type_uint32
#elif SIZE_MAX == UINT64_MAX
#define JS_TO_SIZE_T(ctx, pres, val)  JS_ToInt64(ctx, (int64_t *) (pres), val)
#define JS_NEW_SIZE_T(ctx, val)       JS_NewInt64(ctx, (int64_t) (val))
#define JS_PROP_SIZE_T_DEF(name, val) JS_PROP_INT64_DEF(name, (int64_t) (val), JS_PROP_CONFIGURABLE)
#define C_SIZEOF_DEF(x)               JS_PROP_INT64_DEF(STRINGIFY(sizeof_##x), (int64_t) (sizeof(x)), JS_PROP_CONFIGURABLE)
#define C_OFFSETOF_DEF(t, d)                                                                                           \
    JS_PROP_INT64_DEF(STRINGIFY(offsetof_##t##_##d), (int64_t) (offsetof(t, d)), JS_PROP_CONFIGURABLE)
#define ffi_type_size_t ffi_type_sint32
#else
#error "'size_t' neither 32bit nor 64 bit, I don't know how to handle it."
#endif

#if INT_MAX == INT32_MAX
#define C_MACRO_INT_DEF(x)        JS_PROP_INT32_DEF(#x, (int32_t) (x), JS_PROP_CONFIGURABLE)
#define C_ENUM_DEF(x)             JS_PROP_INT32_DEF(#x, (int32_t) (x), JS_PROP_CONFIGURABLE)
#define JS_TO_INT(ctx, pres, val) JS_ToInt32(ctx, (int32_t *) (pres), val)
#define JS_NEW_INT(ctx, val)      JS_NewInt32(ctx, (int32_t) (val))
#elif INT_MAX == INT64_MAX
#define C_MACRO_INT_DEF(x)        JS_PROP_INT64_DEF(#x, (int64_t) (x), JS_PROP_CONFIGURABLE)
#define C_ENUM_DEF(x)             JS_PROP_INT64_DEF(#x, (int64_t) (x), JS_PROP_CONFIGURABLE)
#define JS_TO_INT(ctx, pres, val) JS_ToInt64(ctx, (int64_t *) (pres), val)
#define JS_NEW_INT(ctx, val)      JS_NewInt64(ctx, (int64_t) (val))
#else
#error "'int' neither 32bit nor 64 bit, I don't know how to handle it."
#endif

#define FFI_ALIGN(v, a) (((((size_t) (v)) - 1) | ((a) -1)) + 1)

#pragma region "FFI Helpers"
// ===================

static const char *ffi_strerror(ffi_status status) {
    switch (status) {
        case FFI_OK:
            return "FFI_OK";
        case FFI_BAD_TYPEDEF:
            return "FFI_BAD_TYPEDEF";
        case FFI_BAD_ABI:
            return "FFI_BAD_ABI";
        // FFI_BAD_ARGTYPE does not exist in older versions of libffi.
        case 3:
            return "FFI_BAD_ARGTYPE";
        default:
            return "Unknown FFI error";
    }
}

#pragma endregion "FFI Helpers"

#pragma region "FfiType class definition"
// =======================================
typedef struct {
    size_t elemCount;
    JSValue *deps;
    bool dynamic;
    ffi_type *ffi_type;
} js_ffi_type;

size_t ffi_type_get_sz(ffi_type *type) {
    if (type->type == FFI_TYPE_STRUCT) {
        size_t sz = 0;
        unsigned i = 0;
        while (type->elements[i] != NULL) {
            sz += FFI_ALIGN(ffi_type_get_sz(type->elements[i]), type->alignment);
            i++;
        }
        return sz;
    } else {
        return type->size;
    }
}

static JSClassID js_ffi_type_classid;
static JSValue js_ffi_type_create_struct(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    JSValueConst *types = argv;
    size_t typeCnt = argc;
    int arrSz = 0;
    if (JS_IsNumber(argv[0])) {
        typeCnt--;
        types++;
        if (JS_ToInt32(ctx, &arrSz, argv[0])) {
            JS_ThrowTypeError(ctx, "expected argument 1 to be FfiType or positive integer");
            return JS_EXCEPTION;
        }
        if (argc != 2) {
            JS_ThrowTypeError(ctx, "expected arguments: number, FfiType");
            return JS_EXCEPTION;
        }
    }
    for (unsigned i = 0; i < typeCnt; i++) {
        ffi_type *t = JS_GetOpaque(types[i], js_ffi_type_classid);
        if (t == NULL) {
            JS_ThrowTypeError(ctx, "argument %ld is not a FfiType", (types - argv) + i + 1);
            return JS_EXCEPTION;
        }
    }

    JSValue obj = JS_NewObjectClass(ctx, js_ffi_type_classid);
    if (JS_IsException(obj)) {
        return obj;
    }

    ffi_type **elements;
    if (arrSz > 0) {
        elements = js_malloc(ctx, sizeof(ffi_type *) * (arrSz + 1));
        js_ffi_type *jst = JS_GetOpaque(types[0], js_ffi_type_classid);
        for (unsigned i = 0; i < arrSz; i++) {
            elements[i] = jst->ffi_type;
        }
        elements[arrSz] = NULL;
    } else {
        elements = js_malloc(ctx, sizeof(ffi_type *) * (typeCnt + 1));
        for (unsigned i = 0; i < typeCnt; i++) {
            js_ffi_type *jst = JS_GetOpaque(types[i], js_ffi_type_classid);
            elements[i] = jst->ffi_type;
        }
        elements[typeCnt] = NULL;
    }

    js_ffi_type *structType = js_malloc(ctx, sizeof(js_ffi_type));
    structType->elemCount = typeCnt;
    structType->dynamic = true;
    structType->ffi_type = js_malloc(ctx, sizeof(ffi_type));
    structType->ffi_type->type = FFI_TYPE_STRUCT;
    structType->ffi_type->size = 0;
    structType->ffi_type->alignment = 0;
    if (arrSz) {
        structType->ffi_type->size = arrSz * ffi_type_get_sz(elements[0]);
        structType->ffi_type->alignment = elements[0]->alignment;
    }
    structType->ffi_type->elements = elements;

    if (arrSz == 0) {
        size_t *offsets = js_malloc(ctx, sizeof(size_t) * typeCnt);
        ffi_status st = ffi_get_struct_offsets(FFI_DEFAULT_ABI, structType->ffi_type, offsets);
        if (st != FFI_OK) {
            js_free(ctx, elements);
            js_free(ctx, structType->ffi_type);
            js_free(ctx, structType);
            js_free(ctx, offsets);
            JS_ThrowTypeError(ctx, "ffi_get_struct_offsets failed: %s", ffi_strerror(st));
            return JS_EXCEPTION;
        }

        JSValue arr = JS_NewArray(ctx);
        for (unsigned i = 0; i < typeCnt; i++) {
            JS_SetPropertyUint32(ctx, arr, i, JS_NewInt32(ctx, offsets[i]));
        }
        js_free(ctx, offsets);
        JS_SetPropertyStr(ctx, obj, "offsets", arr);
    }

    structType->deps = js_malloc(ctx, sizeof(JSValue) * typeCnt);
    for (unsigned i = 0; i < typeCnt; i++) {
        structType->deps[i] = JS_DupValue(ctx, types[i]);
    }

    JS_SetOpaque(obj, structType);
    return obj;
}

static JSValue ffi_type_create_existing(JSContext *ctx, ffi_type *exist, const char *name) {
    JSValue obj = JS_NewObjectClass(ctx, js_ffi_type_classid);
    if (JS_IsException(obj)) {
        return obj;
    }

    js_ffi_type *structType = js_malloc(ctx, sizeof(js_ffi_type));
    structType->elemCount = 0;
    structType->dynamic = false;
    structType->deps = NULL;
    structType->ffi_type = exist;

    JS_SetOpaque(obj, structType);
    JS_SetPropertyStr(ctx, obj, "_name", JS_NewString(ctx, name));

    return obj;
}

static void js_ffi_type_finalizer(JSRuntime *rt, JSValue val) {
    js_ffi_type *u = JS_GetOpaque(val, js_ffi_type_classid);
    if (u) {
        if (u->dynamic) {
            for (unsigned i = 0; i < u->elemCount; i++) {
                JS_FreeValueRT(rt, u->deps[i]);
            }
            if (u->deps != NULL) {
                js_free_rt(rt, u->deps);
            }
            if (u->ffi_type != NULL) {
                if (u->ffi_type->elements != NULL) {
                    js_free_rt(rt, u->ffi_type->elements);
                }
                js_free_rt(rt, u->ffi_type);
            }
        }
        js_free_rt(rt, u);
    }
}
static void js_ffi_type_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    js_ffi_type *u = JS_GetOpaque(val, js_ffi_type_classid);
    if (u) {
        for (unsigned i = 0; i < u->elemCount; i++) {
            JS_MarkValue(rt, u->deps[i], mark_func);
        }
    }
}
JSClassDef js_ffi_type_class = { "FfiType", .finalizer = js_ffi_type_finalizer, .gc_mark = js_ffi_type_mark };

static JSValue js_ffi_type_get_sz(JSContext *ctx, JSValueConst this_val) {
    js_ffi_type *type = JS_GetOpaque(this_val, js_ffi_type_classid);
    if (type == NULL) {
        JS_ThrowTypeError(ctx, "expected this to be FfiType");
        return JS_EXCEPTION;
    }
    return JS_NEW_SIZE_T(ctx, ffi_type_get_sz(type->ffi_type));
}

int ffi_type_to_buffer(JSContext *ctx, JSValueConst val, ffi_type *type, uint8_t *buf) {
    if (type->type == FFI_TYPE_STRUCT) {
        if (!JS_IsArray(ctx, val)) {
            JS_ThrowTypeError(ctx, "expected argument 1 to be array");
            return -1;
        }
        ffi_type **ptr = type->elements;
        unsigned i = 0;
        int sz = 0;
        size_t arrlen;
        JS_TO_SIZE_T(ctx, &arrlen, JS_GetPropertyStr(ctx, val, "length"));
        while (*ptr != NULL) {
            if (i > arrlen) {
                JS_ThrowRangeError(ctx, "array is too short");
                return -1;
            }
            int ret = ffi_type_to_buffer(ctx, JS_GetPropertyUint32(ctx, val, i), *ptr, buf);
            if (ret < 0) {
                return -1;
            } else {
                sz += ret;
                buf += ret;
            }
            ptr++;
            i++;
        }
        if (i < arrlen) {
            JS_ThrowRangeError(ctx, "array is too long");
            return -1;
        }
        return sz;
    } else {
        switch (type->type) {
            case FFI_TYPE_VOID:
                JS_ThrowTypeError(ctx, "cannot convert js val to void");
                return -1;
                break;
            case FFI_TYPE_INT:
                JS_TO_INT(ctx, (int *) buf, val);
                return sizeof(int);
            case FFI_TYPE_FLOAT: {
                double v;
                JS_ToFloat64(ctx, &v, val);
                *(float *) buf = v;
                return sizeof(float);
            }
            case FFI_TYPE_DOUBLE:
                JS_ToFloat64(ctx, (double *) buf, val);
                return sizeof(double);
#if FFI_TYPE_LONGDOUBLE != FFI_TYPE_DOUBLE
            case FFI_TYPE_LONGDOUBLE: {
                double v;
                JS_ToFloat64(ctx, &v, val);
                *(long double *) buf = v;
                return sizeof(long double);
            }
#endif
            case FFI_TYPE_UINT8: {
                uint32_t v;
                JS_ToUint32(ctx, &v, val);
                *(uint8_t *) buf = v;
                return sizeof(uint8_t);
            }
            case FFI_TYPE_SINT8: {
                int32_t v;
                JS_ToInt32(ctx, &v, val);
                *(int8_t *) buf = v;
                return sizeof(int8_t);
            }
            case FFI_TYPE_UINT16: {
                uint32_t v;
                JS_ToUint32(ctx, &v, val);
                *(uint16_t *) buf = v;
                return sizeof(uint16_t);
            }
            case FFI_TYPE_SINT16: {
                int32_t v;
                JS_ToInt32(ctx, &v, val);
                *(int16_t *) buf = v;
                return sizeof(int16_t);
            }
            case FFI_TYPE_UINT32:
                JS_ToUint32(ctx, (uint32_t *) buf, val);
                return sizeof(uint32_t);
            case FFI_TYPE_SINT32:
                JS_ToInt32(ctx, (int32_t *) buf, val);
                return sizeof(int32_t);
            case FFI_TYPE_STRUCT:
                fprintf(stderr, "js_ffi_type_val_to_buffer switch FFI_TYPE_STRUCT, should not happen!");
                abort();
                break;
            case FFI_TYPE_UINT64:
                JS_ToIndex(ctx, (uint64_t *) buf, val);
                return sizeof(uint64_t);
            case FFI_TYPE_SINT64:
                JS_ToInt64(ctx, (int64_t *) buf, val);
                return sizeof(int64_t);
                break;
            case FFI_TYPE_POINTER:
                if (JS_IsNull(val)) {
                    *(void **) buf = NULL;
                    return sizeof(void *);
                }
                uint64_t bla;
                JS_TO_UINTPTR_T(ctx, &bla, val);
                JS_TO_UINTPTR_T(ctx, (void *) buf, val);
                return sizeof(void *);
                break;
            case FFI_TYPE_COMPLEX:
                JS_ThrowTypeError(ctx, "FFI_TYPE_COMPLEX is not yet supported!");
                return -1;
                break;
            default:
                JS_ThrowInternalError(ctx, "FFI Unknown type %d", type->type);
                return -1;
        }
    }
}

static JSValue js_ffi_type_to_buffer(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    js_ffi_type *type = JS_GetOpaque(this_val, js_ffi_type_classid);
    if (type == NULL) {
        JS_ThrowTypeError(ctx, "expected this to be FfiType");
        return JS_EXCEPTION;
    }
    if (argc < 1) {
        JS_ThrowTypeError(ctx, "expected 1 argument");
        return JS_EXCEPTION;
    }
    size_t sz = ffi_type_get_sz(type->ffi_type);
    if (JS_IS_PTR(ctx, argv[0])) {
        uint64_t bla;
        JS_TO_UINTPTR_T(ctx, &bla, argv[0]);
    }
    uint8_t *buf = js_malloc(ctx, sz);
    uint8_t *buf2 = js_malloc(ctx, sz);
    int ret = ffi_type_to_buffer(ctx, argv[0], type->ffi_type, buf2);
    if (ret < 0) {
        js_free(ctx, buf2);
        return JS_EXCEPTION;
    }
    js_free(ctx, buf);
    return TJS_NewUint8Array(ctx, buf2, sz);
}

static int ffi_type_from_buffer(JSContext *ctx, ffi_type *type, uint8_t *buf, JSValue *val) {
    if (type->type == FFI_TYPE_STRUCT) {
        JS_ThrowInternalError(ctx, "converting buffer to js is not yet implemented for structs");
        return -1;
    } else {
        switch (type->type) {
            case FFI_TYPE_VOID:
                *val = JS_UNDEFINED;
                return 0;
                break;
            case FFI_TYPE_INT:
                *val = JS_NewInt32(ctx, *(int *) buf);  // TODO maybe check architecture;
                return sizeof(int);
            case FFI_TYPE_FLOAT:
                *val = JS_NewFloat64(ctx, (double) *(float *) buf);
                return sizeof(float);
            case FFI_TYPE_DOUBLE:
                *val = JS_NewFloat64(ctx, *(double *) buf);
                return sizeof(double);
#if FFI_TYPE_LONGDOUBLE != FFI_TYPE_DOUBLE
            case FFI_TYPE_LONGDOUBLE: {
                *val = JS_NewFloat64(ctx, *(long double *) buf);
                return sizeof(long double);
            }
#endif
            case FFI_TYPE_UINT8:
                *val = JS_NewInt32(ctx, *(uint8_t *) buf);
                return sizeof(uint8_t);
            case FFI_TYPE_SINT8:
                *val = JS_NewInt32(ctx, *(int8_t *) buf);
                return sizeof(int8_t);
            case FFI_TYPE_UINT16:
                *val = JS_NewInt32(ctx, *(uint16_t *) buf);
                return sizeof(uint16_t);
            case FFI_TYPE_SINT16:
                *val = JS_NewInt32(ctx, *(int16_t *) buf);
                return sizeof(int16_t);
            case FFI_TYPE_UINT32:
                *val = JS_NewInt64(ctx, *(uint32_t *) buf);
                return sizeof(uint32_t);
            case FFI_TYPE_SINT32:
                *val = JS_NewInt32(ctx, *(int32_t *) buf);
                return sizeof(int32_t);
            case FFI_TYPE_STRUCT:
                fprintf(stderr, "ffi_type_from_buffer switch FFI_TYPE_STRUCT, should not happen!");
                abort();
                break;
            case FFI_TYPE_UINT64:
                *val = JS_NewInt64(ctx, *(uint64_t *) buf);
                return sizeof(uint64_t);
            case FFI_TYPE_SINT64:
                *val = JS_NewInt64(ctx, *(int64_t *) buf);
                return sizeof(int64_t);
                break;
            case FFI_TYPE_POINTER:
                *val = JS_NEW_UINTPTR_T(ctx, *(void **) buf);
                return sizeof(void *);
                break;
            case FFI_TYPE_COMPLEX:
                JS_ThrowTypeError(ctx, "FFI_TYPE_COMPLEX is not yet supported!");
                return -1;
                break;
            default:
                JS_ThrowInternalError(ctx, "FFI Unknown type %d", type->type);
                return -1;
        }
        return type->size;
    }
}

static JSValue js_ffi_type_from_buffer(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    js_ffi_type *type = JS_GetOpaque(this_val, js_ffi_type_classid);
    if (type == NULL) {
        JS_ThrowTypeError(ctx, "expected this to be FfiType");
        return JS_EXCEPTION;
    }
    if (argc < 1) {
        JS_ThrowTypeError(ctx, "expected 1 argument");
        return JS_EXCEPTION;
    }
    size_t bufsz;
    uint8_t *buf = JS_GetUint8Array(ctx, &bufsz, argv[0]);
    if (!buf)
        return JS_EXCEPTION;
    size_t typesz = ffi_type_get_sz(type->ffi_type);
    if (bufsz != typesz) {
        JS_ThrowRangeError(ctx, "expected buffer to be of size %zu", typesz);
        return JS_EXCEPTION;
    }
    JSValue val = JS_UNDEFINED;
    int ret = ffi_type_from_buffer(ctx, type->ffi_type, buf, &val);
    if (ret < 0) {
        return JS_EXCEPTION;
    }
    return val;
}

static JSValue js_ffi_type_name(JSContext *ctx, JSValueConst this_val) {
    js_ffi_type *type = JS_GetOpaque(this_val, js_ffi_type_classid);
    if (type == NULL) {
        JS_ThrowTypeError(ctx, "expected this to be FfiType");
        return JS_EXCEPTION;
    }
    return JS_GetPropertyStr(ctx, this_val, "_name");
}

static JSCFunctionListEntry js_ffi_type_proto_funcs[] = {
    TJS_CFUNC_DEF("toBuffer", 1, js_ffi_type_to_buffer),
    TJS_CFUNC_DEF("fromBuffer", 1, js_ffi_type_from_buffer),
    TJS_CGETSET_DEF("name", js_ffi_type_name, NULL),
    TJS_CGETSET_DEF("size", js_ffi_type_get_sz, NULL),
};
#pragma endregion "FfiType class definition"

#pragma region "UvDlSym class definition"
// =======================================

static JSClassID js_uv_dlsym_classid;

JSClassDef js_uv_dlsym_class = {
    "UvDlSym",
};

static JSValue js_uv_dlsym_create(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    JS_ThrowReferenceError(ctx, "no constructor for UvDlSym available");
    return JS_EXCEPTION;
}

static JSValue js_uv_dlsym_get_addr(JSContext *ctx, JSValueConst this_val) {
    void *ptr = JS_GetOpaque(this_val, js_uv_dlsym_classid);
    if (ptr == NULL) {
        JS_ThrowTypeError(ctx, "expected this to be UvDlSym");
        return JS_EXCEPTION;
    }
    return JS_NEW_UINTPTR_T(ctx, ptr);
}
static JSCFunctionListEntry js_uv_dlsym_proto_funcs[] = {
    TJS_CGETSET_DEF("addr", js_uv_dlsym_get_addr, NULL),
};

#pragma endregion "UvDlSym class definition"

#pragma region "FfiCif class definition"
// ======================================

static JSClassID js_ffi_cif_classid;
typedef struct {
    ffi_cif ffi_cif;
    ffi_type **args;
    size_t depsCount;
    JSValue *deps;
} js_ffi_cif;

static JSValue js_ffi_cif_create(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    ssize_t nfixedargs = -1;
    size_t ntotalargs = argc - 1;
    if (JS_IsNumber(argv[argc - 1])) {
        if (JS_TO_SIZE_T(ctx, &nfixedargs, argv[argc - 1]) < 0) {
            JS_ThrowTypeError(ctx, "argument %d has to be positive integer", argc);
            return JS_EXCEPTION;
        }
        ntotalargs = argc - 2;
    } else if (JS_IsUndefined(argv[argc - 1])) {
        ntotalargs = argc - 2;
    }
    for (unsigned i = 0; i < ntotalargs + 1; i++) {
        ffi_type *t = JS_GetOpaque(argv[i], js_ffi_type_classid);
        if (t == NULL) {
            JS_ThrowTypeError(ctx, "argument %d is not a FfiType", i + 1);
            return JS_EXCEPTION;
        }
    }

    JSValue obj = JS_NewObjectClass(ctx, js_ffi_cif_classid);
    if (JS_IsException(obj)) {
        return obj;
    }

    JS_SetPropertyStr(ctx, obj, "vla", JS_NewInt32(ctx, 0));

    js_ffi_cif *js_cif = js_malloc(ctx, sizeof(js_ffi_cif));
    js_cif->args = NULL;
    if (ntotalargs > 0) {
        js_cif->args = js_malloc(ctx, sizeof(ffi_type *) * (ntotalargs));
    }
    js_cif->deps = js_malloc(ctx, sizeof(JSValue) * (ntotalargs + 1));
    js_cif->depsCount = ntotalargs + 1;
    ffi_type *retType;

    if (argc > 0) {
        js_ffi_type *jst = JS_GetOpaque(argv[0], js_ffi_type_classid);
        retType = jst->ffi_type;
    } else {
        retType = &ffi_type_void;
    }

    for (unsigned i = 0; i < js_cif->depsCount; i++) {
        js_cif->deps[i] = JS_DupValue(ctx, argv[i]);
    }

    for (unsigned i = 1; i < ntotalargs + 1; i++) {
        js_ffi_type *jst = JS_GetOpaque(argv[i], js_ffi_type_classid);
        js_cif->args[i - 1] = jst->ffi_type;
    }

    ffi_status ret;
    if (nfixedargs > -1) {
        ret = ffi_prep_cif_var(&js_cif->ffi_cif, FFI_DEFAULT_ABI, nfixedargs, ntotalargs, retType, js_cif->args);
    } else {
        ret = ffi_prep_cif(&js_cif->ffi_cif, FFI_DEFAULT_ABI, ntotalargs, retType, js_cif->args);
    }
    if (ret != FFI_OK) {
        js_free(ctx, js_cif->args);
        js_free(ctx, js_cif);
        JS_FreeValue(ctx, obj);
        JS_ThrowInternalError(ctx, "internal error creating cif: %s", ffi_strerror(ret));
        return JS_EXCEPTION;
    }
    JS_SetOpaque(obj, js_cif);
    return obj;
}

static void js_ffi_cif_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    js_ffi_cif *u = JS_GetOpaque(val, js_ffi_cif_classid);
    if (u) {
        for (unsigned i = 0; i < u->depsCount; i++) {
            JS_MarkValue(rt, u->deps[i], mark_func);
        }
    }
}

static void js_ffi_cif_finalizer(JSRuntime *rt, JSValue val) {
    js_ffi_cif *u = JS_GetOpaque(val, js_ffi_cif_classid);
    if (u) {
        for (unsigned i = 0; i < u->depsCount; i++) {
            JS_FreeValueRT(rt, u->deps[i]);
        }
        js_free_rt(rt, u->deps);
        if (u->args) {
            js_free_rt(rt, u->args);
        }
        js_free_rt(rt, u);
    }
}

JSClassDef js_ffi_cif_class = { "FfiCif", .finalizer = js_ffi_cif_finalizer, .gc_mark = js_ffi_cif_mark };

static JSValue js_ffi_cif_call(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    js_ffi_cif *cif = JS_GetOpaque(this_val, js_ffi_cif_classid);
    if (!cif) {
        JS_ThrowTypeError(ctx, "this must be FfiCif");
        return JS_EXCEPTION;
    }
    void *func;
    if (argc <= 0 || (func = JS_GetOpaque(argv[0], js_uv_dlsym_classid)) == NULL) {
        JS_ThrowTypeError(ctx, "argument 1 must be UvDlsym");
        return JS_EXCEPTION;
    }

    unsigned ffi_arg_cnt = argc - 1;
    JSValueConst *func_argv = &argv[1];
    if (ffi_arg_cnt != cif->ffi_cif.nargs) {
        JS_ThrowRangeError(ctx, "expected %d arguments but got %d", cif->ffi_cif.nargs, ffi_arg_cnt);
        return JS_EXCEPTION;
    }

    void **aval = NULL;
    if (ffi_arg_cnt > 0)
        aval = js_malloc(ctx, ffi_arg_cnt * sizeof(void *) * 2);
    for (unsigned i = 0; i < ffi_arg_cnt; i++) {
        void *ptr;
        if (JS_IS_PTR(ctx, func_argv[i])) {
            ptr = &aval[ffi_arg_cnt + i];
            JS_TO_UINTPTR_T(ctx, ptr, func_argv[i]);
        } else {
            size_t sz;
            ptr = JS_GetUint8Array(ctx, &sz, func_argv[i]);
            if (ptr == NULL) {
                js_free(ctx, aval);
                JS_ThrowTypeError(ctx, "argument %d expected to be ptr or buffer", i + 1);
                return JS_EXCEPTION;
            }
        }
        aval[i] = ptr;
    }

    size_t retsz = ffi_type_get_sz(cif->ffi_cif.rtype);
    void *rptr = js_malloc(ctx, retsz);

    ffi_call(&cif->ffi_cif, func, rptr, aval);
    if (aval != NULL)
        js_free(ctx, aval);
    return TJS_NewUint8Array(ctx, rptr, retsz);
}
static JSCFunctionListEntry js_ffi_cif_proto_funcs[] = {
    TJS_CFUNC_DEF("call", 1, js_ffi_cif_call),
};

#pragma endregion "FfiCif class definition"

#pragma region "UvLib class definition"
// =====================================

static JSClassID js_uv_lib_classid;
static JSValue js_uv_lib_create(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJS_CHECK_ARG_RET(ctx, JS_IsString(argv[0]), 0, "string");
    JSValue obj = JS_NewObjectClass(ctx, js_uv_lib_classid);
    if (JS_IsException(obj)) {
        return obj;
    }
    const char *dlname = JS_ToCString(ctx, argv[0]);
    uv_lib_t *lib = js_malloc(ctx, sizeof(uv_lib_t));
    int ret = uv_dlopen(dlname, lib);
    JS_FreeCString(ctx, dlname);
    if (ret != 0) {
        JS_ThrowInternalError(ctx, "uv_dlopen failed: %s", uv_dlerror(lib));
        js_free(ctx, lib);
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }
    JS_SetOpaque(obj, lib);
    return obj;
}

static void js_uv_lib_finalizer(JSRuntime *rt, JSValue val) {
    uv_lib_t *u = JS_GetOpaque(val, js_uv_lib_classid);
    if (u) {
        uv_dlclose(u);
        js_free_rt(rt, u);
    }
}

static JSValue js_uv_lib_dlsym(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJS_CHECK_ARG_RET(ctx, JS_IsString(argv[0]), 0, "string");

    uv_lib_t *lib = JS_GetOpaque(this_val, js_uv_lib_classid);
    if (lib == NULL) {
        JS_ThrowTypeError(ctx, "this needs to be instance of UvLib");
        return JS_EXCEPTION;
    }

    JSValue obj = JS_NewObjectClass(ctx, js_uv_dlsym_classid);
    if (JS_IsException(obj)) {
        return obj;
    }

    const char *sym = JS_ToCString(ctx, argv[0]);
    void *ptr;
    int ret = uv_dlsym(lib, sym, &ptr);
    JS_FreeCString(ctx, sym);
    if (ret != 0) {
        JS_ThrowInternalError(ctx, "uv_dlsym failed: %s", uv_dlerror(lib));
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    JS_SetOpaque(obj, ptr);
    return obj;
}

JSClassDef js_uv_lib_class = {
    "UvLib",
    .finalizer = js_uv_lib_finalizer,
};
static JSCFunctionListEntry js_uv_lib_proto_funcs[] = {
    TJS_CFUNC_DEF("symbol", 1, js_uv_lib_dlsym),
};
#pragma endregion "UvLib class definition"

#pragma region "Libc helpers"
// ===========================

static JSValue js_libc_errno(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    if (argc != 0) {
        JS_ThrowTypeError(ctx, "expected 0 arguments");
        return JS_EXCEPTION;
    }
    return JS_NEW_INT(ctx, errno);
}

static JSValue js_libc_strerror(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJS_CHECK_ARG_RET(ctx, JS_IsNumber(argv[0]), 0, "number");
    int err;
    JS_TO_INT(ctx, &err, argv[0]);
    return JS_NewString(ctx, strerror(err));
}
#pragma endregion "Libc helpers"

#pragma region "other helpers"
// ============================

static JSValue js_array_buffer_get_ptr(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    if (argc <= 0) {
        JS_ThrowTypeError(ctx, "expected argument 1 to be ArrayBuffer");
        return JS_EXCEPTION;
    }
    size_t size;
    uint8_t *buf = JS_GetUint8Array(ctx, &size, argv[0]);
    if (!buf)
        return JS_EXCEPTION;
    return JS_NEW_UINTPTR_T(ctx, (uint64_t) buf);
}

static JSValue js_get_cstring(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    if (argc == 0 || argc >= 2) {
        TJS_CHECK_ARG_RET(ctx, JS_IS_PTR(ctx, argv[0]), 0, "pointer");
        TJS_CHECK_ARG_RET(ctx, JS_IsNumber(argv[1]), 1, "number");
    } else {
        TJS_CHECK_ARG_RET(ctx, JS_IS_PTR(ctx, argv[0]), 0, "pointer");
    }
    size_t max = 0;
    if (argc == 2 && JS_IsNumber(argv[1])) {
        if (JS_TO_SIZE_T(ctx, &max, argv[1])) {
            JS_ThrowTypeError(ctx, "expected argument 2 to be a positive integer");
            return JS_EXCEPTION;
        }
    }
    char *ptr;
    JS_TO_UINTPTR_T(ctx, &ptr, argv[0]);
    if (max == 0) {
        return JS_NewString(ctx, ptr);
    }
    size_t len = strnlen(ptr, max);
    return JS_NewStringLen(ctx, ptr, len);
}


static JSValue JS_NewUint8ArrayShared(JSContext *ctx, uint8_t *data, size_t size) {
    JSValue abuf = JS_NewArrayBuffer(ctx, data, size, NULL, NULL, true);
    if (JS_IsException(abuf))
        return abuf;
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);
    JSValue buf = JS_CallConstructor(ctx, qrt->builtins.u8array_ctor, 1, &abuf);
    JS_FreeValue(ctx, abuf);
    return buf;
}

static JSValue js_ptr_to_buffer(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJS_CHECK_ARG_RET(ctx, JS_IS_PTR(ctx, argv[0]), 0, "pointer");
    TJS_CHECK_ARG_RET(ctx, JS_IsNumber(argv[1]), 1, "number");
    uint8_t *ptr;
    JS_TO_UINTPTR_T(ctx, &ptr, argv[0]);
    size_t sz;
    JS_TO_SIZE_T(ctx, &sz, argv[1]);
    return JS_NewUint8ArrayShared(ctx, ptr, sz);
}

static JSValue js_deref_ptr(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    unsigned times = 1;
    if (argc <= 0 || !JS_IS_PTR(ctx, argv[0])) {
        JS_ThrowTypeError(ctx, "expected argument 1 to be pointer");
        return JS_EXCEPTION;
    }
    if (argc == 2) {
        if (JS_ToUint32(ctx, &times, argv[1])) {
            JS_ThrowTypeError(ctx, "expected argument 2 to be integer");
            return JS_EXCEPTION;
        }
    }
    void *ptr;
    JS_TO_UINTPTR_T(ctx, &ptr, argv[0]);
    for (unsigned i = 0; i < times; i++) {
        ptr = *(void **) ptr;
    }
    return JS_NEW_UINTPTR_T(ctx, ptr);
}

#if defined(_WIN32)
#define LIBC_NAME "msvcrt.dll"
#define LIBM_NAME "msvcrt.dll"
#elif defined(__APPLE__)
#define LIBC_NAME "libSystem.dylib"
#define LIBM_NAME "libSystem.dylib"
#elif defined(__GLIBC__)
#include <gnu/lib-names.h>
#define LIBC_NAME LIBC_SO
#define LIBM_NAME LIBM_SO
#elif defined(__linux__)
#define LIBC_NAME "libc.so"
#define LIBM_NAME "libm.so"
#else
#error('unknown os')
#endif

#pragma endregion "other helpers"

#pragma region "FfiClosure class definition"

// ======================================

static JSClassID js_ffi_closure_classid;
typedef struct {
    ffi_closure closure;
    void *code;
    JSValue cif;
    JSValue func;
    JSContext *ctx;
} js_ffi_closure;

void js_ffi_closure_invoke(ffi_cif *cif, void *ret, void **args, void *userptr) {
    js_ffi_closure *jscl = (js_ffi_closure *) userptr;
    JSContext *ctx = jscl->ctx;
    JSValueConst *jsargs = js_malloc(ctx, sizeof(JSValue) * cif->nargs);

    for (unsigned i = 0; i < cif->nargs; i++) {
        jsargs[i] = JS_NewUint8ArrayShared(ctx, args[i], ffi_type_get_sz(cif->arg_types[i]));
    }
    JSValue jsret = JS_Call(ctx, jscl->func, JS_UNDEFINED, cif->nargs, jsargs);
    for (unsigned i = 0; i < cif->nargs; i++) {
        JS_FreeValue(ctx, jsargs[i]);
    }
    js_free(ctx, jsargs);
    if (JS_IsException(jsret)) {
        fprintf(stderr, "js_ffi_closure_invoke: function returned exception\n");
        tjs_dump_error(ctx);
        abort();
    }
    size_t sz;
    uint8_t *buf = JS_GetUint8Array(ctx, &sz, jsret);
    if (buf == NULL) {
        fprintf(stderr, "js_ffi_closure_invoke: function returned non-buffer\n");
        tjs_dump_error(ctx);
        abort();
    }
    memcpy(ret, buf, sz);
    JS_FreeValue(ctx, jsret);
}

static JSValue js_ffi_closure_create(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJS_CHECK_ARG_RET(ctx, JS_IsObject(argv[0]), 0, "object");
    TJS_CHECK_ARG_RET(ctx, JS_IsFunction(ctx, argv[1]), 1, "function");

    js_ffi_cif *cif = JS_GetOpaque(argv[0], js_ffi_cif_classid);
    if (!cif) {
        JS_ThrowTypeError(ctx, "argument 1 is expected to be FfiCif");
        return JS_EXCEPTION;
    }

    JSValue obj = JS_NewObjectClass(ctx, js_ffi_closure_classid);
    if (JS_IsException(obj)) {
        return obj;
    }

    void *code;
    js_ffi_closure *jscl = ffi_closure_alloc(sizeof(js_ffi_closure), &code);
    jscl->code = code;
    ffi_status ret = ffi_prep_closure_loc(&jscl->closure, &cif->ffi_cif, js_ffi_closure_invoke, jscl, jscl->code);
    if (ret != FFI_OK) {
        ffi_closure_free(jscl);
        JS_ThrowTypeError(ctx, "failed to prepare closure");
        return JS_EXCEPTION;
    }

    jscl->cif = JS_DupValue(ctx, argv[0]);
    jscl->func = JS_DupValue(ctx, argv[1]);
    jscl->ctx = ctx;

    JS_SetOpaque(obj, jscl);
    return obj;
}

static void js_ffi_closure_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    js_ffi_closure *u = JS_GetOpaque(val, js_ffi_closure_classid);
    if (u) {
        JS_MarkValue(rt, u->cif, mark_func);
        JS_MarkValue(rt, u->func, mark_func);
    }
}

static void js_ffi_closure_finalizer(JSRuntime *rt, JSValue val) {
    js_ffi_closure *u = JS_GetOpaque(val, js_ffi_closure_classid);
    if (u) {
        JS_FreeValueRT(rt, u->cif);
        JS_FreeValueRT(rt, u->func);
        ffi_closure_free(u);
    }
}

JSClassDef js_ffi_closure_class = { "FfiClosure",
                                    .finalizer = js_ffi_closure_finalizer,
                                    .gc_mark = js_ffi_closure_mark };

static JSValue js_ffi_closure_get_addr(JSContext *ctx, JSValueConst this_val) {
    js_ffi_closure *ptr = JS_GetOpaque(this_val, js_ffi_closure_classid);
    if (ptr == NULL) {
        JS_ThrowTypeError(ctx, "expected this to be FfiClosure");
        return JS_EXCEPTION;
    }
    return JS_NEW_UINTPTR_T(ctx, ptr->code);
}
static JSCFunctionListEntry js_ffi_closure_proto_funcs[] = {
    TJS_CGETSET_DEF("addr", js_ffi_closure_get_addr, NULL),
};


#pragma endregion "FfiClosure class definition"

static JSCFunctionListEntry funcs[] = {
    // basic functions from libc
    TJS_CFUNC_DEF("errno", 0, js_libc_errno),
    TJS_CFUNC_DEF("strerror", 1, js_libc_strerror),

    // other helpers
    TJS_CFUNC_DEF("getArrayBufPtr", 1, js_array_buffer_get_ptr),
    TJS_CFUNC_DEF("getCString", 1, js_get_cstring),
    TJS_CFUNC_DEF("derefPtr", 2, js_deref_ptr),
    TJS_CFUNC_DEF("ptrToBuffer", 2, js_ptr_to_buffer),

    TJS_CONST_STRING_DEF(LIBC_NAME),
    TJS_CONST_STRING_DEF(LIBM_NAME),
};

#define REGISTER_CLASS(ctx, name)                                                                                      \
    JS_NewClassID(&name##_classid);                                                                                    \
    JS_NewClass(JS_GetRuntime(ctx), name##_classid, &name##_class);                                                    \
    JSValue name##_proto = JS_NewObject(ctx);                                                                          \
    JS_SetPropertyFunctionList(ctx, name##_proto, name##_proto_funcs, countof(name##_proto_funcs));                    \
    JS_SetClassProto(ctx, name##_classid, name##_proto);

#define CLASS_CREATE_CONSTRUCTOR(ctx, name, ns, constructor)                                                           \
    JSValue name##_constructor =                                                                                       \
        JS_NewCFunction2(ctx, constructor, name##_class.class_name, 1, JS_CFUNC_constructor, 0);                       \
    JS_DefinePropertyValueStr(ctx,                                                                                     \
                              ns,                                                                                      \
                              name##_class.class_name,                                                                 \
                              name##_constructor,                                                                      \
                              JS_PROP_CONFIGURABLE | JS_PROP_WRITABLE | JS_PROP_ENUMERABLE);


#define ADD_SIMPLE_TYPE(ctx, obj, name)                                                                                \
    JSValue name##_jsval = ffi_type_create_existing(ctx, &ffi_##name, #name);                                          \
    JS_SetPropertyStr(ctx, obj, #name, name##_jsval)
#define ADD_ALIAS_TYPE(ctx, obj, alias, oldname) JS_SetPropertyStr(ctx, obj, #alias, JS_DupValue(ctx, oldname##_jsval))

void tjs__mod_ffi_init(JSContext *ctx, JSValue ns) {
    JSValue ffiobj = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, ffiobj, funcs, countof(funcs));
    JS_SetPropertyStr(ctx, ns, "ffi", ffiobj);

    REGISTER_CLASS(ctx, js_ffi_type);
    CLASS_CREATE_CONSTRUCTOR(ctx, js_ffi_type, ffiobj, js_ffi_type_create_struct);

    REGISTER_CLASS(ctx, js_uv_dlsym);
    CLASS_CREATE_CONSTRUCTOR(ctx, js_uv_dlsym, ffiobj, js_uv_dlsym_create);

    REGISTER_CLASS(ctx, js_ffi_cif);
    CLASS_CREATE_CONSTRUCTOR(ctx, js_ffi_cif, ffiobj, js_ffi_cif_create);

    REGISTER_CLASS(ctx, js_uv_lib);
    CLASS_CREATE_CONSTRUCTOR(ctx, js_uv_lib, ffiobj, js_uv_lib_create);

    REGISTER_CLASS(ctx, js_ffi_closure);
    CLASS_CREATE_CONSTRUCTOR(ctx, js_ffi_closure, ffiobj, js_ffi_closure_create);


    ADD_SIMPLE_TYPE(ctx, ffiobj, type_void);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_uint8);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_sint8);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_uint16);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_sint16);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_uint32);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_sint32);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_uint64);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_sint64);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_float);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_double);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_pointer);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_longdouble);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_uchar);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_schar);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_ushort);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_sshort);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_uint);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_sint);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_ulong);
    ADD_SIMPLE_TYPE(ctx, ffiobj, type_slong);

#if SIZE_MAX == UINT32_MAX
    ADD_ALIAS_TYPE(ctx, ffiobj, type_size, type_uint32);
    ADD_ALIAS_TYPE(ctx, ffiobj, type_ssize, type_sint32);
#else
    ADD_ALIAS_TYPE(ctx, ffiobj, type_size, type_uint64);
    ADD_ALIAS_TYPE(ctx, ffiobj, type_ssize, type_sint64);
#endif

    // ffi also supports some complex types, currently not implemented
}

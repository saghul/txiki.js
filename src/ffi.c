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

#define C_MACRO_STRING_DEF(x) JS_PROP_STRING_DEF(#x, x, JS_PROP_CONFIGURABLE)

#if UINTPTR_MAX == UINT32_MAX
#define JS_TO_UINTPTR_T(ctx, pres, val) {uint64_t v; JS_ToBigInt64(ctx, &v, val); *(uint32_t *)(pres) = (uint32_t)v;}
#define JS_NEW_UINTPTR_T(ctx, val) JS_NewBigUInt64(ctx, (int32_t)(val))
#define C_MACRO_UINTPTR_T_DEF(x) JS_PROP_INT32_DEF(#x, (int32_t)(x), JS_PROP_CONFIGURABLE)
#define C_VAR_ADDRESS_DEF(x) JS_PROP_INT32_DEF(#x, (int32_t)(&x), JS_PROP_CONFIGURABLE)
#define ffi_type_intptr_t ffi_type_sint32
#define ffi_type_uintptr_t ffi_type_uint32
#elif UINTPTR_MAX == UINT64_MAX
#define JS_TO_UINTPTR_T(ctx, pres, val) JS_ToBigInt64(ctx, (int64_t *)(pres), val)
#define JS_NEW_UINTPTR_T(ctx, val) JS_NewBigInt64(ctx, (int64_t)(val))
#define C_MACRO_UINTPTR_T_DEF(x) JS_PROP_INT64_DEF(#x, (int64_t)(x), JS_PROP_CONFIGURABLE)
#define C_VAR_ADDRESS_DEF(x) JS_PROP_INT64_DEF(#x, (int64_t)(&x), JS_PROP_CONFIGURABLE)
#define ffi_type_intptr_t ffi_type_sint64
#define ffi_type_uintptr_t ffi_type_uint64
#else
#error "'uintptr_t' neither 32bit nor 64 bit, I don't know how to handle it."
#endif

#define STR(x) #x
#if SIZE_MAX == UINT32_MAX
#define JS_TO_SIZE_T(ctx, pres, val) JS_ToInt32(ctx, (int32_t *)(pres), val)
#define JS_NEW_SIZE_T(ctx, val) JS_NewInt32(ctx, (int32_t)(val))
#define JS_PROP_SIZE_T_DEF(name, val) JS_PROP_INT32_DEF(name, (int32_t)(val), JS_PROP_CONFIGURABLE)
#define C_SIZEOF_DEF(x) JS_PROP_INT32_DEF(STR(sizeof_##x), (int32_t)(sizeof(x)), JS_PROP_CONFIGURABLE)
#define ffi_type_size_t ffi_type_uint32
#elif SIZE_MAX == UINT64_MAX
#define JS_TO_SIZE_T(ctx, pres, val) JS_ToInt64(ctx, (int64_t *)(pres), val)
#define JS_NEW_SIZE_T(ctx, val) JS_NewInt64(ctx, (int64_t)(val))
#define JS_PROP_SIZE_T_DEF(name, val) JS_PROP_INT64_DEF(name, (int64_t)(val), JS_PROP_CONFIGURABLE)
#define C_SIZEOF_DEF(x) JS_PROP_INT64_DEF(STR(sizeof_##x), (int64_t)(sizeof(x)), JS_PROP_CONFIGURABLE)
#define C_OFFSETOF_DEF(t, d) JS_PROP_INT64_DEF(STR(offsetof_##t##_##d), (int64_t)(offsetof(t, d)), JS_PROP_CONFIGURABLE)
#define ffi_type_size_t ffi_type_sint32
#else
#error "'size_t' neither 32bit nor 64 bit, I don't know how to handle it."
#endif

#if INT_MAX == INT32_MAX
#define C_MACRO_INT_DEF(x) JS_PROP_INT32_DEF(#x, (int32_t)(x), JS_PROP_CONFIGURABLE)
#define C_ENUM_DEF(x) JS_PROP_INT32_DEF(#x, (int32_t)(x), JS_PROP_CONFIGURABLE)
#define JS_TO_INT(ctx, pres, val) JS_ToInt32(ctx, (int32_t *)(pres), val)
#define JS_NEW_INT(ctx, val) JS_NewInt32(ctx, (int32_t)(val))
#elif INT_MAX == INT64_MAX
#define C_MACRO_INT_DEF(x) JS_PROP_INT64_DEF(#x, (int64_t)(x), JS_PROP_CONFIGURABLE)
#define C_ENUM_DEF(x) JS_PROP_INT64_DEF(#x, (int64_t)(x), JS_PROP_CONFIGURABLE)
#define JS_TO_INT(ctx, pres, val) JS_ToInt64(ctx, (int64_t *)(pres), val)
#define JS_NEW_INT(ctx, val) JS_NewInt64(ctx, (int64_t)(val))
#else
#error "'int' neither 32bit nor 64 bit, I don't know how to handle it."
#endif

#define FFI_ALIGN(v, a)  (((((size_t) (v))-1) | ((a)-1))+1)


#pragma region "CheckArgs helper"
// ===================

enum argtype {
    t_null,
    t_bool,
    t_number,
    t_bigint,
    t_string,
    t_string_or_null,
    t_function,
    t_any
};

static bool check_args(JSContext *ctx, int argc, JSValueConst *argv, enum argtype argtype_list[], int argtype_count) {
    if (argc != argtype_count) {
        JS_ThrowTypeError(ctx, "argc must be %d, got %d", argtype_count, argc);
        return false;
    }
    for (int i = 0; i < argtype_count; i++) {
        switch (argtype_list[i]) {
            case t_null:
                if (!JS_IsNull(argv[i])) {
                    JS_ThrowTypeError(ctx, "argv[%d] must be null", i);
                    return false;
                }
                break;
            case t_bool:
                if (!JS_IsBool(argv[i])) {
                    JS_ThrowTypeError(ctx, "argv[%d] must be boolean", i);
                    return false;
                }
                break;
            case t_number:
                if (!JS_IsNumber(argv[i])) {
                    JS_ThrowTypeError(ctx, "argv[%d] must be number", i);
                    return false;
                }
                break;
            case t_bigint:
                if (!JS_IsBigInt(ctx, argv[i])) {
                    JS_ThrowTypeError(ctx, "argv[%d] must be a bigint", i);
                    return false;
                }
                break;
            case t_string:
                if (!JS_IsString(argv[i])) {
                    JS_ThrowTypeError(ctx, "argv[%d] must be string", i);
                    return false;
                }
                break;
            case t_string_or_null:
                if (!(JS_IsString(argv[i]) || JS_IsNull(argv[i]))) {
                    JS_ThrowTypeError(ctx, "argv[%d] must be string or null", i);
                    return false;
                }
                break;
            case t_function:
                if (!JS_IsFunction(ctx, argv[i])) {
                    JS_ThrowTypeError(ctx, "argv[%d] must be function", i);
                    return false;
                }
                break;
            case t_any:
                return true;
                break;
            default:
                JS_ThrowTypeError(ctx, "argv[%d] type definition is not yet supported", i);
                return false;
        }
    }
    return true;
}

#define CHECK_ARGS(ctx, argc, argv, tlist)                       \
    if (!check_args(ctx, argc, argv, (tlist), countof(tlist))) { \
        return JS_EXCEPTION;                                     \
    }
#pragma endregion "CheckArgs helper"

#pragma region "FFI Helpers"
// ===================

static const char* ffi_strerror(ffi_status status){
    switch(status){
        case FFI_OK:
            return "FFI_OK";
        case FFI_BAD_TYPEDEF:
            return "FFI_BAD_TYPEDEF";
        case FFI_BAD_ABI:
            return "FFI_BAD_ABI";
        case FFI_BAD_ARGTYPE:
            return "FFI_BAD_ARGTYPE";
    }
}
#pragma endregion "FFI Helpers"

#pragma region "FfiType class definition"
// =======================================
typedef struct {
    size_t elemCount;
    JSValue* deps;
    bool dynamic;
    ffi_type* ffi_type;
} js_ffi_type;

static JSClassID js_ffi_type_classid;
static JSValue js_ffi_type_create_struct(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    for(unsigned i=0;i<argc;i++){
        ffi_type* t = JS_GetOpaque(argv[i], js_ffi_type_classid);
        if(t == NULL){
            JS_ThrowTypeError(ctx, "argument %d is not a FfiType", i+1);
            return JS_EXCEPTION;
        }
    }

    JSValue obj = JS_NewObjectClass(ctx, js_ffi_type_classid);
    if (JS_IsException(obj)){
        return obj;
    }

    ffi_type** elements = js_malloc(ctx, sizeof(ffi_type*) * (argc+1));
    for(unsigned i=0;i<argc;i++){
        ffi_type* t = JS_GetOpaque(argv[i], js_ffi_type_classid);
        elements[i] = t;
    }
    elements[argc] = NULL;
    js_ffi_type* structType = js_malloc(ctx, sizeof(js_ffi_type));
    structType->elemCount = argc;
    structType->dynamic = true;
    structType->ffi_type = js_malloc(ctx, sizeof(ffi_type));
    structType->ffi_type->type = FFI_TYPE_STRUCT;
    structType->ffi_type->size = 0;
    structType->ffi_type->alignment = 0;
    structType->ffi_type->elements = elements;
    structType->deps = js_malloc(ctx, sizeof(JSValue) * argc);

    structType->deps = js_malloc(ctx, sizeof(JSValue) * argc);
    for(unsigned i=0;i<argc;i++){
        structType->deps[i] = JS_DupValue(ctx, argv[i]);
    }

    JS_SetOpaque(obj, structType);
    return obj;
}

static JSValue ffi_type_create_existing(JSContext *ctx, ffi_type* exist, const char* name){
    JSValue obj = JS_NewObjectClass(ctx, js_ffi_type_classid);
    if (JS_IsException(obj)){
        return obj;
    }

    js_ffi_type* structType = js_malloc(ctx, sizeof(js_ffi_type));
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
        if(u->dynamic){
            if(u->deps != NULL){
                js_free_rt(rt, u->deps);
            }
            if(u->ffi_type != NULL){
                if(u->ffi_type->elements != NULL){
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
        for(unsigned i=0;i<u->elemCount;i++){
            JS_MarkValue(rt, u->deps[i], mark_func);
        }
    }
}
JSClassDef js_ffi_type_class = {
    "FfiType",
    .finalizer = js_ffi_type_finalizer,
    .gc_mark = js_ffi_type_mark
};

size_t ffi_type_get_sz(ffi_type* type){
    if(type->type == FFI_TYPE_STRUCT){
        size_t sz = 0;
        unsigned i = 0;
        while(type->elements[i] != NULL){
            sz += FFI_ALIGN(ffi_type_get_sz(type->elements[i]), type->alignment);
            i++;
        }
        return sz;
    }else{
        return type->size;
    }
}

static JSValue js_ffi_type_get_sz(JSContext *ctx, JSValueConst this_val) {
    js_ffi_type *type = JS_GetOpaque(this_val, js_ffi_type_classid);
    if(type == NULL){
        JS_ThrowTypeError(ctx, "expected this to be FfiType");
        return JS_EXCEPTION;
    }
    return JS_NEW_SIZE_T(ctx, ffi_type_get_sz(type->ffi_type));
}
static JSValue js_ffi_type_alloc(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    js_ffi_type *type = JS_GetOpaque(this_val, js_ffi_type_classid);
    if(type == NULL){
        JS_ThrowTypeError(ctx, "expected this to be FfiType");
        return JS_EXCEPTION;
    }
    if(argc > 1){
        JS_ThrowTypeError(ctx, "expected 0 or 1 arguments");
        return JS_EXCEPTION;
    }
    unsigned times = 1;
    if(argc == 1){
        if(JS_ToInt32(ctx, &times, argv[0])){
            JS_ThrowTypeError(ctx, "expected argument 1 to be integer");
            return JS_EXCEPTION;
        }
    }
    size_t sz = ffi_type_get_sz(type->ffi_type) * times;
    JSValue arr = TJS_NewUint8Array(ctx, js_malloc(ctx, sz), sz);
    return arr;
}

int ffi_type_to_buffer(JSContext *ctx, JSValueConst val, ffi_type* type, uint8_t* buf){
    if(type->type == FFI_TYPE_STRUCT){
        if(!JS_IsArray(ctx, val)){
            JS_ThrowTypeError(ctx, "expected argument 1 to be array");
            return -1;
        }
        ffi_type** ptr = type->elements;
        unsigned i = 0;
        int sz = 0;
        size_t arrlen;
        JS_TO_SIZE_T(ctx, &arrlen, JS_GetPropertyStr(ctx, val, "length"));
        while(*ptr != NULL){
            if(i > arrlen){
                JS_ThrowRangeError(ctx, "array is too short");
                return -1;
            }
            int ret = ffi_type_to_buffer(ctx, JS_GetPropertyUint32(ctx, val, i), *ptr, buf);
            if(ret < 0){
                return -1;
            }else{
                sz += ret;
                buf += ret;
            }
            ptr++;
            i++;
        }
        if(i < arrlen){
            JS_ThrowRangeError(ctx, "array is too long");
            return -1;
        }
        return sz;
    }else{
        switch(type->type){
            case FFI_TYPE_VOID:
                JS_ThrowTypeError(ctx, "cannot convert js val to void");
                return -1;
            break;
            case FFI_TYPE_INT:
                JS_TO_INT(ctx, (int*)buf, val);
                return sizeof(int);
            case FFI_TYPE_FLOAT:{
                double v;
                JS_ToFloat64(ctx, &v, val);
                *(float*)buf = v;
                return sizeof(float);
            }
            case FFI_TYPE_DOUBLE:
                JS_ToFloat64(ctx, (double*)buf, val);
                return sizeof(double);
            case FFI_TYPE_LONGDOUBLE:{
                double v;
                JS_ToFloat64(ctx, &v, val);
                *(long double*)buf = v;
                return sizeof(long double);
            }
            case FFI_TYPE_UINT8:{
                uint32_t v;
                JS_ToUint32(ctx, &v, val);
                *(uint8_t*)buf = v;
                return sizeof(uint8_t);
            }
            case FFI_TYPE_SINT8:{
                int32_t v;
                JS_ToInt32(ctx, &v, val);
                *(int8_t*)buf = v;
                return sizeof(int8_t);
            }
            case FFI_TYPE_UINT16:{
                uint32_t v;
                JS_ToInt32(ctx, &v, val);
                *(uint16_t*)buf = v;
                return sizeof(uint16_t);
            }
            case FFI_TYPE_SINT16:{
                uint32_t v;
                JS_ToInt32(ctx, &v, val);
                *(int16_t*)buf = v;
                return sizeof(int16_t);
            }
            case FFI_TYPE_UINT32:
                JS_ToUint32(ctx, (uint32_t*)buf, val);
                return sizeof(uint32_t);
            case FFI_TYPE_SINT32:
                JS_ToInt32(ctx, (int32_t*)buf, val);
                return sizeof(int32_t);
            case FFI_TYPE_STRUCT:
                fprintf(stderr, "js_ffi_type_val_to_buffer switch FFI_TYPE_STRUCT, should not happen!");
                abort();
            break;
            case FFI_TYPE_UINT64:
                JS_ToInt64(ctx, (uint64_t*)buf, val);
                return sizeof(uint64_t);
            case FFI_TYPE_SINT64:
                JS_ToInt64(ctx, (int64_t*)buf, val);
                return sizeof(int64_t);
            break;
            case FFI_TYPE_POINTER:
                JS_TO_UINTPTR_T(ctx, (void*)buf, val);
                return sizeof(void*);
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
    if(type == NULL){
        JS_ThrowTypeError(ctx, "expected this to be FfiType");
        return JS_EXCEPTION;
    }
    if(argc != 1){
        JS_ThrowTypeError(ctx, "expected 1 argument");
        return JS_EXCEPTION;
    }
    size_t sz = ffi_type_get_sz(type->ffi_type);
    uint8_t* buf = js_malloc(ctx, sz);
    int ret = ffi_type_to_buffer(ctx, argv[0], type->ffi_type, buf);
    if(ret < 0){
        js_free(ctx, buf);
        return JS_EXCEPTION;
    }
    return TJS_NewUint8Array(ctx, buf, sz);
}

static int ffi_type_from_buffer(JSContext *ctx, ffi_type* type, uint8_t* buf, JSValue* val){
    if(type->type == FFI_TYPE_STRUCT){
        JS_ThrowInternalError(ctx, "converting buffer to js is not yet implemented for structs");
        return -1;
    }else{
        switch(type->type){
            case FFI_TYPE_VOID:
                *val = JS_UNDEFINED;
                return 0;
            break;
            case FFI_TYPE_INT:
                *val = JS_NewInt32(ctx, *(int*)buf); // TODO maybe check architecture;
                return sizeof(int);
            case FFI_TYPE_FLOAT:
                *val = JS_NewFloat64(ctx, (double)*(float*)buf);
                return sizeof(float);
            case FFI_TYPE_DOUBLE:
                *val = JS_NewFloat64(ctx, *(double*)buf);
                return sizeof(double);
            case FFI_TYPE_LONGDOUBLE:{
                *val = JS_NewFloat64(ctx, *(long double*)buf);
                return sizeof(long double);
            }
            case FFI_TYPE_UINT8:
                *val = JS_NewInt32(ctx, *(uint8_t*)buf);
                return sizeof(uint8_t);
            case FFI_TYPE_SINT8:
                *val = JS_NewInt32(ctx, *(int8_t*)buf);
                return sizeof(int8_t);
            case FFI_TYPE_UINT16:
                *val = JS_NewInt32(ctx, *(uint16_t*)buf);
                return sizeof(uint16_t);
            case FFI_TYPE_SINT16:
                *val = JS_NewInt32(ctx, *(int16_t*)buf);
                return sizeof(int16_t);
            case FFI_TYPE_UINT32:
                *val = JS_NewInt64(ctx, *(uint32_t*)buf);
                return sizeof(uint32_t);
            case FFI_TYPE_SINT32:
                *val = JS_NewInt32(ctx, *(int32_t*)buf);
                return sizeof(int32_t);
            case FFI_TYPE_STRUCT:
                fprintf(stderr, "ffi_type_from_buffer switch FFI_TYPE_STRUCT, should not happen!");
                abort();
            break;
            case FFI_TYPE_UINT64:
                *val = JS_NewInt64(ctx, *(uint64_t*)buf);
                return sizeof(uint64_t);
            case FFI_TYPE_SINT64:
                *val = JS_NewInt64(ctx, *(int64_t*)buf);
                return sizeof(int64_t);
            break;
            case FFI_TYPE_POINTER:
                *val = JS_NEW_UINTPTR_T(ctx, (void*)buf);
                return sizeof(void*);
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
    if(type == NULL){
        JS_ThrowTypeError(ctx, "expected this to be FfiType");
        return JS_EXCEPTION;
    }
    if(argc != 1){
        JS_ThrowTypeError(ctx, "expected 1 argument");
        return JS_EXCEPTION;
    }
    size_t bufsz;
    uint8_t *buf = JS_GetUint8Array(ctx, &bufsz, argv[0]);
    if (!buf)
        return JS_EXCEPTION;
    size_t typesz = ffi_type_get_sz(type->ffi_type);
    if(bufsz != typesz){
        JS_ThrowRangeError(ctx, "expected buffer to be of size %d", typesz);
        return JS_EXCEPTION;
    }
    JSValue val = JS_UNDEFINED;
    int ret = ffi_type_from_buffer(ctx, type->ffi_type, buf, &val);
    if(ret < 0){
        return JS_EXCEPTION;
    }
    return val;
}

static JSCFunctionListEntry js_ffi_type_proto_funcs[] = {
    TJS_CFUNC_DEF("toBuffer", 1, js_ffi_type_to_buffer),
    TJS_CFUNC_DEF("fromBuffer", 1, js_ffi_type_from_buffer),
    TJS_CFUNC_DEF("alloc", 1, js_ffi_type_alloc),
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
    if(ptr == NULL){
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
typedef struct{
    ffi_cif ffi_cif;
    ffi_type** args;
    size_t depsCount;
    JSValue* deps;
} js_ffi_cif;

static JSValue js_ffi_cif_create(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    ssize_t nfixedargs = -1;
    size_t ntotalargs = argc - 1;
    if(JS_IsNumber(argv[argc-1])){
        if(JS_TO_SIZE_T(ctx, &nfixedargs, argv[argc-1]) < 0){
            JS_ThrowTypeError(ctx, "argument %d has to be positive integer", argc);
            return JS_EXCEPTION;
        }
        ntotalargs = argc - 2;
    }else if(JS_IsUndefined(argv[argc-1])){
        ntotalargs = argc - 2;
    }
    for(unsigned i=0;i<ntotalargs+1;i++){
        ffi_type* t = JS_GetOpaque(argv[i], js_ffi_type_classid);
        if(t == NULL){
            JS_ThrowTypeError(ctx, "argument %d is not a FfiType", i+1);
            return JS_EXCEPTION;
        }
    }

    JSValue obj = JS_NewObjectClass(ctx, js_ffi_cif_classid);
    if (JS_IsException(obj)){
        return obj;
    }
    
    js_ffi_cif *js_cif = js_malloc(ctx, sizeof(js_ffi_cif));
    js_cif->args = js_malloc(ctx, sizeof(ffi_type*) * (ntotalargs));
    js_cif->deps = js_malloc(ctx, sizeof(JSValue) * (ntotalargs+1));
    js_cif->depsCount = ntotalargs+1;
    ffi_type* retType;

    if(argc > 0){
        js_ffi_type* jst = JS_GetOpaque(argv[0], js_ffi_type_classid);
        retType = jst->ffi_type;
    }else{
        retType = &ffi_type_void;
    }

    for(unsigned i=0;i<js_cif->depsCount;i++){
        js_cif->deps[i] = argv[i];
    }

    for(unsigned i=1;i<ntotalargs+1;i++){
        js_ffi_type* jst = JS_GetOpaque(argv[i], js_ffi_type_classid);
        js_cif->args[i-1] = jst->ffi_type;
    }

    ffi_status ret;
    if(nfixedargs > -1){
        ret = ffi_prep_cif_var(&js_cif->ffi_cif, FFI_DEFAULT_ABI, nfixedargs, ntotalargs, retType, js_cif->args);
    }else{
        ret = ffi_prep_cif(&js_cif->ffi_cif, FFI_DEFAULT_ABI, ntotalargs, retType, js_cif->args);
    }
    if(ret != FFI_OK){
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
        for(unsigned i=0;i<u->depsCount;i++){
            JS_MarkValue(rt, u->deps[i], mark_func);
        }
    }
}

static void js_ffi_cif_finalizer(JSRuntime *rt, JSValue val) {
    js_ffi_cif *u = JS_GetOpaque(val, js_ffi_cif_classid);
    if (u) {
        js_free_rt(rt, u->args);
        js_free_rt(rt, u);
    }
}

JSClassDef js_ffi_cif_class = {
    "FfiCif",
    .finalizer = js_ffi_cif_finalizer,
    .gc_mark = js_ffi_cif_mark
};

static JSValue js_ffi_cif_call(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    js_ffi_cif* cif = JS_GetOpaque(this_val, js_ffi_cif_classid);
    if(!cif){
        JS_ThrowTypeError(ctx, "this must be FfiCif");
        return JS_EXCEPTION;
    }
    void* func;
    if(argc <= 0 || (func = JS_GetOpaque(argv[0], js_uv_dlsym_classid)) == NULL){
        JS_ThrowTypeError(ctx, "argument 1 must be UvDlsym");
        return JS_EXCEPTION;
    }

    unsigned ffi_arg_cnt = argc - 1;
    JSValueConst* func_argv = &argv[1];
    if(ffi_arg_cnt != cif->ffi_cif.nargs){
        JS_ThrowRangeError(ctx, "expected %d arguments but got %d", cif->ffi_cif.nargs, ffi_arg_cnt);
        return JS_EXCEPTION;
    }

    void** aval = js_malloc(ctx, ffi_arg_cnt*sizeof(void*)*2);
    for(unsigned i=0;i<ffi_arg_cnt;i++){
        void* ptr;
        if(JS_IsBigInt(ctx, func_argv[i])){
            ptr = &aval[ffi_arg_cnt+i];
            JS_TO_UINTPTR_T(ctx, ptr, func_argv[i]);
        }else{
            size_t sz;
            ptr = JS_GetUint8Array(ctx, &sz, func_argv[i]);
            if(ptr == NULL){
                js_free(ctx, aval);
                JS_ThrowTypeError(ctx, "argument %d expected to be ptr (bigint) or buffer", i+1);
                return JS_EXCEPTION;
            }
        }
        aval[i] = ptr;
    }

    size_t retsz = ffi_type_get_sz(cif->ffi_cif.rtype);
    void* rptr = js_malloc(ctx, retsz);
    ffi_call(&cif->ffi_cif, func, rptr, aval);
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
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_string}));
    JSValue obj = JS_NewObjectClass(ctx, js_uv_lib_classid);
    if (JS_IsException(obj)){
        return obj;
    }
    const char* dlname = JS_ToCString(ctx, argv[0]);
    uv_lib_t* lib = js_malloc(ctx, sizeof(uv_lib_t));
    int ret = uv_dlopen(dlname, lib);
    if(ret != 0){
        JS_ThrowInternalError(ctx, "uv_dlopen failed: %s", uv_dlerror(lib));
        js_free(ctx, lib);
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }
    JS_SetOpaque(obj, lib);
    return obj;
}

static void js_uv_lib_finalizer(JSRuntime *rt, JSValue val) {
    uv_lib_t* u = JS_GetOpaque(val, js_uv_lib_classid);
    if (u) {
        uv_dlclose(u);
        js_free_rt(rt, u);
    }
}

static JSValue js_uv_lib_dlsym(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_string}));

    uv_lib_t* lib = JS_GetOpaque(this_val, js_uv_lib_classid);
    if(lib == NULL){
        JS_ThrowTypeError(ctx, "this needs to be instance of UvLib");
        return JS_EXCEPTION;
    }

    JSValue obj = JS_NewObjectClass(ctx, js_uv_dlsym_classid);
    if (JS_IsException(obj)){
        return obj;
    }

    const char* sym = JS_ToCString(ctx, argv[0]);
    void* ptr;
    if(uv_dlsym(lib, sym, &ptr) != 0){
        JS_ThrowInternalError(ctx, "uv_dlopen failed: %s", uv_dlerror(lib));
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

static JSValue js_libc_malloc(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    size_t size;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number}))
    JS_TO_SIZE_T(ctx, &size, argv[0]);
    return JS_NEW_UINTPTR_T(ctx, malloc(size));
}

static JSValue js_libc_realloc(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    void *ptr;
    size_t size;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number}))
    JS_TO_UINTPTR_T(ctx, &ptr, argv[0]);
    JS_TO_SIZE_T(ctx, &size, argv[1]);
    return JS_NEW_UINTPTR_T(ctx, realloc(ptr, size));
}

static JSValue js_libc_free(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    void *ptr;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number}))
    JS_TO_UINTPTR_T(ctx, &ptr, argv[0]);
    free(ptr);
    return JS_UNDEFINED;
}

static JSValue js_libc_memset(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    void *s;
    int c;
    size_t n;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number, t_number}))
    JS_TO_UINTPTR_T(ctx, &s, argv[0]);
    JS_TO_INT(ctx, &c, argv[1]);
    JS_TO_SIZE_T(ctx, &n, argv[2]);
    return JS_NEW_UINTPTR_T(ctx, memset(s, c, n));
}

static JSValue js_libc_memcpy(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    void *dest;
    void *src;
    size_t n;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number, t_number}))
    JS_TO_UINTPTR_T(ctx, &dest, argv[0]);
    JS_TO_UINTPTR_T(ctx, &src, argv[1]);
    JS_TO_SIZE_T(ctx, &n, argv[2]);
    return JS_NEW_UINTPTR_T(ctx, memcpy(dest, src, n));
}

static JSValue js_libc_strlen(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    char *s;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number}))
    JS_TO_UINTPTR_T(ctx, &s, argv[0]);
    return JS_NEW_SIZE_T(ctx, strlen(s));
}

static JSValue js_libc_errno(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    if(argc != 0){
        JS_ThrowTypeError(ctx, "expected 0 arguments");
        return JS_EXCEPTION;
    }
    return JS_NEW_INT(ctx, errno);
}

static JSValue js_libc_strerror(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number}));
    int err;
    JS_TO_INT(ctx, &err, argv[0]);
    return JS_NewString(ctx, strerror(err));
}
#pragma endregion "Libc helpers"

#pragma region "other helpers"
// ============================

static JSValue js_array_buffer_get_ptr(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    if(argc <= 0){
        JS_ThrowTypeError(ctx, "expected argument 1 to be ArrayBuffer");
        return JS_EXCEPTION;
    }
    size_t size;
    uint8_t *buf = JS_GetUint8Array(ctx, &size, argv[0]);
    if (!buf)
        return JS_EXCEPTION;
    return JS_NewBigUint64(ctx, (uint64_t)buf);
}

static JSValue js_get_cstring(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_bigint}));
    char* ptr;
    JS_TO_UINTPTR_T(ctx, &ptr, argv[0]);
    return JS_NewString(ctx, ptr);
}

static JSValue js_buf_to_ptr(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    if(argc <= 0){
        JS_ThrowTypeError(ctx, "expected argument 1 to be ArrayBuffer");
        return JS_EXCEPTION;
    }
    size_t size;
    uint8_t *buf = JS_GetUint8Array(ctx, &size, argv[0]);
    if (!buf)
        return JS_EXCEPTION;
    return JS_NEW_UINTPTR_T(ctx, buf);
}

static JSValue js_deref_ptr(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    unsigned times = 1;
    if(argc <= 0 || !JS_IsBigInt(ctx, argv[0])){
        JS_ThrowTypeError(ctx, "expected argument 1 to be bigint");
        return JS_EXCEPTION;
    }
    if(argc == 2){
        if(JS_ToUint32(ctx, &times, argv[1])){
            JS_ThrowTypeError(ctx, "expected argument 2 to be integer");
            return JS_EXCEPTION;
        }
    }
    void* ptr;
    JS_TO_UINTPTR_T(ctx, &ptr, argv[0]);
    for(unsigned i=0;i<times;i++){
        ptr = *(void**)ptr;
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
#else
    #error('unknown os')
#endif

#pragma endregion "other helpers"

static JSCFunctionListEntry funcs[] = {
    // basic functions from libc
    TJS_CFUNC_DEF("malloc", 1, js_libc_malloc),
    TJS_CFUNC_DEF("realloc", 2, js_libc_realloc),
    TJS_CFUNC_DEF("free", 1, js_libc_free),
    TJS_CFUNC_DEF("memset", 3, js_libc_memset),
    TJS_CFUNC_DEF("memcpy", 3, js_libc_memcpy),
    TJS_CFUNC_DEF("strlen", 1, js_libc_strlen),
    TJS_CFUNC_DEF("errno", 0, js_libc_errno),
    TJS_CFUNC_DEF("strerror", 1, js_libc_strerror),

    // other helpers
    TJS_CFUNC_DEF("getArrayBufPtr", 1, js_array_buffer_get_ptr),
    TJS_CFUNC_DEF("getCString", 1, js_get_cstring),
    TJS_CFUNC_DEF("bufToPtr", 1, js_buf_to_ptr),
    TJS_CFUNC_DEF("derefPtr", 2, js_deref_ptr),
    
    C_MACRO_STRING_DEF(LIBC_NAME),
    C_MACRO_STRING_DEF(LIBM_NAME),
};

#define REGISTER_CLASS(ctx, name) \
    JS_NewClassID(&name ## _classid);\
    JS_NewClass(JS_GetRuntime(ctx), name ## _classid, &name ## _class); \
    JSValue name ## _proto = JS_NewObject(ctx);\
    JS_SetPropertyFunctionList(ctx, name ## _proto, name ## _proto_funcs, countof(name ## _proto_funcs)); \
    JS_SetClassProto(ctx, name ## _classid, name ## _proto);

#define CLASS_CREATE_CONSTRUCTOR(ctx, name, ns, constructor) \
    JSValue name ## _constructor = JS_NewCFunction2(ctx, constructor, name ## _class.class_name, 1, JS_CFUNC_constructor, 0); \
    JS_DefinePropertyValueStr(ctx, ns, name ## _class.class_name, name ## _constructor, JS_PROP_CONFIGURABLE | JS_PROP_WRITABLE | JS_PROP_ENUMERABLE);


#define ADD_SIMPLE_TYPE(ctx, obj, name) JSValue name ## _jsval = ffi_type_create_existing(ctx, &ffi_ ## name, #name); JS_SetPropertyStr(ctx, obj, #name, name ## _jsval)
#define ADD_ALIAS_TYPE(ctx, obj, alias, oldname) JS_SetPropertyStr(ctx, obj, #alias, JS_DupValue(ctx, oldname ## _jsval))

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

    //C_VAR_ADDRESS_DEF(ffi_type_complex_float),
    //C_VAR_ADDRESS_DEF(ffi_type_complex_double),
    //C_VAR_ADDRESS_DEF(ffi_type_complex_longdouble),
}
/*
MIT License

Copyright (c) 2021 shajunxing

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

#define _GNU_SOURCE
#define __USE_GNU
#include <dlfcn.h>
#include <ffi.h>
#include <gnu/lib-names.h>
#include <limits.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define C_MACRO_STRING_DEF(x) JS_PROP_STRING_DEF(#x, x, JS_PROP_CONFIGURABLE)

#if UINTPTR_MAX == UINT32_MAX
#define JS_TO_UINTPTR_T(ctx, pres, val) JS_ToInt32(ctx, (int32_t *)(pres), val)
#define JS_NEW_UINTPTR_T(ctx, val) JS_NewInt32(ctx, (int32_t)(val))
#define C_MACRO_UINTPTR_T_DEF(x) JS_PROP_INT32_DEF(#x, (int32_t)(x), JS_PROP_CONFIGURABLE)
// 不能#define C_MACRO_INTPTR_DEF(x) C_MACRO_INT_DEF(x)否则#会展开为x所定义的内容而非x本身
#define C_VAR_ADDRESS_DEF(x) JS_PROP_INT32_DEF(#x, (int32_t)(&x), JS_PROP_CONFIGURABLE)
#define ffi_type_intptr_t ffi_type_sint32
#define ffi_type_uintptr_t ffi_type_uint32
#elif UINTPTR_MAX == UINT64_MAX
#define JS_TO_UINTPTR_T(ctx, pres, val) JS_ToInt64(ctx, (int64_t *)(pres), val)
#define JS_NEW_UINTPTR_T(ctx, val) JS_NewInt64(ctx, (int64_t)(val))
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

#define COUNTOF(x) (sizeof(x) / sizeof((x)[0]))

enum argtype {
    t_null,
    t_bool,
    t_number,
    t_string,
    t_string_or_null,
    t_function,
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
            default:
                JS_ThrowTypeError(ctx, "argv[%d] type definition is not yet supported", i);
                return false;
        }
    }
    return true;
}

#define CHECK_ARGS(ctx, argc, argv, tlist)                       \
    if (!check_args(ctx, argc, argv, (tlist), COUNTOF(tlist))) { \
        return JS_EXCEPTION;                                     \
    }

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

static void fprinthex(FILE *stream, const void *data, size_t size) { // https://gist.github.com/ccbrown/9722406
    char ascii[17];
    size_t i, j;
    ascii[16] = '\0';
    for (i = 0; i < size; ++i) {
        fprintf(stream, "%02X ", ((unsigned char *)data)[i]);
        if (((unsigned char *)data)[i] >= ' ' && ((unsigned char *)data)[i] <= '~') {
            ascii[i % 16] = ((unsigned char *)data)[i];
        } else {
            ascii[i % 16] = '.';
        }
        if ((i + 1) % 8 == 0 || i + 1 == size) {
            fprintf(stream, " ");
            if ((i + 1) % 16 == 0) {
                fprintf(stream, "|  %s \n", ascii);
            } else if (i + 1 == size) {
                ascii[(i + 1) % 16] = '\0';
                if ((i + 1) % 16 <= 8) {
                    fprintf(stream, " ");
                }
                for (j = (i + 1) % 16; j < 16; ++j) {
                    fprintf(stream, "   ");
                }
                fprintf(stream, "|  %s \n", ascii);
            }
        }
    }
}

static JSValue js_fprinthex(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    FILE *stream;
    void *data;
    size_t size;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number, t_number}))
    JS_TO_UINTPTR_T(ctx, &stream, argv[0]);
    JS_TO_UINTPTR_T(ctx, &data, argv[1]);
    JS_TO_SIZE_T(ctx, &size, argv[2]);
    fprinthex(stream, data, size);
    return JS_UNDEFINED;
}

static JSValue js_printhex(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    void *data;
    size_t size;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number}))
    JS_TO_UINTPTR_T(ctx, &data, argv[0]);
    JS_TO_SIZE_T(ctx, &size, argv[1]);
    fprinthex(stdout, data, size);
    return JS_UNDEFINED;
}

static JSValue js_memreadint(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    void *buf;
    size_t buflen;
    size_t offset;
    bool issigned;
    size_t bytewidth;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number, t_number, t_bool, t_number}))
    JS_TO_UINTPTR_T(ctx, &buf, argv[0]);
    JS_TO_SIZE_T(ctx, &buflen, argv[1]);
    JS_TO_SIZE_T(ctx, &offset, argv[2]);
    issigned = JS_ToBool(ctx, argv[3]);
    JS_TO_SIZE_T(ctx, &bytewidth, argv[4]);
    if ((buflen < 0) || (offset < 0) || (bytewidth < 0) || (offset + bytewidth > buflen)) {
        JS_ThrowRangeError(ctx, "pointer out of bounds");
        return JS_EXCEPTION;
    }
    // printf("%p %d %d %d %d\n", buf, buflen, offset, issigned, bytewidth);
    switch (bytewidth) {
        case 1:
            return issigned ? JS_NewInt32(ctx, *((int8_t *)(buf + offset))) : JS_NewUint32(ctx, *((uint8_t *)(buf + offset)));
        case 2:
            return issigned ? JS_NewInt32(ctx, *((int16_t *)(buf + offset))) : JS_NewUint32(ctx, *((uint16_t *)(buf + offset)));
        case 4:
            return issigned ? JS_NewInt32(ctx, *((int32_t *)(buf + offset))) : JS_NewUint32(ctx, *((uint32_t *)(buf + offset)));
        case 8:
            // TODO: unsigned int64 ???
            return issigned ? JS_NewInt64(ctx, *((int64_t *)(buf + offset))) : JS_NewInt64(ctx, *((uint64_t *)(buf + offset)));
        default:
            JS_ThrowTypeError(ctx, "bytewidth must only be 1, 2, 4, or 8");
            return JS_EXCEPTION;
    }
}

static JSValue js_memwriteint(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    void *buf;
    size_t buflen;
    size_t offset;
    size_t bytewidth;
    int64_t val;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number, t_number, t_number, t_number}))
    JS_TO_UINTPTR_T(ctx, &buf, argv[0]);
    JS_TO_SIZE_T(ctx, &buflen, argv[1]);
    JS_TO_SIZE_T(ctx, &offset, argv[2]);
    JS_TO_SIZE_T(ctx, &bytewidth, argv[3]);
    JS_ToInt64(ctx, &val, argv[4]);
    if ((buflen < 0) || (offset < 0) || (bytewidth < 0) || (offset + bytewidth > buflen)) {
        JS_ThrowRangeError(ctx, "pointer out of bounds");
        return JS_EXCEPTION;
    }
    // printf("%p %d %d %d %d\n", buf, buflen, offset, issigned, bytewidth);
    switch (bytewidth) {
        case 1:
            *((int8_t *)(buf + offset)) = (int8_t)val;
            break;
        case 2:
            *((int16_t *)(buf + offset)) = (int16_t)val;
            break;
        case 4:
            *((int32_t *)(buf + offset)) = (int32_t)val;
            break;
        case 8:
            *((int64_t *)(buf + offset)) = (int64_t)val;
            break;
        default:
            JS_ThrowTypeError(ctx, "bytewidth must only be 1, 2, 4, or 8");
            return JS_EXCEPTION;
    }
    return JS_UNDEFINED;
}

static JSValue js_memreadfloat(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    void *buf;
    size_t buflen;
    size_t offset;
    bool isdouble;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number, t_number, t_bool}))
    JS_TO_UINTPTR_T(ctx, &buf, argv[0]);
    JS_TO_SIZE_T(ctx, &buflen, argv[1]);
    JS_TO_SIZE_T(ctx, &offset, argv[2]);
    isdouble = JS_ToBool(ctx, argv[3]);
    if ((buflen < 0) || (offset < 0) || (offset + (isdouble ? sizeof(double) : sizeof(float)) > buflen)) {
        JS_ThrowRangeError(ctx, "pointer out of bounds");
        return JS_EXCEPTION;
    }
    return isdouble ? JS_NewFloat64(ctx, *((double *)(buf + offset))) : JS_NewFloat64(ctx, *((float *)(buf + offset)));
}

static JSValue js_memwritefloat(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    void *buf;
    size_t buflen;
    size_t offset;
    bool isdouble;
    double val;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number, t_number, t_bool, t_number}))
    JS_TO_UINTPTR_T(ctx, &buf, argv[0]);
    JS_TO_SIZE_T(ctx, &buflen, argv[1]);
    JS_TO_SIZE_T(ctx, &offset, argv[2]);
    isdouble = JS_ToBool(ctx, argv[3]);
    JS_ToFloat64(ctx, &val, argv[4]);
    // printf("%f\n", val);
    if ((buflen < 0) || (offset < 0) || (offset + (isdouble ? sizeof(double) : sizeof(float)) > buflen)) {
        JS_ThrowRangeError(ctx, "pointer out of bounds");
        return JS_EXCEPTION;
    }
    if (isdouble) {
        *((double *)(buf + offset)) = (double)val;
    } else {
        *((float *)(buf + offset)) = (float)val;
    }
    return JS_UNDEFINED;
}

static JSValue js_memreadstring(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    void *buf;
    size_t buflen;
    size_t offset;
    size_t len;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number, t_number, t_number}))
    JS_TO_UINTPTR_T(ctx, &buf, argv[0]);
    JS_TO_SIZE_T(ctx, &buflen, argv[1]);
    JS_TO_SIZE_T(ctx, &offset, argv[2]);
    JS_TO_SIZE_T(ctx, &len, argv[3]);
    if ((buflen < 0) || (offset < 0) || (len < 0) || (offset + len > buflen)) {
        JS_ThrowRangeError(ctx, "pointer out of bounds");
        return JS_EXCEPTION;
    }
    return JS_NewStringLen(ctx, (char *)(buf + offset), len);
}

static JSValue js_memwritestring(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    void *buf;
    size_t buflen;
    size_t offset;
    const char *str;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number, t_number, t_string}))
    JS_TO_UINTPTR_T(ctx, &buf, argv[0]);
    JS_TO_SIZE_T(ctx, &buflen, argv[1]);
    JS_TO_SIZE_T(ctx, &offset, argv[2]);
    str = JS_ToCString(ctx, argv[3]);
    size_t len = strlen(str);
    if ((buflen < 0) || (offset < 0) || (len < 0) || (offset + len > buflen)) {
        JS_ThrowRangeError(ctx, "pointer out of bounds");
        JS_FreeCString(ctx, str);
        return JS_EXCEPTION;
    }
    memcpy(buf + offset, str, len);
    JS_FreeCString(ctx, str);
    return JS_UNDEFINED;
}

static JSValue js_tocstring(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_string}))
    return JS_NEW_UINTPTR_T(ctx, JS_ToCString(ctx, argv[0]));
}

static JSValue js_freecstring(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    char *str;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number}))
    JS_TO_UINTPTR_T(ctx, &str, argv[0]);
    JS_FreeCString(ctx, str);
    return JS_UNDEFINED;
}

static JSValue js_newstring(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    char *str;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number}))
    JS_TO_UINTPTR_T(ctx, &str, argv[0]);
    return JS_NewString(ctx, str);
}

static JSValue js_libdl_dlopen(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *filename;
    int flags;
    void *ret;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_string_or_null, t_number}))
    filename = JS_IsString(argv[0]) ? JS_ToCString(ctx, argv[0]) : NULL;
    JS_ToInt32(ctx, &flags, argv[1]);
    ret = dlopen(filename, flags);
    // printf("%p\n", ret);
    if (filename) {
        JS_FreeCString(ctx, filename);
    }
    return JS_NEW_UINTPTR_T(ctx, ret);
}

static JSValue js_libdl_dlclose(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    void *handle;
    int ret;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number}))
    JS_TO_UINTPTR_T(ctx, &handle, argv[0]);
    // printf("%p\n", handle);
    ret = dlclose(handle);
    return JS_NewInt32(ctx, ret);
}

static JSValue js_libdl_dlsym(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    void *handle;
    const char *symbol;
    void *ret;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_string}))
    JS_TO_UINTPTR_T(ctx, &handle, argv[0]);
    symbol = JS_ToCString(ctx, argv[1]);
    // printf("%p %s\n", handle, symbol);
    ret = dlsym(handle, symbol);
    // printf("%p\n", ret);
    if (symbol) {
        JS_FreeCString(ctx, symbol);
    }
    return JS_NEW_UINTPTR_T(ctx, ret);
}

static JSValue js_libdl_dlerror(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    char *ret;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){}))
    ret = dlerror();
    return ret ? JS_NewString(ctx, ret) : JS_NULL;
}

static JSValue js_libffi_ffi_prep_cif(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    ffi_cif *cif;
    ffi_abi abi;
    unsigned int nargs;
    ffi_type *rtype;
    ffi_type **atypes;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number, t_number, t_number, t_number}))
    JS_TO_UINTPTR_T(ctx, &cif, argv[0]);
    JS_TO_INT(ctx, &abi, argv[1]);
    JS_TO_INT(ctx, &nargs, argv[2]);
    JS_TO_UINTPTR_T(ctx, &rtype, argv[3]);
    JS_TO_UINTPTR_T(ctx, &atypes, argv[4]);
    return JS_NEW_INT(ctx, ffi_prep_cif(cif, abi, nargs, rtype, atypes));
}

static JSValue js_libffi_ffi_prep_cif_var(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    ffi_cif *cif;
    ffi_abi abi;
    unsigned int nfixedargs;
    unsigned int ntotalargs;
    ffi_type *rtype;
    ffi_type **atypes;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number, t_number, t_number, t_number, t_number}))
    JS_TO_UINTPTR_T(ctx, &cif, argv[0]);
    JS_TO_INT(ctx, &abi, argv[1]);
    JS_TO_INT(ctx, &nfixedargs, argv[2]);
    JS_TO_INT(ctx, &ntotalargs, argv[3]);
    JS_TO_UINTPTR_T(ctx, &rtype, argv[4]);
    JS_TO_UINTPTR_T(ctx, &atypes, argv[5]);
    return JS_NEW_INT(ctx, ffi_prep_cif_var(cif, abi, nfixedargs, ntotalargs, rtype, atypes));
}

static JSValue js_libffi_ffi_call(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    ffi_cif *cif;
    void *fn;
    void *rvalue;
    void **avalues;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number, t_number, t_number}))
    JS_TO_UINTPTR_T(ctx, &cif, argv[0]);
    JS_TO_UINTPTR_T(ctx, &fn, argv[1]);
    JS_TO_UINTPTR_T(ctx, &rvalue, argv[2]);
    JS_TO_UINTPTR_T(ctx, &avalues, argv[3]);
    ffi_call(cif, fn, rvalue, avalues);
    return JS_UNDEFINED;
}

static JSValue js_ffi_get_struct_offsets(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    ffi_abi abi;
    ffi_type *struct_type;
    size_t *offsets;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number, t_number}))
    JS_TO_INT(ctx, &abi, argv[0]);
    JS_TO_UINTPTR_T(ctx, &struct_type, argv[1]);
    JS_TO_UINTPTR_T(ctx, &offsets, argv[2]);
    return JS_NEW_INT(ctx, ffi_get_struct_offsets(abi, struct_type, offsets));
}

static JSValue js_ffi_closure_alloc(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    size_t size;
    void **code;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number}))
    JS_TO_SIZE_T(ctx, &size, argv[0]);
    JS_TO_UINTPTR_T(ctx, &code, argv[1]);
    return JS_NEW_UINTPTR_T(ctx, ffi_closure_alloc(size, code));
}

static JSValue js_ffi_closure_free(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    void *writable;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number}))
    JS_TO_UINTPTR_T(ctx, &writable, argv[0]);
    ffi_closure_free(writable);
    return JS_UNDEFINED;
}

static JSValue js_ffi_prep_closure_loc(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    ffi_closure *closure;
    ffi_cif *cif;
    void *fun;
    void *user_data;
    void *codeloc;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_number, t_number, t_number, t_number}))
    JS_TO_UINTPTR_T(ctx, &closure, argv[0]);
    JS_TO_UINTPTR_T(ctx, &cif, argv[1]);
    JS_TO_UINTPTR_T(ctx, &fun, argv[2]);
    JS_TO_UINTPTR_T(ctx, &user_data, argv[3]);
    JS_TO_UINTPTR_T(ctx, &codeloc, argv[4]);
    return JS_NEW_INT(ctx, ffi_prep_closure_loc(closure, cif, fun, user_data, codeloc));
}

typedef struct {
    JSContext *ctx;
    JSValue this;
    JSValue func;
} ffi_closure_js_func_data;

static JSValue js_fill_ffi_closure_js_func_data(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    ffi_closure_js_func_data *data;
    CHECK_ARGS(ctx, argc, argv, ((enum argtype[]){t_number, t_function}))
    JS_TO_UINTPTR_T(ctx, &data, argv[0]);
    data->ctx = ctx;
    data->this = this_val;
    data->func = argv[1];
    // puts("js_fill_ffi_closure_js_func_data");
    // printf("%lu %lu %lu %lu %lu\n", data->ctx, (data->func).u.ptr, (data->func).tag, (data->this).u.ptr, (data->this).tag);
    return JS_UNDEFINED;
}

static void ffi_closure_js_func_adapter(ffi_cif *cif, void *ret, void *args[], void *user_data) {
    ffi_closure_js_func_data *data = (ffi_closure_js_func_data *)user_data;
    // puts("ffi_closure_js_func_adapter");
    // printf("%lu %lu %lu %lu %lu\n", data->ctx, (data->func).u.ptr, (data->func).tag, (data->this).u.ptr, (data->this).tag);
    // printf("%lu %lu\n", ret, args);
    JSValue result = JS_Call(data->ctx, data->func, data->this, 2,
                             (JSValueConst[]){JS_NEW_UINTPTR_T(data->ctx, ret), JS_NEW_UINTPTR_T(data->ctx, args)});
    if (JS_IsException(result)) {  // js_std_dump_error in quickjs-libc.c
        tjs_dump_error(data->ctx);
    }
}

static JSCFunctionListEntry funcs[] = {
    //
    // basic memory handling functions, partly from libc and quickjs itself
    //
    TJS_CFUNC_DEF("malloc", 1, js_libc_malloc),
    TJS_CFUNC_DEF("realloc", 2, js_libc_realloc),
    TJS_CFUNC_DEF("free", 1, js_libc_free),
    TJS_CFUNC_DEF("memset", 3, js_libc_memset),
    TJS_CFUNC_DEF("memcpy", 3, js_libc_memcpy),
    TJS_CFUNC_DEF("strlen", 1, js_libc_strlen),
    TJS_CFUNC_DEF("fprinthex", 3, js_fprinthex),
    TJS_CFUNC_DEF("printhex", 2, js_printhex),
    TJS_CFUNC_DEF("memreadint", 5, js_memreadint),
    TJS_CFUNC_DEF("memwriteint", 5, js_memwriteint),
    TJS_CFUNC_DEF("memreadfloat", 4, js_memreadfloat),
    TJS_CFUNC_DEF("memwritefloat", 5, js_memwritefloat),
    TJS_CFUNC_DEF("memreadstring", 4, js_memreadstring),
    TJS_CFUNC_DEF("memwritestring", 4, js_memwritestring),
    TJS_CFUNC_DEF("tocstring", 1, js_tocstring),
    TJS_CFUNC_DEF("freecstring", 1, js_freecstring),
    TJS_CFUNC_DEF("newstring", 1, js_newstring),
    C_MACRO_UINTPTR_T_DEF(NULL),
    C_SIZEOF_DEF(uintptr_t),
    C_SIZEOF_DEF(int),
    C_SIZEOF_DEF(size_t),
    C_MACRO_STRING_DEF(LIBC_SO),
    C_MACRO_STRING_DEF(LIBM_SO),
    //
    // libdl
    //
    TJS_CFUNC_DEF("dlopen", 2, js_libdl_dlopen),
    TJS_CFUNC_DEF("dlclose", 1, js_libdl_dlclose),
    TJS_CFUNC_DEF("dlsym", 2, js_libdl_dlsym),
    TJS_CFUNC_DEF("dlerror", 0, js_libdl_dlerror),
    C_MACRO_INT_DEF(RTLD_LAZY),
    C_MACRO_INT_DEF(RTLD_NOW),
    C_MACRO_INT_DEF(RTLD_GLOBAL),
    C_MACRO_INT_DEF(RTLD_LOCAL),
    C_MACRO_INT_DEF(RTLD_NODELETE),
    C_MACRO_INT_DEF(RTLD_NOLOAD),
    C_MACRO_INT_DEF(RTLD_DEEPBIND),
#if defined(_GNU_SOURCE)
    C_MACRO_UINTPTR_T_DEF(RTLD_DEFAULT),
    C_MACRO_UINTPTR_T_DEF(RTLD_NEXT),
#endif
    //
    // libffi
    //
    TJS_CFUNC_DEF("ffi_prep_cif", 5, js_libffi_ffi_prep_cif),
    TJS_CFUNC_DEF("ffi_prep_cif_var", 6, js_libffi_ffi_prep_cif_var),
    TJS_CFUNC_DEF("ffi_call", 4, js_libffi_ffi_call),
    TJS_CFUNC_DEF("ffi_get_struct_offsets", 3, js_ffi_get_struct_offsets),
    TJS_CFUNC_DEF("ffi_closure_alloc", 2, js_ffi_closure_alloc),
    TJS_CFUNC_DEF("ffi_closure_free", 1, js_ffi_closure_free),
    TJS_CFUNC_DEF("ffi_prep_closure_loc", 5, js_ffi_prep_closure_loc),
    C_ENUM_DEF(FFI_OK),
    C_ENUM_DEF(FFI_BAD_TYPEDEF),
    C_ENUM_DEF(FFI_BAD_ABI),
    C_SIZEOF_DEF(ffi_cif),
    C_ENUM_DEF(FFI_DEFAULT_ABI),
    C_SIZEOF_DEF(ffi_type),
    C_OFFSETOF_DEF(ffi_type, size),
    C_OFFSETOF_DEF(ffi_type, alignment),
    C_OFFSETOF_DEF(ffi_type, type),
    C_OFFSETOF_DEF(ffi_type, elements),
    C_SIZEOF_DEF(ffi_closure),
#ifndef LIBFFI_HIDE_BASIC_TYPES
    C_VAR_ADDRESS_DEF(ffi_type_void),
    C_VAR_ADDRESS_DEF(ffi_type_uint8),
    C_VAR_ADDRESS_DEF(ffi_type_sint8),
    C_VAR_ADDRESS_DEF(ffi_type_uint16),
    C_VAR_ADDRESS_DEF(ffi_type_sint16),
    C_VAR_ADDRESS_DEF(ffi_type_uint32),
    C_VAR_ADDRESS_DEF(ffi_type_sint32),
    C_VAR_ADDRESS_DEF(ffi_type_uint64),
    C_VAR_ADDRESS_DEF(ffi_type_sint64),
    C_VAR_ADDRESS_DEF(ffi_type_float),
    C_VAR_ADDRESS_DEF(ffi_type_double),
    C_VAR_ADDRESS_DEF(ffi_type_pointer),
    C_VAR_ADDRESS_DEF(ffi_type_longdouble),
#ifdef FFI_TARGET_HAS_COMPLEX_TYPE
    C_VAR_ADDRESS_DEF(ffi_type_complex_float),
    C_VAR_ADDRESS_DEF(ffi_type_complex_double),
    C_VAR_ADDRESS_DEF(ffi_type_complex_longdouble),
#endif
    C_VAR_ADDRESS_DEF(ffi_type_uchar),
    C_VAR_ADDRESS_DEF(ffi_type_schar),
    C_VAR_ADDRESS_DEF(ffi_type_ushort),
    C_VAR_ADDRESS_DEF(ffi_type_sshort),
    C_VAR_ADDRESS_DEF(ffi_type_uint),
    C_VAR_ADDRESS_DEF(ffi_type_sint),
    C_VAR_ADDRESS_DEF(ffi_type_ulong),
    C_VAR_ADDRESS_DEF(ffi_type_slong),
    C_VAR_ADDRESS_DEF(ffi_type_uintptr_t),
    C_VAR_ADDRESS_DEF(ffi_type_intptr_t),
    C_VAR_ADDRESS_DEF(ffi_type_size_t),
    C_MACRO_INT_DEF(FFI_TYPE_STRUCT),
    C_MACRO_INT_DEF(FFI_TYPE_COMPLEX),
    //
    // libffi closure custom things
    //
    JS_CFUNC_DEF("fill_ffi_closure_js_func_data", 1, js_fill_ffi_closure_js_func_data),
    C_SIZEOF_DEF(ffi_closure_js_func_data),
    C_VAR_ADDRESS_DEF(ffi_closure_js_func_adapter),
#endif
};

void tjs__mod_ffi_init(JSContext *ctx, JSValue ns) {
	JSAtom ffiatom = JS_NewAtom(ctx, "ffi");
    JSValue ffiobj = JS_NewObject(ctx);
	JS_SetPropertyFunctionList(ctx, ffiobj, funcs, countof(funcs));
    JS_SetProperty(ctx, ns, ffiatom, ffiobj);
}
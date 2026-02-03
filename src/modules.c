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

#include "curl-utils.h"
#include "private.h"
#include "tjs.h"
#include "utils.h"

#include <string.h>


static int json_module_init(JSContext *ctx, JSModuleDef *m) {
    JSValue val;
    val = JS_GetModulePrivateValue(ctx, m);
    JS_SetModuleExport(ctx, m, "default", val);
    return 0;
}

static JSModuleDef *create_json_module(JSContext *ctx, const char *module_name, JSValue val) {
    JSModuleDef *m;
    m = JS_NewCModule(ctx, module_name, json_module_init);
    if (!m) {
        JS_FreeValue(ctx, val);
        return NULL;
    }
    /* only export the "default" symbol which will contain the JSON object */
    JS_AddModuleExport(ctx, m, "default");
    JS_SetModulePrivateValue(ctx, m, val);
    return m;
}

/* return > 0 if the attributes indicate a JSON module, 0 otherwise, -1 on error */
static int js_module_test_json(JSContext *ctx, JSValueConst attributes) {
    JSValue str;
    const char *cstr;
    size_t len;
    int res;

    if (JS_IsUndefined(attributes)) {
        return 0;
    }
    str = JS_GetPropertyStr(ctx, attributes, "type");
    if (JS_IsException(str)) {
        return -1;
    }
    if (!JS_IsString(str)) {
        JS_FreeValue(ctx, str);
        return 0;
    }
    cstr = JS_ToCStringLen(ctx, &len, str);
    JS_FreeValue(ctx, str);
    if (!cstr) {
        return -1;
    }
    if (len == 4 && !memcmp(cstr, "json", len)) {
        res = 1;
    } else {
        res = 0;
    }
    JS_FreeCString(ctx, cstr);
    return res;
}

/* in order to conform with the specification, only the keys should be
   tested and not the associated values. */
int tjs_module_attr_checker(JSContext *ctx, void *opaque, JSValueConst attributes) {
    JSPropertyEnum *tab;
    uint32_t i, len;
    int ret;
    const char *cstr;
    size_t cstr_len;

    if (JS_GetOwnPropertyNames(ctx, &tab, &len, attributes, JS_GPN_ENUM_ONLY | JS_GPN_STRING_MASK)) {
        return -1;
    }
    ret = 0;
    for (i = 0; i < len; i++) {
        cstr = JS_AtomToCStringLen(ctx, &cstr_len, tab[i].atom);
        if (!cstr) {
            ret = -1;
            break;
        }
        if (!(cstr_len == 4 && !memcmp(cstr, "type", cstr_len))) {
            JS_ThrowTypeError(ctx, "import attribute '%s' is not supported", cstr);
            ret = -1;
        }
        JS_FreeCString(ctx, cstr);
        if (ret) {
            break;
        }
    }
    JS_FreePropertyEnum(ctx, tab, len);
    return ret;
}

JSModuleDef *tjs_module_loader(JSContext *ctx, const char *module_name, void *opaque, JSValueConst attributes) {
    static const char http[] = "http://";
    static const char https[] = "https://";
    static const char tjs_prefix[] = "tjs:";

    JSModuleDef *m = NULL;
    int r;
    bool is_json, use_realpath;
    DynBuf dbuf;

    if (strncmp(tjs_prefix, module_name, strlen(tjs_prefix)) == 0) {
        return tjs__load_builtin(ctx, module_name);
    }

    r = js_module_test_json(ctx, attributes);
    if (r < 0) {
        return NULL;
    }
    is_json = js__has_suffix(module_name, ".json") || r > 0;

    tjs_dbuf_init(ctx, &dbuf);

    if (strncmp(http, module_name, strlen(http)) == 0 || strncmp(https, module_name, strlen(https)) == 0) {
        r = tjs_curl_load_http(&dbuf, module_name);
        if (r != 200) {
            if (r < 0) {
                /* curl error */
                JS_ThrowReferenceError(ctx, "could not load '%s': %s", module_name, curl_easy_strerror(-r));
            } else {
                /* http error */
                JS_ThrowReferenceError(ctx, "could not load '%s': %d", module_name, r);
            }
            goto end;
        }
        use_realpath = false;
    } else {
        r = tjs__load_file(ctx, &dbuf, module_name);
        if (r != 0) {
            JS_ThrowReferenceError(ctx, "could not load '%s'", module_name);
            goto end;
        }
        use_realpath = true;
    }

    /* Add null termination, required by JS_Eval / JS_ParseJSON. */
    dbuf_putc(&dbuf, '\0');

    /* Now load the module for real. */
    if (is_json) {
        JSValue val;
        val = JS_ParseJSON(ctx, (char *) dbuf.buf, dbuf.size - 1, module_name);
        if (JS_IsException(val)) {
            goto end;
        }
        m = create_json_module(ctx, module_name, val);
    } else {
        JSValue func_val = JS_Eval(ctx,
                                   (char *) dbuf.buf,
                                   dbuf.size - 1,
                                   module_name,
                                   JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
        if (JS_IsException(func_val)) {
            goto end;
        }

        r = js_module_set_import_meta(ctx, func_val, use_realpath, false);
        if (r != 0) {
            JS_FreeValue(ctx, func_val);
            goto end;
        }

        /* the module is already referenced, so we must free it */
        m = JS_VALUE_GET_PTR(func_val);
        JS_FreeValue(ctx, func_val);
    }

end:
    dbuf_free(&dbuf);

    return m;
}

#define TJS__PATHSEP_POSIX '/'
#if defined(_WIN32)
#define TJS__PATHSEP     '\\'
#define TJS__PATHSEP_STR "\\"
#else
#define TJS__PATHSEP     '/'
#define TJS__PATHSEP_STR "/"
#endif

int js_module_set_import_meta(JSContext *ctx, JSValue func_val, bool use_realpath, bool is_main) {
    JSModuleDef *m;
    char buf[JS__PATH_MAX + 16] = { 0 };
    int r;
    JSValue meta_obj;
    JSAtom module_name_atom;
    const char *module_name;
    char module_dirname[JS__PATH_MAX] = { 0 };
    char module_basename[JS__PATH_MAX] = { 0 };

    CHECK_EQ(JS_VALUE_GET_TAG(func_val), JS_TAG_MODULE);
    m = JS_VALUE_GET_PTR(func_val);

    module_name_atom = JS_GetModuleName(ctx, m);
    module_name = JS_AtomToCString(ctx, module_name_atom);
#if 0
    fprintf(stdout, "XXX loaded module: %s\n", module_name);
#endif
    JS_FreeAtom(ctx, module_name_atom);
    if (!module_name) {
        return -1;
    }

    /* realpath() cannot be used with builtin modules
        because the corresponding module source code is not
        necessarily present */
    if (use_realpath) {
        uv_fs_t req;
        r = uv_fs_realpath(NULL, &req, module_name, NULL);
        if (r != 0) {
            uv_fs_req_cleanup(&req);
            JS_ThrowTypeError(ctx, "realpath failure");
            JS_FreeCString(ctx, module_name);
            return -1;
        }
        js__pstrcpy(buf, sizeof(buf), "file://");
        js__pstrcat(buf, sizeof(buf), req.ptr);
        uv_fs_req_cleanup(&req);

        // When using realpath we have the opportunity to extract the dirname
        // and basename and add them to the meta. Since the path is now absolute
        // all we need to do is split on the last path separator.
        const char *start = buf + 7; /* skip file:// */
        char *p = strrchr(start, TJS__PATHSEP);
        strncpy(module_dirname, start, p - start);
        strcpy(module_basename, p + 1);
    } else {
        js__pstrcat(buf, sizeof(buf), module_name);
    }

    JS_FreeCString(ctx, module_name);

    meta_obj = JS_GetImportMeta(ctx, m);
    if (JS_IsException(meta_obj)) {
        return -1;
    }
    JS_DefinePropertyValueStr(ctx, meta_obj, "url", JS_NewString(ctx, buf), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, meta_obj, "main", JS_NewBool(ctx, is_main), JS_PROP_C_W_E);
    if (use_realpath) {
        JS_DefinePropertyValueStr(ctx, meta_obj, "dirname", JS_NewString(ctx, module_dirname), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, meta_obj, "basename", JS_NewString(ctx, module_basename), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, meta_obj, "path", JS_NewString(ctx, buf + 7), JS_PROP_C_W_E);
    }
    JS_FreeValue(ctx, meta_obj);
    return 0;
}

static inline void tjs__normalize_pathsep(const char *name) {
#if defined(_WIN32)
    char *p;

    for (p = name; *p; p++) {
        if (p[0] == TJS__PATHSEP_POSIX) {
            p[0] = TJS__PATHSEP;
        }
    }
#else
    (void) name;
#endif
}

char *tjs_module_normalizer(JSContext *ctx, const char *base_name, const char *name, void *opaque) {
#if 0
    printf("normalize: %s %s\n", base_name, name);
#endif

    char *filename, *p;
    const char *r;
    int len;

    if (name[0] != '.') {
        /* if no initial dot, the module name is not modified */
        return js_strdup(ctx, name);
    }

    /* Normalize base_name. This is the path to the importing module, and
     * it should have the platform native path separator.
     */
    tjs__normalize_pathsep(name);

    p = strrchr(base_name, TJS__PATHSEP);
    if (p) {
        len = p - base_name;
    } else {
        len = 0;
    }

    filename = js_malloc(ctx, len + strlen(name) + 1 + 1);
    if (!filename) {
        return NULL;
    }
    memcpy(filename, base_name, len);
    filename[len] = '\0';

    /* we only normalize the leading '..' or '.' */
    r = name;
    for (;;) {
        if (r[0] == '.' && r[1] == TJS__PATHSEP_POSIX) {
            r += 2;
        } else if (r[0] == '.' && r[1] == '.' && r[2] == TJS__PATHSEP_POSIX) {
            /* remove the last path element of filename, except if "."
               or ".." */
            if (filename[0] == '\0') {
                break;
            }
            p = strrchr(filename, TJS__PATHSEP);
            if (!p) {
                p = filename;
            } else {
                p++;
            }
            if (!strcmp(p, ".") || !strcmp(p, "..")) {
                break;
            }
            if (p > filename) {
                p--;
            }
            *p = '\0';
            r += 3;
        } else {
            break;
        }
    }
    if (filename[0] != '\0') {
        strcat(filename, TJS__PATHSEP_STR);
    }
    strcat(filename, r);

    /* Re-normalize the path. The name part will have posix style paths, so
     * normalize it to the platform native separator.
     */
    tjs__normalize_pathsep(filename);

    return filename;
}

#undef TJS__PATHSEP
#undef TJS__PATHSEP_STR
#undef TJS__PATHSEP_POSIX

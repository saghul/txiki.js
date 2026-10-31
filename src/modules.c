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
#include "quickjs.h"
#include "tjs.h"
#include "utils.h"

#include <string.h>


static int has_suffix(const char *str, const char *suffix) {
    size_t len = strlen(str);
    size_t slen = strlen(suffix);
    return (len >= slen && !memcmp(str + len - slen, suffix, slen));
}

static int default_module_init(JSContext *ctx, JSModuleDef *m) {
    JSValue val;
    val = JS_GetModulePrivateValue(ctx, m);
    JS_SetModuleExport(ctx, m, "default", val);
    return 0;
}

static JSModuleDef *create_default_module(JSContext *ctx, const char *module_name, JSValue val) {
    JSModuleDef *m;
    m = JS_NewCModule(ctx, module_name, default_module_init);
    if (!m) {
        JS_FreeValue(ctx, val);
        return NULL;
    }
    /* only export the "default" symbol which will contain the val object */
    JS_AddModuleExport(ctx, m, "default");
    JS_SetModulePrivateValue(ctx, m, val);
    return m;
}

enum {
    JS_IMPORT_TYPE_JS,
    JS_IMPORT_TYPE_JSON,
    JS_IMPORT_TYPE_TEXT,
    JS_IMPORT_TYPE_BYTES,
};

/* return > 0 if the attributes indicate a JSON module, 0 otherwise, -1 on error */
static int detect_module_type(JSContext *ctx, const char *module_name, JSValueConst attributes) {
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
        return has_suffix(module_name, ".json") ? JS_IMPORT_TYPE_JSON : JS_IMPORT_TYPE_JS;
    }
    cstr = JS_ToCStringLen(ctx, &len, str);
    JS_FreeValue(ctx, str);
    if (!cstr) {
        return -1;
    }
    if (len == 4 && !memcmp(cstr, "json", len)) {
        res = JS_IMPORT_TYPE_JSON;
    } else if (len == 4 && !memcmp(cstr, "text", len)) {
        res = JS_IMPORT_TYPE_TEXT;
    } else if (len == 5 && !memcmp(cstr, "bytes", len)) {
        res = JS_IMPORT_TYPE_BYTES;
    } else {
        /* unknown type - throw error */
        JS_ThrowTypeError(ctx, "unsupported module type: '%s'", cstr);
        res = -1;
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
    static const char tjs_internal_prefix[] = "tjs:internal/";

    JSModuleDef *m;
    JSValue val;
    int r;
    int type;
    bool use_realpath = false;
    TBuf dbuf;

    if (strncmp(tjs_internal_prefix, module_name, strlen(tjs_internal_prefix)) == 0) {
        TJSRuntime *qrt = TJS_GetRuntime(ctx);
        CHECK_NOT_NULL(qrt);
        if (strcmp(module_name, "tjs:internal/core") == 0) {
            return create_default_module(ctx, module_name, JS_DupValue(ctx, qrt->builtins.internal_core));
        }
        if (strcmp(module_name, "tjs:internal/worker") == 0) {
            return create_default_module(ctx, module_name, JS_DupValue(ctx, qrt->builtins.internal_message_pipe));
        }
        return tjs__load_builtin(ctx, module_name);
    }

    if (strncmp(tjs_prefix, module_name, strlen(tjs_prefix)) == 0) {
        return tjs__load_builtin(ctx, module_name);
    }

    type = detect_module_type(ctx, module_name, attributes);
    if (type < 0) {
        return NULL;
    }

    tbuf_init(ctx, &dbuf);

    if (strncmp(http, module_name, strlen(http)) == 0 || strncmp(https, module_name, strlen(https)) == 0) {
        TJSRuntime *qrt = TJS_GetRuntime(ctx);
        r = tjs__lws_load_http(qrt, &dbuf, module_name);
        if (r != 200) {
            if (r == -2) {
                val = JS_ThrowReferenceError(ctx, "could not load '%s': request timed out", module_name);
            } else if (r < 0) {
                val = JS_ThrowReferenceError(ctx, "could not load '%s': network error", module_name);
            } else {
                /* http error */
                val = JS_ThrowReferenceError(ctx, "could not load '%s': %d", module_name, r);
            }
            goto after_load;
        }
        use_realpath = false;
    } else {
        r = tjs__load_file(ctx, &dbuf, module_name);
        if (r != 0) {
            val = JS_ThrowReferenceError(ctx, "could not load '%s'", module_name);
            goto after_load;
        }
        use_realpath = true;
    }

    /* Add null termination, required by JS_Eval / JS_ParseJSON. */
    tbuf_putc(&dbuf, '\0');

    /* Now load the module for real. */
    switch (type) {
        case JS_IMPORT_TYPE_JS:
            val = JS_Eval(ctx,
                          (char *) dbuf.buf,
                          dbuf.size - 1,
                          module_name,
                          JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
            break;
        case JS_IMPORT_TYPE_JSON:
            val = JS_ParseJSON(ctx, (char *) dbuf.buf, dbuf.size - 1, module_name);
            break;
        case JS_IMPORT_TYPE_TEXT:
            val = JS_NewStringLen(ctx, (char *) dbuf.buf, dbuf.size - 1);
            break;
        case JS_IMPORT_TYPE_BYTES:
            val = TJS_NewUint8Array(ctx, dbuf.buf, dbuf.size - 1);
            break;
        default:
            val = JS_ThrowPlainError(ctx, "unsupported import type");
            break;
    }

after_load:
    if (type != JS_IMPORT_TYPE_BYTES) {
        tbuf_free(&dbuf);
    }

    if (JS_IsException(val)) {
        return NULL;
    }

    if (type == JS_IMPORT_TYPE_JS) {
        r = js_module_set_import_meta(ctx, val, use_realpath, false);
        if (r != 0) {
            JS_FreeValue(ctx, val);
            return NULL;
        }

        /* the module is already referenced, so we must free it */
        m = JS_VALUE_GET_PTR(val);
        JS_FreeValue(ctx, val);
    } else {
        m = create_default_module(ctx, module_name, val);
    }

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
    char buf[TJS_PATH_MAX + 16] = { 0 };
    int r;
    JSValue meta_obj;
    JSAtom module_name_atom;
    const char *module_name;
    char module_dirname[TJS_PATH_MAX] = { 0 };
    char module_basename[TJS_PATH_MAX] = { 0 };

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
        tjs__pstrcpy(buf, sizeof(buf), "file://");
        tjs__pstrcat(buf, sizeof(buf), req.ptr);
        uv_fs_req_cleanup(&req);

        // When using realpath we have the opportunity to extract the dirname
        // and basename and add them to the meta. Since the path is now absolute
        // all we need to do is split on the last path separator.
        const char *start = buf + 7; /* skip file:// */
        const char *p = strrchr(start, TJS__PATHSEP);
        strncpy(module_dirname, start, p - start);
        strcpy(module_basename, p + 1);
    } else {
        tjs__pstrcat(buf, sizeof(buf), module_name);
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

bool tjs__is_file_url(const char *s) {
    return strncasecmp(s, "file://", 7) == 0;
}

static int tjs__hexval(char c) {
    if (c >= '0' && c <= '9') {
        return c - '0';
    }
    if (c >= 'a' && c <= 'f') {
        return c - 'a' + 10;
    }
    if (c >= 'A' && c <= 'F') {
        return c - 'A' + 10;
    }
    return -1;
}

#if defined(_WIN32)
static bool tjs__is_drive_letter(const char *p) {
    return ((p[0] >= 'A' && p[0] <= 'Z') || (p[0] >= 'a' && p[0] <= 'z')) && p[1] == ':' &&
           (p[2] == '\0' || p[2] == '/' || p[2] == '\\');
}
#endif

char *tjs__file_url_to_path(JSContext *ctx, const char *url) {
    const char *path, *end;
    char *out, *q;

    CHECK(tjs__is_file_url(url));

    path = url + 7;
#if defined(_WIN32)
    /* import.meta.url on Windows has the form file://C:\x\y.js, with no host. */
    if (!tjs__is_drive_letter(path))
#endif
    {
        const char *host = path;
        size_t host_len = strcspn(host, "/?#");
        if (host_len != 0 && !(host_len == 9 && strncasecmp(host, "localhost", 9) == 0)) {
            JS_ThrowTypeError(ctx, "unsupported file URL host in '%s'", url);
            return NULL;
        }
        path = host + host_len;
    }

    end = path + strcspn(path, "?#");
    if (end == path) {
        JS_ThrowTypeError(ctx, "invalid file URL '%s'", url);
        return NULL;
    }

    out = js_malloc(ctx, end - path + 1);
    if (!out) {
        return NULL;
    }

    for (q = out; path < end; path++) {
        char c = *path;
        if (c == '%') {
            int hi = tjs__hexval(path[1]);
            int lo = hi < 0 ? -1 : tjs__hexval(path[2]);
            if (lo < 0 || (hi == 0 && lo == 0)) {
                js_free(ctx, out);
                JS_ThrowTypeError(ctx, "invalid file URL '%s'", url);
                return NULL;
            }
            c = (char) ((hi << 4) | lo);
            path += 2;
        }
        *q++ = c;
    }
    *q = '\0';

#if defined(_WIN32)
    if (out[0] == '/' && tjs__is_drive_letter(out + 1)) {
        memmove(out, out + 1, strlen(out));
    }
    for (q = out; *q; q++) {
        if (*q == '/') {
            *q = '\\';
        }
    }
#endif

    return out;
}

char *tjs_module_normalizer(JSContext *ctx, const char *base_name, const char *name, void *opaque) {
    char *filename, *p;
    const char *r;
    int len;

    /* Modules under the tjs:internal/ namespace are only importable from
     * other tjs: modules (the bundled polyfills/bootstrap/run-main/
     * run-repl/worker-bootstrap bundles, the stdlib tjs: modules, and the
     * synthesized internal modules — all of which carry a 'tjs:' module
     * name). User files have file:// or http(s):// URLs and never match. */
    if (strncmp(name, "tjs:internal/", 13) == 0 && base_name && strncmp(base_name, "tjs:", 4) != 0) {
        JS_ThrowReferenceError(ctx, "module '%s' is not exposed to user code", name);
        return NULL;
    }

    if (name[0] != '.') {
        /* Check import map resolver before passing bare specifiers through. */
        TJSRuntime *qrt = opaque;
        if (qrt && JS_IsFunction(ctx, qrt->builtins.import_map_resolver)) {
            JSValue args[2] = { JS_NewString(ctx, name), JS_NewString(ctx, base_name) };
            JSValue result = JS_Call(ctx, qrt->builtins.import_map_resolver, JS_UNDEFINED, 2, args);
            JS_FreeValue(ctx, args[0]);
            JS_FreeValue(ctx, args[1]);
            if (JS_IsException(result)) {
                return NULL;
            }
            if (JS_IsString(result)) {
                const char *resolved = JS_ToCString(ctx, result);
                JS_FreeValue(ctx, result);
                if (!resolved) {
                    return NULL;
                }
                char *ret = tjs__is_file_url(resolved) ? tjs__file_url_to_path(ctx, resolved) : js_strdup(ctx, resolved);
                JS_FreeCString(ctx, resolved);
                return ret;
            }
            if (JS_IsNull(result)) {
                JS_FreeValue(ctx, result);
                JS_ThrowReferenceError(ctx, "import of '%s' was blocked by import map", name);
                return NULL;
            }
            JS_FreeValue(ctx, result);
        }
        /* file:// URLs are keyed by native path, so a module imported both by
         * URL and by path is a single instance. */
        if (tjs__is_file_url(name)) {
            return tjs__file_url_to_path(ctx, name);
        }
        /* if no initial dot and no import map match, the module name is not modified */
        return js_strdup(ctx, name);
    }

    /* Normalize base_name. This is the path to the importing module, and
     * it should have the platform native path separator.
     */
    tjs__normalize_pathsep(name);

    r = strrchr(base_name, TJS__PATHSEP);
    if (r) {
        len = r - base_name;
    } else {
        len = 0;
    }

    int filename_size = len + strlen(name) + 1 + 1;
    filename = js_malloc(ctx, filename_size);
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
        tjs__pstrcat(filename, filename_size, TJS__PATHSEP_STR);
    }
    tjs__pstrcat(filename, filename_size, r);

    /* Re-normalize the path. The name part will have posix style paths, so
     * normalize it to the platform native separator.
     */
    tjs__normalize_pathsep(filename);

    return filename;
}

#undef TJS__PATHSEP
#undef TJS__PATHSEP_STR
#undef TJS__PATHSEP_POSIX

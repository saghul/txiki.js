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


JSModuleDef *tjs__load_http(JSContext *ctx, const char *url) {
    JSModuleDef *m;
    DynBuf dbuf;

    tjs_dbuf_init(ctx, &dbuf);

    int r = tjs_curl_load_http(&dbuf, url);
    if (r != 200) {
        m = NULL;
        if (r < 0) {
            /* curl error */
            JS_ThrowReferenceError(ctx, "could not load '%s': %s", url, curl_easy_strerror(-r));
        } else {
            /* http error */
            JS_ThrowReferenceError(ctx, "could not load '%s': %d", url, r);
        }
        goto end;
    }

    /* compile the module */
    JSValue func_val =
        JS_Eval(ctx, (char *) dbuf.buf, dbuf.size - 1, url, JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
    if (JS_IsException(func_val)) {
        JS_FreeValue(ctx, func_val);
        m = NULL;
        goto end;
    }

    /* XXX: could propagate the exception */
    js_module_set_import_meta(ctx, func_val, FALSE, FALSE);
    /* the module is already referenced, so we must free it */
    m = JS_VALUE_GET_PTR(func_val);
    JS_FreeValue(ctx, func_val);

end:
    /* free the memory we allocated */
    dbuf_free(&dbuf);

    return m;
}

JSModuleDef *tjs_module_loader(JSContext *ctx, const char *module_name, void *opaque) {
    static const char http[] = "http://";
    static const char https[] = "https://";
    static const char json_tpl_start[] = "export default JSON.parse(`";
    static const char json_tpl_end[] = "`);";
    static const char tjs_prefix[] = "tjs:";

    JSModuleDef *m;
    JSValue func_val;
    int r, is_json;
    DynBuf dbuf;

    if (strncmp(tjs_prefix, module_name, strlen(tjs_prefix)) == 0) {
        return tjs__load_builtin(ctx, module_name);
    }

    if (strncmp(http, module_name, strlen(http)) == 0 || strncmp(https, module_name, strlen(https)) == 0) {
        return tjs__load_http(ctx, module_name);
    }

    tjs_dbuf_init(ctx, &dbuf);

    is_json = has_suffix(module_name, ".json");

    /* Support importing JSON files because... why not? */
    if (is_json)
        dbuf_put(&dbuf, (const uint8_t *) json_tpl_start, strlen(json_tpl_start));

    r = tjs__load_file(ctx, &dbuf, module_name);
    if (r != 0) {
        dbuf_free(&dbuf);
        JS_ThrowReferenceError(ctx, "could not load '%s'", module_name);
        return NULL;
    }

    if (is_json)
        dbuf_put(&dbuf, (const uint8_t *) json_tpl_end, strlen(json_tpl_end));

    /* Add null termination, required by JS_Eval. */
    dbuf_putc(&dbuf, '\0');

    /* compile JS the module */
    func_val =
        JS_Eval(ctx, (char *) dbuf.buf, dbuf.size - 1, module_name, JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
    dbuf_free(&dbuf);
    if (JS_IsException(func_val)) {
        JS_FreeValue(ctx, func_val);
        return NULL;
    }

    /* XXX: could propagate the exception */
    js_module_set_import_meta(ctx, func_val, TRUE, FALSE);
    /* the module is already referenced, so we must free it */
    m = JS_VALUE_GET_PTR(func_val);
    JS_FreeValue(ctx, func_val);

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

int js_module_set_import_meta(JSContext *ctx, JSValue func_val, JS_BOOL use_realpath, JS_BOOL is_main) {
    JSModuleDef *m;
    char buf[PATH_MAX + 16] = { 0 };
    int r;
    JSValue meta_obj;
    JSAtom module_name_atom;
    const char *module_name;
    char module_dirname[PATH_MAX] = { 0 };
    char module_basename[PATH_MAX] = { 0 };

    CHECK_EQ(JS_VALUE_GET_TAG(func_val), JS_TAG_MODULE);
    m = JS_VALUE_GET_PTR(func_val);

    module_name_atom = JS_GetModuleName(ctx, m);
    module_name = JS_AtomToCString(ctx, module_name_atom);
#if 0
    fprintf(stdout, "XXX loaded module: %s\n", module_name);
#endif
    JS_FreeAtom(ctx, module_name_atom);
    if (!module_name)
        return -1;

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
        pstrcpy(buf, sizeof(buf), "file://");
        pstrcat(buf, sizeof(buf), req.ptr);
        uv_fs_req_cleanup(&req);

        // When using realpath we have the opportunity to extract the dirname
        // and basename and add them to the meta. Since the path is now absolute
        // all we need to do is split on the last path separator.
        const char *start = buf + 7; /* skip file:// */
        char *p = strrchr(start, TJS__PATHSEP);
        strncpy(module_dirname, start, p - start);
        strcpy(module_basename, p + 1);
    } else {
        pstrcat(buf, sizeof(buf), module_name);
    }

    JS_FreeCString(ctx, module_name);

    meta_obj = JS_GetImportMeta(ctx, m);
    if (JS_IsException(meta_obj))
        return -1;
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
    if (p)
        len = p - base_name;
    else
        len = 0;

    filename = js_malloc(ctx, len + strlen(name) + 1 + 1);
    if (!filename)
        return NULL;
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
            if (filename[0] == '\0')
                break;
            p = strrchr(filename, TJS__PATHSEP);
            if (!p)
                p = filename;
            else
                p++;
            if (!strcmp(p, ".") || !strcmp(p, ".."))
                break;
            if (p > filename)
                p--;
            *p = '\0';
            r += 3;
        } else {
            break;
        }
    }
    if (filename[0] != '\0')
        strcat(filename, TJS__PATHSEP_STR);
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

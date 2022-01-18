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


#ifdef TJS_HAVE_CURL

JSModuleDef *tjs__load_http(JSContext *ctx, const char *url) {
    JSModuleDef *m;
    DynBuf dbuf;

    dbuf_init(&dbuf);

    int r = tjs_curl_load_http(&dbuf, url);
    if (r != 200) {
        m = NULL;
        JS_ThrowReferenceError(ctx, "could not load '%s' code: %d", url, r);
        goto end;
    }

    /* compile the module */
    JSValue func_val = JS_Eval(ctx, (char *) dbuf.buf, dbuf.size - 1, url, JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
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

#endif

JSModuleDef *tjs_module_loader(JSContext *ctx, const char *module_name, void *opaque) {
    static const char http[] = "http://";
    static const char https[] = "https://";
    static const char json_tpl_start[] = "export default JSON.parse(`";
    static const char json_tpl_end[] = "`);";

    JSModuleDef *m;
    JSValue func_val;
    int r, is_json;
    DynBuf dbuf;

    if (strncmp(http, module_name, strlen(http)) == 0 || strncmp(https, module_name, strlen(https)) == 0) {
#ifdef TJS_HAVE_CURL
        return tjs__load_http(ctx, module_name);
#else
        JS_ThrowReferenceError(ctx, "could not load '%s', libcurl support not enabled", module_name);
        return NULL;
#endif
    }

    dbuf_init(&dbuf);

    is_json = has_suffix(module_name, ".json");

    /* Support importing JSON files bcause... why not? */
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
    func_val = JS_Eval(ctx, (char *) dbuf.buf, dbuf.size - 1, module_name, JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
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

int js_module_set_import_meta(JSContext *ctx, JSValueConst func_val, JS_BOOL use_realpath, JS_BOOL is_main) {
    JSModuleDef *m;
    char buf[PATH_MAX + 16];
    int r;
    JSValue meta_obj;
    JSAtom module_name_atom;
    const char *module_name;

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
    if (!strchr(module_name, ':')) {
        pstrcpy(buf, sizeof(buf), "file://");
        /* realpath() cannot be used with modules compiled with qjsc
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
            pstrcat(buf, sizeof(buf), req.ptr);
            uv_fs_req_cleanup(&req);
        } else {
            pstrcat(buf, sizeof(buf), module_name);
        }
    } else {
        pstrcpy(buf, sizeof(buf), module_name);
    }
    JS_FreeCString(ctx, module_name);

    meta_obj = JS_GetImportMeta(ctx, m);
    if (JS_IsException(meta_obj))
        return -1;
    JS_DefinePropertyValueStr(ctx, meta_obj, "url", JS_NewString(ctx, buf), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, meta_obj, "main", JS_NewBool(ctx, is_main), JS_PROP_C_W_E);
    JS_FreeValue(ctx, meta_obj);
    return 0;
}

#if defined(_WIN32)
#define TJS__PATHSEP  '\\'
#define TJS__PATHSEPS "\\"
#else
#define TJS__PATHSEP  '/'
#define TJS__PATHSEPS "/"
#endif

char *tjs_module_normalizer(JSContext *ctx, const char *base_name, const char *name, void *opaque) {
    static char *internal_modules[] = {
        "@tjs/core"
    };

    TJSRuntime *qrt = opaque;
    CHECK_NOT_NULL(qrt);

    // printf("normalize: %s %s\n", base_name, name);

    if (!qrt->in_bootstrap && name[0] == '@') {
        /* check if it's an internal module, those cannot be imported */
        for (int i = 0; i < ARRAY_SIZE(internal_modules); i++) {
            if (strncmp(internal_modules[i], name, strlen(internal_modules[i])) == 0) {
                JS_ThrowReferenceError(ctx, "could not load '%s', it's an internal module", name);
                return NULL;
            }
        }
    }

    char *filename, *p;
    const char *r;
    int len;

    if (name[0] != '.') {
        /* if no initial dot, the module name is not modified */
        return js_strdup(ctx, name);
    }

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
        if (r[0] == '.' && r[1] == '/') {
            r += 2;
        } else if (r[0] == '.' && r[1] == '.' && r[2] == '/') {
            /* remove the last path element of filename, except if "."
               or ".." */
            if (filename[0] == '\0')
                break;
            p = strrchr(filename, '/');
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
        strcat(filename, "/");
    strcat(filename, r);
#if defined(_WIN32)
    for (p = filename; *p; p++) {
        if (p[0] == '/')
            p[0] = '\\';
    }
    // printf("normalize: %s %s -> %s\n", base_name, name, filename);
#endif
    return filename;
}

#undef TJS__PATHSEP

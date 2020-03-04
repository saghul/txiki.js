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


int tjs__path_dirname(const char *path, char *buffer, size_t *size);
int tjs__path_basename(const char *path, char *buffer, size_t *size);

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
    JSValue func_val = JS_Eval(ctx, (char *) dbuf.buf, dbuf.size, url, JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
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

    JSModuleDef *m;
    JSValue func_val;
    int r;
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
    r = tjs__load_file(ctx, &dbuf, module_name);
    if (r != 0) {
        dbuf_free(&dbuf);
        JS_ThrowReferenceError(ctx, "could not load '%s'", module_name);
        return NULL;
    }

    /* Add null termination, required by JS_Eval. */
    dbuf_putc(&dbuf, '\0');

    /* compile the module */
    func_val = JS_Eval(ctx, (char *) dbuf.buf, dbuf.size, module_name, JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
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
    char dirname_buf[PATH_MAX];
    char *dirname_ptr = NULL;
    char basename_buf[PATH_MAX];
    char *basename_ptr = NULL;

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

#ifndef _WIN32
            size_t s = sizeof(dirname_buf);
            if (tjs__path_dirname(buf + 7 /* Skip 'file://' */, dirname_buf, &s) == 0)
                dirname_ptr = dirname_buf;
            s = sizeof(basename_buf);
            if (tjs__path_basename(buf, basename_buf, &s) == 0)
                basename_ptr = basename_buf;
#endif

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
    if (dirname_ptr)
        JS_DefinePropertyValueStr(ctx, meta_obj, "dirname", JS_NewString(ctx, dirname_ptr), JS_PROP_C_W_E);
    if (basename_ptr)
        JS_DefinePropertyValueStr(ctx, meta_obj, "basename", JS_NewString(ctx, basename_ptr), JS_PROP_C_W_E);
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
        "@tjs/abort-controller",
        "@tjs/bootstrap",
        "@tjs/bootstrap2",
        "@tjs/console",
        "@tjs/core",
        "@tjs/crypto",
        "@tjs/event-target",
        "@tjs/performance"
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

/*
 * Based on the Android implementation, BSD licensed.
 * Check http://android.git.kernel.org/
 */
int tjs__path_dirname(const char *path, char *buffer, size_t *size)
{
	const char *endp;
	int is_prefix = 0, len;

    if (!buffer || !size || *size == 0) {
        return -1;
    }

	/* Empty or NULL string gets treated as "." */
	if (path == NULL || *path == '\0') {
		path = ".";
		len = 1;
		goto end;
	}

	/* Strip trailing slashes */
	endp = path + strlen(path) - 1;
	while (endp > path && *endp == '/')
		endp--;

	if (endp - path + 1 > INT_MAX) {
        return -1;
	}

	/* Find the start of the dir */
	while (endp > path && *endp != '/')
		endp--;

	/* Either the dir is "/" or there are no slashes */
	if (endp == path) {
		path = (*endp == '/') ? "/" : ".";
		len = 1;
		goto end;
	}

	do {
		endp--;
	} while (endp > path && *endp == '/');

	if (endp - path + 1 > INT_MAX) {
        return -1;
	}

	/* Cast is safe because max path < max int */
	len = (int)(endp - path + 1);

end:
    if (*size < len + 1) {
        *size = len + 1;
        return -1;
    }

    memcpy(buffer, path, len);
    buffer[len] = '\0';

	return 0;
}

int tjs__path_basename(const char *path, char *buffer, size_t *size)
{
	const char *endp, *startp;
	int len;

    if (!buffer || !size || *size == 0) {
        return -1;
    }

	/* Empty or NULL string gets treated as "." */
	if (path == NULL || *path == '\0') {
		startp = ".";
		len		= 1;
		goto end;
	}

	/* Strip trailing slashes */
	endp = path + strlen(path) - 1;
	while (endp > path && *endp == '/')
		endp--;

	/* All slashes becomes "/" */
	if (endp == path && *endp == '/') {
		startp = "/";
		len	= 1;
		goto end;
	}

	/* Find the start of the base */
	startp = endp;
	while (startp > path && *(startp - 1) != '/')
		startp--;

	/* Cast is safe because max path < max int */
	len = (int)(endp - startp + 1);

end:
    if (*size < len + 1) {
        *size = len + 1;
        return -1;
    }

    memcpy(buffer, startp, len);
    buffer[len] = '\0';

	return 0;
}

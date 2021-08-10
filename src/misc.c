/*
 * QuickJS libuv bindings
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
#include "utils.h"
#include "version.h"

#include <string.h>
#include <unistd.h>

#ifdef TJS_HAVE_CURL
#include <curl/curl.h>
#endif


static JSValue tjs_hrtime(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    return JS_NewBigUint64(ctx, uv_hrtime());
}

static JSValue tjs_gettimeofday(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    uv_timeval64_t tv;
    int r = uv_gettimeofday(&tv);
    if (r != 0)
        return tjs_throw_errno(ctx, r);
    return JS_NewInt64(ctx, tv.tv_sec * 1000 + (tv.tv_usec / 1000));
}

static JSValue tjs_uname(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    JSValue obj;
    int r;
    uv_utsname_t utsname;

    r = uv_os_uname(&utsname);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    obj = JS_NewObjectProto(ctx, JS_NULL);
    JS_DefinePropertyValueStr(ctx, obj, "sysname", JS_NewString(ctx, utsname.sysname), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, obj, "release", JS_NewString(ctx, utsname.release), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, obj, "version", JS_NewString(ctx, utsname.version), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, obj, "machine", JS_NewString(ctx, utsname.machine), JS_PROP_C_W_E);

    return obj;
}

static JSValue tjs_isatty(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    int fd, type;
    if (JS_ToInt32(ctx, &fd, argv[0]))
        return JS_EXCEPTION;

    type = uv_guess_handle(fd);
    return JS_NewBool(ctx, type == UV_TTY);
}

static JSValue tjs_environ(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    uv_env_item_t *env;
    int envcount, r;

    r = uv_os_environ(&env, &envcount);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);

    for (int i = 0; i < envcount; i++) {
        JS_DefinePropertyValueStr(ctx, obj, env[i].name, JS_NewString(ctx, env[i].value), JS_PROP_C_W_E);
    }

    uv_os_free_environ(env, envcount);

    return obj;
}

static JSValue tjs_getenv(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *name = JS_ToCString(ctx, argv[0]);
    if (!name)
        return JS_EXCEPTION;

    char buf[1024];
    size_t size = sizeof(buf);
    char *dbuf = buf;
    int r;

    r = uv_os_getenv(name, dbuf, &size);
    if (r != 0) {
        if (r != UV_ENOBUFS)
            return tjs_throw_errno(ctx, r);
        dbuf = js_malloc(ctx, size);
        if (!dbuf)
            return JS_EXCEPTION;
        r = uv_os_getenv(name, dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            return tjs_throw_errno(ctx, r);
        }
    }

    JSValue ret = JS_NewStringLen(ctx, dbuf, size);

    if (dbuf != buf)
        js_free(ctx, dbuf);

    return ret;
}

static JSValue tjs_setenv(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *name = JS_ToCString(ctx, argv[0]);
    if (!name)
        return JS_EXCEPTION;

    const char *value = JS_ToCString(ctx, argv[1]);
    if (!value)
        return JS_EXCEPTION;

    int r = uv_os_setenv(name, value);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static JSValue tjs_unsetenv(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *name = JS_ToCString(ctx, argv[0]);
    if (!name)
        return JS_EXCEPTION;

    int r = uv_os_unsetenv(name);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static JSValue tjs_cwd(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    char buf[1024];
    size_t size = sizeof(buf);
    char *dbuf = buf;
    int r;

    r = uv_cwd(dbuf, &size);
    if (r != 0) {
        if (r != UV_ENOBUFS)
            return tjs_throw_errno(ctx, r);
        dbuf = js_malloc(ctx, size);
        if (!dbuf)
            return JS_EXCEPTION;
        r = uv_cwd(dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            return tjs_throw_errno(ctx, r);
        }
    }

    JSValue ret = JS_NewStringLen(ctx, dbuf, size);

    if (dbuf != buf)
        js_free(ctx, dbuf);

    return ret;
}

static JSValue tjs_homedir(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    char buf[1024];
    size_t size = sizeof(buf);
    char *dbuf = buf;
    int r;

    r = uv_os_homedir(dbuf, &size);
    if (r != 0) {
        if (r != UV_ENOBUFS)
            return tjs_throw_errno(ctx, r);
        dbuf = js_malloc(ctx, size);
        if (!dbuf)
            return JS_EXCEPTION;
        r = uv_os_homedir(dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            return tjs_throw_errno(ctx, r);
        }
    }

    JSValue ret = JS_NewStringLen(ctx, dbuf, size);

    if (dbuf != buf)
        js_free(ctx, dbuf);

    return ret;
}

static JSValue tjs_tmpdir(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    char buf[1024];
    size_t size = sizeof(buf);
    char *dbuf = buf;
    int r;

    r = uv_os_tmpdir(dbuf, &size);
    if (r != 0) {
        if (r != UV_ENOBUFS)
            return tjs_throw_errno(ctx, r);
        dbuf = js_malloc(ctx, size);
        if (!dbuf)
            return JS_EXCEPTION;
        r = uv_os_tmpdir(dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            return tjs_throw_errno(ctx, r);
        }
    }

    JSValue ret = JS_NewStringLen(ctx, dbuf, size);

    if (dbuf != buf)
        js_free(ctx, dbuf);

    return ret;
}

static JSValue tjs_exepath(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    char buf[1024];
    size_t size = sizeof(buf);
    char *dbuf = buf;
    int r;

    r = uv_exepath(dbuf, &size);
    if (r != 0) {
        if (r != UV_ENOBUFS)
            return tjs_throw_errno(ctx, r);
        dbuf = js_malloc(ctx, size);
        if (!dbuf)
            return JS_EXCEPTION;
        r = uv_exepath(dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            return tjs_throw_errno(ctx, r);
        }
    }

    JSValue ret = JS_NewStringLen(ctx, dbuf, size);

    if (dbuf != buf)
        js_free(ctx, dbuf);

    return ret;
}

static JSValue tjs_print(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv, int magic) {
    int i;
    const char *str;
    FILE *f = magic == 0 ? stdout : stderr;

    for (i = 0; i < argc; i++) {
        if (i != 0)
            fputc(' ', f);
        str = JS_ToCString(ctx, argv[i]);
        if (!str)
            return JS_EXCEPTION;
        fputs(str, f);
        JS_FreeCString(ctx, str);
    }
    fputc('\n', f);

    return JS_UNDEFINED;
}

static JSValue tjs_prompt(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    JSValue str;

    const char *message = NULL;
    const char *default_value = NULL;
    char buf[4096];

    if (argc > 0) {
        message = JS_ToCString(ctx, argv[0]);
        if (!message) {
            return JS_EXCEPTION;
        }
    }

    if (argc > 1) {
        default_value = JS_ToCString(ctx, argv[1]);
    }

    if (message) {
        fputs(message, stdout);
    }

    if (fgets(buf, sizeof(buf), stdin) != NULL) {
        size_t len = strcspn(buf, "\r\n"); /* skip newline */
        if (len == 0) {
            goto use_default;
        }
        str = JS_NewStringLen(ctx, buf, len);
    } else {
use_default:
        if (default_value != NULL) {
            str = JS_NewString(ctx, default_value);
        } else {
            str = JS_UNDEFINED;
        }
    }

    if (message) {
        JS_FreeCString(ctx, message);
    }
    if (default_value) {
        JS_FreeCString(ctx, default_value);
    }

    return str;
}

static JSValue tjs_random(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    size_t size;
    uint8_t *buf = JS_GetArrayBuffer(ctx, &size, argv[0]);
    if (!buf)
        return JS_EXCEPTION;

    uint64_t off = 0;
    if (!JS_IsUndefined(argv[1]) && JS_ToIndex(ctx, &off, argv[1]))
        return JS_EXCEPTION;

    uint64_t len = size;
    if (!JS_IsUndefined(argv[2]) && JS_ToIndex(ctx, &len, argv[2]))
        return JS_EXCEPTION;

    if (off + len > size)
        return JS_ThrowRangeError(ctx, "array buffer overflow");

    int r = uv_random(NULL, NULL, buf + off, len, 0, NULL);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_misc_funcs[] = {
    TJS_CONST(AF_INET),
    TJS_CONST(AF_INET6),
    TJS_CONST(AF_UNSPEC),
    TJS_CONST(STDIN_FILENO),
    TJS_CONST(STDOUT_FILENO),
    TJS_CONST(STDERR_FILENO),
    JS_CFUNC_DEF("hrtime", 0, tjs_hrtime),
    JS_CFUNC_DEF("gettimeofday", 0, tjs_gettimeofday),
    JS_CFUNC_DEF("uname", 0, tjs_uname),
    JS_CFUNC_DEF("isatty", 1, tjs_isatty),
    JS_CFUNC_DEF("environ", 0, tjs_environ),
    JS_CFUNC_DEF("getenv", 0, tjs_getenv),
    JS_CFUNC_DEF("setenv", 2, tjs_setenv),
    JS_CFUNC_DEF("unsetenv", 1, tjs_unsetenv),
    JS_CFUNC_DEF("cwd", 0, tjs_cwd),
    JS_CFUNC_DEF("homedir", 0, tjs_homedir),
    JS_CFUNC_DEF("tmpdir", 0, tjs_tmpdir),
    JS_CFUNC_DEF("exepath", 0, tjs_exepath),
    JS_CFUNC_MAGIC_DEF("print", 1, tjs_print, 0),
    JS_CFUNC_MAGIC_DEF("printError", 1, tjs_print, 1),
    JS_CFUNC_MAGIC_DEF("alert", 1, tjs_print, 1),
    JS_CFUNC_DEF("prompt", 2, tjs_prompt),
    JS_CFUNC_DEF("random", 3, tjs_random),
};

void tjs_mod_misc_init(JSContext *ctx, JSModuleDef *m) {
    JS_SetModuleExportList(ctx, m, tjs_misc_funcs, countof(tjs_misc_funcs));

    JS_SetModuleExport(ctx, m, "args", tjs__get_args(ctx));

    JS_SetModuleExport(ctx, m, "platform", JS_NewString(ctx, TJS__PLATFORM));

    JS_SetModuleExport(ctx, m, "version", JS_NewString(ctx, tjs_version()));
    JSValue versions = JS_NewObjectProto(ctx, JS_NULL);
    JS_DefinePropertyValueStr(ctx, versions, "quickjs", JS_NewString(ctx, QJS_VERSION_STR), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "tjs", JS_NewString(ctx, tjs_version()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "uv", JS_NewString(ctx, uv_version_string()), JS_PROP_C_W_E);
#ifdef TJS_HAVE_CURL
#ifdef TJS_HAVE_SYSTEM_CURL
    JS_DefinePropertyValueStr(ctx, versions, "curl", JS_NewString(ctx, "system"), JS_PROP_C_W_E);
#else
    JS_DefinePropertyValueStr(ctx, versions, "curl", JS_NewString(ctx, curl_version()), JS_PROP_C_W_E);
#endif
#else
    JS_DefinePropertyValueStr(ctx, versions, "curl", JS_UNDEFINED, JS_PROP_C_W_E);
#endif
    JS_SetModuleExport(ctx, m, "versions", versions);
}

void tjs_mod_misc_export(JSContext *ctx, JSModuleDef *m) {
    JS_AddModuleExportList(ctx, m, tjs_misc_funcs, countof(tjs_misc_funcs));
    JS_AddModuleExport(ctx, m, "args");
    JS_AddModuleExport(ctx, m, "platform");
    JS_AddModuleExport(ctx, m, "version");
    JS_AddModuleExport(ctx, m, "versions");
}

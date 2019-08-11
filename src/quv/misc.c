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

#include <unistd.h>

#include "../cutils.h"
#include "error.h"
#include "misc.h"
#include "utils.h"


static JSValue js_uv_hrtime(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv)
{
    return JS_NewBigUint64(ctx, uv_hrtime());
}

static JSValue js_uv_uname(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv)
{
    JSValue obj;
    int r;
    uv_utsname_t utsname;

    r = uv_os_uname(&utsname);
    if (r != 0)
        return js_uv_throw_errno(ctx, r);

    obj = JS_NewObjectProto(ctx, JS_NULL);
    JS_SetPropertyStr(ctx, obj, "sysname", JS_NewString(ctx, utsname.sysname));
    JS_SetPropertyStr(ctx, obj, "release", JS_NewString(ctx, utsname.release));
    JS_SetPropertyStr(ctx, obj, "version", JS_NewString(ctx, utsname.version));
    JS_SetPropertyStr(ctx, obj, "machine", JS_NewString(ctx, utsname.machine));

    return obj;
}

static JSValue js_uv_isatty(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv)
{
    int fd, type;
    if (JS_ToInt32(ctx, &fd, argv[0]))
        return JS_EXCEPTION;

    type = uv_guess_handle(fd);
    return JS_NewBool(ctx, type == UV_TTY);
}

static JSValue js_uv_environ(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv)
{
    uv_env_item_t *env;
    int envcount, r;

    r = uv_os_environ(&env, &envcount);
    if (r != 0)
        return js_uv_throw_errno(ctx, r);

    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);

    for (int i = 0; i < envcount; i++) {
        JS_SetPropertyStr(ctx, obj, env[i].name, JS_NewString(ctx, env[i].value));
    }

    uv_os_free_environ(env, envcount);

    return obj;
}

static JSValue js_uv_getenv(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv)
{
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
            return js_uv_throw_errno(ctx, r);
        dbuf = js_malloc(ctx, size);
        if (!dbuf)
            return JS_EXCEPTION;
        r = uv_os_getenv(name, dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            return js_uv_throw_errno(ctx, r);
        }
    }

    JSValue ret = JS_NewStringLen(ctx, dbuf, size);

    if (dbuf != buf)
        js_free(ctx, dbuf);

    return ret;
}

static JSValue js_uv_setenv(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv)
{
    const char *name = JS_ToCString(ctx, argv[0]);
    if (!name)
        return JS_EXCEPTION;

    const char *value = JS_ToCString(ctx, argv[1]);
    if (!value)
        return JS_EXCEPTION;

    int r = uv_os_setenv(name, value);
    if (r != 0)
        return js_uv_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static JSValue js_uv_unsetenv(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv)
{
    const char *name = JS_ToCString(ctx, argv[0]);
    if (!name)
        return JS_EXCEPTION;

    int r = uv_os_unsetenv(name);
    if (r != 0)
        return js_uv_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static JSValue js_uv_cwd(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    char buf[1024];
    size_t size = sizeof(buf);
    char *dbuf = buf;
    int r;

    r = uv_cwd(dbuf, &size);
    if (r != 0) {
        if (r != UV_ENOBUFS)
            return js_uv_throw_errno(ctx, r);
        dbuf = js_malloc(ctx, size);
        if (!dbuf)
            return JS_EXCEPTION;
        r = uv_cwd(dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            return js_uv_throw_errno(ctx, r);
        }
    }

    JSValue ret = JS_NewStringLen(ctx, dbuf, size);

    if (dbuf != buf)
        js_free(ctx, dbuf);

    return ret;
}

static JSValue js_uv_homedir(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    char buf[1024];
    size_t size = sizeof(buf);
    char *dbuf = buf;
    int r;

    r = uv_os_homedir(dbuf, &size);
    if (r != 0) {
        if (r != UV_ENOBUFS)
            return js_uv_throw_errno(ctx, r);
        dbuf = js_malloc(ctx, size);
        if (!dbuf)
            return JS_EXCEPTION;
        r = uv_os_homedir(dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            return js_uv_throw_errno(ctx, r);
        }
    }

    JSValue ret = JS_NewStringLen(ctx, dbuf, size);

    if (dbuf != buf)
        js_free(ctx, dbuf);

    return ret;
}

static JSValue js_uv_tmpdir(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    char buf[1024];
    size_t size = sizeof(buf);
    char *dbuf = buf;
    int r;

    r = uv_os_tmpdir(dbuf, &size);
    if (r != 0) {
        if (r != UV_ENOBUFS)
            return js_uv_throw_errno(ctx, r);
        dbuf = js_malloc(ctx, size);
        if (!dbuf)
            return JS_EXCEPTION;
        r = uv_os_tmpdir(dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            return js_uv_throw_errno(ctx, r);
        }
    }

    JSValue ret = JS_NewStringLen(ctx, dbuf, size);

    if (dbuf != buf)
        js_free(ctx, dbuf);

    return ret;
}

static const JSCFunctionListEntry js_uv_misc_funcs[] = {
    JSUV_CONST(AF_INET),
    JSUV_CONST(AF_INET6),
    JSUV_CONST(AF_UNSPEC),
    JSUV_CONST(STDIN_FILENO),
    JSUV_CONST(STDOUT_FILENO),
    JSUV_CONST(STDERR_FILENO),
    JSUV_CONST(UV_TTY_MODE_NORMAL),
    JSUV_CONST(UV_TTY_MODE_RAW),
    JSUV_CONST(UV_TTY_MODE_IO),
    JS_CFUNC_DEF("hrtime", 0, js_uv_hrtime ),
    JS_CFUNC_DEF("uname", 0, js_uv_uname ),
    JS_CFUNC_DEF("isatty", 1, js_uv_isatty ),
    JS_CFUNC_DEF("environ", 0, js_uv_environ ),
    JS_CFUNC_DEF("getenv", 0, js_uv_getenv ),
    JS_CFUNC_DEF("setenv", 2, js_uv_setenv ),
    JS_CFUNC_DEF("unsetenv", 1, js_uv_unsetenv ),
    JS_CFUNC_DEF("cwd", 0, js_uv_cwd ),
    JS_CFUNC_DEF("homedir", 0, js_uv_homedir ),
    JS_CFUNC_DEF("tmpdir", 0, js_uv_tmpdir ),
};

void js_uv_mod_misc_init(JSContext *ctx, JSModuleDef *m) {
    JS_SetModuleExportList(ctx, m, js_uv_misc_funcs, countof(js_uv_misc_funcs));
}

void js_uv_mod_misc_export(JSContext *ctx, JSModuleDef *m) {
    JS_AddModuleExportList(ctx, m, js_uv_misc_funcs, countof(js_uv_misc_funcs));
}

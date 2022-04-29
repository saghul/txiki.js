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

#include <string.h>
#include <unistd.h>


static JSClassID tjs_process_class_id;

typedef struct {
    JSContext *ctx;
    bool closed;
    bool finalized;
    uv_process_t process;
    JSValue stdio[3];
    struct {
        bool exited;
        int64_t exit_status;
        int term_signal;
        TJSPromise result;
    } status;
} TJSProcess;

static void uv__close_cb(uv_handle_t *handle) {
    TJSProcess *p = handle->data;
    CHECK_NOT_NULL(p);
    p->closed = true;
    if (p->finalized)
        free(p);
}

static void maybe_close(TJSProcess *p) {
    if (!uv_is_closing((uv_handle_t *) &p->process))
        uv_close((uv_handle_t *) &p->process, uv__close_cb);
}

static void tjs_process_finalizer(JSRuntime *rt, JSValue val) {
    TJSProcess *p = JS_GetOpaque(val, tjs_process_class_id);
    if (p) {
        TJS_FreePromiseRT(rt, &p->status.result);
        JS_FreeValueRT(rt, p->stdio[0]);
        JS_FreeValueRT(rt, p->stdio[1]);
        JS_FreeValueRT(rt, p->stdio[2]);
        p->finalized = true;
        if (p->closed)
            free(p);
        else
            maybe_close(p);
    }
}

static void tjs_process_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    TJSProcess *p = JS_GetOpaque(val, tjs_process_class_id);
    if (p) {
        TJS_MarkPromise(rt, &p->status.result, mark_func);
        JS_MarkValue(rt, p->stdio[0], mark_func);
        JS_MarkValue(rt, p->stdio[1], mark_func);
        JS_MarkValue(rt, p->stdio[2], mark_func);
    }
}

static JSClassDef tjs_process_class = {
    "Process",
    .finalizer = tjs_process_finalizer,
    .gc_mark = tjs_process_mark,
};

static TJSProcess *tjs_process_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, tjs_process_class_id);
}

static JSValue tjs_process_kill(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSProcess *p = tjs_process_get(ctx, this_val);
    if (!p)
        return JS_EXCEPTION;

    int sig_num = SIGTERM;
    if (!JS_IsUndefined(argv[0])) {
        const char *sig_str = JS_ToCString(ctx, argv[0]);
        sig_num = tjs_getsignum(sig_str);
        JS_FreeCString(ctx, sig_str);

        if (sig_num == -1)
            return JS_ThrowRangeError(ctx, "Invalid signal specified");
    }

    int r = uv_process_kill(&p->process, sig_num);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static JSValue tjs_process_wait(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSProcess *p = tjs_process_get(ctx, this_val);
    if (!p)
        return JS_EXCEPTION;

    if (p->status.exited) {
        JSValue obj = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, obj, "exit_status", JS_NewInt32(ctx, p->status.exit_status), JS_PROP_C_W_E);
        JSValue term_signal = p->status.term_signal == 0 ? JS_NULL : JS_NewString(ctx, tjs_getsig(p->status.term_signal));
        JS_DefinePropertyValueStr(ctx, obj, "term_signal", term_signal, JS_PROP_C_W_E);
        return TJS_NewResolvedPromise(ctx, 1, &obj);
    } else if (p->closed) {
        return JS_UNDEFINED;
    } else {
        return TJS_InitPromise(ctx, &p->status.result);
    }
}

static JSValue tjs_process_pid_get(JSContext *ctx, JSValueConst this_val) {
    TJSProcess *p = tjs_process_get(ctx, this_val);
    if (!p)
        return JS_EXCEPTION;
    return JS_NewInt32(ctx, uv_process_get_pid(&p->process));
}

static JSValue tjs_process_stdio_get(JSContext *ctx, JSValueConst this_val, int magic) {
    TJSProcess *p = tjs_process_get(ctx, this_val);
    if (!p)
        return JS_EXCEPTION;
    return JS_DupValue(ctx, p->stdio[magic]);
}

static void uv__exit_cb(uv_process_t *handle, int64_t exit_status, int term_signal) {
    TJSProcess *p = handle->data;
    CHECK_NOT_NULL(p);

    p->status.exited = true;
    p->status.exit_status = exit_status;
    p->status.term_signal = term_signal;

    if (!JS_IsUndefined(p->status.result.p)) {
        JSContext *ctx = p->ctx;
        JSValue arg = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, arg, "exit_status", JS_NewInt32(ctx, exit_status), JS_PROP_C_W_E);
        JSValue term_signal = p->status.term_signal == 0 ? JS_NULL : JS_NewString(ctx, tjs_getsig(p->status.term_signal));
        JS_DefinePropertyValueStr(ctx, arg, "term_signal", term_signal, JS_PROP_C_W_E);

        TJS_SettlePromise(ctx, &p->status.result, false, 1, (JSValueConst *) &arg);
        TJS_ClearPromise(ctx, &p->status.result);
    }

    maybe_close(p);
}

static JSValue tjs_spawn(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    JSValue ret;

    JSValue obj = JS_NewObjectClass(ctx, tjs_process_class_id);
    if (JS_IsException(obj))
        return obj;

    TJSProcess *p = calloc(1, sizeof(*p));
    if (!p) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    p->ctx = ctx;
    p->process.data = p;

    TJS_ClearPromise(ctx, &p->status.result);

    p->stdio[0] = JS_UNDEFINED;
    p->stdio[1] = JS_UNDEFINED;
    p->stdio[2] = JS_UNDEFINED;

    uv_process_options_t options;
    memset(&options, 0, sizeof(uv_process_options_t));

    uv_stdio_container_t stdio[3];
    stdio[0].flags = UV_INHERIT_FD;
    stdio[0].data.fd = STDIN_FILENO;
    stdio[1].flags = UV_INHERIT_FD;
    stdio[1].data.fd = STDOUT_FILENO;
    stdio[2].flags = UV_INHERIT_FD;
    stdio[2].data.fd = STDERR_FILENO;
    options.stdio_count = 3;
    options.stdio = stdio;

    /* args */
    JSValue arg0 = argv[0];

    if (JS_IsString(arg0)) {
        options.args = js_mallocz(ctx, sizeof(*options.args) * 2);
        if (!options.args)
            goto fail;
        const char *arg0_str = JS_ToCString(ctx, arg0);
        if (!arg0_str)
            goto fail;
        options.args[0] = js_strdup(ctx, arg0_str);
        JS_FreeCString(ctx, arg0_str);
        if (!options.args[0])
            goto fail;
    } else if (JS_IsArray(ctx, arg0)) {
        JSValue js_length = JS_GetPropertyStr(ctx, arg0, "length");
        uint64_t len;
        if (JS_ToIndex(ctx, &len, js_length)) {
            JS_FreeValue(ctx, js_length);
            goto fail;
        }
        JS_FreeValue(ctx, js_length);
        options.args = js_mallocz(ctx, sizeof(*options.args) * (len + 1));
        if (!options.args)
            goto fail;
        for (int i = 0; i < len; i++) {
            JSValue v = JS_GetPropertyUint32(ctx, arg0, i);
            if (JS_IsException(v))
                goto fail;
            const char *arg_str = JS_ToCString(ctx, v);
            if (!arg_str)
                goto fail;
            options.args[i] = js_strdup(ctx, arg_str);
            JS_FreeCString(ctx, arg_str);
            if (!options.args[i])
                goto fail;
        }
    } else {
        JS_ThrowTypeError(ctx, "only string and array are allowed");
        goto fail;
    }

    options.file = options.args[0];

    JSValue arg1 = argv[1];

    if (!JS_IsUndefined(arg1)) {
        /* env */
        JSValue js_env = JS_GetPropertyStr(ctx, arg1, "env");
        if (JS_IsObject(js_env)) {
            JSPropertyEnum *ptab;
            uint32_t plen;
            if (JS_GetOwnPropertyNames(ctx, &ptab, &plen, js_env, JS_GPN_STRING_MASK | JS_GPN_ENUM_ONLY)) {
                JS_FreeValue(ctx, js_env);
                goto fail;
            }
            options.env = js_mallocz(ctx, sizeof(*options.env) * (plen + 1));
            if (!options.env) {
                JS_FreePropEnum(ctx, ptab, plen);
                JS_FreeValue(ctx, js_env);
                goto fail;
            }
            for (int i = 0; i < plen; i++) {
                JSValue prop = JS_GetProperty(ctx, js_env, ptab[i].atom);
                if (JS_IsException(prop)) {
                    JS_FreePropEnum(ctx, ptab, plen);
                    JS_FreeValue(ctx, js_env);
                    goto fail;
                }
                const char *key = JS_AtomToCString(ctx, ptab[i].atom);
                const char *value = JS_ToCString(ctx, prop);
                size_t len = strlen(key) + strlen(value) + 2; /* KEY=VALUE\0 */
                options.env[i] = js_malloc(ctx, len);
                if (!options.env[i]) {
                    JS_FreeCString(ctx, key);
                    JS_FreeCString(ctx, value);
                    JS_FreePropEnum(ctx, ptab, plen);
                    JS_FreeValue(ctx, js_env);
                    goto fail;
                }
                snprintf(options.env[i], len, "%s=%s", key, value);
                JS_FreeCString(ctx, key);
                JS_FreeCString(ctx, value);
            }
            JS_FreePropEnum(ctx, ptab, plen);
        }
        JS_FreeValue(ctx, js_env);

        /* cwd */
        JSValue js_cwd = JS_GetPropertyStr(ctx, arg1, "cwd");
        if (JS_IsException(js_cwd))
            goto fail;
        if (!JS_IsUndefined(js_cwd)) {
            const char *cwd_str = JS_ToCString(ctx, js_cwd);
            if (!cwd_str) {
                JS_FreeValue(ctx, js_cwd);
                goto fail;
            }
            options.cwd = js_strdup(ctx, cwd_str);
            JS_FreeCString(ctx, cwd_str);
            if (!options.cwd) {
                JS_FreeValue(ctx, js_cwd);
                goto fail;
            }
        }
        JS_FreeValue(ctx, js_cwd);

        /* uid */
        JSValue js_uid = JS_GetPropertyStr(ctx, arg1, "uid");
        if (JS_IsException(js_uid))
            goto fail;
        uint32_t uid;
        if (!JS_IsUndefined(js_uid)) {
            if (JS_ToUint32(ctx, &uid, js_uid)) {
                JS_FreeValue(ctx, js_uid);
                goto fail;
            }
            options.uid = uid;
            options.flags |= UV_PROCESS_SETUID;
        }
        JS_FreeValue(ctx, js_uid);

        /* gid */
        JSValue js_gid = JS_GetPropertyStr(ctx, arg1, "gid");
        if (JS_IsException(js_gid))
            goto fail;
        uint32_t gid;
        if (!JS_IsUndefined(js_gid)) {
            if (JS_ToUint32(ctx, &gid, js_gid)) {
                JS_FreeValue(ctx, js_gid);
                goto fail;
            }
            options.gid = gid;
            options.flags |= UV_PROCESS_SETGID;
        }
        JS_FreeValue(ctx, js_gid);

        /* stdio */
        JSValue js_stdin = JS_GetPropertyStr(ctx, arg1, "stdin");
        if (!JS_IsException(js_stdin) && !JS_IsUndefined(js_stdin)) {
            const char *in = JS_ToCString(ctx, js_stdin);
            if (!in) {
                JS_FreeValue(ctx, js_stdin);
                goto fail;
            }
            if (strcmp(in, "inherit") == 0) {
                stdio[0].flags = UV_INHERIT_FD;
                stdio[0].data.fd = STDIN_FILENO;
            } else if (strcmp(in, "pipe") == 0) {
                JSValue obj = tjs_new_pipe(ctx);
                if (JS_IsException(obj)) {
                    JS_FreeValue(ctx, js_stdin);
                    goto fail;
                }
                p->stdio[0] = obj;
                stdio[0].flags = UV_CREATE_PIPE | UV_READABLE_PIPE;
                stdio[0].data.stream = tjs_pipe_get_stream(ctx, obj);
            } else if (strcmp(in, "ignore") == 0) {
                stdio[0].flags = UV_IGNORE;
            }
            JS_FreeCString(ctx, in);
        }
        JS_FreeValue(ctx, js_stdin);

        JSValue js_stdout = JS_GetPropertyStr(ctx, arg1, "stdout");
        if (!JS_IsException(js_stdout) && !JS_IsUndefined(js_stdout)) {
            const char *out = JS_ToCString(ctx, js_stdout);
            if (!out) {
                JS_FreeValue(ctx, js_stdout);
                goto fail;
            }
            if (strcmp(out, "inherit") == 0) {
                stdio[1].flags = UV_INHERIT_FD;
                stdio[1].data.fd = STDOUT_FILENO;
            } else if (strcmp(out, "pipe") == 0) {
                JSValue obj = tjs_new_pipe(ctx);
                if (JS_IsException(obj)) {
                    JS_FreeValue(ctx, js_stdout);
                    goto fail;
                }
                p->stdio[1] = obj;
                stdio[1].flags = UV_CREATE_PIPE | UV_WRITABLE_PIPE;
                stdio[1].data.stream = tjs_pipe_get_stream(ctx, obj);
            } else if (strcmp(out, "ignore") == 0) {
                stdio[1].flags = UV_IGNORE;
            }
            JS_FreeCString(ctx, out);
        }
        JS_FreeValue(ctx, js_stdout);

        JSValue js_stderr = JS_GetPropertyStr(ctx, arg1, "stderr");
        if (!JS_IsException(js_stderr) && !JS_IsUndefined(js_stderr)) {
            const char *err = JS_ToCString(ctx, js_stderr);
            if (!err) {
                JS_FreeValue(ctx, js_stderr);
                goto fail;
            }
            if (strcmp(err, "inherit") == 0) {
                stdio[2].flags = UV_INHERIT_FD;
                stdio[2].data.fd = STDERR_FILENO;
            } else if (strcmp(err, "pipe") == 0) {
                JSValue obj = tjs_new_pipe(ctx);
                if (JS_IsException(obj)) {
                    JS_FreeValue(ctx, js_stderr);
                    goto fail;
                }
                p->stdio[2] = obj;
                stdio[2].flags = UV_CREATE_PIPE | UV_WRITABLE_PIPE;
                stdio[2].data.stream = tjs_pipe_get_stream(ctx, obj);
            } else if (strcmp(err, "ignore") == 0) {
                stdio[2].flags = UV_IGNORE;
            }
            JS_FreeCString(ctx, err);
        }
        JS_FreeValue(ctx, js_stderr);
    }

    options.exit_cb = uv__exit_cb;

    int r = uv_spawn(tjs_get_loop(ctx), &p->process, &options);
    if (r != 0) {
        tjs_throw_errno(ctx, r);
        goto fail;
    }

    JS_SetOpaque(obj, p);
    ret = obj;
    goto cleanup;

fail:
    JS_FreeValue(ctx, p->stdio[0]);
    JS_FreeValue(ctx, p->stdio[1]);
    JS_FreeValue(ctx, p->stdio[2]);
    free(p);
    JS_FreeValue(ctx, obj);
    ret = JS_EXCEPTION;
cleanup:
    if (options.args) {
        for (int i = 0; options.args[i] != NULL; i++)
            js_free(ctx, options.args[i]);
        js_free(ctx, options.args);
    }
    if (options.env) {
        for (int i = 0; options.env[i] != NULL; i++)
            js_free(ctx, options.env[i]);
        js_free(ctx, options.env);
    }
    if (options.cwd)
        js_free(ctx, (void *) options.cwd);

    return ret;
}

static JSValue tjs_exec(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    JSValue ret;

    char **args = NULL;

    /* args */
    JSValue arg0 = argv[0];

    if (JS_IsString(arg0)) {
        args = js_mallocz(ctx, sizeof(*args) * 2);
        if (!args)
            goto fail;
        const char *arg0_str = JS_ToCString(ctx, arg0);
        if (!arg0_str)
            goto fail;
        args[0] = js_strdup(ctx, arg0_str);
        JS_FreeCString(ctx, arg0_str);
        if (!args[0])
            goto fail;
    } else if (JS_IsArray(ctx, arg0)) {
        JSValue js_length = JS_GetPropertyStr(ctx, arg0, "length");
        uint64_t len;
        if (JS_ToIndex(ctx, &len, js_length)) {
            JS_FreeValue(ctx, js_length);
            goto fail;
        }
        JS_FreeValue(ctx, js_length);
        args = js_mallocz(ctx, sizeof(*args) * (len + 1));
        if (!args)
            goto fail;
        for (int i = 0; i < len; i++) {
            JSValue v = JS_GetPropertyUint32(ctx, arg0, i);
            if (JS_IsException(v))
                goto fail;
            const char *arg_str = JS_ToCString(ctx, v);
            if (!arg_str)
                goto fail;
            args[i] = js_strdup(ctx, arg_str);
            JS_FreeCString(ctx, arg_str);
            if (!args[i])
                goto fail;
        }
    } else {
        JS_ThrowTypeError(ctx, "only string and array are allowed");
        goto fail;
    }

    int r = execvp(args[0], args);
    tjs_throw_errno(ctx, r);

fail:
    ret = JS_EXCEPTION;

    if (args) {
        for (int i = 0; args[i] != NULL; i++)
            js_free(ctx, args[i]);
        js_free(ctx, args);
    }

    return ret;
}

static JSValue tjs_kill(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    int32_t pid;
    if (JS_IsUndefined(argv[0]) || JS_ToInt32(ctx, &pid, argv[0]))
        return JS_ThrowTypeError(ctx, "expected an integer");

    int sig_num = SIGTERM;
    if (!JS_IsUndefined(argv[1])) {
        const char *sig_str = JS_ToCString(ctx, argv[1]);
        sig_num = tjs_getsignum(sig_str);
        JS_FreeCString(ctx, sig_str);

        if (sig_num == -1)
            return JS_ThrowRangeError(ctx, "Invalid signal specified");
    }

    int r = uv_kill(pid, sig_num);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_process_proto_funcs[] = {
    TJS_CFUNC_DEF("kill", 1, tjs_process_kill),
    TJS_CFUNC_DEF("wait", 0, tjs_process_wait),
    JS_CGETSET_DEF("pid", tjs_process_pid_get, NULL),
    JS_CGETSET_MAGIC_DEF("stdin", tjs_process_stdio_get, NULL, 0),
    JS_CGETSET_MAGIC_DEF("stdout", tjs_process_stdio_get, NULL, 1),
    JS_CGETSET_MAGIC_DEF("stderr", tjs_process_stdio_get, NULL, 2),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Process", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_process_funcs[] = {
    TJS_CFUNC_DEF("spawn", 2, tjs_spawn),
    TJS_CFUNC_DEF("kill", 2, tjs_kill),
    TJS_CFUNC_DEF("exec", 1, tjs_exec),
};

void tjs__mod_process_init(JSContext *ctx, JSValue ns) {
    JS_NewClassID(&tjs_process_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_process_class_id, &tjs_process_class);
    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_process_proto_funcs, countof(tjs_process_proto_funcs));
    JS_SetClassProto(ctx, tjs_process_class_id, proto);

    JS_SetPropertyFunctionList(ctx, ns, tjs_process_funcs, countof(tjs_process_funcs));
}

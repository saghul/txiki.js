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


typedef struct {
    JSContext *ctx;
    int closed;
    int finalized;
    uv_signal_t handle;
    int sig_num;
    JSValue func;

} QUVSignalHandler;

static JSClassID quv_signal_handler_class_id;

static void uv__signal_close_cb(uv_handle_t *handle) {
    QUVSignalHandler *sh = handle->data;
    if (sh) {
        sh->closed = 1;
        if (sh->finalized)
            free(sh);
    }
}

static void maybe_close(QUVSignalHandler *sh) {
    if (!uv_is_closing((uv_handle_t *) &sh->handle))
        uv_close((uv_handle_t *) &sh->handle, uv__signal_close_cb);
}

static void quv_signal_handler_finalizer(JSRuntime *rt, JSValue val) {
    QUVSignalHandler *sh = JS_GetOpaque(val, quv_signal_handler_class_id);
    if (sh) {
        JS_FreeValueRT(rt, sh->func);
        sh->finalized = 1;
        if (sh->closed)
            free(sh);
        else
            maybe_close(sh);
    }
}

static void quv_signal_handler_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    QUVSignalHandler *sh = JS_GetOpaque(val, quv_signal_handler_class_id);
    if (sh) {
        JS_MarkValue(rt, sh->func, mark_func);
    }
}

static JSClassDef quv_signal_handler_class = {
    "SignalHandler",
    .finalizer = quv_signal_handler_finalizer,
    .gc_mark = quv_signal_handler_mark,
};

static void uv__signal_cb(uv_signal_t *handle, int sig_num) {
    QUVSignalHandler *sh = handle->data;
    CHECK_NOT_NULL(sh);
    quv_call_handler(sh->ctx, sh->func);
}

static JSValue quv_signal(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    int32_t sig_num;
    if (JS_ToInt32(ctx, &sig_num, argv[0]))
        return JS_EXCEPTION;

    JSValueConst func = argv[1];
    if (!JS_IsFunction(ctx, func))
        return JS_ThrowTypeError(ctx, "not a function");

    JSValue obj = JS_NewObjectClass(ctx, quv_signal_handler_class_id);
    if (JS_IsException(obj))
        return obj;

    QUVSignalHandler *sh = calloc(1, sizeof(*sh));
    if (!sh) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    int r = uv_signal_init(quv_get_loop(ctx), &sh->handle);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        free(sh);
        return JS_ThrowInternalError(ctx, "couldn't initialize Signal handle");
    }

    r = uv_signal_start(&sh->handle, uv__signal_cb, sig_num);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        free(sh);
        return quv_throw_errno(ctx, r);
    }
    uv_unref((uv_handle_t *) &sh->handle);

    sh->ctx = ctx;
    sh->sig_num = sig_num;
    sh->handle.data = sh;
    sh->func = JS_DupValue(ctx, func);

    JS_SetOpaque(obj, sh);
    return obj;
}

static QUVSignalHandler *quv_signal_handler_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, quv_signal_handler_class_id);
}

static JSValue quv_signal_handler_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    QUVSignalHandler *sh = quv_signal_handler_get(ctx, this_val);
    if (!sh)
        return JS_EXCEPTION;
    maybe_close(sh);
    return JS_UNDEFINED;
}

static JSValue quv_signal_handler_signum_get(JSContext *ctx, JSValueConst this_val) {
    QUVSignalHandler *sh = quv_signal_handler_get(ctx, this_val);
    if (!sh)
        return JS_EXCEPTION;
    return JS_NewInt32(ctx, sh->sig_num);
}

static const JSCFunctionListEntry quv_signal_handler_proto_funcs[] = {
    JS_CFUNC_DEF("close", 0, quv_signal_handler_close),
    JS_CGETSET_DEF("signum", quv_signal_handler_signum_get, NULL),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Signal Handler", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry quv_signal_funcs[] = {
#ifdef SIGHUP
    QUV_CONST(SIGHUP),
#endif
#ifdef SIGINT
    QUV_CONST(SIGINT),
#endif
#ifdef SIGQUIT
    QUV_CONST(SIGQUIT),
#endif
#ifdef SIGILL
    QUV_CONST(SIGILL),
#endif
#ifdef SIGTRAP
    QUV_CONST(SIGTRAP),
#endif
#ifdef SIGABRT
    QUV_CONST(SIGABRT),
#endif
#ifdef SIGIOT
    QUV_CONST(SIGIOT),
#endif
#ifdef SIGBUS
    QUV_CONST(SIGBUS),
#endif
#ifdef SIGFPE
    QUV_CONST(SIGFPE),
#endif
#ifdef SIGKILL
    QUV_CONST(SIGKILL),
#endif
#ifdef SIGUSR1
    QUV_CONST(SIGUSR1),
#endif
#ifdef SIGSEGV
    QUV_CONST(SIGSEGV),
#endif
#ifdef SIGUSR2
    QUV_CONST(SIGUSR2),
#endif
#ifdef SIGPIPE
    QUV_CONST(SIGPIPE),
#endif
#ifdef SIGALRM
    QUV_CONST(SIGALRM),
#endif
    QUV_CONST(SIGTERM),
#ifdef SIGCHLD
    QUV_CONST(SIGCHLD),
#endif
#ifdef SIGSTKFLT
    QUV_CONST(SIGSTKFLT),
#endif
#ifdef SIGCONT
    QUV_CONST(SIGCONT),
#endif
#ifdef SIGSTOP
    QUV_CONST(SIGSTOP),
#endif
#ifdef SIGTSTP
    QUV_CONST(SIGTSTP),
#endif
#ifdef SIGBREAK
    QUV_CONST(SIGBREAK),
#endif
#ifdef SIGTTIN
    QUV_CONST(SIGTTIN),
#endif
#ifdef SIGTTOU
    QUV_CONST(SIGTTOU),
#endif
#ifdef SIGURG
    QUV_CONST(SIGURG),
#endif
#ifdef SIGXCPU
    QUV_CONST(SIGXCPU),
#endif
#ifdef SIGXFSZ
    QUV_CONST(SIGXFSZ),
#endif
#ifdef SIGVTALRM
    QUV_CONST(SIGVTALRM),
#endif
#ifdef SIGPROF
    QUV_CONST(SIGPROF),
#endif
#ifdef SIGWINCH
    QUV_CONST(SIGWINCH),
#endif
#ifdef SIGIO
    QUV_CONST(SIGIO),
#endif
#ifdef SIGPOLL
    QUV_CONST(SIGPOLL),
#endif
#ifdef SIGLOST
    QUV_CONST(SIGLOST),
#endif
#ifdef SIGPWR
    QUV_CONST(SIGPWR),
#endif
#ifdef SIGINFO
    QUV_CONST(SIGINFO),
#endif
#ifdef SIGSYS
    QUV_CONST(SIGSYS),
#endif
#ifdef SIGUNUSED
    QUV_CONST(SIGUNUSED),
#endif
    JS_CFUNC_DEF("signal", 2, quv_signal),
};

void quv_mod_signals_init(JSContext *ctx, JSModuleDef *m) {
    JS_NewClassID(&quv_signal_handler_class_id);
    JS_NewClass(JS_GetRuntime(ctx), quv_signal_handler_class_id, &quv_signal_handler_class);
    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, quv_signal_handler_proto_funcs, countof(quv_signal_handler_proto_funcs));
    JS_SetClassProto(ctx, quv_signal_handler_class_id, proto);
    JS_SetModuleExportList(ctx, m, quv_signal_funcs, countof(quv_signal_funcs));
}

void quv_mod_signals_export(JSContext *ctx, JSModuleDef *m) {
    JS_AddModuleExportList(ctx, m, quv_signal_funcs, countof(quv_signal_funcs));
}

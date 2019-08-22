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

#include "../cutils.h"
#include "error.h"
#include "signals.h"
#include "utils.h"


typedef struct {
    JSContext *ctx;
    int closed;
    int finalized;
    uv_signal_t handle;
    int sig_num;
    JSValue func;

} JSUVSignalHandler;

static JSClassID quv_signal_handler_class_id;

static void free_sh(JSUVSignalHandler *sh) {
    free(sh);
}

static void uv__signal_close_cb(uv_handle_t* handle) {
    JSUVSignalHandler *sh = handle->data;
    if (sh) {
        sh->closed = 1;
        if (sh->finalized)
            free_sh(sh);
    }
}

static void maybe_close(JSUVSignalHandler *sh) {
    if (!uv_is_closing((uv_handle_t*) &sh->handle))
        uv_close((uv_handle_t*) &sh->handle, uv__signal_close_cb);
}

static void quv_signal_handler_finalizer(JSRuntime *rt, JSValue val) {
    JSUVSignalHandler *sh = JS_GetOpaque(val, quv_signal_handler_class_id);
    if (sh) {
        JSContext *ctx = sh->ctx;
        JS_FreeValue(ctx, sh->func);
        sh->finalized = 1;
        if (sh->closed)
            free_sh(sh);
        else
            maybe_close(sh);
    }
}

static void quv_signal_handler_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    JSUVSignalHandler *sh = JS_GetOpaque(val, quv_signal_handler_class_id);
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
    JSUVSignalHandler *sh = handle->data;
    if (sh) {
        JSContext *ctx = sh->ctx;
        quv_call_handler(ctx, sh->func);
    }
}

static JSValue quv_signal(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    uv_loop_t *loop = quv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    int32_t sig_num;
    if (JS_ToInt32(ctx, &sig_num, argv[0]))
        return JS_EXCEPTION;

    JSValueConst func = argv[1];
    if (!JS_IsFunction(ctx, func))
        return JS_ThrowTypeError(ctx, "not a function");

    JSValue obj = JS_NewObjectClass(ctx, quv_signal_handler_class_id);
    if (JS_IsException(obj))
        return obj;

    JSUVSignalHandler *sh = calloc(1, sizeof(*sh));
    if (!sh) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    int r = uv_signal_init(loop, &sh->handle);
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
    uv_unref((uv_handle_t*)&sh->handle);

    sh->ctx = ctx;
    sh->sig_num = sig_num;
    sh->handle.data = sh;
    sh->func = JS_DupValue(ctx, func);

    JS_SetOpaque(obj, sh);
    return obj;
}

static JSUVSignalHandler *quv_signal_handler_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, quv_signal_handler_class_id);
}

static JSValue quv_signal_handler_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    JSUVSignalHandler *sh = quv_signal_handler_get(ctx, this_val);
    if (!sh)
        return JS_EXCEPTION;
    maybe_close(sh);
    return JS_UNDEFINED;
}

static JSValue quv_signal_handler_signum_get(JSContext *ctx, JSValueConst this_val) {
    JSUVSignalHandler *sh = quv_signal_handler_get(ctx, this_val);
    if (!sh)
        return JS_EXCEPTION;
    return JS_NewInt32(ctx, sh->sig_num);
}

static const JSCFunctionListEntry quv_signal_handler_proto_funcs[] = {
    JS_CFUNC_DEF("close", 0, quv_signal_handler_close ),
    JS_CGETSET_DEF("signum", quv_signal_handler_signum_get, NULL ),
};

static const JSCFunctionListEntry quv_signal_funcs[] = {
#ifdef SIGHUP
    JSUV_CONST(SIGHUP),
#endif
#ifdef SIGINT
    JSUV_CONST(SIGINT),
#endif
#ifdef SIGQUIT
    JSUV_CONST(SIGQUIT),
#endif
#ifdef SIGILL
    JSUV_CONST(SIGILL),
#endif
#ifdef SIGTRAP
    JSUV_CONST(SIGTRAP),
#endif
#ifdef SIGABRT
    JSUV_CONST(SIGABRT),
#endif
#ifdef SIGIOT
    JSUV_CONST(SIGIOT),
#endif
#ifdef SIGBUS
    JSUV_CONST(SIGBUS),
#endif
#ifdef SIGFPE
    JSUV_CONST(SIGFPE),
#endif
#ifdef SIGKILL
    JSUV_CONST(SIGKILL),
#endif
#ifdef SIGUSR1
    JSUV_CONST(SIGUSR1),
#endif
#ifdef SIGSEGV
    JSUV_CONST(SIGSEGV),
#endif
#ifdef SIGUSR2
    JSUV_CONST(SIGUSR2),
#endif
#ifdef SIGPIPE
    JSUV_CONST(SIGPIPE),
#endif
#ifdef SIGALRM
    JSUV_CONST(SIGALRM),
#endif
    JSUV_CONST(SIGTERM),
#ifdef SIGCHLD
    JSUV_CONST(SIGCHLD),
#endif
#ifdef SIGSTKFLT
    JSUV_CONST(SIGSTKFLT),
#endif
#ifdef SIGCONT
    JSUV_CONST(SIGCONT),
#endif
#ifdef SIGSTOP
    JSUV_CONST(SIGSTOP),
#endif
#ifdef SIGTSTP
    JSUV_CONST(SIGTSTP),
#endif
#ifdef SIGBREAK
    JSUV_CONST(SIGBREAK),
#endif
#ifdef SIGTTIN
    JSUV_CONST(SIGTTIN),
#endif
#ifdef SIGTTOU
    JSUV_CONST(SIGTTOU),
#endif
#ifdef SIGURG
    JSUV_CONST(SIGURG),
#endif
#ifdef SIGXCPU
    JSUV_CONST(SIGXCPU),
#endif
#ifdef SIGXFSZ
    JSUV_CONST(SIGXFSZ),
#endif
#ifdef SIGVTALRM
    JSUV_CONST(SIGVTALRM),
#endif
#ifdef SIGPROF
    JSUV_CONST(SIGPROF),
#endif
#ifdef SIGWINCH
    JSUV_CONST(SIGWINCH),
#endif
#ifdef SIGIO
    JSUV_CONST(SIGIO),
#endif
#ifdef SIGPOLL
    JSUV_CONST(SIGPOLL),
#endif
#ifdef SIGLOST
    JSUV_CONST(SIGLOST),
#endif
#ifdef SIGPWR
    JSUV_CONST(SIGPWR),
#endif
#ifdef SIGINFO
    JSUV_CONST(SIGINFO),
#endif
#ifdef SIGSYS
    JSUV_CONST(SIGSYS),
#endif
#ifdef SIGUNUSED
    JSUV_CONST(SIGUNUSED),
#endif
    JS_CFUNC_DEF("signal", 2, quv_signal ),
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

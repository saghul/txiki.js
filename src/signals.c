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
#include "utils.h"


typedef struct {
    JSContext *ctx;
    int closed;
    int finalized;
    uv_signal_t handle;
    int sig_num;
    JSValue func;

} TJSSignalHandler;

static JSClassID tjs_signal_handler_class_id;

static void uv__signal_close_cb(uv_handle_t *handle) {
    TJSSignalHandler *sh = handle->data;
    if (sh) {
        sh->closed = 1;
        if (sh->finalized)
            free(sh);
    }
}

static void maybe_close(TJSSignalHandler *sh) {
    if (!uv_is_closing((uv_handle_t *) &sh->handle))
        uv_close((uv_handle_t *) &sh->handle, uv__signal_close_cb);
}

static void tjs_signal_handler_finalizer(JSRuntime *rt, JSValue val) {
    TJSSignalHandler *sh = JS_GetOpaque(val, tjs_signal_handler_class_id);
    if (sh) {
        JS_FreeValueRT(rt, sh->func);
        sh->finalized = 1;
        if (sh->closed)
            free(sh);
        else
            maybe_close(sh);
    }
}

static void tjs_signal_handler_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    TJSSignalHandler *sh = JS_GetOpaque(val, tjs_signal_handler_class_id);
    if (sh) {
        JS_MarkValue(rt, sh->func, mark_func);
    }
}

static JSClassDef tjs_signal_handler_class = {
    "SignalHandler",
    .finalizer = tjs_signal_handler_finalizer,
    .gc_mark = tjs_signal_handler_mark,
};

static void uv__signal_cb(uv_signal_t *handle, int sig_num) {
    TJSSignalHandler *sh = handle->data;
    CHECK_NOT_NULL(sh);
    tjs_call_handler(sh->ctx, sh->func, 0, NULL);
}

static JSValue tjs_signal(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    int32_t sig_num;
    if (JS_ToInt32(ctx, &sig_num, argv[0]))
        return JS_EXCEPTION;

    JSValueConst func = argv[1];
    if (!JS_IsFunction(ctx, func))
        return JS_ThrowTypeError(ctx, "not a function");

    JSValue obj = JS_NewObjectClass(ctx, tjs_signal_handler_class_id);
    if (JS_IsException(obj))
        return obj;

    TJSSignalHandler *sh = calloc(1, sizeof(*sh));
    if (!sh) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    int r = uv_signal_init(tjs_get_loop(ctx), &sh->handle);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        free(sh);
        return JS_ThrowInternalError(ctx, "couldn't initialize Signal handle");
    }

    r = uv_signal_start(&sh->handle, uv__signal_cb, sig_num);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        free(sh);
        return tjs_throw_errno(ctx, r);
    }
    uv_unref((uv_handle_t *) &sh->handle);

    sh->ctx = ctx;
    sh->sig_num = sig_num;
    sh->handle.data = sh;
    sh->func = JS_DupValue(ctx, func);

    JS_SetOpaque(obj, sh);
    return obj;
}

static TJSSignalHandler *tjs_signal_handler_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, tjs_signal_handler_class_id);
}

static JSValue tjs_signal_handler_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSSignalHandler *sh = tjs_signal_handler_get(ctx, this_val);
    if (!sh)
        return JS_EXCEPTION;
    maybe_close(sh);
    return JS_UNDEFINED;
}

static JSValue tjs_signal_handler_signal_get(JSContext *ctx, JSValueConst this_val) {
    TJSSignalHandler *sh = tjs_signal_handler_get(ctx, this_val);
    if (!sh)
        return JS_EXCEPTION;
    return sh->sig_num == 0 ? JS_NULL : JS_NewString(ctx, tjs_getsig(sh->sig_num));
}

static const JSCFunctionListEntry tjs_signal_handler_proto_funcs[] = {
    TJS_CFUNC_DEF("close", 0, tjs_signal_handler_close),
    JS_CGETSET_DEF("signal", tjs_signal_handler_signal_get, NULL),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Signal Handler", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_signal_funcs[] = {
    TJS_CFUNC_DEF("signal", 2, tjs_signal),
};

void tjs__mod_signals_init(JSContext *ctx, JSValue ns) {
    JS_NewClassID(&tjs_signal_handler_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_signal_handler_class_id, &tjs_signal_handler_class);
    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_signal_handler_proto_funcs, countof(tjs_signal_handler_proto_funcs));
    JS_SetClassProto(ctx, tjs_signal_handler_class_id, proto);

    JSValue signals = JS_NewObjectProto(ctx, JS_NULL);
    for (int i = 0; i < tjs_signal_map_count; i++) {
        const char *signame = tjs_signal_map[i];
        if (signame) {
            JS_SetPropertyStr(ctx, signals, signame, JS_NewInt32(ctx, i));
        }
    }
    JS_SetPropertyStr(ctx, ns, "signals", signals);

    JS_SetPropertyFunctionList(ctx, ns, tjs_signal_funcs, countof(tjs_signal_funcs));
}

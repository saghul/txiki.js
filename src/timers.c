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
    uv_timer_t handle;
    int interval;
    JSValue obj;
    JSValue func;
    int argc;
    JSValue argv[];
} TJSTimer;

static void clear_timer(TJSTimer *th) {
    JSContext *ctx = th->ctx;

    JS_FreeValue(ctx, th->func);
    th->func = JS_UNDEFINED;

    for (int i = 0; i < th->argc; i++) {
        JS_FreeValue(ctx, th->argv[i]);
        th->argv[i] = JS_UNDEFINED;
    }
    th->argc = 0;

    JSValue obj = th->obj;
    th->obj = JS_UNDEFINED;
    JS_FreeValue(ctx, obj);
}

static void call_timer(TJSTimer *th) {
    JSContext *ctx = th->ctx;
    JSValue ret, func1;
    /* 'func' might be destroyed when calling itself (if it frees the handler), so must take extra care */
    func1 = JS_DupValue(ctx, th->func);
    ret = JS_Call(ctx, func1, JS_UNDEFINED, th->argc, (JSValueConst *) th->argv);
    JS_FreeValue(ctx, func1);
    if (JS_IsException(ret))
        tjs_dump_error(ctx);
    JS_FreeValue(ctx, ret);
}

static void uv__timer_close(uv_handle_t *handle) {
    TJSTimer *th = handle->data;
    CHECK_NOT_NULL(th);
    free(th);
}

static void uv__timer_cb(uv_timer_t *handle) {
    TJSTimer *th = handle->data;
    CHECK_NOT_NULL(th);

    /* Timer always executes before check phase in libuv,
       so clear the microtask queue here before running setTimeout macrotasks */
    tjs_execute_jobs(th->ctx);

    call_timer(th);
    if (!th->interval)
        clear_timer(th);
}

static JSClassID tjs_timer_class_id;

static void tjs_timer_finalizer(JSRuntime *rt, JSValue val) {
    TJSTimer *th = JS_GetOpaque(val, tjs_timer_class_id);
    if (th) {
        clear_timer(th);
        uv_close((uv_handle_t *) &th->handle, uv__timer_close);
    }
}

static void tjs_timer_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    TJSTimer *th = JS_GetOpaque(val, tjs_timer_class_id);
    if (th) {
        JS_MarkValue(rt, th->func, mark_func);
        for (int i = 0; i < th->argc; i++)
            JS_MarkValue(rt, th->argv[i], mark_func);
    }
}

static JSClassDef tjs_timer_class = {
    "Timer",
    .finalizer = tjs_timer_finalizer,
    .gc_mark = tjs_timer_mark,
};

static JSValue tjs_setTimeout(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv, int magic) {
    int64_t delay;
    JSValueConst func;
    TJSTimer *th;
    JSValue obj;

    func = argv[0];
    if (!JS_IsFunction(ctx, func))
        return JS_ThrowTypeError(ctx, "not a function");

    if (argc <= 1) {
        delay = 0;
    } else {
        if (JS_ToInt64(ctx, &delay, argv[1]))
            return JS_EXCEPTION;
    }

    obj = JS_NewObjectClass(ctx, tjs_timer_class_id);
    if (JS_IsException(obj))
        return obj;

    int nargs = argc - 2;
    if (nargs < 0) {
        nargs = 0;
    }

    th = calloc(1, sizeof(*th) + nargs * sizeof(JSValue));
    if (!th) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    th->ctx = ctx;
    CHECK_EQ(uv_timer_init(tjs_get_loop(ctx), &th->handle), 0);
    th->handle.data = th;
    th->interval = magic;
    th->obj = JS_DupValue(ctx, obj);
    th->func = JS_DupValue(ctx, func);
    th->argc = nargs;
    for (int i = 0; i < nargs; i++)
        th->argv[i] = JS_DupValue(ctx, argv[i + 2]);

    CHECK_EQ(uv_timer_start(&th->handle, uv__timer_cb, delay, magic ? delay : 0 /* repeat */), 0);

    JS_SetOpaque(obj, th);
    return obj;
}

static JSValue tjs_clearTimeout(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSTimer *th = JS_GetOpaque2(ctx, argv[0], tjs_timer_class_id);
    if (!th)
        return JS_EXCEPTION;

    CHECK_EQ(uv_timer_stop(&th->handle), 0);
    clear_timer(th);

    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_timer_funcs[] = {
    JS_CFUNC_MAGIC_DEF("setTimeout", 2, tjs_setTimeout, 0),
    TJS_CFUNC_DEF("clearTimeout", 1, tjs_clearTimeout),
    JS_CFUNC_MAGIC_DEF("setInterval", 2, tjs_setTimeout, 1),
    TJS_CFUNC_DEF("clearInterval", 1, tjs_clearTimeout)
};

void tjs__mod_timers_init(JSContext *ctx, JSValue ns) {
    JS_NewClassID(&tjs_timer_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_timer_class_id, &tjs_timer_class);
    JS_SetPropertyFunctionList(ctx, ns, tjs_timer_funcs, countof(tjs_timer_funcs));
}

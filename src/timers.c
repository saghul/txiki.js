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

#include "hash.h"
#include "mem.h"
#include "private.h"
#include "utils.h"

#define MAX_SAFE_INTEGER (((int64_t) 1 << 53) - 1)

struct TJSTimer {
    JSContext *ctx;
    int64_t id;
    uv_timer_t handle;
    UT_hash_handle hh;
    int interval;
    JSValue func;
    int argc;
    JSValue argv[];
};

static void uv__timer_close(uv_handle_t *handle) {
    TJSTimer *th = handle->data;
    CHECK_NOT_NULL(th);
    tjs__free(th);
}

static void destroy_timer(TJSTimer *th) {
    JSContext *ctx = th->ctx;
    TJSRuntime *qrt = JS_GetContextOpaque(ctx);
    CHECK_NOT_NULL(qrt);

    JS_FreeValue(ctx, th->func);
    th->func = JS_UNDEFINED;

    for (int i = 0; i < th->argc; i++) {
        JS_FreeValue(ctx, th->argv[i]);
        th->argv[i] = JS_UNDEFINED;
    }
    th->argc = 0;

    HASH_DEL(qrt->timers.timers, th);

    uv_close((uv_handle_t *) &th->handle, uv__timer_close);
}

void tjs__destroy_timers(TJSRuntime *qrt) {
    TJSTimer *th, *tmp;

    HASH_ITER(hh, qrt->timers.timers, th, tmp) {
        destroy_timer(th);
    }
}

static void call_timer(TJSTimer *th) {
    JSContext *ctx = th->ctx;
    JSValue ret, func1;
    /* 'func' might be destroyed when calling itself (if it frees the handler), so must take extra care */
    func1 = JS_DupValue(ctx, th->func);
    ret = JS_Call(ctx, func1, JS_UNDEFINED, th->argc, th->argv);
    JS_FreeValue(ctx, func1);
    if (JS_IsException(ret))
        tjs_dump_error(ctx);
    JS_FreeValue(ctx, ret);
}

static void uv__timer_cb(uv_timer_t *handle) {
    TJSTimer *th = handle->data;
    CHECK_NOT_NULL(th);

    /* Micro-tasks should run before timers. */
    tjs__execute_jobs(th->ctx);

    call_timer(th);

    if (!th->interval)
        destroy_timer(th);
}

static JSValue tjs_setTimeout(JSContext *ctx, JSValue this_val, int argc, JSValue *argv, int magic) {
    TJSRuntime *qrt = JS_GetContextOpaque(ctx);
    CHECK_NOT_NULL(qrt);

    int64_t delay;
    JSValue func;
    TJSTimer *th;

    func = argv[0];
    if (!JS_IsFunction(ctx, func))
        return JS_ThrowTypeError(ctx, "not a function");

    if (argc <= 1) {
        delay = 0;
    } else if (JS_ToInt64(ctx, &delay, argv[1])) {
        return JS_EXCEPTION;
    }

    int nargs = argc - 2;
    if (nargs < 0) {
        nargs = 0;
    }

    th = tjs__malloc(sizeof(*th) + nargs * sizeof(JSValue));
    if (!th)
        return JS_ThrowOutOfMemory(ctx);

    th->id = qrt->timers.next_timer++;
    if (qrt->timers.next_timer > MAX_SAFE_INTEGER)
        qrt->timers.next_timer = 1;

    th->ctx = ctx;
    CHECK_EQ(uv_timer_init(tjs_get_loop(ctx), &th->handle), 0);
    th->handle.data = th;
    th->interval = magic;
    th->func = JS_DupValue(ctx, func);
    th->argc = nargs;
    for (int i = 0; i < nargs; i++)
        th->argv[i] = JS_DupValue(ctx, argv[i + 2]);

    CHECK_EQ(uv_timer_start(&th->handle, uv__timer_cb, delay, magic ? delay : 0 /* repeat */), 0);

    HASH_ADD_INT64(qrt->timers.timers, id, th);

    return JS_NewInt64(ctx, th->id);
}

static JSValue tjs_clearTimeout(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSRuntime *qrt = JS_GetContextOpaque(ctx);
    CHECK_NOT_NULL(qrt);
    int64_t timer_id;
    TJSTimer *th = NULL;

    if (JS_ToInt64(ctx, &timer_id, argv[0]))
        return JS_EXCEPTION;

    HASH_FIND_INT64(qrt->timers.timers, &timer_id, th);

    if (th != NULL) {
        CHECK_EQ(uv_timer_stop(&th->handle), 0);
        destroy_timer(th);
    }

    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_timer_funcs[] = { JS_CFUNC_MAGIC_DEF("setTimeout", 2, tjs_setTimeout, 0),
                                                        TJS_CFUNC_DEF("clearTimeout", 1, tjs_clearTimeout),
                                                        JS_CFUNC_MAGIC_DEF("setInterval", 2, tjs_setTimeout, 1),
                                                        TJS_CFUNC_DEF("clearInterval", 1, tjs_clearTimeout) };

void tjs__mod_timers_init(JSContext *ctx, JSValue ns) {
    JS_SetPropertyFunctionList(ctx, ns, tjs_timer_funcs, countof(tjs_timer_funcs));
}

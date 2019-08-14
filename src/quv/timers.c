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
#include "timers.h"
#include "utils.h"


typedef struct {
    uv_timer_t handle;
    JSValue func;
    JSValue obj;
    JSContext *ctx;
    int interval;
} JSUVTimer;

static void uv__timer_close(uv_handle_t *handle) {
    JSUVTimer *th = handle->data;
    if (th) {
        JSContext *ctx = th->ctx;
        js_free(ctx, th);
    }
}

static void uv__timer_cb(uv_timer_t *handle) {
    JSUVTimer *th = handle->data;
    if (th) {
        JSContext *ctx = th->ctx;
        JSValue func = th->func;
        quv_call_handler(ctx, func);
        if (!th->interval) {
            th->func = JS_UNDEFINED;
            JS_FreeValue(ctx, func);
            JSValue obj = th->obj;
            th->obj = JS_UNDEFINED;
            JS_FreeValue(ctx, obj);  // decref
        }
    }
}

static JSClassID quv_timer_class_id;

static void quv_timer_finalizer(JSRuntime *rt, JSValue val)
{
    JSUVTimer *th = JS_GetOpaque(val, quv_timer_class_id);
    if (th)
        uv_close((uv_handle_t*)&th->handle, uv__timer_close);
}

static void quv_timer_mark(JSRuntime *rt, JSValueConst val,
                             JS_MarkFunc *mark_func)
{
    JSUVTimer *th = JS_GetOpaque(val, quv_timer_class_id);
    if (th)
        JS_MarkValue(rt, th->func, mark_func);
}

static JSClassDef quv_timer_class = {
    "Timer",
    .finalizer = quv_timer_finalizer,
    .gc_mark = quv_timer_mark,
}; 

static JSValue quv_setTimeout(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv, int magic)
{
    int64_t delay;
    JSValueConst func;
    JSUVTimer *th;
    JSValue obj;

    uv_loop_t *loop = quv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    func = argv[0];
    if (!JS_IsFunction(ctx, func))
        return JS_ThrowTypeError(ctx, "not a function");

    if (JS_ToInt64(ctx, &delay, argv[1]))
        return JS_EXCEPTION;

    obj = JS_NewObjectClass(ctx, quv_timer_class_id);
    if (JS_IsException(obj))
        return obj;

    th = js_mallocz(ctx, sizeof(*th));
    if (!th) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    th->ctx = ctx;
    uv_timer_init(loop, &th->handle);
    th->handle.data = th;
    uv_timer_start(&th->handle, uv__timer_cb, delay, magic ? delay : 0 /* repeat */);
    th->interval = magic;
    th->func = JS_DupValue(ctx, func);
    th->obj = JS_DupValue(ctx, obj);  // incref

    JS_SetOpaque(obj, th);
    return obj;
}

static JSValue quv_clearTimeout(JSContext *ctx, JSValueConst this_val,
                                  int argc, JSValueConst *argv)
{
    JSUVTimer *th = JS_GetOpaque2(ctx, argv[0], quv_timer_class_id);
    if (!th)
        return JS_EXCEPTION;

    uv_timer_stop(&th->handle);
    JSValue func = th->func;
    th->func = JS_UNDEFINED;
    JS_FreeValue(ctx, func);
    JSValue obj = th->obj;
    th->obj = JS_UNDEFINED;
    JS_FreeValue(ctx, obj);  // decref

    return JS_UNDEFINED;
}

static const JSCFunctionListEntry quv_timer_funcs[] = {
    JS_CFUNC_MAGIC_DEF("setTimeout", 2, quv_setTimeout, 0 ),
    JS_CFUNC_DEF("clearTimeout", 1, quv_clearTimeout ),
    JS_CFUNC_MAGIC_DEF("setInterval", 2, quv_setTimeout, 1 ),
    JS_CFUNC_DEF("clearInterval", 1, quv_clearTimeout ),
};

void quv_mod_timers_init(JSContext *ctx, JSModuleDef *m) {
    JS_NewClassID(&quv_timer_class_id);
    JS_NewClass(JS_GetRuntime(ctx), quv_timer_class_id, &quv_timer_class);
    JS_SetModuleExportList(ctx, m, quv_timer_funcs, countof(quv_timer_funcs));
}

void quv_mod_timers_export(JSContext *ctx, JSModuleDef *m) {
    JS_AddModuleExportList(ctx, m, quv_timer_funcs, countof(quv_timer_funcs));
}

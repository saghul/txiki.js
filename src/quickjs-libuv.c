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

#include <stdlib.h>
#include "quickjs-libuv.h"
#include "quv/error.h"
#include "quv/fs.h"
#include "quv/misc.h"
#include "quv/signals.h"
#include "quv/streams.h"
#include "quv/timers.h"
#include "quv/utils.h"


static int js_uv_init(JSContext *ctx, JSModuleDef *m)
{
    /* Streams */
    js_uv_mod_streams_init(ctx, m);

    /* Error */    
    js_uv_mod_error_init(ctx, m);

    /* Timers */
    js_uv_mod_timers_init(ctx, m);

    /* Signals */
    js_uv_mod_signals_init(ctx, m);

    /* FS */
    js_uv_mod_fs_init(ctx, m);

    /* Misc functions */
    js_uv_mod_misc_init(ctx, m);

    return 0;
}

JSModuleDef *js_init_module_uv(JSContext *ctx)
{
    JSModuleDef *m;
    m = JS_NewCModule(ctx, "uv", js_uv_init);
    if (!m)
        return NULL;

    js_uv_mod_error_export(ctx, m);
    js_uv_mod_fs_export(ctx, m);
    js_uv_mod_misc_export(ctx, m);
    js_uv_mod_streams_export(ctx, m);
    js_uv_mod_signals_export(ctx, m);
    js_uv_mod_timers_export(ctx, m);

    return m;
}

void JSUV_InitCtxOpaque(JSContext *ctx) {
    quv_state_t *state = js_mallocz(ctx, sizeof(*state));
    if (!state)
        abort();

    uv_loop_init(&state->uvloop);

    state->ctx = ctx;

    /* handle to prevent the loop from blocking for i/o when there are pending jobs */
    uv_idle_init(&state->uvloop, &state->jobs.idle);
    state->jobs.idle.data = state;

    /* handle which runs the job queue */
    uv_check_init(&state->uvloop, &state->jobs.check);
    state->jobs.check.data = state;

    /* signal handlers list */
    init_list_head(&state->signal_handlers);

    JS_SetContextOpaque(ctx, state);
}

static void uv__idle_cb(uv_idle_t *handle) {
    // Noop
}

static void uv__maybe_idle(JSContext *ctx) {
    quv_state_t *state = JS_GetContextOpaque(ctx);
    JSRuntime *rt = JS_GetRuntime(ctx);

    if (JS_IsJobPending(rt))
        uv_idle_start(&state->jobs.idle, uv__idle_cb);
    else
        uv_idle_stop(&state->jobs.idle);
}

static void uv__check_cb(uv_check_t *handle) {
    quv_state_t *state = handle->data;

    if (!state)
        abort();

    JSContext *ctx = state->ctx;
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSContext *ctx1;
    int err;

    /* execute the pending jobs */
    for(;;) {
        err = JS_ExecutePendingJob(rt, &ctx1);
        if (err <= 0) {
            if (err < 0) {
                js_uv_dump_error(ctx1);
            }
            break;
        }
    }

    uv__maybe_idle(ctx);
}

/* main loop which calls the user JS callbacks */
void js_uv_loop(JSContext *ctx) {
    quv_state_t *state = JS_GetContextOpaque(ctx);

    uv_check_start(&state->jobs.check, uv__check_cb);
    uv_unref((uv_handle_t*) &state->jobs.check);

    uv__maybe_idle(ctx);

    uv_run(&state->uvloop, UV_RUN_DEFAULT);

    // TODO: cleanup.
}

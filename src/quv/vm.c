
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

#include <string.h>

#include "../quickjs-libc.h"
#include "utils.h"
#include "vm.h"


extern const uint8_t bootstrap[];
extern const uint32_t bootstrap_size;

extern const uint8_t encoding[];
extern const uint32_t encoding_size;

static int quv__argc = 0;
static char **quv__argv = NULL;

struct QUVRuntime {
    JSRuntime *rt;
    JSContext *ctx;
    uv_loop_t loop;
    struct {
        uv_check_t check;
        uv_idle_t idle;
    } jobs;
    uv_async_t stop;
    BOOL is_worker;
};

static void quv__bootstrap_globals(JSContext *ctx) {
    /* Load bootstrap */
    js_std_eval_binary(ctx, bootstrap, bootstrap_size, 0);

    /* Load TextEncoder / TextDecoder */
    js_std_eval_binary(ctx, encoding, encoding_size, 0);
}

static void uv__stop(uv_async_t* handle) {
    QUVRuntime *qrt = handle->data;
    CHECK_NOT_NULL(qrt);

    uv_stop(&qrt->loop);
}

QUVRuntime *QUV_NewRuntime(void) {
    return QUV_NewRuntime2(FALSE);
}

QUVRuntime *QUV_NewRuntime2(BOOL is_worker) {
    QUVRuntime *qrt = calloc(1, sizeof(*qrt));

    qrt->rt = JS_NewRuntime();
    CHECK_NOT_NULL(qrt->rt);

    qrt->ctx = JS_NewContext(qrt->rt);
    CHECK_NOT_NULL(qrt->ctx);

    qrt->is_worker = is_worker;

    CHECK_EQ(uv_loop_init(&qrt->loop), 0);

    /* handle to prevent the loop from blocking for i/o when there are pending jobs. */
    CHECK_EQ(uv_idle_init(&qrt->loop, &qrt->jobs.idle), 0);
    qrt->jobs.idle.data = qrt;

    /* handle which runs the job queue */
    CHECK_EQ(uv_check_init(&qrt->loop, &qrt->jobs.check), 0);
    qrt->jobs.check.data = qrt;

    /* hande for stopping this runtime (also works from another thread) */
    CHECK_EQ(uv_async_init(&qrt->loop, &qrt->stop, uv__stop), 0);
    qrt->stop.data = qrt;

    JS_SetContextOpaque(qrt->ctx, qrt);

    /* loader for ES6 modules */
    JS_SetModuleLoaderFunc(qrt->rt, NULL, js_module_loader, NULL);

    js_std_add_helpers(qrt->ctx, quv__argc, quv__argv);

    /* system modules */
    js_init_module_std(qrt->ctx, "std");
    js_init_module_uv(qrt->ctx);

    quv__bootstrap_globals(qrt->ctx);

    return qrt;
}

void QUV_FreeRuntime(QUVRuntime *qrt) {
    /* Close all loop handles. */
    uv_close((uv_handle_t *) &qrt->jobs.idle, NULL);
    uv_close((uv_handle_t *) &qrt->jobs.check, NULL);
    uv_close((uv_handle_t *) &qrt->stop, NULL);

    JS_FreeContext(qrt->ctx);
    JS_FreeRuntime(qrt->rt);

    /* Cleanup loop. All handles should be closed. */
    int closed = 0;
    for (int i = 0; i < 5; i++) {
        if (uv_loop_close(&qrt->loop) == 0) {
            closed = 1;
            break;
        }
        uv_run(&qrt->loop, UV_RUN_NOWAIT);
    }
#if DEBUG
    if (!closed)
        uv_print_all_handles(&qrt->loop, stderr);
#endif
    CHECK_EQ(closed, 1);

    free(qrt);
}

void QUV_SetupArgs(int argc, char **argv) {
    quv__argc = argc;
    quv__argv = uv_setup_args(argc, argv);
    if (!quv__argv)
        quv__argv = argv;
}

JSContext *QUV_GetJSContext(QUVRuntime *qrt) {
    return qrt->ctx;
}

QUVRuntime *QUV_GetRuntime(JSContext *ctx) {
    return JS_GetContextOpaque(ctx);
}

static void uv__idle_cb(uv_idle_t *handle) {
    // Noop
}

static void uv__maybe_idle(QUVRuntime *qrt) {
    if (JS_IsJobPending(qrt->rt))
        CHECK_EQ(uv_idle_start(&qrt->jobs.idle, uv__idle_cb), 0);
    else
        CHECK_EQ(uv_idle_stop(&qrt->jobs.idle), 0);
}

static void uv__check_cb(uv_check_t *handle) {
    QUVRuntime *qrt = handle->data;
    CHECK_NOT_NULL(qrt);

    JSRuntime *rt = qrt->rt;
    JSContext *ctx1;
    int err;

    /* execute the pending jobs */
    for(;;) {
        err = JS_ExecutePendingJob(rt, &ctx1);
        if (err <= 0) {
            if (err < 0)
                quv_dump_error(ctx1);
            break;
        }
    }

    uv__maybe_idle(qrt);
}

/* main loop which calls the user JS callbacks */
void QUV_Run(QUVRuntime *qrt) {
    CHECK_EQ(uv_check_start(&qrt->jobs.check, uv__check_cb), 0);
    uv_unref((uv_handle_t*) &qrt->jobs.check);

    /* Use the async handle to keep the worker alive even when there is nothing to do. */
    if (!qrt->is_worker)
        uv_unref((uv_handle_t*) &qrt->stop);

    uv__maybe_idle(qrt);

    uv_run(&qrt->loop, UV_RUN_DEFAULT);
}

void QUV_Stop(QUVRuntime *qrt) {
    CHECK_NOT_NULL(qrt);
    uv_async_send(&qrt->stop);
}

uv_loop_t *QUV_GetLoop(QUVRuntime *qrt) {
    return &qrt->loop;
}

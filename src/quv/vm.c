
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

#include "../../deps/quickjs/src/cutils.h"
#include "../quv.h"
#include "private.h"

#include <string.h>


extern const uint8_t bootstrap[];
extern const uint32_t bootstrap_size;

extern const uint8_t bootstrap2[];
extern const uint32_t bootstrap2_size;

extern const uint8_t console[];
extern const uint32_t console_size;

extern const uint8_t encoding[];
extern const uint32_t encoding_size;

extern const uint8_t event_target[];
extern const uint32_t event_target_size;

extern const uint8_t getopts[];
extern const uint32_t getopts_size;

extern const uint8_t path[];
extern const uint32_t path_size;

extern const uint8_t performance[];
extern const uint32_t performance_size;

extern const uint8_t repl[];
extern const uint32_t repl_size;

extern const uint8_t url[];
extern const uint32_t url_size;

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
    bool is_worker;
};

static int quv_init(JSContext *ctx, JSModuleDef *m) {
    quv_mod_dns_init(ctx, m);
    quv_mod_error_init(ctx, m);
    quv_mod_fs_init(ctx, m);
    quv_mod_misc_init(ctx, m);
    quv_mod_process_init(ctx, m);
    quv_mod_signals_init(ctx, m);
    quv_mod_std_init(ctx, m);
    quv_mod_streams_init(ctx, m);
    quv_mod_timers_init(ctx, m);
    quv_mod_udp_init(ctx, m);
    quv_mod_worker_init(ctx, m);

    return 0;
}

JSModuleDef *js_init_module_uv(JSContext *ctx, const char *name) {
    JSModuleDef *m;
    m = JS_NewCModule(ctx, name, quv_init);
    if (!m)
        return NULL;

    quv_mod_dns_export(ctx, m);
    quv_mod_error_export(ctx, m);
    quv_mod_fs_export(ctx, m);
    quv_mod_misc_export(ctx, m);
    quv_mod_process_export(ctx, m);
    quv_mod_std_export(ctx, m);
    quv_mod_streams_export(ctx, m);
    quv_mod_signals_export(ctx, m);
    quv_mod_timers_export(ctx, m);
    quv_mod_udp_export(ctx, m);
    quv_mod_worker_export(ctx, m);

    return m;
}

static int quv__eval_binary(JSContext *ctx, const uint8_t *buf, size_t buf_len) {
    JSValue obj = JS_ReadObject(ctx, buf, buf_len, JS_READ_OBJ_BYTECODE);
    if (JS_IsException(obj))
        goto error;

    if (JS_VALUE_GET_TAG(obj) == JS_TAG_MODULE) {
        if (JS_ResolveModule(ctx, obj) < 0) {
            JS_FreeValue(ctx, obj);
            goto error;
        }
        js_module_set_import_meta(ctx, obj, FALSE, TRUE);
    }

    JSValue val = JS_EvalFunction(ctx, obj);
    if (JS_IsException(val))
        goto error;
    JS_FreeValue(ctx, val);

    return 0;

error:
    quv_dump_error(ctx);
    return -1;
}

static void quv__bootstrap_globals(JSContext *ctx) {
    /* Load bootstrap */
    CHECK_EQ(0, quv__eval_binary(ctx, bootstrap, bootstrap_size));

    /* Load Console */
    CHECK_EQ(0, quv__eval_binary(ctx, console, console_size));

    /* Load TextEncoder / TextDecoder */
    CHECK_EQ(0, quv__eval_binary(ctx, encoding, encoding_size));

    /* Load EventTarget */
    CHECK_EQ(0, quv__eval_binary(ctx, event_target, event_target_size));

    /* Load Performance */
    CHECK_EQ(0, quv__eval_binary(ctx, performance, performance_size));

    /* Load URL */
    CHECK_EQ(0, quv__eval_binary(ctx, url, url_size));

    /* Load bootstrap2 */
    CHECK_EQ(0, quv__eval_binary(ctx, bootstrap2, bootstrap2_size));
}

JSValue quv__get_args(JSContext *ctx) {
    JSValue args = JS_NewArray(ctx);
    for (int i = 0; i < quv__argc; i++) {
        JS_SetPropertyUint32(ctx, args, i, JS_NewString(ctx, quv__argv[i]));
    }
    return args;
}

static void uv__stop(uv_async_t *handle) {
    QUVRuntime *qrt = handle->data;
    CHECK_NOT_NULL(qrt);

    uv_stop(&qrt->loop);
}

QUVRuntime *QUV_NewRuntime(void) {
    return QUV_NewRuntime2(false);
}

QUVRuntime *QUV_NewRuntime2(bool is_worker) {
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
    JS_SetModuleLoaderFunc(qrt->rt, NULL, quv_module_loader, NULL);

    /* core module */
    js_init_module_uv(qrt->ctx, "@quv/core");

    quv__bootstrap_globals(qrt->ctx);

    /* extra builtin modules */
    CHECK_EQ(0, quv__eval_binary(qrt->ctx, getopts, getopts_size));
    CHECK_EQ(0, quv__eval_binary(qrt->ctx, path, path_size));

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
#ifdef DEBUG
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
    for (;;) {
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
    uv_unref((uv_handle_t *) &qrt->jobs.check);

    /* Use the async handle to keep the worker alive even when there is nothing to do. */
    if (!qrt->is_worker)
        uv_unref((uv_handle_t *) &qrt->stop);

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

int quv__load_file(JSContext *ctx, DynBuf *dbuf, const char *filename) {
    uv_fs_t req;
    uv_file fd;
    int r;

    r = uv_fs_open(NULL, &req, filename, O_RDONLY, 0, NULL);
    uv_fs_req_cleanup(&req);
    if (r < 0)
        return r;

    fd = r;
    char buf[4096];
    uv_buf_t b = uv_buf_init(buf, sizeof(buf));

    do {
        r = uv_fs_read(NULL, &req, fd, &b, 1, dbuf->size, NULL);
        uv_fs_req_cleanup(&req);
        if (r <= 0)
            break;
        r = dbuf_put(dbuf, (const uint8_t *) b.base, r);
        if (r != 0)
            break;
    } while (1);

    dbuf_putc(dbuf, '\0');
    return r;
}

JSValue QUV_EvalFile(JSContext *ctx, const char *filename, int flags, bool is_main) {
    DynBuf dbuf;
    int r, eval_flags;
    JSValue ret;

    dbuf_init(&dbuf);
    r = quv__load_file(ctx, &dbuf, filename);
    if (r != 0) {
        dbuf_free(&dbuf);
        JS_ThrowReferenceError(ctx, "could not load '%s'", filename);
        return JS_EXCEPTION;
    }

    if (flags == -1) {
        if (JS_DetectModule((const char *) dbuf.buf, dbuf.size))
            eval_flags = JS_EVAL_TYPE_MODULE;
        else
            eval_flags = JS_EVAL_TYPE_GLOBAL;
    } else {
        eval_flags = flags;
    }

    if ((eval_flags & JS_EVAL_TYPE_MASK) == JS_EVAL_TYPE_MODULE) {
        /* for the modules, we compile then run to be able to set import.meta */
        ret = JS_Eval(ctx, (char *) dbuf.buf, dbuf.size, filename, eval_flags | JS_EVAL_FLAG_COMPILE_ONLY);
        if (!JS_IsException(ret)) {
            js_module_set_import_meta(ctx, ret, TRUE, is_main);
            ret = JS_EvalFunction(ctx, ret);
        }
    } else {
        ret = JS_Eval(ctx, (char *) dbuf.buf, dbuf.size, filename, eval_flags);
    }

    /* Emit window 'load' event. */
    if (!JS_IsException(ret) && is_main) {
        static char emit_window_load[] = "window.dispatchEvent({type: 'load'});";
        JS_Eval(ctx, emit_window_load, strlen(emit_window_load), "<global>", JS_EVAL_TYPE_GLOBAL);
    }

    dbuf_free(&dbuf);
    return ret;
}

void QUV_RunRepl(JSContext *ctx) {
    CHECK_EQ(0, quv__eval_binary(ctx, repl, repl_size));
}

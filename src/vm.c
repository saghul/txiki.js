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

#include "mem.h"
#include "private.h"
#include "tjs.h"

#include <signal.h>
#include <stdatomic.h>
#include <stdio.h>
#include <string.h>

#define TJS__DEFAULT_STACK_SIZE 1024 * 1024  // 1 MB

/* JS malloc functions */

static void *tjs__mf_calloc(void *opaque, size_t count, size_t size) {
    (void) opaque;
    return tjs__calloc(count, size);
}

static void *tjs__mf_malloc(void *opaque, size_t size) {
    (void) opaque;
    return tjs__malloc(size);
}

static void tjs__mf_free(void *opaque, void *ptr) {
    (void) opaque;
    tjs__free(ptr);
}

static void *tjs__mf_realloc(void *opaque, void *ptr, size_t size) {
    (void) opaque;
    return tjs__realloc(ptr, size);
}

static const JSMallocFunctions tjs_mf = {
    .js_calloc = tjs__mf_calloc,
    .js_malloc = tjs__mf_malloc,
    .js_free = tjs__mf_free,
    .js_realloc = tjs__mf_realloc,
    .js_malloc_usable_size = tjs__malloc_usable_size,
};

/* SharedArrayBuffer functions */

typedef struct {
    int ref_count;
    uint8_t buf[0];
} TJSSABHeader;

static int atomic_add_int(int *ptr, int v) {
    return atomic_fetch_add((_Atomic(uint32_t) *) ptr, v) + v;
}

static void *tjs__sab_alloc(void *opaque, size_t size) {
    TJSSABHeader *sab = tjs__malloc(sizeof(*sab) + size);
    if (!sab) {
        return NULL;
    }
    sab->ref_count = 1;
    return sab->buf;
}

void tjs__sab_free(void *opaque, void *ptr) {
    TJSSABHeader *sab = (TJSSABHeader *) ((uint8_t *) ptr - sizeof(TJSSABHeader));
    int ref_count = atomic_add_int(&sab->ref_count, -1);
    assert(ref_count >= 0);
    if (ref_count == 0) {
        tjs__free(sab);
    }
}

void tjs__sab_dup(void *opaque, void *ptr) {
    TJSSABHeader *sab = (TJSSABHeader *) ((uint8_t *) ptr - sizeof(TJSSABHeader));
    atomic_add_int(&sab->ref_count, 1);
}

static const JSSharedArrayBufferFunctions tjs_sf = {
    .sab_alloc = tjs__sab_alloc,
    .sab_dup = tjs__sab_dup,
    .sab_free = tjs__sab_free,
    .sab_opaque = NULL,
};

/* core */
extern const uint8_t tjs__core[];
extern const uint32_t tjs__core_size;
extern const uint8_t tjs__polyfills[];
extern const uint32_t tjs__polyfills_size;
extern const uint8_t tjs__run_main[];
extern const uint32_t tjs__run_main_size;


static int tjs__argc = 0;
static char **tjs__argv = NULL;


static void tjs__bootstrap_core(JSContext *ctx, JSValue ns) {
    tjs__mod_dns_init(ctx, ns);
    tjs__mod_engine_init(ctx, ns);
    tjs__mod_error_init(ctx, ns);
    tjs__mod_ffi_init(ctx, ns);
    tjs__mod_fs_init(ctx, ns);
    tjs__mod_fswatch_init(ctx, ns);
    tjs__mod_os_init(ctx, ns);
    tjs__mod_process_init(ctx, ns);
    tjs__mod_signals_init(ctx, ns);
    tjs__mod_sqlite3_init(ctx, ns);
    tjs__mod_streams_init(ctx, ns);
    tjs__mod_sys_init(ctx, ns);
    tjs__mod_text_coding_init(ctx, ns);
    tjs__mod_timers_init(ctx, ns);
    tjs__mod_udp_init(ctx, ns);
    tjs__mod_wasm_init(ctx, ns);
    tjs__mod_worker_init(ctx, ns);
    tjs__mod_ws_init(ctx, ns);
    tjs__mod_xhr_init(ctx, ns);
#ifndef _WIN32
    tjs__mod_posix_socket_init(ctx, ns);
#endif
}

JSValue tjs__get_args(JSContext *ctx) {
    JSValue args = JS_NewArray(ctx);
    for (int i = 0; i < tjs__argc; i++) {
        JS_SetPropertyUint32(ctx, args, i, JS_NewString(ctx, tjs__argv[i]));
    }
    return args;
}

static JSValue tjs__dispatch_event(JSContext *ctx, JSValue *event) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);

    if (qrt->freeing) {
        return JS_UNDEFINED;
    }

    JSValue global_obj = JS_GetGlobalObject(ctx);
    JSValue ret = JS_Call(ctx, qrt->builtins.dispatch_event_func, global_obj, 1, event);
    JS_FreeValue(ctx, global_obj);

    return ret;
}

static void tjs__promise_rejection_tracker(JSContext *ctx,
                                           JSValue promise,
                                           JSValue reason,
                                           bool is_handled,
                                           void *opaque) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);

    if (qrt->freeing) {
        return;
    }

    if (!is_handled) {
        JSValue event_name = JS_NewString(ctx, "unhandledrejection");
        JSValue args[3];
        args[0] = event_name;
        args[1] = promise;
        args[2] = reason;

        JSValue event = JS_CallConstructor(ctx, qrt->builtins.promise_event_ctor, countof(args), args);
        CHECK_EQ(JS_IsException(event), 0);
        JSValue ret = tjs__dispatch_event(ctx, &event);

        JS_FreeValue(ctx, event);
        JS_FreeValue(ctx, event_name);

        if (JS_IsException(ret)) {
            tjs_dump_error(ctx);
            goto fail;
        } else {
            if (JS_ToBool(ctx, ret)) {
            // The event wasn't cancelled, maybe abort.
            fail:;
                TJSRuntime *qrt = TJS_GetRuntime(ctx);
                CHECK_NOT_NULL(qrt);
                JS_Throw(qrt->ctx, JS_DupValue(qrt->ctx, reason));
                TJS_Stop(qrt);
            }
        }

        JS_FreeValue(ctx, ret);
    }
}

static void uv__stop(uv_async_t *handle) {
    TJSRuntime *qrt = handle->data;
    CHECK_NOT_NULL(qrt);

    uv_stop(&qrt->loop);
}

void TJS_DefaultOptions(TJSRunOptions *options) {
    static TJSRunOptions default_options = { .mem_limit = 0, .stack_size = TJS__DEFAULT_STACK_SIZE };

    memcpy(options, &default_options, sizeof(*options));
}

TJSRuntime *TJS_NewRuntime(void) {
    TJSRunOptions options;
    TJS_DefaultOptions(&options);
    return TJS_NewRuntimeInternal(false, &options);
}

TJSRuntime *TJS_NewRuntimeOptions(TJSRunOptions *options) {
    return TJS_NewRuntimeInternal(false, options);
}

TJSRuntime *TJS_NewRuntimeWorker(void) {
    TJSRunOptions options;
    TJS_DefaultOptions(&options);
    return TJS_NewRuntimeInternal(true, &options);
}

TJSRuntime *TJS_NewRuntimeInternal(bool is_worker, TJSRunOptions *options) {
    JSRuntime *rt = NULL;
    JSContext *ctx = NULL;
    TJSRuntime *qrt = tjs__mallocz(sizeof(*qrt));

    memcpy(&qrt->options, options, sizeof(*options));

    rt = JS_NewRuntime2(&tjs_mf, NULL);
    CHECK_NOT_NULL(rt);
    qrt->rt = rt;

    ctx = JS_NewContext(rt);
    CHECK_NOT_NULL(ctx);
    qrt->ctx = ctx;

    JS_SetRuntimeOpaque(rt, qrt);
    JS_SetContextOpaque(ctx, qrt);

    /* Set memory limit */
    JS_SetMemoryLimit(rt, options->mem_limit);

    /* Set stack size */
    JS_SetMaxStackSize(rt, options->stack_size);

    /* SharedArrayBuffer functions */
    JS_SetSharedArrayBufferFunctions(rt, &tjs_sf);

    /* Worker support */
    qrt->is_worker = is_worker;
    JS_SetCanBlock(rt, is_worker);

    CHECK_EQ(uv_loop_init(&qrt->loop), 0);

    /* handle which runs the job queue */
    CHECK_EQ(uv_prepare_init(&qrt->loop, &qrt->jobs.prepare), 0);
    qrt->jobs.prepare.data = qrt;

    /* handle to prevent the loop from blocking for i/o when there are pending jobs. */
    CHECK_EQ(uv_idle_init(&qrt->loop, &qrt->jobs.idle), 0);
    qrt->jobs.idle.data = qrt;

    /* handle which runs the job queue */
    CHECK_EQ(uv_check_init(&qrt->loop, &qrt->jobs.check), 0);
    qrt->jobs.check.data = qrt;

    /* handle for stopping this runtime (also works from another thread) */
    CHECK_EQ(uv_async_init(&qrt->loop, &qrt->stop, uv__stop), 0);
    qrt->stop.data = qrt;

    /* loader for ES modules */
    JS_SetModuleLoaderFunc(rt, tjs_module_normalizer, tjs_module_loader, qrt);

    /* unhandled promise rejection tracker */
    JS_SetHostPromiseRejectionTracker(rt, tjs__promise_rejection_tracker, NULL);

    /* start bootstrap */
    JSValue global_obj = JS_GetGlobalObject(ctx);
    JSValue core_sym = JS_NewSymbol(ctx, "tjs.internal.core", true);
    JSAtom core_atom = JS_ValueToAtom(ctx, core_sym);
    JSValue core = JS_NewObjectProto(ctx, JS_NULL);

    CHECK_EQ(JS_DefinePropertyValue(ctx, global_obj, core_atom, core, JS_PROP_C_W_E), true);
    CHECK_EQ(JS_DefinePropertyValueStr(ctx, core, "isWorker", JS_NewBool(ctx, is_worker), JS_PROP_C_W_E), true);

    tjs__bootstrap_core(ctx, core);

    CHECK_EQ(tjs__eval_bytecode(ctx, tjs__polyfills, tjs__polyfills_size, true), 0);
    CHECK_EQ(tjs__eval_bytecode(ctx, tjs__core, tjs__core_size, true), 0);

    /* Load some builtin references for easy access */
    qrt->builtins.dispatch_event_func = JS_GetPropertyStr(ctx, global_obj, "dispatchEvent");
    CHECK_EQ(JS_IsUndefined(qrt->builtins.dispatch_event_func), 0);
    qrt->builtins.promise_event_ctor = JS_GetPropertyStr(qrt->ctx, global_obj, "PromiseRejectionEvent");
    CHECK_EQ(JS_IsUndefined(qrt->builtins.promise_event_ctor), 0);

    /* end bootstrap */
    JS_FreeAtom(ctx, core_atom);
    JS_FreeValue(ctx, core_sym);
    JS_FreeValue(ctx, global_obj);

    /* WASM */
    qrt->wasm_ctx.env = m3_NewEnvironment();

    /* Timers */
    qrt->timers.timers = NULL;
    qrt->timers.next_timer = 1;

    return qrt;
}

void TJS_FreeRuntime(TJSRuntime *qrt) {
    qrt->freeing = true;

    /* Close all core loop handles. */
    uv_close((uv_handle_t *) &qrt->jobs.prepare, NULL);
    uv_close((uv_handle_t *) &qrt->jobs.idle, NULL);
    uv_close((uv_handle_t *) &qrt->jobs.check, NULL);
    uv_close((uv_handle_t *) &qrt->stop, NULL);
    if (qrt->curl_ctx.curlm_h) {
        uv_close((uv_handle_t *) &qrt->curl_ctx.timer, NULL);
    }

    /* Destroy all timers */
    tjs__destroy_timers(qrt);

    /* Destroy the JS engine. */
    JS_FreeValue(qrt->ctx, qrt->builtins.dispatch_event_func);
    qrt->builtins.dispatch_event_func = JS_UNDEFINED;
    JS_FreeValue(qrt->ctx, qrt->builtins.promise_event_ctor);
    qrt->builtins.promise_event_ctor = JS_UNDEFINED;
    JS_FreeContext(qrt->ctx);
    JS_FreeRuntime(qrt->rt);

    /* Destroy CURLM handle. */
    if (qrt->curl_ctx.curlm_h) {
        curl_multi_cleanup(qrt->curl_ctx.curlm_h);
        qrt->curl_ctx.curlm_h = NULL;
    }

    /* Destroy WASM runtime. */
    m3_FreeEnvironment(qrt->wasm_ctx.env);
    qrt->wasm_ctx.env = NULL;

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
    if (!closed) {
        uv_print_all_handles(&qrt->loop, stderr);
    }
    CHECK_EQ(closed, 1);
#else
    (void) closed;
#endif

    tjs__free(qrt);
}

void TJS_Initialize(int argc, char **argv) {
    curl_global_init(CURL_GLOBAL_ALL);

    CHECK_EQ(0, uv_replace_allocator(tjs__malloc, tjs__realloc, tjs__calloc, tjs__free));

    tjs__argc = argc;
    tjs__argv = uv_setup_args(argc, argv);

    setvbuf(stdout, NULL, _IONBF, 0);
    setvbuf(stderr, NULL, _IONBF, 0);

#ifdef SIGPIPE
    signal(SIGPIPE, SIG_IGN);
#endif
}

JSContext *TJS_GetJSContext(TJSRuntime *qrt) {
    return qrt->ctx;
}

TJSRuntime *TJS_GetRuntime(JSContext *ctx) {
    return JS_GetContextOpaque(ctx);
}

static void uv__idle_cb(uv_idle_t *handle) {
    // Noop
}

static void uv__maybe_idle(TJSRuntime *qrt) {
    if (JS_IsJobPending(qrt->rt)) {
        CHECK_EQ(uv_idle_start(&qrt->jobs.idle, uv__idle_cb), 0);
    } else {
        CHECK_EQ(uv_idle_stop(&qrt->jobs.idle), 0);
    }
}

static void uv__prepare_cb(uv_prepare_t *handle) {
    TJSRuntime *qrt = handle->data;
    CHECK_NOT_NULL(qrt);

    uv__maybe_idle(qrt);
}

void tjs__execute_jobs(JSContext *ctx) {
    JSContext *ctx1;
    int err;

    /* execute the pending jobs */
    for (;;) {
        err = JS_ExecutePendingJob(JS_GetRuntime(ctx), &ctx1);
        if (err <= 0) {
            if (err < 0) {
                TJSRuntime *qrt = TJS_GetRuntime(ctx);
                CHECK_NOT_NULL(qrt);
                TJS_Stop(qrt);
            }

            break;
        }
    }
}

static void uv__check_cb(uv_check_t *handle) {
    TJSRuntime *qrt = handle->data;
    CHECK_NOT_NULL(qrt);

    tjs__execute_jobs(qrt->ctx);

    uv__maybe_idle(qrt);
}

/* main loop which calls the user JS callbacks */
int TJS_Run(TJSRuntime *qrt) {
    int ret = 0;

    CHECK_EQ(uv_prepare_start(&qrt->jobs.prepare, uv__prepare_cb), 0);
    uv_unref((uv_handle_t *) &qrt->jobs.prepare);
    CHECK_EQ(uv_check_start(&qrt->jobs.check, uv__check_cb), 0);
    uv_unref((uv_handle_t *) &qrt->jobs.check);

    /* Use the async handle to keep the worker alive even when there is nothing to do. */
    if (!qrt->is_worker) {
        uv_unref((uv_handle_t *) &qrt->stop);

        /* If we are running the main interpreter, run the entrypoint. */
        ret = tjs__eval_bytecode(qrt->ctx, tjs__run_main, tjs__run_main_size, true);
    }

    if (ret != 0) {
        return ret;
    }

    int r;
    do {
        uv__maybe_idle(qrt);
        r = uv_run(&qrt->loop, UV_RUN_DEFAULT);
    } while (r == 0 && JS_IsJobPending(qrt->rt));

    if (JS_HasException(qrt->ctx)) {
        tjs_dump_error(qrt->ctx);
        ret = 1;
    }

    return ret;
}

void TJS_Stop(TJSRuntime *qrt) {
    CHECK_NOT_NULL(qrt);
    uv_async_send(&qrt->stop);
}

uv_loop_t *TJS_GetLoop(TJSRuntime *qrt) {
    return &qrt->loop;
}

int tjs__load_file(JSContext *ctx, DynBuf *dbuf, const char *filename) {
    uv_fs_t req;
    uv_file fd;
    int r;

    r = uv_fs_open(NULL, &req, filename, O_RDONLY, 0, NULL);
    uv_fs_req_cleanup(&req);
    if (r < 0) {
        return r;
    }

    fd = r;
    char buf[64 * 1024];
    uv_buf_t b = uv_buf_init(buf, sizeof(buf));
    size_t offset = 0;

    do {
        r = uv_fs_read(NULL, &req, fd, &b, 1, offset, NULL);
        uv_fs_req_cleanup(&req);
        if (r <= 0) {
            break;
        }
        offset += r;
        r = dbuf_put(dbuf, (const uint8_t *) b.base, r);
        if (r != 0) {
            break;
        }
    } while (1);

    uv_fs_close(NULL, &req, fd, NULL);
    uv_fs_req_cleanup(&req);

    return r;
}

JSValue TJS_EvalModuleContent(JSContext *ctx,
                              const char *specifier,
                              bool is_main,
                              bool use_real_path,
                              const char *content,
                              size_t len) {
    /* Compile then run to be able to set import.meta */
    JSValue ret = JS_Eval(ctx, content, len, specifier, JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
    if (!JS_IsException(ret)) {
        js_module_set_import_meta(ctx, ret, use_real_path, is_main);
        ret = JS_EvalFunction(ctx, ret);
    }

    /* Emit window 'load' event. */
    if (!JS_IsException(ret) && is_main) {
        static char emit_window_load[] = "window.dispatchEvent(new Event('load'));";
        JSValue ret1 = JS_Eval(ctx, emit_window_load, strlen(emit_window_load), "<global>", JS_EVAL_TYPE_GLOBAL);
        if (JS_IsException(ret1)) {
            tjs_dump_error(ctx);
        }
    }

    return ret;
}

JSValue TJS_EvalScript(JSContext *ctx, const char *filename) {
    DynBuf dbuf;
    size_t dbuf_size;
    int r;
    JSValue ret;

    tjs_dbuf_init(ctx, &dbuf);
    r = tjs__load_file(ctx, &dbuf, filename);
    if (r != 0) {
        dbuf_free(&dbuf);
        JS_ThrowReferenceError(ctx, "could not load '%s' - %s: %s", filename, uv_err_name(r), uv_strerror(r));
        return JS_EXCEPTION;
    }

    dbuf_size = dbuf.size;

    /* Add null termination, required by JS_Eval. */
    dbuf_putc(&dbuf, '\0');

    ret = JS_Eval(ctx, (char *) dbuf.buf, dbuf_size - 1, filename, JS_EVAL_TYPE_GLOBAL);

    dbuf_free(&dbuf);
    return ret;
}

JSValue TJS_EvalModule(JSContext *ctx, const char *filename, bool is_main) {
    DynBuf dbuf;
    size_t dbuf_size;
    int r;
    JSValue ret;

    tjs_dbuf_init(ctx, &dbuf);
    r = tjs__load_file(ctx, &dbuf, filename);
    if (r != 0) {
        dbuf_free(&dbuf);
        JS_ThrowReferenceError(ctx, "could not load '%s' - %s: %s", filename, uv_err_name(r), uv_strerror(r));
        return JS_EXCEPTION;
    }

    dbuf_size = dbuf.size;

    /* Add null termination, required by JS_Eval. */
    dbuf_putc(&dbuf, '\0');

    ret = TJS_EvalModuleContent(ctx, filename, is_main, true, (char *) dbuf.buf, dbuf_size - 1);

    dbuf_free(&dbuf);
    return ret;
}

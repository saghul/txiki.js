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

#include <string.h>


extern const uint8_t tjs__worker_bootstrap[];
extern const uint32_t tjs__worker_bootstrap_size;

/* Report an uncaught worker error to the parent over the worker's message
 * channel (surfaces as Worker.onerror). The thrown value may be any JS value,
 * so distill it to a structured-clonable {name, message, stack}. */
void tjs__worker_post_error(JSContext *ctx, JSValueConst error) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);

    if (!qrt->is_worker) {
        return;
    }

    /* Cleared at the start of teardown, so this also short-circuits shutdown. */
    JSValue pipe = qrt->builtins.internal_message_pipe;
    if (JS_IsUndefined(pipe)) {
        return;
    }

    JSValue obj = JS_NewObject(ctx);
    if (JS_IsException(obj)) {
        JS_FreeValue(ctx, JS_GetException(ctx));
        return;
    }

    JSValue message = JS_UNDEFINED;
    if (!JS_IsUndefined(error) && !JS_IsNull(error)) {
        message = JS_GetPropertyStr(ctx, error, "message");
    }
    if (!JS_IsString(message)) {
        JS_FreeValue(ctx, message);
        message = JS_ToString(ctx, error);
    }
    JS_SetPropertyStr(ctx, obj, "message", message);

    if (!JS_IsUndefined(error) && !JS_IsNull(error)) {
        JSValue name = JS_GetPropertyStr(ctx, error, "name");
        if (JS_IsString(name)) {
            JS_SetPropertyStr(ctx, obj, "name", name);
        } else {
            JS_FreeValue(ctx, name);
        }
        JSValue stack = JS_GetPropertyStr(ctx, error, "stack");
        if (JS_IsString(stack)) {
            JS_SetPropertyStr(ctx, obj, "stack", stack);
        } else {
            JS_FreeValue(ctx, stack);
        }
    }

    tjs__channel_port_post_error(ctx, pipe, obj);
    JS_FreeValue(ctx, obj);
}

typedef struct {
    const char *specifier;
    const char *source;
    /* Borrowed from the parent runtime; valid until the worker posts sem. */
    const char *cookie_jar_path;
    const char *ca_bundle_path;
    TJSMailbox *rx; /* worker's receive side */
    TJSMailbox *tx; /* worker's send side */
    uv_sem_t *sem;
    TJSRuntime *wrt;
    uv_async_t *exit_async; /* parent's, signalled when the worker's loop ends */
} worker_data_t;

typedef struct {
    JSContext *realm; /* parent context, owned reference */
    uv_thread_t tid;
    JSValue msg_port; /* parent-side MessagePort handle (native mod_channel port) */
    TJSRuntime *wrt;
    /* Pins the wrapper while the worker runs: the only path back to it is the
     * msg_port -> deliver_fn -> Worker cycle, which the GC would otherwise
     * collect (stopping a live worker) once JS can no longer reach it. */
    TJSHandlePin pin;
    uv_async_t exit_async;
} TJSWorker;

/* Enable inbound message delivery on the worker's port, once its entry module has
 * run and installed any message handlers (the bootstrap only registers this; it
 * does not start the port itself). See worker-bootstrap.js for why this is
 * deferred rather than done at bootstrap time. */
static void worker_enable_message_delivery(JSContext *ctx) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);
    JSValue start = JS_GetPropertyStr(ctx, qrt->builtins.internal_core, "workerStartMessagePipe");
    if (JS_IsFunction(ctx, start)) {
        tjs_call_handler(ctx, start, 0, NULL);
    }
    JS_FreeValue(ctx, start);
}

static JSValue worker_eval(JSContext *ctx, int argc, JSValue *argv) {
    const char *specifier;
    JSValue ret;

    specifier = JS_ToCString(ctx, argv[0]);
    if (!specifier) {
        goto error;
    }

    if (!JS_IsUndefined(argv[1])) {
        size_t len;
        const char *source = JS_ToCStringLen(ctx, &len, argv[1]);
        ret = TJS_EvalModuleContent(ctx, specifier, false, false, source, len);
        JS_FreeCString(ctx, source);
    } else {
        ret = TJS_EvalModule(ctx, specifier, false);
    }
    JS_FreeCString(ctx, specifier);

    if (JS_IsException(ret)) {
        JS_FreeValue(ctx, ret);
        goto error;
    }

    JS_FreeValue(ctx, ret);

    /* The entry module has run and installed its handlers; start delivering. Any
     * message the parent posted during startup was buffered and is flushed now. */
    worker_enable_message_delivery(ctx);

    return JS_UNDEFINED;

error:;
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);

    /* Report the load/eval failure to the parent (self.onerror + Worker.onerror),
     * then restore the pending exception so it is still dumped to stderr. */
    JSValue exc = JS_GetException(ctx);
    tjs__worker_handle_uncaught(ctx, exc);
    JS_Throw(ctx, exc);

    TJS_Stop(qrt);

    return JS_UNDEFINED;
}

/* This is what the worker runs */
static void worker_entry(void *arg) {
    worker_data_t *wd = arg;

    TJSRuntime *wrt = TJS_NewRuntimeWorker();
    CHECK_NOT_NULL(wrt);
    JSContext *ctx = TJS_GetJSContext(wrt);

    /* Inherit the parent's lws config; TJS_FreeRuntime frees these with js_free. */
    if (wd->cookie_jar_path) {
        wrt->lws.cookie_jar_path = js_strdup(ctx, wd->cookie_jar_path);
        CHECK_NOT_NULL(wrt->lws.cookie_jar_path);
    }
    if (wd->ca_bundle_path) {
        wrt->lws.ca_bundle_path = js_strdup(ctx, wd->ca_bundle_path);
        CHECK_NOT_NULL(wrt->lws.ca_bundle_path);
    }

    /* Wrap the worker's side of the channel and expose it to the bootstrap. */
    JSValue message_pipe = tjs__channel_port_new(ctx, wd->rx, wd->tx);
    CHECK_EQ(JS_IsException(message_pipe), 0);
    JS_FreeValue(ctx, wrt->builtins.internal_message_pipe);
    wrt->builtins.internal_message_pipe = message_pipe;

    CHECK_EQ(tjs__eval_bytecode(ctx, tjs__worker_bootstrap, tjs__worker_bootstrap_size, true), 0);

    /* Load and eval the specifier when the loop runs. */
    JSValue specifier = JS_NewString(ctx, wd->specifier);
    JSValue source = wd->source ? JS_NewString(ctx, wd->source) : JS_UNDEFINED;
    JSValue args[2] = { specifier, source };

    CHECK_EQ(JS_EnqueueJob(ctx, worker_eval, 2, (JSValue *) &args), 0);

    JS_FreeValue(ctx, source);
    JS_FreeValue(ctx, specifier);

    /* Notify the caller we are setup. wd lives on the caller's stack and is gone
     * once the semaphore is posted. */
    uv_async_t *exit_async = wd->exit_async;
    wd->wrt = wrt;
    uv_sem_post(wd->sem);
    wd = NULL;

    TJS_Run(wrt);

    /* The runtime is freed by the parent (terminate()/finalizer/exit callback)
     * after joining this thread, so the parent never dereferences a freed
     * runtime — a worker can stop its own loop (self.close(), an uncaught error)
     * before the parent calls terminate(). This send is the thread's last access
     * to parent state: the parent joins this thread before it closes exit_async
     * or frees the worker. */
    uv_async_send(exit_async);
}

/* Stop the worker (if still running), wait for its thread to finish and free its
 * runtime. The parent owns the worker runtime's lifetime, so this is safe whether
 * the worker is still running or has already stopped itself. */
static void worker_reap(TJSWorker *w) {
    if (w->wrt) {
        TJS_Stop(w->wrt);
        CHECK_EQ(uv_thread_join(&w->tid), 0);
        TJS_FreeRuntime(w->wrt);
        w->wrt = NULL;
    }
}

/* Reap the worker, then disentangle the parent side so the parent loop can exit. */
static void tjs_worker_shutdown(TJSWorker *w) {
    worker_reap(w);
    tjs__channel_port_close(JS_GetRuntime(w->realm), w->msg_port);
}

/* The worker's loop ended on its own (self.close(), an uncaught error, a failed
 * load). Reap it, deliver what it posted before stopping, and stop keeping the
 * parent alive. The port stays started so a later postMessage() is dropped (the
 * worker side is closed) rather than throwing. */
static void worker_exit_cb(uv_async_t *handle) {
    TJSWorker *w = handle->data;

    /* Unpinned means terminate() or teardown already shut the worker down. */
    if (JS_IsUndefined(w->pin.obj)) {
        return;
    }

    /* The flush runs JS that may call terminate() (dropping the pin); hold the
     * wrapper, and so w->msg_port, until we are done. */
    JSContext *ctx = w->realm;
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSValue obj = JS_DupValue(ctx, w->pin.obj);

    worker_reap(w);
    tjs__channel_port_flush(rt, w->msg_port);
    tjs__channel_port_unref(rt, w->msg_port);
    tjs__handle_unpin(ctx, &w->pin);

    /* May finalize the wrapper; touch nothing after it. */
    JS_FreeValueRT(rt, obj);
}

static void worker_exit_close_cb(uv_handle_t *handle) {
    tjs__free(handle->data);
}

/* Teardown of the parent runtime: shut the worker down without running JS. The
 * pin is released by tjs__release_pins, and the finalizer frees the worker. */
static void worker_pin_detach(TJSHandlePin *pin) {
    tjs_worker_shutdown(list_entry(pin, TJSWorker, pin));
}

static void tjs_worker_finalizer(JSRuntime *rt, JSValue val) {
    TJSWorker *w = JS_GetOpaque(val, tjs__class_id_rt(rt, TJS_CLASS_WORKER));
    if (w) {
        /* A pinned worker holds a ref to itself, so it can't be finalized until
         * the pin is released (terminate(), exit, or teardown). */
        CHECK(JS_IsUndefined(w->pin.obj));
        /* Shutdown joins the worker thread, so once it returns nothing else can
         * touch *w; it is freed once exit_async is closed. */
        tjs_worker_shutdown(w);
        JS_FreeValueRT(rt, w->msg_port);
        JS_FreeContext(w->realm);
        uv_close((uv_handle_t *) &w->exit_async, worker_exit_close_cb);
    }
}

static void tjs_worker_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSWorker *w = JS_GetOpaque(val, tjs__class_id_rt(rt, TJS_CLASS_WORKER));
    if (w) {
        JS_MarkValue(rt, w->msg_port, mark_func);
        mark_func(rt, (JSGCObjectHeader *) w->realm);
    }
}

static JSClassDef tjs_worker_class = {
    "Worker",
    .finalizer = tjs_worker_finalizer,
    .gc_mark = tjs_worker_mark,
};

static TJSWorker *tjs_worker_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs__class_id(ctx, TJS_CLASS_WORKER));
}

/* Create the Worker object and wrap the parent side of the channel (rx, tx). On
 * failure the mailboxes keep their reserved refs and are reclaimed by the
 * caller's tjs__channel_mailbox_unref. */
static JSValue tjs_new_worker(JSContext *ctx, TJSMailbox *rx, TJSMailbox *tx) {
    JSValue obj = JS_NewObjectClass(ctx, tjs__class_id(ctx, TJS_CLASS_WORKER));
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSWorker *w = tjs__mallocz(sizeof(*w));
    if (!w) {
        JS_FreeValue(ctx, obj);
        return JS_ThrowOutOfMemory(ctx);
    }

    w->pin.obj = JS_UNDEFINED;
    w->pin.detach = worker_pin_detach;
    w->msg_port = tjs__channel_port_new(ctx, rx, tx);
    if (JS_IsException(w->msg_port)) {
        JS_FreeValue(ctx, obj);
        tjs__free(w);
        return JS_EXCEPTION;
    }

    /* Unref'd: the started parent port is what keeps the loop alive. */
    CHECK_EQ(uv_async_init(tjs_get_loop(ctx), &w->exit_async, worker_exit_cb), 0);
    w->exit_async.data = w;
    uv_unref((uv_handle_t *) &w->exit_async);

    w->realm = JS_DupContext(ctx);
    JS_SetOpaque(obj, w);
    return obj;
}

static JSValue tjs_worker_constructor(JSContext *ctx, JSValue new_target, int argc, JSValue *argv) {
    const char *specifier = JS_ToCString(ctx, argv[0]);
    if (!specifier) {
        return JS_EXCEPTION;
    }

    TJSMailbox *m0, *m1;
    if (!tjs__channel_mailbox_pair(&m0, &m1)) {
        JS_FreeCString(ctx, specifier);
        return JS_ThrowOutOfMemory(ctx);
    }

    JSValue obj = tjs_new_worker(ctx, m0, m1); /* parent side: receives on m0, sends to m1 */
    if (JS_IsException(obj)) {
        tjs__channel_mailbox_unref(m0);
        tjs__channel_mailbox_unref(m1);
        JS_FreeCString(ctx, specifier);
        return JS_EXCEPTION;
    }

    TJSWorker *w = tjs_worker_get(ctx, obj);

    /* We will wait for the worker to complete the creation of the VM. */
    uv_sem_t sem;
    CHECK_EQ(uv_sem_init(&sem, 0), 0);

    const char *source = JS_IsUndefined(argv[1]) ? NULL : JS_ToCString(ctx, argv[1]);

    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);

    worker_data_t worker_data = { .rx = m1, /* worker side: receives on m1, sends to m0 */
                                  .tx = m0,
                                  .specifier = specifier,
                                  .source = source,
                                  .cookie_jar_path = qrt->lws.cookie_jar_path,
                                  .ca_bundle_path = qrt->lws.ca_bundle_path,
                                  .sem = &sem,
                                  .wrt = NULL,
                                  .exit_async = &w->exit_async };

    CHECK_EQ(uv_thread_create(&w->tid, worker_entry, (void *) &worker_data), 0);

    /* Wait for the worker to initialize. */
    uv_sem_wait(&sem);
    uv_sem_destroy(&sem);

    /* Both ports now hold their own mailbox refs; drop the reserved ones. */
    tjs__channel_mailbox_unref(m0);
    tjs__channel_mailbox_unref(m1);

    JS_FreeCString(ctx, specifier);
    JS_FreeCString(ctx, source);

    uv_update_time(tjs_get_loop(ctx));

    worker_data.sem = NULL;
    w->wrt = worker_data.wrt;
    CHECK_NOT_NULL(w->wrt);

    tjs__handle_pin(ctx, &w->pin, obj);

    return obj;
}

static JSValue tjs_worker_terminate(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWorker *w = tjs_worker_get(ctx, this_val);
    if (!w) {
        return JS_EXCEPTION;
    }
    /* Also after the worker stopped itself (already reaped), so the port is
     * closed and a later postMessage() throws, as before. */
    tjs_worker_shutdown(w);
    uv_update_time(tjs_get_loop(ctx));
    tjs__handle_unpin(ctx, &w->pin);
    return JS_UNDEFINED;
}

/* WorkerGlobalScope.close(): stop the calling worker's own runtime. */
static JSValue tjs_worker_self_close(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);
    TJS_Stop(qrt);
    return JS_UNDEFINED;
}

static JSValue tjs_worker_get_msgpipe(JSContext *ctx, JSValue this_val) {
    TJSWorker *w = tjs_worker_get(ctx, this_val);
    if (!w) {
        return JS_EXCEPTION;
    }
    return JS_DupValue(ctx, w->msg_port);
}

static const JSCFunctionListEntry tjs_worker_proto_funcs[] = {
    TJS_CFUNC_DEF("terminate", 0, tjs_worker_terminate),
    TJS_CGETSET_DEF("messagePipe", tjs_worker_get_msgpipe, NULL),
};

void tjs__mod_worker_init(JSContext *ctx, JSValue ns) {
    JSValue proto, obj;

    /* Worker class */
    CHECK_EQ(tjs__class_register(ctx, TJS_CLASS_WORKER, &tjs_worker_class), 0);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_worker_proto_funcs, countof(tjs_worker_proto_funcs));
    JS_SetClassProto(ctx, tjs__class_id(ctx, TJS_CLASS_WORKER), proto);

    /* Worker object */
    obj = JS_NewCFunction2(ctx, tjs_worker_constructor, "Worker", 2, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, ns, "Worker", obj, JS_PROP_C_W_E);

    /* Backing for WorkerGlobalScope.close(), wired up by the worker bootstrap. */
    JS_DefinePropertyValueStr(ctx,
                              ns,
                              "workerClose",
                              JS_NewCFunction(ctx, tjs_worker_self_close, "workerClose", 0),
                              JS_PROP_C_W_E);
}

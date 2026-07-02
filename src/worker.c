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

    if (!qrt->is_worker || qrt->freeing) {
        return;
    }

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

static JSClassID tjs_worker_class_id;

typedef struct {
    const char *specifier;
    const char *source;
    TJSMailbox *rx; /* worker's receive side */
    TJSMailbox *tx; /* worker's send side */
    uv_sem_t *sem;
    TJSRuntime *wrt;
} worker_data_t;

typedef struct {
    JSContext *ctx;
    uv_thread_t tid;
    JSValue message_pipe; /* parent-side MessagePort handle (native mod_channel port) */
    TJSRuntime *wrt;
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

    /* Notify the caller we are setup.  */
    wd->wrt = wrt;
    uv_sem_post(wd->sem);
    wd = NULL;

    TJS_Run(wrt);

    /* The runtime is freed by the parent (terminate()/finalizer) after joining
     * this thread, so the parent never dereferences a freed runtime — a worker
     * can stop its own loop (self.close(), an uncaught error) before the parent
     * calls terminate(). */
}

/* Stop the worker (if still running), wait for its thread to finish, free its
 * runtime, then disentangle the parent side so the parent loop can exit. The
 * parent owns the worker runtime's lifetime, so this is safe whether the worker
 * is still running or has already stopped itself. */
static void tjs_worker_shutdown(TJSWorker *w) {
    if (w->wrt) {
        TJS_Stop(w->wrt);
        CHECK_EQ(uv_thread_join(&w->tid), 0);
        TJS_FreeRuntime(w->wrt);
        w->wrt = NULL;
    }
    tjs__channel_port_close(w->message_pipe);
}

static void tjs_worker_finalizer(JSRuntime *rt, JSValue val) {
    TJSWorker *w = JS_GetOpaque(val, tjs_worker_class_id);
    if (w) {
        tjs_worker_shutdown(w);
        JS_FreeValueRT(rt, w->message_pipe);
        tjs__free(w);
    }
}

static void tjs_worker_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSWorker *w = JS_GetOpaque(val, tjs_worker_class_id);
    if (w) {
        JS_MarkValue(rt, w->message_pipe, mark_func);
    }
}

static JSClassDef tjs_worker_class = {
    "Worker",
    .finalizer = tjs_worker_finalizer,
    .gc_mark = tjs_worker_mark,
};

static TJSWorker *tjs_worker_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_worker_class_id);
}

/* Create the Worker object and wrap the parent side of the channel (rx, tx). On
 * failure the mailboxes keep their reserved refs and are reclaimed by the
 * caller's tjs__channel_mailbox_unref. */
static JSValue tjs_new_worker(JSContext *ctx, TJSMailbox *rx, TJSMailbox *tx) {
    JSValue obj = JS_NewObjectClass(ctx, tjs_worker_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSWorker *w = tjs__mallocz(sizeof(*w));
    if (!w) {
        JS_FreeValue(ctx, obj);
        return JS_ThrowOutOfMemory(ctx);
    }

    w->ctx = ctx;
    w->message_pipe = tjs__channel_port_new(ctx, rx, tx);
    if (JS_IsException(w->message_pipe)) {
        JS_FreeValue(ctx, obj);
        tjs__free(w);
        return JS_EXCEPTION;
    }

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

    worker_data_t worker_data = { .rx = m1, /* worker side: receives on m1, sends to m0 */
                                  .tx = m0,
                                  .specifier = specifier,
                                  .source = source,
                                  .sem = &sem,
                                  .wrt = NULL };

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

    return obj;
}

static JSValue tjs_worker_terminate(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWorker *w = tjs_worker_get(ctx, this_val);
    if (!w) {
        return JS_EXCEPTION;
    }
    if (w->wrt) {
        tjs_worker_shutdown(w);
        uv_update_time(tjs_get_loop(ctx));
    }
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
    return JS_DupValue(ctx, w->message_pipe);
}

static const JSCFunctionListEntry tjs_worker_proto_funcs[] = {
    TJS_CFUNC_DEF("terminate", 0, tjs_worker_terminate),
    TJS_CGETSET_DEF("messagePipe", tjs_worker_get_msgpipe, NULL),
};

void tjs__mod_worker_init(JSContext *ctx, JSValue ns) {
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSValue proto, obj;

    /* Worker class */
    JS_NewClassID(rt, &tjs_worker_class_id);
    JS_NewClass(rt, tjs_worker_class_id, &tjs_worker_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_worker_proto_funcs, countof(tjs_worker_proto_funcs));
    JS_SetClassProto(ctx, tjs_worker_class_id, proto);

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

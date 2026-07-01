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

/*
 * In-process messaging core for MessageChannel / MessagePort / BroadcastChannel.
 *
 * txiki.js workers are OS threads sharing a single process address space, so
 * ports and broadcast channels are backed by heap-allocated, thread-safe
 * endpoints (allocated with the global tjs__malloc, never the per-runtime
 * js_malloc) rather than by sockets. Each active endpoint owns a uv_async_t on
 * its owning runtime's loop; posting from any thread appends a serialized
 * message to the destination's inbox and wakes that loop.
 *
 * A MessagePort is two halves: a `TJSMailbox` it receives from (its inbox) and a
 * ref to the peer's mailbox it sends to. The mailbox is a refcounted, lock-
 * protected object whose lifetime is decoupled from the port handle, so a sender
 * on another thread can safely append + wake without racing the receiver's
 * teardown (the handle owns thread-local resources — a uv_async_t and a JSValue
 * callback — that must die with its thread). Each mailbox is held by its owner
 * port and by the peer port; last ref frees it. There is no global lock and no
 * transfer registry: a transferred port rides inside the message as a pair of
 * mailbox refs and is reconstructed on the receiving thread.
 *
 * The Web API shape (EventTarget, MessageEvent, the MessagePort/MessageChannel/
 * BroadcastChannel classes) lives in JS under src/js/polyfills. This module only
 * provides the transport, cross-thread wakeups and structured-clone (de)serialization.
 *
 * Cross-thread memory discipline:
 *   - JS_WriteObject2 serializes in the sender ctx and returns a buffer it
 *     allocated with js_malloc; that buffer belongs to the sender's runtime and
 *     must be freed on the sender's thread, but a message can be freed on the
 *     receiver's thread, so the bytes are copied into a tjs__malloc'd buffer and
 *     the original js_free'd here. (There is no API to make JS_WriteObject2 write
 *     into a caller-provided buffer, so the copy is unavoidable.)
 *   - Deserialize with JS_ReadObject2 in the owner ctx; it only reads the buffer.
 *   - SharedArrayBuffer refcounts: tjs__sab_dup each SAB on produce. Whether the
 *     message is delivered or dropped, those produce-time dups are released when
 *     it is freed; the read path takes its own dups that ride with the
 *     reconstructed buffers.
 */

#include "mem.h"
#include "private.h"
#include "tjs.h"
#include "utils.h"

#include <stdatomic.h>
#include <string.h>

typedef struct TJSPort TJSPort;
typedef struct TJSMailbox TJSMailbox;

static uv_once_t channel_once = UV_ONCE_INIT;

/* The BroadcastChannel registry: every open BroadcastChannel across all threads,
 * linked through TJSBroadcast.link and guarded by this one lock. */
static uv_mutex_t bc_lock;
typedef struct TJSBroadcast TJSBroadcast;
static struct list_head bc_list;

static void channel_global_init(void) {
    CHECK_EQ(uv_mutex_init(&bc_lock), 0);
    init_list_head(&bc_list);
}

/* A transferred port carried inside a message: the two mailbox refs that make up
 * the port (the one it receives on and the one it sends to). Reconstructed into a
 * fresh port on delivery. */
typedef struct {
    TJSMailbox *rx; /* receive side */
    TJSMailbox *tx; /* send side (the peer's receive side) */
} TJSPortRef;

typedef struct TJSChannelMsg {
    struct list_head link; /* inbox queue membership */
    size_t len;
    void **sabs; /* tjs__malloc'd list of SAB pointers dup'd at produce time */
    int nsabs;
    TJSPortRef *ports; /* tjs__malloc'd list of transferred ports carried inline */
    int nports;
    bool is_error;  /* an error report (worker uncaught error), not a normal message */
    uint8_t data[]; /* serialized payload, allocated together with the struct */
} TJSChannelMsg;

/* Delivery kind handed to the JS deliver callback (message / messageerror / error). */
enum {
    CHANNEL_DELIVER_MESSAGE = 0,
    CHANNEL_DELIVER_MESSAGE_ERROR,
    CHANNEL_DELIVER_ERROR,
};

static void port_ref_destroy(TJSPortRef *ref);
static void port_async_cb(uv_async_t *handle);

/* Release the produce-time SAB dups and forget them, so a subsequent free can't
 * look at the now-dangling pointers. Idempotent. */
static void channel_msg_release_sabs(TJSChannelMsg *m) {
    for (int i = 0; i < m->nsabs; i++) {
        tjs__sab_free(NULL, m->sabs[i]);
    }
    tjs__free(m->sabs);
    m->sabs = NULL;
    m->nsabs = 0;
}

/* Free a message and everything it still owns. After a successful delivery the
 * caller has already released the SABs (nsabs reset to 0) and adopted the ports
 * (nports reset to 0), so this just frees the backing memory; for a message that
 * is dropped undelivered it also undoes the produce-time SAB dups and reclaims
 * the in-transit ports. */
static void channel_msg_free(TJSChannelMsg *m) {
    channel_msg_release_sabs(m);
    for (int i = 0; i < m->nports; i++) {
        port_ref_destroy(&m->ports[i]);
    }
    tjs__free(m->ports);
    tjs__free(m); /* data is a flexible array member, freed with the struct */
}

/* Serialize `value` into a message (does not enqueue it, carries no ports).
 * Returns NULL and sets a pending exception on failure (caller reports it). */
static TJSChannelMsg *channel_msg_build(JSContext *ctx, JSValueConst value) {
    size_t len;
    int flags = JS_WRITE_OBJ_SAB | JS_WRITE_OBJ_REFERENCE | JS_WRITE_OBJ_STRIP_SOURCE;
    JSSABTab sab_tab;
    uint8_t *buf = JS_WriteObject2(ctx, &len, value, flags, &sab_tab);
    if (!buf) {
        return NULL;
    }

    TJSChannelMsg *m = tjs__mallocz(sizeof(*m) + len);
    if (!m) {
        js_free(ctx, buf);
        js_free(ctx, sab_tab.tab);
        JS_ThrowOutOfMemory(ctx);
        return NULL;
    }
    memcpy(m->data, buf, len);
    m->len = len;
    js_free(ctx, buf);

    /* Copy the SAB pointer list into the (thread-shared) message and dup each,
     * so the buffers survive until the message is consumed or dropped. */
    if (sab_tab.len > 0) {
        m->sabs = tjs__malloc(sizeof(void *) * sab_tab.len);
        if (!m->sabs) {
            js_free(ctx, sab_tab.tab);
            tjs__free(m);
            JS_ThrowOutOfMemory(ctx);
            return NULL;
        }
        for (int i = 0; i < sab_tab.len; i++) {
            m->sabs[i] = sab_tab.tab[i];
            tjs__sab_dup(NULL, sab_tab.tab[i]);
        }
        m->nsabs = sab_tab.len;
    }
    js_free(ctx, sab_tab.tab);

    return m;
}

/* Duplicate a built message: copy the payload and take a fresh produce-time dup
 * on each SAB. Ports are never duplicated (only one endpoint can receive a
 * transferred port), so the copy carries none. Returns NULL on OOM. */
static TJSChannelMsg *channel_msg_dup(const TJSChannelMsg *src) {
    TJSChannelMsg *m = tjs__mallocz(sizeof(*m) + src->len);
    if (!m) {
        return NULL;
    }
    memcpy(m->data, src->data, src->len);
    m->len = src->len;
    if (src->nsabs > 0) {
        m->sabs = tjs__malloc(sizeof(void *) * src->nsabs);
        if (!m->sabs) {
            tjs__free(m);
            return NULL;
        }
        for (int i = 0; i < src->nsabs; i++) {
            m->sabs[i] = src->sabs[i];
            tjs__sab_dup(NULL, src->sabs[i]);
        }
        m->nsabs = src->nsabs;
    }
    return m;
}

struct TJSMailbox {
    atomic_int refcount; /* owner port + peer port (+ in-transit); freed at 0 */
    uv_mutex_t lock;
    struct list_head messages; /* inbox (TJSChannelMsg.link) */
    TJSPort *owner;            /* the port receiving here (NULL if none/in-transit) */
    bool closed;
};

static TJSMailbox *mailbox_new(void) {
    TJSMailbox *mb = tjs__mallocz(sizeof(*mb));
    if (!mb) {
        return NULL;
    }
    CHECK_EQ(uv_mutex_init(&mb->lock), 0);
    atomic_init(&mb->refcount, 0);
    init_list_head(&mb->messages);
    return mb;
}

static void mailbox_ref(TJSMailbox *mb) {
    atomic_fetch_add(&mb->refcount, 1);
}

/* Close the mailbox and drop any buffered messages under a single lock hold, then
 * free them outside it (freeing a message may close other mailboxes). The owner
 * is a mailbox's own receiving port or NULL, never another port; clearing it
 * stops a late cross-thread post from waking a port that is going away. Once
 * `closed` is set posts are dropped, so the owner is never read again either. */
static void mailbox_close(TJSMailbox *mb) {
    struct list_head drained, *el, *el1;
    uv_mutex_lock(&mb->lock);
    mb->closed = true;
    mb->owner = NULL;
    list_splice_init(&drained, &mb->messages);
    uv_mutex_unlock(&mb->lock);
    list_for_each_safe(el, el1, &drained) {
        channel_msg_free(list_entry(el, TJSChannelMsg, link));
    }
}

/* Tear a mailbox down once its last ref is gone. At refcount 0 no other thread
 * can reference it, so drop anything still buffered without locking, then destroy
 * the lock and free it. */
static void mailbox_destroy(TJSMailbox *mb) {
    CHECK_EQ(atomic_load(&mb->refcount), 0);
    struct list_head *el, *el1;
    list_for_each_safe(el, el1, &mb->messages) {
        channel_msg_free(list_entry(el, TJSChannelMsg, link));
    }
    uv_mutex_destroy(&mb->lock);
    tjs__free(mb);
}

static void mailbox_unref(TJSMailbox *mb) {
    if (atomic_fetch_sub(&mb->refcount, 1) != 1) {
        return;
    }
    mailbox_destroy(mb);
}

/* A transferred port that will never be adopted (its message was dropped or
 * failed to deserialize): close its receive side so the former peer's sends drop,
 * then release both mailbox refs the message carried. */
static void port_ref_destroy(TJSPortRef *ref) {
    mailbox_close(ref->rx);
    mailbox_unref(ref->rx);
    mailbox_unref(ref->tx);
}

/* Port lifecycle. OPEN/STARTED are the live states (can send/receive/transfer);
 * CLOSED and DETACHED (transferred away) are terminal. */
typedef enum {
    PORT_OPEN, /* created, not yet start()ed */
    PORT_STARTED,
    PORT_CLOSED,
    PORT_DETACHED,
} TJSPortState;

struct TJSPort {
    JSContext *ctx;
    TJSMailbox *rx; /* I receive here (holds one ref) */
    TJSMailbox *tx; /* I send here (holds one ref) */
    uv_async_t async;
    TJSPortState state;
    JSValue deliver_fn; /* JS (data, ports, kind) -> dispatch */
};

static JSClassID tjs_port_class_id;

static TJSPort *tjs_port_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_port_class_id);
}

static bool port_is_live(const TJSPort *p) {
    return p->state == PORT_OPEN || p->state == PORT_STARTED;
}

/* Wrap (rx, tx) as a port handle, taking a fresh ref on each mailbox. The async
 * handle is created up front (unref'd, so it doesn't keep the loop alive until
 * start()), which lets libuv's own handle state stand in for a separate "is it
 * initialized" flag. Failure can only happen before the refs are taken, so there
 * is nothing to unwind. */
static JSValue tjs_new_port(JSContext *ctx, TJSMailbox *rx, TJSMailbox *tx) {
    JSValue obj = JS_NewObjectClass(ctx, tjs_port_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }
    TJSPort *p = tjs__mallocz(sizeof(*p));
    if (!p) {
        JS_FreeValue(ctx, obj);
        return JS_ThrowOutOfMemory(ctx);
    }
    p->ctx = ctx;
    p->rx = rx;
    p->tx = tx;
    p->state = PORT_OPEN;
    p->deliver_fn = JS_UNDEFINED;
    mailbox_ref(rx);
    mailbox_ref(tx);
    CHECK_EQ(uv_async_init(tjs_get_loop(ctx), &p->async, port_async_cb), 0);
    p->async.data = p;
    uv_unref((uv_handle_t *) &p->async);
    JS_SetOpaque(obj, p);
    return obj;
}

/* Reconstruct a transferred port on this thread. The message carries one ref on
 * each mailbox; the new port takes its own, so we drop the carried refs after. */
static JSValue tjs_new_port_from_ref(JSContext *ctx, TJSPortRef *ref) {
    JSValue obj = tjs_new_port(ctx, ref->rx, ref->tx);
    if (JS_IsException(obj)) {
        port_ref_destroy(ref); /* couldn't wrap it; don't leak the channel */
        return obj;
    }
    mailbox_unref(ref->rx);
    mailbox_unref(ref->tx);
    return obj;
}

/* Adopt the ports carried in `m` into a fresh JS array, consuming them from the
 * message. Returns JS_UNDEFINED when the message carries no ports (the JS side
 * treats that as an empty port list), so no array is allocated in the common
 * no-transfer case. */
static JSValue port_build_ports(JSContext *ctx, TJSChannelMsg *m) {
    if (m->nports == 0) {
        return JS_UNDEFINED;
    }
    JSValue ports = JS_NewArray(ctx);
    if (JS_IsException(ports)) {
        /* OOM: leave the ports on the message so they are reclaimed when it is
         * freed, and deliver with an empty port list. */
        JS_FreeValue(ctx, JS_GetException(ctx));
        return JS_UNDEFINED;
    }
    JS_SetPropertyStr(ctx, ports, "length", JS_NewUint32(ctx, m->nports));
    for (int i = 0; i < m->nports; i++) {
        JS_SetPropertyUint32(ctx, ports, i, tjs_new_port_from_ref(ctx, &m->ports[i]));
    }
    m->nports = 0; /* adopted; don't reclaim them when the message is freed */
    return ports;
}

static void port_dispatch_one(JSContext *ctx, TJSPort *p, TJSChannelMsg *m) {
    JSSABTab sab_tab = { .tab = NULL, .len = 0 };
    JSValue data = JS_ReadObject2(ctx, m->data, m->len, JS_READ_OBJ_SAB | JS_READ_OBJ_REFERENCE, &sab_tab);
    js_free(ctx, sab_tab.tab); /* only the table array is ours; the message owns its SAB dups */

    JSValue ports;
    int kind;
    if (JS_IsException(data)) {
        /* The payload can't be reconstructed: deliver a bare 'messageerror'. A
         * MessageEvent has no field for the underlying error, so it is dropped
         * here; any ports the message carried are reclaimed when it is freed. */
        JS_FreeValue(ctx, JS_GetException(ctx));
        data = JS_UNDEFINED;
        ports = JS_UNDEFINED;
        kind = CHANNEL_DELIVER_MESSAGE_ERROR;
    } else {
        ports = port_build_ports(ctx, m);
        kind = m->is_error ? CHANNEL_DELIVER_ERROR : CHANNEL_DELIVER_MESSAGE;
    }

    /* A started port always has a deliver function, and only started ports ever
     * reach here (an unstarted port's async is never signalled). */
    CHECK(JS_IsFunction(ctx, p->deliver_fn));
    JSValue args[3] = { data, ports, JS_NewInt32(ctx, kind) };
    tjs_call_handler(ctx, p->deliver_fn, 3, args);

    JS_FreeValue(ctx, data);
    JS_FreeValue(ctx, ports);
}

static void port_async_cb(uv_async_t *handle) {
    TJSPort *p = handle->data;
    CHECK_NOT_NULL(p);
    JSContext *ctx = p->ctx;

    /* p->state and p->rx are only ever mutated on this (the owner's) thread, so
     * they need no lock here — only the mailbox's message list is touched cross-
     * thread. The port may have been closed/transferred (rx released) between the
     * wakeup and this callback firing. */
    if (!port_is_live(p)) {
        return;
    }

    struct list_head inbox, *el, *el1;
    uv_mutex_lock(&p->rx->lock);
    list_splice_init(&inbox, &p->rx->messages);
    uv_mutex_unlock(&p->rx->lock);

    list_for_each_safe(el, el1, &inbox) {
        TJSChannelMsg *m = list_entry(el, TJSChannelMsg, link);

        /* A handler may have closed this port; drop the rest undelivered. */
        if (!port_is_live(p)) {
            channel_msg_free(m);
            continue;
        }

        port_dispatch_one(ctx, p, m);
        channel_msg_free(m);
    }
}

static void port_async_close_cb(uv_handle_t *handle) {
    TJSPort *p = handle->data;
    CHECK_NOT_NULL(p);
    tjs__free(p);
}

/* Detach from both mailboxes: close the receive side (so the peer's future posts
 * drop) and release both refs. Safe to call once. */
static void port_release_mailboxes(TJSPort *p) {
    if (p->rx) {
        mailbox_close(p->rx);
        mailbox_unref(p->rx);
        p->rx = NULL;
    }
    if (p->tx) {
        mailbox_unref(p->tx);
        p->tx = NULL;
    }
}

/* close(): detach from the channel and stop keeping the loop alive. The struct
 * and its async handle are reclaimed by the finalizer (the JS wrapper still holds
 * this handle), so nothing is freed here. */
static void port_do_close(TJSPort *p) {
    if (!port_is_live(p)) {
        return;
    }
    p->state = PORT_CLOSED;
    port_release_mailboxes(p);
    uv_unref((uv_handle_t *) &p->async);
}

/* Transfer the port out: unbind from its receive side, move both mailbox refs
 * into `out`, and detach the handle. The (now useless) async handle and the
 * struct are reclaimed by the finalizer. */
static void port_do_transfer(TJSPort *p, TJSPortRef *out) {
    uv_mutex_lock(&p->rx->lock);
    /* The receive side's owner is this port (if started) or NULL, never another
     * port; clear it so the peer's sends won't wake a detached port. */
    CHECK(p->rx->owner == p || p->rx->owner == NULL);
    p->rx->owner = NULL;
    uv_mutex_unlock(&p->rx->lock);

    /* Stop the old owner's async from keeping this loop alive. */
    uv_unref((uv_handle_t *) &p->async);

    out->rx = p->rx;
    out->tx = p->tx;
    p->rx = NULL;
    p->tx = NULL;
    p->state = PORT_DETACHED;
}

static void tjs_port_finalizer(JSRuntime *rt, JSValue val) {
    TJSPort *p = JS_GetOpaque(val, tjs_port_class_id);
    if (!p) {
        return;
    }

    JS_FreeValueRT(rt, p->deliver_fn);
    p->deliver_fn = JS_UNDEFINED;

    port_do_close(p);

    /* The async is always created in the constructor, so it must always be
     * closed; the struct is freed in its close callback. */
    uv_close((uv_handle_t *) &p->async, port_async_close_cb);
}

static void tjs_port_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSPort *p = JS_GetOpaque(val, tjs_port_class_id);
    if (p) {
        JS_MarkValue(rt, p->deliver_fn, mark_func);
    }
}

static JSClassDef tjs_port_class = {
    "MessagePortHandle",
    .finalizer = tjs_port_finalizer,
    .gc_mark = tjs_port_mark,
};

/* Post a built message to the peer's inbox and wake its owner. If the peer is
 * closed the message is dropped (freed) here. A message posted before the peer
 * calls start() has no owner yet: it stays buffered and start()'s initial wake
 * flushes it, so a missing owner is not an error. */
static void port_post(TJSPort *p, TJSChannelMsg *m) {
    TJSMailbox *mb = p->tx;

    /* Guard against a self-referential enqueue: if the message transfers a port
     * whose receive mailbox is the destination itself (the sender shipped its own
     * entangled partner), the message would land in a mailbox it holds a ref to.
     * That mailbox has no owner left — the partner that would drain it is inside
     * this very message — so the message is undeliverable and would leak. Drop it;
     * this matches a browser discarding a message posted to a disentangled port. */
    for (int i = 0; i < m->nports; i++) {
        if (m->ports[i].rx == mb) {
            channel_msg_free(m);
            return;
        }
    }

    uv_mutex_lock(&mb->lock);
    if (mb->closed) {
        uv_mutex_unlock(&mb->lock);
        channel_msg_free(m);
        return;
    }
    list_add_tail(&m->link, &mb->messages);
    if (mb->owner) {
        uv_async_send(&mb->owner->async);
    }
    uv_mutex_unlock(&mb->lock);
}

/* port.postMessage(value, portHandles, buffers)
 * portHandles: array of native MessagePortHandle objects to transfer.
 * buffers: array of ArrayBuffers to detach (content already cloned).  */
static JSValue tjs_port_postmessage(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSPort *p = tjs_port_get(ctx, this_val);
    if (!p) {
        return JS_EXCEPTION;
    }
    if (!port_is_live(p)) {
        return JS_ThrowTypeError(ctx, "port is detached");
    }

    JSValue value = argv[0];
    JSValue port_handles = argv[1];
    JSValue buffers = argv[2];

    int64_t nports = 0;
    if (JS_IsArray(port_handles)) {
        JS_GetLength(ctx, port_handles, &nports);
    }

    /* Serialize first so a clone failure transfers nothing. */
    TJSChannelMsg *m = channel_msg_build(ctx, value);
    if (!m) {
        return JS_EXCEPTION; /* pending exception set by channel_msg_build */
    }

    /* Allocate the transfer list before moving any port, so an allocation
     * failure can't strand a half-transferred port. */
    if (nports > 0) {
        m->ports = tjs__malloc(sizeof(TJSPortRef) * nports);
        if (!m->ports) {
            channel_msg_free(m);
            return JS_ThrowOutOfMemory(ctx);
        }
        for (int64_t i = 0; i < nports; i++) {
            JSValue h = JS_GetPropertyUint32(ctx, port_handles, (uint32_t) i);
            TJSPort *tp = tjs_port_get(ctx, h);
            JS_FreeValue(ctx, h);
            if (tp && port_is_live(tp)) {
                port_do_transfer(tp, &m->ports[m->nports++]);
            }
        }
    }

    if (JS_IsArray(buffers)) {
        int64_t nbufs = 0;
        JS_GetLength(ctx, buffers, &nbufs);
        for (int64_t i = 0; i < nbufs; i++) {
            JSValue b = JS_GetPropertyUint32(ctx, buffers, (uint32_t) i);
            if (JS_IsArrayBuffer(b)) {
                JS_DetachArrayBuffer(ctx, b);
            }
            JS_FreeValue(ctx, b);
        }
    }

    port_post(p, m);

    return JS_UNDEFINED;
}

/* port.start(deliverFn) */
static JSValue tjs_port_start(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSPort *p = tjs_port_get(ctx, this_val);
    if (!p) {
        return JS_EXCEPTION;
    }
    /* Idempotent, and a no-op on a closed or transferred port. */
    if (p->state != PORT_OPEN) {
        return JS_UNDEFINED;
    }

    JS_FreeValue(ctx, p->deliver_fn);
    p->deliver_fn = JS_DupValue(ctx, argv[0]);

    /* Keep the loop alive now that we are receiving (the async is created,
     * unref'd, in the constructor). */
    uv_ref((uv_handle_t *) &p->async);

    /* Become the owner of our receive side; a freshly opened port has none yet. */
    uv_mutex_lock(&p->rx->lock);
    CHECK_NULL(p->rx->owner);
    p->rx->owner = p;
    p->state = PORT_STARTED;
    uv_mutex_unlock(&p->rx->lock);

    /* Wake once to flush anything buffered before start(); a spurious wake with
     * an empty inbox is harmless. */
    uv_async_send(&p->async);

    return JS_UNDEFINED;
}

/* port.close() */
static JSValue tjs_port_close(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSPort *p = tjs_port_get(ctx, this_val);
    if (!p) {
        return JS_EXCEPTION;
    }
    port_do_close(p);
    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_port_proto_funcs[] = {
    TJS_CFUNC_DEF("postMessage", 3, tjs_port_postmessage),
    TJS_CFUNC_DEF("start", 1, tjs_port_start),
    TJS_CFUNC_DEF("close", 0, tjs_port_close),
};

/* core.channelNew() -> [handleA, handleB] */
static JSValue tjs_channel_new(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSMailbox *m0 = mailbox_new();
    TJSMailbox *m1 = mailbox_new();
    if (!m0 || !m1) {
        if (m0) {
            mailbox_destroy(m0);
        }
        if (m1) {
            mailbox_destroy(m1);
        }
        /* mailbox_new() is a bare allocator that sets no JS exception, so throw
         * one here rather than returning JS_EXCEPTION with nothing pending. */
        return JS_ThrowOutOfMemory(ctx);
    }

    JSValue a = tjs_new_port(ctx, m0, m1); /* port A: receives on m0, sends to m1 */
    if (JS_IsException(a)) {
        mailbox_destroy(m0);
        mailbox_destroy(m1);
        return a;
    }

    JSValue b = tjs_new_port(ctx, m1, m0); /* port B: receives on m1, sends to m0 */
    if (JS_IsException(b)) {
        JS_FreeValue(ctx, a); /* finalizer drops A's refs on m0/m1 */
        return b;
    }

    JSValue arr = JS_NewArray(ctx);
    JS_SetPropertyUint32(ctx, arr, 0, a);
    JS_SetPropertyUint32(ctx, arr, 1, b);
    return arr;
}

/* The parent↔worker channel is an ordinary MessageChannel whose two sides are
 * owned by different threads' loops. The parent creates both mailboxes (holding a
 * reserved ref on each), wraps side 0 on its loop, hands the two mailboxes to the
 * worker thread which wraps side 1 on its own loop, then drops both reserved refs.
 * The mailboxes live on through the ports' own refs; if a side fails to wrap,
 * dropping its reserved ref frees that mailbox. */

bool tjs__channel_mailbox_pair(TJSMailbox **a, TJSMailbox **b) {
    TJSMailbox *m0 = mailbox_new();
    TJSMailbox *m1 = mailbox_new();
    if (!m0 || !m1) {
        if (m0) {
            mailbox_destroy(m0);
        }
        if (m1) {
            mailbox_destroy(m1);
        }
        return false;
    }
    mailbox_ref(m0); /* reserved refs, held by the caller until both ports exist */
    mailbox_ref(m1);
    *a = m0;
    *b = m1;
    return true;
}

JSValue tjs__channel_port_new(JSContext *ctx, TJSMailbox *rx, TJSMailbox *tx) {
    return tjs_new_port(ctx, rx, tx);
}

void tjs__channel_mailbox_unref(TJSMailbox *mb) {
    mailbox_unref(mb);
}

/* Disentangle a worker-channel port and let its loop exit (used on terminate).
 * The handle stays valid; the finalizer reclaims it. */
void tjs__channel_port_close(JSValue port_handle) {
    TJSPort *p = JS_GetOpaque(port_handle, tjs_port_class_id);
    if (p) {
        port_do_close(p);
    }
}

/* Report an error (a worker's uncaught exception) to the peer of `port_handle`.
 * `error_obj` is a structured-clonable {name, message, stack}. Best-effort: a
 * failure here must never mask the original error. */
void tjs__channel_port_post_error(JSContext *ctx, JSValue port_handle, JSValueConst error_obj) {
    TJSPort *p = JS_GetOpaque(port_handle, tjs_port_class_id);
    if (!p || !port_is_live(p)) {
        return;
    }
    TJSChannelMsg *m = channel_msg_build(ctx, error_obj);
    if (!m) {
        JS_FreeValue(ctx, JS_GetException(ctx));
        return;
    }
    m->is_error = true;
    port_post(p, m);
}

struct TJSBroadcast {
    JSContext *ctx;
    uv_async_t async;
    bool closed;
    JSValue deliver_fn;
    uv_mutex_t inbox_lock;     /* guards `messages` (posted from other threads) */
    struct list_head messages; /* inbox (TJSChannelMsg.link) */
    struct list_head link;     /* bc_list membership; guarded by bc_lock */
    char name[];
};

static JSClassID tjs_broadcast_class_id;

static TJSBroadcast *tjs_broadcast_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_broadcast_class_id);
}

static void broadcast_dispatch_one(JSContext *ctx, TJSBroadcast *bc, TJSChannelMsg *m) {
    JSSABTab sab_tab = { .tab = NULL, .len = 0 };
    JSValue data = JS_ReadObject2(ctx, m->data, m->len, JS_READ_OBJ_SAB | JS_READ_OBJ_REFERENCE, &sab_tab);
    js_free(ctx, sab_tab.tab);
    bool deser_failed = JS_IsException(data);
    if (deser_failed) {
        JS_FreeValue(ctx, JS_GetException(ctx));
        data = JS_UNDEFINED;
    }

    CHECK(JS_IsFunction(ctx, bc->deliver_fn));
    JSValue args[2] = { data, JS_NewBool(ctx, deser_failed) };
    tjs_call_handler(ctx, bc->deliver_fn, 2, args);

    JS_FreeValue(ctx, data);
}

static void broadcast_async_cb(uv_async_t *handle) {
    TJSBroadcast *bc = handle->data;
    CHECK_NOT_NULL(bc);

    struct list_head inbox, *el, *el1;
    uv_mutex_lock(&bc->inbox_lock);
    list_splice_init(&inbox, &bc->messages);
    uv_mutex_unlock(&bc->inbox_lock);

    list_for_each_safe(el, el1, &inbox) {
        TJSChannelMsg *m = list_entry(el, TJSChannelMsg, link);
        if (bc->closed) {
            channel_msg_free(m);
            continue;
        }
        broadcast_dispatch_one(bc->ctx, bc, m);
        channel_msg_free(m);
    }
}

static void broadcast_async_close_cb(uv_handle_t *handle) {
    TJSBroadcast *bc = handle->data;
    CHECK_NOT_NULL(bc);
    uv_mutex_destroy(&bc->inbox_lock);
    tjs__free(bc);
}

/* Remove from the registry (must not hold bc_lock) and drop buffered messages. */
static void broadcast_do_close(TJSBroadcast *bc) {
    if (bc->closed) {
        return;
    }
    bc->closed = true;

    uv_mutex_lock(&bc_lock);
    list_del(&bc->link);
    uv_mutex_unlock(&bc_lock);

    struct list_head inbox, *el, *el1;
    uv_mutex_lock(&bc->inbox_lock);
    list_splice_init(&inbox, &bc->messages);
    uv_mutex_unlock(&bc->inbox_lock);
    list_for_each_safe(el, el1, &inbox) {
        channel_msg_free(list_entry(el, TJSChannelMsg, link));
    }

    /* The async is already unref'd (see tjs_broadcast_new); the handle is closed
     * by the finalizer. */
}

static void tjs_broadcast_finalizer(JSRuntime *rt, JSValue val) {
    TJSBroadcast *bc = JS_GetOpaque(val, tjs_broadcast_class_id);
    if (!bc) {
        return;
    }
    JS_FreeValueRT(rt, bc->deliver_fn);
    bc->deliver_fn = JS_UNDEFINED;
    broadcast_do_close(bc);
    /* The async is always created in the constructor (before the handle is handed
     * to JS), so it must always be closed; the struct is freed in its callback. */
    uv_close((uv_handle_t *) &bc->async, broadcast_async_close_cb);
}

static void tjs_broadcast_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSBroadcast *bc = JS_GetOpaque(val, tjs_broadcast_class_id);
    if (bc) {
        JS_MarkValue(rt, bc->deliver_fn, mark_func);
    }
}

static JSClassDef tjs_broadcast_class = {
    "BroadcastChannelHandle",
    .finalizer = tjs_broadcast_finalizer,
    .gc_mark = tjs_broadcast_mark,
};

/* core.broadcastNew(name, deliverFn) -> handle */
static JSValue tjs_broadcast_new(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    uv_once(&channel_once, channel_global_init);

    const char *name = JS_ToCString(ctx, argv[0]);
    if (!name) {
        return JS_EXCEPTION;
    }

    JSValue obj = JS_NewObjectClass(ctx, tjs_broadcast_class_id);
    if (JS_IsException(obj)) {
        JS_FreeCString(ctx, name);
        return obj;
    }

    size_t namelen = strlen(name);
    TJSBroadcast *bc = tjs__mallocz(sizeof(*bc) + namelen + 1);
    if (!bc) {
        JS_FreeCString(ctx, name);
        JS_FreeValue(ctx, obj);
        return JS_ThrowOutOfMemory(ctx);
    }
    bc->ctx = ctx;
    memcpy(bc->name, name, namelen + 1);
    JS_FreeCString(ctx, name);
    bc->deliver_fn = JS_DupValue(ctx, argv[1]);
    init_list_head(&bc->messages);

    CHECK_EQ(uv_mutex_init(&bc->inbox_lock), 0);

    CHECK_EQ(uv_async_init(tjs_get_loop(ctx), &bc->async, broadcast_async_cb), 0);
    bc->async.data = bc;
    /* A BroadcastChannel must not keep its runtime's loop alive (an unclosed one
     * would otherwise hang process exit); this matches Node, which unrefs it.
     * Buffered messages are still delivered while the loop runs for other reasons. */
    uv_unref((uv_handle_t *) &bc->async);

    uv_mutex_lock(&bc_lock);
    list_add(&bc->link, &bc_list);
    uv_mutex_unlock(&bc_lock);

    JS_SetOpaque(obj, bc);
    return obj;
}

/* handle.postMessage(value) */
static JSValue tjs_broadcast_postmessage(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSBroadcast *sender = tjs_broadcast_get(ctx, this_val);
    if (!sender) {
        return JS_EXCEPTION;
    }
    if (sender->closed) {
        return JS_ThrowTypeError(ctx, "BroadcastChannel is closed");
    }

    /* Serialize once; deliver an independent copy to every other subscriber. */
    TJSChannelMsg *src_msg = channel_msg_build(ctx, argv[0]);
    if (!src_msg) {
        return JS_EXCEPTION;
    }

    uv_mutex_lock(&bc_lock);
    struct list_head *el;
    list_for_each(el, &bc_list) {
        TJSBroadcast *bc = list_entry(el, TJSBroadcast, link);
        if (bc == sender || bc->closed || strcmp(bc->name, sender->name) != 0) {
            continue;
        }

        /* An independent copy per target; skip a target we can't allocate for
         * rather than deliver a message whose SAB refs lack a matching dup. */
        TJSChannelMsg *m = channel_msg_dup(src_msg);
        if (!m) {
            continue;
        }

        uv_mutex_lock(&bc->inbox_lock);
        list_add_tail(&m->link, &bc->messages);
        uv_mutex_unlock(&bc->inbox_lock);

        uv_async_send(&bc->async);
    }
    uv_mutex_unlock(&bc_lock);

    /* The source message was never enqueued anywhere; free it (undoing the SAB
     * dups it took at build time). */
    channel_msg_free(src_msg);

    return JS_UNDEFINED;
}

/* handle.close() */
static JSValue tjs_broadcast_close(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSBroadcast *bc = tjs_broadcast_get(ctx, this_val);
    if (!bc) {
        return JS_EXCEPTION;
    }
    broadcast_do_close(bc);
    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_broadcast_proto_funcs[] = {
    TJS_CFUNC_DEF("postMessage", 1, tjs_broadcast_postmessage),
    TJS_CFUNC_DEF("close", 0, tjs_broadcast_close),
};

void tjs__mod_channel_init(JSContext *ctx, JSValue ns) {
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSValue proto;

    /* MessagePort handle class */
    JS_NewClassID(rt, &tjs_port_class_id);
    JS_NewClass(rt, tjs_port_class_id, &tjs_port_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_port_proto_funcs, countof(tjs_port_proto_funcs));
    JS_SetClassProto(ctx, tjs_port_class_id, proto);

    /* BroadcastChannel handle class */
    JS_NewClassID(rt, &tjs_broadcast_class_id);
    JS_NewClass(rt, tjs_broadcast_class_id, &tjs_broadcast_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_broadcast_proto_funcs, countof(tjs_broadcast_proto_funcs));
    JS_SetClassProto(ctx, tjs_broadcast_class_id, proto);

    JS_DefinePropertyValueStr(ctx,
                              ns,
                              "channelNew",
                              JS_NewCFunction(ctx, tjs_channel_new, "channelNew", 0),
                              JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx,
                              ns,
                              "broadcastNew",
                              JS_NewCFunction(ctx, tjs_broadcast_new, "broadcastNew", 2),
                              JS_PROP_C_W_E);
}

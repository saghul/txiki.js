/*
 * txiki.js
 *
 * Copyright (c) 2026-present Saúl Ibarra Corretgé <s@saghul.net>
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
 * Custom lws event lib that drives lws off our libuv loop, registered via
 * lws_context_creation_info.event_lib_custom.  It replaces the in-tree lws
 * libuv event lib (LWS_SERVER_OPTION_LIBUV), which needed local patches to
 * behave on a foreign loop.  Only public lws APIs are used.
 *
 * Liveness model: every handle lws needs is unref'd so lws never keeps the
 * loop alive on its own, with one exception: listen socket watchers stay
 * ref'd so servers keep running.  In-flight client connections are covered
 * by the keepalive async in lws-utils.c (tjs__lws_conn_ref/unref).  Their
 * own watchers cannot provide that liveness: a connecting wsi has no fd at
 * all while async DNS resolves (and briefly between connect retries), and
 * the lws-internal wsis that do have fds the whole time (the per-pt event
 * pipe, the resolver UDP sockets) arrive through the same accept path on
 * the same vhost with no public way to tell them apart, and must stay
 * unref'd or idle processes never exit.  So connection liveness is owned
 * by the layer that knows when a logical connection starts and ends.
 *
 * Close model: wsi_logical_close stops the uv_poll watcher synchronously and
 * returns 0, so lws finalizes every wsi (and the whole context) in a single
 * synchronous lws_context_destroy() call.  The uv_poll_t itself is closed
 * asynchronously and freed in its close callback; it must therefore be heap
 * allocated, never part of the lws-owned pt private area, which is freed
 * inside lws_context_destroy() while uv_close() completions are pending.
 *
 * Scheduled events (suls): lws_service_adjust_timeout() dispatches all ripe
 * events itself when the context uses an event lib and returns how long lws
 * can sleep.  An unref'd uv_prepare re-evaluates it every loop iteration
 * (catching events scheduled from JS-initiated lws calls) and arms an unref'd
 * one-shot uv_timer so deadlines fire while the loop is blocked.  A return of
 * 0 means buffered data (TLS, rxflow) needs a forced service pass right away.
 *
 * lws can replace the fd of a live wsi behind the event lib's back: the
 * client connect DNS-retry path closes the socket directly and calls
 * sock_accept again on the same wsi.  sock_accept therefore drops any stale
 * watcher before creating the new one.
 *
 * There is no public accessor for per-wsi event lib storage, so watchers
 * live in a wsi-keyed hash map in the per-pt private area.
 *
 * Invariant: lws_context_destroy() must never be called from inside an lws
 * callback (it would close the tick handles this event lib is running on).
 * txiki only calls it from TJS_FreeRuntime, after the loop has exited.
 */

#include "hash.h"
#include "mem.h"
#include "private.h"
#include "utils.h"

#include <string.h>

#if LWS_MAX_SMP > 1
#error "The txiki.js lws event lib requires LWS_MAX_SMP == 1 (it calls lws service APIs without holding lws locks)"
#endif

/* Max-wait budget for lws_service_adjust_timeout(), which returns the
 * smaller of this and the time to the next scheduled event.  We have no
 * deadline of our own (the tick is re-evaluated every loop iteration), so
 * this only caps how long the uv_timer can sleep. */
#define TJS__EVLIB_MAX_WAIT_MS (3600 * 1000)

typedef struct {
    uv_poll_t poll;
    struct lws *wsi;
    lws_sockfd_type fd;
    int events;        /* UV_READABLE | UV_WRITABLE currently subscribed */
    UT_hash_handle hh; /* in TJSEvlibPt watchers, keyed by wsi */
} TJSEvlibWatcher;

/* Drives lws scheduled events off the loop.  There is one per pt, but it
 * cannot live inside TJSEvlibPt: the lws-owned pt area is freed inside
 * lws_context_destroy() while these handles' uv_close completions are
 * still pending, so it is heap allocated and freed by the last close cb. */
typedef struct {
    uv_timer_t timer;
    uv_prepare_t prepare;
    struct lws_context *cx;
    int pending_closes;
} TJSEvlibTick;

/* Lives in the lws-owned per-pt private area (evlib_size_pt). */
typedef struct {
    uv_loop_t *loop;
    TJSEvlibTick *tick;
    TJSEvlibWatcher *watchers; /* uthash, keyed by wsi */
} TJSEvlibPt;

static TJSEvlibWatcher *tjs__evlib_watcher_find(const TJSEvlibPt *evpt, const struct lws *wsi) {
    TJSEvlibWatcher *watcher;

    HASH_FIND_PTR(evpt->watchers, &wsi, watcher);

    return watcher;
}

static void tjs__evlib_watcher_close_cb(uv_handle_t *handle) {
    CHECK_NOT_NULL(handle->data);
    tjs__free(handle->data);
}

static void tjs__evlib_poll_cb(uv_poll_t *handle, int status, int events) {
    TJSEvlibWatcher *watcher = handle->data;
    CHECK_NOT_NULL(watcher);
    struct lws_context *cx = lws_get_context(watcher->wsi);

    /* lws_service_fd() wants the fired events mirrored in both fields;
     * this matches what the in-tree lws event libs do. */
    struct lws_pollfd pfd = { .fd = watcher->fd, .events = 0, .revents = 0 };

    if (status < 0) {
        if (status == UV_EAGAIN) {
            return;
        }
        pfd.events = LWS_POLLHUP;
        pfd.revents = LWS_POLLHUP;
    } else {
        if (events & UV_READABLE) {
            pfd.events |= LWS_POLLIN;
            pfd.revents |= LWS_POLLIN;
        }
        if (events & UV_WRITABLE) {
            pfd.events |= LWS_POLLOUT;
            pfd.revents |= LWS_POLLOUT;
        }
    }

    lws_service_fd(cx, &pfd);
}

/* Stop and close the wsi's watcher, if any.  Idempotent on purpose:
 * destroy_wsi runs for every wsi after wsi_logical_close already detached
 * it, sock_accept detaches preemptively, and some wsis (e.g. failed
 * connects) never had a watcher to begin with. */
static void tjs__evlib_watcher_detach(TJSEvlibPt *evpt, const struct lws *wsi) {
    TJSEvlibWatcher *watcher = tjs__evlib_watcher_find(evpt, wsi);

    if (!watcher) {
        return;
    }

    HASH_DEL(evpt->watchers, watcher);
    uv_poll_stop(&watcher->poll);
    uv_close((uv_handle_t *) &watcher->poll, tjs__evlib_watcher_close_cb);
}

/* Detach whatever watcher is currently bound to fd, regardless of which wsi
 * owns it.  Used by the QUIC/H3 ALPN migration path: lws hands the connected
 * UDP fd to a fresh network wsi and leaves the old (now fd-less) handshake wsi
 * still holding a stale watcher on that fd.  We drop it so only one uv_poll
 * ever references the fd before re-adopting it under the migrated wsi. */
static void tjs__evlib_watcher_detach_by_fd(TJSEvlibPt *evpt, lws_sockfd_type fd) {
    TJSEvlibWatcher *watcher, *tmp;

    HASH_ITER(hh, evpt->watchers, watcher, tmp) {
        if (watcher->fd == fd) {
            HASH_DEL(evpt->watchers, watcher);
            uv_poll_stop(&watcher->poll);
            uv_close((uv_handle_t *) &watcher->poll, tjs__evlib_watcher_close_cb);
        }
    }
}

static int tjs__evlib_watcher_create(TJSEvlibPt *evpt, struct lws *wsi, bool unref) {
    TJSEvlibWatcher *watcher = tjs__malloc(sizeof(*watcher));

    if (!watcher) {
        return -1;
    }

    watcher->wsi = wsi;
    watcher->fd = lws_get_socket_fd(wsi);
    watcher->events = 0;

    int r;
#ifdef _WIN32
    r = uv_poll_init_socket(evpt->loop, &watcher->poll, (uv_os_sock_t) watcher->fd);
#else
    /* Not uv_poll_init_socket: the fd can also be a pipe (the lws event pipe). */
    r = uv_poll_init(evpt->loop, &watcher->poll, watcher->fd);
#endif
    if (r != 0) {
        tjs__free(watcher);
        return -1;
    }

    watcher->poll.data = watcher;

    if (unref) {
        uv_unref((uv_handle_t *) &watcher->poll);
    }

    HASH_ADD_PTR(evpt->watchers, wsi, watcher);

    return 0;
}

static void tjs__evlib_timer_cb(uv_timer_t *handle);

/*
 * Dispatch ripe scheduled events, run a forced service pass if buffered data
 * is pending, and arm the timer for the next deadline.
 */
static void tjs__evlib_tick(TJSEvlibTick *tick) {
    int ms = lws_service_adjust_timeout(tick->cx, TJS__EVLIB_MAX_WAIT_MS, 0);

    if (ms == 0) {
        _lws_plat_service_forced_tsi(tick->cx, 0);
        ms = 1;
    }

    CHECK_EQ(uv_timer_start(&tick->timer, tjs__evlib_timer_cb, (uint64_t) ms, 0), 0);
}

static void tjs__evlib_timer_cb(uv_timer_t *handle) {
    tjs__evlib_tick(handle->data);
}

static void tjs__evlib_prepare_cb(uv_prepare_t *handle) {
    tjs__evlib_tick(handle->data);
}

static void tjs__evlib_tick_close_cb(uv_handle_t *handle) {
    TJSEvlibTick *tick = handle->data;

    if (--tick->pending_closes == 0) {
        tjs__free(tick);
    }
}

static int tjs__evlib_init_pt(struct lws_context *cx, void *loop, int tsi) {
    TJSEvlibPt *evpt = lws_evlib_tsi_to_evlib_pt(cx, tsi);

    /* Only foreign loops are supported. */
    if (!loop) {
        return 1;
    }

    memset(evpt, 0, sizeof(*evpt));
    evpt->loop = loop;

    TJSEvlibTick *tick = tjs__malloc(sizeof(*tick));
    if (!tick) {
        return 1;
    }

    tick->cx = cx;
    tick->pending_closes = 2;
    CHECK_EQ(uv_timer_init(evpt->loop, &tick->timer), 0);
    CHECK_EQ(uv_prepare_init(evpt->loop, &tick->prepare), 0);
    tick->timer.data = tick;
    tick->prepare.data = tick;
    uv_unref((uv_handle_t *) &tick->timer);
    uv_unref((uv_handle_t *) &tick->prepare);
    CHECK_EQ(uv_prepare_start(&tick->prepare, tjs__evlib_prepare_cb), 0);

    evpt->tick = tick;

    return 0;
}

static void tjs__evlib_io(struct lws *wsi, unsigned int flags) {
    TJSEvlibPt *evpt = lws_evlib_wsi_to_evlib_pt(wsi);
    TJSEvlibWatcher *watcher = tjs__evlib_watcher_find(evpt, wsi);

    if (!watcher) {
        /* A watcher normally exists before lws toggles io: sock_accept runs
         * before the fd enters the fds table.  The exception is the QUIC/H3
         * client ALPN migration, which hands the connected UDP fd to a fresh
         * network wsi via __insert_wsi_socket_into_fds() WITHOUT going through
         * sock_accept (roles/quic/ops-quic.c).  lws's in-tree libuv evlib
         * survives that by carrying its per-wsi watcher storage across and
         * repointing it (gated on event_loop_ops->name == "libuv"); we key
         * watchers by wsi, so the migrated wsi reaches here with a live fd and
         * no watcher.  Adopt it lazily on the first START, taking the fd over
         * from the old handshake wsi's now-stale watcher.  A STOP with no
         * watcher (e.g. lws still adjusting a detached wsi) is a no-op. */
        lws_sockfd_type fd;

        if (!(flags & LWS_EV_START)) {
            return;
        }

        fd = lws_get_socket_fd(wsi);
        if (fd == LWS_SOCK_INVALID) {
            return;
        }

        tjs__evlib_watcher_detach_by_fd(evpt, fd);

        if (tjs__evlib_watcher_create(evpt, wsi, true)) {
            return;
        }

        watcher = tjs__evlib_watcher_find(evpt, wsi);
        CHECK_NOT_NULL(watcher);

        /* __insert_wsi_socket_into_fds() seeds the fds table with POLLIN but
         * never calls io(), so mirror that baseline or RX would go unpolled. */
        watcher->events = UV_READABLE;
    }

    if (flags & LWS_EV_START) {
        if (flags & LWS_EV_READ) {
            watcher->events |= UV_READABLE;
        }
        if (flags & LWS_EV_WRITE) {
            watcher->events |= UV_WRITABLE;
        }
    } else {
        if (flags & LWS_EV_READ) {
            watcher->events &= ~UV_READABLE;
        }
        if (flags & LWS_EV_WRITE) {
            watcher->events &= ~UV_WRITABLE;
        }
    }

    if (watcher->events) {
        uv_poll_start(&watcher->poll, watcher->events, tjs__evlib_poll_cb);
    } else {
        uv_poll_stop(&watcher->poll);
    }
}

static int tjs__evlib_sock_accept(struct lws *wsi) {
    TJSEvlibPt *evpt = lws_evlib_wsi_to_evlib_pt(wsi);

    /* lws may have replaced the wsi's fd (client connect DNS-retry path
     * closes the socket behind our back); drop any stale watcher. */
    tjs__evlib_watcher_detach(evpt, wsi);

    return tjs__evlib_watcher_create(evpt, wsi, true);
}

static int tjs__evlib_init_vhost_listen_wsi(struct lws *wsi) {
    if (!wsi) {
        return 0;
    }

    TJSEvlibPt *evpt = lws_evlib_wsi_to_evlib_pt(wsi);

    if (tjs__evlib_watcher_find(evpt, wsi)) {
        return 0;
    }

    /* Listen watchers stay ref'd: a listening server keeps the loop alive. */
    if (tjs__evlib_watcher_create(evpt, wsi, false)) {
        return -1;
    }

    tjs__evlib_io(wsi, LWS_EV_START | LWS_EV_READ);

    return 0;
}

static int tjs__evlib_wsi_logical_close(struct lws *wsi) {
    tjs__evlib_watcher_detach(lws_evlib_wsi_to_evlib_pt(wsi), wsi);

    /* 0: lws finalizes the wsi synchronously.  The watcher is already
     * stopped, so lws closing the fd right after this is safe. */
    return 0;
}

static void tjs__evlib_destroy_wsi(struct lws *wsi) {
    tjs__evlib_watcher_detach(lws_evlib_wsi_to_evlib_pt(wsi), wsi);
}

static void tjs__evlib_destroy_pt(struct lws_context *cx, int tsi) {
    TJSEvlibPt *evpt = lws_evlib_tsi_to_evlib_pt(cx, tsi);

    if (evpt->tick) {
        uv_prepare_stop(&evpt->tick->prepare);
        uv_timer_stop(&evpt->tick->timer);
        uv_close((uv_handle_t *) &evpt->tick->prepare, tjs__evlib_tick_close_cb);
        uv_close((uv_handle_t *) &evpt->tick->timer, tjs__evlib_tick_close_cb);
        evpt->tick = NULL;
    }

    /* All wsis are closed by now; drop any stragglers defensively. */
    TJSEvlibWatcher *watcher, *tmp;
    HASH_ITER(hh, evpt->watchers, watcher, tmp) {
        HASH_DEL(evpt->watchers, watcher);
        uv_poll_stop(&watcher->poll);
        uv_close((uv_handle_t *) &watcher->poll, tjs__evlib_watcher_close_cb);
    }
}

static const struct lws_event_loop_ops tjs_event_loop_ops = {
    .name = "txiki-uv",
    .init_pt = tjs__evlib_init_pt,
    .init_vhost_listen_wsi = tjs__evlib_init_vhost_listen_wsi,
    .sock_accept = tjs__evlib_sock_accept,
    .io = tjs__evlib_io,
    .wsi_logical_close = tjs__evlib_wsi_logical_close,
    .destroy_wsi = tjs__evlib_destroy_wsi,
    .destroy_pt = tjs__evlib_destroy_pt,
    .evlib_size_pt = sizeof(TJSEvlibPt),
};

const lws_plugin_evlib_t tjs_lws_evlib = {
    /* Identification header for lws' pluggable event lib machinery: the
     * plugin class plus build/ABI tags lws would match a dynamically
     * loaded event lib against.  The static event_lib_custom path does
     * not validate it, but keep it well-formed like the bundled ones. */
    .hdr = {
        .name = "txiki.js libuv event loop",
        ._class = "lws_evlib_plugin",
        .lws_build_hash = LWS_BUILD_HASH,
        .api_magic = LWS_PLUGIN_API_MAGIC,
    },
    .ops = &tjs_event_loop_ops,
};

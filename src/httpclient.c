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

#include "private.h"
#include "version.h"

#include <string.h>

#define TJS__UA_STRING                                                                                                 \
    "txiki.js/" STRINGIFY(TJS_VERSION_MAJOR) "." STRINGIFY(TJS_VERSION_MINOR) "." STRINGIFY(TJS_VERSION_PATCH)         \
        TJS_VERSION_SUFFIX

#define TJS_LWS_HTTP_PROTOCOL_NAME "tjs-http"

#ifndef MIN
#define MIN(a, b) ((a) < (b) ? (a) : (b))
#endif

/* Max payload handed to a single lws_write() for the request body. Over HTTP/2
 * the body must be written in chunks the connection can flush per writable
 * callback; handing lws one giant buffer with LWS_WRITE_HTTP_FINAL truncates
 * h2 request bodies larger than this.
 *
 * Each chunk becomes one h2 DATA frame: lws prepends a 9-byte frame header, so
 * the bytes lws hands to the transport are chunk + 9. That must fit within the
 * per-thread service buffer (pt_serv_buf_size, 16384 here). If a chunk fills
 * the whole 16384 the resulting frame overflows the buffer and is sent only
 * partially; for the *final* (END_STREAM) frame lws never flushes the buffered
 * tail once the stream is marked done, so the server's body accounting never
 * reaches content-length and the request stalls. Stay well under the buffer so
 * every frame -- including the last -- is emitted whole. */
#define TJS_HTTPCLIENT_WRITE_CHUNK_SIZE 8192

enum {
    HC_CALLBACK_STATUS = 0,
    HC_CALLBACK_URL,
    HC_CALLBACK_HEADER,
    HC_CALLBACK_HEADERSCOMPLETE,
    HC_CALLBACK_DATA,
    HC_CALLBACK_COMPLETE,
    HC_CALLBACK_DRAIN,
    HC_CALLBACK_MAX,
};

typedef struct {
    TJSHandlePin pin;
    JSContext *ctx;
    JSValue callbacks[HC_CALLBACK_MAX];
    struct lws *wsi;
    char *method;
    char *url_str;
    TBuf req_headers;
    TBuf send_buf;
    size_t send_offset; /* bytes of send_buf written (non-streaming and h2/h3 streaming bodies) */
    bool sent;
    bool streaming;
    bool body_done;
    bool completed;
    bool torn_down;
    bool keepalive;      /* connection may be pooled for reuse (decided at headers) */
    bool conn_close;     /* the user asked for "Connection: close" */
    bool req_sent;       /* the whole request (headers and body) was handed to lws */
    bool got_response;   /* the (non-interim) response headers arrived */
    bool connecting;     /* this request opened a socket of its own */
    bool headers_sent;   /* lws asked us for the request headers: it was sent */
    bool sent_on_mux;    /* headers went out on an h2/h3 stream */
    bool mux_body;       /* streaming body sent as raw DATA (h2/h3), not chunked */
    struct lws *mux_wsi; /* the h2/h3 stream wsi a mux_body is written on */
    bool retried;        /* the one retry of the request was used */
    bool retry_pending;  /* retry_sul is scheduled */
    lws_usec_t start_us; /* request start */
    lws_sorted_usec_list_t retry_sul;
    unsigned long timeout;
    int ssl_flags;
    JSValue url;
    /* Response decompression. */
    TJSDecompressor *decompressor;
} TJSHttpClient;

static void tjs_httpclient_finalizer(JSRuntime *rt, JSValue val) {
    TJSHttpClient *h = JS_GetOpaque(val, tjs__class_id_rt(rt, TJS_CLASS_HTTPCLIENT));
    if (h) {
        /* A pinned client holds a ref to itself, so it can't be finalized until
         * the pin is released (in the lws close callback). */
        CHECK(JS_IsUndefined(h->pin.obj));
        for (int i = 0; i < HC_CALLBACK_MAX; i++) {
            JS_FreeValueRT(rt, h->callbacks[i]);
        }
        JS_FreeValueRT(rt, h->url);
        if (h->method) {
            js_free_rt(rt, h->method);
        }
        if (h->url_str) {
            js_free_rt(rt, h->url_str);
        }
        if (h->decompressor) {
            tjs__decompressor_destroy(h->decompressor, rt);
        }
        tbuf_free(&h->req_headers);
        tbuf_free(&h->send_buf);
        js_free_rt(rt, h);
    }
}

static void tjs_httpclient_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSHttpClient *h = JS_GetOpaque(val, tjs__class_id_rt(rt, TJS_CLASS_HTTPCLIENT));
    if (h) {
        for (int i = 0; i < HC_CALLBACK_MAX; i++) {
            JS_MarkValue(rt, h->callbacks[i], mark_func);
        }
        JS_MarkValue(rt, h->url, mark_func);
    }
}

static JSClassDef tjs_httpclient_class = {
    "HttpClient",
    .finalizer = tjs_httpclient_finalizer,
    .gc_mark = tjs_httpclient_mark,
};

static TJSHttpClient *tjs_httpclient_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs__class_id(ctx, TJS_CLASS_HTTPCLIENT));
}

/* Clear the JS callbacks at teardown (see TJSHandlePin.detach) so the lws close
 * callback dispatches nothing once the context is destroyed. */
static void tjs_httpclient_detach(TJSHandlePin *pin) {
    TJSHttpClient *h = list_entry(pin, TJSHttpClient, pin);
    for (int i = 0; i < HC_CALLBACK_MAX; i++) {
        JS_FreeValue(h->ctx, h->callbacks[i]);
        h->callbacks[i] = JS_UNDEFINED;
    }
    /* The lws context is destroyed next, with the sul lists: nothing may be
     * left on them, nor scheduled while lws closes the connections. */
    if (h->retry_pending) {
        h->retry_pending = false;
        lws_sul_cancel(&h->retry_sul);
    }
    h->retried = true;
}

static void maybe_invoke_callback(TJSHttpClient *h, int callback, int argc, JSValue *argv) {
    JSContext *ctx = h->ctx;

    JSValue func = h->callbacks[callback];
    if (!JS_IsFunction(ctx, func)) {
        for (int i = 0; i < argc; i++) {
            JS_FreeValue(ctx, argv[i]);
        }
        return;
    }

    tjs_call_handler(ctx, func, argc, argv);

    for (int i = 0; i < argc; i++) {
        JS_FreeValue(ctx, argv[i]);
    }
}

/* Browsers put no limit on the wait for response headers; only the user's
 * timeout (XHR timeout, AbortSignal) ends it. lws, however, arms its own reply
 * timer (PENDING_TIMEOUT_AWAITING_SERVER_RESPONSE, the context's timeout_secs,
 * 15 s by default) inside its state machine once the request is sent, where no
 * callback of ours runs. So while the reply is pending we wake up every
 * TJS_HTTPCLIENT_REPLY_TICK_US and clear it. The tick must stay below
 * timeout_secs: lws re-arms the reply timer at several points (after a 1xx
 * interim response, when a queued h1 request reuses a pooled connection) and
 * each tick has to undo that before it fires. */
#define TJS_HTTPCLIENT_REPLY_TICK_US (5 * LWS_USEC_PER_SEC)

static bool httpclient_awaiting_reply(TJSHttpClient *h) {
    return h->req_sent && !h->got_response;
}

static lws_usec_t httpclient_deadline(TJSHttpClient *h) {
    return h->start_us + (lws_usec_t) h->timeout * LWS_USEC_PER_SEC / 1000;
}

/* Arm (or cancel) the request timer: the user timeout, measured from
 * h->start_us, and the reply keep-off tick while awaiting the response. */
static void httpclient_arm_timer(TJSHttpClient *h, struct lws *wsi) {
    bool tick = httpclient_awaiting_reply(h);

    if (h->timeout == 0 && !tick) {
        lws_set_timer_usecs(wsi, LWS_SET_TIMER_USEC_CANCEL);
        return;
    }

    lws_usec_t delay = TJS_HTTPCLIENT_REPLY_TICK_US;

    if (h->timeout != 0) {
        lws_usec_t now = lws_now_usecs();
        lws_usec_t deadline = httpclient_deadline(h);

        /* Already past due (or due this instant): lws treats 0 as "cancel", so
         * ask for the shortest real delay instead and let the timer callback
         * report it. */
        lws_usec_t left = deadline > now ? deadline - now : 1;
        if (!tick || left < delay) {
            delay = left;
        }
    }

    lws_set_timer_usecs(wsi, delay);
}

/* The request was fully handed to lws: from here until the response headers
 * arrive, lws's reply timer must be kept off (see above). */
static void httpclient_request_sent(TJSHttpClient *h, struct lws *wsi) {
    h->req_sent = true;
    httpclient_arm_timer(h, wsi);
}

/* Cancel the request timer and detach h from the wsi it ran on. */
static void httpclient_release_wsi(TJSHttpClient *h, struct lws *cbwsi) {
    if (h->wsi) {
        lws_set_timer_usecs(h->wsi, LWS_SET_TIMER_USEC_CANCEL);
    }
    /* The reply tick may run on the stream wsi (an h2/h3 child) rather than h->wsi. */
    if (cbwsi && cbwsi != h->wsi) {
        lws_set_timer_usecs(cbwsi, LWS_SET_TIMER_USEC_CANCEL);
    }

    /* Detach h from every wsi that carries it as user_space, so no later callback
     * on a reused/idle connection dereferences a client we no longer own. h->wsi
     * is what lws wrote to cci.pwsi — for a pooled h2 request that is the shared
     * network wsi, whereas the request's HTTP callbacks (including the terminal
     * CLOSED) fire on a mux child stream wsi whose user_space is also h. cbwsi is
     * the wsi of the terminal callback we tear down from; clear it, h->wsi, and
     * cbwsi's network wsi, each guarded so we only ever null our own pointer. */
    struct lws *carriers[3] = { h->wsi, cbwsi, cbwsi ? lws_get_network_wsi(cbwsi) : NULL };
    for (size_t i = 0; i < sizeof(carriers) / sizeof(carriers[0]); i++) {
        if (carriers[i] && lws_wsi_user(carriers[i]) == h) {
            lws_set_wsi_user(carriers[i], NULL);
        }
    }
    h->wsi = NULL;
    h->mux_wsi = NULL;
}

/* Release our hold on a finished request.  With connection reuse
 * (LCCSCF_PIPELINE) a wsi is no longer 1:1 with a socket: on transaction
 * completion lws keeps the connection warm and, for h1, migrates it to the
 * next queued request — the retired leader is then destroyed WITHOUT a
 * CLOSED_CLIENT_HTTP callback (it sets already_did_cce). So teardown must run
 * from whichever terminal callback fires first: COMPLETED_CLIENT_HTTP on
 * success, CLOSED/CONNECTION_ERROR on failure; an idle connection's eventual
 * CLOSED arrives after we have already detached here and is a no-op.
 *
 * This drops loop-liveness (so idle pooled connections don't keep the process
 * alive), cancels the request timeout, and detaches h from the wsi so no later
 * callback on the reused/idle connection sees this client.  It does NOT free
 * h: that stays the GC finalizer's job, since the JS wrapper (and abort())
 * may still reach it until it is collected. */
static void httpclient_teardown(TJSHttpClient *h, struct lws *cbwsi) {
    if (h->torn_down) {
        return;
    }
    h->torn_down = true;

    tjs__lws_conn_unref(h->ctx);

    if (h->retry_pending) {
        h->retry_pending = false;
        lws_sul_cancel(&h->retry_sul);
    }

    httpclient_release_wsi(h, cbwsi);

    /* Release the self-pin; the finalizer frees callbacks, url, buffers, and the
     * struct itself once JS also lets go. Unpinning also removes h from the
     * teardown registry, so an abnormal-exit drain won't touch it. */
    CHECK(!JS_IsUndefined(h->pin.obj));
    tjs__handle_unpin(h->ctx, &h->pin);
}

/* True for an h2/h3 stream, which runs on a network wsi of its own; false for
 * h1, where the request's wsi is the connection. */
static bool httpclient_wsi_is_mux(struct lws *wsi) {
    return lws_get_network_wsi(wsi) != wsi;
}

/* RFC 9110 §9.2.2. Fetch and XHR uppercase the standard methods, so an exact
 * match suffices; anything else (POST, PATCH, custom methods) is not. */
static bool httpclient_method_is_idempotent(const char *method) {
    static const char *const methods[] = { "GET", "HEAD", "OPTIONS", "TRACE", "PUT", "DELETE" };
    for (size_t i = 0; i < sizeof(methods) / sizeof(methods[0]); i++) {
        if (!strcmp(method, methods[i])) {
            return true;
        }
    }
    return false;
}

/* A request gets one more attempt on a fresh connection, as a browser would,
 * in two cases. Both only apply to a request that did not open the connection
 * it failed on (a request on its own new connection is never retried).
 *
 * 1. A request issued while another one to the same origin is setting up its
 *    connection (or, on h1, still waiting for its response) is queued on that
 *    request's wsi. When that request's connection closes for any reason
 *    (abort, timeout, peer reset), lws closes everything queued on it, although
 *    none of it was sent, and tells each one CLOSED_CLIENT_HTTP. lws never
 *    asked for its headers: nothing went out on the wire. A request that
 *    failed before lws asked for its headers on a connection of its own (DNS)
 *    is told CLIENT_CONNECTION_ERROR instead, and is not retried.
 *
 * 2. An h1 keep-alive server may close an idle connection right after a
 *    response (its idle timeout), racing the next request lws puts on it: the
 *    local write succeeds, but the server never reads the request. Like
 *    Chromium (HttpNetworkTransaction::ShouldResendRequest) and RFC 9112
 *    §9.3.1, a request that went out on a reused connection which then closed
 *    before any response headers is resent, but only if replaying it is safe:
 *    an idempotent method and a buffered (not streamed) body. lws reports the
 *    peer's FIN while awaiting the response as CLIENT_CONNECTION_ERROR
 *    ("server closed before responding") and a reset as CLOSED_CLIENT_HTTP,
 *    so either counts. It swallows 1xx interim responses and exposes no way
 *    to tell one, or a partial or malformed response head, arrived: a request
 *    whose connection dies after one of those is resent too. h2/h3 streams
 *    are left out: a stream closed there is a RST_STREAM/GOAWAY matter, not a
 *    stale socket.
 *
 * Either way the retry is the request's only one. */
static bool httpclient_should_retry(TJSHttpClient *h, enum lws_callback_reasons reason) {
    return !h->completed && !h->retried && !h->connecting &&
           ((reason == LWS_CALLBACK_CLOSED_CLIENT_HTTP && !h->headers_sent) ||
            (h->headers_sent && !h->got_response && !h->sent_on_mux && !h->streaming &&
             httpclient_method_is_idempotent(h->method)));
}

static int tjs_httpclient_connect(TJSHttpClient *h);

static void httpclient_retry_cb(lws_sorted_usec_list_t *sul) {
    TJSHttpClient *h = lws_container_of(sul, TJSHttpClient, retry_sul);
    JSContext *ctx = h->ctx;

    h->retry_pending = false;

    /* A failure tears down h, which unpins it and may free it; keep the
     * wrapper alive until we are done with h. */
    JSValue obj = JS_DupValue(ctx, h->pin.obj);

    if (tjs_httpclient_connect(h) != 0 && !h->completed) {
        h->completed = true;
        JSValue args[2];
        args[0] = JS_NewString(ctx, "CONNECTION_ERROR");
        args[1] = JS_NewString(ctx, "Connection failed");
        maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 2, args);
        httpclient_teardown(h, NULL);
    }

    JS_FreeValue(ctx, obj);
}

/* Called from the dying wsi's close: connect from the event loop instead. The
 * request keeps its pin and its loop reference meanwhile. */
static void httpclient_schedule_retry(TJSHttpClient *h, struct lws *cbwsi) {
    httpclient_release_wsi(h, cbwsi);
    /* The attempt that failed may have composed and written the request
     * already: the retry sends it again from the start. */
    h->headers_sent = false;
    h->sent_on_mux = false;
    h->mux_body = false;
    h->req_sent = false;
    h->send_offset = 0;
    h->keepalive = true;
    h->connecting = false;
    h->retried = true;
    h->retry_pending = true;
    lws_sul_schedule(tjs__lws_get_context(h->ctx), 0, &h->retry_sul, httpclient_retry_cb, 1);
}

/* Connection is a comma-separated token list; a "close" token anywhere means
 * the connection will not be kept alive. */
static bool connection_has_close(const char *p) {
    while (*p) {
        while (*p == ' ' || *p == '\t' || *p == ',') {
            p++;
        }
        if (!strncasecmp(p, "close", 5) && (p[5] == '\0' || p[5] == ' ' || p[5] == '\t' || p[5] == ',')) {
            return true;
        }
        while (*p && *p != ',') {
            p++;
        }
    }

    return false;
}

/* Decide whether a connection may be kept warm for reuse, from the response
 * headers.  Called at ESTABLISHED_CLIENT_HTTP (not COMPLETED): for a
 * close-delimited response lws fires COMPLETED off the socket EOF, by which
 * point the response header table may already be gone, so the "Connection"
 * token must be read while the headers are fresh.  The response must permit
 * keep-alive (no "Connection: close"): a close-delimited h1 response is sent
 * with Connection: close and the peer tears the socket down after it, so
 * keeping it warm would race a dead socket on the next request.
 * When not reusable the COMPLETED handler returns -1 so lws closes the socket
 * and the next request to the same host opens a fresh connection. */
static bool httpclient_conn_reusable(struct lws *wsi) {
    char conn[64];
    if (lws_hdr_copy(wsi, conn, sizeof(conn), WSI_TOKEN_CONNECTION) > 0) {
        return !connection_has_close(conn);
    }

    return true;
}


typedef struct {
    struct lws *wsi;
    TJSHttpClient *h;
} TJSHttpHdrCtx;

static void custom_header_foreach_cb(const char *name, int nlen, void *opaque) {
    TJSHttpHdrCtx *hctx = opaque;

    int total_len = lws_hdr_custom_length(hctx->wsi, name, nlen);
    if (total_len < 0) {
        return;
    }

    size_t buf_size = (size_t) total_len + 1;
    char *val = js_malloc(hctx->h->ctx, buf_size);
    if (!val) {
        return;
    }

    if (lws_hdr_custom_copy(hctx->wsi, val, (int) buf_size, name, nlen) < 0) {
        js_free(hctx->h->ctx, val);
        return;
    }

    /* Strip trailing colon from name. */
    int name_len = nlen;
    if (name_len > 0 && name[name_len - 1] == ':') {
        name_len--;
    }

    JSValue args[2];
    args[0] = JS_NewStringLen(hctx->h->ctx, name, name_len);
    args[1] = JS_NewString(hctx->h->ctx, val);
    maybe_invoke_callback(hctx->h, HC_CALLBACK_HEADER, 2, args);

    js_free(hctx->h->ctx, val);
}

/* lws joins repeated Set-Cookie headers with ';', which can't be split back
 * apart, so report each fragment (one per header line) on its own. */
static void fire_set_cookie_headers(TJSHttpClient *h, struct lws *wsi) {
    /* The joined length bounds every fragment, so one buffer fits them all. */
    int total_len = lws_hdr_total_length(wsi, WSI_TOKEN_HTTP_SET_COOKIE);
    if (total_len <= 0) {
        return;
    }
    size_t buf_size = (size_t) total_len + 1;
    char *val = js_malloc(h->ctx, buf_size);
    if (!val) {
        return;
    }

    /* lws_hdr_copy_fragment() returns -1 once frag_idx is past the last one;
     * it can't return -2 (buffer too small) since the buffer fits the joined value. */
    int len;
    for (int i = 0; (len = lws_hdr_copy_fragment(wsi, val, (int) buf_size, WSI_TOKEN_HTTP_SET_COOKIE, i)) != -1; i++) {
        CHECK_GE(len, 0);

        const char *start = val;
        const char *end = val + len;
        while (start < end && (*start == ' ' || *start == '\t')) {
            start++;
        }
        while (end > start && (end[-1] == ' ' || end[-1] == '\t')) {
            end--;
        }

        JSValue args[2];
        args[0] = JS_NewString(h->ctx, "set-cookie");
        args[1] = JS_NewStringLen(h->ctx, start, end - start);
        maybe_invoke_callback(h, HC_CALLBACK_HEADER, 2, args);
    }

    js_free(h->ctx, val);
}

static void fire_response_headers(TJSHttpClient *h, struct lws *wsi) {
    /* Iterate known tokens. */
    for (int n = 0; n < WSI_TOKEN_COUNT; n++) {
        if (n == WSI_TOKEN_HTTP_SET_COOKIE) {
            fire_set_cookie_headers(h, wsi);
            continue;
        }
        const unsigned char *tok_name = lws_token_to_string(n);
        if (!tok_name) {
            continue;
        }
        const char *tn = (const char *) tok_name;
        int tn_len = (int) strlen(tn);
        if (tn_len == 0 || tn[tn_len - 1] != ':') {
            continue;
        }
        int total_len = lws_hdr_total_length(wsi, n);
        if (total_len <= 0) {
            continue;
        }
        size_t buf_size = (size_t) total_len + 1;
        char *val = js_malloc(h->ctx, buf_size);
        if (!val) {
            continue;
        }
        if (lws_hdr_copy(wsi, val, (int) buf_size, n) < 0) {
            js_free(h->ctx, val);
            continue;
        }

        /* Strip trailing colon. */
        JSValue args[2];
        args[0] = JS_NewStringLen(h->ctx, tn, tn_len - 1);
        args[1] = JS_NewString(h->ctx, val);
        maybe_invoke_callback(h, HC_CALLBACK_HEADER, 2, args);
        js_free(h->ctx, val);
    }

    /* Iterate custom headers. */
    TJSHttpHdrCtx hctx = { .wsi = wsi, .h = h };
    lws_hdr_custom_name_foreach(wsi, custom_header_foreach_cb, &hctx);
}

/* Check whether the user already set a given request header (case-insensitive). */
static bool has_request_header(const TBuf *headers, const char *name) {
    if (headers->size == 0) {
        return false;
    }
    size_t name_len = strlen(name);
    const char *p = (const char *) headers->buf;
    const char *end = p + headers->size;
    while (p < end) {
        if (strncasecmp(p, name, name_len) == 0 && p[name_len] == ':') {
            return true;
        }
        const char *eol = strstr(p, "\r\n");
        if (!eol) {
            break;
        }
        p = eol + 2;
    }
    return false;
}

/* Detect Content-Encoding from response headers. Returns format string or NULL. */
static const char *detect_content_encoding(struct lws *wsi) {
    char val[64];

    for (int n = 0; n < WSI_TOKEN_COUNT; n++) {
        const unsigned char *tok_name = lws_token_to_string(n);
        if (!tok_name) {
            continue;
        }
        const char *tn = (const char *) tok_name;
        if (strncasecmp(tn, "content-encoding:", 17) != 0) {
            continue;
        }
        if (lws_hdr_total_length(wsi, n) <= 0) {
            break;
        }
        if (lws_hdr_copy(wsi, val, sizeof(val), n) < 0) {
            break;
        }

        /* Trim leading whitespace. */
        const char *v = val;
        while (*v == ' ') {
            v++;
        }

        if (!strcasecmp(v, "gzip") || !strcasecmp(v, "x-gzip")) {
            return "gzip";
        } else if (!strcasecmp(v, "deflate")) {
            return "deflate";
        }
        break;
    }

    return NULL;
}

static int tjs_lws_http_callback(struct lws *wsi, enum lws_callback_reasons reason, void *user, void *in, size_t len) {
    TJSHttpClient *h = (TJSHttpClient *) user;

    if (!h) {
        return 0;
    }

    switch (reason) {
        case LWS_CALLBACK_CONNECTING:
            h->connecting = true;
            break;

        case LWS_CALLBACK_CLIENT_APPEND_HANDSHAKE_HEADER: {
            unsigned char **p = (unsigned char **) in, *end = (*p) + len;

            h->headers_sent = true;
            h->sent_on_mux = httpclient_wsi_is_mux(wsi);
            h->mux_body = h->streaming && h->sent_on_mux;
            h->mux_wsi = h->mux_body ? wsi : NULL;

            /* Add User-Agent header unless the user already set one. */
            if (!has_request_header(&h->req_headers, "User-Agent")) {
                if (lws_add_http_header_by_name(wsi,
                                                (const unsigned char *) "user-agent:",
                                                (const unsigned char *) TJS__UA_STRING,
                                                (int) strlen(TJS__UA_STRING),
                                                p,
                                                end)) {
                    return -1;
                }
            }

            /* Add Accept-Encoding unless the user already set it. */
            if (!has_request_header(&h->req_headers, "Accept-Encoding")) {
                static const char ae_val[] = "gzip, deflate";
                if (lws_add_http_header_by_name(wsi,
                                                (const unsigned char *) "accept-encoding:",
                                                (const unsigned char *) ae_val,
                                                (int) strlen(ae_val),
                                                p,
                                                end)) {
                    return -1;
                }
            }

            /* Add custom headers stored in req_headers TBuf.
             * Format: "Name: Value\r\nName2: Value2\r\n" */
            if (h->req_headers.size > 0) {
                /* NUL-terminate once: a retry composes the headers again. */
                if (h->req_headers.buf[h->req_headers.size - 1] != '\0') {
                    tbuf_putc(&h->req_headers, '\0');
                }
                char *headers = (char *) h->req_headers.buf;
                char *line = headers;
                while (line && *line) {
                    char *eol = strstr(line, "\r\n");
                    if (!eol) {
                        break;
                    }
                    *eol = '\0';
                    char *colon = strchr(line, ':');
                    if (colon) {
                        *colon = '\0';
                        const char *name = line;
                        const char *value = colon + 1;
                        while (*value == ' ') {
                            value++;
                        }

                        /* Build "name:" for lws. */
                        char name_colon[256];
                        snprintf(name_colon, sizeof(name_colon), "%s:", name);

                        if (lws_add_http_header_by_name(wsi,
                                                        (const unsigned char *) name_colon,
                                                        (const unsigned char *) value,
                                                        (int) strlen(value),
                                                        p,
                                                        end)) {
                            /* Leave req_headers intact for a retry. */
                            *colon = ':';
                            *eol = '\r';
                            return -1;
                        }
                        *colon = ':';
                    }
                    *eol = '\r';
                    line = eol + 2;
                }
            }

            /* Signal body pending for methods that have a body. */
            if (h->send_buf.size > 0 || h->streaming) {
                if (h->send_buf.size > 0) {
                    /* Known body size: add Content-Length. */
                    char cl_str[32];
                    int cl_len = snprintf(cl_str, sizeof(cl_str), "%zu", h->send_buf.size);
                    if (lws_add_http_header_by_name(wsi,
                                                    (const unsigned char *) "content-length:",
                                                    (const unsigned char *) cl_str,
                                                    cl_len,
                                                    p,
                                                    end)) {
                        return -1;
                    }
                } else if (!h->mux_body) {
                    /* Streaming body over h1: use chunked transfer encoding.
                     * h2/h3 forbid Transfer-Encoding (RFC 9113 §8.2.2, RFC
                     * 9114 §4.2): there the DATA frames carry the body and
                     * END_STREAM ends it. */
                    if (lws_add_http_header_by_name(wsi,
                                                    (const unsigned char *) "transfer-encoding:",
                                                    (const unsigned char *) "chunked",
                                                    7,
                                                    p,
                                                    end)) {
                        return -1;
                    }
                }
                lws_client_http_body_pending(wsi, 1);
                lws_callback_on_writable(wsi);
            } else {
                httpclient_request_sent(h, wsi);
            }

            break;
        }

        case LWS_CALLBACK_ESTABLISHED_CLIENT_HTTP: {
            int status = (int) lws_http_client_http_response(wsi);

            /* When a request reuses an existing h2 connection, lws binds a new
             * stream and fires this callback once with no response yet (HTTP
             * status 0) purely to signal the stream is ready; the real response
             * headers arrive in a later ESTABLISHED. Ignore the signalling one
             * so we don't deliver a bogus status-0 response. */
            if (status <= 0) {
                break;
            }

            h->got_response = true;
            httpclient_arm_timer(h, wsi);

            /* Decide reuse now, while the response headers are still parsed: a
             * response that carried "Connection: close" leaves the socket about
             * to be torn down, so it must not be kept warm — the COMPLETED
             * handler returns -1 to close it. Streaming (chunked) request bodies
             * were already kept out of the pool at connect (no LCCSCF_PIPELINE),
             * so there is nothing to evict here. */
            h->keepalive = !h->conn_close && httpclient_conn_reusable(wsi);

            /* Detect Content-Encoding before firing headers. */
            const char *encoding = detect_content_encoding(wsi);
            if (encoding) {
                h->decompressor = tjs__decompressor_create(h->ctx, encoding);
            }

            JSValue status_arg = JS_NewInt32(h->ctx, status);
            maybe_invoke_callback(h, HC_CALLBACK_STATUS, 1, &status_arg);

            JSValue url_arg = JS_DupValue(h->ctx, h->url);
            maybe_invoke_callback(h, HC_CALLBACK_URL, 1, &url_arg);

            fire_response_headers(h, wsi);

            maybe_invoke_callback(h, HC_CALLBACK_HEADERSCOMPLETE, 0, NULL);
            break;
        }

        case LWS_CALLBACK_RECEIVE_CLIENT_HTTP: {
            /* Aborted (e.g. EventSource.close() / stream cancel) but the wsi is
             * pending an async close: stop reading and let lws close via the -1
             * return, so we don't deliver more data into a cancelled stream. */
            if (h->completed) {
                return -1;
            }

            char buffer[8192 + LWS_PRE];
            char *px = buffer + LWS_PRE;
            int lenx = sizeof(buffer) - LWS_PRE;

            if (lws_http_client_read(wsi, &px, &lenx) < 0) {
                return -1;
            }
            break;
        }

        case LWS_CALLBACK_RECEIVE_CLIENT_HTTP_READ: {
            if (h->decompressor) {
                TBuf out;
                tbuf_init(h->ctx, &out);
                if (tjs__decompressor_decompress(h->decompressor, (const uint8_t *) in, len, &out) < 0) {
                    tbuf_free(&out);
                    /* Decompression failed — deliver raw data. */
                    JSValue arg = JS_NewArrayBufferCopy(h->ctx, (const uint8_t *) in, len);
                    maybe_invoke_callback(h, HC_CALLBACK_DATA, 1, &arg);
                } else if (out.size > 0) {
                    JSValue arg = JS_NewArrayBufferCopy(h->ctx, out.buf, out.size);
                    tbuf_free(&out);
                    maybe_invoke_callback(h, HC_CALLBACK_DATA, 1, &arg);
                } else {
                    tbuf_free(&out);
                }
            } else {
                JSValue arg = JS_NewArrayBufferCopy(h->ctx, (const uint8_t *) in, len);
                maybe_invoke_callback(h, HC_CALLBACK_DATA, 1, &arg);
            }
            break;
        }

        case LWS_CALLBACK_CLIENT_HTTP_WRITEABLE: {
            if (!h->streaming) {
                /* Non-streaming body: send the buffered body in chunks the
                 * connection can flush per callback. A single unconditional
                 * FINAL write of the whole body truncated h2 request bodies
                 * larger than one frame; lws applies h2 send-window flow
                 * control and buffers what the window can't take yet. */
                size_t remaining = h->send_buf.size - h->send_offset;
                if (remaining == 0) {
                    lws_client_http_body_pending(wsi, 0);
                    httpclient_request_sent(h, wsi);
                    break;
                }

                size_t to_send = MIN(remaining, TJS_HTTPCLIENT_WRITE_CHUNK_SIZE);

                /* Respect the peer's flow-control window. Over HTTP/2 the
                 * connection/stream send window bounds how much the peer will
                 * accept right now; lws_write() does NOT clamp to it, so writing
                 * past it overruns the window. For bodies that span more than
                 * one window that desyncs flow control and the request fails.
                 * lws_get_peer_write_allowance() returns -1 when the protocol
                 * has no window (h1: send freely) or the bytes the peer will
                 * currently accept (h2). */
                lws_fileofs_t allow = lws_get_peer_write_allowance(wsi);
                if (allow == 0) {
                    /* No send credit right now: keep the body pending and wait
                     * to be re-made-writable when a WINDOW_UPDATE arrives. */
                    break;
                }
                if (allow > 0 && (lws_fileofs_t) to_send > allow) {
                    to_send = (size_t) allow;
                }

                /* FINAL only on the write carrying the body's last byte. */
                enum lws_write_protocol wp = LWS_WRITE_HTTP;
                if (h->send_offset + to_send >= h->send_buf.size) {
                    wp = LWS_WRITE_HTTP_FINAL;
                }

                uint8_t *buf = js_malloc(h->ctx, LWS_PRE + to_send);
                if (!buf) {
                    return -1;
                }
                memcpy(buf + LWS_PRE, h->send_buf.buf + h->send_offset, to_send);
                int n = lws_write(wsi, buf + LWS_PRE, to_send, wp);
                js_free(h->ctx, buf);
                if (n < 0) {
                    return -1;
                }
                h->send_offset += (size_t) n;

                if (h->send_offset < h->send_buf.size) {
                    lws_callback_on_writable(wsi);
                } else {
                    lws_client_http_body_pending(wsi, 0);
                    httpclient_request_sent(h, wsi);
                }

                break;
            }

            if (h->mux_body) {
                /* Streaming body over h2/h3: raw bytes in DATA frames, bounded
                 * by the peer's send window like the non-streaming body above.
                 * The stream's end is a body-less FINAL write, which lws sends
                 * as END_STREAM (h2) or a FIN (h3). */
                if (h->req_sent) {
                    /* The stream's end went already: nothing may follow it. */
                    break;
                }
                size_t remaining = h->send_buf.size - h->send_offset;
                if (remaining == 0) {
                    if (h->body_done) {
                        lws_client_http_body_pending(wsi, 0);
                        uint8_t fin[LWS_PRE + 1];
                        if (lws_write(wsi, fin + LWS_PRE, 0, LWS_WRITE_HTTP_FINAL) < 0) {
                            return -1;
                        }
                        httpclient_request_sent(h, wsi);
                    } else {
                        maybe_invoke_callback(h, HC_CALLBACK_DRAIN, 0, NULL);
                    }
                    break;
                }

                size_t to_send = MIN(remaining, TJS_HTTPCLIENT_WRITE_CHUNK_SIZE);
                lws_fileofs_t allow = lws_get_peer_write_allowance(wsi);
                if (allow == 0) {
                    break;
                }
                if (allow > 0 && (lws_fileofs_t) to_send > allow) {
                    to_send = (size_t) allow;
                }

                uint8_t *buf = js_malloc(h->ctx, LWS_PRE + to_send);
                if (!buf) {
                    return -1;
                }
                memcpy(buf + LWS_PRE, h->send_buf.buf + h->send_offset, to_send);
                int n = lws_write(wsi, buf + LWS_PRE, to_send, LWS_WRITE_HTTP);
                js_free(h->ctx, buf);
                if (n < 0) {
                    return -1;
                }
                h->send_offset += (size_t) n;

                if (h->send_offset < h->send_buf.size) {
                    lws_callback_on_writable(wsi);
                } else {
                    h->send_buf.size = 0;
                    h->send_offset = 0;
                    if (!h->body_done) {
                        maybe_invoke_callback(h, HC_CALLBACK_DRAIN, 0, NULL);
                    } else {
                        lws_callback_on_writable(wsi);
                    }
                }

                break;
            }

            /* Streaming body over h1 (chunked transfer-encoding). */
            if (h->send_buf.size == 0) {
                if (h->body_done) {
                    /* All body data sent — finalize with the terminating chunk. */
                    lws_client_http_body_pending(wsi, 0);
                    uint8_t buf[LWS_PRE + 5];
                    memcpy(buf + LWS_PRE, "0\r\n\r\n", 5);
                    lws_write(wsi, buf + LWS_PRE, 5, LWS_WRITE_HTTP_FINAL);
                    httpclient_request_sent(h, wsi);
                } else {
                    /* No data buffered — ask JS for more. */
                    maybe_invoke_callback(h, HC_CALLBACK_DRAIN, 0, NULL);
                }
                break;
            }

            size_t to_send = h->send_buf.size;

            /* Chunked encoding: "<hex-len>\r\n<data>\r\n" */
            char chunk_hdr[20];
            int hdr_len = snprintf(chunk_hdr, sizeof(chunk_hdr), "%zx\r\n", to_send);
            size_t frame_size = (size_t) hdr_len + to_send + 2;

            uint8_t *buf = js_malloc(h->ctx, LWS_PRE + frame_size);
            if (!buf) {
                return -1;
            }
            memcpy(buf + LWS_PRE, chunk_hdr, hdr_len);
            memcpy(buf + LWS_PRE + hdr_len, h->send_buf.buf, to_send);
            memcpy(buf + LWS_PRE + hdr_len + to_send, "\r\n", 2);

            int n = lws_write(wsi, buf + LWS_PRE, frame_size, LWS_WRITE_HTTP);
            js_free(h->ctx, buf);
            if (n < 0) {
                return -1;
            }

            h->send_buf.size = 0;

            if (!h->body_done) {
                /* Ask JS for more body data. sendData will
                 * call lws_callback_on_writable when ready. */
                maybe_invoke_callback(h, HC_CALLBACK_DRAIN, 0, NULL);
            } else {
                /* Need another WRITEABLE to send the final chunk. */
                lws_callback_on_writable(wsi);
            }

            break;
        }

        case LWS_CALLBACK_COMPLETED_CLIENT_HTTP: {
            if (!h->completed) {
                h->completed = true;
                JSValue error = JS_NULL;
                maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 1, &error);
            }
            /* Keep the connection warm for reuse (LCCSCF_PIPELINE) only when the
             * response allowed it (decided at ESTABLISHED); otherwise return -1
             * so lws closes it and the next request to the same host opens a
             * fresh connection. */
            bool reusable = h->keepalive;
            httpclient_teardown(h, wsi);
            return reusable ? 0 : -1;
        }

        case LWS_CALLBACK_TIMER: {
            /* Not yet due: the reply keep-off tick (see httpclient_arm_timer). */
            if (!h->completed && (h->timeout == 0 || lws_now_usecs() < httpclient_deadline(h))) {
                if (httpclient_awaiting_reply(h)) {
                    lws_set_timeout(wsi, NO_PENDING_TIMEOUT, 0);
                    /* Over h2 lws also times out the whole connection for rx
                     * silence (PENDING_TIMEOUT_HTTP_CONTENT, timeout_secs,
                     * renewed on every frame received), which a slow reply is. */
                    struct lws *nwsi = lws_get_network_wsi(wsi);
                    if (nwsi && nwsi != wsi) {
                        lws_set_timeout(nwsi, NO_PENDING_TIMEOUT, 0);
                    }
                }
                httpclient_arm_timer(h, wsi);
                break;
            }

            if (!h->completed) {
                h->completed = true;
                JSValue error = JS_NewString(h->ctx, "TIMED_OUT");
                maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 1, &error);
            }
            return -1;
        }

            /* Terminal failure/close callbacks. On a reused connection a
             * successful transaction ends at COMPLETED_CLIENT_HTTP (which tore
             * down already, detaching h → user is NULL and we returned at the
             * top). Reaching here means either the transaction never completed
             * (connection error / server closed mid-response) or an aborted
             * request's deferred close. Report the failure if not already
             * completed, then tear down. */

        case LWS_CALLBACK_CLOSED_CLIENT_HTTP:
        case LWS_CALLBACK_CLIENT_CONNECTION_ERROR: {
            if (httpclient_should_retry(h, reason)) {
                httpclient_schedule_retry(h, wsi);
                break;
            }

            if (!h->completed) {
                h->completed = true;
                if (reason == LWS_CALLBACK_CLIENT_CONNECTION_ERROR) {
                    JSValue args[2];
                    args[0] = JS_NewString(h->ctx, "CONNECTION_ERROR");
                    args[1] = JS_NewString(h->ctx, in ? (const char *) in : "Connection error");
                    maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 2, args);
                } else {
                    JSValue error = JS_NewString(h->ctx, "CONNECTION_CLOSED");
                    maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 1, &error);
                }
            }

            httpclient_teardown(h, wsi);
            break;
        }

        default:
            break;
    }

    return 0;
}

const struct lws_protocols tjs_http_protocol = {
    .name = TJS_LWS_HTTP_PROTOCOL_NAME,
    .callback = tjs_lws_http_callback,
    .per_session_data_size = 0,
    .rx_buffer_size = 0,
};

static JSValue tjs_httpclient_constructor(JSContext *ctx, JSValue new_target, int argc, JSValue *argv) {
    JSValue obj = JS_NewObjectClass(ctx, tjs__class_id(ctx, TJS_CLASS_HTTPCLIENT));
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSHttpClient *h = js_mallocz(ctx, sizeof(*h));
    if (!h) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    h->ctx = ctx;
    h->url = JS_NULL;
    h->pin.obj = JS_UNDEFINED;
    h->pin.detach = tjs_httpclient_detach;
    tbuf_init(ctx, &h->req_headers);
    tbuf_init(ctx, &h->send_buf);
    h->send_offset = 0;
    h->method = NULL;
    h->url_str = NULL;
    h->sent = false;
    h->streaming = false;
    h->body_done = false;
    h->completed = false;
    h->torn_down = false;
    h->keepalive = true;
    h->conn_close = false;
    h->ssl_flags = 0;

    for (int i = 0; i < HC_CALLBACK_MAX; i++) {
        h->callbacks[i] = JS_UNDEFINED;
    }

    JS_SetOpaque(obj, h);
    return obj;
}

static JSValue tjs_httpclient_callback_get(JSContext *ctx, JSValue this_val, int magic) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }
    return JS_DupValue(ctx, h->callbacks[magic]);
}

static JSValue tjs_httpclient_callback_set(JSContext *ctx, JSValue this_val, JSValue value, int magic) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }
    if (JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value)) {
        JS_FreeValue(ctx, h->callbacks[magic]);
        h->callbacks[magic] = JS_DupValue(ctx, value);
    }
    return JS_UNDEFINED;
}

static JSValue tjs_httpclient_timeout_get(JSContext *ctx, JSValue this_val) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }
    return JS_NewInt32(ctx, h->timeout);
}

static JSValue tjs_httpclient_timeout_set(JSContext *ctx, JSValue this_val, JSValue value) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }

    int32_t timeout;
    if (JS_ToInt32(ctx, &timeout, value)) {
        return JS_EXCEPTION;
    }

    h->timeout = timeout;

    return JS_UNDEFINED;
}

static JSValue tjs_httpclient_streaming_get(JSContext *ctx, JSValue this_val) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }
    return JS_NewBool(ctx, h->streaming);
}

static JSValue tjs_httpclient_streaming_set(JSContext *ctx, JSValue this_val, JSValue value) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }
    if (h->sent) {
        return JS_ThrowTypeError(ctx, "Cannot change streaming mode after request started");
    }
    h->streaming = JS_ToBool(ctx, value);
    return JS_UNDEFINED;
}

static int tjs_httpclient_buffer_data(TJSHttpClient *h, JSValue arg) {
    JSContext *ctx = h->ctx;
    size_t size;
    const void *buf;

    if (JS_IsString(arg)) {
        buf = JS_ToCStringLen(ctx, &size, arg);
        if (!buf) {
            return -1;
        }
        int r = tbuf_put(&h->send_buf, (const uint8_t *) buf, size);
        JS_FreeCString(ctx, buf);
        if (r) {
            JS_ThrowOutOfMemory(ctx);
            return -1;
        }
    } else if (JS_GetTypedArrayType(arg) == JS_TYPED_ARRAY_UINT8) {
        buf = JS_GetUint8Array(ctx, &size, arg);
        if (!buf) {
            return -1;
        }
        if (tbuf_put(&h->send_buf, buf, size)) {
            JS_ThrowOutOfMemory(ctx);
            return -1;
        }
    } else {
        JS_ThrowTypeError(ctx, "Expected string, Uint8Array, or null");
        return -1;
    }

    return 0;
}

/* Parse URL and initiate an lws client connection.  Returns 0 on success. */
static int tjs_httpclient_connect(TJSHttpClient *h) {
    JSContext *ctx = h->ctx;

    lws_parse_uri_t *uri = lws_parse_uri_create(h->url_str);
    if (!uri) {
        return -1;
    }

    bool use_ssl = !strcmp(uri->scheme, "https");

    char full_path[TJS_PATH_MAX];
    tjs__lws_request_path(h->url_str, full_path, sizeof(full_path));

    /* lws emits cci.host verbatim as the Host header; include a non-default
     * port so the server sees the correct authority (RFC 7230 §5.4). */
    char host_hdr[512];
    tjs__lws_format_host(host_hdr, sizeof(host_hdr), uri->scheme, uri->host, uri->port);

    struct lws_context *lws_ctx = tjs__lws_get_context(ctx);
    if (!lws_ctx) {
        lws_parse_uri_destroy(&uri);
        return -1;
    }

    struct lws_client_connect_info cci;
    memset(&cci, 0, sizeof(cci));

    cci.context = lws_ctx;
    cci.address = uri->host;
    cci.port = uri->port;
    cci.path = full_path;
    cci.host = host_hdr;
    cci.origin = uri->host;
    /* LCCSCF_PIPELINE opts this connection into lws's client connection pool:
     * requests to the same endpoint (address+port+tls, per vhost) reuse a warm
     * connection instead of a fresh TCP+TLS handshake each time — h1 pipelines
     * sequentially, h2 multiplexes streams. Without it lws also sends
     * "Connection: close" on every request.
     *
     * A streaming (unknown-length) request body is sent chunked over h1, and a
     * keep-alive peer that cannot de-frame a chunked request body would fail to
     * parse the next request on a reused connection (lws itself has no such
     * server-side de-framer). Rather than pool such a connection and evict it
     * afterwards, we keep it out of the pool from the start: no LCCSCF_PIPELINE,
     * so lws gives it its own connection and sends "Connection: close". These
     * requests are rare; for h2 it only means a streaming upload does not
     * multiplex onto a shared connection, a negligible cost.
     *
     * A user "Connection: close" request gets the same treatment: the header
     * itself is never sent (see tjs_httpclient_setrequestheader), so the
     * request's own connection is how it is honored — lws sends
     * "connection: close" on h1, and on h2 the dedicated connection carries no
     * connection header at all (it would be malformed there).
     *
     * The one retry of a request (httpclient_should_retry) gets its own
     * connection too, so it can't be queued behind, fail with, or race the
     * idle close of another connection again. */
    cci.ssl_connection = (use_ssl ? LCCSCF_USE_SSL : 0) | h->ssl_flags | LCCSCF_HTTP_NO_FOLLOW_REDIRECT |
                         LCCSCF_H2_QUIRK_OVERFLOWS_TXCR | LCCSCF_H2_QUIRK_NGHTTP2_END_STREAM |
                         (h->streaming || h->conn_close || h->retried ? 0 : LCCSCF_PIPELINE);
    cci.method = h->method;
    cci.local_protocol_name = TJS_LWS_HTTP_PROTOCOL_NAME;
    cci.userdata = h;
    cci.pwsi = &h->wsi;
    cci.vhost = tjs__lws_select_vhost(ctx, uri->scheme, uri->host, uri->port);

    /* HTTP/3 is handled entirely inside lws: it learns an origin's h3 Alt-Svc
     * from its responses, races QUIC-first on a later cold connect, falls back
     * to TCP if QUIC does not answer, and cools down failed origins itself.
     *
     * The ALPN list is per connection: lws's TLS client offers only this list,
     * never the vhost's. It must name h3, or lws takes it as pinning the
     * protocol and never upgrades the origin to h3 (upstream 4761cafff); h3 is
     * kept off the TCP handshake itself by
     * patches/lws-mbedtls-client-no-h3-alpn-over-tcp.patch. */
    cci.alpn = "h2,http/1.1,h3";

    struct lws *wsi = lws_client_connect_via_info(&cci);

    lws_parse_uri_destroy(&uri);

    if (!wsi) {
        h->wsi = NULL;
        return -1;
    }

    lws_cancel_service(lws_ctx);

    httpclient_arm_timer(h, wsi);

    return 0;
}

static JSValue tjs_httpclient_open(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }

    if (h->sent) {
        return JS_ThrowTypeError(ctx, "Request already sent");
    }

    const char *method_str = JS_ToCString(ctx, argv[0]);
    const char *url_str = JS_ToCString(ctx, argv[1]);

    if (!method_str || !url_str) {
        JS_FreeCString(ctx, method_str);
        JS_FreeCString(ctx, url_str);
        return JS_EXCEPTION;
    }

    h->method = js_strdup(ctx, method_str);
    h->url_str = js_strdup(ctx, url_str);
    JS_FreeValue(ctx, h->url);
    h->url = JS_NewString(ctx, url_str);

    JS_FreeCString(ctx, method_str);
    JS_FreeCString(ctx, url_str);

    /* Optional body argument (non-streaming). */
    if (argc >= 3 && !JS_IsNull(argv[2]) && !JS_IsUndefined(argv[2])) {
        if (tjs_httpclient_buffer_data(h, argv[2])) {
            return JS_EXCEPTION;
        }
        h->body_done = true;
    }

    /* Prevent GC while request is in flight. */
    tjs__handle_pin(ctx, &h->pin, this_val);
    h->sent = true;

    /* The loop reference and the start time (the user timeout counts from it)
     * span a retry on a fresh connection, so they are taken here. */
    tjs__lws_conn_ref(ctx);
    h->start_us = lws_now_usecs();

    if (tjs_httpclient_connect(h)) {
        tjs__lws_conn_unref(ctx);
        h->sent = false;
        tjs__handle_unpin(ctx, &h->pin);
        return JS_ThrowPlainError(ctx, "Connection failed");
    }

    return JS_UNDEFINED;
}

/* Connection-specific (hop-by-hop) request headers are not passed through: on
 * h2 they make the message malformed (RFC 9113 §8.2.2) and the peer answers
 * with GOAWAY, failing every stream on the pooled connection; on h1 the
 * runtime owns connection management and body framing. "Connection: close" is
 * remembered and honored at connect. "TE: trailers" is the one legal TE; its
 * value is sent in lowercase because h2 peers (lws among them) compare it
 * case-sensitively and answer anything else with GOAWAY.
 *
 * Returns the value to send, or NULL to drop the header. */
static const char *httpclient_filter_request_header(TJSHttpClient *h, const char *name, const char *value) {
    if (!strcasecmp(name, "Connection")) {
        if (value && connection_has_close(value)) {
            h->conn_close = true;
        }
        return NULL;
    }

    if (!strcasecmp(name, "Keep-Alive") || !strcasecmp(name, "Proxy-Connection") || !strcasecmp(name, "Upgrade") ||
        !strcasecmp(name, "Transfer-Encoding")) {
        return NULL;
    }

    if (!strcasecmp(name, "TE")) {
        if (!value) {
            return NULL;
        }
        while (*value == ' ' || *value == '\t') {
            value++;
        }
        size_t len = strlen(value);
        while (len > 0 && (value[len - 1] == ' ' || value[len - 1] == '\t')) {
            len--;
        }
        return len == 8 && !strncasecmp(value, "trailers", 8) ? "trailers" : NULL;
    }

    return value ? value : "";
}

static JSValue tjs_httpclient_setrequestheader(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }
    if (!JS_IsString(argv[0])) {
        return JS_UNDEFINED;
    }
    const char *h_name = JS_ToCString(ctx, argv[0]);
    if (!h_name) {
        return JS_EXCEPTION;
    }
    const char *h_value = NULL;
    if (!JS_IsUndefined(argv[1])) {
        h_value = JS_ToCString(ctx, argv[1]);
    }

    const char *value = httpclient_filter_request_header(h, h_name, h_value);
    if (value) {
        tbuf_printf(&h->req_headers, "%s: %s\r\n", h_name, value);
    }

    JS_FreeCString(ctx, h_name);
    if (h_value) {
        JS_FreeCString(ctx, h_value);
    }
    return JS_UNDEFINED;
}

static JSValue tjs_httpclient_set_enable_cookies(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }

    if (JS_ToBool(ctx, argv[0])) {
        h->ssl_flags |= LCCSCF_CACHE_COOKIES;
    } else {
        h->ssl_flags &= ~LCCSCF_CACHE_COOKIES;
    }
    return JS_UNDEFINED;
}

/* The wsi to make writable for more of a streaming body. A mux body is written
 * on its h2/h3 stream wsi, not h->wsi: that is what lws returned at connect,
 * which on h2/h3 is the network connection, and making it writable never
 * reaches the stream. */
static struct lws *httpclient_body_wsi(TJSHttpClient *h) {
    return h->mux_body ? h->mux_wsi : h->wsi;
}

static JSValue tjs_httpclient_senddata(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }

    JSValue arg = argv[0];
    struct lws *body_wsi = httpclient_body_wsi(h);

    if (JS_IsNull(arg) || JS_IsUndefined(arg)) {
        /* Signal end of body (streaming). */
        if (!h->body_done) {
            h->body_done = true;
            if (body_wsi) {
                lws_callback_on_writable(body_wsi);
            }
        }
    } else {
        /* Buffer body data and schedule a write. */
        if (tjs_httpclient_buffer_data(h, arg)) {
            return JS_EXCEPTION;
        }
        if (body_wsi) {
            lws_callback_on_writable(body_wsi);
        }
    }

    return JS_UNDEFINED;
}

static JSValue tjs_httpclient_abort(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }

    if (h->retry_pending && !h->completed) {
        /* Between a queued request's close and its retry it has no wsi. */
        h->completed = true;
        JSValue error = JS_NewString(ctx, "ABORTED");
        maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 1, &error);
        httpclient_teardown(h, NULL);
    } else if (h->wsi && !h->completed) {
        h->completed = true;

        struct lws *wsi = h->wsi;

        lws_set_timer_usecs(wsi, LWS_SET_TIMER_USEC_CANCEL);

        JSValue error = JS_NewString(ctx, "ABORTED");
        maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 1, &error);

        /* Mark the WSI to be closed at the next loop iteration. Abort can be
         * driven from a microtask drained *inside* this wsi's own service
         * callback (e.g. a streaming fetch aborted from its ReadableStream
         * cancel()): LWS_TO_KILL_SYNC would free the wsi inline while lws is
         * still using it further up the stack (heap-use-after-free). ASYNC
         * defers the close to a safe point in lws's service loop. The teardown
         * callback chain will handle cleanup — do not access h afterwards. */
        lws_set_timeout(wsi, PENDING_TIMEOUT_USER_OK, LWS_TO_KILL_ASYNC);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_httpclient_set_allow_insecure(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }

    if (JS_ToBool(ctx, argv[0])) {
        h->ssl_flags |= LCCSCF_ALLOW_INSECURE;
    } else {
        h->ssl_flags &= ~LCCSCF_ALLOW_INSECURE;
    }
    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_httpclient_proto_funcs[] = {
    JS_CGETSET_MAGIC_DEF("onstatus", tjs_httpclient_callback_get, tjs_httpclient_callback_set, HC_CALLBACK_STATUS),
    JS_CGETSET_MAGIC_DEF("onurl", tjs_httpclient_callback_get, tjs_httpclient_callback_set, HC_CALLBACK_URL),
    JS_CGETSET_MAGIC_DEF("onheader", tjs_httpclient_callback_get, tjs_httpclient_callback_set, HC_CALLBACK_HEADER),
    JS_CGETSET_MAGIC_DEF("onheadersend",
                         tjs_httpclient_callback_get,
                         tjs_httpclient_callback_set,
                         HC_CALLBACK_HEADERSCOMPLETE),
    JS_CGETSET_MAGIC_DEF("ondata", tjs_httpclient_callback_get, tjs_httpclient_callback_set, HC_CALLBACK_DATA),
    JS_CGETSET_MAGIC_DEF("oncomplete", tjs_httpclient_callback_get, tjs_httpclient_callback_set, HC_CALLBACK_COMPLETE),
    JS_CGETSET_MAGIC_DEF("ondrain", tjs_httpclient_callback_get, tjs_httpclient_callback_set, HC_CALLBACK_DRAIN),
    JS_CGETSET_DEF("timeout", tjs_httpclient_timeout_get, tjs_httpclient_timeout_set),
    JS_CGETSET_DEF("streaming", tjs_httpclient_streaming_get, tjs_httpclient_streaming_set),
    TJS_CFUNC_DEF("open", 3, tjs_httpclient_open),
    TJS_CFUNC_DEF("setRequestHeader", 2, tjs_httpclient_setrequestheader),
    TJS_CFUNC_DEF("setEnableCookies", 1, tjs_httpclient_set_enable_cookies),
    TJS_CFUNC_DEF("setAllowInsecure", 1, tjs_httpclient_set_allow_insecure),
    TJS_CFUNC_DEF("sendData", 1, tjs_httpclient_senddata),
    TJS_CFUNC_DEF("abort", 0, tjs_httpclient_abort),
};

void tjs__mod_httpclient_init(JSContext *ctx, JSValue ns) {
    JSValue proto, obj;

    /* HttpClient class */
    CHECK_EQ(tjs__class_register(ctx, TJS_CLASS_HTTPCLIENT, &tjs_httpclient_class), 0);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_httpclient_proto_funcs, countof(tjs_httpclient_proto_funcs));
    JS_SetClassProto(ctx, tjs__class_id(ctx, TJS_CLASS_HTTPCLIENT), proto);

    /* HttpClient constructor */
    obj = JS_NewCFunction2(ctx, tjs_httpclient_constructor, "HttpClient", 0, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, ns, "HttpClient", obj, JS_PROP_C_W_E);
}

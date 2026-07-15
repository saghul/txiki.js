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
    size_t send_offset; /* bytes of send_buf written (non-streaming h2 chunking) */
    bool sent;
    bool streaming;
    bool body_done;
    bool completed;
    bool torn_down;
    bool keepalive; /* connection may be pooled for reuse (decided at headers) */
    unsigned long timeout;
    int ssl_flags;
    JSValue url;
    /* Response decompression. */
    TJSDecompressor *decompressor;
} TJSHttpClient;

static JSClassID tjs_httpclient_class_id;

static void tjs_httpclient_finalizer(JSRuntime *rt, JSValue val) {
    TJSHttpClient *h = JS_GetOpaque(val, tjs_httpclient_class_id);
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
    TJSHttpClient *h = JS_GetOpaque(val, tjs_httpclient_class_id);
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
    return JS_GetOpaque2(ctx, obj, tjs_httpclient_class_id);
}

/* Clear the JS callbacks at teardown (see TJSHandlePin.detach) so the lws close
 * callback dispatches nothing once the context is destroyed. */
static void tjs_httpclient_detach(TJSHandlePin *pin) {
    TJSHttpClient *h = list_entry(pin, TJSHttpClient, pin);
    for (int i = 0; i < HC_CALLBACK_MAX; i++) {
        JS_FreeValue(h->ctx, h->callbacks[i]);
        h->callbacks[i] = JS_UNDEFINED;
    }
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

    if (h->wsi) {
        lws_set_timer_usecs(h->wsi, LWS_SET_TIMER_USEC_CANCEL);
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

    /* Release the self-pin; the finalizer frees callbacks, url, buffers, and the
     * struct itself once JS also lets go. Unpinning also removes h from the
     * teardown registry, so an abnormal-exit drain won't touch it. */
    CHECK(!JS_IsUndefined(h->pin.obj));
    tjs__handle_unpin(h->ctx, &h->pin);
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
        /* Connection is a comma-separated token list; a "close" token anywhere
         * means the peer will not keep the connection alive. */
        const char *p = conn;
        while (*p) {
            while (*p == ' ' || *p == ',') {
                p++;
            }
            if (!strncasecmp(p, "close", 5) && (p[5] == '\0' || p[5] == ' ' || p[5] == ',')) {
                return false;
            }
            while (*p && *p != ',') {
                p++;
            }
        }
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

static void fire_response_headers(TJSHttpClient *h, struct lws *wsi) {
    /* Iterate known tokens. */
    for (int n = 0; n < WSI_TOKEN_COUNT; n++) {
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
        case LWS_CALLBACK_CLIENT_APPEND_HANDSHAKE_HEADER: {
            unsigned char **p = (unsigned char **) in, *end = (*p) + len;

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
                tbuf_putc(&h->req_headers, '\0');
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
                } else {
                    /* Streaming body: use chunked transfer encoding. */
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

            /* Decide reuse now, while the response headers are still parsed: a
             * response that carried "Connection: close" leaves the socket about
             * to be torn down, so it must not be kept warm — the COMPLETED
             * handler returns -1 to close it. Streaming (chunked) request bodies
             * were already kept out of the pool at connect (no LCCSCF_PIPELINE),
             * so there is nothing to evict here. */
            h->keepalive = httpclient_conn_reusable(wsi);

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
                }

                break;
            }

            /* Streaming body (chunked transfer-encoding). */
            if (h->send_buf.size == 0) {
                if (h->body_done) {
                    /* All body data sent — finalize with the terminating chunk. */
                    lws_client_http_body_pending(wsi, 0);
                    uint8_t buf[LWS_PRE + 5];
                    memcpy(buf + LWS_PRE, "0\r\n\r\n", 5);
                    lws_write(wsi, buf + LWS_PRE, 5, LWS_WRITE_HTTP_FINAL);
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
    JSValue obj = JS_NewObjectClass(ctx, tjs_httpclient_class_id);
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
    snprintf(full_path, sizeof(full_path), "/%s", uri->path);

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
     * A streaming (unknown-length) request body is sent chunked, and a
     * keep-alive peer that cannot de-frame a chunked request body would fail to
     * parse the next request on a reused connection (lws itself has no such
     * server-side de-framer). Rather than pool such a connection and evict it
     * afterwards, we keep it out of the pool from the start: no LCCSCF_PIPELINE,
     * so lws gives it its own connection and sends "Connection: close". These
     * requests are rare; for h2 it only means a streaming upload does not
     * multiplex onto a shared connection, a negligible cost. */
    cci.ssl_connection = (use_ssl ? LCCSCF_USE_SSL : 0) | h->ssl_flags | LCCSCF_HTTP_NO_FOLLOW_REDIRECT |
                         LCCSCF_H2_QUIRK_OVERFLOWS_TXCR | LCCSCF_H2_QUIRK_NGHTTP2_END_STREAM |
                         (h->streaming ? 0 : LCCSCF_PIPELINE);
    cci.method = h->method;
    cci.local_protocol_name = TJS_LWS_HTTP_PROTOCOL_NAME;
    cci.userdata = h;
    cci.pwsi = &h->wsi;
    cci.vhost = tjs__lws_select_vhost(ctx, uri->scheme, uri->host, uri->port);

    tjs__lws_conn_ref(ctx);

    struct lws *wsi = lws_client_connect_via_info(&cci);

    lws_parse_uri_destroy(&uri);

    if (!wsi) {
        tjs__lws_conn_unref(ctx);
        h->wsi = NULL;
        return -1;
    }

    lws_cancel_service(lws_ctx);

    if (h->timeout > 0) {
        lws_set_timer_usecs(wsi, (lws_usec_t) h->timeout * LWS_USEC_PER_SEC / 1000);
    }

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

    if (tjs_httpclient_connect(h)) {
        h->sent = false;
        tjs__handle_unpin(ctx, &h->pin);
        return JS_ThrowInternalError(ctx, "Connection failed");
    }

    return JS_UNDEFINED;
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
    const char *h_value = NULL;
    if (!JS_IsUndefined(argv[1])) {
        h_value = JS_ToCString(ctx, argv[1]);
    }

    if (h_value) {
        tbuf_printf(&h->req_headers, "%s: %s\r\n", h_name, h_value);
    } else {
        tbuf_printf(&h->req_headers, "%s: \r\n", h_name);
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

static JSValue tjs_httpclient_senddata(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }

    JSValue arg = argv[0];

    if (JS_IsNull(arg) || JS_IsUndefined(arg)) {
        /* Signal end of body (streaming). */
        if (!h->body_done) {
            h->body_done = true;
            if (h->wsi) {
                lws_callback_on_writable(h->wsi);
            }
        }
    } else {
        /* Buffer body data and schedule a write. */
        if (tjs_httpclient_buffer_data(h, arg)) {
            return JS_EXCEPTION;
        }
        if (h->wsi) {
            lws_callback_on_writable(h->wsi);
        }
    }

    return JS_UNDEFINED;
}

static JSValue tjs_httpclient_abort(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }

    if (h->wsi && !h->completed) {
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
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSValue proto, obj;

    /* HttpClient class */
    JS_NewClassID(rt, &tjs_httpclient_class_id);
    JS_NewClass(rt, tjs_httpclient_class_id, &tjs_httpclient_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_httpclient_proto_funcs, countof(tjs_httpclient_proto_funcs));
    JS_SetClassProto(ctx, tjs_httpclient_class_id, proto);

    /* HttpClient constructor */
    obj = JS_NewCFunction2(ctx, tjs_httpclient_constructor, "HttpClient", 0, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, ns, "HttpClient", obj, JS_PROP_C_W_E);
}

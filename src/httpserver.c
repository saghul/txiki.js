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

#include "../deps/quickjs/list.h"
#include "hash.h"
#include "private.h"
#include "utils.h"

#include <string.h>

#define TJS_HTTP_PROTOCOL_NAME "tjs-http"
#ifndef MIN
#define MIN(a, b) ((a) < (b) ? (a) : (b))
#endif

/*
 * Pending write for streaming responses (modeled after TJSWsPendingWrite in ws.c).
 */
typedef struct {
    struct list_head link;
    uint8_t *data; /* includes LWS_PRE padding before actual data */
    size_t len;    /* length of actual data (not including LWS_PRE) */
    bool is_final;
} TJSHttpPendingWrite;

/*
 * Per-request state, managed by us (not by lws per_session_data_size).
 */
typedef struct TJSHttpRequest {
    UT_hash_handle hh;
    struct lws *wsi;
    uint64_t id;

    /* Request data accumulated during callbacks. */
    JSValue headers_arr; /* flat JS array: [name, value, name, value, ...] */
    TBuf body_buf;
    int method;
    char url[2048];
    char remote_addr[64];
    bool body_complete;

    /* Response state. */
    bool responded;
    bool streaming;
    struct list_head pending_writes;
    uint8_t *response_data; /* includes LWS_PRE padding */
    size_t response_len;    /* total length including LWS_PRE + headers + body */
    size_t response_offset; /* current send offset (relative to start of headers, i.e. LWS_PRE) */
    size_t header_len;      /* length of headers portion */
} TJSHttpRequest;

/*
 * Pending write for WS server connections.
 */
typedef struct {
    struct list_head link;
    uint8_t *data;
    size_t len;
    bool is_text;
} TJSWsServerPendingWrite;

/*
 * Per-WS-connection state (allocated when server.upgrade() is called).
 */
typedef struct TJSWsConnection {
    JSContext *ctx;
    JSValue this_val; /* prevent GC (the JS ws object) */
    JSValue data;     /* ws.data (user-provided per-connection state) */
    struct lws *wsi;
    UT_hash_handle hh; /* for pending_upgrades hash table (keyed by wsi) */
    TBuf recv_buf;
    bool recv_is_binary;
    struct list_head pending_writes;
    uint16_t close_code;
    char close_reason[124];
    char remote_addr[64];
    /* Custom response headers for the 101 upgrade (parallel arrays, consumed in ADD_HEADERS). */
    JSValue header_names;
    JSValue header_values;
} TJSWsConnection;

enum { WS_EVENT_OPEN = 0, WS_EVENT_MESSAGE, WS_EVENT_CLOSE, WS_EVENT_ERROR, WS_EVENT_MAX };

/*
 * Per-upgrade context, lives from HTTP_CONFIRM_UPGRADE until _acceptUpgrade
 * consumes it (or until the end of the synchronous JS call if not consumed).
 */
typedef struct {
    uint64_t id;
    struct lws *wsi;
    UT_hash_handle hh;
    char remote_addr[64];
} TJSUpgradeCtx;

/*
 * Per-server state.
 */
typedef struct {
    JSContext *ctx;
    JSValue callback;                   /* JS onrequest handler */
    JSValue this_val;                   /* prevent GC while listening */
    JSValue ws_callbacks[WS_EVENT_MAX]; /* server-level: open, message, close, error */
    struct lws_vhost *vhost;
    int port;
    bool closed;
    uint64_t next_req_id;
    uint64_t next_upgrade_id;
    TJSHttpRequest *active_requests;   /* uthash table keyed by id */
    TJSUpgradeCtx *upgrade_contexts;   /* uthash table keyed by id */
    TJSWsConnection *pending_upgrades; /* uthash table keyed by wsi */
    /* Mutable protocol name buffer.  During a WS upgrade the name is
     * temporarily swapped to the negotiated subprotocol so that lws's own
     * protocol matching and Sec-WebSocket-Protocol response header work
     * correctly.  Reset in LWS_CALLBACK_ESTABLISHED / rejection. */
    char ws_protocol_name[256];
    /* TLS data, kept alive for the lifetime of the vhost. */
    char *ssl_cert_mem;
    char *ssl_key_mem;
    char *ssl_ca_mem;
    char *ssl_passphrase;
} TJSHttpServer;

static JSClassID tjs_httpserver_class_id;
static JSClassID tjs_wsconn_class_id;

static void tjs_http_req_free(JSRuntime *rt, TJSHttpRequest *req) {
    if (!req) {
        return;
    }
    JS_FreeValueRT(rt, req->headers_arr);
    tbuf_free(&req->body_buf);
    js_free_rt(rt, req->response_data);

    /* Free any pending streaming writes. */
    struct list_head *el, *el1;
    list_for_each_safe(el, el1, &req->pending_writes) {
        TJSHttpPendingWrite *pw = list_entry(el, TJSHttpPendingWrite, link);
        list_del(&pw->link);
        js_free_rt(rt, pw->data);
        js_free_rt(rt, pw);
    }

    js_free_rt(rt, req);
}

static void tjs_wsconn_finalizer(JSRuntime *rt, JSValue val) {
    TJSWsConnection *ws = JS_GetOpaque(val, tjs_wsconn_class_id);
    if (ws) {
        JS_FreeValueRT(rt, ws->data);
        JS_FreeValueRT(rt, ws->header_names);
        JS_FreeValueRT(rt, ws->header_values);

        struct list_head *el, *el1;
        list_for_each_safe(el, el1, &ws->pending_writes) {
            TJSWsServerPendingWrite *pw = list_entry(el, TJSWsServerPendingWrite, link);
            list_del(&pw->link);
            js_free_rt(rt, pw->data);
            js_free_rt(rt, pw);
        }

        tbuf_free(&ws->recv_buf);
        js_free_rt(rt, ws);
    }
}

static void tjs_wsconn_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSWsConnection *ws = JS_GetOpaque(val, tjs_wsconn_class_id);
    if (ws) {
        JS_MarkValue(rt, ws->data, mark_func);
        JS_MarkValue(rt, ws->header_names, mark_func);
        JS_MarkValue(rt, ws->header_values, mark_func);
    }
}

static JSClassDef tjs_wsconn_class = {
    "WsConnection",
    .finalizer = tjs_wsconn_finalizer,
    .gc_mark = tjs_wsconn_mark,
};

static TJSWsConnection *tjs_wsconn_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_wsconn_class_id);
}

static void tjs_httpserver_finalizer(JSRuntime *rt, JSValue val) {
    TJSHttpServer *s = JS_GetOpaque(val, tjs_httpserver_class_id);
    if (s) {
        JS_FreeValueRT(rt, s->callback);

        for (int i = 0; i < WS_EVENT_MAX; i++) {
            JS_FreeValueRT(rt, s->ws_callbacks[i]);
        }

        TJSHttpRequest *req, *tmp;
        HASH_ITER(hh, s->active_requests, req, tmp) {
            HASH_DEL(s->active_requests, req);
            tjs_http_req_free(rt, req);
        }

        /* Release any unconsumed upgrade contexts. */
        TJSUpgradeCtx *uctx, *uctx_tmp;
        HASH_ITER(hh, s->upgrade_contexts, uctx, uctx_tmp) {
            HASH_DEL(s->upgrade_contexts, uctx);
            js_free_rt(rt, uctx);
        }

        /* Release any pending WS upgrades that never completed. */
        TJSWsConnection *ws, *ws_tmp;
        HASH_ITER(hh, s->pending_upgrades, ws, ws_tmp) {
            HASH_DEL(s->pending_upgrades, ws);
            JSValue cls_val = ws->this_val;
            ws->this_val = JS_UNDEFINED;
            JS_FreeValueRT(rt, cls_val);
        }

        js_free_rt(rt, s->ssl_cert_mem);
        js_free_rt(rt, s->ssl_key_mem);
        js_free_rt(rt, s->ssl_ca_mem);
        js_free_rt(rt, s->ssl_passphrase);

        js_free_rt(rt, s);
    }
}

static void tjs_httpserver_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSHttpServer *s = JS_GetOpaque(val, tjs_httpserver_class_id);
    if (s) {
        JS_MarkValue(rt, s->callback, mark_func);
        for (int i = 0; i < WS_EVENT_MAX; i++) {
            JS_MarkValue(rt, s->ws_callbacks[i], mark_func);
        }
    }
}

static JSClassDef tjs_httpserver_class = {
    "HttpServer",
    .finalizer = tjs_httpserver_finalizer,
    .gc_mark = tjs_httpserver_mark,
};

static TJSHttpServer *tjs_httpserver_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_httpserver_class_id);
}

typedef struct {
    JSContext *ctx;
    struct lws *wsi;
    JSValue arr;
    uint32_t idx;
} TJSHeaderCollectCtx;

static void tjs_http_custom_header_cb(const char *name, int nlen, void *opaque) {
    TJSHeaderCollectCtx *hctx = (TJSHeaderCollectCtx *) opaque;

    int total_len = lws_hdr_custom_length(hctx->wsi, name, nlen);
    if (total_len < 0) {
        return;
    }

    size_t buf_size = (size_t) total_len + 1;
    char *val = js_malloc(hctx->ctx, buf_size);
    if (!val) {
        return;
    }

    int vlen = lws_hdr_custom_copy(hctx->wsi, val, (int) buf_size, name, nlen);
    if (vlen >= 0) {
        /* name includes trailing ':', strip it. */
        int name_len = nlen;
        if (name_len > 0 && name[name_len - 1] == ':') {
            name_len--;
        }
        JS_SetPropertyUint32(hctx->ctx, hctx->arr, hctx->idx++, JS_NewStringLen(hctx->ctx, name, name_len));
        JS_SetPropertyUint32(hctx->ctx, hctx->arr, hctx->idx++, JS_NewStringLen(hctx->ctx, val, vlen));
    }

    js_free(hctx->ctx, val);
}

static JSValue tjs_http_collect_headers(JSContext *ctx, struct lws *wsi) {
    JSValue arr = JS_NewArray(ctx);
    uint32_t idx = 0;

    /* Collect well-known headers via lws token iteration. */
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
        char *val = js_malloc(ctx, buf_size);
        if (!val) {
            continue;
        }
        if (lws_hdr_copy(wsi, val, (int) buf_size, n) < 0) {
            js_free(ctx, val);
            continue;
        }
        /* Strip trailing colon from token name. */
        JS_SetPropertyUint32(ctx, arr, idx++, JS_NewStringLen(ctx, tn, tn_len - 1));
        JS_SetPropertyUint32(ctx, arr, idx++, JS_NewString(ctx, val));
        js_free(ctx, val);
    }

    /* Collect custom (unknown) headers. */
    TJSHeaderCollectCtx hctx = { .ctx = ctx, .wsi = wsi, .arr = arr, .idx = idx };
    lws_hdr_custom_name_foreach(wsi, tjs_http_custom_header_cb, &hctx);
    return arr;
}

static const char *tjs_http_method_name(int method_idx) {
    /* clang-format off */
    static const char *method_names[] = {
        [LWSHUMETH_GET] = "GET",
        [LWSHUMETH_POST] = "POST",
        [LWSHUMETH_OPTIONS] = "OPTIONS",
        [LWSHUMETH_PUT] = "PUT",
        [LWSHUMETH_PATCH] = "PATCH",
        [LWSHUMETH_DELETE] = "DELETE",
        [LWSHUMETH_CONNECT] = "CONNECT",
        [LWSHUMETH_HEAD] = "HEAD",
    };
    /* clang-format on */

    if (method_idx >= 0 && method_idx < (int) countof(method_names)) {
        return method_names[method_idx];
    }

    return "GET";
}

/*
 * Invoke the JS onrequest callback with request data.
 */
static void tjs_http_invoke_handler(TJSHttpServer *s, TJSHttpRequest *req) {
    JSContext *ctx = s->ctx;

    JSValue args[7];
    args[0] = JS_NewInt64(ctx, req->id);
    args[1] = JS_NewString(ctx, tjs_http_method_name(req->method));
    args[2] = JS_NewString(ctx, req->url);
    args[3] = JS_DupValue(ctx, req->headers_arr);
    if (req->body_buf.size > 0) {
        args[4] = JS_NewArrayBufferCopy(ctx, req->body_buf.buf, req->body_buf.size);
    } else {
        args[4] = JS_NULL;
    }
    args[5] = JS_NewString(ctx, req->remote_addr);
    args[6] = JS_FALSE; /* not a WS upgrade */

    tjs_call_handler(ctx, s->callback, countof(args), args);

    for (size_t i = 0; i < countof(args); i++) {
        JS_FreeValue(ctx, args[i]);
    }
}

/*
 * LWS HTTP server callback.
 *
 * Handles both HTTP requests and WebSocket connections (after upgrade).
 * We use lws_set_wsi_user / lws_wsi_user to associate per-connection data
 * (TJSHttpRequest or TJSWsConnection) with each wsi.
 * After upgrade, lws rebinds to protocol[0] (this callback) so WS reason
 * codes (ESTABLISHED, RECEIVE, SERVER_WRITEABLE, CLOSED) fire here.
 */
static int tjs_http_callback(struct lws *wsi, enum lws_callback_reasons reason, void *user, void *in, size_t len) {
    /* Get the server from the vhost user pointer. */
    TJSHttpServer *s = NULL;
    struct lws_vhost *vh = lws_get_vhost(wsi);
    if (vh) {
        s = (TJSHttpServer *) lws_get_vhost_user(vh);
    }

    /* If the server is gone, reject everything. */
    if (!s) {
        return 0;
    }


    /* If the server is closed, still allow cleanup callbacks through. */
    if (s->closed) {
        switch (reason) {
            case LWS_CALLBACK_WS_PEER_INITIATED_CLOSE:
            case LWS_CALLBACK_CLOSED:
            case LWS_CALLBACK_CLOSED_HTTP:
            case LWS_CALLBACK_PROTOCOL_DESTROY:
                break;
            default:
                return 0;
        }
    }

    switch (reason) {
        /*
         * WebSocket callbacks (after upgrade).
         */
        case LWS_CALLBACK_ADD_HEADERS: {
            /* Add custom headers to the 101 upgrade response. */
            TJSWsConnection *ws = NULL;
            HASH_FIND_PTR(s->pending_upgrades, &wsi, ws);
            if (!ws || !JS_IsArray(ws->header_names)) {
                break;
            }

            struct lws_process_html_args *args = (struct lws_process_html_args *) in;
            unsigned char **p = (unsigned char **) &args->p;
            unsigned char *end = (unsigned char *) args->p + args->max_len;
            JSContext *ctx = ws->ctx;
            int64_t n_headers;
            JS_GetLength(ctx, ws->header_names, &n_headers);

            for (int64_t i = 0; i < n_headers; i++) {
                JSValue js_name = JS_GetPropertyUint32(ctx, ws->header_names, i);
                JSValue js_value = JS_GetPropertyUint32(ctx, ws->header_values, i);

                const char *name = JS_ToCString(ctx, js_name);
                const char *value = JS_ToCString(ctx, js_value);
                JS_FreeValue(ctx, js_name);
                JS_FreeValue(ctx, js_value);

                if (!name || !value) {
                    JS_FreeCString(ctx, name);
                    JS_FreeCString(ctx, value);
                    return -1;
                }

                /* Skip sec-websocket-protocol — handled via lws protocol name. */
                if (!strcasecmp(name, "sec-websocket-protocol:")) {
                    JS_FreeCString(ctx, name);
                    JS_FreeCString(ctx, value);
                    continue;
                }

                int r = lws_add_http_header_by_name(wsi,
                                                    (const unsigned char *) name,
                                                    (const unsigned char *) value,
                                                    (int) strlen(value),
                                                    p,
                                                    end);
                JS_FreeCString(ctx, name);
                JS_FreeCString(ctx, value);

                if (r) {
                    return -1;
                }
            }

            /* Headers consumed, release them. */
            JS_FreeValue(ctx, ws->header_names);
            JS_FreeValue(ctx, ws->header_values);
            ws->header_names = JS_UNDEFINED;
            ws->header_values = JS_UNDEFINED;
            break;
        }

        case LWS_CALLBACK_ESTABLISHED: {
            /* Restore the protocol name after the upgrade handshake. */
            strncpy(s->ws_protocol_name, TJS_HTTP_PROTOCOL_NAME, sizeof(s->ws_protocol_name));

            TJSWsConnection *ws = NULL;
            HASH_FIND_PTR(s->pending_upgrades, &wsi, ws);
            if (!ws) {
                return -1;
            }
            HASH_DEL(s->pending_upgrades, ws);
            lws_set_wsi_user(wsi, ws);
            tjs__lws_conn_ref(ws->ctx);

            if (JS_IsFunction(ws->ctx, s->ws_callbacks[WS_EVENT_OPEN])) {
                JSValue arg = JS_DupValue(ws->ctx, ws->this_val);
                tjs_call_handler(ws->ctx, s->ws_callbacks[WS_EVENT_OPEN], 1, &arg);
                JS_FreeValue(ws->ctx, arg);
            }
            return 0;
        }

        case LWS_CALLBACK_RECEIVE: {
            TJSWsConnection *ws = (TJSWsConnection *) lws_wsi_user(wsi);
            if (!ws) {
                return -1;
            }

            bool is_binary = (bool) lws_frame_is_binary(wsi);
            bool is_first = (bool) lws_is_first_fragment(wsi);
            bool is_final = (bool) lws_is_final_fragment(wsi);

            if (is_first) {
                ws->recv_buf.size = 0;
                ws->recv_is_binary = is_binary;
            }

            tbuf_put(&ws->recv_buf, in, len);

            if (is_final && lws_remaining_packet_payload(wsi) == 0) {
                JSValue args[2];
                args[0] = JS_DupValue(ws->ctx, ws->this_val);
                if (ws->recv_is_binary) {
                    args[1] = JS_NewArrayBufferCopy(ws->ctx, ws->recv_buf.buf, ws->recv_buf.size);
                } else {
                    args[1] = JS_NewStringLen(ws->ctx, (const char *) ws->recv_buf.buf, ws->recv_buf.size);
                }
                if (JS_IsFunction(ws->ctx, s->ws_callbacks[WS_EVENT_MESSAGE])) {
                    tjs_call_handler(ws->ctx, s->ws_callbacks[WS_EVENT_MESSAGE], 2, args);
                }
                JS_FreeValue(ws->ctx, args[0]);
                JS_FreeValue(ws->ctx, args[1]);
                ws->recv_buf.size = 0;
            }
            return 0;
        }

        case LWS_CALLBACK_SERVER_WRITEABLE: {
            TJSWsConnection *ws = (TJSWsConnection *) lws_wsi_user(wsi);
            if (!ws || list_empty(&ws->pending_writes)) {
                break;
            }

            TJSWsServerPendingWrite *pw = list_entry(ws->pending_writes.next, TJSWsServerPendingWrite, link);

            uint8_t *buf = js_malloc(ws->ctx, LWS_PRE + pw->len);
            if (!buf) {
                break;
            }
            memcpy(buf + LWS_PRE, pw->data, pw->len);

            enum lws_write_protocol wp = pw->is_text ? LWS_WRITE_TEXT : LWS_WRITE_BINARY;
            int n = lws_write(wsi, buf + LWS_PRE, pw->len, wp);
            js_free(ws->ctx, buf);

            if (n < 0) {
                return -1;
            }

            list_del(&pw->link);
            js_free(ws->ctx, pw->data);
            js_free(ws->ctx, pw);

            if (!list_empty(&ws->pending_writes)) {
                lws_callback_on_writable(wsi);
            }
            return 0;
        }

        case LWS_CALLBACK_WS_PEER_INITIATED_CLOSE: {
            TJSWsConnection *ws = (TJSWsConnection *) lws_wsi_user(wsi);
            if (!ws) {
                return 0;
            }
            if (len >= 2) {
                const uint8_t *data = (const uint8_t *) in;
                ws->close_code = (uint16_t) ((data[0] << 8) | data[1]);
                if (len > 2) {
                    size_t rlen = len - 2;
                    if (rlen > sizeof(ws->close_reason) - 1) {
                        rlen = sizeof(ws->close_reason) - 1;
                    }
                    memcpy(ws->close_reason, data + 2, rlen);
                    ws->close_reason[rlen] = '\0';
                }
            }
            return 0;
        }

        case LWS_CALLBACK_CLOSED: {
            TJSWsConnection *ws = (TJSWsConnection *) lws_wsi_user(wsi);
            if (!ws) {
                return 0;
            }

            /* If PEER_INITIATED_CLOSE didn't fire, extract close info from lws. */
            if (!ws->close_code && ws->wsi) {
                int cl_len = lws_get_close_length(wsi);
                if (cl_len >= 2) {
                    const uint8_t *cl_data = lws_get_close_payload(wsi);
                    ws->close_code = (uint16_t) ((cl_data[0] << 8) | cl_data[1]);
                    if (cl_len > 2) {
                        size_t rlen = cl_len - 2;
                        if (rlen > sizeof(ws->close_reason) - 1) {
                            rlen = sizeof(ws->close_reason) - 1;
                        }
                        memcpy(ws->close_reason, cl_data + 2, rlen);
                        ws->close_reason[rlen] = '\0';
                    }
                }
            }

            ws->wsi = NULL;

            uint16_t code = ws->close_code ? ws->close_code : 1005;

            if (JS_IsFunction(ws->ctx, s->ws_callbacks[WS_EVENT_CLOSE])) {
                JSValue args[3];
                args[0] = JS_DupValue(ws->ctx, ws->this_val);
                args[1] = JS_NewInt32(ws->ctx, code);
                args[2] = JS_NewString(ws->ctx, ws->close_reason);
                tjs_call_handler(ws->ctx, s->ws_callbacks[WS_EVENT_CLOSE], 3, args);
                for (int i = 0; i < 3; i++) {
                    JS_FreeValue(ws->ctx, args[i]);
                }
            }

            tjs__lws_conn_unref(ws->ctx);

            JSValue cls_val = ws->this_val;
            ws->this_val = JS_UNDEFINED;
            JS_FreeValue(ws->ctx, cls_val);
            return 0;
        }

        /*
         * HTTP callbacks.
         */
        case LWS_CALLBACK_HTTP_CONFIRM_UPGRADE: {
            /* If no WS message callback registered, reject immediately. */
            if (JS_IsUndefined(s->ws_callbacks[WS_EVENT_MESSAGE])) {
                return -1;
            }

            /* Reset the protocol name before each upgrade attempt, in case a
             * previous upgrade failed after the name was swapped. */
            strncpy(s->ws_protocol_name, TJS_HTTP_PROTOCOL_NAME, sizeof(s->ws_protocol_name));

            JSContext *ctx = s->ctx;

            /* Collect headers (ah still attached). */
            JSValue headers_arr = tjs_http_collect_headers(ctx, wsi);

            char *uri_ptr = NULL;
            int uri_len = 0;
            int method_idx = lws_http_get_uri_and_method(wsi, &uri_ptr, &uri_len);
            const char *method = tjs_http_method_name(method_idx);

            /* Create upgrade context and add to hash table. */
            TJSUpgradeCtx *uctx = js_mallocz(ctx, sizeof(*uctx));
            if (!uctx) {
                JS_FreeValue(ctx, headers_arr);
                return -1;
            }
            uctx->id = s->next_upgrade_id++;
            uctx->wsi = wsi;
            lws_get_peer_simple(wsi, uctx->remote_addr, sizeof(uctx->remote_addr));
            HASH_ADD(hh, s->upgrade_contexts, id, sizeof(uint64_t), uctx);

            uint64_t upgrade_id = uctx->id;

            /* Call JS onRequest synchronously with upgrade ID and WS marker. */
            JSValue args[7];
            args[0] = JS_NewInt64(ctx, (int64_t) upgrade_id);
            args[1] = JS_NewString(ctx, method);
            args[2] = JS_NewStringLen(ctx, uri_ptr, uri_len);
            args[3] = headers_arr;
            args[4] = JS_NULL;
            args[5] = JS_NewString(ctx, uctx->remote_addr);
            args[6] = JS_TRUE; /* marker: this is a WS upgrade request */
            tjs_call_handler(ctx, s->callback, 7, args);
            for (int i = 0; i < 7; i++) {
                JS_FreeValue(ctx, args[i]);
            }

            /* Check if acceptUpgrade added this wsi to pending_upgrades. */
            TJSWsConnection *pending = NULL;
            HASH_FIND_PTR(s->pending_upgrades, &wsi, pending);

            /* Clean up upgrade context if acceptUpgrade didn't consume it. */
            TJSUpgradeCtx *remaining = NULL;
            HASH_FIND(hh, s->upgrade_contexts, &upgrade_id, sizeof(uint64_t), remaining);
            if (remaining) {
                HASH_DEL(s->upgrade_contexts, remaining);
                js_free(ctx, remaining);
            }

            if (pending) {
                return 0; /* allow upgrade → lws sends 101 */
            }
            return -1; /* reject */
        }

        case LWS_CALLBACK_HTTP: {
            /* Allocate per-request state. */
            TJSHttpRequest *req = js_mallocz(s->ctx, sizeof(*req));
            if (!req) {
                return -1;
            }

            lws_set_wsi_user(wsi, req);
            init_list_head(&req->pending_writes);
            req->wsi = wsi;
            req->id = s->next_req_id++;
            tbuf_init(s->ctx, &req->body_buf);

            /* Detect method and URI. */
            char *uri_ptr = NULL;
            int uri_len = 0;
            req->method = lws_http_get_uri_and_method(wsi, &uri_ptr, &uri_len);

            if (uri_ptr && uri_len > 0) {
                size_t copy_len = MIN((size_t) uri_len, sizeof(req->url) - 1);
                size_t copy_query_len = sizeof(req->url) - copy_len - 1;
                memcpy(req->url, uri_ptr, copy_len);

                if (lws_hdr_copy(wsi, req->url + copy_len + 1, copy_query_len, WSI_TOKEN_HTTP_URI_ARGS) > 0) {
                    /* \0 ending is handled by lws_hdr_copy. */
                    req->url[copy_len] = '?';
                } else {
                    req->url[copy_len] = '\0';
                }
            } else if (in) {
                strncpy(req->url, (const char *) in, sizeof(req->url) - 1);
            }

            /* Collect headers. */
            req->headers_arr = tjs_http_collect_headers(s->ctx, wsi);

            /* Get remote address. */
            lws_get_peer_simple(wsi, req->remote_addr, sizeof(req->remote_addr));

            /* Add to active requests hash table. */
            HASH_ADD(hh, s->active_requests, id, sizeof(req->id), req);

            /* Check if this request has a body. */
            char cl[32];
            int has_cl = lws_hdr_copy(wsi, cl, sizeof(cl), WSI_TOKEN_HTTP_CONTENT_LENGTH);
            if (has_cl > 0 && atoi(cl) > 0) {
                /* Body expected, wait for LWS_CALLBACK_HTTP_BODY. */
                return 0;
            }

            /* No body expected. Invoke handler immediately. */
            req->body_complete = true;
            tjs_http_invoke_handler(s, req);
            return 0;
        }

        case LWS_CALLBACK_HTTP_BODY: {
            TJSHttpRequest *req = (TJSHttpRequest *) lws_wsi_user(wsi);
            if (!req) {
                return -1;
            }

            /* Accumulate body chunks. */
            tbuf_put(&req->body_buf, in, len);
            return 0;
        }

        case LWS_CALLBACK_HTTP_BODY_COMPLETION: {
            TJSHttpRequest *req = (TJSHttpRequest *) lws_wsi_user(wsi);
            if (!req) {
                return -1;
            }

            req->body_complete = true;
            tjs_http_invoke_handler(s, req);
            return 0;
        }

        case LWS_CALLBACK_HTTP_WRITEABLE: {
            TJSHttpRequest *req = (TJSHttpRequest *) lws_wsi_user(wsi);
            if (!req) {
                return 0;
            }

            if (req->streaming) {
                /* Streaming path: dequeue and send pending writes. */
                if (list_empty(&req->pending_writes)) {
                    return 0;
                }

                TJSHttpPendingWrite *pw = list_entry(req->pending_writes.next, TJSHttpPendingWrite, link);

                enum lws_write_protocol wp = pw->is_final ? LWS_WRITE_HTTP_FINAL : LWS_WRITE_HTTP;
                int n = lws_write(wsi, pw->data + LWS_PRE, pw->len, wp);

                bool is_final = pw->is_final;
                list_del(&pw->link);
                js_free(s->ctx, pw->data);
                js_free(s->ctx, pw);

                if (n < 0) {
                    return -1;
                }

                if (is_final) {
                    if (lws_http_transaction_completed(wsi)) {
                        return -1;
                    }
                } else if (!list_empty(&req->pending_writes)) {
                    lws_callback_on_writable(wsi);
                }

                return 0;
            }

            /* Buffered path. */
            if (!req->response_data) {
                return 0;
            }

            /* Data layout: [LWS_PRE][headers][body]
             * response_offset starts at header_len (headers already sent).
             * response_len = LWS_PRE + header_len + body_len */
            size_t total_payload = req->response_len - LWS_PRE;
            size_t remaining = total_payload - req->response_offset;
            if (remaining == 0) {
                return -1;
            }

            enum lws_write_protocol wp = LWS_WRITE_HTTP;
            if (req->response_offset + remaining >= total_payload) {
                wp = LWS_WRITE_HTTP_FINAL;
            }
            int n = lws_write(wsi, req->response_data + LWS_PRE + req->response_offset, remaining, wp);
            if (n < 0) {
                return -1;
            }

            req->response_offset += n;

            if (req->response_offset >= total_payload) {
                if (lws_http_transaction_completed(wsi)) {
                    return -1;
                }
            } else {
                lws_callback_on_writable(wsi);
            }

            return 0;
        }

        case LWS_CALLBACK_CLOSED_HTTP: {
            TJSHttpRequest *req = (TJSHttpRequest *) lws_wsi_user(wsi);
            if (!req) {
                return 0;
            }

            HASH_DEL(s->active_requests, req);
            tjs_http_req_free(JS_GetRuntime(s->ctx), req);
            lws_set_wsi_user(wsi, NULL);
            return 0;
        }

        case LWS_CALLBACK_PROTOCOL_DESTROY: {
            /* lws is fully done with this vhost/protocol. Release the
             * GC-prevention self-reference so the object can be collected. */
            if (!JS_IsUndefined(s->this_val)) {
                JSValue this_val = s->this_val;
                s->this_val = JS_UNDEFINED;
                JS_FreeValue(s->ctx, this_val);
            }
            return 0;
        }

        default:
            break;
    }

    return 0;
}

/*
 * HttpServer.prototype._acceptUpgrade(upgradeId, data, headerNames, headerValues)
 *
 * Called from JS server.upgrade(). Looks up the upgrade context by ID,
 * allocates a TJSWsConnection, and adds it to the pending_upgrades hash.
 */
static JSValue tjs_httpserver_accept_upgrade(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpServer *s = tjs_httpserver_get(ctx, this_val);
    if (!s) {
        return JS_FALSE;
    }

    /* Look up the upgrade context by ID. */
    int64_t id_val;
    if (JS_ToInt64(ctx, &id_val, argv[0])) {
        return JS_EXCEPTION;
    }
    uint64_t upgrade_id = (uint64_t) id_val;

    TJSUpgradeCtx *uctx = NULL;
    HASH_FIND(hh, s->upgrade_contexts, &upgrade_id, sizeof(uint64_t), uctx);
    if (!uctx) {
        return JS_FALSE;
    }

    /* Check this wsi isn't already pending (double upgrade() call). */
    TJSWsConnection *existing = NULL;
    HASH_FIND_PTR(s->pending_upgrades, &uctx->wsi, existing);
    if (existing) {
        return JS_FALSE;
    }

    TJSWsConnection *ws = js_mallocz(ctx, sizeof(*ws));
    if (!ws) {
        return JS_EXCEPTION;
    }

    ws->ctx = ctx;
    ws->this_val = JS_UNDEFINED;
    ws->wsi = uctx->wsi;
    ws->data = JS_DupValue(ctx, argv[1]);
    ws->header_names = JS_UNDEFINED;
    ws->header_values = JS_UNDEFINED;
    tbuf_init(ctx, &ws->recv_buf);
    init_list_head(&ws->pending_writes);

    /* Optional header arrays (argv[2] = names, argv[3] = values). */
    if (argc > 3 && JS_IsArray(argv[2])) {
        ws->header_names = JS_DupValue(ctx, argv[2]);
        ws->header_values = JS_DupValue(ctx, argv[3]);

        /* Check if sec-websocket-protocol is among the headers.
         * If so, swap the lws protocol name so lws's own protocol matching
         * and response header generation work correctly. */
        int64_t n_headers;
        JS_GetLength(ctx, ws->header_names, &n_headers);
        for (int64_t i = 0; i < n_headers; i++) {
            JSValue js_name = JS_GetPropertyUint32(ctx, ws->header_names, i);
            const char *name = JS_ToCString(ctx, js_name);
            JS_FreeValue(ctx, js_name);
            if (name && !strcasecmp(name, "sec-websocket-protocol:")) {
                JSValue js_value = JS_GetPropertyUint32(ctx, ws->header_values, i);
                const char *value = JS_ToCString(ctx, js_value);
                JS_FreeValue(ctx, js_value);
                if (value) {
                    strncpy(s->ws_protocol_name, value, sizeof(s->ws_protocol_name) - 1);
                    s->ws_protocol_name[sizeof(s->ws_protocol_name) - 1] = '\0';
                }
                JS_FreeCString(ctx, value);
            }
            JS_FreeCString(ctx, name);
        }
    }

    /* Create JS object. */
    JSValue ws_obj = JS_NewObjectClass(ctx, tjs_wsconn_class_id);
    if (JS_IsException(ws_obj)) {
        JS_FreeValue(ctx, ws->data);
        tbuf_free(&ws->recv_buf);
        js_free(ctx, ws);
        return JS_EXCEPTION;
    }
    JS_SetOpaque(ws_obj, ws);
    ws->this_val = JS_DupValue(ctx, ws_obj);

    /* Copy remote_addr from upgrade context. */
    strncpy(ws->remote_addr, uctx->remote_addr, sizeof(ws->remote_addr) - 1);
    ws->remote_addr[sizeof(ws->remote_addr) - 1] = '\0';

    /* Consume the upgrade context. */
    HASH_DEL(s->upgrade_contexts, uctx);
    js_free(ctx, uctx);

    HASH_ADD_PTR(s->pending_upgrades, wsi, ws);
    JS_FreeValue(ctx, ws_obj);
    return JS_TRUE;
}

/*
 * HttpServer constructor: new HttpServer(options)
 *
 * Options object (constructed by JS layer, properties are guaranteed):
 *   port: number
 *   listenIp: string
 *   onRequest: function
 *   wsOpen: function | null
 *   wsMessage: function | null
 *   wsClose: function | null
 *   wsError: function | null
 *   certPem: string | null  (TLS certificate PEM)
 *   keyPem: string | null   (TLS private key PEM)
 *   caPem: string | null    (TLS CA certificate PEM, for client cert verification)
 *   passphrase: string | null (passphrase for encrypted private key)
 *   requestCert: boolean    (require client certificate)
 */
static JSValue tjs_httpserver_constructor(JSContext *ctx, JSValue new_target, int argc, JSValue *argv) {
    JSValue obj = JS_NewObjectClass(ctx, tjs_httpserver_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSHttpServer *s = js_mallocz(ctx, sizeof(*s));
    if (!s) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    s->ctx = ctx;
    s->callback = JS_UNDEFINED;
    s->this_val = JS_UNDEFINED;
    for (int i = 0; i < WS_EVENT_MAX; i++) {
        s->ws_callbacks[i] = JS_UNDEFINED;
    }
    s->active_requests = NULL;
    s->ssl_cert_mem = NULL;
    s->ssl_key_mem = NULL;
    s->ssl_ca_mem = NULL;
    s->ssl_passphrase = NULL;

    JSValue options = argv[0];

    /* Required properties — JS layer guarantees these. */
    JSValue js_port = JS_GetPropertyStr(ctx, options, "port");
    int port;
    CHECK_EQ(JS_ToInt32(ctx, &port, js_port), 0);
    JS_FreeValue(ctx, js_port);

    JSValue js_listen_ip = JS_GetPropertyStr(ctx, options, "listenIp");
    const char *listen_ip = JS_ToCString(ctx, js_listen_ip);
    CHECK_NOT_NULL(listen_ip);
    JS_FreeValue(ctx, js_listen_ip);

    JSValue js_callback = JS_GetPropertyStr(ctx, options, "onRequest");
    CHECK(JS_IsFunction(ctx, js_callback));
    s->callback = js_callback; /* already a new reference from GetPropertyStr */
    s->port = port;

    /* WS callbacks (may be null). */
    static const char *ws_prop_names[] = { "wsOpen", "wsMessage", "wsClose", "wsError" };
    for (int i = 0; i < WS_EVENT_MAX; i++) {
        JSValue cb = JS_GetPropertyStr(ctx, options, ws_prop_names[i]);
        if (JS_IsFunction(ctx, cb)) {
            s->ws_callbacks[i] = cb;
        } else {
            JS_FreeValue(ctx, cb);
        }
    }

    /* Optional TLS options. */
    JSValue js_cert = JS_GetPropertyStr(ctx, options, "certPem");
    JSValue js_key = JS_GetPropertyStr(ctx, options, "keyPem");

    bool use_tls = JS_IsString(js_cert) && JS_IsString(js_key);

    if (use_tls) {
        const char *cert_str = JS_ToCString(ctx, js_cert);
        const char *key_str = JS_ToCString(ctx, js_key);
        CHECK_NOT_NULL(cert_str);
        CHECK_NOT_NULL(key_str);

        s->ssl_cert_mem = js_strdup(ctx, cert_str);
        s->ssl_key_mem = js_strdup(ctx, key_str);
        JS_FreeCString(ctx, cert_str);
        JS_FreeCString(ctx, key_str);

        /* CA certificate for client cert verification. */
        JSValue js_ca = JS_GetPropertyStr(ctx, options, "caPem");
        if (JS_IsString(js_ca)) {
            const char *ca_str = JS_ToCString(ctx, js_ca);
            CHECK_NOT_NULL(ca_str);
            s->ssl_ca_mem = js_strdup(ctx, ca_str);
            JS_FreeCString(ctx, ca_str);
        }
        JS_FreeValue(ctx, js_ca);

        /* Passphrase for encrypted private key. */
        JSValue js_passphrase = JS_GetPropertyStr(ctx, options, "passphrase");
        if (JS_IsString(js_passphrase)) {
            const char *pp_str = JS_ToCString(ctx, js_passphrase);
            CHECK_NOT_NULL(pp_str);
            s->ssl_passphrase = js_strdup(ctx, pp_str);
            JS_FreeCString(ctx, pp_str);
        }
        JS_FreeValue(ctx, js_passphrase);
    }

    JS_FreeValue(ctx, js_cert);
    JS_FreeValue(ctx, js_key);

    strncpy(s->ws_protocol_name, TJS_HTTP_PROTOCOL_NAME, sizeof(s->ws_protocol_name));

    JS_SetOpaque(obj, s);

    /* Create lws vhost for this server. */
    struct lws_context *lws_ctx = tjs__lws_get_context(ctx);
    if (!lws_ctx) {
        JS_FreeCString(ctx, listen_ip);
        JS_FreeValue(ctx, obj);
        return JS_ThrowInternalError(ctx, "failed to get lws context");
    }

    /* Use a mutable protocol name so we can swap it during WS upgrades
     * to match the negotiated subprotocol. */
    struct lws_protocols protocols[] = {
        { .name = s->ws_protocol_name, .callback = tjs_http_callback, .per_session_data_size = 0, .rx_buffer_size = 0 },
        LWS_PROTOCOL_LIST_TERM,
    };

    struct lws_context_creation_info vhost_info;
    memset(&vhost_info, 0, sizeof(vhost_info));
    vhost_info.port = port;
    vhost_info.iface = listen_ip;
    vhost_info.protocols = protocols;
    vhost_info.user = s;
    vhost_info.vhost_name = "tjs-http-server";
    vhost_info.options = 0;

    /* Configure TLS if cert/key were provided. */
    if (use_tls) {
        vhost_info.options |= LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT;
        vhost_info.server_ssl_cert_mem = s->ssl_cert_mem;
        vhost_info.server_ssl_cert_mem_len = (unsigned int) strlen(s->ssl_cert_mem);
        vhost_info.server_ssl_private_key_mem = s->ssl_key_mem;
        vhost_info.server_ssl_private_key_mem_len = (unsigned int) strlen(s->ssl_key_mem);

        if (s->ssl_ca_mem) {
            vhost_info.server_ssl_ca_mem = s->ssl_ca_mem;
            vhost_info.server_ssl_ca_mem_len = (unsigned int) strlen(s->ssl_ca_mem);
        }

        if (s->ssl_passphrase) {
            vhost_info.ssl_private_key_password = s->ssl_passphrase;
        }

        /* Client certificate requirement. */
        JSValue js_request_cert = JS_GetPropertyStr(ctx, options, "requestCert");
        if (JS_ToBool(ctx, js_request_cert)) {
            vhost_info.options |= LWS_SERVER_OPTION_REQUIRE_VALID_OPENSSL_CLIENT_CERT;
        }
        JS_FreeValue(ctx, js_request_cert);
    }

    s->vhost = lws_create_vhost(lws_ctx, &vhost_info);

    JS_FreeCString(ctx, listen_ip);

    if (!s->vhost) {
        JS_FreeValue(ctx, obj);
        return JS_ThrowInternalError(ctx, "failed to create HTTP server vhost");
    }

    /* Get the actual port (in case port 0 was used for auto-assignment). */
    s->port = lws_get_vhost_port(s->vhost);

    /* Prevent GC while server is active. */
    s->this_val = JS_DupValue(ctx, obj);

    /* Kick lws service loop. */
    lws_cancel_service(lws_ctx);

    return obj;
}

/*
 * HttpServer.prototype.close()
 */
static JSValue tjs_httpserver_close(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpServer *s = tjs_httpserver_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }

    s->closed = true;

    if (s->vhost) {
        lws_vhost_destroy(s->vhost);
        s->vhost = NULL;
    }

    /* Release callback references to break reference cycles.
     * The server struct must stay alive (via this_val) until lws
     * fires PROTOCOL_DESTROY, so we only release callbacks here. */
    JS_FreeValue(ctx, s->callback);
    s->callback = JS_UNDEFINED;

    for (int i = 0; i < WS_EVENT_MAX; i++) {
        JS_FreeValue(ctx, s->ws_callbacks[i]);
        s->ws_callbacks[i] = JS_UNDEFINED;
    }

    return JS_UNDEFINED;
}

/*
 * Find a request by ID in the server's active requests hash table.
 */
static TJSHttpRequest *tjs_http_find_request(TJSHttpServer *s, uint64_t req_id) {
    TJSHttpRequest *req = NULL;
    HASH_FIND(hh, s->active_requests, &req_id, sizeof(req_id), req);
    return req;
}

/* Max size for response header buffer.  Matches Node.js / Deno default. */
#define TJS_MAX_HEADER_SIZE 16384

/*
 * HttpServer.prototype.sendResponse(requestId, status, headersArray, bodyBuffer)
 *
 * headersArray: [[name, value], ...]
 * bodyBuffer: ArrayBuffer, TypedArray, or null
 */
static JSValue tjs_httpserver_send_response(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpServer *s = tjs_httpserver_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }

    /* Find the request by ID. */
    int64_t req_id;
    if (JS_ToInt64(ctx, &req_id, argv[0])) {
        return JS_EXCEPTION;
    }

    TJSHttpRequest *req = tjs_http_find_request(s, req_id);

    if (!req || req->responded) {
        return JS_UNDEFINED; /* Request already handled or gone. */
    }

    req->responded = true;

    /* Parse status. */
    int status;
    if (JS_ToInt32(ctx, &status, argv[1])) {
        return JS_EXCEPTION;
    }

    /* Build response headers with LWS_PRE padding. */
    size_t hdr_buf_size = LWS_PRE + TJS_MAX_HEADER_SIZE;
    unsigned char *header_buf = js_malloc(ctx, hdr_buf_size);
    if (!header_buf) {
        return JS_ThrowOutOfMemory(ctx);
    }
    unsigned char *start = &header_buf[LWS_PRE];
    unsigned char *p = start;
    unsigned char *end = header_buf + hdr_buf_size - 1;

    if (lws_add_http_header_status(req->wsi, (unsigned int) status, &p, end)) {
        js_free(ctx, header_buf);
        return JS_ThrowInternalError(ctx, "failed to add status header");
    }

    /* Iterate headers array. */
    if (JS_IsArray(argv[2])) {
        int64_t headers_len;
        JS_GetLength(ctx, argv[2], &headers_len);

        for (int64_t i = 0; i < headers_len; i++) {
            JSValue pair = JS_GetPropertyUint32(ctx, argv[2], i);
            JSValue name_val = JS_GetPropertyUint32(ctx, pair, 0);
            JSValue value_val = JS_GetPropertyUint32(ctx, pair, 1);

            const char *name = JS_ToCString(ctx, name_val);
            size_t value_len;
            const char *value = JS_ToCStringLen(ctx, &value_len, value_val);

            if (name && value) {
                if (lws_add_http_header_by_name(req->wsi,
                                                (const unsigned char *) name,
                                                (const unsigned char *) value,
                                                (int) value_len,
                                                &p,
                                                end)) {
                    JS_FreeCString(ctx, name);
                    JS_FreeCString(ctx, value);
                    JS_FreeValue(ctx, name_val);
                    JS_FreeValue(ctx, value_val);
                    JS_FreeValue(ctx, pair);
                    js_free(ctx, header_buf);
                    return JS_ThrowInternalError(ctx, "failed to add response header");
                }
            }

            JS_FreeCString(ctx, name);
            JS_FreeCString(ctx, value);
            JS_FreeValue(ctx, name_val);
            JS_FreeValue(ctx, value_val);
            JS_FreeValue(ctx, pair);
        }
    }

    /* Get body (can be ArrayBuffer or TypedArray). */
    uint8_t *body_data = NULL;
    size_t body_len = 0;
    size_t body_offset = 0;
    size_t body_bpe = 0;
    JSValue body_ab = JS_UNDEFINED;
    if (!JS_IsNull(argv[3]) && !JS_IsUndefined(argv[3])) {
        body_data = JS_GetArrayBuffer(ctx, &body_len, argv[3]);
        if (!body_data) {
            /* Try as TypedArray. */
            JS_FreeValue(ctx, JS_GetException(ctx)); /* Clear the error. */
            body_ab = JS_GetTypedArrayBuffer(ctx, argv[3], &body_offset, &body_len, &body_bpe);
            if (!JS_IsException(body_ab)) {
                size_t ab_len;
                body_data = JS_GetArrayBuffer(ctx, &ab_len, body_ab);
                if (body_data) {
                    body_data += body_offset;
                }
            }
        }
    }

    /* Add content-length. */
    if (lws_add_http_header_content_length(req->wsi, (lws_filepos_t) body_len, &p, end)) {
        js_free(ctx, header_buf);
        return JS_ThrowInternalError(ctx, "failed to add content-length header");
    }

    /* Finalize headers. */
    if (lws_finalize_http_header(req->wsi, &p, end)) {
        js_free(ctx, header_buf);
        return JS_ThrowInternalError(ctx, "failed to finalize headers");
    }

    size_t hdr_len = p - start;

    /* Allocate response buffer: LWS_PRE + headers + body. */
    req->response_data = js_malloc(ctx, LWS_PRE + hdr_len + body_len);
    if (!req->response_data) {
        JS_FreeValue(ctx, body_ab);
        js_free(ctx, header_buf);
        return JS_ThrowOutOfMemory(ctx);
    }

    memcpy(req->response_data + LWS_PRE, start, hdr_len);
    js_free(ctx, header_buf);
    if (body_data && body_len > 0) {
        memcpy(req->response_data + LWS_PRE + hdr_len, body_data, body_len);
    }
    req->response_len = LWS_PRE + hdr_len + body_len;
    req->header_len = hdr_len;
    req->response_offset = 0;

    JS_FreeValue(ctx, body_ab);

    /* First write: send headers (with LWS_PRE padding). */
    int n = lws_write(req->wsi, req->response_data + LWS_PRE, hdr_len, LWS_WRITE_HTTP_HEADERS);
    if (n < 0) {
        return JS_ThrowInternalError(ctx, "failed to write response headers");
    }
    req->response_offset = hdr_len;

    /* Schedule writable callback for body. */
    if (body_len > 0) {
        lws_callback_on_writable(req->wsi);
    } else {
        /* No body, complete the transaction. */
        if (lws_http_transaction_completed(req->wsi)) {
            return JS_UNDEFINED;
        }
    }

    return JS_UNDEFINED;
}

/*
 * HttpServer.prototype.sendHeaders(requestId, status, headersArray)
 *
 * Send only the HTTP headers for a streaming response (no Content-Length).
 */
static JSValue tjs_httpserver_send_headers(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpServer *s = tjs_httpserver_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }

    int64_t req_id;
    if (JS_ToInt64(ctx, &req_id, argv[0])) {
        return JS_EXCEPTION;
    }

    TJSHttpRequest *req = tjs_http_find_request(s, req_id);
    if (!req || req->responded) {
        return JS_UNDEFINED;
    }

    req->responded = true;
    req->streaming = true;

    int status;
    if (JS_ToInt32(ctx, &status, argv[1])) {
        return JS_EXCEPTION;
    }

    /* Build headers with LWS_PRE padding. */
    size_t hdr_buf_size = LWS_PRE + TJS_MAX_HEADER_SIZE;
    unsigned char *header_buf = js_malloc(ctx, hdr_buf_size);
    if (!header_buf) {
        return JS_ThrowOutOfMemory(ctx);
    }
    unsigned char *start = &header_buf[LWS_PRE];
    unsigned char *p = start;
    unsigned char *end = header_buf + hdr_buf_size - 1;

    /* Status line without Content-Length (streaming / unknown size). */
    if (lws_add_http_common_headers(req->wsi, (unsigned int) status, NULL, LWS_ILLEGAL_HTTP_CONTENT_LEN, &p, end)) {
        js_free(ctx, header_buf);
        return JS_ThrowInternalError(ctx, "failed to add status header");
    }

    /* Add custom headers from the array. */
    if (JS_IsArray(argv[2])) {
        int64_t headers_len;
        JS_GetLength(ctx, argv[2], &headers_len);

        for (int64_t i = 0; i < headers_len; i++) {
            JSValue pair = JS_GetPropertyUint32(ctx, argv[2], i);
            JSValue name_val = JS_GetPropertyUint32(ctx, pair, 0);
            JSValue value_val = JS_GetPropertyUint32(ctx, pair, 1);

            const char *name = JS_ToCString(ctx, name_val);
            size_t value_len;
            const char *value = JS_ToCStringLen(ctx, &value_len, value_val);

            if (name && value) {
                if (lws_add_http_header_by_name(req->wsi,
                                                (const unsigned char *) name,
                                                (const unsigned char *) value,
                                                (int) value_len,
                                                &p,
                                                end)) {
                    JS_FreeCString(ctx, name);
                    JS_FreeCString(ctx, value);
                    JS_FreeValue(ctx, name_val);
                    JS_FreeValue(ctx, value_val);
                    JS_FreeValue(ctx, pair);
                    js_free(ctx, header_buf);
                    return JS_ThrowInternalError(ctx, "failed to add response header");
                }
            }

            JS_FreeCString(ctx, name);
            JS_FreeCString(ctx, value);
            JS_FreeValue(ctx, name_val);
            JS_FreeValue(ctx, value_val);
            JS_FreeValue(ctx, pair);
        }
    }

    /* Finalize and write headers in one call. */
    if (lws_finalize_write_http_header(req->wsi, start, &p, end)) {
        js_free(ctx, header_buf);
        return JS_ThrowInternalError(ctx, "failed to write response headers");
    }

    js_free(ctx, header_buf);
    return JS_UNDEFINED;
}

/*
 * HttpServer.prototype.sendBody(requestId, data, isFinal)
 *
 * Queue a body chunk for a streaming response.
 * data: Uint8Array/ArrayBuffer or null (for final empty chunk).
 * isFinal: boolean, true if this is the last chunk.
 */
static JSValue tjs_httpserver_send_body(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpServer *s = tjs_httpserver_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }

    int64_t req_id;
    if (JS_ToInt64(ctx, &req_id, argv[0])) {
        return JS_EXCEPTION;
    }

    TJSHttpRequest *req = tjs_http_find_request(s, req_id);
    if (!req) {
        return JS_UNDEFINED; /* Connection already closed, silently ignore. */
    }

    bool is_final = JS_ToBool(ctx, argv[2]);

    /* Get body data (can be null for final empty chunk). */
    uint8_t *data = NULL;
    size_t data_len = 0;
    size_t data_offset = 0;
    size_t data_bpe = 0;
    JSValue data_ab = JS_UNDEFINED;

    if (!JS_IsNull(argv[1]) && !JS_IsUndefined(argv[1])) {
        data = JS_GetArrayBuffer(ctx, &data_len, argv[1]);
        if (!data) {
            JS_FreeValue(ctx, JS_GetException(ctx));
            data_ab = JS_GetTypedArrayBuffer(ctx, argv[1], &data_offset, &data_len, &data_bpe);
            if (!JS_IsException(data_ab)) {
                size_t ab_len;
                data = JS_GetArrayBuffer(ctx, &ab_len, data_ab);
                if (data) {
                    data += data_offset;
                }
            }
        }
    }

    /* Allocate pending write with LWS_PRE padding. */
    TJSHttpPendingWrite *pw = js_malloc(ctx, sizeof(*pw));
    if (!pw) {
        JS_FreeValue(ctx, data_ab);
        return JS_ThrowOutOfMemory(ctx);
    }

    pw->data = js_malloc(ctx, LWS_PRE + data_len);
    if (!pw->data) {
        js_free(ctx, pw);
        JS_FreeValue(ctx, data_ab);
        return JS_ThrowOutOfMemory(ctx);
    }

    if (data && data_len > 0) {
        memcpy(pw->data + LWS_PRE, data, data_len);
    }
    pw->len = data_len;
    pw->is_final = is_final;

    JS_FreeValue(ctx, data_ab);

    /* Enqueue and request writable callback. */
    init_list_head(&pw->link);
    list_add_tail(&pw->link, &req->pending_writes);
    lws_callback_on_writable(req->wsi);

    return JS_UNDEFINED;
}

/*
 * HttpServer.prototype.port (getter)
 */
static JSValue tjs_httpserver_port_get(JSContext *ctx, JSValue this_val) {
    TJSHttpServer *s = tjs_httpserver_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }
    return JS_NewInt32(ctx, s->port);
}

/*
 * WsConnection methods.
 */
static void wsconn_queue_write(TJSWsConnection *ws, const uint8_t *data, size_t len, bool is_text) {
    TJSWsServerPendingWrite *pw = js_malloc(ws->ctx, sizeof(*pw));
    if (!pw) {
        return;
    }
    pw->data = js_malloc(ws->ctx, len);
    if (!pw->data) {
        js_free(ws->ctx, pw);
        return;
    }
    memcpy(pw->data, data, len);
    pw->len = len;
    pw->is_text = is_text;
    list_add_tail(&pw->link, &ws->pending_writes);

    if (ws->wsi) {
        lws_callback_on_writable(ws->wsi);
    }
}

static JSValue tjs_wsconn_send_text(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWsConnection *ws = tjs_wsconn_get(ctx, this_val);
    if (!ws) {
        return JS_EXCEPTION;
    }

    size_t len;
    const char *text = JS_ToCStringLen(ctx, &len, argv[0]);
    if (!text) {
        return JS_EXCEPTION;
    }

    wsconn_queue_write(ws, (const uint8_t *) text, len, true);

    JS_FreeCString(ctx, text);
    return JS_UNDEFINED;
}

static JSValue tjs_wsconn_send_binary(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWsConnection *ws = tjs_wsconn_get(ctx, this_val);
    if (!ws) {
        return JS_EXCEPTION;
    }

    size_t size;
    size_t off = 0;
    uint8_t *buf;

    /* Try ArrayBuffer first, then TypedArray/DataView. */
    buf = JS_GetArrayBuffer(ctx, &size, argv[0]);
    if (!buf) {
        JS_FreeValue(ctx, JS_GetException(ctx));
        size_t bpe, asize;
        JSValue abuf = JS_GetTypedArrayBuffer(ctx, argv[0], &off, &size, &bpe);
        if (JS_IsException(abuf)) {
            return JS_EXCEPTION;
        }
        buf = JS_GetArrayBuffer(ctx, &asize, abuf);
        JS_FreeValue(ctx, abuf);
        if (!buf) {
            return JS_EXCEPTION;
        }
    }

    wsconn_queue_write(ws, buf + off, size, false);
    return JS_UNDEFINED;
}

static JSValue tjs_wsconn_close(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWsConnection *ws = tjs_wsconn_get(ctx, this_val);
    if (!ws) {
        return JS_EXCEPTION;
    }

    int code = 1000;
    if (argc > 0 && !JS_IsUndefined(argv[0])) {
        JS_ToInt32(ctx, &code, argv[0]);
    }

    const char *reason = "";
    size_t rlen = 0;
    if (argc > 1 && !JS_IsUndefined(argv[1])) {
        reason = JS_ToCStringLen(ctx, &rlen, argv[1]);
        if (!reason) {
            return JS_EXCEPTION;
        }
    }

    ws->close_code = (uint16_t) code;
    if (rlen > 0) {
        size_t copy_len = rlen < sizeof(ws->close_reason) - 1 ? rlen : sizeof(ws->close_reason) - 1;
        memcpy(ws->close_reason, reason, copy_len);
        ws->close_reason[copy_len] = '\0';
    }

    if (ws->wsi) {
        lws_close_reason(ws->wsi, (enum lws_close_status) code, (unsigned char *) reason, rlen);
        lws_set_timeout(ws->wsi, PENDING_TIMEOUT_USER_OK, 1);
        lws_callback_on_writable(ws->wsi);
    }

    if (argc > 1 && !JS_IsUndefined(argv[1])) {
        JS_FreeCString(ctx, reason);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_wsconn_data_get(JSContext *ctx, JSValue this_val) {
    TJSWsConnection *ws = tjs_wsconn_get(ctx, this_val);
    if (!ws) {
        return JS_EXCEPTION;
    }
    return JS_DupValue(ctx, ws->data);
}

static JSValue tjs_wsconn_data_set(JSContext *ctx, JSValue this_val, JSValue value) {
    TJSWsConnection *ws = tjs_wsconn_get(ctx, this_val);
    if (!ws) {
        return JS_EXCEPTION;
    }
    JS_FreeValue(ctx, ws->data);
    ws->data = JS_DupValue(ctx, value);
    return JS_UNDEFINED;
}

static JSValue tjs_wsconn_remoteaddr_get(JSContext *ctx, JSValue this_val) {
    TJSWsConnection *ws = tjs_wsconn_get(ctx, this_val);
    if (!ws) {
        return JS_EXCEPTION;
    }
    return JS_NewString(ctx, ws->remote_addr);
}

static JSValue tjs_wsconn_bufferedamount_get(JSContext *ctx, JSValue this_val) {
    TJSWsConnection *ws = tjs_wsconn_get(ctx, this_val);
    if (!ws) {
        return JS_EXCEPTION;
    }
    uint64_t amount = 0;
    struct list_head *el;
    list_for_each(el, &ws->pending_writes) {
        TJSWsServerPendingWrite *pw = list_entry(el, TJSWsServerPendingWrite, link);
        amount += pw->len;
    }
    return JS_NewInt64(ctx, amount);
}

static const JSCFunctionListEntry tjs_wsconn_proto_funcs[] = {
    JS_CGETSET_DEF("data", tjs_wsconn_data_get, tjs_wsconn_data_set),
    JS_CGETSET_DEF("remoteAddress", tjs_wsconn_remoteaddr_get, NULL),
    JS_CGETSET_DEF("bufferedAmount", tjs_wsconn_bufferedamount_get, NULL),
    TJS_CFUNC_DEF("sendText", 1, tjs_wsconn_send_text),
    TJS_CFUNC_DEF("sendBinary", 1, tjs_wsconn_send_binary),
    TJS_CFUNC_DEF("close", 2, tjs_wsconn_close),
};

static const JSCFunctionListEntry tjs_httpserver_proto_funcs[] = {
    JS_CGETSET_DEF("port", tjs_httpserver_port_get, NULL),
    TJS_CFUNC_DEF("close", 0, tjs_httpserver_close),
    TJS_CFUNC_DEF("sendResponse", 4, tjs_httpserver_send_response),
    TJS_CFUNC_DEF("sendHeaders", 3, tjs_httpserver_send_headers),
    TJS_CFUNC_DEF("sendBody", 3, tjs_httpserver_send_body),
    TJS_CFUNC_DEF("acceptUpgrade", 4, tjs_httpserver_accept_upgrade),
};

void tjs__mod_httpserver_init(JSContext *ctx, JSValue ns) {
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSValue proto, obj;

    /* WsConnection class */
    JS_NewClassID(rt, &tjs_wsconn_class_id);
    JS_NewClass(rt, tjs_wsconn_class_id, &tjs_wsconn_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_wsconn_proto_funcs, countof(tjs_wsconn_proto_funcs));
    JS_SetClassProto(ctx, tjs_wsconn_class_id, proto);

    /* HttpServer class */
    JS_NewClassID(rt, &tjs_httpserver_class_id);
    JS_NewClass(rt, tjs_httpserver_class_id, &tjs_httpserver_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_httpserver_proto_funcs, countof(tjs_httpserver_proto_funcs));
    JS_SetClassProto(ctx, tjs_httpserver_class_id, proto);

    /* HttpServer constructor */
    obj = JS_NewCFunction2(ctx, tjs_httpserver_constructor, "HttpServer", 1, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, ns, "HttpServer", obj, JS_PROP_C_W_E);
}

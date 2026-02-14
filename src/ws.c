/*
 * txiki.js
 *
 * Copyright (c) 2022-present Saúl Ibarra Corretgé <s@saghul.net>
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
#include "private.h"

#include <string.h>

enum { WS_CALLBACK_CLOSE = 0, WS_CALLBACK_ERROR, WS_CALLBACK_MESSAGE, WS_CALLBACK_OPEN, WS_CALLBACK_MAX };

#define TJS_LWS_PROTOCOL_NAME "tjs-ws"

typedef struct {
    struct list_head link;
    uint8_t *data;
    size_t len;
    bool is_text;
} TJSWsPendingWrite;

typedef struct {
    JSContext *ctx;
    JSValue callbacks[WS_CALLBACK_MAX];
    JSValue this_val;
    struct lws *wsi;
    DynBuf recv_buf;
    bool recv_is_binary;
    struct list_head pending_writes;
    char protocol[256];
    char extensions[256];
    /* Close info (lws two-phase: stored in PEER_INITIATED_CLOSE, used in CLIENT_CLOSED) */
    uint16_t close_code;
    char close_reason[124]; /* RFC 6455: max 123 bytes + NUL */
} TJSWs;

static JSClassID tjs_ws_class_id;

static void tjs_ws_finalizer(JSRuntime *rt, JSValue val) {
    TJSWs *w = JS_GetOpaque(val, tjs_ws_class_id);
    if (w) {
        for (int i = 0; i < WS_CALLBACK_MAX; i++) {
            JS_FreeValueRT(rt, w->callbacks[i]);
        }
        struct list_head *el, *el1;
        list_for_each_safe(el, el1, &w->pending_writes) {
            TJSWsPendingWrite *pw = list_entry(el, TJSWsPendingWrite, link);
            list_del(&pw->link);
            js_free_rt(rt, pw->data);
            js_free_rt(rt, pw);
        }
        dbuf_free(&w->recv_buf);
        js_free_rt(rt, w);
    }
}

static void tjs_ws_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSWs *w = JS_GetOpaque(val, tjs_ws_class_id);
    if (w) {
        for (int i = 0; i < WS_CALLBACK_MAX; i++) {
            JS_MarkValue(rt, w->callbacks[i], mark_func);
        }
    }
}

static JSClassDef tjs_ws_class = {
    "WebSocket",
    .finalizer = tjs_ws_finalizer,
    .gc_mark = tjs_ws_mark,
};

static TJSWs *tjs_ws_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_ws_class_id);
}

static void maybe_call_callback(TJSWs *w, int event, int argc, JSValue *argv) {
    JSContext *ctx = w->ctx;
    TJSRuntime *qrt = TJS_GetRuntime(ctx);

    JSValue cb = w->callbacks[event];
    if (qrt->freeing || !JS_IsFunction(ctx, cb)) {
        for (int i = 0; i < argc; i++) {
            JS_FreeValue(ctx, argv[i]);
        }
        return;
    }

    tjs_call_handler(ctx, cb, argc, argv);

    for (int i = 0; i < argc; i++) {
        JS_FreeValue(ctx, argv[i]);
    }
}

static int tjs_lws_callback(struct lws *wsi, enum lws_callback_reasons reason, void *user, void *in, size_t len) {
    TJSWs *w = (TJSWs *) user;

    /* Some callbacks (e.g. WSI_CREATE) fire before our user pointer is set. */
    if (!w) {
        return 0;
    }

    switch (reason) {
        case LWS_CALLBACK_CLIENT_FILTER_PRE_ESTABLISH: {
            /* Capture negotiated protocol and extensions while headers are still available.
             * lws releases the header table before CLIENT_ESTABLISHED fires. */
            if (lws_hdr_copy(wsi, w->protocol, sizeof(w->protocol), WSI_TOKEN_PROTOCOL) <= 0) {
                w->protocol[0] = '\0';
            }
            if (lws_hdr_copy(wsi, w->extensions, sizeof(w->extensions), WSI_TOKEN_EXTENSIONS) <= 0) {
                w->extensions[0] = '\0';
            }
            break;
        }

        case LWS_CALLBACK_CLIENT_ESTABLISHED: {
            JSValue v = JS_NewString(w->ctx, w->protocol);
            maybe_call_callback(w, WS_CALLBACK_OPEN, 1, &v);
            break;
        }

        case LWS_CALLBACK_CLIENT_RECEIVE: {
            bool is_binary = (bool) lws_frame_is_binary(wsi);
            bool is_first = (bool) lws_is_first_fragment(wsi);
            bool is_final = (bool) lws_is_final_fragment(wsi);

            if (is_first) {
                /* Start of a new message. */
                w->recv_buf.size = 0;
                w->recv_is_binary = is_binary;
            }

            dbuf_put(&w->recv_buf, in, len);

            if (is_final && lws_remaining_packet_payload(wsi) == 0) {
                /* Complete message received. */
                JSValue v;
                if (w->recv_is_binary) {
                    v = JS_NewArrayBufferCopy(w->ctx, w->recv_buf.buf, w->recv_buf.size);
                } else {
                    v = JS_NewStringLen(w->ctx, (const char *) w->recv_buf.buf, w->recv_buf.size);
                }
                maybe_call_callback(w, WS_CALLBACK_MESSAGE, 1, &v);
                w->recv_buf.size = 0;
            }
            break;
        }

        case LWS_CALLBACK_CLIENT_WRITEABLE: {
            if (list_empty(&w->pending_writes)) {
                break;
            }

            TJSWsPendingWrite *pw = list_entry(w->pending_writes.next, TJSWsPendingWrite, link);

            /* Allocate buffer with LWS_PRE padding. */
            uint8_t *buf = js_malloc(w->ctx, LWS_PRE + pw->len);
            if (!buf) {
                break;
            }
            memcpy(buf + LWS_PRE, pw->data, pw->len);

            enum lws_write_protocol wp = pw->is_text ? LWS_WRITE_TEXT : LWS_WRITE_BINARY;
            int n = lws_write(wsi, buf + LWS_PRE, pw->len, wp);
            js_free(w->ctx, buf);

            if (n < 0) {
                /* Connection failed. */
                return -1;
            }

            /* Remove the sent item from the queue. */
            list_del(&pw->link);
            js_free(w->ctx, pw->data);
            js_free(w->ctx, pw);

            /* If there are more pending writes, request another writable callback. */
            if (!list_empty(&w->pending_writes)) {
                lws_callback_on_writable(wsi);
            }
            break;
        }

        case LWS_CALLBACK_WS_PEER_INITIATED_CLOSE: {
            /* Store the close code and reason from the peer. */
            if (len >= 2) {
                const uint8_t *data = (const uint8_t *) in;
                w->close_code = (uint16_t) ((data[0] << 8) | data[1]);
                if (len > 2) {
                    size_t rlen = len - 2;
                    memcpy(w->close_reason, data + 2, rlen);
                    w->close_reason[rlen] = '\0';
                }
            }
            /* Return 0 to let lws echo the close and then close the connection. */
            return 0;
        }

        case LWS_CALLBACK_CLIENT_CLOSED: {
            w->wsi = NULL;

            JSContext *ctx = w->ctx;

            uint16_t code = w->close_code ? w->close_code : 1005;

            JSValue args[2] = {
                JS_NewInt32(ctx, code),
                JS_NewString(ctx, w->close_reason),
            };
            maybe_call_callback(w, WS_CALLBACK_CLOSE, 2, args);

            tjs__lws_conn_unref(ctx);

            /* Release the prevent-GC ref now that the connection is closed. */
            JSValue cls_val = w->this_val;
            w->this_val = JS_UNDEFINED;
            lws_set_wsi_user(wsi, NULL);
            JS_FreeValue(ctx, cls_val);
            break;
        }

        case LWS_CALLBACK_CLIENT_CONNECTION_ERROR: {
            w->wsi = NULL;

            JSContext *ctx = w->ctx;

            /* Emit error callback with the error reason from lws. */
            JSValue err_reason = JS_NewString(ctx, in ? (const char *) in : "");
            maybe_call_callback(w, WS_CALLBACK_ERROR, 1, &err_reason);

            /* Emit close callback with abnormal closure code. */
            JSValue args[2] = {
                JS_NewInt32(ctx, 1006),
                JS_NewString(ctx, ""),
            };
            maybe_call_callback(w, WS_CALLBACK_CLOSE, 2, args);

            tjs__lws_conn_unref(ctx);

            /* Release the prevent-GC ref. */
            JSValue err_val = w->this_val;
            w->this_val = JS_UNDEFINED;
            lws_set_wsi_user(wsi, NULL);
            JS_FreeValue(ctx, err_val);
            break;
        }

        case LWS_CALLBACK_WSI_DESTROY: {
            /* Release the prevent-GC ref if not already released. */
            if (!JS_IsUndefined(w->this_val)) {
                JS_FreeValue(w->ctx, w->this_val);
                w->this_val = JS_UNDEFINED;
            }
            break;
        }

        default:
            break;
    }

    return 0;
}

const struct lws_protocols tjs_ws_protocol = {
    .name = TJS_LWS_PROTOCOL_NAME,
    .callback = tjs_lws_callback,
    .per_session_data_size = 0, /* We manage user data ourselves. */
    .rx_buffer_size = 0,
};


static JSValue tjs_ws_constructor(JSContext *ctx, JSValue new_target, int argc, JSValue *argv) {
    JSValue obj = JS_NewObjectClass(ctx, tjs_ws_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSWs *w = js_mallocz(ctx, sizeof(*w));
    if (!w) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    w->ctx = ctx;
    for (int i = 0; i < WS_CALLBACK_MAX; i++) {
        w->callbacks[i] = JS_UNDEFINED;
    }
    w->this_val = JS_UNDEFINED;
    tjs_dbuf_init(ctx, &w->recv_buf);
    init_list_head(&w->pending_writes);

    const char *url = JS_ToCString(ctx, argv[0]);
    if (!url) {
        js_free(ctx, w);
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    const char *protocols = NULL;
    if (!JS_IsNull(argv[1])) {
        protocols = JS_ToCString(ctx, argv[1]);
    }

    /* Parse the URL. lws_parse_uri modifies the string in-place. */
    char *url_copy = js_strdup(ctx, url);
    if (!url_copy) {
        JS_FreeCString(ctx, url);
        JS_FreeCString(ctx, protocols);
        js_free(ctx, w);
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }
    JS_FreeCString(ctx, url);

    const char *prot_str, *ads, *path;
    int port;
    if (lws_parse_uri(url_copy, &prot_str, &ads, &port, &path)) {
        JS_FreeCString(ctx, protocols);
        js_free(ctx, url_copy);
        js_free(ctx, w);
        JS_FreeValue(ctx, obj);
        return JS_ThrowTypeError(ctx, "invalid WebSocket URL");
    }

    bool use_ssl = !strcmp(prot_str, "wss") || !strcmp(prot_str, "https");

    /* Build the path with leading slash (lws_parse_uri strips it). */
    size_t path_len = strlen(path);
    char *full_path = js_malloc(ctx, path_len + 2);
    if (!full_path) {
        JS_FreeCString(ctx, protocols);
        js_free(ctx, url_copy);
        js_free(ctx, w);
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }
    full_path[0] = '/';
    memcpy(full_path + 1, path, path_len + 1);

    struct lws_context *lws_ctx = tjs__lws_get_context(ctx);
    if (!lws_ctx) {
        JS_FreeCString(ctx, protocols);
        js_free(ctx, url_copy);
        js_free(ctx, full_path);
        js_free(ctx, w);
        JS_FreeValue(ctx, obj);
        return JS_ThrowInternalError(ctx, "failed to create lws context");
    }

    struct lws_client_connect_info cci;
    memset(&cci, 0, sizeof(cci));

    cci.context = lws_ctx;
    cci.address = ads;
    cci.port = port;
    cci.path = full_path;
    cci.host = ads;
    cci.origin = ads;
    cci.ssl_connection = use_ssl ? LCCSCF_USE_SSL : 0;
    cci.protocol = protocols;
    cci.local_protocol_name = TJS_LWS_PROTOCOL_NAME;
    cci.userdata = w;
    cci.pwsi = &w->wsi;

    JS_SetOpaque(obj, w);

    /* Prevent GC while connected. */
    w->this_val = JS_DupValue(ctx, obj);

    tjs__lws_conn_ref(ctx);

    struct lws *wsi = lws_client_connect_via_info(&cci);

    JS_FreeCString(ctx, protocols);
    js_free(ctx, url_copy);
    js_free(ctx, full_path);

    if (!wsi) {
        tjs__lws_conn_unref(ctx);
        /* Connection failed immediately. */
        w->wsi = NULL;
        JS_FreeValue(ctx, w->this_val);
        w->this_val = JS_UNDEFINED;
        JS_FreeValue(ctx, obj);
        return JS_ThrowInternalError(ctx, "WebSocket connection failed");
    }

    /* Kick the lws service loop. With a persistent context, the internal
     * idle/sultimer handles may have stopped. On Windows, lws uses SUL
     * callbacks for async connect checking, so the service loop must be
     * running. lws_cancel_service writes to the event_pipe, which triggers
     * lws_io_cb, restarting the idle and processing pending SUL entries. */
    lws_cancel_service(lws_ctx);

    return obj;
}

static JSValue tjs_ws_callback_get(JSContext *ctx, JSValue this_val, int magic) {
    TJSWs *w = tjs_ws_get(ctx, this_val);
    if (!w) {
        return JS_EXCEPTION;
    }
    return JS_DupValue(ctx, w->callbacks[magic]);
}

static JSValue tjs_ws_callback_set(JSContext *ctx, JSValue this_val, JSValue value, int magic) {
    TJSWs *w = tjs_ws_get(ctx, this_val);
    if (!w) {
        return JS_EXCEPTION;
    }
    if (JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value)) {
        JS_FreeValue(ctx, w->callbacks[magic]);
        w->callbacks[magic] = JS_DupValue(ctx, value);
    }
    return JS_UNDEFINED;
}

static void ws_queue_write(TJSWs *w, const uint8_t *data, size_t len, bool is_text) {
    TJSWsPendingWrite *pw = js_malloc(w->ctx, sizeof(*pw));
    pw->data = js_malloc(w->ctx, len);
    memcpy(pw->data, data, len);
    pw->len = len;
    pw->is_text = is_text;
    list_add_tail(&pw->link, &w->pending_writes);

    if (w->wsi) {
        lws_callback_on_writable(w->wsi);
    }
}

static JSValue tjs_ws_close(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWs *w = tjs_ws_get(ctx, this_val);
    if (!w) {
        return JS_EXCEPTION;
    }

    int code;
    JS_ToInt32(ctx, &code, argv[0]);
    size_t len;
    const char *reason = JS_ToCStringLen(ctx, &len, argv[1]);

    /* Store the close info for use in CLIENT_CLOSED callback. */
    w->close_code = (uint16_t) code;
    if (len > 0) {
        memcpy(w->close_reason, reason, len);
        w->close_reason[len] = '\0';
    }

    if (w->wsi) {
        lws_close_reason(w->wsi, (enum lws_close_status) code, (unsigned char *) reason, len);
    }

    JS_FreeCString(ctx, reason);

    /* Schedule the wsi for closure. lws will send the close frame
     * and close the connection in the next service loop. */
    if (w->wsi) {
        lws_set_timeout(w->wsi, PENDING_TIMEOUT_USER_OK, 1);
        lws_callback_on_writable(w->wsi);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_ws_sendBinary(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWs *w = tjs_ws_get(ctx, this_val);
    if (!w) {
        return JS_EXCEPTION;
    }

    size_t size;
    uint8_t *buf = JS_GetArrayBuffer(ctx, &size, argv[0]);
    if (!buf) {
        return JS_EXCEPTION;
    }

    uint64_t off;
    if (JS_ToIndex(ctx, &off, argv[1])) {
        return JS_EXCEPTION;
    }

    uint64_t blen;
    if (JS_ToIndex(ctx, &blen, argv[2])) {
        return JS_EXCEPTION;
    }

    ws_queue_write(w, buf + off, blen, false);

    return JS_UNDEFINED;
}

static JSValue tjs_ws_sendText(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWs *w = tjs_ws_get(ctx, this_val);
    if (!w) {
        return JS_EXCEPTION;
    }

    size_t len;
    const char *text = JS_ToCStringLen(ctx, &len, argv[0]);
    if (!text) {
        return JS_EXCEPTION;
    }

    ws_queue_write(w, (const uint8_t *) text, len, true);

    JS_FreeCString(ctx, text);

    return JS_UNDEFINED;
}

static JSValue tjs_ws_bufferedamount_get(JSContext *ctx, JSValue this_val) {
    TJSWs *w = tjs_ws_get(ctx, this_val);
    if (!w) {
        return JS_EXCEPTION;
    }
    uint64_t amount = 0;
    struct list_head *el;
    list_for_each(el, &w->pending_writes) {
        TJSWsPendingWrite *pw = list_entry(el, TJSWsPendingWrite, link);
        amount += pw->len;
    }
    return JS_NewInt64(ctx, amount);
}

static JSValue tjs_ws_extensions_get(JSContext *ctx, JSValue this_val) {
    TJSWs *w = tjs_ws_get(ctx, this_val);
    if (!w) {
        return JS_EXCEPTION;
    }
    return JS_NewString(ctx, w->extensions);
}

static const JSCFunctionListEntry tjs_ws_proto_funcs[] = {
    JS_CGETSET_DEF("bufferedAmount", tjs_ws_bufferedamount_get, NULL),
    JS_CGETSET_DEF("extensions", tjs_ws_extensions_get, NULL),
    JS_CGETSET_MAGIC_DEF("onclose", tjs_ws_callback_get, tjs_ws_callback_set, WS_CALLBACK_CLOSE),
    JS_CGETSET_MAGIC_DEF("onerror", tjs_ws_callback_get, tjs_ws_callback_set, WS_CALLBACK_ERROR),
    JS_CGETSET_MAGIC_DEF("onmessage", tjs_ws_callback_get, tjs_ws_callback_set, WS_CALLBACK_MESSAGE),
    JS_CGETSET_MAGIC_DEF("onopen", tjs_ws_callback_get, tjs_ws_callback_set, WS_CALLBACK_OPEN),
    TJS_CFUNC_DEF("close", 2, tjs_ws_close),
    TJS_CFUNC_DEF("sendBinary", 1, tjs_ws_sendBinary),
    TJS_CFUNC_DEF("sendText", 1, tjs_ws_sendText),
};

void tjs__mod_ws_init(JSContext *ctx, JSValue ns) {
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSValue proto, obj;

    /* WebSocket class */
    JS_NewClassID(rt, &tjs_ws_class_id);
    JS_NewClass(rt, tjs_ws_class_id, &tjs_ws_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_ws_proto_funcs, countof(tjs_ws_proto_funcs));
    JS_SetClassProto(ctx, tjs_ws_class_id, proto);

    /* WebSocket constructor */
    obj = JS_NewCFunction2(ctx, tjs_ws_constructor, "WebSocket", 2, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, ns, "WebSocket", obj, JS_PROP_C_W_E);
}

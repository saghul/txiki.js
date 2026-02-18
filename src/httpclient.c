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
    JSContext *ctx;
    JSValue callbacks[HC_CALLBACK_MAX];
    JSValue this_val;
    struct lws *wsi;
    char *method;
    char *url_str;
    DynBuf req_headers;
    DynBuf send_buf;
    bool sent;
    bool streaming;
    bool body_done;
    bool completed;
    unsigned long timeout;
    int ssl_flags;
    JSValue url;
} TJSHttpClient;

static JSClassID tjs_httpclient_class_id;

static void tjs_httpclient_finalizer(JSRuntime *rt, JSValue val) {
    TJSHttpClient *h = JS_GetOpaque(val, tjs_httpclient_class_id);
    if (h) {
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
        dbuf_free(&h->req_headers);
        dbuf_free(&h->send_buf);
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

static void maybe_invoke_callback(TJSHttpClient *h, int callback, int argc, JSValue *argv) {
    JSContext *ctx = h->ctx;
    TJSRuntime *qrt = TJS_GetRuntime(ctx);

    JSValue func = h->callbacks[callback];
    if (qrt->freeing || !JS_IsFunction(ctx, func)) {
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


typedef struct {
    struct lws *wsi;
    TJSHttpClient *h;
} TJSHttpHdrCtx;

static void custom_header_foreach_cb(const char *name, int nlen, void *opaque) {
    TJSHttpHdrCtx *hctx = opaque;
    char val[4096];

    if (lws_hdr_custom_copy(hctx->wsi, val, sizeof(val), name, nlen) < 0) {
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
        if (lws_hdr_total_length(wsi, n) <= 0) {
            continue;
        }
        char val[4096];
        if (lws_hdr_copy(wsi, val, sizeof(val), n) < 0) {
            continue;
        }

        /* Strip trailing colon. */
        JSValue args[2];
        args[0] = JS_NewStringLen(h->ctx, tn, tn_len - 1);
        args[1] = JS_NewString(h->ctx, val);
        maybe_invoke_callback(h, HC_CALLBACK_HEADER, 2, args);
    }

    /* Iterate custom headers. */
    TJSHttpHdrCtx hctx = { .wsi = wsi, .h = h };
    lws_hdr_custom_name_foreach(wsi, custom_header_foreach_cb, &hctx);
}

static int tjs_lws_http_callback(struct lws *wsi, enum lws_callback_reasons reason, void *user, void *in, size_t len) {
    TJSHttpClient *h = (TJSHttpClient *) user;

    if (!h) {
        return 0;
    }

    switch (reason) {
        case LWS_CALLBACK_CLIENT_APPEND_HANDSHAKE_HEADER: {
            unsigned char **p = (unsigned char **) in, *end = (*p) + len;

            /* Add User-Agent header. */
            if (lws_add_http_header_by_name(wsi,
                                            (const unsigned char *) "user-agent:",
                                            (const unsigned char *) TJS__UA_STRING,
                                            (int) strlen(TJS__UA_STRING),
                                            p,
                                            end)) {
                return -1;
            }

            /* Add custom headers stored in req_headers DynBuf.
             * Format: "Name: Value\r\nName2: Value2\r\n" */
            if (h->req_headers.size > 0) {
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

            JSValue status_arg = JS_NewInt32(h->ctx, status);
            maybe_invoke_callback(h, HC_CALLBACK_STATUS, 1, &status_arg);

            JSValue url_arg = JS_DupValue(h->ctx, h->url);
            maybe_invoke_callback(h, HC_CALLBACK_URL, 1, &url_arg);

            fire_response_headers(h, wsi);

            maybe_invoke_callback(h, HC_CALLBACK_HEADERSCOMPLETE, 0, NULL);
            break;
        }

        case LWS_CALLBACK_RECEIVE_CLIENT_HTTP: {
            char buffer[8192 + LWS_PRE];
            char *px = buffer + LWS_PRE;
            int lenx = sizeof(buffer) - LWS_PRE;

            if (lws_http_client_read(wsi, &px, &lenx) < 0) {
                return -1;
            }
            break;
        }

        case LWS_CALLBACK_RECEIVE_CLIENT_HTTP_READ: {
            JSValue arg = JS_NewArrayBufferCopy(h->ctx, (const uint8_t *) in, len);
            maybe_invoke_callback(h, HC_CALLBACK_DATA, 1, &arg);
            break;
        }

        case LWS_CALLBACK_CLIENT_HTTP_WRITEABLE: {
            if (h->send_buf.size == 0) {
                if (h->body_done) {
                    /* All body data sent — finalize. */
                    lws_client_http_body_pending(wsi, 0);
                    if (h->streaming) {
                        /* Send final chunk: "0\r\n\r\n" */
                        uint8_t buf[LWS_PRE + 5];
                        memcpy(buf + LWS_PRE, "0\r\n\r\n", 5);
                        lws_write(wsi, buf + LWS_PRE, 5, LWS_WRITE_HTTP_FINAL);
                    }
                } else if (h->streaming) {
                    /* No data buffered — ask JS for more. */
                    maybe_invoke_callback(h, HC_CALLBACK_DRAIN, 0, NULL);
                }
                break;
            }

            size_t to_send = h->send_buf.size;

            if (h->streaming) {
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
            } else {
                uint8_t *buf = js_malloc(h->ctx, LWS_PRE + to_send);
                if (!buf) {
                    return -1;
                }
                memcpy(buf + LWS_PRE, h->send_buf.buf, to_send);

                int n = lws_write(wsi, buf + LWS_PRE, to_send, LWS_WRITE_HTTP_FINAL);
                js_free(h->ctx, buf);
                if (n < 0) {
                    return -1;
                }
            }

            h->send_buf.size = 0;

            if (h->streaming && !h->body_done) {
                /* Ask JS for more body data. sendData will
                 * call lws_callback_on_writable when ready. */
                maybe_invoke_callback(h, HC_CALLBACK_DRAIN, 0, NULL);
            } else if (h->streaming && h->body_done) {
                /* Need another WRITEABLE to send the final chunk. */
                lws_callback_on_writable(wsi);
            } else {
                lws_client_http_body_pending(wsi, 0);
            }

            break;
        }

        case LWS_CALLBACK_COMPLETED_CLIENT_HTTP: {
            if (!h->completed) {
                h->completed = true;
                JSValue error = JS_NULL;
                maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 1, &error);
            }
            return -1;
        }

        case LWS_CALLBACK_TIMER: {
            if (!h->completed) {
                h->completed = true;
                JSValue error = JS_NewString(h->ctx, "TIMED_OUT");
                maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 1, &error);
            }
            return -1;
        }

            /* CLOSED and CONNECTION_ERROR are mutually exclusive — exactly
             * one of them fires as the final callback through our protocol.
             * (WSI_DESTROY goes to protocols[0], not to us.)
             * Do full teardown here. */

        case LWS_CALLBACK_CLOSED_CLIENT_HTTP:
        case LWS_CALLBACK_CLIENT_CONNECTION_ERROR: {
            tjs__lws_conn_unref(h->ctx);
            lws_set_wsi_user(h->wsi, NULL);
            h->wsi = NULL;

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

            /* Drop the prevent-GC reference.  The GC finalizer will free
             * callbacks, url, buffers, and the struct itself. */
            CHECK(!JS_IsUndefined(h->this_val));
            JSValue val = h->this_val;
            h->this_val = JS_UNDEFINED;
            JS_FreeValue(h->ctx, val);
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
    h->this_val = JS_UNDEFINED;
    tjs_dbuf_init(ctx, &h->req_headers);
    tjs_dbuf_init(ctx, &h->send_buf);
    h->method = NULL;
    h->url_str = NULL;
    h->sent = false;
    h->streaming = false;
    h->body_done = false;
    h->completed = false;
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
        int r = dbuf_put(&h->send_buf, (const uint8_t *) buf, size);
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
        if (dbuf_put(&h->send_buf, buf, size)) {
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

    char *url_copy = js_strdup(ctx, h->url_str);
    if (!url_copy) {
        return -1;
    }

    const char *prot_str, *ads, *path_str;
    int port;
    if (lws_parse_uri(url_copy, &prot_str, &ads, &port, &path_str)) {
        js_free(ctx, url_copy);
        return -1;
    }

    bool use_ssl = !strcmp(prot_str, "https");

    char full_path[JS__PATH_MAX];
    snprintf(full_path, sizeof(full_path), "/%s", path_str);

    struct lws_context *lws_ctx = tjs__lws_get_context(ctx);
    if (!lws_ctx) {
        js_free(ctx, url_copy);
        return -1;
    }

    struct lws_client_connect_info cci;
    memset(&cci, 0, sizeof(cci));

    cci.context = lws_ctx;
    cci.address = ads;
    cci.port = port;
    cci.path = full_path;
    cci.host = ads;
    cci.origin = ads;
    cci.ssl_connection = (use_ssl ? LCCSCF_USE_SSL : 0) | h->ssl_flags | LCCSCF_HTTP_NO_FOLLOW_REDIRECT;
    cci.method = h->method;
    cci.local_protocol_name = TJS_LWS_HTTP_PROTOCOL_NAME;
    cci.userdata = h;
    cci.pwsi = &h->wsi;

    tjs__lws_conn_ref(ctx);

    struct lws *wsi = lws_client_connect_via_info(&cci);

    js_free(ctx, url_copy);

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
    h->this_val = JS_DupValue(ctx, this_val);
    h->sent = true;

    if (tjs_httpclient_connect(h)) {
        h->sent = false;
        JS_FreeValue(ctx, h->this_val);
        h->this_val = JS_UNDEFINED;
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
        dbuf_printf(&h->req_headers, "%s: %s\r\n", h_name, h_value);
    } else {
        dbuf_printf(&h->req_headers, "%s: \r\n", h_name);
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

        /* Kill the WSI synchronously. The teardown callback chain
         * will handle cleanup — do not access h afterwards. */
        lws_set_timeout(wsi, PENDING_TIMEOUT_USER_OK, LWS_TO_KILL_SYNC);
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

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

/* lws_wsi_is_h2 is compiled into libwebsockets (used by
 * lws_add_http_header_by_name) but not in the public headers. */
extern int lws_wsi_is_h2(struct lws *wsi);

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

enum {
    HC_REDIRECT_FOLLOW = 0,
    HC_REDIRECT_ERROR,
    HC_REDIRECT_MANUAL,
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
    bool h1_chunked;
    bool withCredentials;
    bool completed;
    unsigned long timeout;
    unsigned short redirect_mode;
    int ssl_flags;
    JSValue url;
} TJSHttpClient;

static JSClassID tjs_httpclient_class_id;

static void tjs_httpclient_free(TJSHttpClient *h) {
    JSRuntime *rt = JS_GetRuntime(h->ctx);
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

static void tjs_httpclient_finalizer(JSRuntime *rt, JSValue val) {
    TJSHttpClient *h = JS_GetOpaque(val, tjs_httpclient_class_id);
    if (h) {
        tjs_httpclient_free(h);
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

/* Release all JS references and detach h from the JS object.
 * Setting opaque to NULL makes the GC finalizer a no-op so h
 * stays alive for lws — WSI_DESTROY frees it via tjs_httpclient_free.
 * We cannot let the GC finalizer free h because a GC triggered here
 * could free a *different* request's h while lws still holds a
 * pointer to it (e.g. H2 mux closing multiple children). */
static void tjs_httpclient_cleanup(TJSHttpClient *h) {
    if (!h->wsi) {
        return;
    }

    CHECK(!JS_IsUndefined(h->this_val));
    h->wsi = NULL;

    JSContext *ctx = h->ctx;
    for (int i = 0; i < HC_CALLBACK_MAX; i++) {
        JS_FreeValue(ctx, h->callbacks[i]);
        h->callbacks[i] = JS_UNDEFINED;
    }
    JS_FreeValue(ctx, h->url);
    h->url = JS_UNDEFINED;

    JSValue val = h->this_val;
    h->this_val = JS_UNDEFINED;
    JS_SetOpaque(val, NULL);
    JS_FreeValue(ctx, val);
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
                } else if (!lws_wsi_is_h2(wsi)) {
                    /* HTTP/1.x streaming body: add Transfer-Encoding: chunked.
                     * On H2 the framing is handled by DATA frames so this is
                     * not needed (and forbidden by the H2 spec). */
                    if (lws_add_http_header_by_name(wsi,
                                                    (const unsigned char *) "transfer-encoding:",
                                                    (const unsigned char *) "chunked",
                                                    7,
                                                    p,
                                                    end)) {
                        return -1;
                    }
                    h->h1_chunked = true;
                }
                lws_client_http_body_pending(wsi, 1);
                lws_callback_on_writable(wsi);
            }

            break;
        }

        case LWS_CALLBACK_ESTABLISHED_CLIENT_HTTP: {
            int status = (int) lws_http_client_http_response(wsi);

            /* For "error" redirect mode, if we get a 3xx, signal an error. */
            if (status / 100 == 3 && h->redirect_mode == HC_REDIRECT_ERROR) {
                JSValue error = JS_NewString(h->ctx, "REDIRECT_ERROR");
                maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 1, &error);
                h->completed = true;
                return -1;
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
                    if (h->h1_chunked) {
                        /* Send final chunk: "0\r\n\r\n" */
                        uint8_t buf[LWS_PRE + 5];
                        memcpy(buf + LWS_PRE, "0\r\n\r\n", 5);
                        lws_write(wsi, buf + LWS_PRE, 5, LWS_WRITE_HTTP_FINAL);
                    } else if (h->streaming) {
                        /* H2: empty write with END_STREAM. */
                        uint8_t buf[LWS_PRE];
                        lws_write(wsi, buf + LWS_PRE, 0, LWS_WRITE_HTTP_FINAL);
                    }
                } else if (h->streaming) {
                    /* No data buffered — ask JS for more. */
                    maybe_invoke_callback(h, HC_CALLBACK_DRAIN, 0, NULL);
                }
                break;
            }

            size_t to_send = h->send_buf.size;

            if (h->h1_chunked) {
                /* HTTP/1.1 chunked encoding: "<hex-len>\r\n<data>\r\n" */
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

                int wp = (!h->streaming || h->body_done) ? LWS_WRITE_HTTP_FINAL : LWS_WRITE_HTTP;
                int n = lws_write(wsi, buf + LWS_PRE, to_send, (enum lws_write_protocol) wp);
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
            } else if (h->h1_chunked && h->body_done) {
                /* Need another WRITEABLE to send the final chunk. */
                lws_callback_on_writable(wsi);
            } else {
                /* Non-streaming or H2 final: body complete. */
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
            tjs_httpclient_cleanup(h);
            return -1;
        }

        case LWS_CALLBACK_CLOSED_CLIENT_HTTP: {
            if (!h->completed) {
                h->completed = true;
                JSValue error = JS_NewString(h->ctx, "CONNECTION_CLOSED");
                maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 1, &error);
            }
            tjs__lws_conn_unref(h->ctx);
            tjs_httpclient_cleanup(h);
            break;
        }

        case LWS_CALLBACK_CLIENT_CONNECTION_ERROR: {
            if (!h->completed) {
                h->completed = true;
                JSValue args[2];
                args[0] = JS_NewString(h->ctx, "CONNECTION_ERROR");
                args[1] = JS_NewString(h->ctx, in ? (const char *) in : "Connection error");
                maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 2, args);
            }
            tjs__lws_conn_unref(h->ctx);
            tjs_httpclient_cleanup(h);
            break;
        }

        case LWS_CALLBACK_CLIENT_HTTP_REDIRECT: {
            /* in = null-terminated redirect URL, len = HTTP status code. */
            if (h->redirect_mode == HC_REDIRECT_FOLLOW) {
                /* Update the tracked URL to the redirect target. */
                const char *redir = (const char *) in;
                JS_FreeValue(h->ctx, h->url);
                if (redir[0] == '/' || !strchr(redir, ':')) {
                    /* Relative URL: resolve against original URL's origin. */
                    const char *orig = JS_ToCString(h->ctx, h->url);
                    if (orig) {
                        const char *scheme_end = strstr(orig, "://");
                        if (scheme_end) {
                            const char *host_start = scheme_end + 3;
                            const char *path_start = strchr(host_start, '/');
                            size_t origin_len = path_start ? (size_t) (path_start - orig) : strlen(orig);
                            size_t redir_len = strlen(redir);
                            char *full_url = js_malloc(h->ctx, origin_len + redir_len + 1);
                            if (full_url) {
                                memcpy(full_url, orig, origin_len);
                                memcpy(full_url + origin_len, redir, redir_len + 1);
                                h->url = JS_NewString(h->ctx, full_url);
                                js_free(h->ctx, full_url);
                            } else {
                                h->url = JS_NewString(h->ctx, redir);
                            }
                        } else {
                            h->url = JS_NewString(h->ctx, redir);
                        }
                        JS_FreeCString(h->ctx, orig);
                    } else {
                        h->url = JS_NewString(h->ctx, redir);
                    }
                } else {
                    h->url = JS_NewString(h->ctx, redir);
                }
                return 0; /* Let lws follow the redirect. */
            }

            if (h->redirect_mode == HC_REDIRECT_MANUAL) {
                /* Synthesize the redirect response for the caller.
                 * This handles the h2 case where client_no_follow_redirect
                 * doesn't propagate to stream wsis. For h1, ESTABLISHED
                 * fires directly with the 3xx status instead. */
                int redir_status = (int) len;

                JSValue status_arg = JS_NewInt32(h->ctx, redir_status);
                maybe_invoke_callback(h, HC_CALLBACK_STATUS, 1, &status_arg);

                JSValue url_arg = JS_DupValue(h->ctx, h->url);
                maybe_invoke_callback(h, HC_CALLBACK_URL, 1, &url_arg);

                fire_response_headers(h, wsi);

                maybe_invoke_callback(h, HC_CALLBACK_HEADERSCOMPLETE, 0, NULL);

                h->completed = true;
                JSValue ok = JS_NULL;
                maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 1, &ok);
            } else {
                /* Error mode: reject redirect. */
                h->completed = true;
                JSValue error = JS_NewString(h->ctx, "REDIRECT_ERROR");
                maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 1, &error);
            }

            return -1; /* Reject the redirect. CONNECTION_ERROR will fire
                        * but h->completed is already set. */
        }

        case LWS_CALLBACK_TIMER: {
            if (!h->completed) {
                h->completed = true;
                JSValue error = JS_NewString(h->ctx, "TIMED_OUT");
                maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 1, &error);
            }
            tjs_httpclient_cleanup(h);
            return -1;
        }

        case LWS_CALLBACK_WSI_DESTROY: {
            tjs_httpclient_cleanup(h);
            tjs_httpclient_free(h);
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
    h->redirect_mode = HC_REDIRECT_FOLLOW;
    h->method = NULL;
    h->url_str = NULL;
    h->sent = false;
    h->streaming = false;
    h->body_done = false;
    h->withCredentials = false;
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

static JSValue tjs_httpclient_withcredentials_get(JSContext *ctx, JSValue this_val) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }
    return JS_NewBool(ctx, h->withCredentials);
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

static JSValue tjs_httpclient_redirectmode_get(JSContext *ctx, JSValue this_val) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }
    switch (h->redirect_mode) {
        case HC_REDIRECT_FOLLOW:
            return JS_NewString(ctx, "follow");
        case HC_REDIRECT_ERROR:
            return JS_NewString(ctx, "error");
        case HC_REDIRECT_MANUAL:
            return JS_NewString(ctx, "manual");
        default:
            abort();
    }
}

static JSValue tjs_httpclient_redirectmode_set(JSContext *ctx, JSValue this_val, JSValue value) {
    static const char follow[] = "follow";
    static const char error[] = "error";
    static const char manual[] = "manual";

    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }

    const char *v = JS_ToCString(ctx, value);
    if (v) {
        if (strncmp(follow, v, sizeof(follow) - 1) == 0) {
            h->redirect_mode = HC_REDIRECT_FOLLOW;
        } else if (strncmp(error, v, sizeof(error) - 1) == 0) {
            h->redirect_mode = HC_REDIRECT_ERROR;
        } else if (strncmp(manual, v, sizeof(manual) - 1) == 0) {
            h->redirect_mode = HC_REDIRECT_MANUAL;
        }
        JS_FreeCString(ctx, v);
    }

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

    /* Parse the URL. lws_parse_uri modifies in-place, so we use a copy. */
    char *url_copy = js_strdup(ctx, h->url_str);
    if (!url_copy) {
        return JS_ThrowOutOfMemory(ctx);
    }

    const char *prot_str, *ads, *path_str;
    int port;
    if (lws_parse_uri(url_copy, &prot_str, &ads, &port, &path_str)) {
        js_free(ctx, url_copy);
        return JS_ThrowTypeError(ctx, "Invalid URL");
    }

    bool use_ssl = !strcmp(prot_str, "https");

    /* Build path with leading slash. */
    char full_path[JS__PATH_MAX];
    snprintf(full_path, sizeof(full_path), "/%s", path_str);

    struct lws_context *lws_ctx = tjs__lws_get_context(ctx);
    if (!lws_ctx) {
        js_free(ctx, url_copy);
        return JS_ThrowInternalError(ctx, "No lws context");
    }

    /* Prevent GC while request is in flight. */
    h->this_val = JS_DupValue(ctx, this_val);
    h->sent = true;

    struct lws_client_connect_info cci;
    memset(&cci, 0, sizeof(cci));

    cci.context = lws_ctx;
    cci.address = ads;
    cci.port = port;
    cci.path = full_path;
    cci.host = ads;
    cci.origin = ads;
    cci.ssl_connection = (use_ssl ? LCCSCF_USE_SSL : 0) | h->ssl_flags | LCCSCF_H2_QUIRK_OVERFLOWS_TXCR |
                         LCCSCF_H2_QUIRK_NGHTTP2_END_STREAM;
    cci.method = h->method;
    cci.local_protocol_name = TJS_LWS_HTTP_PROTOCOL_NAME;
    cci.userdata = h;
    cci.pwsi = &h->wsi;

    if (h->redirect_mode == HC_REDIRECT_MANUAL) {
        cci.ssl_connection |= LCCSCF_HTTP_NO_FOLLOW_REDIRECT;
    }

    tjs__lws_conn_ref(ctx);

    struct lws *wsi = lws_client_connect_via_info(&cci);

    /* Free after lws_client_connect_via_info — lws copies what it needs. */
    js_free(ctx, url_copy);

    if (!wsi) {
        tjs__lws_conn_unref(ctx);
        h->wsi = NULL;
        h->sent = false;
        JS_FreeValue(ctx, h->this_val);
        h->this_val = JS_UNDEFINED;
        return JS_ThrowInternalError(ctx, "Connection failed");
    }

    lws_cancel_service(lws_ctx);

    /* Start timeout if configured. */
    if (h->timeout > 0) {
        lws_set_timer_usecs(wsi, (lws_usec_t) h->timeout * LWS_USEC_PER_SEC / 1000);
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
        h->withCredentials = true;
        h->ssl_flags |= LCCSCF_CACHE_COOKIES;
    } else {
        h->withCredentials = false;
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

        /* Release JS references before closing the WSI. The C struct
         * stays alive until WSI_DESTROY fires — cleanup sets h->wsi = NULL
         * so subsequent lws callbacks are safe. */
        tjs_httpclient_cleanup(h);

        /* Close the WSI synchronously. LWS_TO_KILL_ASYNC cannot be used
         * because a WSI still waiting for DNS has no socket and no UV handle,
         * so the async kill never fires — leading to a crash during
         * lws_context_destroy. LWS_TO_KILL_SYNC closes the WSI directly.
         * NOTE: h may be freed by the WSI_DESTROY callback inside this
         * call, so h must not be accessed after this point. */
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
    JS_CGETSET_DEF("withCredentials", tjs_httpclient_withcredentials_get, NULL),
    JS_CGETSET_DEF("streaming", tjs_httpclient_streaming_get, tjs_httpclient_streaming_set),
    JS_CGETSET_DEF("redirectMode", tjs_httpclient_redirectmode_get, tjs_httpclient_redirectmode_set),
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

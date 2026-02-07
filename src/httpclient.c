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

#include "curl-utils.h"
#include "private.h"

#include <ctype.h>
#include <string.h>


enum {
    HC_CALLBACK_RESPONSE = 0,
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
    tjs_curl_private_t curl_private;
    CURL *curl_h;
    CURLM *curlm_h;
    struct curl_slist *slist;
    bool sent;
    bool async;
    bool streaming;
    bool stream_done;
    bool withCredentials;
    bool response_sent;
    unsigned long timeout;
    unsigned short redirect_mode;
    char *status_text;
    JSValue url;
    DynBuf hbuf;
    DynBuf send_buf;
} TJSHttpClient;

static JSClassID tjs_httpclient_class_id;

static void tjs_httpclient_finalizer(JSRuntime *rt, JSValue val) {
    TJSHttpClient *h = JS_GetOpaque(val, tjs_httpclient_class_id);
    if (h) {
        if (h->curl_h) {
            if (h->async) {
                curl_multi_remove_handle(h->curlm_h, h->curl_h);
            }
            curl_easy_cleanup(h->curl_h);
        }
        if (h->slist) {
            curl_slist_free_all(h->slist);
        }
        if (h->status_text) {
            js_free_rt(rt, h->status_text);
        }
        for (int i = 0; i < HC_CALLBACK_MAX; i++) {
            JS_FreeValueRT(rt, h->callbacks[i]);
        }
        JS_FreeValueRT(rt, h->url);
        dbuf_free(&h->hbuf);
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

static void curl__done_cb(CURLcode result, void *arg) {
    TJSHttpClient *h = arg;
    CHECK_NOT_NULL(h);

    if (h->slist) {
        curl_slist_free_all(h->slist);
        h->slist = NULL;
    }

    curl_easy_setopt(h->curl_h, CURLOPT_COOKIELIST, "FLUSH");

    JSValue error;
    if (result == CURLE_OPERATION_TIMEDOUT) {
        error = JS_NewString(h->ctx, "Request timed out");
    } else if (result != CURLE_OK) {
        error = JS_NewString(h->ctx, curl_easy_strerror(result));
    } else {
        error = JS_NULL;
    }

    maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 1, &error);
}

static void curlm__done_cb(CURLMsg *message, void *arg) {
    TJSHttpClient *h = arg;
    CHECK_NOT_NULL(h);

    CURL *easy_handle = message->easy_handle;
    CHECK_EQ(h->curl_h, easy_handle);
    curl__done_cb(message->data.result, h);

    // The calling function will disengage the easy handle when this
    // function returns.
    h->curl_h = NULL;
}

static size_t curl__data_cb(char *ptr, size_t size, size_t nmemb, void *userdata) {
    TJSHttpClient *h = userdata;
    CHECK_NOT_NULL(h);

    size_t realsize = size * nmemb;

    // Get content length for progress info
#if LIBCURL_VERSION_NUM >= 0x073700 /* added in 7.55.0 */
    curl_off_t cl = -1;
    curl_easy_getinfo(h->curl_h, CURLINFO_CONTENT_LENGTH_DOWNLOAD_T, &cl);
#else
    double cl_d = -1;
    curl_easy_getinfo(h->curl_h, CURLINFO_CONTENT_LENGTH_DOWNLOAD, &cl_d);
    curl_off_t cl = (curl_off_t) cl_d;
#endif

    // ondata(chunk, contentLength)
    // contentLength is -1 if unknown
    JSValue args[2];
    args[0] = JS_NewArrayBufferCopy(h->ctx, (const uint8_t *) ptr, realsize);
    args[1] = JS_NewInt64(h->ctx, cl);
    maybe_invoke_callback(h, HC_CALLBACK_DATA, 2, args);

    return realsize;
}

static size_t curl__header_cb(char *ptr, size_t size, size_t nmemb, void *userdata) {
    static const char status_line[] = "HTTP/";
    static const char empty_line[] = "\r\n";

    TJSHttpClient *h = userdata;
    CHECK_NOT_NULL(h);

    DynBuf *hbuf = &h->hbuf;
    size_t realsize = size * nmemb;

    if (strncmp(status_line, ptr, sizeof(status_line) - 1) == 0) {
        // New HTTP status line — reset header buffer.
        dbuf_free(hbuf);
        tjs_dbuf_init(h->ctx, hbuf);
        h->response_sent = false;

        if (h->status_text) {
            js_free(h->ctx, h->status_text);
            h->status_text = NULL;
        }
        // Extract reason phrase from status line: "HTTP/1.1 200 OK\r\n" -> "OK"
        *(ptr + realsize - 2) = '\0';
        const char *p = strchr(ptr, ' ');
        if (p) {
            const char *p2 = strchr(p + 1, ' ');
            if (p2) {
                h->status_text = js_strdup(h->ctx, p2 + 1);
            }
        }
    } else if (strncmp(empty_line, ptr, sizeof(empty_line) - 1) == 0) {
        // Empty line — headers complete.
        long code = -1;
        curl_easy_getinfo(h->curl_h, CURLINFO_RESPONSE_CODE, &code);
        bool will_redirect = code / 100 == 3 && h->redirect_mode != HC_REDIRECT_MANUAL;

        if (code > -1 && !will_redirect && !h->response_sent) {
            char *effective_url = NULL;
            curl_easy_getinfo(h->curl_h, CURLINFO_EFFECTIVE_URL, &effective_url);
            if (effective_url) {
                JS_FreeValue(h->ctx, h->url);
                h->url = JS_NewString(h->ctx, effective_url);
            }

            dbuf_putc(hbuf, '\0');

            JSValue args[4];
            args[0] = JS_NewInt32(h->ctx, code);
            args[1] = JS_NewString(h->ctx, h->status_text ? h->status_text : "");
            args[2] = JS_DupValue(h->ctx, h->url);
            args[3] = JS_NewStringLen(h->ctx, (char *) hbuf->buf, hbuf->size - 1);

            maybe_invoke_callback(h, HC_CALLBACK_RESPONSE, 4, args);
            h->response_sent = true;
        }
    } else {
        // Regular header line — lowercase name and accumulate.
        const char *p = memchr(ptr, ':', realsize);
        if (p) {
            for (char *tmp = ptr; tmp != p; tmp++) {
                *tmp = tolower(*tmp);
            }
            if (dbuf_put(hbuf, (const uint8_t *) ptr, realsize)) {
                return -1;
            }
        }
    }

    return realsize;
}

static size_t curl__sendbody_cb(char *ptr, size_t size, size_t nmemb, void *userdata) {
    TJSHttpClient *h = userdata;
    CHECK_NOT_NULL(h);

    size_t maxsize = size * nmemb;
    DynBuf *sbuf = &h->send_buf;

    if (sbuf->size == 0) {
        if (h->stream_done) {
            return 0;
        }
        // Ask JS for more data
        maybe_invoke_callback(h, HC_CALLBACK_DRAIN, 0, NULL);
        if (sbuf->size == 0) {
            // Still no data, pause until sendData is called
            return CURL_READFUNC_PAUSE;
        }
    }

    // Copy data from send buffer to CURL
    size_t tocopy = sbuf->size < maxsize ? sbuf->size : maxsize;
    memcpy(ptr, sbuf->buf, tocopy);

    // Remove copied data from buffer
    if (tocopy < sbuf->size) {
        memmove(sbuf->buf, sbuf->buf + tocopy, sbuf->size - tocopy);
    }
    sbuf->size -= tocopy;

    return tocopy;
}

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
    tjs_dbuf_init(ctx, &h->hbuf);
    tjs_dbuf_init(ctx, &h->send_buf);
    h->redirect_mode = HC_REDIRECT_FOLLOW;
    h->status_text = NULL;
    h->slist = NULL;
    h->sent = false;
    h->async = true;
    h->streaming = false;
    h->stream_done = false;
    h->withCredentials = false;
    h->response_sent = false;

    for (int i = 0; i < HC_CALLBACK_MAX; i++) {
        h->callbacks[i] = JS_UNDEFINED;
    }

    h->curl_private.magic = TJS__CURL_PRIVATE_MAGIC;
    h->curl_private.arg = h;
    h->curl_private.done_cb = curlm__done_cb;

    h->curlm_h = tjs__get_curlm(ctx);
    h->curl_h = tjs__curl_easy_init(NULL);

    curl_easy_setopt(h->curl_h, CURLOPT_PRIVATE, &h->curl_private);
    curl_easy_setopt(h->curl_h, CURLOPT_NOSIGNAL, 1L);
    curl_easy_setopt(h->curl_h, CURLOPT_WRITEFUNCTION, curl__data_cb);
    curl_easy_setopt(h->curl_h, CURLOPT_WRITEDATA, h);
    curl_easy_setopt(h->curl_h, CURLOPT_HEADERFUNCTION, curl__header_cb);
    curl_easy_setopt(h->curl_h, CURLOPT_HEADERDATA, h);
#if LIBCURL_VERSION_NUM >= 0x071506 /* renamed from ENCODING to ACCEPT_ENCODING in 7.21.6 */
    curl_easy_setopt(h->curl_h, CURLOPT_ACCEPT_ENCODING, "");
#else
    curl_easy_setopt(h->curl_h, CURLOPT_ENCODING, "");
#endif

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

    if (!h->sent) {
        curl_easy_setopt(h->curl_h, CURLOPT_TIMEOUT_MS, timeout);
    }

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

    static const long default_maxredirs = 30L;

    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }

    const char *v = JS_ToCString(ctx, value);
    if (v) {
        if (strncmp(follow, v, sizeof(follow) - 1) == 0) {
            curl_easy_setopt(h->curl_h, CURLOPT_FOLLOWLOCATION, 1L);
            curl_easy_setopt(h->curl_h, CURLOPT_MAXREDIRS, default_maxredirs);
            h->redirect_mode = HC_REDIRECT_FOLLOW;
        } else if (strncmp(error, v, sizeof(error) - 1) == 0) {
            curl_easy_setopt(h->curl_h, CURLOPT_FOLLOWLOCATION, 1L);
            curl_easy_setopt(h->curl_h, CURLOPT_MAXREDIRS, 0L);
            h->redirect_mode = HC_REDIRECT_ERROR;
        } else if (strncmp(manual, v, sizeof(manual) - 1) == 0) {
            curl_easy_setopt(h->curl_h, CURLOPT_FOLLOWLOCATION, 0L);
            curl_easy_setopt(h->curl_h, CURLOPT_MAXREDIRS, default_maxredirs);
            h->redirect_mode = HC_REDIRECT_MANUAL;
        }
        JS_FreeCString(ctx, v);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_httpclient_open(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    static const char head_method[] = "HEAD";

    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }

    if (h->sent) {
        return JS_ThrowTypeError(ctx, "Request already sent");
    }

    JSValue method = argv[0];
    JSValue url = argv[1];
    const char *method_str = JS_ToCString(ctx, method);
    const char *url_str = JS_ToCString(ctx, url);

    if (argc >= 3) {
        h->async = JS_ToBool(ctx, argv[2]);
    }

    if (strncasecmp(head_method, method_str, sizeof(head_method) - 1) == 0) {
        curl_easy_setopt(h->curl_h, CURLOPT_NOBODY, 1L);
    } else {
        curl_easy_setopt(h->curl_h, CURLOPT_CUSTOMREQUEST, method_str);
    }
    curl_easy_setopt(h->curl_h, CURLOPT_URL, url_str);

    JS_FreeCString(ctx, method_str);
    JS_FreeCString(ctx, url_str);

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
    const char *h_name, *h_value = NULL;
    h_name = JS_ToCString(ctx, argv[0]);
    if (!JS_IsUndefined(argv[1])) {
        h_value = JS_ToCString(ctx, argv[1]);
    }
    char buf[CURL_MAX_HTTP_HEADER];
    if (h_value) {
        snprintf(buf, sizeof(buf), "%s: %s", h_name, h_value);
    } else {
        snprintf(buf, sizeof(buf), "%s;", h_name);
    }
    JS_FreeCString(ctx, h_name);
    if (h_value) {
        JS_FreeCString(ctx, h_value);
    }
    struct curl_slist *list = curl_slist_append(h->slist, buf);
    if (list) {
        h->slist = list;
    }
    return JS_UNDEFINED;
}

static JSValue tjs_httpclient_set_cookiejar(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }

    const char *v;
    if (JS_IsString(argv[0]) && (v = JS_ToCString(ctx, argv[0]))) {
        curl_easy_setopt(h->curl_h, CURLOPT_COOKIEFILE, v);
        curl_easy_setopt(h->curl_h, CURLOPT_COOKIEJAR, v);
        JS_FreeCString(ctx, v);
        h->withCredentials = true;
    } else {
        curl_easy_setopt(h->curl_h, CURLOPT_COOKIEFILE, NULL);
        curl_easy_setopt(h->curl_h, CURLOPT_COOKIEJAR, NULL);
        h->withCredentials = false;
    }
    return JS_UNDEFINED;
}

static void tjs_httpclient_start_request(TJSHttpClient *h) {
    curl_easy_setopt(h->curl_h, CURLOPT_COOKIELIST, "RELOAD");
    curl_easy_setopt(h->curl_h, CURLOPT_HTTPHEADER, h->slist);

    if (h->async) {
        curl_multi_add_handle(h->curlm_h, h->curl_h);
    } else {
        CURLcode result = curl_easy_perform(h->curl_h);
        curl__done_cb(result, h);
        curl_easy_cleanup(h->curl_h);
        h->curl_h = NULL;
    }

    h->sent = true;
}

static JSValue tjs_httpclient_senddata(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }

    JSValue arg = argv[0];

    if (JS_IsNull(arg) || JS_IsUndefined(arg)) {
        if (h->sent) {
            // Streaming mode: signal end of stream
            h->stream_done = true;
            curl_easy_pause(h->curl_h, CURLPAUSE_CONT);
        } else {
            // Non-streaming: fire request with buffered data
            if (h->send_buf.size > 0) {
                curl_easy_setopt(h->curl_h, CURLOPT_POSTFIELDSIZE_LARGE, (curl_off_t) h->send_buf.size);
                curl_easy_setopt(h->curl_h, CURLOPT_COPYPOSTFIELDS, h->send_buf.buf);
            }
            tjs_httpclient_start_request(h);
        }
    } else {
        // Buffer the data
        size_t size;
        const void *buf;

        if (JS_IsString(arg)) {
            buf = JS_ToCStringLen(ctx, &size, arg);
            if (!buf) {
                return JS_EXCEPTION;
            }
            if (dbuf_put(&h->send_buf, (const uint8_t *) buf, size)) {
                JS_FreeCString(ctx, buf);
                return JS_ThrowOutOfMemory(ctx);
            }
            JS_FreeCString(ctx, buf);
        } else if (JS_GetTypedArrayType(arg) == JS_TYPED_ARRAY_UINT8) {
            buf = JS_GetUint8Array(ctx, &size, arg);
            if (!buf) {
                return JS_EXCEPTION;
            }
            if (dbuf_put(&h->send_buf, buf, size)) {
                return JS_ThrowOutOfMemory(ctx);
            }
        } else {
            return JS_ThrowTypeError(ctx, "Expected string, Uint8Array, or null");
        }

        if (h->streaming) {
            if (!h->sent) {
                // Streaming mode: start request now with UPLOAD + READFUNCTION
                curl_easy_setopt(h->curl_h, CURLOPT_UPLOAD, 1L);
                curl_easy_setopt(h->curl_h, CURLOPT_READFUNCTION, curl__sendbody_cb);
                curl_easy_setopt(h->curl_h, CURLOPT_READDATA, h);
                tjs_httpclient_start_request(h);
            } else {
                // Streaming mode: unpause CURL to consume new data
                curl_easy_pause(h->curl_h, CURLPAUSE_CONT);
            }
        }
    }

    return JS_UNDEFINED;
}

static JSValue tjs_httpclient_abort(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHttpClient *h = tjs_httpclient_get(ctx, this_val);
    if (!h) {
        return JS_EXCEPTION;
    }
    if (h->curl_h) {
        if (h->async) {
            curl_multi_remove_handle(h->curlm_h, h->curl_h);
        }
        curl_easy_cleanup(h->curl_h);
        h->curl_h = NULL;

        JSValue error = JS_NewString(ctx, "Request aborted");
        maybe_invoke_callback(h, HC_CALLBACK_COMPLETE, 1, &error);
    }
    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_httpclient_proto_funcs[] = {
    JS_CGETSET_MAGIC_DEF("onresponse", tjs_httpclient_callback_get, tjs_httpclient_callback_set, HC_CALLBACK_RESPONSE),
    JS_CGETSET_MAGIC_DEF("ondata", tjs_httpclient_callback_get, tjs_httpclient_callback_set, HC_CALLBACK_DATA),
    JS_CGETSET_MAGIC_DEF("oncomplete", tjs_httpclient_callback_get, tjs_httpclient_callback_set, HC_CALLBACK_COMPLETE),
    JS_CGETSET_MAGIC_DEF("ondrain", tjs_httpclient_callback_get, tjs_httpclient_callback_set, HC_CALLBACK_DRAIN),
    JS_CGETSET_DEF("timeout", tjs_httpclient_timeout_get, tjs_httpclient_timeout_set),
    JS_CGETSET_DEF("withCredentials", tjs_httpclient_withcredentials_get, NULL),
    JS_CGETSET_DEF("streaming", tjs_httpclient_streaming_get, tjs_httpclient_streaming_set),
    JS_CGETSET_DEF("redirectMode", tjs_httpclient_redirectmode_get, tjs_httpclient_redirectmode_set),
    TJS_CFUNC_DEF("open", 3, tjs_httpclient_open),
    TJS_CFUNC_DEF("setRequestHeader", 2, tjs_httpclient_setrequestheader),
    TJS_CFUNC_DEF("setCookieJar", 1, tjs_httpclient_set_cookiejar),
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

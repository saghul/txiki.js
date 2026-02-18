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

#include "cacert.h"
#include "private.h"
#include "version.h"

#include <string.h>

#define TJS__UA_STRING                                                                                                 \
    "txiki.js/" STRINGIFY(TJS_VERSION_MAJOR) "." STRINGIFY(TJS_VERSION_MINOR) "." STRINGIFY(TJS_VERSION_PATCH)         \
        TJS_VERSION_SUFFIX

extern const struct lws_protocols tjs_ws_protocol;
extern const struct lws_protocols tjs_http_protocol;

#define TJS_LWS_HTTP_LOAD_PROTOCOL_NAME "tjs-http-load"

typedef struct {
    DynBuf *dbuf;
    int status;
    bool done;
    char redirect_url[2048];
} TJSHttpLoadCtx;

static int tjs_lws_http_load_callback(struct lws *wsi,
                                      enum lws_callback_reasons reason,
                                      void *user,
                                      void *in,
                                      size_t len) {
    TJSHttpLoadCtx *ctx = (TJSHttpLoadCtx *) user;

    if (!ctx) {
        return 0;
    }

    switch (reason) {
        case LWS_CALLBACK_ESTABLISHED_CLIENT_HTTP:
            ctx->status = (int) lws_http_client_http_response(wsi);
            break;

        case LWS_CALLBACK_RECEIVE_CLIENT_HTTP: {
            char buffer[4096 + LWS_PRE];
            char *px = buffer + LWS_PRE;
            int lenx = sizeof(buffer) - LWS_PRE;

            if (lws_http_client_read(wsi, &px, &lenx) < 0) {
                return -1;
            }
            break;
        }

        case LWS_CALLBACK_RECEIVE_CLIENT_HTTP_READ:
            if (dbuf_put(ctx->dbuf, (const uint8_t *) in, len)) {
                return -1;
            }
            break;

        case LWS_CALLBACK_COMPLETED_CLIENT_HTTP:
            ctx->done = true;
            break;

        case LWS_CALLBACK_CLOSED_CLIENT_HTTP:
            if (!ctx->done) {
                ctx->status = -1;
                ctx->done = true;
            }
            break;

        case LWS_CALLBACK_CLIENT_CONNECTION_ERROR:
            ctx->status = -1;
            ctx->done = true;
            break;

        case LWS_CALLBACK_TIMER:
            ctx->status = -2;
            ctx->done = true;
            return -1;

        case LWS_CALLBACK_CLIENT_HTTP_REDIRECT:
            /* Capture the redirect target so we can retry on cross-host
             * failures.  Return 0 to let lws try the built-in redirect. */
            if (in) {
                lws_strncpy(ctx->redirect_url, (const char *) in, sizeof(ctx->redirect_url));
            }
            return 0;

        case LWS_CALLBACK_CLIENT_APPEND_HANDSHAKE_HEADER: {
            unsigned char **p = (unsigned char **) in, *end = (*p) + len;

            if (lws_add_http_header_by_name(wsi,
                                            (const unsigned char *) "user-agent:",
                                            (const unsigned char *) TJS__UA_STRING,
                                            (int) strlen(TJS__UA_STRING),
                                            p,
                                            end)) {
                return -1;
            }
            break;
        }

        default:
            break;
    }

    return 0;
}

static const struct lws_protocols tjs_http_load_protocol = {
    .name = TJS_LWS_HTTP_LOAD_PROTOCOL_NAME,
    .callback = tjs_lws_http_load_callback,
    .per_session_data_size = 0,
    .rx_buffer_size = 0,
};

static void tjs__lws_keepalive_cb(uv_async_t *handle) {
    /* No-op; the handle just keeps the loop alive when referenced. */
    (void) handle;
}

void tjs__lws_init(TJSRuntime *qrt) {
    const struct lws_protocols protocols[] = {
        tjs_http_protocol,
        tjs_ws_protocol,
        LWS_PROTOCOL_LIST_TERM,
    };

    struct lws_context_creation_info info;
    memset(&info, 0, sizeof(info));

    info.port = CONTEXT_PORT_NO_LISTEN;
    info.protocols = protocols;
    info.options = LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT | LWS_SERVER_OPTION_LIBUV;

    /* Use the existing libuv event loop. */
    void *foreign_loops[1] = { &qrt->loop };
    info.foreign_loops = foreign_loops;

    /* Embedded CA certificates for TLS. */
    info.client_ssl_ca_mem = tjs_cacert_pem;
    info.client_ssl_ca_mem_len = TJS_CACERT_PEM_LEN;

    /* Cookie jar path is set from JS via core.setCookieJarPath. */
    CHECK_NOT_NULL(qrt->lws.cookie_jar_path);
    info.http_nsc_filepath = qrt->lws.cookie_jar_path;

    lws_set_log_level(0, NULL);

    qrt->lws.ctx = lws_create_context(&info);

    /* Keepalive handle: stays unrefed when idle so the loop can exit,
     * gets refed while client connections are in flight to prevent
     * the loop from exiting during async DNS resolution. */
    uv_async_init(&qrt->loop, &qrt->lws.keepalive, tjs__lws_keepalive_cb);
    uv_unref((uv_handle_t *) &qrt->lws.keepalive);
    qrt->lws.active_conns = 0;
}

void tjs__lws_conn_ref(JSContext *ctx) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);
    if (qrt->lws.active_conns++ == 0) {
        uv_ref((uv_handle_t *) &qrt->lws.keepalive);
    }
}

void tjs__lws_conn_unref(JSContext *ctx) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);
    if (--qrt->lws.active_conns == 0) {
        uv_unref((uv_handle_t *) &qrt->lws.keepalive);
    }
}

struct lws_context *tjs__lws_get_context(JSContext *ctx) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);

    if (!qrt->lws.ctx) {
        tjs__lws_init(qrt);
    }

    return qrt->lws.ctx;
}

static int tjs__lws_load_http_once(TJSRuntime *qrt, TJSHttpLoadCtx *load_ctx, const char *url) {
    JSContext *ctx = qrt->ctx;

    load_ctx->status = -1;
    load_ctx->done = false;
    load_ctx->redirect_url[0] = '\0';

    /* Parse URL. lws_parse_uri modifies the string in-place. */
    char *url_copy = js_strdup(ctx, url);
    if (!url_copy) {
        return -1;
    }

    const char *prot_str, *ads, *path;
    int port;
    if (lws_parse_uri(url_copy, &prot_str, &ads, &port, &path)) {
        js_free(ctx, url_copy);
        return -1;
    }

    bool use_ssl = !strcmp(prot_str, "https");

    /* lws_parse_uri strips the leading '/' from path, restore it. */
    char full_path[JS__PATH_MAX];
    snprintf(full_path, sizeof(full_path), "/%s", path);

    /* Resolve DNS synchronously.  The lws async DNS resolver is
     * unreliable in a temporary poll-based context. */
    struct addrinfo hints;
    memset(&hints, 0, sizeof(hints));
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;

    uv_getaddrinfo_t dns_req;
    if (uv_getaddrinfo(&qrt->loop, &dns_req, NULL, ads, NULL, &hints)) {
        js_free(ctx, url_copy);
        return -1;
    }

    char ip_str[INET6_ADDRSTRLEN];
    if (dns_req.addrinfo->ai_family == AF_INET6) {
        struct sockaddr_in6 *sa6 = (struct sockaddr_in6 *) dns_req.addrinfo->ai_addr;
        uv_inet_ntop(AF_INET6, &sa6->sin6_addr, ip_str, sizeof(ip_str));
    } else {
        struct sockaddr_in *sa = (struct sockaddr_in *) dns_req.addrinfo->ai_addr;
        uv_inet_ntop(AF_INET, &sa->sin_addr, ip_str, sizeof(ip_str));
    }
    uv_freeaddrinfo(dns_req.addrinfo);

    const struct lws_protocols protocols[] = {
        tjs_http_load_protocol,
        LWS_PROTOCOL_LIST_TERM,
    };

    struct lws_context_creation_info info;
    memset(&info, 0, sizeof(info));

    info.port = CONTEXT_PORT_NO_LISTEN;
    info.protocols = protocols;
    info.options = LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT;
    info.client_ssl_ca_mem = tjs_cacert_pem;
    info.client_ssl_ca_mem_len = TJS_CACERT_PEM_LEN;

    lws_set_log_level(0, NULL);

    struct lws_context *lws_ctx = lws_create_context(&info);
    if (!lws_ctx) {
        js_free(ctx, url_copy);
        return -1;
    }

    struct lws_client_connect_info cci;
    memset(&cci, 0, sizeof(cci));

    cci.context = lws_ctx;
    cci.address = ip_str;
    cci.port = port;
    cci.path = full_path;
    cci.host = ads;
    cci.origin = ads;
    cci.ssl_connection = (use_ssl ? LCCSCF_USE_SSL : 0);
    cci.method = "GET";
    cci.local_protocol_name = TJS_LWS_HTTP_LOAD_PROTOCOL_NAME;
    cci.userdata = load_ctx;

    struct lws *wsi = lws_client_connect_via_info(&cci);

    if (!wsi) {
        lws_context_destroy(lws_ctx);
        js_free(ctx, url_copy);
        return -1;
    }

    uint64_t deadline = uv_hrtime() + (uint64_t) 10 * 1000000000;

    while (!load_ctx->done) {
        lws_service(lws_ctx, 250);
        if (uv_hrtime() >= deadline) {
            load_ctx->status = -2;
            load_ctx->done = true;
        }
    }

    lws_context_destroy(lws_ctx);

    /* Free after the context is destroyed. lws may reference strings
     * from url_copy during the connection handshake. */
    js_free(ctx, url_copy);

    return load_ctx->status;
}

#define TJS__MAX_REDIRECTS 20

int tjs__lws_load_http(TJSRuntime *qrt, DynBuf *dbuf, const char *url) {
    TJSHttpLoadCtx load_ctx = {
        .dbuf = dbuf,
    };

    const char *current_url = url;
    char retry_url[2048];

    for (int i = 0; i <= TJS__MAX_REDIRECTS; i++) {
        int status = tjs__lws_load_http_once(qrt, &load_ctx, current_url);

        /* Success or no redirect captured — we're done. */
        if (status == 200 || load_ctx.redirect_url[0] == '\0') {
            return status;
        }

        /* lws's built-in redirect failed (cross-host). Retry with
         * the captured redirect URL and a fresh lws context. */
        lws_strncpy(retry_url, load_ctx.redirect_url, sizeof(retry_url));
        current_url = retry_url;
        dbuf->size = 0;
    }

    return -1;
}

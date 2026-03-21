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
#include "mem.h"
#include "private.h"
#include "version.h"

#include <string.h>

#ifdef _MSC_VER
#define strtok_r strtok_s
#endif

#define TJS__UA_STRING                                                                                                 \
    "txiki.js/" STRINGIFY(TJS_VERSION_MAJOR) "." STRINGIFY(TJS_VERSION_MINOR) "." STRINGIFY(TJS_VERSION_PATCH)         \
        TJS_VERSION_SUFFIX

extern const struct lws_protocols tjs_ws_protocol;
extern const struct lws_protocols tjs_http_protocol;

#define TJS_LWS_HTTP_LOAD_PROTOCOL_NAME "tjs-http-load"

typedef struct {
    TBuf *dbuf;
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
            if (tbuf_put(ctx->dbuf, (const uint8_t *) in, len)) {
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

static void *tjs__lws_realloc(void *ptr, size_t size, const char *reason) {
    (void) reason;
    if (size == 0) {
        tjs__free(ptr);
        return NULL;
    }
    if (ptr == NULL) {
        return tjs__malloc(size);
    }
    return tjs__realloc(ptr, size);
}

static void tjs__load_ca_bundle(TJSRuntime *qrt) {
    if (qrt->lws.ca_bundle_data || !qrt->lws.ca_bundle_path) {
        return;
    }

    TBuf dbuf;
    tbuf_init(qrt->ctx, &dbuf);

    if (tjs__load_file(qrt->ctx, &dbuf, qrt->lws.ca_bundle_path) == 0 && dbuf.size > 0) {
        qrt->lws.ca_bundle_data = dbuf.buf;
        qrt->lws.ca_bundle_len = (unsigned int) dbuf.size;
    } else {
        tbuf_free(&dbuf);
    }
}

static void tjs__set_ca_info(TJSRuntime *qrt, struct lws_context_creation_info *info) {
    tjs__load_ca_bundle(qrt);

    if (qrt->lws.ca_bundle_data) {
        info->client_ssl_ca_mem = qrt->lws.ca_bundle_data;
        info->client_ssl_ca_mem_len = qrt->lws.ca_bundle_len;
    } else {
        info->client_ssl_ca_mem = tjs_cacert_pem;
        info->client_ssl_ca_mem_len = TJS_CACERT_PEM_LEN;
    }
}

/*
 * Per-scheme proxy configuration.
 *
 * Work around a bug in lws_set_proxy() where the proxy address is not
 * null-terminated after parsing the port, causing crashes in async DNS.
 * We parse the env vars ourselves and pass the host and port separately
 * via lws_context_creation_info.  When http_proxy_address is set in the
 * info struct, lws skips its own getenv("http_proxy") code path.
 */
typedef struct {
    char auth_address[512]; /* "user:pass@host" or "host" (for lws_set_proxy) */
    char hostname[256];     /* just host (for no_proxy matching) */
    unsigned int port;
} TJSProxyConfig;

static bool tjs__try_proxy_env(const char *name, char *buf, size_t bufsize) {
    size_t size = bufsize;

    return uv_os_getenv(name, buf, &size) == 0 && size > 0;
}

static bool tjs__parse_proxy_url(const char *env_name1, const char *env_name2, TJSProxyConfig *out) {
    memset(out, 0, sizeof(*out));

    char buf[512];

    if (!tjs__try_proxy_env(env_name1, buf, sizeof(buf)) &&
        (!env_name2 || !tjs__try_proxy_env(env_name2, buf, sizeof(buf)))) {
        return false;
    }

    /* lws_parse_uri modifies the string in-place. */
    const char *prot, *ads, *path;
    int port;

    if (lws_parse_uri(buf, &prot, &ads, &port, &path)) {
        return false;
    }

    lws_strncpy(out->auth_address, ads, sizeof(out->auth_address));
    out->port = (unsigned int) port;

    /* If ads contains '@', auth is present — extract just the hostname. */
    const char *at = strchr(ads, '@');
    if (at) {
        lws_strncpy(out->hostname, at + 1, sizeof(out->hostname));
    } else {
        lws_strncpy(out->hostname, ads, sizeof(out->hostname));
    }

    return out->port > 0 && out->auth_address[0];
}

static void tjs__parse_no_proxy(TJSRuntime *qrt) {
    char buf[2048];

    if (!tjs__try_proxy_env("no_proxy", buf, sizeof(buf)) && !tjs__try_proxy_env("NO_PROXY", buf, sizeof(buf))) {
        return;
    }

    /* Count entries (comma-separated). */
    int count = 1;
    for (const char *p = buf; *p; p++) {
        if (*p == ',') {
            count++;
        }
    }

    qrt->lws.no_proxy_entries = js_mallocz(qrt->ctx, count * sizeof(char *));
    if (!qrt->lws.no_proxy_entries) {
        return;
    }

    int idx = 0;
    char *saveptr = NULL;
    char *token = strtok_r(buf, ",", &saveptr);

    while (token && idx < count) {
        /* Trim leading whitespace. */
        while (*token == ' ') {
            token++;
        }

        /* Trim trailing whitespace. */
        size_t len = strlen(token);
        while (len > 0 && token[len - 1] == ' ') {
            len--;
        }

        if (len == 0) {
            token = strtok_r(NULL, ",", &saveptr);
            continue;
        }

        if (len == 1 && token[0] == '*') {
            qrt->lws.no_proxy_wildcard = true;
            token = strtok_r(NULL, ",", &saveptr);
            continue;
        }

        qrt->lws.no_proxy_entries[idx] = js_strndup(qrt->ctx, token, len);
        idx++;
        token = strtok_r(NULL, ",", &saveptr);
    }

    qrt->lws.no_proxy_count = idx;
}

static bool tjs__proxy_configs_equal(const TJSProxyConfig *a, const TJSProxyConfig *b) {
    return a->port == b->port && !strcmp(a->auth_address, b->auth_address);
}

static struct lws_vhost *tjs__create_client_vhost(TJSRuntime *qrt, const char *name, const TJSProxyConfig *proxy) {
    const struct lws_protocols protocols[] = {
        tjs_http_protocol,
        tjs_ws_protocol,
        LWS_PROTOCOL_LIST_TERM,
    };

    struct lws_context_creation_info vinfo;
    memset(&vinfo, 0, sizeof(vinfo));

    vinfo.port = CONTEXT_PORT_NO_LISTEN;
    vinfo.protocols = protocols;
    vinfo.options = LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT;
    vinfo.vhost_name = name;
    vinfo.pt_serv_buf_size = 16384;
    vinfo.max_http_header_data2 = 16384;

    tjs__set_ca_info(qrt, &vinfo);

    if (proxy) {
        vinfo.http_proxy_address = proxy->auth_address;
        vinfo.http_proxy_port = proxy->port;
    } else {
        /* Force no proxy: set empty address so lws_set_proxy fails
         * silently and the vhost has no proxy configured. */
        vinfo.http_proxy_address = "";
        vinfo.http_proxy_port = 0;
    }

    return lws_create_vhost(qrt->lws.ctx, &vinfo);
}

void tjs__lws_init(TJSRuntime *qrt) {
    struct lws_context_creation_info info;
    memset(&info, 0, sizeof(info));

    info.port = CONTEXT_PORT_NO_LISTEN;
    info.options = LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT | LWS_SERVER_OPTION_LIBUV | LWS_SERVER_OPTION_EXPLICIT_VHOSTS;
    /* Match Node.js / Deno default max header size (16 KiB). */
    info.pt_serv_buf_size = 16384;
    info.max_http_header_data2 = 16384;

    /* Use the existing libuv event loop. */
    void *foreign_loops[1] = { &qrt->loop };
    info.foreign_loops = foreign_loops;

    /* Cookie jar is context-level in lws, must be set here. */
    CHECK_NOT_NULL(qrt->lws.cookie_jar_path);
    info.http_nsc_filepath = qrt->lws.cookie_jar_path;

    lws_set_log_level(0, NULL);
    lws_set_allocator(tjs__lws_realloc);

    qrt->lws.ctx = lws_create_context(&info);

    /* Parse per-scheme proxy settings. */
    TJSProxyConfig http_proxy, https_proxy;
    bool have_http = tjs__parse_proxy_url("http_proxy", "HTTP_PROXY", &http_proxy);
    bool have_https = tjs__parse_proxy_url("https_proxy", "HTTPS_PROXY", &https_proxy);

    /* Fall back to all_proxy / ALL_PROXY. */
    if (!have_http) {
        have_http = tjs__parse_proxy_url("all_proxy", "ALL_PROXY", &http_proxy);
    }

    if (!have_https) {
        have_https = tjs__parse_proxy_url("all_proxy", "ALL_PROXY", &https_proxy);
    }

    /* Parse no_proxy. */
    tjs__parse_no_proxy(qrt);

    /* Create client vhosts. */
    qrt->lws.vh_direct = tjs__create_client_vhost(qrt, "tjs-direct", NULL);

    if (have_http) {
        qrt->lws.vh_http_proxy = tjs__create_client_vhost(qrt, "tjs-http-proxy", &http_proxy);
    }

    if (have_https) {
        /* Reuse the http-proxy vhost if configs are identical. */
        if (have_http && tjs__proxy_configs_equal(&http_proxy, &https_proxy)) {
            qrt->lws.vh_https_proxy = qrt->lws.vh_http_proxy;
        } else {
            qrt->lws.vh_https_proxy = tjs__create_client_vhost(qrt, "tjs-https-proxy", &https_proxy);
        }
    }

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

static bool tjs__hostname_matches_no_proxy(const char *hostname, int port, const char *entry) {
    /* Check for port-specific entry: "host:port". */
    const char *colon = strrchr(entry, ':');
    int entry_port = 0;
    size_t entry_host_len;

    if (colon && colon != entry) {
        entry_port = atoi(colon + 1);
        entry_host_len = (size_t) (colon - entry);
    } else {
        entry_host_len = strlen(entry);
    }

    /* If the entry specifies a port, it must match. */
    if (entry_port > 0 && entry_port != port) {
        return false;
    }

    size_t hlen = strlen(hostname);

    if (entry[0] == '.') {
        /* Suffix match: ".example.com" matches "foo.example.com" and "example.com". */
        if (hlen >= entry_host_len && !strncasecmp(hostname + hlen - entry_host_len, entry, entry_host_len)) {
            return true;
        }

        /* Also match bare domain: ".example.com" matches "example.com". */
        if (hlen == entry_host_len - 1 && !strncasecmp(hostname, entry + 1, hlen)) {
            return true;
        }

        return false;
    }

    /* Exact case-insensitive match on the hostname part. */
    return hlen == entry_host_len && !strncasecmp(hostname, entry, entry_host_len);
}

struct lws_vhost *tjs__lws_select_vhost(JSContext *ctx, const char *scheme, const char *hostname, int port) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);

    /* Check no_proxy list. */
    if (qrt->lws.no_proxy_wildcard) {
        return qrt->lws.vh_direct;
    }

    for (int i = 0; i < qrt->lws.no_proxy_count; i++) {
        if (tjs__hostname_matches_no_proxy(hostname, port, qrt->lws.no_proxy_entries[i])) {
            return qrt->lws.vh_direct;
        }
    }

    /* Select proxy vhost based on scheme. */
    if (!strcmp(scheme, "http") || !strcmp(scheme, "ws")) {
        return qrt->lws.vh_http_proxy ? qrt->lws.vh_http_proxy : qrt->lws.vh_direct;
    }

    if (!strcmp(scheme, "https") || !strcmp(scheme, "wss")) {
        return qrt->lws.vh_https_proxy ? qrt->lws.vh_https_proxy : qrt->lws.vh_direct;
    }

    return qrt->lws.vh_direct;
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
    char full_path[TJS_PATH_MAX];
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

    tjs__set_ca_info(qrt, &info);

    /* Parse per-scheme proxy for this one-shot context. */
    TJSProxyConfig proxy_cfg;
    bool have_proxy = false;

    if (use_ssl) {
        have_proxy = tjs__parse_proxy_url("https_proxy", "HTTPS_PROXY", &proxy_cfg);
    } else {
        have_proxy = tjs__parse_proxy_url("http_proxy", "HTTP_PROXY", &proxy_cfg);
    }

    if (!have_proxy) {
        have_proxy = tjs__parse_proxy_url("all_proxy", "ALL_PROXY", &proxy_cfg);
    }

    /* Check no_proxy. */
    if (have_proxy) {
        char no_proxy_buf[2048];
        if (tjs__try_proxy_env("no_proxy", no_proxy_buf, sizeof(no_proxy_buf)) ||
            tjs__try_proxy_env("NO_PROXY", no_proxy_buf, sizeof(no_proxy_buf))) {
            char *saveptr = NULL;
            char *token = strtok_r(no_proxy_buf, ",", &saveptr);

            while (token) {
                while (*token == ' ') {
                    token++;
                }

                size_t tlen = strlen(token);
                while (tlen > 0 && token[tlen - 1] == ' ') {
                    tlen--;
                }

                if (tlen == 1 && token[0] == '*') {
                    have_proxy = false;
                    break;
                }

                char entry[256];
                if (tlen < sizeof(entry)) {
                    memcpy(entry, token, tlen);
                    entry[tlen] = '\0';
                    if (tjs__hostname_matches_no_proxy(ads, port, entry)) {
                        have_proxy = false;
                        break;
                    }
                }

                token = strtok_r(NULL, ",", &saveptr);
            }
        }
    }

    if (have_proxy) {
        info.http_proxy_address = proxy_cfg.auth_address;
        info.http_proxy_port = proxy_cfg.port;
    }

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

int tjs__lws_load_http(TJSRuntime *qrt, TBuf *dbuf, const char *url) {
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

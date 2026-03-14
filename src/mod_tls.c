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
#include "quickjs.h"
#include "utils.h"

#include <mbedtls/ctr_drbg.h>
#include <mbedtls/entropy.h>
#include <mbedtls/error.h>
#include <mbedtls/pk.h>
#include <mbedtls/ssl.h>
#include <mbedtls/x509_crt.h>
#include <string.h>

/* ---- Ring buffer for encrypted data between libuv and mbedtls ---- */

#define TLS_BUF_INITIAL_SIZE 16384

typedef struct {
    uint8_t *data;
    size_t capacity;
    size_t head; /* read position */
    size_t len;  /* bytes available */
} TJSTlsBuf;

static void tjs_tlsbuf_init(TJSTlsBuf *buf) {
    memset(buf, 0, sizeof(*buf));
}

static void tjs_tlsbuf_free(TJSTlsBuf *buf) {
    tjs__free(buf->data);
    memset(buf, 0, sizeof(*buf));
}

static int tjs_tlsbuf_ensure(TJSTlsBuf *buf, size_t need) {
    if (buf->capacity >= need) {
        return 0;
    }
    size_t cap = buf->capacity ? buf->capacity : TLS_BUF_INITIAL_SIZE;
    while (cap < need) {
        cap *= 2;
    }
    uint8_t *p = tjs__realloc(buf->data, cap);
    if (!p) {
        return -1;
    }
    /* linearize: move head to 0 */
    if (buf->head > 0 && buf->len > 0) {
        memmove(p, p + buf->head, buf->len);
        buf->head = 0;
    }
    buf->data = p;
    buf->capacity = cap;
    return 0;
}

static int tjs_tlsbuf_write(TJSTlsBuf *buf, const uint8_t *data, size_t len) {
    if (len == 0) {
        return 0;
    }
    size_t tail = buf->head + buf->len;
    if (tjs_tlsbuf_ensure(buf, tail + len)) {
        return -1;
    }
    tail = buf->head + buf->len;
    memcpy(buf->data + tail, data, len);
    buf->len += len;
    return 0;
}

static size_t tjs_tlsbuf_read(TJSTlsBuf *buf, uint8_t *out, size_t len) {
    size_t n = len < buf->len ? len : buf->len;
    if (n == 0) {
        return 0;
    }
    memcpy(out, buf->data + buf->head, n);
    buf->head += n;
    buf->len -= n;
    if (buf->len == 0) {
        buf->head = 0; /* reset */
    }
    return n;
}

/* ---- TLS state ---- */

enum {
    TLS_STATE_INIT = 0,
    TLS_STATE_HANDSHAKING,
    TLS_STATE_ESTABLISHED,
    TLS_STATE_CLOSING,
    TLS_STATE_CLOSED,
    TLS_STATE_ERROR,
};

enum {
    TLS_CB_READ = 0,
    TLS_CB_WRITE,
    TLS_CB_CONNECT,
    TLS_CB_CONNECTION,
    TLS_CB_SHUTDOWN,
    TLS_CB_MAX,
};

typedef struct TJSTlsStream {
    JSContext *ctx;
    int closed;
    int finalized;
    uv_tcp_t tcp;

    /* mbedtls — entropy/DRBG/default CA shared via TJSRuntime.tls */
    mbedtls_ssl_context ssl;
    mbedtls_ssl_config conf;
    mbedtls_x509_crt cacert;    /* per-socket CA override (if user provides 'ca') */
    mbedtls_x509_crt own_cert;  /* server cert or client mTLS cert */
    mbedtls_pk_context own_key; /* server key or client mTLS key */
    bool has_own_ca;

    /* BIO buffers */
    TJSTlsBuf bio_in;
    TJSTlsBuf bio_out;

    int tls_state;
    bool is_server;

    /* ALPN protocols (kept alive for mbedtls which stores pointers, not copies) */
    char **alpn_protocols;

    /* Cached PEM for server — re-parsed into each accepted client's SSL config */
    char *cert_pem;
    char *key_pem;

    JSValue obj;    /* own JS object — needed to pass to callbacks from libuv */
    JSValue server; /* accepted clients only: server ref during handshake */

    uv_write_t write_req;

    JSValue callbacks[TLS_CB_MAX];

    /* Fixed read buffer — encrypted data is always copied into bio_in */
    uint8_t read_buf[65536];
} TJSTlsStream;

static JSClassID tjs_tls_class_id;

static TJSTlsStream *tjs_tls_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_tls_class_id);
}

/* Forward declarations */
static JSValue tjs_new_tls_from_server(JSContext *ctx, TJSTlsStream *server);
static void tjs_tls_handshake(TJSTlsStream *s);
static void tjs_tls_server_handshake(TJSTlsStream *s);
static void tjs_tls_flush_bio_out(TJSTlsStream *s);
static void tjs_tls_complete_accept(TJSTlsStream *client, JSValue error);
static void maybe_invoke_tls_callback(TJSTlsStream *s, int callback, int argc, JSValue *argv);

/* ---- Shared TLS context init ---- */

static int tjs_tls_ctx_init(JSContext *ctx) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    if (qrt->tls.initialized) {
        return 0;
    }

    mbedtls_entropy_init(&qrt->tls.entropy);
    mbedtls_ctr_drbg_init(&qrt->tls.ctr_drbg);

    int ret = mbedtls_ctr_drbg_seed(&qrt->tls.ctr_drbg,
                                    mbedtls_entropy_func,
                                    &qrt->tls.entropy,
                                    (const unsigned char *) "txiki.js",
                                    8);
    if (ret != 0) {
        mbedtls_ctr_drbg_free(&qrt->tls.ctr_drbg);
        mbedtls_entropy_free(&qrt->tls.entropy);
        return ret;
    }

    mbedtls_x509_crt_init(&qrt->tls.cacert);

    /* Load CA bundle: custom path first, then embedded. */
    if (qrt->tls.ca_bundle_path) {
        TBuf dbuf;
        tbuf_init(ctx, &dbuf);
        if (tjs__load_file(ctx, &dbuf, qrt->tls.ca_bundle_path) == 0 && dbuf.size > 0) {
            mbedtls_x509_crt_parse(&qrt->tls.cacert, dbuf.buf, dbuf.size);
        }
        tbuf_free(&dbuf);
    }

    /* Always also parse the embedded bundle. */
    mbedtls_x509_crt_parse(&qrt->tls.cacert, (const unsigned char *) tjs_cacert_pem, TJS_CACERT_PEM_LEN + 1);

    qrt->tls.initialized = true;
    return 0;
}

/* ---- mbedtls BIO callbacks ---- */

static int tjs_tls_bio_recv(void *opaque, unsigned char *buf, size_t len) {
    TJSTlsStream *s = opaque;
    if (s->bio_in.len == 0) {
        return MBEDTLS_ERR_SSL_WANT_READ;
    }
    size_t n = tjs_tlsbuf_read(&s->bio_in, buf, len);
    return (int) n;
}

static int tjs_tls_bio_send(void *opaque, const unsigned char *buf, size_t len) {
    TJSTlsStream *s = opaque;
    if (tjs_tlsbuf_write(&s->bio_out, buf, len)) {
        return MBEDTLS_ERR_SSL_ALLOC_FAILED;
    }
    return (int) len;
}

static void uv__tls_write_cb(uv_write_t *req, int status) {
    TJSTlsStream *s = req->handle->data;
    CHECK_NOT_NULL(s);

    tjs__free(req->data);
    req->data = NULL;

    if (status < 0) {
        int prev_state = s->tls_state;
        s->tls_state = TLS_STATE_ERROR;
        if (prev_state == TLS_STATE_HANDSHAKING) {
            /* Fail the handshake via the appropriate path. */
            JSValue err = tjs_new_error(s->ctx, status);
            if (s->is_server) {
                tjs_tls_complete_accept(s, err);
            } else {
                maybe_invoke_tls_callback(s, TLS_CB_CONNECT, 1, &err);
            }
        } else {
            JSValue arg = tjs_new_error(s->ctx, status);
            maybe_invoke_tls_callback(s, TLS_CB_WRITE, 1, &arg);
        }
        return;
    }

    /* More data may have been appended to bio_out while the write was in flight
     * (e.g. handshake messages from a read callback). Flush again if needed. */
    if (s->bio_out.len > 0) {
        tjs_tls_flush_bio_out(s);
        return;
    }

    /* Notify JS that the write completed (only meaningful after handshake). */
    if (s->tls_state == TLS_STATE_ESTABLISHED) {
        JSValue arg = JS_UNDEFINED;
        maybe_invoke_tls_callback(s, TLS_CB_WRITE, 1, &arg);
    }
}

static void tjs_tls_flush_bio_out(TJSTlsStream *s) {
    if (s->bio_out.len == 0 || s->write_req.data || s->closed) {
        return;
    }

    /* Copy data out of bio_out before sending. This is necessary because
     * bio_out may be reallocated while the write is in flight (e.g. handshake
     * messages appended from a read callback), which would invalidate the pointer. */
    size_t len = s->bio_out.len;
    uint8_t *data = tjs__malloc(len);
    if (!data) {
        return;
    }
    tjs_tlsbuf_read(&s->bio_out, data, len);

    s->write_req.data = data;

    uv_buf_t buf = uv_buf_init((char *) data, len);
    int r = uv_write(&s->write_req, (uv_stream_t *) &s->tcp, &buf, 1, uv__tls_write_cb);
    if (r != 0) {
        tjs__free(data);
        s->write_req.data = NULL;
    }
}

static void maybe_invoke_tls_callback(TJSTlsStream *s, int callback, int argc, JSValue *argv) {
    JSContext *ctx = s->ctx;
    JSValue func = s->callbacks[callback];
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

static void uv__tls_alloc_cb(uv_handle_t *handle, size_t suggested_size, uv_buf_t *buf) {
    TJSTlsStream *s = handle->data;
    CHECK_NOT_NULL(s);
    buf->base = (char *) s->read_buf;
    buf->len = sizeof(s->read_buf);
}

static void uv__tls_read_cb(uv_stream_t *handle, ssize_t nread, const uv_buf_t *buf) {
    TJSTlsStream *s = handle->data;
    CHECK_NOT_NULL(s);

    JSContext *ctx = s->ctx;

    if (nread == 0) {
        return; /* EAGAIN */
    }

    if (nread < 0) {
        if (s->tls_state == TLS_STATE_HANDSHAKING) {
            s->tls_state = TLS_STATE_ERROR;
            JSValue err = tjs_new_error(ctx, nread);
            if (s->is_server) {
                tjs_tls_complete_accept(s, err);
            } else {
                maybe_invoke_tls_callback(s, TLS_CB_CONNECT, 1, &err);
            }
            return;
        }

        if (nread == UV_EOF) {
            JSValue args[2] = { JS_NULL, JS_UNDEFINED };
            maybe_invoke_tls_callback(s, TLS_CB_READ, 2, args);
        } else {
            JSValue args[2] = { JS_UNDEFINED, tjs_new_error(ctx, nread) };
            maybe_invoke_tls_callback(s, TLS_CB_READ, 2, args);
        }
        return;
    }

    /* Push encrypted data into bio_in */
    tjs_tlsbuf_write(&s->bio_in, (uint8_t *) buf->base, nread);

    if (s->tls_state == TLS_STATE_HANDSHAKING) {
        if (s->is_server) {
            tjs_tls_server_handshake(s);
        } else {
            tjs_tls_handshake(s);
        }
        return;
    }

    /* Read decrypted data */
    for (;;) {
        uint8_t *plaintext = js_malloc(ctx, 16384);
        if (!plaintext) {
            break;
        }

        int ret = mbedtls_ssl_read(&s->ssl, plaintext, 16384);
        if (ret > 0) {
            JSValue data = TJS_NewUint8Array(ctx, plaintext, ret);
            JSValue args[2] = { data, JS_UNDEFINED };
            maybe_invoke_tls_callback(s, TLS_CB_READ, 2, args);
        } else {
            js_free(ctx, plaintext);
            if (ret == 0 || ret == MBEDTLS_ERR_SSL_PEER_CLOSE_NOTIFY) {
                JSValue args[2] = { JS_NULL, JS_UNDEFINED };
                maybe_invoke_tls_callback(s, TLS_CB_READ, 2, args);
            }
            /* MBEDTLS_ERR_SSL_WANT_READ means we need more data */
            break;
        }
    }
}

/* For server-accepted clients: notify the server's onconnection callback
 * with either (undefined, clientObj) on success or (error, undefined) on failure.
 * Releases the held JS references. */
static void tjs_tls_complete_accept(TJSTlsStream *client, JSValue error) {
    JSContext *ctx = client->ctx;

    /* Take ownership of the held references, then clear the fields. */
    JSValue server_ref = JS_DupValue(ctx, client->server);
    JS_FreeValue(ctx, client->server);
    client->server = JS_UNDEFINED;

    JSValue self_ref = JS_DupValue(ctx, client->obj);
    JS_FreeValue(ctx, client->obj);
    client->obj = JS_UNDEFINED;

    TJSTlsStream *server = tjs_tls_get(ctx, server_ref);
    if (!server) {
        JS_FreeValue(ctx, server_ref);
        JS_FreeValue(ctx, self_ref);
        JS_FreeValue(ctx, error);
        return;
    }

    JSValue args[2];
    if (JS_IsUndefined(error)) {
        args[0] = JS_UNDEFINED;
        args[1] = self_ref;
    } else {
        args[0] = error;
        args[1] = JS_UNDEFINED;
        JS_FreeValue(ctx, self_ref);
    }

    maybe_invoke_tls_callback(server, TLS_CB_CONNECTION, 2, args);
    JS_FreeValue(ctx, server_ref);
}

static JSValue tjs_tls_handshake_error(TJSTlsStream *s, int ret) {
    char errbuf[128];
    mbedtls_strerror(ret, errbuf, sizeof(errbuf));
    JSValue err = JS_NewError(s->ctx);
    JS_DefinePropertyValueStr(s->ctx, err, "message", JS_NewString(s->ctx, errbuf), JS_PROP_C_W_E);
    return err;
}

/* Client-only: drive the TLS handshake, fire onconnect when done. */
static void tjs_tls_handshake(TJSTlsStream *s) {
    int ret = mbedtls_ssl_handshake(&s->ssl);

    if (ret == 0) {
        s->tls_state = TLS_STATE_ESTABLISHED;
        tjs_tls_flush_bio_out(s);
        JSValue arg = JS_UNDEFINED;
        maybe_invoke_tls_callback(s, TLS_CB_CONNECT, 1, &arg);
    } else if (ret == MBEDTLS_ERR_SSL_WANT_READ || ret == MBEDTLS_ERR_SSL_WANT_WRITE) {
        tjs_tls_flush_bio_out(s);
    } else {
        s->tls_state = TLS_STATE_ERROR;
        tjs_tls_flush_bio_out(s);
        JSValue err = tjs_tls_handshake_error(s, ret);
        maybe_invoke_tls_callback(s, TLS_CB_CONNECT, 1, &err);
    }
}

/* Server-accepted client: drive the TLS handshake, fire onconnection on the server when done. */
static void tjs_tls_server_handshake(TJSTlsStream *s) {
    int ret = mbedtls_ssl_handshake(&s->ssl);

    if (ret == 0) {
        s->tls_state = TLS_STATE_ESTABLISHED;
        tjs_tls_flush_bio_out(s);
        /* Stop reading — JS will restart via startRead when it creates the ReadableStream. */
        uv_read_stop((uv_stream_t *) &s->tcp);
        tjs_tls_complete_accept(s, JS_UNDEFINED);
    } else if (ret == MBEDTLS_ERR_SSL_WANT_READ || ret == MBEDTLS_ERR_SSL_WANT_WRITE) {
        tjs_tls_flush_bio_out(s);
    } else {
        s->tls_state = TLS_STATE_ERROR;
        tjs_tls_flush_bio_out(s);
        uv_read_stop((uv_stream_t *) &s->tcp);
        tjs_tls_complete_accept(s, tjs_tls_handshake_error(s, ret));
    }
}

static void uv__tls_connect_cb(uv_connect_t *req, int status) {
    TJSTlsStream *s = req->handle->data;
    CHECK_NOT_NULL(s);

    JSContext *ctx = s->ctx;
    js_free(ctx, req);

    if (status != 0) {
        JSValue arg = tjs_new_error(ctx, status);
        maybe_invoke_tls_callback(s, TLS_CB_CONNECT, 1, &arg);
        return;
    }

    /* TCP connected — start TLS handshake */
    s->tls_state = TLS_STATE_HANDSHAKING;
    int r = uv_read_start((uv_stream_t *) &s->tcp, uv__tls_alloc_cb, uv__tls_read_cb);
    if (r != 0) {
        s->tls_state = TLS_STATE_ERROR;
        JSValue arg = tjs_new_error(ctx, r);
        maybe_invoke_tls_callback(s, TLS_CB_CONNECT, 1, &arg);
        return;
    }
    tjs_tls_handshake(s);
}

static JSValue tjs_tls_connect(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSTlsStream *s = tjs_tls_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }

    struct sockaddr_storage ss;
    int r = tjs_obj2addr(ctx, argv[0], &ss);
    if (r != 0) {
        return JS_EXCEPTION;
    }

    uv_connect_t *req = js_malloc(ctx, sizeof(*req));
    if (!req) {
        return JS_EXCEPTION;
    }

    r = uv_tcp_connect(req, &s->tcp, (struct sockaddr *) &ss, uv__tls_connect_cb);
    if (r != 0) {
        js_free(ctx, req);
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

static void uv__tls_connection_cb(uv_stream_t *handle, int status) {
    TJSTlsStream *server = handle->data;
    CHECK_NOT_NULL(server);

    if (!JS_IsFunction(server->ctx, server->callbacks[TLS_CB_CONNECTION])) {
        return;
    }

    JSContext *ctx = server->ctx;
    JSValue args[2], obj;

    if (status != 0) {
        args[0] = tjs_new_error(ctx, status);
        args[1] = JS_UNDEFINED;
        maybe_invoke_tls_callback(server, TLS_CB_CONNECTION, 2, args);
        return;
    }

    /* Create a new TLSTcp for the client, sharing server's cert/key config */
    obj = tjs_new_tls_from_server(ctx, server);
    if (JS_IsException(obj)) {
        JSValue err = JS_GetException(ctx);
        args[0] = err;
        args[1] = JS_UNDEFINED;
        maybe_invoke_tls_callback(server, TLS_CB_CONNECTION, 2, args);
        return;
    }

    TJSTlsStream *client = tjs_tls_get(ctx, obj);

    int r = uv_accept(handle, (uv_stream_t *) &client->tcp);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        args[0] = tjs_new_error(ctx, r);
        args[1] = JS_UNDEFINED;
        maybe_invoke_tls_callback(server, TLS_CB_CONNECTION, 2, args);
        return;
    }

    /* Store references so the handshake completion can call onconnection
     * on the server. */
    client->server = JS_DupValue(ctx, server->obj);
    client->obj = obj;

    /* Start reading encrypted data. The handshake will be driven by
     * uv__tls_read_cb when the ClientHello arrives.
     * onconnection will be called from tjs_tls_complete_accept when done. */
    client->tls_state = TLS_STATE_HANDSHAKING;
    int ret = uv_read_start((uv_stream_t *) &client->tcp, uv__tls_alloc_cb, uv__tls_read_cb);
    if (ret != 0) {
        client->tls_state = TLS_STATE_ERROR;
        tjs_tls_complete_accept(client, tjs_new_error(ctx, ret));
    }
}

static JSValue tjs_tls_bind(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSTlsStream *s = tjs_tls_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }

    struct sockaddr_storage ss;
    int r = tjs_obj2addr(ctx, argv[0], &ss);
    if (r != 0) {
        return JS_EXCEPTION;
    }

    int flags = 0;
    if (!JS_IsUndefined(argv[1]) && JS_ToInt32(ctx, &flags, argv[1])) {
        return JS_EXCEPTION;
    }

    r = uv_tcp_bind(&s->tcp, (struct sockaddr *) &ss, flags);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_tls_listen(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSTlsStream *s = tjs_tls_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }

    uint32_t backlog = 511;
    if (!JS_IsUndefined(argv[0]) && JS_ToUint32(ctx, &backlog, argv[0])) {
        return JS_EXCEPTION;
    }

    /* Store our own JS object so that the connection callback can reference it. */
    s->obj = JS_DupValue(ctx, this_val);

    int r = uv_listen((uv_stream_t *) &s->tcp, (int) backlog, uv__tls_connection_cb);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_tls_start_read(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSTlsStream *s = tjs_tls_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }
    if (uv_is_closing((uv_handle_t *) &s->tcp)) {
        return JS_ThrowInternalError(ctx, "stream is closed");
    }
    int r = uv_read_start((uv_stream_t *) &s->tcp, uv__tls_alloc_cb, uv__tls_read_cb);
    /* UV_EALREADY: reading was already started during TLS handshake — not an error. */
    if (r != 0 && r != UV_EALREADY) {
        return tjs_throw_errno(ctx, r);
    }
    return JS_UNDEFINED;
}

static JSValue tjs_tls_stop_read(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSTlsStream *s = tjs_tls_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }
    if (uv_is_closing((uv_handle_t *) &s->tcp)) {
        return JS_UNDEFINED;
    }
    uv_read_stop((uv_stream_t *) &s->tcp);
    return JS_UNDEFINED;
}

static JSValue tjs_tls_write(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSTlsStream *s = tjs_tls_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }
    if (s->tls_state != TLS_STATE_ESTABLISHED) {
        return JS_ThrowInternalError(ctx, "TLS not established");
    }
    if (uv_is_closing((uv_handle_t *) &s->tcp)) {
        return JS_ThrowInternalError(ctx, "stream is closed");
    }

    TJSBufferRef buf_ref;
    if (tjs_buf_ref_get(ctx, argv[0], &buf_ref)) {
        return JS_EXCEPTION;
    }

    int ret = mbedtls_ssl_write(&s->ssl, buf_ref.data, buf_ref.size);
    tjs_buf_ref_release(ctx, &buf_ref);

    if (ret < 0) {
        char errbuf[128];
        mbedtls_strerror(ret, errbuf, sizeof(errbuf));
        return JS_ThrowInternalError(ctx, "TLS write failed: %s", errbuf);
    }

    tjs_tls_flush_bio_out(s);

    /* The plaintext was encrypted into bio_out and flush was started.
     * Return undefined — onwrite will fire when the network write completes. */
    return JS_UNDEFINED;
}

static void uv__tls_shutdown_cb(uv_shutdown_t *req, int status) {
    TJSTlsStream *s = req->handle->data;
    CHECK_NOT_NULL(s);

    JSContext *ctx = s->ctx;
    JSValue arg = (status == 0) ? JS_UNDEFINED : tjs_new_error(ctx, status);
    maybe_invoke_tls_callback(s, TLS_CB_SHUTDOWN, 1, &arg);
    js_free(ctx, req);
}

static JSValue tjs_tls_shutdown(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSTlsStream *s = tjs_tls_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }
    if (uv_is_closing((uv_handle_t *) &s->tcp)) {
        return JS_ThrowInternalError(ctx, "stream is closed");
    }

    /* Guard against double shutdown. */
    if (s->tls_state == TLS_STATE_CLOSING || s->tls_state == TLS_STATE_CLOSED) {
        return JS_UNDEFINED;
    }

    if (s->tls_state == TLS_STATE_ESTABLISHED) {
        s->tls_state = TLS_STATE_CLOSING;
        mbedtls_ssl_close_notify(&s->ssl);
        tjs_tls_flush_bio_out(s);
    }

    uv_shutdown_t *req = js_malloc(ctx, sizeof(*req));
    if (!req) {
        return JS_EXCEPTION;
    }

    int r = uv_shutdown(req, (uv_stream_t *) &s->tcp, uv__tls_shutdown_cb);
    if (r != 0) {
        js_free(ctx, req);
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

static void uv__tls_close_cb(uv_handle_t *handle) {
    TJSTlsStream *s = handle->data;
    CHECK_NOT_NULL(s);
    s->closed = 1;
    if (s->finalized) {
        tjs__free(s);
    }
}

static void tjs_tls_maybe_close(TJSTlsStream *s) {
    if (!uv_is_closing((uv_handle_t *) &s->tcp)) {
        uv_close((uv_handle_t *) &s->tcp, uv__tls_close_cb);
    }
}

static JSValue tjs_tls_close(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSTlsStream *s = tjs_tls_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }

    {
        JSValue args[2] = { JS_UNDEFINED, JS_UNDEFINED };
        maybe_invoke_tls_callback(s, TLS_CB_CONNECTION, 2, args);
    }

    /* Release the self-reference held by server sockets for the connection callback. */
    JS_FreeValue(ctx, s->obj);
    s->obj = JS_UNDEFINED;

    tjs_tls_maybe_close(s);
    return JS_UNDEFINED;
}

static JSValue tjs_tls_getsockpeername(JSContext *ctx, JSValue this_val, int argc, JSValue *argv, int magic) {
    TJSTlsStream *s = tjs_tls_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }

    int r, namelen;
    struct sockaddr_storage addr;
    namelen = sizeof(addr);
    if (magic == 0) {
        r = uv_tcp_getsockname(&s->tcp, (struct sockaddr *) &addr, &namelen);
    } else {
        r = uv_tcp_getpeername(&s->tcp, (struct sockaddr *) &addr, &namelen);
    }
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);
    tjs_addr2obj(ctx, obj, (struct sockaddr *) &addr, false);
    return obj;
}

static JSValue tjs_tls_keepalive(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSTlsStream *s = tjs_tls_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }

    int enable;
    if ((enable = JS_ToBool(ctx, argv[0])) == -1) {
        return JS_EXCEPTION;
    }

    int delay;
    if (JS_ToInt32(ctx, &delay, argv[1])) {
        return JS_EXCEPTION;
    }

    int r = uv_tcp_keepalive(&s->tcp, enable, delay);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_tls_nodelay(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSTlsStream *s = tjs_tls_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }

    int enable;
    if ((enable = JS_ToBool(ctx, argv[0])) == -1) {
        return JS_EXCEPTION;
    }

    int r = uv_tcp_nodelay(&s->tcp, enable);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_tls_fileno(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSTlsStream *s = tjs_tls_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }

    uv_os_fd_t fd;
    int r = uv_fileno((uv_handle_t *) &s->tcp, &fd);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    int32_t rfd;
#if defined(_WIN32)
    rfd = (int32_t) (intptr_t) fd;
#else
    rfd = fd;
#endif
    return JS_NewInt32(ctx, rfd);
}

static JSValue tjs_tls_ref(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSTlsStream *s = tjs_tls_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }
    if (!uv_is_closing((uv_handle_t *) &s->tcp)) {
        uv_ref((uv_handle_t *) &s->tcp);
    }
    return JS_UNDEFINED;
}

static JSValue tjs_tls_unref(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSTlsStream *s = tjs_tls_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }
    if (!uv_is_closing((uv_handle_t *) &s->tcp)) {
        uv_unref((uv_handle_t *) &s->tcp);
    }
    return JS_UNDEFINED;
}

static JSValue tjs_tls_get_alpn(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSTlsStream *s = tjs_tls_get(ctx, this_val);
    if (!s) {
        return JS_EXCEPTION;
    }
    const char *alpn = mbedtls_ssl_get_alpn_protocol(&s->ssl);
    if (alpn) {
        return JS_NewString(ctx, alpn);
    }
    return JS_NULL;
}

static JSValue tjs_tls_cb_get(JSContext *ctx, JSValue this_val, int magic) {
    TJSTlsStream *s = JS_GetOpaque2(ctx, this_val, tjs_tls_class_id);
    if (!s) {
        return JS_EXCEPTION;
    }
    return JS_DupValue(ctx, s->callbacks[magic]);
}

static JSValue tjs_tls_cb_set(JSContext *ctx, JSValue this_val, JSValue value, int magic) {
    TJSTlsStream *s = JS_GetOpaque2(ctx, this_val, tjs_tls_class_id);
    if (!s) {
        return JS_EXCEPTION;
    }
    if (JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value)) {
        JS_FreeValue(ctx, s->callbacks[magic]);
        s->callbacks[magic] = JS_DupValue(ctx, value);
    }
    return JS_UNDEFINED;
}

static void tjs_tls_finalizer(JSRuntime *rt, JSValue val) {
    TJSTlsStream *s = JS_GetOpaque(val, tjs_tls_class_id);
    if (!s) {
        return;
    }

    for (int i = 0; i < TLS_CB_MAX; i++) {
        JS_FreeValueRT(rt, s->callbacks[i]);
    }

    JS_FreeValueRT(rt, s->obj);
    JS_FreeValueRT(rt, s->server);

    mbedtls_ssl_free(&s->ssl);
    mbedtls_ssl_config_free(&s->conf);
    if (s->has_own_ca) {
        mbedtls_x509_crt_free(&s->cacert);
    }
    mbedtls_x509_crt_free(&s->own_cert);
    mbedtls_pk_free(&s->own_key);

    tjs_tlsbuf_free(&s->bio_in);
    tjs_tlsbuf_free(&s->bio_out);

    if (s->alpn_protocols) {
        for (int i = 0; s->alpn_protocols[i]; i++) {
            tjs__free(s->alpn_protocols[i]);
        }
        tjs__free(s->alpn_protocols);
    }

    tjs__free(s->cert_pem);
    tjs__free(s->key_pem);

    s->finalized = 1;
    if (s->closed) {
        tjs__free(s);
    } else {
        tjs_tls_maybe_close(s);
    }
}

static void tjs_tls_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSTlsStream *s = JS_GetOpaque(val, tjs_tls_class_id);
    if (s) {
        for (int i = 0; i < TLS_CB_MAX; i++) {
            JS_MarkValue(rt, s->callbacks[i], mark_func);
        }
        JS_MarkValue(rt, s->obj, mark_func);
        JS_MarkValue(rt, s->server, mark_func);
    }
}

static JSClassDef tjs_tls_class = {
    "TLSTcp",
    .finalizer = tjs_tls_finalizer,
    .gc_mark = tjs_tls_mark,
};

static int tjs_tls_configure(JSContext *ctx, TJSTlsStream *s, JSValue options) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);

    /* Initialize shared TLS context if needed */
    if (tjs_tls_ctx_init(ctx) != 0) {
        return -1;
    }

    mbedtls_ssl_init(&s->ssl);
    mbedtls_ssl_config_init(&s->conf);
    mbedtls_x509_crt_init(&s->cacert);
    mbedtls_x509_crt_init(&s->own_cert);
    mbedtls_pk_init(&s->own_key);

    int endpoint = s->is_server ? MBEDTLS_SSL_IS_SERVER : MBEDTLS_SSL_IS_CLIENT;
    int ret = mbedtls_ssl_config_defaults(&s->conf, endpoint, MBEDTLS_SSL_TRANSPORT_STREAM, MBEDTLS_SSL_PRESET_DEFAULT);
    if (ret != 0) {
        return ret;
    }

    mbedtls_ssl_conf_rng(&s->conf, mbedtls_ctr_drbg_random, &qrt->tls.ctr_drbg);

    /* CA certificate */
    JSValue ca_val = JS_GetPropertyStr(ctx, options, "ca");
    if (JS_IsString(ca_val)) {
        size_t ca_len;
        const char *ca_pem = JS_ToCStringLen(ctx, &ca_len, ca_val);
        if (ca_pem) {
            mbedtls_x509_crt_parse(&s->cacert, (const unsigned char *) ca_pem, ca_len + 1);
            JS_FreeCString(ctx, ca_pem);
            s->has_own_ca = true;
            mbedtls_ssl_conf_ca_chain(&s->conf, &s->cacert, NULL);
        }
    } else {
        /* Use shared default CA */
        mbedtls_ssl_conf_ca_chain(&s->conf, &qrt->tls.cacert, NULL);
    }
    JS_FreeValue(ctx, ca_val);

    /* Own cert + key (server or mTLS client) */
    JSValue cert_val = JS_GetPropertyStr(ctx, options, "cert");
    JSValue key_val = JS_GetPropertyStr(ctx, options, "key");
    if (JS_IsString(cert_val) && JS_IsString(key_val)) {
        size_t cert_len, key_len;
        const char *cert_pem = JS_ToCStringLen(ctx, &cert_len, cert_val);
        const char *key_pem = JS_ToCStringLen(ctx, &key_len, key_val);

        if (cert_pem && key_pem) {
            mbedtls_x509_crt_parse(&s->own_cert, (const unsigned char *) cert_pem, cert_len + 1);
            mbedtls_pk_parse_key(&s->own_key,
                                 (const unsigned char *) key_pem,
                                 key_len + 1,
                                 NULL,
                                 0,
                                 mbedtls_ctr_drbg_random,
                                 &qrt->tls.ctr_drbg);
            mbedtls_ssl_conf_own_cert(&s->conf, &s->own_cert, &s->own_key);

            /* Cache PEM for server so accepted connections can re-parse directly. */
            if (s->is_server) {
                s->cert_pem = tjs__strdup(cert_pem);
                s->key_pem = tjs__strdup(key_pem);
            }
        }

        JS_FreeCString(ctx, cert_pem);
        JS_FreeCString(ctx, key_pem);
    }

    JS_FreeValue(ctx, cert_val);
    JS_FreeValue(ctx, key_val);

    /* Peer certificate verification.
     * Default: true for clients (verify server), false for servers (no mTLS). */
    bool verify_default = !s->is_server;
    JSValue verify_val = JS_GetPropertyStr(ctx, options, "verifyPeer");
    bool verify = JS_IsBool(verify_val) ? JS_ToBool(ctx, verify_val) : verify_default;
    JS_FreeValue(ctx, verify_val);
    mbedtls_ssl_conf_authmode(&s->conf, verify ? MBEDTLS_SSL_VERIFY_REQUIRED : MBEDTLS_SSL_VERIFY_NONE);

    /* ALPN */
    JSValue alpn_val = JS_GetPropertyStr(ctx, options, "alpn");
    if (JS_IsArray(alpn_val)) {
        JSValue len_val = JS_GetPropertyStr(ctx, alpn_val, "length");
        int64_t len = 0;
        JS_ToInt64(ctx, &len, len_val);
        JS_FreeValue(ctx, len_val);

        if (len > 0) {
            s->alpn_protocols = tjs__calloc(len + 1, sizeof(char *));
            if (s->alpn_protocols) {
                for (int64_t i = 0; i < len; i++) {
                    JSValue item = JS_GetPropertyUint32(ctx, alpn_val, i);
                    const char *str = JS_ToCString(ctx, item);
                    if (str) {
                        s->alpn_protocols[i] = tjs__strdup(str);
                        JS_FreeCString(ctx, str);
                    }
                    JS_FreeValue(ctx, item);
                }
                s->alpn_protocols[len] = NULL;
                mbedtls_ssl_conf_alpn_protocols(&s->conf, (const char **) s->alpn_protocols);
            }
        }
    }
    JS_FreeValue(ctx, alpn_val);

    /* Finalize SSL setup */
    ret = mbedtls_ssl_setup(&s->ssl, &s->conf);
    if (ret != 0) {
        return ret;
    }

    /* SNI hostname (client only) — must be set after ssl_setup.
     * mbedtls_ssl_set_hostname makes its own copy, so we don't need to keep it. */
    if (!s->is_server) {
        JSValue sni_val = JS_GetPropertyStr(ctx, options, "sni");
        if (JS_IsString(sni_val)) {
            const char *sni = JS_ToCString(ctx, sni_val);
            if (sni) {
                mbedtls_ssl_set_hostname(&s->ssl, sni);
                JS_FreeCString(ctx, sni);
            }
        }
        JS_FreeValue(ctx, sni_val);
    }

    mbedtls_ssl_set_bio(&s->ssl, s, tjs_tls_bio_send, tjs_tls_bio_recv, NULL);

    return 0;
}

static JSValue tjs_new_tls(JSContext *ctx, int af) {
    TJSTlsStream *s;
    JSValue obj;
    int r;

    obj = JS_NewObjectClass(ctx, tjs_tls_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    s = tjs__mallocz(sizeof(*s));
    if (!s) {
        JS_FreeValue(ctx, obj);
        return JS_ThrowOutOfMemory(ctx);
    }

    r = uv_tcp_init_ex(tjs_get_loop(ctx), &s->tcp, af);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        tjs__free(s);
        return JS_ThrowInternalError(ctx, "couldn't initialize TCP handle");
    }

    s->ctx = ctx;
    s->tcp.data = s;
    s->tls_state = TLS_STATE_INIT;
    s->obj = JS_UNDEFINED;
    s->server = JS_UNDEFINED;

    tjs_tlsbuf_init(&s->bio_in);
    tjs_tlsbuf_init(&s->bio_out);

    for (int i = 0; i < TLS_CB_MAX; i++) {
        s->callbacks[i] = JS_UNDEFINED;
    }

    JS_SetOpaque(obj, s);
    return obj;
}

static JSValue tjs_new_tls_from_server(JSContext *ctx, TJSTlsStream *server) {
    char errbuf[128];

    JSValue obj = tjs_new_tls(ctx, AF_UNSPEC);
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSTlsStream *client = tjs_tls_get(ctx, obj);
    client->is_server = true;

    TJSRuntime *qrt = TJS_GetRuntime(ctx);

    mbedtls_ssl_init(&client->ssl);
    mbedtls_ssl_config_init(&client->conf);
    mbedtls_x509_crt_init(&client->own_cert);
    mbedtls_pk_init(&client->own_key);

    int ret = mbedtls_ssl_config_defaults(&client->conf,
                                          MBEDTLS_SSL_IS_SERVER,
                                          MBEDTLS_SSL_TRANSPORT_STREAM,
                                          MBEDTLS_SSL_PRESET_DEFAULT);
    if (ret != 0) {
        mbedtls_strerror(ret, errbuf, sizeof(errbuf));
        JS_FreeValue(ctx, obj);
        return JS_ThrowInternalError(ctx, "TLS config failed: %s", errbuf);
    }

    mbedtls_ssl_conf_rng(&client->conf, mbedtls_ctr_drbg_random, &qrt->tls.ctr_drbg);

    /* Re-parse cert and key from the server's cached PEM strings. */
    if (server->cert_pem && server->key_pem) {
        ret = mbedtls_x509_crt_parse(&client->own_cert,
                                     (const unsigned char *) server->cert_pem,
                                     strlen(server->cert_pem) + 1);
        if (ret != 0) {
            mbedtls_strerror(ret, errbuf, sizeof(errbuf));
            JS_FreeValue(ctx, obj);
            return JS_ThrowInternalError(ctx, "TLS cert parse failed: %s", errbuf);
        }

        ret = mbedtls_pk_parse_key(&client->own_key,
                                   (const unsigned char *) server->key_pem,
                                   strlen(server->key_pem) + 1,
                                   NULL,
                                   0,
                                   mbedtls_ctr_drbg_random,
                                   &qrt->tls.ctr_drbg);
        if (ret != 0) {
            mbedtls_strerror(ret, errbuf, sizeof(errbuf));
            JS_FreeValue(ctx, obj);
            return JS_ThrowInternalError(ctx, "TLS key parse failed: %s", errbuf);
        }

        mbedtls_ssl_conf_own_cert(&client->conf, &client->own_cert, &client->own_key);
    }
    mbedtls_ssl_conf_authmode(&client->conf, MBEDTLS_SSL_VERIFY_NONE);

    /* ALPN — copy from server if set */
    if (server->alpn_protocols) {
        int count = 0;
        while (server->alpn_protocols[count]) {
            count++;
        }
        if (count > 0) {
            client->alpn_protocols = tjs__calloc(count + 1, sizeof(char *));
            if (client->alpn_protocols) {
                for (int i = 0; i < count; i++) {
                    client->alpn_protocols[i] = tjs__strdup(server->alpn_protocols[i]);
                }
                client->alpn_protocols[count] = NULL;
                mbedtls_ssl_conf_alpn_protocols(&client->conf, (const char **) client->alpn_protocols);
            }
        }
    }

    ret = mbedtls_ssl_setup(&client->ssl, &client->conf);
    if (ret != 0) {
        mbedtls_strerror(ret, errbuf, sizeof(errbuf));
        JS_FreeValue(ctx, obj);
        return JS_ThrowInternalError(ctx, "TLS setup failed: %s", errbuf);
    }

    mbedtls_ssl_set_bio(&client->ssl, client, tjs_tls_bio_send, tjs_tls_bio_recv, NULL);

    return obj;
}

static JSValue tjs_tls_constructor(JSContext *ctx, JSValue new_target, int argc, JSValue *argv) {
    JSValue options = JS_IsUndefined(argv[0]) ? JS_NewObject(ctx) : JS_DupValue(ctx, argv[0]);

    JSValue obj = tjs_new_tls(ctx, AF_UNSPEC);
    if (JS_IsException(obj)) {
        JS_FreeValue(ctx, options);
        return obj;
    }

    TJSTlsStream *s = tjs_tls_get(ctx, obj);

    /* Check isServer */
    JSValue is_server_val = JS_GetPropertyStr(ctx, options, "isServer");
    s->is_server = JS_ToBool(ctx, is_server_val) == 1;
    JS_FreeValue(ctx, is_server_val);

    int ret = tjs_tls_configure(ctx, s, options);
    JS_FreeValue(ctx, options);

    if (ret != 0) {
        JS_FreeValue(ctx, obj);
        char errbuf[128];
        mbedtls_strerror(ret, errbuf, sizeof(errbuf));
        return JS_ThrowInternalError(ctx, "TLS configuration failed: %s", errbuf);
    }

    return obj;
}

/* clang-format off */
static const JSCFunctionListEntry tjs_tls_proto_funcs[] = {
    JS_CGETSET_MAGIC_DEF("onread",       tjs_tls_cb_get, tjs_tls_cb_set, TLS_CB_READ),
    JS_CGETSET_MAGIC_DEF("onwrite",      tjs_tls_cb_get, tjs_tls_cb_set, TLS_CB_WRITE),
    JS_CGETSET_MAGIC_DEF("onconnect",    tjs_tls_cb_get, tjs_tls_cb_set, TLS_CB_CONNECT),
    JS_CGETSET_MAGIC_DEF("onconnection", tjs_tls_cb_get, tjs_tls_cb_set, TLS_CB_CONNECTION),
    JS_CGETSET_MAGIC_DEF("onshutdown",   tjs_tls_cb_get, tjs_tls_cb_set, TLS_CB_SHUTDOWN),
    TJS_CFUNC_DEF("startRead",    0, tjs_tls_start_read),
    TJS_CFUNC_DEF("stopRead",     0, tjs_tls_stop_read),
    TJS_CFUNC_DEF("write",        1, tjs_tls_write),
    TJS_CFUNC_DEF("shutdown",     0, tjs_tls_shutdown),
    TJS_CFUNC_DEF("close",        0, tjs_tls_close),
    TJS_CFUNC_DEF("ref",          0, tjs_tls_ref),
    TJS_CFUNC_DEF("unref",        0, tjs_tls_unref),
    TJS_CFUNC_DEF("fileno",       0, tjs_tls_fileno),
    JS_CFUNC_MAGIC_DEF("getsockname", 0, tjs_tls_getsockpeername, 0),
    JS_CFUNC_MAGIC_DEF("getpeername", 0, tjs_tls_getsockpeername, 1),
    TJS_CFUNC_DEF("connect",      1, tjs_tls_connect),
    TJS_CFUNC_DEF("bind",         2, tjs_tls_bind),
    TJS_CFUNC_DEF("listen",       1, tjs_tls_listen),
    TJS_CFUNC_DEF("setKeepAlive", 2, tjs_tls_keepalive),
    TJS_CFUNC_DEF("setNoDelay",   1, tjs_tls_nodelay),
    TJS_CFUNC_DEF("getAlpn",      0, tjs_tls_get_alpn),
};
/* clang-format on */

void tjs__mod_tls_init(JSContext *ctx, JSValue ns) {
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSValue proto, obj;

    JS_NewClassID(rt, &tjs_tls_class_id);
    JS_NewClass(rt, tjs_tls_class_id, &tjs_tls_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_tls_proto_funcs, countof(tjs_tls_proto_funcs));
    JS_SetClassProto(ctx, tjs_tls_class_id, proto);

    obj = JS_NewCFunction2(ctx, tjs_tls_constructor, "TLSTcp", 1, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, ns, "TLSTcp", obj, JS_PROP_C_W_E);
}

void tjs__mod_tls_cleanup(TJSRuntime *qrt) {
    if (qrt->tls.initialized) {
        mbedtls_x509_crt_free(&qrt->tls.cacert);
        mbedtls_ctr_drbg_free(&qrt->tls.ctr_drbg);
        mbedtls_entropy_free(&qrt->tls.entropy);
        qrt->tls.initialized = false;
    }
    tjs__free(qrt->tls.ca_bundle_path);
    qrt->tls.ca_bundle_path = NULL;
}

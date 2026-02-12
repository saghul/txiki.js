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

#include <string.h>

extern const struct lws_protocols tjs_ws_protocol;

void tjs__lws_init(TJSRuntime *qrt) {
    const struct lws_protocols protocols[] = {
        tjs_ws_protocol,
        LWS_PROTOCOL_LIST_TERM,
    };

    struct lws_context_creation_info info;
    memset(&info, 0, sizeof(info));

    static const struct lws_extension extensions[] = {
        { "permessage-deflate", lws_extension_callback_pm_deflate, "permessage-deflate; client_max_window_bits" },
        { NULL, NULL, NULL },
    };

    info.port = CONTEXT_PORT_NO_LISTEN;
    info.protocols = protocols;
    info.extensions = extensions;
    info.options = LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT | LWS_SERVER_OPTION_LIBUV;

    /* Use the existing libuv event loop. */
    void *foreign_loops[1] = { &qrt->loop };
    info.foreign_loops = foreign_loops;

    /* Embedded CA certificates for TLS. */
    info.client_ssl_ca_mem = tjs_cacert_pem;
    info.client_ssl_ca_mem_len = TJS_CACERT_PEM_LEN;

    /* Suppress lws internal logging. */
    lws_set_log_level(0, NULL);

    qrt->lws.ctx = lws_create_context(&info);
}

struct lws_context *tjs__lws_get_context(JSContext *ctx) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);

    return qrt->lws.ctx;
}

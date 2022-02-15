/*
 * QuickJS libuv bindings
 *
 * Copyright (c) 2019-present Saúl Ibarra Corretgé <s@saghul.net>
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


static uv_once_t curl__init_once = UV_ONCE_INIT;

void tjs__curl_init_once(void) {
    curl_global_init(CURL_GLOBAL_ALL);
}

void tjs_curl_init(void) {
    uv_once(&curl__init_once, tjs__curl_init_once);
}

size_t curl__write_cb(char *ptr, size_t size, size_t nmemb, void *userdata) {
    size_t realsize = size * nmemb;
    DynBuf *dbuf = userdata;
    if (dbuf_put(dbuf, (const uint8_t *) ptr, realsize))
        return -1;
    return realsize;
}

int tjs_curl_load_http(DynBuf *dbuf, const char *url) {
    tjs_curl_init();

    CURL *curl_handle;
    CURLcode res;
    int r = -1;

    /* init the curl session */
    curl_handle = curl_easy_init();

    /* specify URL to get */
    curl_easy_setopt(curl_handle, CURLOPT_URL, url);

    /* send all data to this function  */
    curl_easy_setopt(curl_handle, CURLOPT_WRITEFUNCTION, curl__write_cb);

    /* we pass our 'chunk' struct to the callback function */
    curl_easy_setopt(curl_handle, CURLOPT_WRITEDATA, (void *) dbuf);

    /* some servers don't like requests that are made without a user-agent field, so we provide one */
    curl_easy_setopt(curl_handle, CURLOPT_USERAGENT, "tjs/1.0");

    /* get it! */
    res = curl_easy_perform(curl_handle);

    if (res == CURLE_OK) {
        long code = 0;
        res = curl_easy_getinfo(curl_handle, CURLINFO_RESPONSE_CODE, &code);
        if (res == CURLE_OK)
            r = (int) code;
    }

    if (res != CURLE_OK) {
        r = -res;
#if 0
        printf("CURL ERROR: %d %s\n", res,  curl_easy_strerror(res));
#endif
    }

    /* cleanup curl stuff */
    curl_easy_cleanup(curl_handle);

    /* curl won't null terminate the memory, do it ourselves */
    dbuf_putc(dbuf, '\0');

    return r;
}

static void check_multi_info(TJSRuntime *qrt) {
    char *done_url;
    CURLMsg *message;
    int pending;

    while ((message = curl_multi_info_read(qrt->curl_ctx.curlm_h, &pending))) {
        switch (message->msg) {
            case CURLMSG_DONE: {
                /* Do not use message data after calling curl_multi_remove_handle() and
                   curl_easy_cleanup(). As per curl_multi_info_read() docs:
                   "WARNING: The data the returned pointer points to will not survive
                   calling curl_multi_cleanup, curl_multi_remove_handle or
                   curl_easy_cleanup." */
                CURL *easy_handle = message->easy_handle;
                CHECK_NOT_NULL(easy_handle);

                tjs_curl_private_t *curl_private = NULL;
                curl_easy_getinfo(easy_handle, CURLINFO_PRIVATE, &curl_private);
                CHECK_NOT_NULL(curl_private);
                CHECK_NOT_NULL(curl_private->done_cb);
                curl_private->done_cb(message, curl_private->arg);

                curl_multi_remove_handle(qrt->curl_ctx.curlm_h, easy_handle);
                curl_easy_cleanup(easy_handle);
                break;
            }
            default:
                abort();
        }
    }
}

typedef struct {
    uv_poll_t poll;
    curl_socket_t sockfd;
    TJSRuntime *qrt;
} tjs_curl_poll_ctx_t;

static void uv__poll_close_cb(uv_handle_t *handle) {
    tjs_curl_poll_ctx_t *poll_ctx = handle->data;
    CHECK_NOT_NULL(poll_ctx);
    free(poll_ctx);
}

static void uv__poll_cb(uv_poll_t *handle, int status, int events) {
    tjs_curl_poll_ctx_t *poll_ctx = handle->data;
    CHECK_NOT_NULL(poll_ctx);
    TJSRuntime *qrt = poll_ctx->qrt;
    CHECK_NOT_NULL(qrt);

    int flags = 0;
    if (events & UV_READABLE)
        flags |= CURL_CSELECT_IN;
    if (events & UV_WRITABLE)
        flags |= CURL_CSELECT_OUT;

    int running_handles;
    curl_multi_socket_action(qrt->curl_ctx.curlm_h, poll_ctx->sockfd, flags, &running_handles);

    check_multi_info(qrt);
}

static int curl__handle_socket(CURL *easy, curl_socket_t s, int action, void *userp, void *socketp) {
    TJSRuntime *qrt = userp;
    CHECK_NOT_NULL(qrt);

    switch (action) {
        case CURL_POLL_IN:
        case CURL_POLL_OUT:
        case CURL_POLL_INOUT: {
            tjs_curl_poll_ctx_t *poll_ctx;
            if (!socketp) {
                // Initialize poll handle.
                poll_ctx = malloc(sizeof(*poll_ctx));
                if (!poll_ctx)
                    return -1;
                CHECK_EQ(uv_poll_init_socket(&qrt->loop, &poll_ctx->poll, s), 0);
                poll_ctx->qrt = qrt;
                poll_ctx->sockfd = s;
                poll_ctx->poll.data = poll_ctx;
            } else {
                poll_ctx = socketp;
            }

            curl_multi_assign(qrt->curl_ctx.curlm_h, s, (void *) poll_ctx);

            int events = 0;
            if (action != CURL_POLL_IN)
                events |= UV_WRITABLE;
            if (action != CURL_POLL_OUT)
                events |= UV_READABLE;

            CHECK_EQ(uv_poll_start(&poll_ctx->poll, events, uv__poll_cb), 0);
            break;
        }
        case CURL_POLL_REMOVE:
            if (socketp) {
                tjs_curl_poll_ctx_t *poll_ctx = socketp;
                CHECK_EQ(uv_poll_stop(&poll_ctx->poll), 0);
                curl_multi_assign(qrt->curl_ctx.curlm_h, s, NULL);
                uv_close((uv_handle_t *) &poll_ctx->poll, uv__poll_close_cb);
            }
            break;
        default:
            abort();
    }

    return 0;
}

static void uv__timer_cb(uv_timer_t *handle) {
    TJSRuntime *qrt = handle->data;
    CHECK_NOT_NULL(qrt);

    int running_handles;
    curl_multi_socket_action(qrt->curl_ctx.curlm_h, CURL_SOCKET_TIMEOUT, 0, &running_handles);

    check_multi_info(qrt);
}

static int curl__start_timeout(CURLM *multi, long timeout_ms, void *userp) {
    TJSRuntime *qrt = userp;
    CHECK_NOT_NULL(qrt);

    if (timeout_ms < 0) {
        CHECK_EQ(uv_timer_stop(&qrt->curl_ctx.timer), 0);
    } else {
        if (timeout_ms == 0)
            timeout_ms = 1; /* 0 means directly call socket_action, but we'll do it in a bit */
        CHECK_EQ(uv_timer_start(&qrt->curl_ctx.timer, uv__timer_cb, timeout_ms, 0), 0);
    }

    return 0;
}

CURLM *tjs__get_curlm(JSContext *ctx) {
    TJSRuntime *qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);

    if (!qrt->curl_ctx.curlm_h) {
        tjs_curl_init();
        CURLM *curlm_h = curl_multi_init();
        curl_multi_setopt(curlm_h, CURLMOPT_SOCKETFUNCTION, curl__handle_socket);
        curl_multi_setopt(curlm_h, CURLMOPT_SOCKETDATA, qrt);
        curl_multi_setopt(curlm_h, CURLMOPT_TIMERFUNCTION, curl__start_timeout);
        curl_multi_setopt(curlm_h, CURLMOPT_TIMERDATA, qrt);
        qrt->curl_ctx.curlm_h = curlm_h;
        CHECK_EQ(uv_timer_init(&qrt->loop, &qrt->curl_ctx.timer), 0);
        qrt->curl_ctx.timer.data = qrt;
    }

    return qrt->curl_ctx.curlm_h;
}

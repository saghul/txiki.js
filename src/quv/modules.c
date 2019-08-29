
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

#include "../quv.h"
#include "private.h"


#ifdef QUV_HAVE_CURL

#    include "../../deps/quickjs/src/cutils.h"

#    include <curl/curl.h>
#    include <string.h>
#    include <uv.h>

static const char http[] = "http://";
static const char https[] = "https://";
static uv_once_t curl__init_once = UV_ONCE_INIT;

static void init_curl_once(void) {
    curl_global_init(CURL_GLOBAL_ALL);
}

size_t curl__write_cb(char *ptr, size_t size, size_t nmemb, void *userdata) {
    size_t realsize = size * nmemb;
    DynBuf *dbuf = userdata;
    if (dbuf_put(dbuf, (const uint8_t *) ptr, realsize))
        return -1;
    return realsize;
}

JSModuleDef *quv__load_http(JSContext *ctx, const char *url) {
    uv_once(&curl__init_once, init_curl_once);

    JSModuleDef *m;
    DynBuf dbuf;
    dbuf_init(&dbuf);

    CURL *curl_handle;
    CURLcode res;

    /* init the curl session */
    curl_handle = curl_easy_init();

    /* specify URL to get */
    curl_easy_setopt(curl_handle, CURLOPT_URL, url);

    /* send all data to this function  */
    curl_easy_setopt(curl_handle, CURLOPT_WRITEFUNCTION, curl__write_cb);

    /* we pass our 'chunk' struct to the callback function */
    curl_easy_setopt(curl_handle, CURLOPT_WRITEDATA, (void *) &dbuf);

    /* some servers don't like requests that are made without a user-agent field, so we provide one */
    curl_easy_setopt(curl_handle, CURLOPT_USERAGENT, "quv/1.0");

    /* get it! */
    res = curl_easy_perform(curl_handle);

    if (res != CURLE_OK) {
        m = NULL;
        goto end;
    }

    /* curl won't null terminate the memory, do it ourselves */
    dbuf_putc(&dbuf, '\0');

    /* compile the module */
    JSValue func_val = JS_Eval(ctx, (char *) dbuf.buf, dbuf.size, url, JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
    if (JS_IsException(func_val)) {
        JS_FreeValue(ctx, func_val);
        m = NULL;
        goto end;
    }

    /* the module is already referenced, so we must free it */
    m = JS_VALUE_GET_PTR(func_val);
    JS_FreeValue(ctx, func_val);

end:
    /* cleanup curl stuff */
    curl_easy_cleanup(curl_handle);

    /* free the memory we allocated */
    dbuf_free(&dbuf);

    return m;
}

#endif

JSModuleDef *quv_module_loader(JSContext *ctx, const char *module_name, void *opaque) {
    JSModuleDef *m;
    JSValue func_val;

#ifdef QUV_HAVE_CURL
    if (strncmp(http, module_name, strlen(http)) == 0 || strncmp(https, module_name, strlen(https)) == 0) {
        return quv__load_http(ctx, module_name);
    }
#endif

    /* compile the module */
    func_val = QUV_EvalFile(ctx, module_name, JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
    if (JS_IsException(func_val)) {
        JS_FreeValue(ctx, func_val);
        return NULL;
    }
    /* the module is already referenced, so we must free it */
    m = JS_VALUE_GET_PTR(func_val);
    JS_FreeValue(ctx, func_val);

    return m;
}

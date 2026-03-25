/*
 * txiki.js
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

#ifndef TJS_PRIVATE_H
#define TJS_PRIVATE_H

#include "list.h"
#include "tbuf.h"
#include "tjs.h"

#include <libwebsockets.h>
#include <mbedtls/ctr_drbg.h>
#include <mbedtls/entropy.h>
#include <mbedtls/x509_crt.h>
#include <quickjs.h>
#include <sqlite3.h>
#include <stdbool.h>
#ifndef _WIN32
#include <unistd.h>
#endif
#include <uv.h>
#include <wasm_export.h>

#ifndef STDIN_FILENO
#define STDIN_FILENO 0
#endif
#ifndef STDOUT_FILENO
#define STDOUT_FILENO 1
#endif
#ifndef STDERR_FILENO
#define STDERR_FILENO 2
#endif

#ifdef _MSC_VER
#define strncasecmp _strnicmp
#define strcasecmp  _stricmp
#endif

typedef struct TJSTimer TJSTimer;

typedef struct {
    struct list_head link;
    JSValue promise;
    JSValue reason;
} TJSPendingRejection;

struct TJSRuntime {
    TJSRunOptions options;
    JSRuntime *rt;
    JSContext *ctx;
    uv_loop_t loop;
    struct {
        uv_check_t check;
        uv_idle_t idle;
        uv_prepare_t prepare;
    } jobs;
    uv_async_t stop;
    bool is_worker;
    bool freeing;
    struct {
        bool initialized;
        uint32_t stack_size;
    } wasm_ctx;
    struct {
        struct lws_context *ctx;
        struct lws_vhost *vh_direct;
        struct lws_vhost *vh_http_proxy;
        struct lws_vhost *vh_https_proxy;
        char **no_proxy_entries;
        int no_proxy_count;
        bool no_proxy_wildcard;
        char *cookie_jar_path;
        char *ca_bundle_path;
        uint8_t *ca_bundle_data;
        unsigned int ca_bundle_len;
        uv_async_t keepalive;
        int active_conns;
    } lws;
    struct {
        TJSTimer *timers;
        int64_t next_timer;
    } timers;
    struct {
        bool initialized;
        mbedtls_entropy_context entropy;
        mbedtls_ctr_drbg_context ctr_drbg;
        mbedtls_x509_crt cacert;
        char *ca_bundle_path;
    } tls;
    struct {
        JSValue promise_event_ctor;
        JSValue dispatch_event_func;
    } builtins;
    struct list_head pending_rejections;
};

void tjs__mod_dns_init(JSContext *ctx, JSValue ns);
void tjs__mod_engine_init(JSContext *ctx, JSValue ns);
void tjs__mod_error_init(JSContext *ctx, JSValue ns);
void tjs__mod_ffi_init(JSContext *ctx, JSValue ns);
void tjs__mod_fs_init(JSContext *ctx, JSValue ns);
void tjs__mod_fswatch_init(JSContext *ctx, JSValue ns);
void tjs__mod_hashing_init(JSContext *ctx, JSValue ns);
void tjs__mod_httpclient_init(JSContext *ctx, JSValue ns);
void tjs__mod_miniz_init(JSContext *ctx, JSValue ns);
typedef struct TJSDecompressor TJSDecompressor;
TJSDecompressor *tjs__decompressor_create(JSContext *ctx, const char *format);
int tjs__decompressor_decompress(TJSDecompressor *d, const uint8_t *in, size_t in_len, TBuf *out);
void tjs__decompressor_destroy(TJSDecompressor *d, JSRuntime *rt);
void tjs__mod_os_init(JSContext *ctx, JSValue ns);
void tjs__mod_process_init(JSContext *ctx, JSValue ns);
void tjs__mod_signals_init(JSContext *ctx, JSValue ns);
void tjs__mod_sqlite3_init(JSContext *ctx, JSValue ns);
void tjs__mod_streams_init(JSContext *ctx, JSValue ns);
void tjs__mod_tls_init(JSContext *ctx, JSValue ns);
void tjs__mod_tls_cleanup(TJSRuntime *qrt);
void tjs__mod_sys_init(JSContext *ctx, JSValue ns);
void tjs__mod_text_coding_init(JSContext *ctx, JSValue ns);
void tjs__mod_timers_init(JSContext *ctx, JSValue ns);
void tjs__mod_udp_init(JSContext *ctx, JSValue ns);
void tjs__mod_wasm_init(JSContext *ctx, JSValue ns);
void tjs__mod_worker_init(JSContext *ctx, JSValue ns);
void tjs__webcrypto_init(JSContext *ctx, JSValue ns);
void tjs__mod_ws_init(JSContext *ctx, JSValue ns);
void tjs__mod_httpserver_init(JSContext *ctx, JSValue ns);
void tjs__mod_url_init(JSContext *ctx, JSValue ns);
#ifndef _WIN32
void tjs__mod_posix_socket_init(JSContext *ctx, JSValue ns);
#endif

JSValue tjs_new_error(JSContext *ctx, int err);
JSValue tjs_throw_errno(JSContext *ctx, int err);

JSValue tjs_new_pipe(JSContext *ctx);
uv_stream_t *tjs_pipe_get_stream(JSContext *ctx, JSValue obj);

void tjs__execute_jobs(JSContext *ctx);
JSModuleDef *tjs__load_builtin(JSContext *ctx, const char *name);
int tjs__load_file(JSContext *ctx, TBuf *dbuf, const char *filename);
int tjs_module_attr_checker(JSContext *ctx, void *opaque, JSValueConst attributes);
JSModuleDef *tjs_module_loader(JSContext *ctx, const char *module_name, void *opaque, JSValueConst attributes);
char *tjs_module_normalizer(JSContext *ctx, const char *base_name, const char *name, void *opaque);

int js_module_set_import_meta(JSContext *ctx, JSValue func_val, bool use_realpath, bool is_main);

JSValue tjs__get_args(JSContext *ctx);

int tjs__eval_bytecode(JSContext *ctx, const uint8_t *buf, size_t buf_len, bool check_promise);

void tjs__destroy_timers(TJSRuntime *qrt);

void tjs__sab_free(void *opaque, void *ptr);
void tjs__sab_dup(void *opaque, void *ptr);

struct lws_context *tjs__lws_get_context(JSContext *ctx);
void tjs__lws_init(TJSRuntime *qrt);
void tjs__lws_conn_ref(JSContext *ctx);
void tjs__lws_conn_unref(JSContext *ctx);
struct lws_vhost *tjs__lws_select_vhost(JSContext *ctx, const char *scheme, const char *hostname, int port);
int tjs__lws_load_http(TJSRuntime *qrt, TBuf *dbuf, const char *url);

uv_loop_t *TJS_GetLoop(TJSRuntime *qrt);
TJSRuntime *TJS_NewRuntimeWorker(void);
TJSRuntime *TJS_NewRuntimeInternal(bool is_worker, TJSRunOptions *options);
JSValue TJS_EvalScript(JSContext *ctx, const char *filename);
JSValue TJS_EvalModule(JSContext *ctx, const char *filename, bool is_main);
JSValue TJS_EvalModuleContent(JSContext *ctx,
                              const char *filename,
                              bool is_main,
                              bool use_realpath,
                              const char *content,
                              size_t len);

#endif

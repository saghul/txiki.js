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

#include "../deps/quickjs/cutils.h"
#include "tjs.h"
#include "wasm.h"

#include <curl/curl.h>
#include <quickjs.h>
#include <stdbool.h>
#include <uv.h>

typedef struct TJSTimer TJSTimer;

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
    struct {
        CURLM *curlm_h;
        uv_timer_t timer;
    } curl_ctx;
    struct {
        IM3Environment env;
    } wasm_ctx;
    struct {
        TJSTimer *timers;
        int64_t next_timer;
    } timers;
};

void tjs__mod_dns_init(JSContext *ctx, JSValue ns);
void tjs__mod_error_init(JSContext *ctx, JSValue ns);
void tjs__mod_ffi_init(JSContext *ctx, JSValue ns);
void tjs__mod_fs_init(JSContext *ctx, JSValue ns);
void tjs__mod_fswatch_init(JSContext *ctx, JSValue ns);
void tjs__mod_os_init(JSContext *ctx, JSValue ns);
void tjs__mod_process_init(JSContext *ctx, JSValue ns);
void tjs__mod_signals_init(JSContext *ctx, JSValue ns);
void tjs__mod_sqlite3_init(JSContext *ctx, JSValue ns);
void tjs__mod_streams_init(JSContext *ctx, JSValue ns);
void tjs__mod_sys_init(JSContext *ctx, JSValue ns);
void tjs__mod_timers_init(JSContext *ctx, JSValue ns);
void tjs__mod_udp_init(JSContext *ctx, JSValue ns);
void tjs__mod_wasm_init(JSContext *ctx, JSValue ns);
void tjs__mod_worker_init(JSContext *ctx, JSValue ns);
void tjs__mod_ws_init(JSContext *ctx, JSValue ns);
void tjs__mod_xhr_init(JSContext *ctx, JSValue ns);

#ifndef _WIN32
void tjs__mod_posix_socket_init(JSContext *ctx, JSValue ns);
#endif

JSValue tjs_new_error(JSContext *ctx, int err);
JSValue tjs_throw_errno(JSContext *ctx, int err);

JSValue tjs_new_pipe(JSContext *ctx);
uv_stream_t *tjs_pipe_get_stream(JSContext *ctx, JSValue obj);

void tjs__execute_jobs(JSContext *ctx);
JSModuleDef *tjs__load_builtin(JSContext *ctx, const char *name);
int tjs__load_file(JSContext *ctx, DynBuf *dbuf, const char *filename);
JSModuleDef *tjs_module_loader(JSContext *ctx, const char *module_name, void *opaque);
char *tjs_module_normalizer(JSContext *ctx, const char *base_name, const char *name, void *opaque);

int js_module_set_import_meta(JSContext *ctx, JSValue func_val, JS_BOOL use_realpath, JS_BOOL is_main);

JSValue tjs__get_args(JSContext *ctx);

int tjs__eval_bytecode(JSContext *ctx, const uint8_t *buf, size_t buf_len);

void tjs__destroy_timers(TJSRuntime *qrt);

uv_loop_t *TJS_GetLoop(TJSRuntime *qrt);
TJSRuntime *TJS_NewRuntimeWorker(void);
TJSRuntime *TJS_NewRuntimeInternal(bool is_worker, TJSRunOptions *options);
JSValue TJS_EvalModule(JSContext *ctx, const char *filename, bool is_main);
JSValue TJS_EvalModuleContent(JSContext *ctx, const char *filename, bool is_main, bool use_realpath, const char *content, size_t len);

#endif

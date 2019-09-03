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

#ifndef QUV_PRIVATE_H
#define QUV_PRIVATE_H

#include "../../deps/quickjs/src/cutils.h"

#include <quickjs.h>
#include <uv.h>

void quv_mod_dns_init(JSContext *ctx, JSModuleDef *m);
void quv_mod_dns_export(JSContext *ctx, JSModuleDef *m);
void quv_mod_error_init(JSContext *ctx, JSModuleDef *m);
void quv_mod_error_export(JSContext *ctx, JSModuleDef *m);
void quv_mod_fs_init(JSContext *ctx, JSModuleDef *m);
void quv_mod_fs_export(JSContext *ctx, JSModuleDef *m);
void quv_mod_misc_init(JSContext *ctx, JSModuleDef *m);
void quv_mod_misc_export(JSContext *ctx, JSModuleDef *m);
void quv_mod_process_init(JSContext *ctx, JSModuleDef *m);
void quv_mod_process_export(JSContext *ctx, JSModuleDef *m);
void quv_mod_signals_init(JSContext *ctx, JSModuleDef *m);
void quv_mod_signals_export(JSContext *ctx, JSModuleDef *m);
void quv_mod_std_init(JSContext *ctx, JSModuleDef *m);
void quv_mod_std_export(JSContext *ctx, JSModuleDef *m);
void quv_mod_streams_init(JSContext *ctx, JSModuleDef *m);
void quv_mod_streams_export(JSContext *ctx, JSModuleDef *m);
void quv_mod_timers_init(JSContext *ctx, JSModuleDef *m);
void quv_mod_timers_export(JSContext *ctx, JSModuleDef *m);
void quv_mod_udp_init(JSContext *ctx, JSModuleDef *m);
void quv_mod_udp_export(JSContext *ctx, JSModuleDef *m);
void quv_mod_worker_init(JSContext *ctx, JSModuleDef *m);
void quv_mod_worker_export(JSContext *ctx, JSModuleDef *m);

JSValue quv_new_error(JSContext *ctx, int err);
JSValue quv_throw_errno(JSContext *ctx, int err);

JSValue quv_new_pipe(JSContext *ctx);
uv_stream_t *quv_pipe_get_stream(JSContext *ctx, JSValueConst obj);

int quv__load_file(JSContext *ctx, DynBuf *dbuf, const char *filename);
JSModuleDef *quv_module_loader(JSContext *ctx, const char *module_name, void *opaque);

JSModuleDef *js_init_module_std(JSContext *ctx, const char *module_name);
int js_module_set_import_meta(JSContext *ctx, JSValueConst func_val, JS_BOOL use_realpath, JS_BOOL is_main);

JSValue quv__get_args(JSContext *ctx);

#endif

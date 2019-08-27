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

#include "quickjs-libuv.h"

#include "quv/dns.h"
#include "quv/error.h"
#include "quv/fs.h"
#include "quv/misc.h"
#include "quv/process.h"
#include "quv/signals.h"
#include "quv/streams.h"
#include "quv/timers.h"
#include "quv/udp.h"
#include "quv/utils.h"
#include "quv/worker.h"

#include <stdlib.h>


static int quv_init(JSContext *ctx, JSModuleDef *m) {
    quv_mod_dns_init(ctx, m);
    quv_mod_error_init(ctx, m);
    quv_mod_fs_init(ctx, m);
    quv_mod_misc_init(ctx, m);
    quv_mod_process_init(ctx, m);
    quv_mod_signals_init(ctx, m);
    quv_mod_streams_init(ctx, m);
    quv_mod_timers_init(ctx, m);
    quv_mod_udp_init(ctx, m);
    quv_mod_worker_init(ctx, m);

    return 0;
}

JSModuleDef *js_init_module_uv(JSContext *ctx) {
    JSModuleDef *m;
    m = JS_NewCModule(ctx, "uv", quv_init);
    if (!m)
        return NULL;

    quv_mod_dns_export(ctx, m);
    quv_mod_error_export(ctx, m);
    quv_mod_fs_export(ctx, m);
    quv_mod_misc_export(ctx, m);
    quv_mod_process_export(ctx, m);
    quv_mod_streams_export(ctx, m);
    quv_mod_signals_export(ctx, m);
    quv_mod_timers_export(ctx, m);
    quv_mod_udp_export(ctx, m);
    quv_mod_worker_export(ctx, m);

    return m;
}

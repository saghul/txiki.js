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

#include "private.h"
#include "tjs.h"

extern const uint8_t abort_controller[];
extern const uint32_t abort_controller_size;

extern const uint8_t bootstrap[];
extern const uint32_t bootstrap_size;

extern const uint8_t bootstrap2[];
extern const uint32_t bootstrap2_size;

extern const uint8_t console[];
extern const uint32_t console_size;

extern const uint8_t crypto[];
extern const uint32_t crypto_size;

extern const uint8_t encoding[];
extern const uint32_t encoding_size;

extern const uint8_t event_target[];
extern const uint32_t event_target_size;

extern const uint8_t fetch[];
extern const uint32_t fetch_size;

extern const uint8_t getopts[];
extern const uint32_t getopts_size;

extern const uint8_t hashlib[];
extern const uint32_t hashlib_size;

extern const uint8_t path[];
extern const uint32_t path_size;

extern const uint8_t performance[];
extern const uint32_t performance_size;

extern const uint8_t url[];
extern const uint32_t url_size;

extern const uint8_t uuid[];
extern const uint32_t uuid_size;

extern const uint8_t wasm[];
extern const uint32_t wasm_size;


int tjs__eval_binary(JSContext *ctx, const uint8_t *buf, size_t buf_len) {
    JSValue obj = JS_ReadObject(ctx, buf, buf_len, JS_READ_OBJ_BYTECODE);
    if (JS_IsException(obj))
        goto error;

    if (JS_VALUE_GET_TAG(obj) == JS_TAG_MODULE) {
        if (JS_ResolveModule(ctx, obj) < 0) {
            JS_FreeValue(ctx, obj);
            goto error;
        }
        js_module_set_import_meta(ctx, obj, FALSE, TRUE);
    }

    JSValue val = JS_EvalFunction(ctx, obj);
    if (JS_IsException(val))
        goto error;
    JS_FreeValue(ctx, val);

    return 0;

error:
    tjs_dump_error(ctx);
    return -1;
}

void tjs__bootstrap_globals(JSContext *ctx) {
    /* Load bootstrap */
    CHECK_EQ(0, tjs__eval_binary(ctx, bootstrap, bootstrap_size));

    /* Load TextEncoder / TextDecoder */
    CHECK_EQ(0, tjs__eval_binary(ctx, encoding, encoding_size));

    /* Load Console */
    CHECK_EQ(0, tjs__eval_binary(ctx, console, console_size));

    /* Load Crypto */
    CHECK_EQ(0, tjs__eval_binary(ctx, crypto, crypto_size));

    /* Load EventTarget */
    CHECK_EQ(0, tjs__eval_binary(ctx, event_target, event_target_size));

    /* Load Performance */
    CHECK_EQ(0, tjs__eval_binary(ctx, performance, performance_size));

    /* Load URL */
    CHECK_EQ(0, tjs__eval_binary(ctx, url, url_size));

    /* Load fetch */
    CHECK_EQ(0, tjs__eval_binary(ctx, fetch, fetch_size));

    /* Load AbortController */
    CHECK_EQ(0, tjs__eval_binary(ctx, abort_controller, abort_controller_size));

    /* Load WebAssembly */
    CHECK_EQ(0, tjs__eval_binary(ctx, wasm, wasm_size));

    /* Load bootstrap2 */
    CHECK_EQ(0, tjs__eval_binary(ctx, bootstrap2, bootstrap2_size));
}

void tjs__add_builtins(JSContext *ctx) {
    CHECK_EQ(0, tjs__eval_binary(ctx, getopts, getopts_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, hashlib, hashlib_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, path, path_size));
    CHECK_EQ(0, tjs__eval_binary(ctx, uuid, uuid_size));
}

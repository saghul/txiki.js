/*
 * txiki.js
 *
 * Copyright (c) 2017 Fabrice Bellard
 * Copyright (c) 2018 Charlie Gordon
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

#ifndef TJS_TBUF_H
#define TJS_TBUF_H

#include "utils.h"

#include <quickjs.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

typedef struct TBuf {
    JSRuntime *rt;
    uint8_t *buf;
    size_t size;
    size_t allocated_size;
    bool error;
} TBuf;

void tbuf_init(JSContext *ctx, TBuf *s);
int tbuf_claim(TBuf *s, size_t len);
int tbuf_put(TBuf *s, const void *data, size_t len);
int tbuf_putc(TBuf *s, uint8_t c);
int tbuf_putstr(TBuf *s, const char *str);
int TJS_PRINTF_FORMAT_ATTR(2, 3) tbuf_printf(TBuf *s, TJS_PRINTF_FORMAT const char *fmt, ...);
void tbuf_free(TBuf *s);

static inline bool tbuf_error(TBuf *s) {
    return s->error;
}

static inline void tbuf_set_error(TBuf *s) {
    s->error = true;
}

#endif

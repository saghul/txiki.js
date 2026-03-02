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

#include "tbuf.h"

#include "utils.h"

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

void tbuf_init(JSContext *ctx, TBuf *s) {
    memset(s, 0, sizeof(*s));
    s->rt = JS_GetRuntime(ctx);
}

int tbuf_claim(TBuf *s, size_t len) {
    size_t new_size, size, new_allocated_size;
    uint8_t *new_buf;
    new_size = s->size + len;
    if (new_size < len) {
        return -1; /* overflow */
    }
    if (new_size > s->allocated_size) {
        if (s->error) {
            return -1;
        }
        size = s->allocated_size + (s->allocated_size / 2);
        if (size < new_size || size < s->allocated_size) { /* overflow test */
            new_allocated_size = new_size;
        } else {
            new_allocated_size = size;
        }
        new_buf = js_realloc_rt(s->rt, s->buf, new_allocated_size);
        if (!new_buf) {
            s->error = true;
            return -1;
        }
        s->buf = new_buf;
        s->allocated_size = new_allocated_size;
    }
    return 0;
}

int tbuf_put(TBuf *s, const void *data, size_t len) {
    if (TJS__UNLIKELY((s->size + len) > s->allocated_size)) {
        if (tbuf_claim(s, len)) {
            return -1;
        }
    }
    if (len > 0) {
        memcpy(s->buf + s->size, data, len);
        s->size += len;
    }
    return 0;
}

int tbuf_putc(TBuf *s, uint8_t c) {
    if (TJS__UNLIKELY(s->size >= s->allocated_size)) {
        if (tbuf_claim(s, 1)) {
            return -1;
        }
    }
    s->buf[s->size++] = c;
    return 0;
}

int tbuf_putstr(TBuf *s, const char *str) {
    return tbuf_put(s, (const uint8_t *) str, strlen(str));
}

int tbuf_printf(TBuf *s, const char *fmt, ...) {
    va_list ap;
    char buf[128];
    int len;

    va_start(ap, fmt);
    len = vsnprintf(buf, sizeof(buf), fmt, ap);
    va_end(ap);
    if (len < (int) sizeof(buf)) {
        /* fast case */
        return tbuf_put(s, (uint8_t *) buf, len);
    } else {
        if (tbuf_claim(s, len + 1)) {
            return -1;
        }
        va_start(ap, fmt);
        vsnprintf((char *) (s->buf + s->size), s->allocated_size - s->size, fmt, ap);
        va_end(ap);
        s->size += len;
    }
    return 0;
}

void tbuf_free(TBuf *s) {
    if (s->buf) {
        js_free_rt(s->rt, s->buf);
    }
    memset(s, 0, sizeof(*s));
}

/*
 * txiki.js
 *
 * Copyright (c) 2024-present Saúl Ibarra Corretgé <s@saghul.net>
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

#include "mem.h"

#include "../deps/quickjs/cutils.h"

#include <stdlib.h>

#ifdef TJS__HAS_MIMALLOC
#include <mimalloc.h>
#endif

size_t tjs__malloc_usable_size(const void *ptr) {
#if defined(TJS__HAS_MIMALLOC)
    return mi_malloc_usable_size(ptr);
#else
    return js__malloc_usable_size(ptr);
#endif
}

void *tjs__malloc(size_t size) {
#ifdef TJS__HAS_MIMALLOC
    return mi_malloc(size);
#else
    return malloc(size);
#endif
}

void *tjs__mallocz(size_t size) {
#ifdef TJS__HAS_MIMALLOC
    return mi_calloc(1, size);
#else
    return calloc(1, size);
#endif
}

void *tjs__calloc(size_t count, size_t size) {
#ifdef TJS__HAS_MIMALLOC
    return mi_calloc(count, size);
#else
    return calloc(count, size);
#endif
}

void tjs__free(void *ptr) {
#ifdef TJS__HAS_MIMALLOC
    mi_free(ptr);
#else
    free(ptr);
#endif
}

void *tjs__realloc(void *ptr, size_t size) {
#ifdef TJS__HAS_MIMALLOC
    return mi_realloc(ptr, size);
#else
    return realloc(ptr, size);
#endif
}

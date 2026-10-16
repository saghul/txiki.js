/*
 * txiki.js
 *
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
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/* mbedtls 3.6 only ships a pthread threading layer, so on Windows we plug in
 * SRWLOCK through MBEDTLS_THREADING_ALT (see src/mbedtls_alt/threading_alt.h). */

#include "private.h"

#include <assert.h>
#include <mbedtls/threading.h>
#include <stdalign.h>
#include <windows.h>

static_assert(sizeof(SRWLOCK) == sizeof(void *), "SRWLOCK must fit the mutex slot");
static_assert(alignof(SRWLOCK) == alignof(void *), "SRWLOCK must match the mutex slot alignment");

static void tjs__mutex_init(mbedtls_threading_mutex_t *mutex) {
    if (mutex == NULL) {
        return;
    }
    InitializeSRWLock((PSRWLOCK) &mutex->lock);
}

static void tjs__mutex_free(mbedtls_threading_mutex_t *mutex) {
    /* SRWLOCKs hold no resources. */
    (void) mutex;
}

static int tjs__mutex_lock(mbedtls_threading_mutex_t *mutex) {
    if (mutex == NULL) {
        return MBEDTLS_ERR_THREADING_BAD_INPUT_DATA;
    }
    AcquireSRWLockExclusive((PSRWLOCK) &mutex->lock);
    return 0;
}

static int tjs__mutex_unlock(mbedtls_threading_mutex_t *mutex) {
    if (mutex == NULL) {
        return MBEDTLS_ERR_THREADING_BAD_INPUT_DATA;
    }
    ReleaseSRWLockExclusive((PSRWLOCK) &mutex->lock);
    return 0;
}

/* Must run once, before any mbedtls use: until then the ALT lock/unlock hooks
 * are stubs that fail. mbedtls_threading_free_alt() is deliberately never
 * called: the global mutexes live as long as the process and SRWLOCKs need no
 * teardown. */
void tjs__mbedtls_threading_init(void) {
    mbedtls_threading_set_alt(tjs__mutex_init, tjs__mutex_free, tjs__mutex_lock, tjs__mutex_unlock);
}

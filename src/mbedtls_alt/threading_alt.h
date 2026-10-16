/*
 * mbedtls MBEDTLS_THREADING_ALT mutex type (Windows only), implemented on top
 * of SRWLOCK in src/mbedtls_threading_win32.c.
 *
 * mbedtls/threading.h includes this header, and that one is included by every
 * mbedtls consumer (lws, mod_tls, webcrypto). Pulling <windows.h> in here would
 * put it ahead of <winsock2.h> in those TUs and break them, so the SRWLOCK is
 * kept in an opaque pointer-sized slot instead. A zeroed slot is SRWLOCK_INIT.
 */

#ifndef TJS_MBEDTLS_THREADING_ALT_H
#define TJS_MBEDTLS_THREADING_ALT_H

typedef struct mbedtls_threading_mutex_t {
    void *lock;
} mbedtls_threading_mutex_t;

#endif

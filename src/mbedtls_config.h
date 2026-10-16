/*
 * txiki.js mbedtls configuration overrides.
 *
 * Included via MBEDTLS_USER_CONFIG_FILE after the default config.
 * Disables features not needed for: TLS client/server, HTTP/WS, SubtleCrypto.
 */

/* Threading. PSA crypto keeps process-global state (key slots, RNG) which
 * every TLS 1.3 handshake goes through, and handshakes run on the main thread
 * and on Workers concurrently. mbedtls only locks that state with
 * MBEDTLS_THREADING_C. Windows has no mbedtls-provided layer, so it plugs in
 * SRWLOCK (src/mbedtls_threading_win32.c). */
#define MBEDTLS_THREADING_C
#if defined(_WIN32)
#define MBEDTLS_THREADING_ALT
#else
#define MBEDTLS_THREADING_PTHREAD
#endif

/* DTLS — all protocols are TCP-based. */
#undef MBEDTLS_SSL_PROTO_DTLS
#undef MBEDTLS_SSL_COOKIE_C

/* PSK key exchange — not part of the web platform. */
#undef MBEDTLS_KEY_EXCHANGE_PSK_ENABLED
#undef MBEDTLS_KEY_EXCHANGE_DHE_PSK_ENABLED
#undef MBEDTLS_KEY_EXCHANGE_ECDHE_PSK_ENABLED
#undef MBEDTLS_KEY_EXCHANGE_RSA_PSK_ENABLED

/* Deprecated/static key exchange. */
#undef MBEDTLS_KEY_EXCHANGE_RSA_ENABLED
#undef MBEDTLS_KEY_EXCHANGE_DHE_RSA_ENABLED
#undef MBEDTLS_KEY_EXCHANGE_ECDH_ECDSA_ENABLED
#undef MBEDTLS_KEY_EXCHANGE_ECDH_RSA_ENABLED

/* Ciphers and hashes not in any web standard. */
#undef MBEDTLS_DES_C
#undef MBEDTLS_RIPEMD160_C
#undef MBEDTLS_CAMELLIA_C
#undef MBEDTLS_ARIA_C
#undef MBEDTLS_CCM_C

/* Unused modules. */
#undef MBEDTLS_ECJPAKE_C
#undef MBEDTLS_PKCS7_C
#undef MBEDTLS_PKCS12_C
#undef MBEDTLS_LMS_C
#undef MBEDTLS_SSL_CONTEXT_SERIALIZATION
#undef MBEDTLS_SELF_TEST

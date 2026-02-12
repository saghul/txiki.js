/*
 * txiki.js mbedtls configuration overrides.
 *
 * Included via MBEDTLS_USER_CONFIG_FILE after the default config.
 * Disables features not needed for: TLS client/server, HTTP/WS, SubtleCrypto.
 */

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

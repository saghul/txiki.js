/*
 * Ed25519 digital signatures — extracted from TweetNaCl 20140427.
 * Public domain. See ed25519.c for full attribution.
 */

#ifndef TJS_ED25519_H
#define TJS_ED25519_H

#define crypto_sign_ed25519_BYTES 64
#define crypto_sign_ed25519_PUBLICKEYBYTES 32
#define crypto_sign_ed25519_SECRETKEYBYTES 64

/* Generate a keypair from a 32-byte seed.
 * pk: 32-byte public key, sk: 64-byte secret key (seed || pk).
 */
int crypto_sign_ed25519_seed_keypair(unsigned char pk[32], unsigned char sk[64],
                                     const unsigned char seed[32]);

/* Sign: writes sig || msg to sm, sets smlen = msg_len + 64. */
int crypto_sign_ed25519(unsigned char *sm, unsigned long long *smlen,
                        const unsigned char *m, unsigned long long mlen,
                        const unsigned char *sk);

/* Verify: returns 0 on success, -1 on failure. */
int crypto_sign_ed25519_open(unsigned char *m, unsigned long long *mlen,
                             const unsigned char *sm, unsigned long long smlen,
                             const unsigned char *pk);

#endif /* TJS_ED25519_H */

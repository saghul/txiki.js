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
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

#include "ed25519.h"
#include "private.h"

#include <mbedtls/cipher.h>
#include <mbedtls/ctr_drbg.h>
#include <mbedtls/ecdh.h>
#include <mbedtls/ecdsa.h>
#include <mbedtls/ecp.h>
#include <mbedtls/entropy.h>
#include <mbedtls/hkdf.h>
#include <mbedtls/md.h>
#include <mbedtls/nist_kw.h>
#include <mbedtls/pk.h>
#include <mbedtls/pkcs5.h>
#include <mbedtls/rsa.h>
#include <mbedtls/sha1.h>
#include <mbedtls/sha256.h>
#include <mbedtls/sha512.h>
#include <string.h>

enum {
    DIGEST_SHA1 = 0,
    DIGEST_SHA256,
    DIGEST_SHA384,
    DIGEST_SHA512,
};

/* clang-format off */
static const int digest_sizes[] = {
    [DIGEST_SHA1]   = 20,
    [DIGEST_SHA256] = 32,
    [DIGEST_SHA384] = 48,
    [DIGEST_SHA512] = 64,
};
/* clang-format on */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    int type;
    uint8_t *data;
    size_t data_len;
    uint8_t digest[64]; /* Max digest size (SHA-512). */
    int digest_len;
    int r;
} TJSDigestReq;

static void tjs__digest_work_cb(uv_work_t *req) {
    TJSDigestReq *dr = req->data;
    int ret = 0;

    switch (dr->type) {
        case DIGEST_SHA1: {
            mbedtls_sha1_context sha1;
            mbedtls_sha1_init(&sha1);
            ret = mbedtls_sha1_starts(&sha1);
            if (ret == 0) {
                ret = mbedtls_sha1_update(&sha1, dr->data, dr->data_len);
            }
            if (ret == 0) {
                ret = mbedtls_sha1_finish(&sha1, dr->digest);
            }
            mbedtls_sha1_free(&sha1);
            break;
        }
        case DIGEST_SHA256: {
            mbedtls_sha256_context sha256;
            mbedtls_sha256_init(&sha256);
            ret = mbedtls_sha256_starts(&sha256, 0);
            if (ret == 0) {
                ret = mbedtls_sha256_update(&sha256, dr->data, dr->data_len);
            }
            if (ret == 0) {
                ret = mbedtls_sha256_finish(&sha256, dr->digest);
            }
            mbedtls_sha256_free(&sha256);
            break;
        }
        case DIGEST_SHA384: {
            mbedtls_sha512_context sha512;
            mbedtls_sha512_init(&sha512);
            ret = mbedtls_sha512_starts(&sha512, 1);
            if (ret == 0) {
                ret = mbedtls_sha512_update(&sha512, dr->data, dr->data_len);
            }
            if (ret == 0) {
                ret = mbedtls_sha512_finish(&sha512, dr->digest);
            }
            mbedtls_sha512_free(&sha512);
            break;
        }
        case DIGEST_SHA512: {
            mbedtls_sha512_context sha512;
            mbedtls_sha512_init(&sha512);
            ret = mbedtls_sha512_starts(&sha512, 0);
            if (ret == 0) {
                ret = mbedtls_sha512_update(&sha512, dr->data, dr->data_len);
            }
            if (ret == 0) {
                ret = mbedtls_sha512_finish(&sha512, dr->digest);
            }
            mbedtls_sha512_free(&sha512);
            break;
        }
        default:
            ret = -1;
            break;
    }

    dr->r = ret;
}

static void tjs__digest_after_work_cb(uv_work_t *req, int status) {
    TJSDigestReq *dr = req->data;
    CHECK_NOT_NULL(dr);

    JSContext *ctx = dr->ctx;
    JSValue args[2];

    if (status != 0 || dr->r != 0) {
        args[0] = JS_NewString(ctx, "digest operation failed");
        args[1] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, dr->digest, dr->digest_len);
    }

    tjs_call_handler(ctx, dr->callback, 2, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, dr->callback);
    js_free(ctx, dr->data);
    js_free(ctx, dr);
}

static JSValue tjs_webcrypto_digest(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 3) {
        return JS_ThrowTypeError(ctx, "expected 3 arguments: type, data, callback");
    }

    int32_t type;
    if (JS_ToInt32(ctx, &type, argv[0])) {
        return JS_EXCEPTION;
    }

    if (type < DIGEST_SHA1 || type > DIGEST_SHA512) {
        return JS_ThrowRangeError(ctx, "invalid digest algorithm");
    }

    size_t data_len;
    const uint8_t *data = JS_GetUint8Array(ctx, &data_len, argv[1]);
    if (!data && data_len != 0) {
        return JS_EXCEPTION;
    }

    if (!JS_IsFunction(ctx, argv[2])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSDigestReq *dr = js_malloc(ctx, sizeof(*dr));
    if (!dr) {
        return JS_EXCEPTION;
    }

    dr->ctx = ctx;
    dr->callback = JS_DupValue(ctx, argv[2]);
    dr->type = type;
    dr->digest_len = digest_sizes[type];
    dr->r = -1;

    if (data_len > 0) {
        dr->data = js_malloc(ctx, data_len);
        if (!dr->data) {
            JS_FreeValue(ctx, dr->callback);
            js_free(ctx, dr);
            return JS_EXCEPTION;
        }
        memcpy(dr->data, data, data_len);
    } else {
        dr->data = NULL;
    }
    dr->data_len = data_len;
    dr->req.data = dr;

    int r = uv_queue_work(tjs_get_loop(ctx), &dr->req, tjs__digest_work_cb, tjs__digest_after_work_cb);
    if (r != 0) {
        JS_FreeValue(ctx, dr->callback);
        js_free(ctx, dr->data);
        js_free(ctx, dr);
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

/* clang-format off */
static const mbedtls_md_type_t digest_to_md_type[] = {
    [DIGEST_SHA1]   = MBEDTLS_MD_SHA1,
    [DIGEST_SHA256] = MBEDTLS_MD_SHA256,
    [DIGEST_SHA384] = MBEDTLS_MD_SHA384,
    [DIGEST_SHA512] = MBEDTLS_MD_SHA512,
};
/* clang-format on */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    int type;
    uint8_t *key;
    size_t key_len;
    uint8_t *data;
    size_t data_len;
    uint8_t digest[64]; /* Max digest size (SHA-512). */
    int digest_len;
    int r;
} TJSHmacSignReq;

static void tjs__hmac_sign_work_cb(uv_work_t *req) {
    TJSHmacSignReq *hr = req->data;
    const mbedtls_md_info_t *md_info = mbedtls_md_info_from_type(digest_to_md_type[hr->type]);

    if (!md_info) {
        hr->r = -1;
        return;
    }

    hr->r = mbedtls_md_hmac(md_info, hr->key, hr->key_len, hr->data, hr->data_len, hr->digest);
}

static void tjs__hmac_sign_after_work_cb(uv_work_t *req, int status) {
    TJSHmacSignReq *hr = req->data;
    CHECK_NOT_NULL(hr);

    JSContext *ctx = hr->ctx;
    JSValue args[2];

    if (status != 0 || hr->r != 0) {
        args[0] = JS_NewString(ctx, "HMAC operation failed");
        args[1] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, hr->digest, hr->digest_len);
    }

    tjs_call_handler(ctx, hr->callback, 2, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, hr->callback);
    js_free(ctx, hr->key);
    js_free(ctx, hr->data);
    js_free(ctx, hr);
}

static JSValue tjs_webcrypto_hmac_sign(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 4) {
        return JS_ThrowTypeError(ctx, "expected 4 arguments: type, key, data, callback");
    }

    int32_t type;
    if (JS_ToInt32(ctx, &type, argv[0])) {
        return JS_EXCEPTION;
    }

    if (type < DIGEST_SHA1 || type > DIGEST_SHA512) {
        return JS_ThrowRangeError(ctx, "invalid digest algorithm");
    }

    size_t key_len;
    const uint8_t *key = JS_GetUint8Array(ctx, &key_len, argv[1]);
    if (!key && key_len != 0) {
        return JS_EXCEPTION;
    }

    size_t data_len;
    const uint8_t *data = JS_GetUint8Array(ctx, &data_len, argv[2]);
    if (!data && data_len != 0) {
        return JS_EXCEPTION;
    }

    if (!JS_IsFunction(ctx, argv[3])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSHmacSignReq *hr = js_malloc(ctx, sizeof(*hr));
    if (!hr) {
        return JS_EXCEPTION;
    }

    hr->ctx = ctx;
    hr->callback = JS_DupValue(ctx, argv[3]);
    hr->type = type;
    hr->digest_len = digest_sizes[type];
    hr->r = -1;

    if (key_len > 0) {
        hr->key = js_malloc(ctx, key_len);
        if (!hr->key) {
            JS_FreeValue(ctx, hr->callback);
            js_free(ctx, hr);
            return JS_EXCEPTION;
        }
        memcpy(hr->key, key, key_len);
    } else {
        hr->key = NULL;
    }
    hr->key_len = key_len;

    if (data_len > 0) {
        hr->data = js_malloc(ctx, data_len);
        if (!hr->data) {
            JS_FreeValue(ctx, hr->callback);
            js_free(ctx, hr->key);
            js_free(ctx, hr);
            return JS_EXCEPTION;
        }
        memcpy(hr->data, data, data_len);
    } else {
        hr->data = NULL;
    }
    hr->data_len = data_len;
    hr->req.data = hr;

    int r = uv_queue_work(tjs_get_loop(ctx), &hr->req, tjs__hmac_sign_work_cb, tjs__hmac_sign_after_work_cb);
    if (r != 0) {
        JS_FreeValue(ctx, hr->callback);
        js_free(ctx, hr->key);
        js_free(ctx, hr->data);
        js_free(ctx, hr);
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

enum {
    CIPHER_AES_CBC = 0,
    CIPHER_AES_GCM,
    CIPHER_AES_CTR,
};

enum {
    CIPHER_OP_ENCRYPT = 0,
    CIPHER_OP_DECRYPT,
};

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    int cipher_type;
    int operation;
    uint8_t *key;
    size_t key_len;
    uint8_t *iv;
    size_t iv_len;
    uint8_t *data;
    size_t data_len;
    uint8_t *aad;
    size_t aad_len;
    int tag_length;
    uint8_t *output;
    size_t output_len;
    int r;
} TJSCipherReq;

static mbedtls_cipher_type_t tjs__get_cipher_type(int cipher_type, size_t key_len) {
    if (cipher_type == CIPHER_AES_CBC) {
        switch (key_len) {
            case 16:
                return MBEDTLS_CIPHER_AES_128_CBC;
            case 24:
                return MBEDTLS_CIPHER_AES_192_CBC;
            case 32:
                return MBEDTLS_CIPHER_AES_256_CBC;
            default:
                return MBEDTLS_CIPHER_NONE;
        }
    } else if (cipher_type == CIPHER_AES_GCM) {
        switch (key_len) {
            case 16:
                return MBEDTLS_CIPHER_AES_128_GCM;
            case 24:
                return MBEDTLS_CIPHER_AES_192_GCM;
            case 32:
                return MBEDTLS_CIPHER_AES_256_GCM;
            default:
                return MBEDTLS_CIPHER_NONE;
        }
    } else if (cipher_type == CIPHER_AES_CTR) {
        switch (key_len) {
            case 16:
                return MBEDTLS_CIPHER_AES_128_CTR;
            case 24:
                return MBEDTLS_CIPHER_AES_192_CTR;
            case 32:
                return MBEDTLS_CIPHER_AES_256_CTR;
            default:
                return MBEDTLS_CIPHER_NONE;
        }
    }

    return MBEDTLS_CIPHER_NONE;
}

static void tjs__cipher_work_cb(uv_work_t *req) {
    TJSCipherReq *cr = req->data;
    int ret;

    mbedtls_cipher_type_t ct = tjs__get_cipher_type(cr->cipher_type, cr->key_len);
    if (ct == MBEDTLS_CIPHER_NONE) {
        cr->r = -1;
        return;
    }

    const mbedtls_cipher_info_t *cipher_info = mbedtls_cipher_info_from_type(ct);
    if (!cipher_info) {
        cr->r = -1;
        return;
    }

    mbedtls_cipher_context_t cipher_ctx;
    mbedtls_cipher_init(&cipher_ctx);

    ret = mbedtls_cipher_setup(&cipher_ctx, cipher_info);
    if (ret != 0) {
        goto cleanup;
    }

    if (cr->cipher_type == CIPHER_AES_CBC) {
        ret = mbedtls_cipher_set_padding_mode(&cipher_ctx, MBEDTLS_PADDING_PKCS7);
        if (ret != 0) {
            goto cleanup;
        }
    }

    mbedtls_operation_t op = cr->operation == CIPHER_OP_ENCRYPT ? MBEDTLS_ENCRYPT : MBEDTLS_DECRYPT;

    ret = mbedtls_cipher_setkey(&cipher_ctx, cr->key, (int) (cr->key_len * 8), op);
    if (ret != 0) {
        goto cleanup;
    }

    if (cr->cipher_type == CIPHER_AES_CBC) {
        /* CBC: output can be up to data_len + block_size (16) for encryption due to padding. */
        size_t out_alloc = cr->data_len + 16;
        cr->output = malloc(out_alloc);
        if (!cr->output) {
            ret = -1;
            goto cleanup;
        }

        ret =
            mbedtls_cipher_crypt(&cipher_ctx, cr->iv, cr->iv_len, cr->data, cr->data_len, cr->output, &cr->output_len);
    } else if (cr->cipher_type == CIPHER_AES_GCM) {
        if (cr->operation == CIPHER_OP_ENCRYPT) {
            /* Encrypt: output = ciphertext + tag */
            size_t out_alloc = cr->data_len + cr->tag_length;
            cr->output = malloc(out_alloc);
            if (!cr->output) {
                ret = -1;
                goto cleanup;
            }

            ret = mbedtls_cipher_auth_encrypt_ext(&cipher_ctx,
                                                  cr->iv,
                                                  cr->iv_len,
                                                  cr->aad,
                                                  cr->aad_len,
                                                  cr->data,
                                                  cr->data_len,
                                                  cr->output,
                                                  out_alloc,
                                                  &cr->output_len,
                                                  cr->tag_length);
        } else {
            /* Decrypt: input = ciphertext + tag, output = plaintext */
            if ((size_t) cr->tag_length > cr->data_len) {
                ret = -1;
                goto cleanup;
            }

            size_t out_alloc = cr->data_len - cr->tag_length;
            cr->output = malloc(out_alloc > 0 ? out_alloc : 1);
            if (!cr->output) {
                ret = -1;
                goto cleanup;
            }

            ret = mbedtls_cipher_auth_decrypt_ext(&cipher_ctx,
                                                  cr->iv,
                                                  cr->iv_len,
                                                  cr->aad,
                                                  cr->aad_len,
                                                  cr->data,
                                                  cr->data_len,
                                                  cr->output,
                                                  out_alloc,
                                                  &cr->output_len,
                                                  cr->tag_length);
        }
    } else if (cr->cipher_type == CIPHER_AES_CTR) {
        /* CTR: stream cipher, output length == input length, no padding. */
        cr->output = malloc(cr->data_len > 0 ? cr->data_len : 1);
        if (!cr->output) {
            ret = -1;
            goto cleanup;
        }

        ret =
            mbedtls_cipher_crypt(&cipher_ctx, cr->iv, cr->iv_len, cr->data, cr->data_len, cr->output, &cr->output_len);
    } else {
        ret = -1;
    }

cleanup:
    mbedtls_cipher_free(&cipher_ctx);
    cr->r = ret;
}

static void tjs__cipher_after_work_cb(uv_work_t *req, int status) {
    TJSCipherReq *cr = req->data;
    CHECK_NOT_NULL(cr);

    JSContext *ctx = cr->ctx;
    JSValue args[2];

    if (status != 0 || cr->r != 0) {
        args[0] = JS_NewString(ctx, "cipher operation failed");
        args[1] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, cr->output, cr->output_len);
    }

    tjs_call_handler(ctx, cr->callback, 2, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, cr->callback);
    js_free(ctx, cr->key);
    js_free(ctx, cr->iv);
    js_free(ctx, cr->data);
    js_free(ctx, cr->aad);
    free(cr->output);
    js_free(ctx, cr);
}

static JSValue tjs_webcrypto_cipher(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 8) {
        return JS_ThrowTypeError(ctx, "expected 8 arguments: type, op, key, iv, data, aad, tagLen, callback");
    }

    int32_t cipher_type;
    if (JS_ToInt32(ctx, &cipher_type, argv[0])) {
        return JS_EXCEPTION;
    }

    int32_t operation;
    if (JS_ToInt32(ctx, &operation, argv[1])) {
        return JS_EXCEPTION;
    }

    size_t key_len;
    const uint8_t *key = JS_GetUint8Array(ctx, &key_len, argv[2]);
    if (!key) {
        return JS_EXCEPTION;
    }

    size_t iv_len;
    const uint8_t *iv = JS_GetUint8Array(ctx, &iv_len, argv[3]);
    if (!iv) {
        return JS_EXCEPTION;
    }

    size_t data_len;
    const uint8_t *data = JS_GetUint8Array(ctx, &data_len, argv[4]);
    if (!data && data_len != 0) {
        return JS_EXCEPTION;
    }

    /* AAD is optional (can be undefined). */
    size_t aad_len = 0;
    const uint8_t *aad = NULL;
    if (!JS_IsUndefined(argv[5])) {
        aad = JS_GetUint8Array(ctx, &aad_len, argv[5]);
        if (!aad && aad_len != 0) {
            return JS_EXCEPTION;
        }
    }

    int32_t tag_length;
    if (JS_ToInt32(ctx, &tag_length, argv[6])) {
        return JS_EXCEPTION;
    }

    if (!JS_IsFunction(ctx, argv[7])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSCipherReq *cr = js_malloc(ctx, sizeof(*cr));
    if (!cr) {
        return JS_EXCEPTION;
    }

    memset(cr, 0, sizeof(*cr));
    cr->ctx = ctx;
    cr->callback = JS_DupValue(ctx, argv[7]);
    cr->cipher_type = cipher_type;
    cr->operation = operation;
    cr->tag_length = tag_length;
    cr->r = -1;

    /* Copy key. */
    cr->key = js_malloc(ctx, key_len);
    if (!cr->key) {
        goto fail;
    }
    memcpy(cr->key, key, key_len);
    cr->key_len = key_len;

    /* Copy IV. */
    cr->iv = js_malloc(ctx, iv_len);
    if (!cr->iv) {
        goto fail;
    }
    memcpy(cr->iv, iv, iv_len);
    cr->iv_len = iv_len;

    /* Copy data. */
    if (data_len > 0) {
        cr->data = js_malloc(ctx, data_len);
        if (!cr->data) {
            goto fail;
        }
        memcpy(cr->data, data, data_len);
    }
    cr->data_len = data_len;

    /* Copy AAD. */
    if (aad_len > 0) {
        cr->aad = js_malloc(ctx, aad_len);
        if (!cr->aad) {
            goto fail;
        }
        memcpy(cr->aad, aad, aad_len);
    }
    cr->aad_len = aad_len;

    cr->req.data = cr;

    int r = uv_queue_work(tjs_get_loop(ctx), &cr->req, tjs__cipher_work_cb, tjs__cipher_after_work_cb);
    if (r != 0) {
        goto fail;
    }

    return JS_UNDEFINED;

fail:
    JS_FreeValue(ctx, cr->callback);
    js_free(ctx, cr->key);
    js_free(ctx, cr->iv);
    js_free(ctx, cr->data);
    js_free(ctx, cr->aad);
    js_free(ctx, cr);
    return JS_EXCEPTION;
}

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    int type;
    uint8_t *password;
    size_t password_len;
    uint8_t *salt;
    size_t salt_len;
    uint32_t iterations;
    uint8_t *output;
    uint32_t key_length;
    int r;
} TJSPbkdf2Req;

static void tjs__pbkdf2_work_cb(uv_work_t *req) {
    TJSPbkdf2Req *pr = req->data;
    pr->r = mbedtls_pkcs5_pbkdf2_hmac_ext(digest_to_md_type[pr->type],
                                          pr->password,
                                          pr->password_len,
                                          pr->salt,
                                          pr->salt_len,
                                          pr->iterations,
                                          pr->key_length,
                                          pr->output);
}

static void tjs__pbkdf2_after_work_cb(uv_work_t *req, int status) {
    TJSPbkdf2Req *pr = req->data;
    CHECK_NOT_NULL(pr);

    JSContext *ctx = pr->ctx;
    JSValue args[2];

    if (status != 0 || pr->r != 0) {
        args[0] = JS_NewString(ctx, "PBKDF2 operation failed");
        args[1] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, pr->output, pr->key_length);
    }

    tjs_call_handler(ctx, pr->callback, 2, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, pr->callback);
    js_free(ctx, pr->password);
    js_free(ctx, pr->salt);
    js_free(ctx, pr->output);
    js_free(ctx, pr);
}

static JSValue tjs_webcrypto_pbkdf2(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 6) {
        return JS_ThrowTypeError(ctx, "expected 6 arguments: type, password, salt, iterations, keyLength, callback");
    }

    int32_t type;
    if (JS_ToInt32(ctx, &type, argv[0])) {
        return JS_EXCEPTION;
    }

    if (type < DIGEST_SHA1 || type > DIGEST_SHA512) {
        return JS_ThrowRangeError(ctx, "invalid digest algorithm");
    }

    size_t password_len;
    const uint8_t *password = JS_GetUint8Array(ctx, &password_len, argv[1]);
    if (!password && password_len != 0) {
        return JS_EXCEPTION;
    }

    size_t salt_len;
    const uint8_t *salt = JS_GetUint8Array(ctx, &salt_len, argv[2]);
    if (!salt && salt_len != 0) {
        return JS_EXCEPTION;
    }

    uint32_t iterations;
    if (JS_ToUint32(ctx, &iterations, argv[3])) {
        return JS_EXCEPTION;
    }

    uint32_t key_length;
    if (JS_ToUint32(ctx, &key_length, argv[4])) {
        return JS_EXCEPTION;
    }

    if (!JS_IsFunction(ctx, argv[5])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSPbkdf2Req *pr = js_malloc(ctx, sizeof(*pr));
    if (!pr) {
        return JS_EXCEPTION;
    }

    memset(pr, 0, sizeof(*pr));
    pr->ctx = ctx;
    pr->callback = JS_DupValue(ctx, argv[5]);
    pr->type = type;
    pr->iterations = iterations;
    pr->key_length = key_length;
    pr->r = -1;

    if (password_len > 0) {
        pr->password = js_malloc(ctx, password_len);
        if (!pr->password) {
            goto fail;
        }
        memcpy(pr->password, password, password_len);
    }
    pr->password_len = password_len;

    if (salt_len > 0) {
        pr->salt = js_malloc(ctx, salt_len);
        if (!pr->salt) {
            goto fail;
        }
        memcpy(pr->salt, salt, salt_len);
    }
    pr->salt_len = salt_len;

    pr->output = js_malloc(ctx, key_length);
    if (!pr->output) {
        goto fail;
    }

    pr->req.data = pr;

    int r = uv_queue_work(tjs_get_loop(ctx), &pr->req, tjs__pbkdf2_work_cb, tjs__pbkdf2_after_work_cb);
    if (r != 0) {
        goto fail;
    }

    return JS_UNDEFINED;

fail:
    JS_FreeValue(ctx, pr->callback);
    js_free(ctx, pr->password);
    js_free(ctx, pr->salt);
    js_free(ctx, pr->output);
    js_free(ctx, pr);
    return JS_EXCEPTION;
}

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    int type;
    uint8_t *ikm;
    size_t ikm_len;
    uint8_t *salt;
    size_t salt_len;
    uint8_t *info;
    size_t info_len;
    uint8_t *output;
    size_t key_length;
    int r;
} TJSHkdfReq;

static void tjs__hkdf_work_cb(uv_work_t *req) {
    TJSHkdfReq *hr = req->data;
    const mbedtls_md_info_t *md_info = mbedtls_md_info_from_type(digest_to_md_type[hr->type]);

    if (!md_info) {
        hr->r = -1;
        return;
    }

    hr->r = mbedtls_hkdf(md_info,
                         hr->salt,
                         hr->salt_len,
                         hr->ikm,
                         hr->ikm_len,
                         hr->info,
                         hr->info_len,
                         hr->output,
                         hr->key_length);
}

static void tjs__hkdf_after_work_cb(uv_work_t *req, int status) {
    TJSHkdfReq *hr = req->data;
    CHECK_NOT_NULL(hr);

    JSContext *ctx = hr->ctx;
    JSValue args[2];

    if (status != 0 || hr->r != 0) {
        args[0] = JS_NewString(ctx, "HKDF operation failed");
        args[1] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, hr->output, hr->key_length);
    }

    tjs_call_handler(ctx, hr->callback, 2, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, hr->callback);
    js_free(ctx, hr->ikm);
    js_free(ctx, hr->salt);
    js_free(ctx, hr->info);
    js_free(ctx, hr->output);
    js_free(ctx, hr);
}

static JSValue tjs_webcrypto_hkdf(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 6) {
        return JS_ThrowTypeError(ctx, "expected 6 arguments: type, ikm, salt, info, keyLength, callback");
    }

    int32_t type;
    if (JS_ToInt32(ctx, &type, argv[0])) {
        return JS_EXCEPTION;
    }

    if (type < DIGEST_SHA1 || type > DIGEST_SHA512) {
        return JS_ThrowRangeError(ctx, "invalid digest algorithm");
    }

    size_t ikm_len;
    const uint8_t *ikm = JS_GetUint8Array(ctx, &ikm_len, argv[1]);
    if (!ikm && ikm_len != 0) {
        return JS_EXCEPTION;
    }

    size_t salt_len;
    const uint8_t *salt = JS_GetUint8Array(ctx, &salt_len, argv[2]);
    if (!salt && salt_len != 0) {
        return JS_EXCEPTION;
    }

    size_t info_len;
    const uint8_t *info = JS_GetUint8Array(ctx, &info_len, argv[3]);
    if (!info && info_len != 0) {
        return JS_EXCEPTION;
    }

    uint32_t key_length;
    if (JS_ToUint32(ctx, &key_length, argv[4])) {
        return JS_EXCEPTION;
    }

    if (!JS_IsFunction(ctx, argv[5])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSHkdfReq *hkr = js_malloc(ctx, sizeof(*hkr));
    if (!hkr) {
        return JS_EXCEPTION;
    }

    memset(hkr, 0, sizeof(*hkr));
    hkr->ctx = ctx;
    hkr->callback = JS_DupValue(ctx, argv[5]);
    hkr->type = type;
    hkr->key_length = key_length;
    hkr->r = -1;

    if (ikm_len > 0) {
        hkr->ikm = js_malloc(ctx, ikm_len);
        if (!hkr->ikm) {
            goto fail;
        }
        memcpy(hkr->ikm, ikm, ikm_len);
    }
    hkr->ikm_len = ikm_len;

    if (salt_len > 0) {
        hkr->salt = js_malloc(ctx, salt_len);
        if (!hkr->salt) {
            goto fail;
        }
        memcpy(hkr->salt, salt, salt_len);
    }
    hkr->salt_len = salt_len;

    if (info_len > 0) {
        hkr->info = js_malloc(ctx, info_len);
        if (!hkr->info) {
            goto fail;
        }
        memcpy(hkr->info, info, info_len);
    }
    hkr->info_len = info_len;

    hkr->output = js_malloc(ctx, key_length);
    if (!hkr->output) {
        goto fail;
    }

    hkr->req.data = hkr;

    int r = uv_queue_work(tjs_get_loop(ctx), &hkr->req, tjs__hkdf_work_cb, tjs__hkdf_after_work_cb);
    if (r != 0) {
        goto fail;
    }

    return JS_UNDEFINED;

fail:
    JS_FreeValue(ctx, hkr->callback);
    js_free(ctx, hkr->ikm);
    js_free(ctx, hkr->salt);
    js_free(ctx, hkr->info);
    js_free(ctx, hkr->output);
    js_free(ctx, hkr);
    return JS_EXCEPTION;
}

/* EC curves. */
enum { CURVE_P256 = 0, CURVE_P384, CURVE_P521 };

/* clang-format off */
static const mbedtls_ecp_group_id curve_to_group_id[] = {
    [CURVE_P256] = MBEDTLS_ECP_DP_SECP256R1,
    [CURVE_P384] = MBEDTLS_ECP_DP_SECP384R1,
    [CURVE_P521] = MBEDTLS_ECP_DP_SECP521R1,
};

static const int curve_byte_sizes[] = { 32, 48, 66 };
/* clang-format on */

static int tjs__setup_rng(mbedtls_ctr_drbg_context *ctr_drbg, mbedtls_entropy_context *entropy) {
    mbedtls_ctr_drbg_init(ctr_drbg);
    mbedtls_entropy_init(entropy);
    return mbedtls_ctr_drbg_seed(ctr_drbg, mbedtls_entropy_func, entropy, NULL, 0);
}

/* EC key generation (shared by ECDSA and ECDH). */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    int curve;
    uint8_t *privkey;
    size_t privkey_len;
    uint8_t *pubkey;
    size_t pubkey_len;
    int r;
} TJSEcGenerateKeyReq;

static void tjs__ec_generate_key_work_cb(uv_work_t *req) {
    TJSEcGenerateKeyReq *er = req->data;
    mbedtls_ecdsa_context ecdsa;
    mbedtls_ctr_drbg_context ctr_drbg;
    mbedtls_entropy_context entropy;

    mbedtls_ecdsa_init(&ecdsa);

    int ret = tjs__setup_rng(&ctr_drbg, &entropy);
    if (ret != 0) {
        goto cleanup;
    }

    ret = mbedtls_ecdsa_genkey(&ecdsa, curve_to_group_id[er->curve], mbedtls_ctr_drbg_random, &ctr_drbg);
    if (ret != 0) {
        goto cleanup;
    }

    ret = mbedtls_mpi_write_binary(&ecdsa.MBEDTLS_PRIVATE(d), er->privkey, er->privkey_len);
    if (ret != 0) {
        goto cleanup;
    }

    size_t olen = 0;
    ret = mbedtls_ecp_point_write_binary(&ecdsa.MBEDTLS_PRIVATE(grp),
                                         &ecdsa.MBEDTLS_PRIVATE(Q),
                                         MBEDTLS_ECP_PF_UNCOMPRESSED,
                                         &olen,
                                         er->pubkey,
                                         er->pubkey_len);

cleanup:
    mbedtls_ecdsa_free(&ecdsa);
    mbedtls_ctr_drbg_free(&ctr_drbg);
    mbedtls_entropy_free(&entropy);
    er->r = ret;
}

static void tjs__ec_generate_key_after_work_cb(uv_work_t *req, int status) {
    TJSEcGenerateKeyReq *er = req->data;
    CHECK_NOT_NULL(er);

    JSContext *ctx = er->ctx;
    JSValue args[3];

    if (status != 0 || er->r != 0) {
        args[0] = JS_NewString(ctx, "EC key generation failed");
        args[1] = JS_UNDEFINED;
        args[2] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, er->privkey, er->privkey_len);
        args[2] = JS_NewUint8ArrayCopy(ctx, er->pubkey, er->pubkey_len);
    }

    tjs_call_handler(ctx, er->callback, 3, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, args[2]);
    JS_FreeValue(ctx, er->callback);
    js_free(ctx, er->privkey);
    js_free(ctx, er->pubkey);
    js_free(ctx, er);
}

static JSValue tjs_webcrypto_ec_generate_key(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 2) {
        return JS_ThrowTypeError(ctx, "expected 2 arguments: curveId, callback");
    }

    int32_t curve;
    if (JS_ToInt32(ctx, &curve, argv[0])) {
        return JS_EXCEPTION;
    }

    if (curve < CURVE_P256 || curve > CURVE_P521) {
        return JS_ThrowRangeError(ctx, "invalid curve");
    }

    if (!JS_IsFunction(ctx, argv[1])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    int key_size = curve_byte_sizes[curve];

    TJSEcGenerateKeyReq *er = js_malloc(ctx, sizeof(*er));
    if (!er) {
        return JS_EXCEPTION;
    }

    memset(er, 0, sizeof(*er));
    er->ctx = ctx;
    er->callback = JS_DupValue(ctx, argv[1]);
    er->curve = curve;
    er->privkey_len = key_size;
    er->pubkey_len = 1 + 2 * key_size;

    er->privkey = js_malloc(ctx, er->privkey_len);
    if (!er->privkey) {
        goto fail;
    }

    er->pubkey = js_malloc(ctx, er->pubkey_len);
    if (!er->pubkey) {
        goto fail;
    }

    er->req.data = er;

    int r =
        uv_queue_work(tjs_get_loop(ctx), &er->req, tjs__ec_generate_key_work_cb, tjs__ec_generate_key_after_work_cb);
    if (r != 0) {
        goto fail;
    }

    return JS_UNDEFINED;

fail:
    JS_FreeValue(ctx, er->callback);
    js_free(ctx, er->privkey);
    js_free(ctx, er->pubkey);
    js_free(ctx, er);
    return JS_EXCEPTION;
}

/* ECDSA sign. */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    int curve;
    int hash_type;
    uint8_t *privkey;
    size_t privkey_len;
    uint8_t *data;
    size_t data_len;
    uint8_t *signature;
    size_t sig_len;
    int r;
} TJSEcdsaSignReq;

static void tjs__ecdsa_sign_work_cb(uv_work_t *req) {
    TJSEcdsaSignReq *sr = req->data;
    mbedtls_ecp_group grp;
    mbedtls_mpi d, r_mpi, s_mpi;
    mbedtls_ctr_drbg_context ctr_drbg;
    mbedtls_entropy_context entropy;
    uint8_t hash[64]; /* Max SHA-512. */

    mbedtls_ecp_group_init(&grp);
    mbedtls_mpi_init(&d);
    mbedtls_mpi_init(&r_mpi);
    mbedtls_mpi_init(&s_mpi);

    int ret = tjs__setup_rng(&ctr_drbg, &entropy);
    if (ret != 0) {
        goto cleanup;
    }

    /* Hash the data. */
    mbedtls_md_type_t md_type = digest_to_md_type[sr->hash_type];
    const mbedtls_md_info_t *md_info = mbedtls_md_info_from_type(md_type);
    if (!md_info) {
        ret = -1;
        goto cleanup;
    }

    size_t hash_len = mbedtls_md_get_size(md_info);
    ret = mbedtls_md(md_info, sr->data, sr->data_len, hash);
    if (ret != 0) {
        goto cleanup;
    }

    /* Load EC group and private key. */
    ret = mbedtls_ecp_group_load(&grp, curve_to_group_id[sr->curve]);
    if (ret != 0) {
        goto cleanup;
    }

    ret = mbedtls_mpi_read_binary(&d, sr->privkey, sr->privkey_len);
    if (ret != 0) {
        goto cleanup;
    }

    /* Deterministic ECDSA sign. */
    ret = mbedtls_ecdsa_sign_det_ext(&grp,
                                     &r_mpi,
                                     &s_mpi,
                                     &d,
                                     hash,
                                     hash_len,
                                     md_type,
                                     mbedtls_ctr_drbg_random,
                                     &ctr_drbg);
    if (ret != 0) {
        goto cleanup;
    }

    /* Write r || s in IEEE P1363 format. */
    int key_size = curve_byte_sizes[sr->curve];
    ret = mbedtls_mpi_write_binary(&r_mpi, sr->signature, key_size);
    if (ret != 0) {
        goto cleanup;
    }
    ret = mbedtls_mpi_write_binary(&s_mpi, sr->signature + key_size, key_size);

cleanup:
    mbedtls_mpi_free(&s_mpi);
    mbedtls_mpi_free(&r_mpi);
    mbedtls_mpi_free(&d);
    mbedtls_ecp_group_free(&grp);
    mbedtls_ctr_drbg_free(&ctr_drbg);
    mbedtls_entropy_free(&entropy);
    sr->r = ret;
}

static void tjs__ecdsa_sign_after_work_cb(uv_work_t *req, int status) {
    TJSEcdsaSignReq *sr = req->data;
    CHECK_NOT_NULL(sr);

    JSContext *ctx = sr->ctx;
    JSValue args[2];

    if (status != 0 || sr->r != 0) {
        args[0] = JS_NewString(ctx, "ECDSA sign failed");
        args[1] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, sr->signature, sr->sig_len);
    }

    tjs_call_handler(ctx, sr->callback, 2, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, sr->callback);
    js_free(ctx, sr->privkey);
    js_free(ctx, sr->data);
    js_free(ctx, sr->signature);
    js_free(ctx, sr);
}

static JSValue tjs_webcrypto_ecdsa_sign(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 5) {
        return JS_ThrowTypeError(ctx, "expected 5 arguments: curveId, hashType, privKey, data, callback");
    }

    int32_t curve;
    if (JS_ToInt32(ctx, &curve, argv[0])) {
        return JS_EXCEPTION;
    }

    if (curve < CURVE_P256 || curve > CURVE_P521) {
        return JS_ThrowRangeError(ctx, "invalid curve");
    }

    int32_t hash_type;
    if (JS_ToInt32(ctx, &hash_type, argv[1])) {
        return JS_EXCEPTION;
    }

    if (hash_type < DIGEST_SHA1 || hash_type > DIGEST_SHA512) {
        return JS_ThrowRangeError(ctx, "invalid digest algorithm");
    }

    size_t privkey_len;
    const uint8_t *privkey = JS_GetUint8Array(ctx, &privkey_len, argv[2]);
    if (!privkey) {
        return JS_EXCEPTION;
    }

    size_t data_len;
    const uint8_t *data = JS_GetUint8Array(ctx, &data_len, argv[3]);
    if (!data && data_len != 0) {
        return JS_EXCEPTION;
    }

    if (!JS_IsFunction(ctx, argv[4])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    int key_size = curve_byte_sizes[curve];

    TJSEcdsaSignReq *sr = js_malloc(ctx, sizeof(*sr));
    if (!sr) {
        return JS_EXCEPTION;
    }

    memset(sr, 0, sizeof(*sr));
    sr->ctx = ctx;
    sr->callback = JS_DupValue(ctx, argv[4]);
    sr->curve = curve;
    sr->hash_type = hash_type;
    sr->sig_len = 2 * key_size;
    sr->r = -1;

    sr->privkey = js_malloc(ctx, privkey_len);
    if (!sr->privkey) {
        goto fail;
    }
    memcpy(sr->privkey, privkey, privkey_len);
    sr->privkey_len = privkey_len;

    if (data_len > 0) {
        sr->data = js_malloc(ctx, data_len);
        if (!sr->data) {
            goto fail;
        }
        memcpy(sr->data, data, data_len);
    }
    sr->data_len = data_len;

    sr->signature = js_malloc(ctx, sr->sig_len);
    if (!sr->signature) {
        goto fail;
    }

    sr->req.data = sr;

    int r = uv_queue_work(tjs_get_loop(ctx), &sr->req, tjs__ecdsa_sign_work_cb, tjs__ecdsa_sign_after_work_cb);
    if (r != 0) {
        goto fail;
    }

    return JS_UNDEFINED;

fail:
    JS_FreeValue(ctx, sr->callback);
    js_free(ctx, sr->privkey);
    js_free(ctx, sr->data);
    js_free(ctx, sr->signature);
    js_free(ctx, sr);
    return JS_EXCEPTION;
}

/* ECDSA verify. */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    int curve;
    int hash_type;
    uint8_t *pubkey;
    size_t pubkey_len;
    uint8_t *signature;
    size_t sig_len;
    uint8_t *data;
    size_t data_len;
    int r;
} TJSEcdsaVerifyReq;

static void tjs__ecdsa_verify_work_cb(uv_work_t *req) {
    TJSEcdsaVerifyReq *vr = req->data;
    mbedtls_ecp_group grp;
    mbedtls_ecp_point Q;
    mbedtls_mpi r_mpi, s_mpi;
    uint8_t hash[64];

    mbedtls_ecp_group_init(&grp);
    mbedtls_ecp_point_init(&Q);
    mbedtls_mpi_init(&r_mpi);
    mbedtls_mpi_init(&s_mpi);

    /* Hash the data. */
    mbedtls_md_type_t md_type = digest_to_md_type[vr->hash_type];
    const mbedtls_md_info_t *md_info = mbedtls_md_info_from_type(md_type);
    if (!md_info) {
        vr->r = -1;
        goto cleanup;
    }

    size_t hash_len = mbedtls_md_get_size(md_info);
    int ret = mbedtls_md(md_info, vr->data, vr->data_len, hash);
    if (ret != 0) {
        vr->r = ret;
        goto cleanup;
    }

    /* Load EC group and public key. */
    ret = mbedtls_ecp_group_load(&grp, curve_to_group_id[vr->curve]);
    if (ret != 0) {
        vr->r = ret;
        goto cleanup;
    }

    ret = mbedtls_ecp_point_read_binary(&grp, &Q, vr->pubkey, vr->pubkey_len);
    if (ret != 0) {
        vr->r = ret;
        goto cleanup;
    }

    /* Read r and s from signature (IEEE P1363: r || s). */
    int key_size = curve_byte_sizes[vr->curve];
    ret = mbedtls_mpi_read_binary(&r_mpi, vr->signature, key_size);
    if (ret != 0) {
        vr->r = ret;
        goto cleanup;
    }

    ret = mbedtls_mpi_read_binary(&s_mpi, vr->signature + key_size, key_size);
    if (ret != 0) {
        vr->r = ret;
        goto cleanup;
    }

    /* Verify: r == 0 means valid. */
    vr->r = mbedtls_ecdsa_verify(&grp, hash, hash_len, &Q, &r_mpi, &s_mpi);

cleanup:
    mbedtls_mpi_free(&s_mpi);
    mbedtls_mpi_free(&r_mpi);
    mbedtls_ecp_point_free(&Q);
    mbedtls_ecp_group_free(&grp);
}

static void tjs__ecdsa_verify_after_work_cb(uv_work_t *req, int status) {
    TJSEcdsaVerifyReq *vr = req->data;
    CHECK_NOT_NULL(vr);

    JSContext *ctx = vr->ctx;
    JSValue args[2];

    if (status != 0) {
        args[0] = JS_NewString(ctx, "ECDSA verify failed");
        args[1] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewBool(ctx, vr->r == 0);
    }

    tjs_call_handler(ctx, vr->callback, 2, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, vr->callback);
    js_free(ctx, vr->pubkey);
    js_free(ctx, vr->signature);
    js_free(ctx, vr->data);
    js_free(ctx, vr);
}

static JSValue tjs_webcrypto_ecdsa_verify(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 6) {
        return JS_ThrowTypeError(ctx, "expected 6 arguments: curveId, hashType, pubKey, signature, data, callback");
    }

    int32_t curve;
    if (JS_ToInt32(ctx, &curve, argv[0])) {
        return JS_EXCEPTION;
    }

    if (curve < CURVE_P256 || curve > CURVE_P521) {
        return JS_ThrowRangeError(ctx, "invalid curve");
    }

    int32_t hash_type;
    if (JS_ToInt32(ctx, &hash_type, argv[1])) {
        return JS_EXCEPTION;
    }

    if (hash_type < DIGEST_SHA1 || hash_type > DIGEST_SHA512) {
        return JS_ThrowRangeError(ctx, "invalid digest algorithm");
    }

    size_t pubkey_len;
    const uint8_t *pubkey = JS_GetUint8Array(ctx, &pubkey_len, argv[2]);
    if (!pubkey) {
        return JS_EXCEPTION;
    }

    size_t sig_len;
    const uint8_t *signature = JS_GetUint8Array(ctx, &sig_len, argv[3]);
    if (!signature) {
        return JS_EXCEPTION;
    }

    size_t data_len;
    const uint8_t *data = JS_GetUint8Array(ctx, &data_len, argv[4]);
    if (!data && data_len != 0) {
        return JS_EXCEPTION;
    }

    if (!JS_IsFunction(ctx, argv[5])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSEcdsaVerifyReq *vr = js_malloc(ctx, sizeof(*vr));
    if (!vr) {
        return JS_EXCEPTION;
    }

    memset(vr, 0, sizeof(*vr));
    vr->ctx = ctx;
    vr->callback = JS_DupValue(ctx, argv[5]);
    vr->curve = curve;
    vr->hash_type = hash_type;
    vr->r = -1;

    vr->pubkey = js_malloc(ctx, pubkey_len);
    if (!vr->pubkey) {
        goto fail;
    }
    memcpy(vr->pubkey, pubkey, pubkey_len);
    vr->pubkey_len = pubkey_len;

    vr->signature = js_malloc(ctx, sig_len);
    if (!vr->signature) {
        goto fail;
    }
    memcpy(vr->signature, signature, sig_len);
    vr->sig_len = sig_len;

    if (data_len > 0) {
        vr->data = js_malloc(ctx, data_len);
        if (!vr->data) {
            goto fail;
        }
        memcpy(vr->data, data, data_len);
    }
    vr->data_len = data_len;

    vr->req.data = vr;

    int r = uv_queue_work(tjs_get_loop(ctx), &vr->req, tjs__ecdsa_verify_work_cb, tjs__ecdsa_verify_after_work_cb);
    if (r != 0) {
        goto fail;
    }

    return JS_UNDEFINED;

fail:
    JS_FreeValue(ctx, vr->callback);
    js_free(ctx, vr->pubkey);
    js_free(ctx, vr->signature);
    js_free(ctx, vr->data);
    js_free(ctx, vr);
    return JS_EXCEPTION;
}

/* ECDH deriveBits. */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    int curve;
    uint8_t *privkey;
    size_t privkey_len;
    uint8_t *pubkey;
    size_t pubkey_len;
    uint8_t *output;
    size_t output_len;
    int r;
} TJSEcdhDeriveBitsReq;

static void tjs__ecdh_derive_bits_work_cb(uv_work_t *req) {
    TJSEcdhDeriveBitsReq *dr = req->data;
    mbedtls_ecp_group grp;
    mbedtls_mpi d, z;
    mbedtls_ecp_point Q;
    mbedtls_ctr_drbg_context ctr_drbg;
    mbedtls_entropy_context entropy;

    mbedtls_ecp_group_init(&grp);
    mbedtls_mpi_init(&d);
    mbedtls_mpi_init(&z);
    mbedtls_ecp_point_init(&Q);

    int ret = tjs__setup_rng(&ctr_drbg, &entropy);
    if (ret != 0) {
        goto cleanup;
    }

    ret = mbedtls_ecp_group_load(&grp, curve_to_group_id[dr->curve]);
    if (ret != 0) {
        goto cleanup;
    }

    ret = mbedtls_mpi_read_binary(&d, dr->privkey, dr->privkey_len);
    if (ret != 0) {
        goto cleanup;
    }

    ret = mbedtls_ecp_point_read_binary(&grp, &Q, dr->pubkey, dr->pubkey_len);
    if (ret != 0) {
        goto cleanup;
    }

    ret = mbedtls_ecdh_compute_shared(&grp, &z, &Q, &d, mbedtls_ctr_drbg_random, &ctr_drbg);
    if (ret != 0) {
        goto cleanup;
    }

    ret = mbedtls_mpi_write_binary(&z, dr->output, dr->output_len);

cleanup:
    mbedtls_ecp_point_free(&Q);
    mbedtls_mpi_free(&z);
    mbedtls_mpi_free(&d);
    mbedtls_ecp_group_free(&grp);
    mbedtls_ctr_drbg_free(&ctr_drbg);
    mbedtls_entropy_free(&entropy);
    dr->r = ret;
}

static void tjs__ecdh_derive_bits_after_work_cb(uv_work_t *req, int status) {
    TJSEcdhDeriveBitsReq *dr = req->data;
    CHECK_NOT_NULL(dr);

    JSContext *ctx = dr->ctx;
    JSValue args[2];

    if (status != 0 || dr->r != 0) {
        args[0] = JS_NewString(ctx, "ECDH deriveBits failed");
        args[1] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, dr->output, dr->output_len);
    }

    tjs_call_handler(ctx, dr->callback, 2, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, dr->callback);
    js_free(ctx, dr->privkey);
    js_free(ctx, dr->pubkey);
    js_free(ctx, dr->output);
    js_free(ctx, dr);
}

static JSValue tjs_webcrypto_ecdh_derive_bits(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 4) {
        return JS_ThrowTypeError(ctx, "expected 4 arguments: curveId, privKey, pubKey, callback");
    }

    int32_t curve;
    if (JS_ToInt32(ctx, &curve, argv[0])) {
        return JS_EXCEPTION;
    }

    if (curve < CURVE_P256 || curve > CURVE_P521) {
        return JS_ThrowRangeError(ctx, "invalid curve");
    }

    size_t privkey_len;
    const uint8_t *privkey = JS_GetUint8Array(ctx, &privkey_len, argv[1]);
    if (!privkey) {
        return JS_EXCEPTION;
    }

    size_t pubkey_len;
    const uint8_t *pubkey = JS_GetUint8Array(ctx, &pubkey_len, argv[2]);
    if (!pubkey) {
        return JS_EXCEPTION;
    }

    if (!JS_IsFunction(ctx, argv[3])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSEcdhDeriveBitsReq *dr = js_malloc(ctx, sizeof(*dr));
    if (!dr) {
        return JS_EXCEPTION;
    }

    memset(dr, 0, sizeof(*dr));
    dr->ctx = ctx;
    dr->callback = JS_DupValue(ctx, argv[3]);
    dr->curve = curve;
    dr->output_len = curve_byte_sizes[curve];
    dr->r = -1;

    dr->privkey = js_malloc(ctx, privkey_len);
    if (!dr->privkey) {
        goto fail;
    }
    memcpy(dr->privkey, privkey, privkey_len);
    dr->privkey_len = privkey_len;

    dr->pubkey = js_malloc(ctx, pubkey_len);
    if (!dr->pubkey) {
        goto fail;
    }
    memcpy(dr->pubkey, pubkey, pubkey_len);
    dr->pubkey_len = pubkey_len;

    dr->output = js_malloc(ctx, dr->output_len);
    if (!dr->output) {
        goto fail;
    }

    dr->req.data = dr;

    int r =
        uv_queue_work(tjs_get_loop(ctx), &dr->req, tjs__ecdh_derive_bits_work_cb, tjs__ecdh_derive_bits_after_work_cb);
    if (r != 0) {
        goto fail;
    }

    return JS_UNDEFINED;

fail:
    JS_FreeValue(ctx, dr->callback);
    js_free(ctx, dr->privkey);
    js_free(ctx, dr->pubkey);
    js_free(ctx, dr->output);
    js_free(ctx, dr);
    return JS_EXCEPTION;
}

/* RSA padding modes. */
enum { RSA_PADDING_PSS = 0, RSA_PADDING_PKCS1V15 };

/* RSA key generation. */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    uint32_t modulus_length;
    int exponent;
    uint8_t *privkey_der;
    size_t privkey_der_len;
    uint8_t *pubkey_der;
    size_t pubkey_der_len;
    int r;
} TJSRsaGenerateKeyReq;

static void tjs__rsa_generate_key_work_cb(uv_work_t *req) {
    TJSRsaGenerateKeyReq *rr = req->data;
    mbedtls_pk_context pk;
    mbedtls_ctr_drbg_context ctr_drbg;
    mbedtls_entropy_context entropy;

    mbedtls_pk_init(&pk);

    int ret = tjs__setup_rng(&ctr_drbg, &entropy);
    if (ret != 0) {
        goto cleanup;
    }

    ret = mbedtls_pk_setup(&pk, mbedtls_pk_info_from_type(MBEDTLS_PK_RSA));
    if (ret != 0) {
        goto cleanup;
    }

    ret = mbedtls_rsa_gen_key(mbedtls_pk_rsa(pk), mbedtls_ctr_drbg_random, &ctr_drbg, rr->modulus_length, rr->exponent);
    if (ret != 0) {
        goto cleanup;
    }

    /* Write private key DER (writes from end of buffer). */
    {
        size_t buf_size = 4 * (rr->modulus_length / 8) + 512;
        uint8_t *buf = malloc(buf_size);
        if (!buf) {
            ret = -1;
            goto cleanup;
        }

        int len = mbedtls_pk_write_key_der(&pk, buf, buf_size);
        if (len < 0) {
            free(buf);
            ret = len;
            goto cleanup;
        }

        rr->privkey_der = malloc(len);
        if (!rr->privkey_der) {
            free(buf);
            ret = -1;
            goto cleanup;
        }
        memcpy(rr->privkey_der, buf + buf_size - len, len);
        rr->privkey_der_len = len;
        free(buf);
    }

    /* Write public key DER. */
    {
        size_t buf_size = (rr->modulus_length / 8) + 256;
        uint8_t *buf = malloc(buf_size);
        if (!buf) {
            ret = -1;
            goto cleanup;
        }

        int len = mbedtls_pk_write_pubkey_der(&pk, buf, buf_size);
        if (len < 0) {
            free(buf);
            ret = len;
            goto cleanup;
        }

        rr->pubkey_der = malloc(len);
        if (!rr->pubkey_der) {
            free(buf);
            ret = -1;
            goto cleanup;
        }
        memcpy(rr->pubkey_der, buf + buf_size - len, len);
        rr->pubkey_der_len = len;
        free(buf);
    }

cleanup:
    mbedtls_pk_free(&pk);
    mbedtls_ctr_drbg_free(&ctr_drbg);
    mbedtls_entropy_free(&entropy);
    rr->r = ret;
}

static void tjs__rsa_generate_key_after_work_cb(uv_work_t *req, int status) {
    TJSRsaGenerateKeyReq *rr = req->data;
    CHECK_NOT_NULL(rr);

    JSContext *ctx = rr->ctx;
    JSValue args[3];

    if (status != 0 || rr->r != 0) {
        args[0] = JS_NewString(ctx, "RSA key generation failed");
        args[1] = JS_UNDEFINED;
        args[2] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, rr->privkey_der, rr->privkey_der_len);
        args[2] = JS_NewUint8ArrayCopy(ctx, rr->pubkey_der, rr->pubkey_der_len);
    }

    tjs_call_handler(ctx, rr->callback, 3, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, args[2]);
    JS_FreeValue(ctx, rr->callback);
    free(rr->privkey_der);
    free(rr->pubkey_der);
    js_free(ctx, rr);
}

static JSValue tjs_webcrypto_rsa_generate_key(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 3) {
        return JS_ThrowTypeError(ctx, "expected 3 arguments: modulusLength, pubExpBuf, callback");
    }

    uint32_t modulus_length;
    if (JS_ToUint32(ctx, &modulus_length, argv[0])) {
        return JS_EXCEPTION;
    }

    /* Convert public exponent from big-endian Uint8Array to int. */
    size_t exp_len;
    const uint8_t *exp_buf = JS_GetUint8Array(ctx, &exp_len, argv[1]);
    if (!exp_buf) {
        return JS_EXCEPTION;
    }

    int exponent = 0;
    for (size_t i = 0; i < exp_len; i++) {
        exponent = (exponent << 8) | exp_buf[i];
    }

    if (!JS_IsFunction(ctx, argv[2])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSRsaGenerateKeyReq *rr = js_malloc(ctx, sizeof(*rr));
    if (!rr) {
        return JS_EXCEPTION;
    }

    memset(rr, 0, sizeof(*rr));
    rr->ctx = ctx;
    rr->callback = JS_DupValue(ctx, argv[2]);
    rr->modulus_length = modulus_length;
    rr->exponent = exponent;
    rr->r = -1;

    rr->req.data = rr;

    int r =
        uv_queue_work(tjs_get_loop(ctx), &rr->req, tjs__rsa_generate_key_work_cb, tjs__rsa_generate_key_after_work_cb);
    if (r != 0) {
        JS_FreeValue(ctx, rr->callback);
        js_free(ctx, rr);
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

/* RSA-OAEP encrypt. */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    int hash_type;
    uint8_t *pubkey_der;
    size_t pubkey_der_len;
    uint8_t *data;
    size_t data_len;
    uint8_t *label;
    size_t label_len;
    uint8_t *output;
    size_t output_len;
    int r;
} TJSRsaOaepEncryptReq;

static void tjs__rsa_oaep_encrypt_work_cb(uv_work_t *req) {
    TJSRsaOaepEncryptReq *er = req->data;
    mbedtls_pk_context pk;
    mbedtls_ctr_drbg_context ctr_drbg;
    mbedtls_entropy_context entropy;

    mbedtls_pk_init(&pk);

    int ret = tjs__setup_rng(&ctr_drbg, &entropy);
    if (ret != 0) {
        goto cleanup;
    }

    ret = mbedtls_pk_parse_public_key(&pk, er->pubkey_der, er->pubkey_der_len);
    if (ret != 0) {
        goto cleanup;
    }

    mbedtls_rsa_context *rsa = mbedtls_pk_rsa(pk);
    mbedtls_rsa_set_padding(rsa, MBEDTLS_RSA_PKCS_V21, digest_to_md_type[er->hash_type]);

    er->output_len = mbedtls_rsa_get_len(rsa);
    er->output = malloc(er->output_len);
    if (!er->output) {
        ret = -1;
        goto cleanup;
    }

    ret = mbedtls_rsa_rsaes_oaep_encrypt(rsa,
                                         mbedtls_ctr_drbg_random,
                                         &ctr_drbg,
                                         er->label,
                                         er->label_len,
                                         er->data_len,
                                         er->data,
                                         er->output);

cleanup:
    mbedtls_pk_free(&pk);
    mbedtls_ctr_drbg_free(&ctr_drbg);
    mbedtls_entropy_free(&entropy);
    er->r = ret;
}

static void tjs__rsa_oaep_encrypt_after_work_cb(uv_work_t *req, int status) {
    TJSRsaOaepEncryptReq *er = req->data;
    CHECK_NOT_NULL(er);

    JSContext *ctx = er->ctx;
    JSValue args[2];

    if (status != 0 || er->r != 0) {
        args[0] = JS_NewString(ctx, "RSA-OAEP encrypt failed");
        args[1] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, er->output, er->output_len);
    }

    tjs_call_handler(ctx, er->callback, 2, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, er->callback);
    js_free(ctx, er->pubkey_der);
    js_free(ctx, er->data);
    js_free(ctx, er->label);
    free(er->output);
    js_free(ctx, er);
}

static JSValue tjs_webcrypto_rsa_oaep_encrypt(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 5) {
        return JS_ThrowTypeError(ctx, "expected 5 arguments: hashType, pubDER, data, label, callback");
    }

    int32_t hash_type;
    if (JS_ToInt32(ctx, &hash_type, argv[0])) {
        return JS_EXCEPTION;
    }

    if (hash_type < DIGEST_SHA1 || hash_type > DIGEST_SHA512) {
        return JS_ThrowRangeError(ctx, "invalid digest algorithm");
    }

    size_t pubkey_der_len;
    const uint8_t *pubkey_der = JS_GetUint8Array(ctx, &pubkey_der_len, argv[1]);
    if (!pubkey_der) {
        return JS_EXCEPTION;
    }

    size_t data_len;
    const uint8_t *data = JS_GetUint8Array(ctx, &data_len, argv[2]);
    if (!data && data_len != 0) {
        return JS_EXCEPTION;
    }

    /* Label is optional. */
    size_t label_len = 0;
    const uint8_t *label = NULL;
    if (!JS_IsUndefined(argv[3])) {
        label = JS_GetUint8Array(ctx, &label_len, argv[3]);
        if (!label && label_len != 0) {
            return JS_EXCEPTION;
        }
    }

    if (!JS_IsFunction(ctx, argv[4])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSRsaOaepEncryptReq *er = js_malloc(ctx, sizeof(*er));
    if (!er) {
        return JS_EXCEPTION;
    }

    memset(er, 0, sizeof(*er));
    er->ctx = ctx;
    er->callback = JS_DupValue(ctx, argv[4]);
    er->hash_type = hash_type;
    er->r = -1;

    er->pubkey_der = js_malloc(ctx, pubkey_der_len);
    if (!er->pubkey_der) {
        goto fail;
    }
    memcpy(er->pubkey_der, pubkey_der, pubkey_der_len);
    er->pubkey_der_len = pubkey_der_len;

    if (data_len > 0) {
        er->data = js_malloc(ctx, data_len);
        if (!er->data) {
            goto fail;
        }
        memcpy(er->data, data, data_len);
    }
    er->data_len = data_len;

    if (label_len > 0) {
        er->label = js_malloc(ctx, label_len);
        if (!er->label) {
            goto fail;
        }
        memcpy(er->label, label, label_len);
    }
    er->label_len = label_len;

    er->req.data = er;

    int r =
        uv_queue_work(tjs_get_loop(ctx), &er->req, tjs__rsa_oaep_encrypt_work_cb, tjs__rsa_oaep_encrypt_after_work_cb);
    if (r != 0) {
        goto fail;
    }

    return JS_UNDEFINED;

fail:
    JS_FreeValue(ctx, er->callback);
    js_free(ctx, er->pubkey_der);
    js_free(ctx, er->data);
    js_free(ctx, er->label);
    js_free(ctx, er);
    return JS_EXCEPTION;
}

/* RSA-OAEP decrypt. */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    int hash_type;
    uint8_t *privkey_der;
    size_t privkey_der_len;
    uint8_t *data;
    size_t data_len;
    uint8_t *label;
    size_t label_len;
    uint8_t *output;
    size_t output_len;
    size_t output_alloc;
    int r;
} TJSRsaOaepDecryptReq;

static void tjs__rsa_oaep_decrypt_work_cb(uv_work_t *req) {
    TJSRsaOaepDecryptReq *dr = req->data;
    mbedtls_pk_context pk;
    mbedtls_ctr_drbg_context ctr_drbg;
    mbedtls_entropy_context entropy;

    mbedtls_pk_init(&pk);

    int ret = tjs__setup_rng(&ctr_drbg, &entropy);
    if (ret != 0) {
        goto cleanup;
    }

    ret = mbedtls_pk_parse_key(&pk, dr->privkey_der, dr->privkey_der_len, NULL, 0, mbedtls_ctr_drbg_random, &ctr_drbg);
    if (ret != 0) {
        goto cleanup;
    }

    mbedtls_rsa_context *rsa = mbedtls_pk_rsa(pk);
    mbedtls_rsa_set_padding(rsa, MBEDTLS_RSA_PKCS_V21, digest_to_md_type[dr->hash_type]);

    dr->output_alloc = mbedtls_rsa_get_len(rsa);
    dr->output = malloc(dr->output_alloc);
    if (!dr->output) {
        ret = -1;
        goto cleanup;
    }

    ret = mbedtls_rsa_rsaes_oaep_decrypt(rsa,
                                         mbedtls_ctr_drbg_random,
                                         &ctr_drbg,
                                         dr->label,
                                         dr->label_len,
                                         &dr->output_len,
                                         dr->data,
                                         dr->output,
                                         dr->output_alloc);

cleanup:
    mbedtls_pk_free(&pk);
    mbedtls_ctr_drbg_free(&ctr_drbg);
    mbedtls_entropy_free(&entropy);
    dr->r = ret;
}

static void tjs__rsa_oaep_decrypt_after_work_cb(uv_work_t *req, int status) {
    TJSRsaOaepDecryptReq *dr = req->data;
    CHECK_NOT_NULL(dr);

    JSContext *ctx = dr->ctx;
    JSValue args[2];

    if (status != 0 || dr->r != 0) {
        args[0] = JS_NewString(ctx, "RSA-OAEP decrypt failed");
        args[1] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, dr->output, dr->output_len);
    }

    tjs_call_handler(ctx, dr->callback, 2, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, dr->callback);
    js_free(ctx, dr->privkey_der);
    js_free(ctx, dr->data);
    js_free(ctx, dr->label);
    free(dr->output);
    js_free(ctx, dr);
}

static JSValue tjs_webcrypto_rsa_oaep_decrypt(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 5) {
        return JS_ThrowTypeError(ctx, "expected 5 arguments: hashType, privDER, data, label, callback");
    }

    int32_t hash_type;
    if (JS_ToInt32(ctx, &hash_type, argv[0])) {
        return JS_EXCEPTION;
    }

    if (hash_type < DIGEST_SHA1 || hash_type > DIGEST_SHA512) {
        return JS_ThrowRangeError(ctx, "invalid digest algorithm");
    }

    size_t privkey_der_len;
    const uint8_t *privkey_der = JS_GetUint8Array(ctx, &privkey_der_len, argv[1]);
    if (!privkey_der) {
        return JS_EXCEPTION;
    }

    size_t data_len;
    const uint8_t *data = JS_GetUint8Array(ctx, &data_len, argv[2]);
    if (!data) {
        return JS_EXCEPTION;
    }

    /* Label is optional. */
    size_t label_len = 0;
    const uint8_t *label = NULL;
    if (!JS_IsUndefined(argv[3])) {
        label = JS_GetUint8Array(ctx, &label_len, argv[3]);
        if (!label && label_len != 0) {
            return JS_EXCEPTION;
        }
    }

    if (!JS_IsFunction(ctx, argv[4])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSRsaOaepDecryptReq *dr = js_malloc(ctx, sizeof(*dr));
    if (!dr) {
        return JS_EXCEPTION;
    }

    memset(dr, 0, sizeof(*dr));
    dr->ctx = ctx;
    dr->callback = JS_DupValue(ctx, argv[4]);
    dr->hash_type = hash_type;
    dr->r = -1;

    dr->privkey_der = js_malloc(ctx, privkey_der_len);
    if (!dr->privkey_der) {
        goto fail;
    }
    memcpy(dr->privkey_der, privkey_der, privkey_der_len);
    dr->privkey_der_len = privkey_der_len;

    dr->data = js_malloc(ctx, data_len);
    if (!dr->data) {
        goto fail;
    }
    memcpy(dr->data, data, data_len);
    dr->data_len = data_len;

    if (label_len > 0) {
        dr->label = js_malloc(ctx, label_len);
        if (!dr->label) {
            goto fail;
        }
        memcpy(dr->label, label, label_len);
    }
    dr->label_len = label_len;

    dr->req.data = dr;

    int r =
        uv_queue_work(tjs_get_loop(ctx), &dr->req, tjs__rsa_oaep_decrypt_work_cb, tjs__rsa_oaep_decrypt_after_work_cb);
    if (r != 0) {
        goto fail;
    }

    return JS_UNDEFINED;

fail:
    JS_FreeValue(ctx, dr->callback);
    js_free(ctx, dr->privkey_der);
    js_free(ctx, dr->data);
    js_free(ctx, dr->label);
    js_free(ctx, dr);
    return JS_EXCEPTION;
}

/* RSA sign (PSS + PKCS1v15). */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    int padding_mode;
    int hash_type;
    int salt_length;
    uint8_t *privkey_der;
    size_t privkey_der_len;
    uint8_t *data;
    size_t data_len;
    uint8_t *signature;
    size_t sig_len;
    int r;
} TJSRsaSignReq;

static void tjs__rsa_sign_work_cb(uv_work_t *req) {
    TJSRsaSignReq *sr = req->data;
    mbedtls_pk_context pk;
    mbedtls_ctr_drbg_context ctr_drbg;
    mbedtls_entropy_context entropy;
    uint8_t hash[64]; /* Max SHA-512. */

    mbedtls_pk_init(&pk);

    int ret = tjs__setup_rng(&ctr_drbg, &entropy);
    if (ret != 0) {
        goto cleanup;
    }

    ret = mbedtls_pk_parse_key(&pk, sr->privkey_der, sr->privkey_der_len, NULL, 0, mbedtls_ctr_drbg_random, &ctr_drbg);
    if (ret != 0) {
        goto cleanup;
    }

    /* Hash the data. */
    mbedtls_md_type_t md_type = digest_to_md_type[sr->hash_type];
    const mbedtls_md_info_t *md_info = mbedtls_md_info_from_type(md_type);
    if (!md_info) {
        ret = -1;
        goto cleanup;
    }

    size_t hash_len = mbedtls_md_get_size(md_info);
    ret = mbedtls_md(md_info, sr->data, sr->data_len, hash);
    if (ret != 0) {
        goto cleanup;
    }

    mbedtls_rsa_context *rsa = mbedtls_pk_rsa(pk);
    sr->sig_len = mbedtls_rsa_get_len(rsa);
    sr->signature = malloc(sr->sig_len);
    if (!sr->signature) {
        ret = -1;
        goto cleanup;
    }

    if (sr->padding_mode == RSA_PADDING_PSS) {
        mbedtls_rsa_set_padding(rsa, MBEDTLS_RSA_PKCS_V21, md_type);
        ret = mbedtls_rsa_rsassa_pss_sign_ext(rsa,
                                              mbedtls_ctr_drbg_random,
                                              &ctr_drbg,
                                              md_type,
                                              (unsigned int) hash_len,
                                              hash,
                                              sr->salt_length,
                                              sr->signature);
    } else {
        mbedtls_rsa_set_padding(rsa, MBEDTLS_RSA_PKCS_V15, md_type);
        ret = mbedtls_rsa_rsassa_pkcs1_v15_sign(rsa,
                                                mbedtls_ctr_drbg_random,
                                                &ctr_drbg,
                                                md_type,
                                                (unsigned int) hash_len,
                                                hash,
                                                sr->signature);
    }

cleanup:
    mbedtls_pk_free(&pk);
    mbedtls_ctr_drbg_free(&ctr_drbg);
    mbedtls_entropy_free(&entropy);
    sr->r = ret;
}

static void tjs__rsa_sign_after_work_cb(uv_work_t *req, int status) {
    TJSRsaSignReq *sr = req->data;
    CHECK_NOT_NULL(sr);

    JSContext *ctx = sr->ctx;
    JSValue args[2];

    if (status != 0 || sr->r != 0) {
        args[0] = JS_NewString(ctx, "RSA sign failed");
        args[1] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, sr->signature, sr->sig_len);
    }

    tjs_call_handler(ctx, sr->callback, 2, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, sr->callback);
    js_free(ctx, sr->privkey_der);
    js_free(ctx, sr->data);
    free(sr->signature);
    js_free(ctx, sr);
}

static JSValue tjs_webcrypto_rsa_sign(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 6) {
        return JS_ThrowTypeError(ctx,
                                 "expected 6 arguments: paddingMode, hashType, saltLength, privDER, data, callback");
    }

    int32_t padding_mode;
    if (JS_ToInt32(ctx, &padding_mode, argv[0])) {
        return JS_EXCEPTION;
    }

    int32_t hash_type;
    if (JS_ToInt32(ctx, &hash_type, argv[1])) {
        return JS_EXCEPTION;
    }

    if (hash_type < DIGEST_SHA1 || hash_type > DIGEST_SHA512) {
        return JS_ThrowRangeError(ctx, "invalid digest algorithm");
    }

    int32_t salt_length;
    if (JS_ToInt32(ctx, &salt_length, argv[2])) {
        return JS_EXCEPTION;
    }

    size_t privkey_der_len;
    const uint8_t *privkey_der = JS_GetUint8Array(ctx, &privkey_der_len, argv[3]);
    if (!privkey_der) {
        return JS_EXCEPTION;
    }

    size_t data_len;
    const uint8_t *data = JS_GetUint8Array(ctx, &data_len, argv[4]);
    if (!data && data_len != 0) {
        return JS_EXCEPTION;
    }

    if (!JS_IsFunction(ctx, argv[5])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSRsaSignReq *sr = js_malloc(ctx, sizeof(*sr));
    if (!sr) {
        return JS_EXCEPTION;
    }

    memset(sr, 0, sizeof(*sr));
    sr->ctx = ctx;
    sr->callback = JS_DupValue(ctx, argv[5]);
    sr->padding_mode = padding_mode;
    sr->hash_type = hash_type;
    sr->salt_length = salt_length;
    sr->r = -1;

    sr->privkey_der = js_malloc(ctx, privkey_der_len);
    if (!sr->privkey_der) {
        goto fail;
    }
    memcpy(sr->privkey_der, privkey_der, privkey_der_len);
    sr->privkey_der_len = privkey_der_len;

    if (data_len > 0) {
        sr->data = js_malloc(ctx, data_len);
        if (!sr->data) {
            goto fail;
        }
        memcpy(sr->data, data, data_len);
    }
    sr->data_len = data_len;

    sr->req.data = sr;

    int r = uv_queue_work(tjs_get_loop(ctx), &sr->req, tjs__rsa_sign_work_cb, tjs__rsa_sign_after_work_cb);
    if (r != 0) {
        goto fail;
    }

    return JS_UNDEFINED;

fail:
    JS_FreeValue(ctx, sr->callback);
    js_free(ctx, sr->privkey_der);
    js_free(ctx, sr->data);
    js_free(ctx, sr);
    return JS_EXCEPTION;
}

/* RSA verify (PSS + PKCS1v15). */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    int padding_mode;
    int hash_type;
    int salt_length;
    uint8_t *pubkey_der;
    size_t pubkey_der_len;
    uint8_t *signature;
    size_t sig_len;
    uint8_t *data;
    size_t data_len;
    int r;
} TJSRsaVerifyReq;

static void tjs__rsa_verify_work_cb(uv_work_t *req) {
    TJSRsaVerifyReq *vr = req->data;
    mbedtls_pk_context pk;
    uint8_t hash[64];

    mbedtls_pk_init(&pk);

    int ret = mbedtls_pk_parse_public_key(&pk, vr->pubkey_der, vr->pubkey_der_len);
    if (ret != 0) {
        goto cleanup;
    }

    /* Hash the data. */
    mbedtls_md_type_t md_type = digest_to_md_type[vr->hash_type];
    const mbedtls_md_info_t *md_info = mbedtls_md_info_from_type(md_type);
    if (!md_info) {
        ret = -1;
        goto cleanup;
    }

    size_t hash_len = mbedtls_md_get_size(md_info);
    ret = mbedtls_md(md_info, vr->data, vr->data_len, hash);
    if (ret != 0) {
        goto cleanup;
    }

    mbedtls_rsa_context *rsa = mbedtls_pk_rsa(pk);

    if (vr->padding_mode == RSA_PADDING_PSS) {
        mbedtls_rsa_set_padding(rsa, MBEDTLS_RSA_PKCS_V21, md_type);
        ret = mbedtls_rsa_rsassa_pss_verify_ext(rsa,
                                                md_type,
                                                (unsigned int) hash_len,
                                                hash,
                                                md_type,
                                                vr->salt_length,
                                                vr->signature);
    } else {
        mbedtls_rsa_set_padding(rsa, MBEDTLS_RSA_PKCS_V15, md_type);
        ret = mbedtls_rsa_rsassa_pkcs1_v15_verify(rsa, md_type, (unsigned int) hash_len, hash, vr->signature);
    }

cleanup:
    mbedtls_pk_free(&pk);
    vr->r = ret;
}

static void tjs__rsa_verify_after_work_cb(uv_work_t *req, int status) {
    TJSRsaVerifyReq *vr = req->data;
    CHECK_NOT_NULL(vr);

    JSContext *ctx = vr->ctx;
    JSValue args[2];

    if (status != 0) {
        args[0] = JS_NewString(ctx, "RSA verify failed");
        args[1] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewBool(ctx, vr->r == 0);
    }

    tjs_call_handler(ctx, vr->callback, 2, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, vr->callback);
    js_free(ctx, vr->pubkey_der);
    js_free(ctx, vr->signature);
    js_free(ctx, vr->data);
    js_free(ctx, vr);
}

static JSValue tjs_webcrypto_rsa_verify(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 7) {
        return JS_ThrowTypeError(ctx,
                                 "expected 7 arguments: paddingMode, hashType, saltLength, pubDER, signature, data, "
                                 "callback");
    }

    int32_t padding_mode;
    if (JS_ToInt32(ctx, &padding_mode, argv[0])) {
        return JS_EXCEPTION;
    }

    int32_t hash_type;
    if (JS_ToInt32(ctx, &hash_type, argv[1])) {
        return JS_EXCEPTION;
    }

    if (hash_type < DIGEST_SHA1 || hash_type > DIGEST_SHA512) {
        return JS_ThrowRangeError(ctx, "invalid digest algorithm");
    }

    int32_t salt_length;
    if (JS_ToInt32(ctx, &salt_length, argv[2])) {
        return JS_EXCEPTION;
    }

    size_t pubkey_der_len;
    const uint8_t *pubkey_der = JS_GetUint8Array(ctx, &pubkey_der_len, argv[3]);
    if (!pubkey_der) {
        return JS_EXCEPTION;
    }

    size_t sig_len;
    const uint8_t *signature = JS_GetUint8Array(ctx, &sig_len, argv[4]);
    if (!signature) {
        return JS_EXCEPTION;
    }

    size_t data_len;
    const uint8_t *data = JS_GetUint8Array(ctx, &data_len, argv[5]);
    if (!data && data_len != 0) {
        return JS_EXCEPTION;
    }

    if (!JS_IsFunction(ctx, argv[6])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSRsaVerifyReq *vr = js_malloc(ctx, sizeof(*vr));
    if (!vr) {
        return JS_EXCEPTION;
    }

    memset(vr, 0, sizeof(*vr));
    vr->ctx = ctx;
    vr->callback = JS_DupValue(ctx, argv[6]);
    vr->padding_mode = padding_mode;
    vr->hash_type = hash_type;
    vr->salt_length = salt_length;
    vr->r = -1;

    vr->pubkey_der = js_malloc(ctx, pubkey_der_len);
    if (!vr->pubkey_der) {
        goto fail;
    }
    memcpy(vr->pubkey_der, pubkey_der, pubkey_der_len);
    vr->pubkey_der_len = pubkey_der_len;

    vr->signature = js_malloc(ctx, sig_len);
    if (!vr->signature) {
        goto fail;
    }
    memcpy(vr->signature, signature, sig_len);
    vr->sig_len = sig_len;

    if (data_len > 0) {
        vr->data = js_malloc(ctx, data_len);
        if (!vr->data) {
            goto fail;
        }
        memcpy(vr->data, data, data_len);
    }
    vr->data_len = data_len;

    vr->req.data = vr;

    int r = uv_queue_work(tjs_get_loop(ctx), &vr->req, tjs__rsa_verify_work_cb, tjs__rsa_verify_after_work_cb);
    if (r != 0) {
        goto fail;
    }

    return JS_UNDEFINED;

fail:
    JS_FreeValue(ctx, vr->callback);
    js_free(ctx, vr->pubkey_der);
    js_free(ctx, vr->signature);
    js_free(ctx, vr->data);
    js_free(ctx, vr);
    return JS_EXCEPTION;
}

/* EC parse key (sync): parse DER-encoded SPKI/PKCS8, return raw bytes + curve ID. */

static JSValue tjs_webcrypto_ec_parse_key(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 2) {
        return JS_ThrowTypeError(ctx, "expected 2 arguments: derBuf, isPrivate");
    }

    size_t der_len;
    const uint8_t *der = JS_GetUint8Array(ctx, &der_len, argv[0]);
    if (!der) {
        return JS_EXCEPTION;
    }

    int is_private = JS_ToBool(ctx, argv[1]);

    mbedtls_pk_context pk;
    mbedtls_pk_init(&pk);

    int ret;
    if (is_private) {
        mbedtls_ctr_drbg_context ctr_drbg;
        mbedtls_entropy_context entropy;
        ret = tjs__setup_rng(&ctr_drbg, &entropy);
        if (ret == 0) {
            ret = mbedtls_pk_parse_key(&pk, der, der_len, NULL, 0, mbedtls_ctr_drbg_random, &ctr_drbg);
        }
        mbedtls_ctr_drbg_free(&ctr_drbg);
        mbedtls_entropy_free(&entropy);
    } else {
        ret = mbedtls_pk_parse_public_key(&pk, der, der_len);
    }

    if (ret != 0) {
        mbedtls_pk_free(&pk);
        return JS_ThrowTypeError(ctx, "failed to parse EC key");
    }

    mbedtls_pk_type_t pk_type = mbedtls_pk_get_type(&pk);
    if (pk_type != MBEDTLS_PK_ECKEY && pk_type != MBEDTLS_PK_ECKEY_DH && pk_type != MBEDTLS_PK_ECDSA) {
        mbedtls_pk_free(&pk);
        return JS_ThrowTypeError(ctx, "key is not EC");
    }

    mbedtls_ecp_keypair *ec = mbedtls_pk_ec(pk);
    mbedtls_ecp_group_id grp_id = ec->MBEDTLS_PRIVATE(grp).id;

    /* Map group ID back to our curve enum. */
    int curve = -1;
    for (int i = CURVE_P256; i <= CURVE_P521; i++) {
        if (curve_to_group_id[i] == grp_id) {
            curve = i;
            break;
        }
    }

    if (curve < 0) {
        mbedtls_pk_free(&pk);
        return JS_ThrowTypeError(ctx, "unsupported EC curve");
    }

    int key_size = curve_byte_sizes[curve];
    JSValue key_data;

    if (is_private) {
        uint8_t *buf = js_malloc(ctx, key_size);
        if (!buf) {
            mbedtls_pk_free(&pk);
            return JS_EXCEPTION;
        }
        ret = mbedtls_mpi_write_binary(&ec->MBEDTLS_PRIVATE(d), buf, key_size);
        if (ret != 0) {
            js_free(ctx, buf);
            mbedtls_pk_free(&pk);
            return JS_ThrowTypeError(ctx, "failed to extract EC private key");
        }
        key_data = JS_NewUint8ArrayCopy(ctx, buf, key_size);
        js_free(ctx, buf);
    } else {
        size_t pub_len = 1 + 2 * key_size;
        uint8_t *buf = js_malloc(ctx, pub_len);
        if (!buf) {
            mbedtls_pk_free(&pk);
            return JS_EXCEPTION;
        }
        size_t olen = 0;
        ret = mbedtls_ecp_point_write_binary(&ec->MBEDTLS_PRIVATE(grp),
                                             &ec->MBEDTLS_PRIVATE(Q),
                                             MBEDTLS_ECP_PF_UNCOMPRESSED,
                                             &olen,
                                             buf,
                                             pub_len);
        if (ret != 0) {
            js_free(ctx, buf);
            mbedtls_pk_free(&pk);
            return JS_ThrowTypeError(ctx, "failed to extract EC public key");
        }
        key_data = JS_NewUint8ArrayCopy(ctx, buf, olen);
        js_free(ctx, buf);
    }

    mbedtls_pk_free(&pk);

    JSValue result = JS_NewObject(ctx);
    JS_DefinePropertyValueStr(ctx, result, "curve", JS_NewInt32(ctx, curve), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, result, "keyData", key_data, JS_PROP_C_W_E);

    return result;
}

/* EC key to DER (sync): convert raw EC key bytes to DER (SPKI or PKCS8). */

static JSValue tjs_webcrypto_ec_key_to_der(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 3) {
        return JS_ThrowTypeError(ctx, "expected 3 arguments: rawKeyBuf, curveId, isPrivate");
    }

    size_t raw_len;
    const uint8_t *raw = JS_GetUint8Array(ctx, &raw_len, argv[0]);
    if (!raw) {
        return JS_EXCEPTION;
    }

    int32_t curve;
    if (JS_ToInt32(ctx, &curve, argv[1])) {
        return JS_EXCEPTION;
    }

    if (curve < CURVE_P256 || curve > CURVE_P521) {
        return JS_ThrowRangeError(ctx, "invalid curve");
    }

    int is_private = JS_ToBool(ctx, argv[2]);
    int key_size = curve_byte_sizes[curve];

    mbedtls_pk_context pk;
    mbedtls_pk_init(&pk);

    int ret = mbedtls_pk_setup(&pk, mbedtls_pk_info_from_type(MBEDTLS_PK_ECKEY));
    if (ret != 0) {
        mbedtls_pk_free(&pk);
        return JS_ThrowTypeError(ctx, "failed to setup EC key context");
    }

    mbedtls_ecp_keypair *ec = mbedtls_pk_ec(pk);
    ret = mbedtls_ecp_group_load(&ec->MBEDTLS_PRIVATE(grp), curve_to_group_id[curve]);
    if (ret != 0) {
        mbedtls_pk_free(&pk);
        return JS_ThrowTypeError(ctx, "failed to load EC group");
    }

    if (is_private) {
        /* Load private scalar d. */
        ret = mbedtls_mpi_read_binary(&ec->MBEDTLS_PRIVATE(d), raw, raw_len);
        if (ret != 0) {
            mbedtls_pk_free(&pk);
            return JS_ThrowTypeError(ctx, "failed to read EC private key");
        }

        /* Compute Q = d * G. */
        mbedtls_ctr_drbg_context ctr_drbg;
        mbedtls_entropy_context entropy;
        ret = tjs__setup_rng(&ctr_drbg, &entropy);
        if (ret == 0) {
            ret = mbedtls_ecp_mul(&ec->MBEDTLS_PRIVATE(grp),
                                  &ec->MBEDTLS_PRIVATE(Q),
                                  &ec->MBEDTLS_PRIVATE(d),
                                  &ec->MBEDTLS_PRIVATE(grp).G,
                                  mbedtls_ctr_drbg_random,
                                  &ctr_drbg);
        }
        mbedtls_ctr_drbg_free(&ctr_drbg);
        mbedtls_entropy_free(&entropy);

        if (ret != 0) {
            mbedtls_pk_free(&pk);
            return JS_ThrowTypeError(ctx, "failed to compute EC public key");
        }
    } else {
        /* Load public point Q. */
        ret = mbedtls_ecp_point_read_binary(&ec->MBEDTLS_PRIVATE(grp), &ec->MBEDTLS_PRIVATE(Q), raw, raw_len);
        if (ret != 0) {
            mbedtls_pk_free(&pk);
            return JS_ThrowTypeError(ctx, "failed to read EC public key");
        }
    }

    size_t buf_size = 256 + 2 * key_size;
    uint8_t *buf = js_malloc(ctx, buf_size);
    if (!buf) {
        mbedtls_pk_free(&pk);
        return JS_EXCEPTION;
    }

    int len;
    if (is_private) {
        len = mbedtls_pk_write_key_der(&pk, buf, buf_size);
    } else {
        len = mbedtls_pk_write_pubkey_der(&pk, buf, buf_size);
    }

    mbedtls_pk_free(&pk);

    if (len < 0) {
        js_free(ctx, buf);
        return JS_ThrowTypeError(ctx, "failed to write EC key DER");
    }

    /* mbedtls writes from end of buffer. */
    JSValue result = JS_NewUint8ArrayCopy(ctx, buf + buf_size - len, len);
    js_free(ctx, buf);

    return result;
}

/* RSA parse key (sync). */

static JSValue tjs_webcrypto_rsa_parse_key(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 2) {
        return JS_ThrowTypeError(ctx, "expected 2 arguments: derBuf, isPrivate");
    }

    size_t der_len;
    const uint8_t *der = JS_GetUint8Array(ctx, &der_len, argv[0]);
    if (!der) {
        return JS_EXCEPTION;
    }

    int is_private = JS_ToBool(ctx, argv[1]);

    mbedtls_pk_context pk;
    mbedtls_pk_init(&pk);

    int ret;
    if (is_private) {
        mbedtls_ctr_drbg_context ctr_drbg;
        mbedtls_entropy_context entropy;
        ret = tjs__setup_rng(&ctr_drbg, &entropy);
        if (ret == 0) {
            ret = mbedtls_pk_parse_key(&pk, der, der_len, NULL, 0, mbedtls_ctr_drbg_random, &ctr_drbg);
        }
        mbedtls_ctr_drbg_free(&ctr_drbg);
        mbedtls_entropy_free(&entropy);
    } else {
        ret = mbedtls_pk_parse_public_key(&pk, der, der_len);
    }

    if (ret != 0) {
        mbedtls_pk_free(&pk);
        return JS_ThrowTypeError(ctx, "failed to parse RSA key");
    }

    if (mbedtls_pk_get_type(&pk) != MBEDTLS_PK_RSA) {
        mbedtls_pk_free(&pk);
        return JS_ThrowTypeError(ctx, "key is not RSA");
    }

    unsigned int modulus_length = (unsigned int) mbedtls_pk_get_bitlen(&pk);

    /* Extract public exponent E. */
    mbedtls_rsa_context *rsa = mbedtls_pk_rsa(pk);
    mbedtls_mpi E;
    mbedtls_mpi_init(&E);
    ret = mbedtls_rsa_export(rsa, NULL, NULL, NULL, NULL, &E);
    if (ret != 0) {
        mbedtls_mpi_free(&E);
        mbedtls_pk_free(&pk);
        return JS_ThrowTypeError(ctx, "failed to export RSA public exponent");
    }

    size_t e_len = mbedtls_mpi_size(&E);
    uint8_t e_buf[8]; /* Public exponent is typically 3 bytes (65537). */
    if (e_len > sizeof(e_buf)) {
        mbedtls_mpi_free(&E);
        mbedtls_pk_free(&pk);
        return JS_ThrowTypeError(ctx, "public exponent too large");
    }
    ret = mbedtls_mpi_write_binary(&E, e_buf, e_len);
    mbedtls_mpi_free(&E);
    mbedtls_pk_free(&pk);

    if (ret != 0) {
        return JS_ThrowTypeError(ctx, "failed to write public exponent");
    }

    JSValue result = JS_NewObject(ctx);
    JS_DefinePropertyValueStr(ctx, result, "modulusLength", JS_NewUint32(ctx, modulus_length), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, result, "publicExponent", JS_NewUint8ArrayCopy(ctx, e_buf, e_len), JS_PROP_C_W_E);

    return result;
}

/* Helper: convert mbedtls MPI to JS Uint8Array. */
static JSValue tjs__mpi_to_js(JSContext *ctx, const mbedtls_mpi *mpi) {
    size_t len = mbedtls_mpi_size(mpi);
    uint8_t *buf = js_malloc(ctx, len);
    if (!buf) {
        return JS_EXCEPTION;
    }
    int ret = mbedtls_mpi_write_binary(mpi, buf, len);
    if (ret != 0) {
        js_free(ctx, buf);
        return JS_EXCEPTION;
    }
    JSValue val = JS_NewUint8ArrayCopy(ctx, buf, len);
    js_free(ctx, buf);
    return val;
}

/* RSA export JWK (sync): parse DER, extract RSA components as Uint8Arrays. */

static JSValue tjs_webcrypto_rsa_export_jwk(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 2) {
        return JS_ThrowTypeError(ctx, "expected 2 arguments: derBuf, isPrivate");
    }

    size_t der_len;
    const uint8_t *der = JS_GetUint8Array(ctx, &der_len, argv[0]);
    if (!der) {
        return JS_EXCEPTION;
    }

    int is_private = JS_ToBool(ctx, argv[1]);

    mbedtls_pk_context pk;
    mbedtls_pk_init(&pk);

    int ret;
    if (is_private) {
        mbedtls_ctr_drbg_context ctr_drbg;
        mbedtls_entropy_context entropy;
        ret = tjs__setup_rng(&ctr_drbg, &entropy);
        if (ret == 0) {
            ret = mbedtls_pk_parse_key(&pk, der, der_len, NULL, 0, mbedtls_ctr_drbg_random, &ctr_drbg);
        }
        mbedtls_ctr_drbg_free(&ctr_drbg);
        mbedtls_entropy_free(&entropy);
    } else {
        ret = mbedtls_pk_parse_public_key(&pk, der, der_len);
    }

    if (ret != 0) {
        mbedtls_pk_free(&pk);
        return JS_ThrowTypeError(ctx, "failed to parse RSA key");
    }

    if (mbedtls_pk_get_type(&pk) != MBEDTLS_PK_RSA) {
        mbedtls_pk_free(&pk);
        return JS_ThrowTypeError(ctx, "key is not RSA");
    }

    mbedtls_rsa_context *rsa = mbedtls_pk_rsa(pk);
    mbedtls_mpi N, E;
    mbedtls_mpi_init(&N);
    mbedtls_mpi_init(&E);

    ret = mbedtls_rsa_export(rsa, &N, NULL, NULL, NULL, &E);
    if (ret != 0) {
        mbedtls_mpi_free(&N);
        mbedtls_mpi_free(&E);
        mbedtls_pk_free(&pk);
        return JS_ThrowTypeError(ctx, "failed to export RSA N/E");
    }

    JSValue result = JS_NewObject(ctx);
    JS_DefinePropertyValueStr(ctx, result, "n", tjs__mpi_to_js(ctx, &N), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, result, "e", tjs__mpi_to_js(ctx, &E), JS_PROP_C_W_E);

    mbedtls_mpi_free(&N);
    mbedtls_mpi_free(&E);

    if (is_private) {
        mbedtls_mpi P, Q, D, DP, DQ, QP;
        mbedtls_mpi_init(&P);
        mbedtls_mpi_init(&Q);
        mbedtls_mpi_init(&D);
        mbedtls_mpi_init(&DP);
        mbedtls_mpi_init(&DQ);
        mbedtls_mpi_init(&QP);

        ret = mbedtls_rsa_export(rsa, NULL, &P, &Q, &D, NULL);
        if (ret == 0) {
            ret = mbedtls_rsa_export_crt(rsa, &DP, &DQ, &QP);
        }

        if (ret != 0) {
            mbedtls_mpi_free(&P);
            mbedtls_mpi_free(&Q);
            mbedtls_mpi_free(&D);
            mbedtls_mpi_free(&DP);
            mbedtls_mpi_free(&DQ);
            mbedtls_mpi_free(&QP);
            mbedtls_pk_free(&pk);
            JS_FreeValue(ctx, result);
            return JS_ThrowTypeError(ctx, "failed to export RSA private components");
        }

        JS_DefinePropertyValueStr(ctx, result, "d", tjs__mpi_to_js(ctx, &D), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, result, "p", tjs__mpi_to_js(ctx, &P), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, result, "q", tjs__mpi_to_js(ctx, &Q), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, result, "dp", tjs__mpi_to_js(ctx, &DP), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, result, "dq", tjs__mpi_to_js(ctx, &DQ), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, result, "qi", tjs__mpi_to_js(ctx, &QP), JS_PROP_C_W_E);

        mbedtls_mpi_free(&P);
        mbedtls_mpi_free(&Q);
        mbedtls_mpi_free(&D);
        mbedtls_mpi_free(&DP);
        mbedtls_mpi_free(&DQ);
        mbedtls_mpi_free(&QP);
    }

    mbedtls_pk_free(&pk);
    return result;
}

/* RSA import JWK (sync): reconstruct DER from JWK component Uint8Arrays. */

static JSValue tjs_webcrypto_rsa_import_jwk(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 2) {
        return JS_ThrowTypeError(ctx, "expected at least 2 arguments: n, e, [d, p, q, dp, dq, qi]");
    }

    size_t n_len, e_len;
    const uint8_t *n = JS_GetUint8Array(ctx, &n_len, argv[0]);
    if (!n) {
        return JS_EXCEPTION;
    }
    const uint8_t *e = JS_GetUint8Array(ctx, &e_len, argv[1]);
    if (!e) {
        return JS_EXCEPTION;
    }

    int is_private = argc >= 3 && !JS_IsUndefined(argv[2]);

    mbedtls_pk_context pk;
    mbedtls_pk_init(&pk);

    int ret = mbedtls_pk_setup(&pk, mbedtls_pk_info_from_type(MBEDTLS_PK_RSA));
    if (ret != 0) {
        mbedtls_pk_free(&pk);
        return JS_ThrowTypeError(ctx, "failed to setup RSA context");
    }

    mbedtls_rsa_context *rsa = mbedtls_pk_rsa(pk);

    if (is_private) {
        size_t d_len, p_len = 0, q_len = 0;
        const uint8_t *d = JS_GetUint8Array(ctx, &d_len, argv[2]);
        if (!d) {
            mbedtls_pk_free(&pk);
            return JS_EXCEPTION;
        }

        const uint8_t *p = NULL;
        const uint8_t *q = NULL;
        if (argc >= 5 && !JS_IsUndefined(argv[3]) && !JS_IsUndefined(argv[4])) {
            p = JS_GetUint8Array(ctx, &p_len, argv[3]);
            if (!p) {
                mbedtls_pk_free(&pk);
                return JS_EXCEPTION;
            }
            q = JS_GetUint8Array(ctx, &q_len, argv[4]);
            if (!q) {
                mbedtls_pk_free(&pk);
                return JS_EXCEPTION;
            }
        }

        ret = mbedtls_rsa_import_raw(rsa, n, n_len, p, p_len, q, q_len, d, d_len, e, e_len);
    } else {
        ret = mbedtls_rsa_import_raw(rsa, n, n_len, NULL, 0, NULL, 0, NULL, 0, e, e_len);
    }

    if (ret != 0) {
        mbedtls_pk_free(&pk);
        return JS_ThrowTypeError(ctx, "failed to import RSA key components");
    }

    ret = mbedtls_rsa_complete(rsa);
    if (ret != 0) {
        mbedtls_pk_free(&pk);
        return JS_ThrowTypeError(ctx, "failed to complete RSA key");
    }

    size_t buf_size = is_private ? (4 * n_len + 512) : (n_len + 256);
    uint8_t *buf = js_malloc(ctx, buf_size);
    if (!buf) {
        mbedtls_pk_free(&pk);
        return JS_EXCEPTION;
    }

    int len;
    if (is_private) {
        len = mbedtls_pk_write_key_der(&pk, buf, buf_size);
    } else {
        len = mbedtls_pk_write_pubkey_der(&pk, buf, buf_size);
    }

    mbedtls_pk_free(&pk);

    if (len < 0) {
        js_free(ctx, buf);
        return JS_ThrowTypeError(ctx, "failed to write RSA key DER");
    }

    /* mbedtls writes from end of buffer. */
    JSValue result = JS_NewUint8ArrayCopy(ctx, buf + buf_size - len, len);
    js_free(ctx, buf);

    return result;
}

/* EC get public key (sync): compute uncompressed public point from private scalar. */

static JSValue tjs_webcrypto_ec_get_public_key(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 2) {
        return JS_ThrowTypeError(ctx, "expected 2 arguments: privKeyBuf, curveId");
    }

    size_t priv_len;
    const uint8_t *priv = JS_GetUint8Array(ctx, &priv_len, argv[0]);
    if (!priv) {
        return JS_EXCEPTION;
    }

    int32_t curve;
    if (JS_ToInt32(ctx, &curve, argv[1])) {
        return JS_EXCEPTION;
    }

    if (curve < CURVE_P256 || curve > CURVE_P521) {
        return JS_ThrowRangeError(ctx, "invalid curve");
    }

    int key_size = curve_byte_sizes[curve];
    mbedtls_ecp_group grp;
    mbedtls_mpi d;
    mbedtls_ecp_point Q;

    mbedtls_ecp_group_init(&grp);
    mbedtls_mpi_init(&d);
    mbedtls_ecp_point_init(&Q);

    int ret = mbedtls_ecp_group_load(&grp, curve_to_group_id[curve]);
    if (ret != 0) {
        goto ec_pub_fail;
    }

    ret = mbedtls_mpi_read_binary(&d, priv, priv_len);
    if (ret != 0) {
        goto ec_pub_fail;
    }

    {
        mbedtls_ctr_drbg_context ctr_drbg;
        mbedtls_entropy_context entropy;
        ret = tjs__setup_rng(&ctr_drbg, &entropy);
        if (ret == 0) {
            ret = mbedtls_ecp_mul(&grp, &Q, &d, &grp.G, mbedtls_ctr_drbg_random, &ctr_drbg);
        }
        mbedtls_ctr_drbg_free(&ctr_drbg);
        mbedtls_entropy_free(&entropy);
    }

    if (ret != 0) {
        goto ec_pub_fail;
    }

    {
        size_t pub_len = 1 + 2 * key_size;
        uint8_t *buf = js_malloc(ctx, pub_len);
        if (!buf) {
            mbedtls_ecp_point_free(&Q);
            mbedtls_mpi_free(&d);
            mbedtls_ecp_group_free(&grp);
            return JS_EXCEPTION;
        }

        size_t olen = 0;
        ret = mbedtls_ecp_point_write_binary(&grp, &Q, MBEDTLS_ECP_PF_UNCOMPRESSED, &olen, buf, pub_len);

        mbedtls_ecp_point_free(&Q);
        mbedtls_mpi_free(&d);
        mbedtls_ecp_group_free(&grp);

        if (ret != 0) {
            js_free(ctx, buf);
            return JS_ThrowTypeError(ctx, "failed to write EC public key");
        }

        JSValue result = JS_NewUint8ArrayCopy(ctx, buf, olen);
        js_free(ctx, buf);
        return result;
    }

ec_pub_fail:
    mbedtls_ecp_point_free(&Q);
    mbedtls_mpi_free(&d);
    mbedtls_ecp_group_free(&grp);
    return JS_ThrowTypeError(ctx, "failed to compute EC public key from private key");
}

/* clang-format off */
static const JSCFunctionListEntry tjs_rsa_consts[] = {
    TJS_CONST(RSA_PADDING_PSS),
    TJS_CONST(RSA_PADDING_PKCS1V15),
};
/* clang-format on */

/* clang-format off */
static const JSCFunctionListEntry tjs_cipher_consts[] = {
    TJS_CONST(CIPHER_AES_CBC),
    TJS_CONST(CIPHER_AES_GCM),
    TJS_CONST(CIPHER_AES_CTR),
    TJS_CONST(CIPHER_OP_ENCRYPT),
    TJS_CONST(CIPHER_OP_DECRYPT),
};
/* clang-format on */

enum {
    AES_KW_OP_WRAP = 0,
    AES_KW_OP_UNWRAP,
};

/* clang-format off */
static const JSCFunctionListEntry tjs_aes_kw_consts[] = {
    TJS_CONST(AES_KW_OP_WRAP),
    TJS_CONST(AES_KW_OP_UNWRAP),
};
/* clang-format on */

/* clang-format off */
static const JSCFunctionListEntry tjs_webcrypto_consts[] = {
    TJS_CONST(DIGEST_SHA1),
    TJS_CONST(DIGEST_SHA256),
    TJS_CONST(DIGEST_SHA384),
    TJS_CONST(DIGEST_SHA512),
};
/* clang-format on */

/* clang-format off */
static const JSCFunctionListEntry tjs_ec_consts[] = {
    TJS_CONST(CURVE_P256),
    TJS_CONST(CURVE_P384),
    TJS_CONST(CURVE_P521),
};
/* clang-format on */

/* Ed25519 key generation (async). */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    uint8_t seed[32];
    uint8_t privkey[32];
    uint8_t pubkey[32];
    int r;
} TJSEd25519GenerateKeyReq;

static void tjs__ed25519_generate_key_work_cb(uv_work_t *req) {
    TJSEd25519GenerateKeyReq *er = req->data;
    uint8_t sk[64];

    crypto_sign_ed25519_seed_keypair(er->pubkey, sk, er->seed);
    memcpy(er->privkey, er->seed, 32);
    er->r = 0;
}

static void tjs__ed25519_generate_key_after_work_cb(uv_work_t *req, int status) {
    TJSEd25519GenerateKeyReq *er = req->data;
    CHECK_NOT_NULL(er);

    JSContext *ctx = er->ctx;
    JSValue args[3];

    if (status != 0 || er->r != 0) {
        args[0] = JS_NewString(ctx, "Ed25519 key generation failed");
        args[1] = JS_UNDEFINED;
        args[2] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, er->privkey, 32);
        args[2] = JS_NewUint8ArrayCopy(ctx, er->pubkey, 32);
    }

    tjs_call_handler(ctx, er->callback, 3, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, args[2]);
    JS_FreeValue(ctx, er->callback);
    js_free(ctx, er);
}

static JSValue tjs_webcrypto_ed25519_generate_key(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 1) {
        return JS_ThrowTypeError(ctx, "expected 1 argument: callback");
    }

    if (!JS_IsFunction(ctx, argv[0])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSEd25519GenerateKeyReq *er = js_malloc(ctx, sizeof(*er));
    if (!er) {
        return JS_EXCEPTION;
    }

    memset(er, 0, sizeof(*er));
    er->ctx = ctx;
    er->callback = JS_DupValue(ctx, argv[0]);
    er->r = -1;

    /* Generate random seed. */
    mbedtls_ctr_drbg_context ctr_drbg;
    mbedtls_entropy_context entropy;
    int ret = tjs__setup_rng(&ctr_drbg, &entropy);
    if (ret != 0) {
        JS_FreeValue(ctx, er->callback);
        js_free(ctx, er);
        return JS_ThrowInternalError(ctx, "RNG setup failed");
    }
    ret = mbedtls_ctr_drbg_random(&ctr_drbg, er->seed, 32);
    mbedtls_ctr_drbg_free(&ctr_drbg);
    mbedtls_entropy_free(&entropy);
    if (ret != 0) {
        JS_FreeValue(ctx, er->callback);
        js_free(ctx, er);
        return JS_ThrowInternalError(ctx, "random generation failed");
    }

    er->req.data = er;

    int r = uv_queue_work(tjs_get_loop(ctx),
                          &er->req,
                          tjs__ed25519_generate_key_work_cb,
                          tjs__ed25519_generate_key_after_work_cb);
    if (r != 0) {
        JS_FreeValue(ctx, er->callback);
        js_free(ctx, er);
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

/* Ed25519 sign (async). */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    uint8_t *privkey;
    uint8_t *message;
    size_t message_len;
    uint8_t signature[64];
    int r;
} TJSEd25519SignReq;

static void tjs__ed25519_sign_work_cb(uv_work_t *req) {
    TJSEd25519SignReq *sr = req->data;
    uint8_t pk[32], sk[64];
    unsigned long long smlen;

    /* Build the 64-byte secret key: seed || public_key. */
    crypto_sign_ed25519_seed_keypair(pk, sk, sr->privkey);

    /* crypto_sign produces combined sig || msg; extract the 64-byte signature. */
    unsigned char *sm = malloc(64 + sr->message_len);
    crypto_sign_ed25519(sm, &smlen, sr->message, sr->message_len, sk);
    memcpy(sr->signature, sm, 64);
    free(sm);
    sr->r = 0;
}

static void tjs__ed25519_sign_after_work_cb(uv_work_t *req, int status) {
    TJSEd25519SignReq *sr = req->data;
    CHECK_NOT_NULL(sr);

    JSContext *ctx = sr->ctx;
    JSValue args[2];

    if (status != 0 || sr->r != 0) {
        args[0] = JS_NewString(ctx, "Ed25519 sign failed");
        args[1] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, sr->signature, 64);
    }

    tjs_call_handler(ctx, sr->callback, 2, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, sr->callback);
    js_free(ctx, sr->privkey);
    js_free(ctx, sr->message);
    js_free(ctx, sr);
}

static JSValue tjs_webcrypto_ed25519_sign(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 3) {
        return JS_ThrowTypeError(ctx, "expected 3 arguments: privkey, message, callback");
    }

    size_t privkey_len;
    const uint8_t *privkey = JS_GetUint8Array(ctx, &privkey_len, argv[0]);
    if (!privkey || privkey_len != 32) {
        return JS_ThrowTypeError(ctx, "privkey must be 32 bytes");
    }

    size_t message_len;
    const uint8_t *message = JS_GetUint8Array(ctx, &message_len, argv[1]);
    if (!message && message_len != 0) {
        return JS_EXCEPTION;
    }

    if (!JS_IsFunction(ctx, argv[2])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSEd25519SignReq *sr = js_malloc(ctx, sizeof(*sr));
    if (!sr) {
        return JS_EXCEPTION;
    }

    memset(sr, 0, sizeof(*sr));
    sr->ctx = ctx;
    sr->callback = JS_DupValue(ctx, argv[2]);
    sr->r = -1;

    sr->privkey = js_malloc(ctx, 32);
    if (!sr->privkey) {
        goto fail;
    }
    memcpy(sr->privkey, privkey, 32);

    if (message_len > 0) {
        sr->message = js_malloc(ctx, message_len);
        if (!sr->message) {
            goto fail;
        }
        memcpy(sr->message, message, message_len);
    }
    sr->message_len = message_len;

    sr->req.data = sr;

    int r = uv_queue_work(tjs_get_loop(ctx), &sr->req, tjs__ed25519_sign_work_cb, tjs__ed25519_sign_after_work_cb);
    if (r != 0) {
        goto fail;
    }

    return JS_UNDEFINED;

fail:
    JS_FreeValue(ctx, sr->callback);
    js_free(ctx, sr->privkey);
    js_free(ctx, sr->message);
    js_free(ctx, sr);
    return JS_EXCEPTION;
}

/* Ed25519 verify (async). */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    uint8_t *pubkey;
    uint8_t *signature;
    uint8_t *message;
    size_t message_len;
    int r;
} TJSEd25519VerifyReq;

static void tjs__ed25519_verify_work_cb(uv_work_t *req) {
    TJSEd25519VerifyReq *vr = req->data;
    unsigned long long tmplen;
    size_t combined_len = 64 + vr->message_len;

    /* Build combined sig || msg for crypto_sign_open. */
    unsigned char *sm = malloc(combined_len);
    unsigned char *tmp = malloc(combined_len);
    memcpy(sm, vr->signature, 64);
    memcpy(sm + 64, vr->message, vr->message_len);

    /* r == 0 means valid, -1 means invalid. */
    vr->r = crypto_sign_ed25519_open(tmp, &tmplen, sm, combined_len, vr->pubkey);
    free(sm);
    free(tmp);
}

static void tjs__ed25519_verify_after_work_cb(uv_work_t *req, int status) {
    TJSEd25519VerifyReq *vr = req->data;
    CHECK_NOT_NULL(vr);

    JSContext *ctx = vr->ctx;
    JSValue args[2];

    if (status != 0) {
        args[0] = JS_NewString(ctx, "Ed25519 verify failed");
        args[1] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewBool(ctx, vr->r == 0);
    }

    tjs_call_handler(ctx, vr->callback, 2, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, vr->callback);
    js_free(ctx, vr->pubkey);
    js_free(ctx, vr->signature);
    js_free(ctx, vr->message);
    js_free(ctx, vr);
}

static JSValue tjs_webcrypto_ed25519_verify(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 4) {
        return JS_ThrowTypeError(ctx, "expected 4 arguments: pubkey, signature, message, callback");
    }

    size_t pubkey_len;
    const uint8_t *pubkey = JS_GetUint8Array(ctx, &pubkey_len, argv[0]);
    if (!pubkey || pubkey_len != 32) {
        return JS_ThrowTypeError(ctx, "pubkey must be 32 bytes");
    }

    size_t sig_len;
    const uint8_t *signature = JS_GetUint8Array(ctx, &sig_len, argv[1]);
    if (!signature || sig_len != 64) {
        return JS_ThrowTypeError(ctx, "signature must be 64 bytes");
    }

    size_t message_len;
    const uint8_t *message = JS_GetUint8Array(ctx, &message_len, argv[2]);
    if (!message && message_len != 0) {
        return JS_EXCEPTION;
    }

    if (!JS_IsFunction(ctx, argv[3])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSEd25519VerifyReq *vr = js_malloc(ctx, sizeof(*vr));
    if (!vr) {
        return JS_EXCEPTION;
    }

    memset(vr, 0, sizeof(*vr));
    vr->ctx = ctx;
    vr->callback = JS_DupValue(ctx, argv[3]);
    vr->r = -1;

    vr->pubkey = js_malloc(ctx, 32);
    if (!vr->pubkey) {
        goto fail;
    }
    memcpy(vr->pubkey, pubkey, 32);

    vr->signature = js_malloc(ctx, 64);
    if (!vr->signature) {
        goto fail;
    }
    memcpy(vr->signature, signature, 64);

    if (message_len > 0) {
        vr->message = js_malloc(ctx, message_len);
        if (!vr->message) {
            goto fail;
        }
        memcpy(vr->message, message, message_len);
    }
    vr->message_len = message_len;

    vr->req.data = vr;

    int r = uv_queue_work(tjs_get_loop(ctx), &vr->req, tjs__ed25519_verify_work_cb, tjs__ed25519_verify_after_work_cb);
    if (r != 0) {
        goto fail;
    }

    return JS_UNDEFINED;

fail:
    JS_FreeValue(ctx, vr->callback);
    js_free(ctx, vr->pubkey);
    js_free(ctx, vr->signature);
    js_free(ctx, vr->message);
    js_free(ctx, vr);
    return JS_EXCEPTION;
}

/* Ed25519 get public key from private key (sync). */

static JSValue tjs_webcrypto_ed25519_get_public_key(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 1) {
        return JS_ThrowTypeError(ctx, "expected 1 argument: privkey");
    }

    size_t privkey_len;
    const uint8_t *privkey = JS_GetUint8Array(ctx, &privkey_len, argv[0]);
    if (!privkey || privkey_len != 32) {
        return JS_ThrowTypeError(ctx, "privkey must be 32 bytes");
    }

    uint8_t pubkey[32], sk_tmp[64];
    crypto_sign_ed25519_seed_keypair(pubkey, sk_tmp, privkey);

    return JS_NewUint8ArrayCopy(ctx, pubkey, 32);
}

/* X25519 key generation. */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    uint8_t privkey[32];
    uint8_t pubkey[32];
    int r;
} TJSX25519GenerateKeyReq;

static void tjs__x25519_generate_key_work_cb(uv_work_t *req) {
    TJSX25519GenerateKeyReq *xr = req->data;
    mbedtls_ctr_drbg_context ctr_drbg;
    mbedtls_entropy_context entropy;

    int ret = tjs__setup_rng(&ctr_drbg, &entropy);
    if (ret != 0) {
        xr->r = ret;
        mbedtls_ctr_drbg_free(&ctr_drbg);
        mbedtls_entropy_free(&entropy);
        return;
    }

    ret = mbedtls_ctr_drbg_random(&ctr_drbg, xr->privkey, 32);
    mbedtls_ctr_drbg_free(&ctr_drbg);
    mbedtls_entropy_free(&entropy);

    if (ret != 0) {
        xr->r = ret;
        return;
    }

    crypto_scalarmult_curve25519_base(xr->pubkey, xr->privkey);
    xr->r = 0;
}

static void tjs__x25519_generate_key_after_work_cb(uv_work_t *req, int status) {
    TJSX25519GenerateKeyReq *xr = req->data;
    CHECK_NOT_NULL(xr);

    JSContext *ctx = xr->ctx;
    JSValue args[3];

    if (status != 0 || xr->r != 0) {
        args[0] = JS_NewString(ctx, "X25519 key generation failed");
        args[1] = JS_UNDEFINED;
        args[2] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, xr->privkey, 32);
        args[2] = JS_NewUint8ArrayCopy(ctx, xr->pubkey, 32);
    }

    tjs_call_handler(ctx, xr->callback, 3, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, args[2]);
    JS_FreeValue(ctx, xr->callback);
    js_free(ctx, xr);
}

static JSValue tjs_webcrypto_x25519_generate_key(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 1 || !JS_IsFunction(ctx, argv[0])) {
        return JS_ThrowTypeError(ctx, "expected 1 argument: callback");
    }

    TJSX25519GenerateKeyReq *xr = js_malloc(ctx, sizeof(*xr));
    if (!xr) {
        return JS_EXCEPTION;
    }

    memset(xr, 0, sizeof(*xr));
    xr->ctx = ctx;
    xr->callback = JS_DupValue(ctx, argv[0]);
    xr->r = -1;
    xr->req.data = xr;

    int r = uv_queue_work(tjs_get_loop(ctx),
                          &xr->req,
                          tjs__x25519_generate_key_work_cb,
                          tjs__x25519_generate_key_after_work_cb);
    if (r != 0) {
        JS_FreeValue(ctx, xr->callback);
        js_free(ctx, xr);
        return JS_EXCEPTION;
    }

    return JS_UNDEFINED;
}

/* X25519 deriveBits. */

typedef struct {
    uv_work_t req;
    JSContext *ctx;
    JSValue callback;
    uint8_t privkey[32];
    uint8_t pubkey[32];
    uint8_t shared[32];
    int r;
} TJSX25519DeriveBitsReq;

static void tjs__x25519_derive_bits_work_cb(uv_work_t *req) {
    TJSX25519DeriveBitsReq *dr = req->data;

    dr->r = crypto_scalarmult_curve25519(dr->shared, dr->privkey, dr->pubkey);
}

static void tjs__x25519_derive_bits_after_work_cb(uv_work_t *req, int status) {
    TJSX25519DeriveBitsReq *dr = req->data;
    CHECK_NOT_NULL(dr);

    JSContext *ctx = dr->ctx;
    JSValue args[2];

    if (status != 0 || dr->r != 0) {
        args[0] = JS_NewString(ctx, "X25519 deriveBits failed");
        args[1] = JS_UNDEFINED;
    } else {
        args[0] = JS_UNDEFINED;
        args[1] = JS_NewUint8ArrayCopy(ctx, dr->shared, 32);
    }

    tjs_call_handler(ctx, dr->callback, 2, args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
    JS_FreeValue(ctx, dr->callback);
    js_free(ctx, dr);
}

static JSValue tjs_webcrypto_x25519_derive_bits(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 3) {
        return JS_ThrowTypeError(ctx, "expected 3 arguments: privKey, pubKey, callback");
    }

    size_t privkey_len;
    const uint8_t *privkey = JS_GetUint8Array(ctx, &privkey_len, argv[0]);
    if (!privkey || privkey_len != 32) {
        return JS_ThrowTypeError(ctx, "privkey must be 32 bytes");
    }

    size_t pubkey_len;
    const uint8_t *pubkey = JS_GetUint8Array(ctx, &pubkey_len, argv[1]);
    if (!pubkey || pubkey_len != 32) {
        return JS_ThrowTypeError(ctx, "pubkey must be 32 bytes");
    }

    if (!JS_IsFunction(ctx, argv[2])) {
        return JS_ThrowTypeError(ctx, "expected callback function");
    }

    TJSX25519DeriveBitsReq *dr = js_malloc(ctx, sizeof(*dr));
    if (!dr) {
        return JS_EXCEPTION;
    }

    memset(dr, 0, sizeof(*dr));
    dr->ctx = ctx;
    dr->callback = JS_DupValue(ctx, argv[2]);
    dr->r = -1;
    memcpy(dr->privkey, privkey, 32);
    memcpy(dr->pubkey, pubkey, 32);
    dr->req.data = dr;

    int r = uv_queue_work(tjs_get_loop(ctx),
                          &dr->req,
                          tjs__x25519_derive_bits_work_cb,
                          tjs__x25519_derive_bits_after_work_cb);
    if (r != 0) {
        JS_FreeValue(ctx, dr->callback);
        js_free(ctx, dr);
        return JS_EXCEPTION;
    }

    return JS_UNDEFINED;
}

/* AES-KW wrap/unwrap (sync). */

static JSValue tjs_webcrypto_aes_kw(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 3) {
        return JS_ThrowTypeError(ctx, "expected 3 arguments: operation, key, data");
    }

    int32_t operation;
    if (JS_ToInt32(ctx, &operation, argv[0])) {
        return JS_EXCEPTION;
    }

    size_t key_len;
    const uint8_t *key = JS_GetUint8Array(ctx, &key_len, argv[1]);
    if (!key) {
        return JS_EXCEPTION;
    }

    if (key_len != 16 && key_len != 24 && key_len != 32) {
        return JS_ThrowTypeError(ctx, "invalid AES key length");
    }

    size_t data_len;
    const uint8_t *data = JS_GetUint8Array(ctx, &data_len, argv[2]);
    if (!data) {
        return JS_EXCEPTION;
    }

    mbedtls_nist_kw_context kw_ctx;
    mbedtls_nist_kw_init(&kw_ctx);

    int is_wrap = (operation == AES_KW_OP_WRAP);
    int ret = mbedtls_nist_kw_setkey(&kw_ctx, MBEDTLS_CIPHER_ID_AES, key, (unsigned int) (key_len * 8), is_wrap);
    if (ret != 0) {
        mbedtls_nist_kw_free(&kw_ctx);
        return JS_ThrowTypeError(ctx, "AES-KW setkey failed");
    }

    size_t out_size = is_wrap ? data_len + 8 : data_len - 8;
    uint8_t *output = js_malloc(ctx, out_size > 0 ? out_size : 1);
    if (!output) {
        mbedtls_nist_kw_free(&kw_ctx);
        return JS_EXCEPTION;
    }

    size_t out_len = 0;
    if (is_wrap) {
        ret = mbedtls_nist_kw_wrap(&kw_ctx, MBEDTLS_KW_MODE_KW, data, data_len, output, &out_len, out_size);
    } else {
        ret = mbedtls_nist_kw_unwrap(&kw_ctx, MBEDTLS_KW_MODE_KW, data, data_len, output, &out_len, out_size);
    }

    mbedtls_nist_kw_free(&kw_ctx);

    if (ret != 0) {
        js_free(ctx, output);
        return JS_ThrowTypeError(ctx, "AES-KW operation failed");
    }

    JSValue result = JS_NewUint8ArrayCopy(ctx, output, out_len);
    js_free(ctx, output);
    return result;
}

/* X25519 get public key from private key (sync). */

static JSValue tjs_webcrypto_x25519_get_public_key(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    if (argc < 1) {
        return JS_ThrowTypeError(ctx, "expected 1 argument: privkey");
    }

    size_t privkey_len;
    const uint8_t *privkey = JS_GetUint8Array(ctx, &privkey_len, argv[0]);
    if (!privkey || privkey_len != 32) {
        return JS_ThrowTypeError(ctx, "privkey must be 32 bytes");
    }

    uint8_t pubkey[32];
    crypto_scalarmult_curve25519_base(pubkey, privkey);

    return JS_NewUint8ArrayCopy(ctx, pubkey, 32);
}

void tjs__webcrypto_init(JSContext *ctx, JSValue ns) {
    JSValue obj = JS_NewObject(ctx);
    JSValue digest_fn = JS_NewCFunction(ctx, tjs_webcrypto_digest, "digest", 3);
    JS_SetPropertyFunctionList(ctx, digest_fn, tjs_webcrypto_consts, countof(tjs_webcrypto_consts));
    JS_DefinePropertyValueStr(ctx, obj, "digest", digest_fn, JS_PROP_C_W_E);
    JSValue hmac_sign_fn = JS_NewCFunction(ctx, tjs_webcrypto_hmac_sign, "hmacSign", 4);
    JS_SetPropertyFunctionList(ctx, hmac_sign_fn, tjs_webcrypto_consts, countof(tjs_webcrypto_consts));
    JS_DefinePropertyValueStr(ctx, obj, "hmacSign", hmac_sign_fn, JS_PROP_C_W_E);
    JSValue cipher_fn = JS_NewCFunction(ctx, tjs_webcrypto_cipher, "cipher", 8);
    JS_SetPropertyFunctionList(ctx, cipher_fn, tjs_cipher_consts, countof(tjs_cipher_consts));
    JS_DefinePropertyValueStr(ctx, obj, "cipher", cipher_fn, JS_PROP_C_W_E);
    JSValue pbkdf2_fn = JS_NewCFunction(ctx, tjs_webcrypto_pbkdf2, "pbkdf2", 6);
    JS_SetPropertyFunctionList(ctx, pbkdf2_fn, tjs_webcrypto_consts, countof(tjs_webcrypto_consts));
    JS_DefinePropertyValueStr(ctx, obj, "pbkdf2", pbkdf2_fn, JS_PROP_C_W_E);
    JSValue hkdf_fn = JS_NewCFunction(ctx, tjs_webcrypto_hkdf, "hkdf", 6);
    JS_SetPropertyFunctionList(ctx, hkdf_fn, tjs_webcrypto_consts, countof(tjs_webcrypto_consts));
    JS_DefinePropertyValueStr(ctx, obj, "hkdf", hkdf_fn, JS_PROP_C_W_E);
    JSValue ec_gen_fn = JS_NewCFunction(ctx, tjs_webcrypto_ec_generate_key, "ecGenerateKey", 2);
    JS_SetPropertyFunctionList(ctx, ec_gen_fn, tjs_ec_consts, countof(tjs_ec_consts));
    JS_DefinePropertyValueStr(ctx, obj, "ecGenerateKey", ec_gen_fn, JS_PROP_C_W_E);
    JSValue ecdsa_sign_fn = JS_NewCFunction(ctx, tjs_webcrypto_ecdsa_sign, "ecdsaSign", 5);
    JS_SetPropertyFunctionList(ctx, ecdsa_sign_fn, tjs_ec_consts, countof(tjs_ec_consts));
    JS_SetPropertyFunctionList(ctx, ecdsa_sign_fn, tjs_webcrypto_consts, countof(tjs_webcrypto_consts));
    JS_DefinePropertyValueStr(ctx, obj, "ecdsaSign", ecdsa_sign_fn, JS_PROP_C_W_E);
    JSValue ecdsa_verify_fn = JS_NewCFunction(ctx, tjs_webcrypto_ecdsa_verify, "ecdsaVerify", 6);
    JS_SetPropertyFunctionList(ctx, ecdsa_verify_fn, tjs_ec_consts, countof(tjs_ec_consts));
    JS_SetPropertyFunctionList(ctx, ecdsa_verify_fn, tjs_webcrypto_consts, countof(tjs_webcrypto_consts));
    JS_DefinePropertyValueStr(ctx, obj, "ecdsaVerify", ecdsa_verify_fn, JS_PROP_C_W_E);
    JSValue ecdh_fn = JS_NewCFunction(ctx, tjs_webcrypto_ecdh_derive_bits, "ecdhDeriveBits", 4);
    JS_SetPropertyFunctionList(ctx, ecdh_fn, tjs_ec_consts, countof(tjs_ec_consts));
    JS_DefinePropertyValueStr(ctx, obj, "ecdhDeriveBits", ecdh_fn, JS_PROP_C_W_E);
    JSValue rsa_gen_fn = JS_NewCFunction(ctx, tjs_webcrypto_rsa_generate_key, "rsaGenerateKey", 3);
    JS_DefinePropertyValueStr(ctx, obj, "rsaGenerateKey", rsa_gen_fn, JS_PROP_C_W_E);
    JSValue rsa_oaep_enc_fn = JS_NewCFunction(ctx, tjs_webcrypto_rsa_oaep_encrypt, "rsaOaepEncrypt", 5);
    JS_SetPropertyFunctionList(ctx, rsa_oaep_enc_fn, tjs_webcrypto_consts, countof(tjs_webcrypto_consts));
    JS_DefinePropertyValueStr(ctx, obj, "rsaOaepEncrypt", rsa_oaep_enc_fn, JS_PROP_C_W_E);
    JSValue rsa_oaep_dec_fn = JS_NewCFunction(ctx, tjs_webcrypto_rsa_oaep_decrypt, "rsaOaepDecrypt", 5);
    JS_SetPropertyFunctionList(ctx, rsa_oaep_dec_fn, tjs_webcrypto_consts, countof(tjs_webcrypto_consts));
    JS_DefinePropertyValueStr(ctx, obj, "rsaOaepDecrypt", rsa_oaep_dec_fn, JS_PROP_C_W_E);
    JSValue rsa_sign_fn = JS_NewCFunction(ctx, tjs_webcrypto_rsa_sign, "rsaSign", 6);
    JS_SetPropertyFunctionList(ctx, rsa_sign_fn, tjs_rsa_consts, countof(tjs_rsa_consts));
    JS_SetPropertyFunctionList(ctx, rsa_sign_fn, tjs_webcrypto_consts, countof(tjs_webcrypto_consts));
    JS_DefinePropertyValueStr(ctx, obj, "rsaSign", rsa_sign_fn, JS_PROP_C_W_E);
    JSValue rsa_verify_fn = JS_NewCFunction(ctx, tjs_webcrypto_rsa_verify, "rsaVerify", 7);
    JS_SetPropertyFunctionList(ctx, rsa_verify_fn, tjs_rsa_consts, countof(tjs_rsa_consts));
    JS_SetPropertyFunctionList(ctx, rsa_verify_fn, tjs_webcrypto_consts, countof(tjs_webcrypto_consts));
    JS_DefinePropertyValueStr(ctx, obj, "rsaVerify", rsa_verify_fn, JS_PROP_C_W_E);
    JSValue rsa_parse_fn = JS_NewCFunction(ctx, tjs_webcrypto_rsa_parse_key, "rsaParseKey", 2);
    JS_DefinePropertyValueStr(ctx, obj, "rsaParseKey", rsa_parse_fn, JS_PROP_C_W_E);
    JSValue ec_parse_fn = JS_NewCFunction(ctx, tjs_webcrypto_ec_parse_key, "ecParseKey", 2);
    JS_SetPropertyFunctionList(ctx, ec_parse_fn, tjs_ec_consts, countof(tjs_ec_consts));
    JS_DefinePropertyValueStr(ctx, obj, "ecParseKey", ec_parse_fn, JS_PROP_C_W_E);
    JSValue ec_to_der_fn = JS_NewCFunction(ctx, tjs_webcrypto_ec_key_to_der, "ecKeyToDer", 3);
    JS_SetPropertyFunctionList(ctx, ec_to_der_fn, tjs_ec_consts, countof(tjs_ec_consts));
    JS_DefinePropertyValueStr(ctx, obj, "ecKeyToDer", ec_to_der_fn, JS_PROP_C_W_E);
    JSValue rsa_export_jwk_fn = JS_NewCFunction(ctx, tjs_webcrypto_rsa_export_jwk, "rsaExportJwk", 2);
    JS_DefinePropertyValueStr(ctx, obj, "rsaExportJwk", rsa_export_jwk_fn, JS_PROP_C_W_E);
    JSValue rsa_import_jwk_fn = JS_NewCFunction(ctx, tjs_webcrypto_rsa_import_jwk, "rsaImportJwk", 8);
    JS_DefinePropertyValueStr(ctx, obj, "rsaImportJwk", rsa_import_jwk_fn, JS_PROP_C_W_E);
    JSValue ec_get_pub_fn = JS_NewCFunction(ctx, tjs_webcrypto_ec_get_public_key, "ecGetPublicKey", 2);
    JS_SetPropertyFunctionList(ctx, ec_get_pub_fn, tjs_ec_consts, countof(tjs_ec_consts));
    JS_DefinePropertyValueStr(ctx, obj, "ecGetPublicKey", ec_get_pub_fn, JS_PROP_C_W_E);
    JSValue ed_gen_fn = JS_NewCFunction(ctx, tjs_webcrypto_ed25519_generate_key, "ed25519GenerateKey", 1);
    JS_DefinePropertyValueStr(ctx, obj, "ed25519GenerateKey", ed_gen_fn, JS_PROP_C_W_E);
    JSValue ed_sign_fn = JS_NewCFunction(ctx, tjs_webcrypto_ed25519_sign, "ed25519Sign", 3);
    JS_DefinePropertyValueStr(ctx, obj, "ed25519Sign", ed_sign_fn, JS_PROP_C_W_E);
    JSValue ed_verify_fn = JS_NewCFunction(ctx, tjs_webcrypto_ed25519_verify, "ed25519Verify", 4);
    JS_DefinePropertyValueStr(ctx, obj, "ed25519Verify", ed_verify_fn, JS_PROP_C_W_E);
    JSValue ed_get_pub_fn = JS_NewCFunction(ctx, tjs_webcrypto_ed25519_get_public_key, "ed25519GetPublicKey", 1);
    JS_DefinePropertyValueStr(ctx, obj, "ed25519GetPublicKey", ed_get_pub_fn, JS_PROP_C_W_E);
    JSValue x25519_gen_fn = JS_NewCFunction(ctx, tjs_webcrypto_x25519_generate_key, "x25519GenerateKey", 1);
    JS_DefinePropertyValueStr(ctx, obj, "x25519GenerateKey", x25519_gen_fn, JS_PROP_C_W_E);
    JSValue x25519_derive_fn = JS_NewCFunction(ctx, tjs_webcrypto_x25519_derive_bits, "x25519DeriveBits", 3);
    JS_DefinePropertyValueStr(ctx, obj, "x25519DeriveBits", x25519_derive_fn, JS_PROP_C_W_E);
    JSValue x25519_get_pub_fn = JS_NewCFunction(ctx, tjs_webcrypto_x25519_get_public_key, "x25519GetPublicKey", 1);
    JS_DefinePropertyValueStr(ctx, obj, "x25519GetPublicKey", x25519_get_pub_fn, JS_PROP_C_W_E);
    JSValue aes_kw_fn = JS_NewCFunction(ctx, tjs_webcrypto_aes_kw, "aesKw", 3);
    JS_SetPropertyFunctionList(ctx, aes_kw_fn, tjs_aes_kw_consts, countof(tjs_aes_kw_consts));
    JS_DefinePropertyValueStr(ctx, obj, "aesKw", aes_kw_fn, JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, ns, "webcrypto", obj, JS_PROP_C_W_E);
}

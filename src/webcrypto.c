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

#include "private.h"

#include <mbedtls/cipher.h>
#include <mbedtls/hkdf.h>
#include <mbedtls/md.h>
#include <mbedtls/pkcs5.h>
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

/* clang-format off */
static const JSCFunctionListEntry tjs_cipher_consts[] = {
    TJS_CONST(CIPHER_AES_CBC),
    TJS_CONST(CIPHER_AES_GCM),
    TJS_CONST(CIPHER_OP_ENCRYPT),
    TJS_CONST(CIPHER_OP_DECRYPT),
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
    JS_DefinePropertyValueStr(ctx, ns, "webcrypto", obj, JS_PROP_C_W_E);
}

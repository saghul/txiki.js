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

#define MBEDTLS_ALLOW_PRIVATE_ACCESS

#include "private.h"

#include <mbedtls/md5.h>
#include <mbedtls/sha1.h>
#include <mbedtls/sha256.h>
#include <mbedtls/sha3.h>
#include <mbedtls/sha512.h>
#include <string.h>

enum {
    HASH_MD5 = 0,
    HASH_SHA1,
    HASH_SHA224,
    HASH_SHA256,
    HASH_SHA384,
    HASH_SHA512,
    HASH_SHA512_224,
    HASH_SHA512_256,
    HASH_SHA3_224,
    HASH_SHA3_256,
    HASH_SHA3_384,
    HASH_SHA3_512,
    HASH_MAX,
};

/* clang-format off */
static const int digest_sizes[] = {
    [HASH_MD5]        = 16,
    [HASH_SHA1]       = 20,
    [HASH_SHA224]     = 28,
    [HASH_SHA256]     = 32,
    [HASH_SHA384]     = 48,
    [HASH_SHA512]     = 64,
    [HASH_SHA512_224] = 28,
    [HASH_SHA512_256] = 32,
    [HASH_SHA3_224]   = 28,
    [HASH_SHA3_256]   = 32,
    [HASH_SHA3_384]   = 48,
    [HASH_SHA3_512]   = 64,
};

/* SHA-512/224 initial hash values (FIPS 180-4 section 5.3.6.1) */
static const uint64_t sha512_224_iv[8] = {
    UINT64_C(0x8C3D37C819544DA2), UINT64_C(0x73E1996689DCD4D6),
    UINT64_C(0x1DFAB7AE32FF9C82), UINT64_C(0x679DD514582F9FCF),
    UINT64_C(0x0F6D2B697BD44DA8), UINT64_C(0x77E36F7304C48942),
    UINT64_C(0x3F9D85A86A1D36C8), UINT64_C(0x1112E6AD91D692A1),
};

/* SHA-512/256 initial hash values (FIPS 180-4 section 5.3.6.2) */
static const uint64_t sha512_256_iv[8] = {
    UINT64_C(0x22312194FC2BF72C), UINT64_C(0x9F555FA3C84C64C2),
    UINT64_C(0x2393B86B6F53B151), UINT64_C(0x963877195940EABD),
    UINT64_C(0x96283EE2A88EFFE3), UINT64_C(0xBE5E1E2553863992),
    UINT64_C(0x2B0199FC2C85B8AA), UINT64_C(0x0EB72DDC81C52CA2),
};
/* clang-format on */

typedef struct {
    int type;
    union {
        mbedtls_md5_context md5;
        mbedtls_sha1_context sha1;
        mbedtls_sha256_context sha256;
        mbedtls_sha512_context sha512;
        mbedtls_sha3_context sha3;
    } ctx;
} TJSHash;

static JSClassID tjs_hash_class_id;

static void tjs_hash_finalizer(JSRuntime *rt, JSValue val) {
    TJSHash *h = JS_GetOpaque(val, tjs_hash_class_id);
    if (h) {
        switch (h->type) {
            case HASH_MD5:
                mbedtls_md5_free(&h->ctx.md5);
                break;
            case HASH_SHA1:
                mbedtls_sha1_free(&h->ctx.sha1);
                break;
            case HASH_SHA224:
            case HASH_SHA256:
                mbedtls_sha256_free(&h->ctx.sha256);
                break;
            case HASH_SHA384:
            case HASH_SHA512:
            case HASH_SHA512_224:
            case HASH_SHA512_256:
                mbedtls_sha512_free(&h->ctx.sha512);
                break;
            case HASH_SHA3_224:
            case HASH_SHA3_256:
            case HASH_SHA3_384:
            case HASH_SHA3_512:
                mbedtls_sha3_free(&h->ctx.sha3);
                break;
        }
        js_free_rt(rt, h);
    }
}

static JSClassDef tjs_hash_class = {
    "Hash",
    .finalizer = tjs_hash_finalizer,
};

static void sha512_truncated_init(mbedtls_sha512_context *ctx, const uint64_t *iv) {
    mbedtls_sha512_init(ctx);
    /* Initialize as SHA-512 to set up all fields, then override the state. */
    mbedtls_sha512_starts(ctx, 0);
    memcpy(ctx->state, iv, sizeof(uint64_t) * 8);
}

static JSValue tjs_hash_constructor(JSContext *ctx, JSValue new_target, int argc, JSValue *argv) {
    if (argc < 1) {
        return JS_ThrowTypeError(ctx, "expected hash type argument");
    }

    int32_t type;
    if (JS_ToInt32(ctx, &type, argv[0])) {
        return JS_EXCEPTION;
    }
    CHECK(type >= HASH_MD5 && type < HASH_MAX);

    JSValue obj = JS_NewObjectClass(ctx, tjs_hash_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSHash *h = js_mallocz(ctx, sizeof(*h));
    if (!h) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    h->type = type;
    int ret = 0;

    switch (type) {
        case HASH_MD5:
            mbedtls_md5_init(&h->ctx.md5);
            ret = mbedtls_md5_starts(&h->ctx.md5);
            break;
        case HASH_SHA1:
            mbedtls_sha1_init(&h->ctx.sha1);
            ret = mbedtls_sha1_starts(&h->ctx.sha1);
            break;
        case HASH_SHA224:
            mbedtls_sha256_init(&h->ctx.sha256);
            ret = mbedtls_sha256_starts(&h->ctx.sha256, 1);
            break;
        case HASH_SHA256:
            mbedtls_sha256_init(&h->ctx.sha256);
            ret = mbedtls_sha256_starts(&h->ctx.sha256, 0);
            break;
        case HASH_SHA384:
            mbedtls_sha512_init(&h->ctx.sha512);
            ret = mbedtls_sha512_starts(&h->ctx.sha512, 1);
            break;
        case HASH_SHA512:
            mbedtls_sha512_init(&h->ctx.sha512);
            ret = mbedtls_sha512_starts(&h->ctx.sha512, 0);
            break;
        case HASH_SHA512_224:
            sha512_truncated_init(&h->ctx.sha512, sha512_224_iv);
            break;
        case HASH_SHA512_256:
            sha512_truncated_init(&h->ctx.sha512, sha512_256_iv);
            break;
        case HASH_SHA3_224:
            mbedtls_sha3_init(&h->ctx.sha3);
            ret = mbedtls_sha3_starts(&h->ctx.sha3, MBEDTLS_SHA3_224);
            break;
        case HASH_SHA3_256:
            mbedtls_sha3_init(&h->ctx.sha3);
            ret = mbedtls_sha3_starts(&h->ctx.sha3, MBEDTLS_SHA3_256);
            break;
        case HASH_SHA3_384:
            mbedtls_sha3_init(&h->ctx.sha3);
            ret = mbedtls_sha3_starts(&h->ctx.sha3, MBEDTLS_SHA3_384);
            break;
        case HASH_SHA3_512:
            mbedtls_sha3_init(&h->ctx.sha3);
            ret = mbedtls_sha3_starts(&h->ctx.sha3, MBEDTLS_SHA3_512);
            break;
    }

    if (ret != 0) {
        js_free(ctx, h);
        JS_FreeValue(ctx, obj);
        return JS_ThrowInternalError(ctx, "failed to initialize hash context");
    }

    JS_SetOpaque(obj, h);
    return obj;
}

static int tjs_hash_do_update(TJSHash *h, const uint8_t *data, size_t len) {
    switch (h->type) {
        case HASH_MD5:
            return mbedtls_md5_update(&h->ctx.md5, data, len);
        case HASH_SHA1:
            return mbedtls_sha1_update(&h->ctx.sha1, data, len);
        case HASH_SHA224:
        case HASH_SHA256:
            return mbedtls_sha256_update(&h->ctx.sha256, data, len);
        case HASH_SHA384:
        case HASH_SHA512:
        case HASH_SHA512_224:
        case HASH_SHA512_256:
            return mbedtls_sha512_update(&h->ctx.sha512, data, len);
        case HASH_SHA3_224:
        case HASH_SHA3_256:
        case HASH_SHA3_384:
        case HASH_SHA3_512:
            return mbedtls_sha3_update(&h->ctx.sha3, data, len);
        default:
            return -1;
    }
}

static JSValue tjs_hash_update(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHash *h = JS_GetOpaque2(ctx, this_val, tjs_hash_class_id);
    if (!h) {
        return JS_EXCEPTION;
    }

    if (argc < 1) {
        return JS_ThrowTypeError(ctx, "expected data argument");
    }

    const uint8_t *data;
    size_t len;
    const char *str = NULL;
    int ret;

    if (JS_IsString(argv[0])) {
        str = JS_ToCStringLen(ctx, &len, argv[0]);
        if (!str) {
            return JS_EXCEPTION;
        }
        ret = tjs_hash_do_update(h, (const uint8_t *) str, len);
        JS_FreeCString(ctx, str);
    } else {
        data = JS_GetUint8Array(ctx, &len, argv[0]);
        if (!data && len != 0) {
            return JS_EXCEPTION;
        }
        ret = tjs_hash_do_update(h, data, len);
    }

    if (ret != 0) {
        return JS_ThrowInternalError(ctx, "hash update failed");
    }

    return JS_UNDEFINED;
}

static JSValue tjs_hash_finish(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSHash *h = JS_GetOpaque2(ctx, this_val, tjs_hash_class_id);
    if (!h) {
        return JS_EXCEPTION;
    }

    int dsize = digest_sizes[h->type];
    unsigned char buf[64]; /* Max digest size (SHA-512). */
    int ret = 0;

    switch (h->type) {
        case HASH_MD5:
            ret = mbedtls_md5_finish(&h->ctx.md5, buf);
            break;
        case HASH_SHA1:
            ret = mbedtls_sha1_finish(&h->ctx.sha1, buf);
            break;
        case HASH_SHA224:
        case HASH_SHA256:
            ret = mbedtls_sha256_finish(&h->ctx.sha256, buf);
            break;
        case HASH_SHA384:
        case HASH_SHA512:
        case HASH_SHA512_224:
        case HASH_SHA512_256:
            /* SHA-512/224 and SHA-512/256 produce full 64-byte output,
             * truncated to dsize below via JS_NewUint8ArrayCopy. */
            ret = mbedtls_sha512_finish(&h->ctx.sha512, buf);
            break;
        case HASH_SHA3_224:
            ret = mbedtls_sha3_finish(&h->ctx.sha3, buf, 28);
            break;
        case HASH_SHA3_256:
            ret = mbedtls_sha3_finish(&h->ctx.sha3, buf, 32);
            break;
        case HASH_SHA3_384:
            ret = mbedtls_sha3_finish(&h->ctx.sha3, buf, 48);
            break;
        case HASH_SHA3_512:
            ret = mbedtls_sha3_finish(&h->ctx.sha3, buf, 64);
            break;
    }

    if (ret != 0) {
        return JS_ThrowInternalError(ctx, "hash finish failed");
    }

    return JS_NewUint8ArrayCopy(ctx, buf, dsize);
}

/* clang-format off */
static const JSCFunctionListEntry tjs_hash_proto_funcs[] = {
    TJS_CFUNC_DEF("update", 1, tjs_hash_update),
    TJS_CFUNC_DEF("finish", 0, tjs_hash_finish),
};
/* clang-format on */

/* clang-format off */
static const JSCFunctionListEntry tjs_hash_consts[] = {
    TJS_CONST(HASH_MD5),
    TJS_CONST(HASH_SHA1),
    TJS_CONST(HASH_SHA224),
    TJS_CONST(HASH_SHA256),
    TJS_CONST(HASH_SHA384),
    TJS_CONST(HASH_SHA512),
    TJS_CONST(HASH_SHA512_224),
    TJS_CONST(HASH_SHA512_256),
    TJS_CONST(HASH_SHA3_224),
    TJS_CONST(HASH_SHA3_256),
    TJS_CONST(HASH_SHA3_384),
    TJS_CONST(HASH_SHA3_512),
    TJS_CONST(HASH_MAX),
};
/* clang-format on */

void tjs__mod_hashing_init(JSContext *ctx, JSValue ns) {
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSValue proto, obj;

    JS_NewClassID(rt, &tjs_hash_class_id);
    JS_NewClass(rt, tjs_hash_class_id, &tjs_hash_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_hash_proto_funcs, countof(tjs_hash_proto_funcs));
    JS_SetClassProto(ctx, tjs_hash_class_id, proto);

    obj = JS_NewCFunction2(ctx, tjs_hash_constructor, "Hash", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, obj, tjs_hash_consts, countof(tjs_hash_consts));
    JS_DefinePropertyValueStr(ctx, ns, "Hash", obj, JS_PROP_C_W_E);
}

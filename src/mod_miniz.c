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

#include <miniz.h>
#include <string.h>

enum {
    FORMAT_DEFLATE_RAW = 0,
    FORMAT_DEFLATE,
    FORMAT_GZIP,
};

/* clang-format off */
static const uint8_t gzip_header[10] = {
    0x1f, 0x8b,                      /* ID1, ID2 */
    0x08,                            /* CM = deflate */
    0x00,                            /* FLG = no flags */
    0x00, 0x00, 0x00, 0x00,          /* MTIME = 0 */
    0x00,                            /* XFL */
    0xff,                            /* OS = unknown */
};
/* clang-format on */

static int parse_format(JSContext *ctx, JSValue val) {
    const char *str = JS_ToCString(ctx, val);
    if (!str) {
        return -1;
    }

    int format;
    if (!strcmp(str, "deflate-raw")) {
        format = FORMAT_DEFLATE_RAW;
    } else if (!strcmp(str, "deflate")) {
        format = FORMAT_DEFLATE;
    } else if (!strcmp(str, "gzip")) {
        format = FORMAT_GZIP;
    } else {
        JS_ThrowTypeError(ctx, "Invalid compression format: '%s'", str);
        JS_FreeCString(ctx, str);
        return -1;
    }

    JS_FreeCString(ctx, str);
    return format;
}

/*
 * Parse a gzip header (RFC 1952) and return the offset past it.
 * Returns 0 if more data is needed, -1 on error.
 */
static int parse_gzip_header(const uint8_t *data, size_t len, size_t *header_size) {
    if (len < 10) {
        return 0;
    }

    if (data[0] != 0x1f || data[1] != 0x8b) {
        return -1;
    }

    if (data[2] != 0x08) {
        return -1;
    }

    uint8_t flg = data[3];
    size_t pos = 10;

    /* FEXTRA */
    if (flg & 0x04) {
        if (len < pos + 2) {
            return 0;
        }
        uint16_t xlen = (uint16_t) data[pos] | ((uint16_t) data[pos + 1] << 8);
        pos += 2 + xlen;
        if (len < pos) {
            return 0;
        }
    }

    /* FNAME */
    if (flg & 0x08) {
        while (pos < len && data[pos] != 0) {
            pos++;
        }
        if (pos >= len) {
            return 0;
        }
        pos++;
    }

    /* FCOMMENT */
    if (flg & 0x10) {
        while (pos < len && data[pos] != 0) {
            pos++;
        }
        if (pos >= len) {
            return 0;
        }
        pos++;
    }

    /* FHCRC */
    if (flg & 0x02) {
        if (len < pos + 2) {
            return 0;
        }
        pos += 2;
    }

    *header_size = pos;
    return 1;
}

typedef struct {
    JSContext *ctx;
    mz_stream stream;
    int format;
    bool initialized;
    bool header_written;
    mz_ulong crc32;
    mz_ulong total_in;
} TJSCompressor;

static JSClassID tjs_compressor_class_id;

static void tjs_compressor_finalizer(JSRuntime *rt, JSValue val) {
    TJSCompressor *c = JS_GetOpaque(val, tjs_compressor_class_id);
    if (c) {
        if (c->initialized) {
            mz_deflateEnd(&c->stream);
        }
        js_free_rt(rt, c);
    }
}

static JSClassDef tjs_compressor_class = {
    "Compressor",
    .finalizer = tjs_compressor_finalizer,
};

static JSValue tjs_compressor_constructor(JSContext *ctx, JSValue new_target, int argc, JSValue *argv) {
    if (argc < 1) {
        return JS_ThrowTypeError(ctx, "expected format argument");
    }

    int format = parse_format(ctx, argv[0]);
    if (format < 0) {
        return JS_EXCEPTION;
    }

    JSValue obj = JS_NewObjectClass(ctx, tjs_compressor_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSCompressor *c = js_mallocz(ctx, sizeof(*c));
    if (!c) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    c->ctx = ctx;
    c->format = format;
    c->crc32 = MZ_CRC32_INIT;
    c->total_in = 0;

    int window_bits;
    switch (format) {
        case FORMAT_DEFLATE_RAW:
        case FORMAT_GZIP:
            window_bits = -MZ_DEFAULT_WINDOW_BITS;
            break;
        case FORMAT_DEFLATE:
        default:
            window_bits = MZ_DEFAULT_WINDOW_BITS;
            break;
    }

    int ret = mz_deflateInit2(&c->stream, MZ_DEFAULT_COMPRESSION, MZ_DEFLATED, window_bits, 9, MZ_DEFAULT_STRATEGY);
    if (ret != MZ_OK) {
        js_free(ctx, c);
        JS_FreeValue(ctx, obj);
        return JS_ThrowInternalError(ctx, "failed to initialize compressor");
    }

    c->initialized = true;
    JS_SetOpaque(obj, c);
    return obj;
}

static JSValue tjs_compressor_process(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSCompressor *c = JS_GetOpaque2(ctx, this_val, tjs_compressor_class_id);
    if (!c) {
        return JS_EXCEPTION;
    }
    if (!c->initialized) {
        return JS_ThrowInternalError(ctx, "compressor is not initialized");
    }

    size_t in_size = 0;
    const uint8_t *in_data = NULL;

    if (argc > 0 && !JS_IsUndefined(argv[0]) && !JS_IsNull(argv[0])) {
        in_data = JS_GetUint8Array(ctx, &in_size, argv[0]);
        if (!in_data && in_size != 0) {
            return JS_EXCEPTION;
        }
    }

    int flush = MZ_NO_FLUSH;
    if (argc > 1) {
        int32_t f;
        if (JS_ToInt32(ctx, &f, argv[1])) {
            return JS_EXCEPTION;
        }
        flush = f;
    }

    /* Track CRC32 and total input for gzip. */
    if (c->format == FORMAT_GZIP && in_data && in_size > 0) {
        c->crc32 = mz_crc32(c->crc32, in_data, in_size);
        c->total_in += in_size;
    }

    DynBuf out;
    tjs_dbuf_init(ctx, &out);

    /* Write gzip header on first call. */
    if (c->format == FORMAT_GZIP && !c->header_written) {
        dbuf_put(&out, gzip_header, sizeof(gzip_header));
        c->header_written = true;
    }

    /* Compress. */
    c->stream.next_in = in_data;
    c->stream.avail_in = (mz_uint32) in_size;

    uint8_t tmp[8192];
    do {
        c->stream.next_out = tmp;
        c->stream.avail_out = sizeof(tmp);
        int ret = mz_deflate(&c->stream, flush);
        if (ret != MZ_OK && ret != MZ_STREAM_END && ret != MZ_BUF_ERROR) {
            dbuf_free(&out);
            return JS_ThrowInternalError(ctx, "compression error: %d", ret);
        }
        size_t produced = sizeof(tmp) - c->stream.avail_out;
        if (produced > 0) {
            dbuf_put(&out, tmp, produced);
        }
        if (ret == MZ_STREAM_END) {
            break;
        }
    } while (c->stream.avail_out == 0);

    /* Write gzip trailer on finish. */
    if (c->format == FORMAT_GZIP && flush == MZ_FINISH) {
        uint8_t trailer[8];
        /* CRC32 (little-endian). */
        trailer[0] = (uint8_t) (c->crc32 & 0xff);
        trailer[1] = (uint8_t) ((c->crc32 >> 8) & 0xff);
        trailer[2] = (uint8_t) ((c->crc32 >> 16) & 0xff);
        trailer[3] = (uint8_t) ((c->crc32 >> 24) & 0xff);
        /* ISIZE (little-endian, mod 2^32). */
        uint32_t isize = (uint32_t) (c->total_in & 0xffffffff);
        trailer[4] = (uint8_t) (isize & 0xff);
        trailer[5] = (uint8_t) ((isize >> 8) & 0xff);
        trailer[6] = (uint8_t) ((isize >> 16) & 0xff);
        trailer[7] = (uint8_t) ((isize >> 24) & 0xff);
        dbuf_put(&out, trailer, sizeof(trailer));
    }

    if (out.size == 0) {
        dbuf_free(&out);
        return JS_NewUint8ArrayCopy(ctx, NULL, 0);
    }

    JSValue result = TJS_NewUint8Array(ctx, out.buf, out.size);
    if (JS_IsException(result)) {
        dbuf_free(&out);
    }
    return result;
}

/* clang-format off */
static const JSCFunctionListEntry tjs_compressor_proto_funcs[] = {
    TJS_CFUNC_DEF("process", 2, tjs_compressor_process),
};
/* clang-format on */

enum {
    GZIP_STATE_HEADER = 0,
    GZIP_STATE_DATA,
    GZIP_STATE_TRAILER,
    GZIP_STATE_DONE,
};

struct TJSDecompressor {
    JSContext *ctx;
    mz_stream stream;
    int format;
    bool initialized;
    int gzip_state;
    DynBuf header_buf;
    DynBuf trailer_buf;
    mz_ulong crc32;
    mz_ulong total_out;
};

static JSClassID tjs_decompressor_class_id;

static void tjs_decompressor_finalizer(JSRuntime *rt, JSValue val) {
    TJSDecompressor *d = JS_GetOpaque(val, tjs_decompressor_class_id);
    if (d) {
        tjs__decompressor_destroy(d, rt);
    }
}

static JSClassDef tjs_decompressor_class = {
    "Decompressor",
    .finalizer = tjs_decompressor_finalizer,
};

static JSValue tjs_decompressor_constructor(JSContext *ctx, JSValue new_target, int argc, JSValue *argv) {
    if (argc < 1) {
        return JS_ThrowTypeError(ctx, "expected format argument");
    }

    const char *str = JS_ToCString(ctx, argv[0]);
    if (!str) {
        return JS_EXCEPTION;
    }

    TJSDecompressor *d = tjs__decompressor_create(ctx, str);
    if (!d) {
        JS_ThrowTypeError(ctx, "Invalid compression format: '%s'", str);
        JS_FreeCString(ctx, str);
        return JS_EXCEPTION;
    }
    JS_FreeCString(ctx, str);

    JSValue obj = JS_NewObjectClass(ctx, tjs_decompressor_class_id);
    if (JS_IsException(obj)) {
        tjs__decompressor_destroy(d, JS_GetRuntime(ctx));
        return obj;
    }

    JS_SetOpaque(obj, d);
    return obj;
}

static int tjs_decompressor_inflate(TJSDecompressor *d, const uint8_t *in_data, size_t in_size, DynBuf *out) {
    d->stream.next_in = in_data;
    d->stream.avail_in = (mz_uint32) in_size;

    uint8_t tmp[8192];
    int ret;
    do {
        d->stream.next_out = tmp;
        d->stream.avail_out = sizeof(tmp);
        ret = mz_inflate(&d->stream, MZ_SYNC_FLUSH);
        if (ret != MZ_OK && ret != MZ_STREAM_END && ret != MZ_BUF_ERROR) {
            return -1;
        }
        size_t produced = sizeof(tmp) - d->stream.avail_out;
        if (produced > 0) {
            if (d->format == FORMAT_GZIP) {
                d->crc32 = mz_crc32(d->crc32, tmp, produced);
                d->total_out += produced;
            }
            dbuf_put(out, tmp, produced);
        }
        if (ret == MZ_STREAM_END) {
            if (d->format == FORMAT_GZIP) {
                /* Collect any remaining input as trailer data. */
                if (d->stream.avail_in > 0) {
                    dbuf_put(&d->trailer_buf, d->stream.next_in, d->stream.avail_in);
                    d->stream.avail_in = 0;
                }
                d->gzip_state = GZIP_STATE_TRAILER;
            }
            break;
        }
    } while (d->stream.avail_in > 0 || d->stream.avail_out == 0);

    return 0;
}

TJSDecompressor *tjs__decompressor_create(JSContext *ctx, const char *format) {
    int fmt;
    if (!strcmp(format, "deflate-raw")) {
        fmt = FORMAT_DEFLATE_RAW;
    } else if (!strcmp(format, "deflate")) {
        fmt = FORMAT_DEFLATE;
    } else if (!strcmp(format, "gzip")) {
        fmt = FORMAT_GZIP;
    } else {
        return NULL;
    }

    TJSDecompressor *d = js_mallocz(ctx, sizeof(*d));
    if (!d) {
        return NULL;
    }

    d->ctx = ctx;
    d->format = fmt;
    d->crc32 = MZ_CRC32_INIT;
    d->total_out = 0;

    if (fmt == FORMAT_GZIP) {
        d->gzip_state = GZIP_STATE_HEADER;
        tjs_dbuf_init(ctx, &d->header_buf);
        tjs_dbuf_init(ctx, &d->trailer_buf);
    } else {
        int window_bits;
        switch (fmt) {
            case FORMAT_DEFLATE_RAW:
                window_bits = -MZ_DEFAULT_WINDOW_BITS;
                break;
            case FORMAT_DEFLATE:
            default:
                window_bits = MZ_DEFAULT_WINDOW_BITS;
                break;
        }

        int ret = mz_inflateInit2(&d->stream, window_bits);
        if (ret != MZ_OK) {
            js_free(ctx, d);
            return NULL;
        }
        d->initialized = true;
    }

    return d;
}

int tjs__decompressor_decompress(TJSDecompressor *d, const uint8_t *in, size_t in_len, DynBuf *out) {
    if (d->format == FORMAT_GZIP) {
        const uint8_t *p = in;
        size_t remaining = in_len;

        /* Parse gzip header. */
        if (d->gzip_state == GZIP_STATE_HEADER) {
            dbuf_put(&d->header_buf, p, remaining);
            p += remaining;
            remaining = 0;

            size_t header_size;
            int hret = parse_gzip_header(d->header_buf.buf, d->header_buf.size, &header_size);
            if (hret < 0) {
                return -1;
            }
            if (hret == 0) {
                /* Need more data for the header. */
                return 0;
            }

            /* Header parsed. Initialize raw inflate. */
            int ret = mz_inflateInit2(&d->stream, -MZ_DEFAULT_WINDOW_BITS);
            if (ret != MZ_OK) {
                return -1;
            }
            d->initialized = true;
            d->gzip_state = GZIP_STATE_DATA;

            /* Feed any data past the header. */
            remaining = d->header_buf.size - header_size;
            p = d->header_buf.buf + header_size;
        }

        /* Inflate data. */
        if (d->gzip_state == GZIP_STATE_DATA && remaining > 0) {
            if (tjs_decompressor_inflate(d, p, remaining, out) < 0) {
                return -1;
            }
        }

        /* Verify trailer if we have enough data. */
        if (d->gzip_state == GZIP_STATE_TRAILER && d->trailer_buf.size >= 8) {
            const uint8_t *t = d->trailer_buf.buf;
            uint32_t expected_crc =
                (uint32_t) t[0] | ((uint32_t) t[1] << 8) | ((uint32_t) t[2] << 16) | ((uint32_t) t[3] << 24);
            uint32_t expected_size =
                (uint32_t) t[4] | ((uint32_t) t[5] << 8) | ((uint32_t) t[6] << 16) | ((uint32_t) t[7] << 24);

            if ((uint32_t) d->crc32 != expected_crc) {
                return -1;
            }
            if ((uint32_t) (d->total_out & 0xffffffff) != expected_size) {
                return -1;
            }
            d->gzip_state = GZIP_STATE_DONE;
        }
    } else {
        if (!d->initialized) {
            return -1;
        }

        if (tjs_decompressor_inflate(d, in, in_len, out) < 0) {
            return -1;
        }
    }

    return 0;
}

void tjs__decompressor_destroy(TJSDecompressor *d, JSRuntime *rt) {
    if (d->initialized) {
        mz_inflateEnd(&d->stream);
    }
    dbuf_free(&d->header_buf);
    dbuf_free(&d->trailer_buf);
    js_free_rt(rt, d);
}

static JSValue tjs_decompressor_process(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSDecompressor *d = JS_GetOpaque2(ctx, this_val, tjs_decompressor_class_id);
    if (!d) {
        return JS_EXCEPTION;
    }

    size_t in_size = 0;
    const uint8_t *in_data = NULL;

    if (argc > 0 && !JS_IsUndefined(argv[0]) && !JS_IsNull(argv[0])) {
        in_data = JS_GetUint8Array(ctx, &in_size, argv[0]);
        if (!in_data && in_size != 0) {
            return JS_EXCEPTION;
        }
    }

    DynBuf out;
    tjs_dbuf_init(ctx, &out);

    if (tjs__decompressor_decompress(d, in_data, in_size, &out) < 0) {
        dbuf_free(&out);
        return JS_ThrowInternalError(ctx, "decompression error");
    }

    if (out.size == 0) {
        dbuf_free(&out);
        return JS_NewUint8ArrayCopy(ctx, NULL, 0);
    }

    JSValue result = TJS_NewUint8Array(ctx, out.buf, out.size);
    if (JS_IsException(result)) {
        dbuf_free(&out);
    }
    return result;
}

/* clang-format off */
static const JSCFunctionListEntry tjs_decompressor_proto_funcs[] = {
    TJS_CFUNC_DEF("process", 1, tjs_decompressor_process),
};
/* clang-format on */

void tjs__mod_miniz_init(JSContext *ctx, JSValue ns) {
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSValue proto, obj;

    /* Compressor class. */
    JS_NewClassID(rt, &tjs_compressor_class_id);
    JS_NewClass(rt, tjs_compressor_class_id, &tjs_compressor_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_compressor_proto_funcs, countof(tjs_compressor_proto_funcs));
    JS_SetClassProto(ctx, tjs_compressor_class_id, proto);

    obj = JS_NewCFunction2(ctx, tjs_compressor_constructor, "Compressor", 1, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, ns, "Compressor", obj, JS_PROP_C_W_E);

    /* Decompressor class. */
    JS_NewClassID(rt, &tjs_decompressor_class_id);
    JS_NewClass(rt, tjs_decompressor_class_id, &tjs_decompressor_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_decompressor_proto_funcs, countof(tjs_decompressor_proto_funcs));
    JS_SetClassProto(ctx, tjs_decompressor_class_id, proto);

    obj = JS_NewCFunction2(ctx, tjs_decompressor_constructor, "Decompressor", 1, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, ns, "Decompressor", obj, JS_PROP_C_W_E);
}

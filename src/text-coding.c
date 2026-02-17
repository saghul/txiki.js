
/*
 * txiki.js
 *
 * Copyright (c) 2024-present lal12
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


#define TJS_TEXT_CODING_RESULT_CODEPOINT 1
#define TJS_TEXT_CODING_RESULT_CONTINUE  2
#define TJS_TEXT_CODING_RESULT_FINISHED  3
#define TJS_TEXT_CODING_RESULT_ERROR     4

#define TJS_TEXT_CODING_OPTION_STREAM     (1 << 0)
#define TJS_TEXT_CODING_OPTION_FATAL      (1 << 1)
#define TJS_TEXT_CODING_OPTION_IGNORE_BOM (1 << 2)

#define TJS_TEXT_CODING_OPTIONS_MASK                                                                                   \
    (TJS_TEXT_CODING_OPTION_STREAM | TJS_TEXT_CODING_OPTION_FATAL | TJS_TEXT_CODING_OPTION_IGNORE_BOM)

typedef struct {
    void *(*create)(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv);
    JSValue (*decode)(void *ref, uint8_t **data, size_t len);
    JSValue (*free)(JSContext *ctx, void *ref);
    char **names;
} decoder_t;

#pragma region "UTF8 Coder"

#define TJS_UTF8_DECODER_FLAG_DO_NOT_FLUSH (1 << 0)
#define TJS_UTF8_DECODER_FLAG_BOM_SEEN     (1 << 1)

typedef struct {
    JSContext *ctx;
    uint32_t bytes_seen;
    uint32_t bytes_needed;
    uint32_t lower_bound;
    uint32_t upper_bound;
    uint32_t code_point;
    uint32_t flags;

    uint8_t leftover[6];  // only 3 bytes can be leftover, but for continuation it needs less allocation when having 3
                          // additional bytes.
    uint32_t leftover_len;
} TJS_utf8_decoder;

static JSClassID tjs_utf8_decoder_class_id;

static JSValue tjs_utf8_decoder_create(JSContext *ctx, JSValueConst new_target, int argc, JSValueConst *argv) {
    JSValue obj = JS_NewObjectClass(ctx, tjs_utf8_decoder_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }
    TJS_utf8_decoder *d = js_malloc(ctx, sizeof(*d));
    if (!d) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }
    d->bytes_seen = 0;
    d->bytes_needed = 0;
    d->code_point = 0;
    d->lower_bound = 0x80;
    d->upper_bound = 0xbf;
    d->flags = 0;
    JS_SetOpaque(obj, d);
    return obj;
}

static void tjs_utf8_decoder_finalizer(JSRuntime *rt, JSValue val) {
    TJS_utf8_decoder *d = JS_GetOpaque(val, tjs_utf8_decoder_class_id);
    if (d) {
        js_free_rt(rt, d);
    }
}

static JSClassDef tjs_utf8_decoder_class = {
    "Utf8Decoder",
    .finalizer = tjs_utf8_decoder_finalizer,
};

static const JSCFunctionListEntry tjs_utf8_decoder_opts[] = {
    JS_PROP_INT32_DEF("stream", TJS_TEXT_CODING_OPTION_STREAM, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("fatal", TJS_TEXT_CODING_OPTION_FATAL, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("ignoreBOM", TJS_TEXT_CODING_OPTION_IGNORE_BOM, JS_PROP_ENUMERABLE),
};

static inline uint8_t tjs_utf8_decoder_handler(TJS_utf8_decoder *d, uint8_t **data, bool is_eoq) {
    if (is_eoq) {  // end of queue
        if (d->bytes_needed != 0) {
            d->bytes_needed = 0;
            return TJS_TEXT_CODING_RESULT_ERROR;
        } else {
            return TJS_TEXT_CODING_RESULT_FINISHED;
        }
    }
    uint8_t byte = **data;
    if (d->bytes_needed == 0) {
        if (byte <= 0x7f) {  // 0x00 to 0x7F
            d->code_point = byte;
            return TJS_TEXT_CODING_RESULT_CODEPOINT;
        } else if (byte <= 0xc1) {  // 0x80 to 0xc1 -> invalid
            return TJS_TEXT_CODING_RESULT_ERROR;
        } else if (byte <= 0xdf) {  // 0xC2 to 0xDF
            d->bytes_needed = 1;
            d->code_point = byte & 0x1f;
        } else if (byte <= 0xef) {  // 0xE0 to 0xEF
            if (byte == 0xe0) {
                d->lower_bound = 0xa0;
            } else if (byte == 0xed) {
                d->upper_bound = 0x9f;
            }
            d->bytes_needed = 2;
            d->code_point = byte & 0x0f;
        } else if (byte <= 0xf4) {  // 0xF0 to 0xF4
            if (byte == 0xf0) {
                d->lower_bound = 0x90;
            } else if (byte == 0xf4) {
                d->upper_bound = 0x8f;
            }
            d->bytes_needed = 3;
            d->code_point = byte & 0x07;
        } else {
            return TJS_TEXT_CODING_RESULT_ERROR;
        }
        return TJS_TEXT_CODING_RESULT_CONTINUE;
    } else if (byte < d->lower_bound || byte > d->upper_bound) {
        d->bytes_needed = 0;
        d->lower_bound = 0x80;
        d->upper_bound = 0xbf;
        (*data)--;  // rewind one
        return TJS_TEXT_CODING_RESULT_ERROR;
    }
    d->lower_bound = 0x80;
    d->upper_bound = 0xbf;
    d->code_point = (d->code_point << 6) | (byte & 0x3f);
    d->bytes_seen++;
    if (d->bytes_seen != d->bytes_needed) {
        return TJS_TEXT_CODING_RESULT_CONTINUE;
    }
    d->bytes_seen = 0;
    d->bytes_needed = 0;
    return TJS_TEXT_CODING_RESULT_CODEPOINT;
}

static int tjs_utf8_encoder_handler(uint32_t cp, bool eoq, uint8_t buf[4]);

static int string_buffer_putc(DynBuf *s, uint32_t cp) {
    uint8_t buf[4];
    int res = tjs_utf8_encoder_handler(cp, false, buf);
    if (res < 0) {
        return -1;
    }
    dbuf_put(s, buf, res);
    return 0;
}

static inline int tjs_utf8_decoder_process_item(JSContext *ctx,
                                                TJS_utf8_decoder *d,
                                                uint8_t **ptr,
                                                uint8_t *end,
                                                uint32_t opts,
                                                DynBuf *s) {
    bool is_eoq = *ptr >= end;
    uint32_t res = tjs_utf8_decoder_handler(d, ptr, is_eoq);
    switch (res) {
        case TJS_TEXT_CODING_RESULT_FINISHED:
            return 1;  // finished
            break;
        case TJS_TEXT_CODING_RESULT_CODEPOINT:
            if (!((opts & TJS_TEXT_CODING_OPTION_IGNORE_BOM) == 0 &&
                  d->code_point == 0xFEFF)) {  // do not add BOM, if ignoreBOM is set
                if (string_buffer_putc(s, d->code_point)) {
                    return -2;
                }
            }
            return 0;  // continue
            break;
        case TJS_TEXT_CODING_RESULT_ERROR:
            if (opts & TJS_TEXT_CODING_OPTION_FATAL) {
                return -1;
            } else {
                if (string_buffer_putc(s, 0xfffd)) {  // TODO check if this is correct (was string_buffer_putc16 before)
                    return -2;
                }
                return 0;  // continue
            }
            break;
        case TJS_TEXT_CODING_RESULT_CONTINUE:
            return 0;  // continue
            break;
        default:
            return -2;
    }
}

static JSValue tjs_utf8_decoder_decode(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJS_utf8_decoder *d = JS_GetOpaque2(ctx, this_val, tjs_utf8_decoder_class_id);
    if (!d) {
        return JS_ThrowTypeError(ctx, "object is not a Utf8Decoder");
    }

    if (argc != 2) {
        return JS_ThrowRangeError(ctx, "invalid arguments");
    }

    size_t bufsz = 0;
    uint8_t *buf = JS_GetUint8Array(ctx, &bufsz, argv[0]);
    if (!buf) {
        return JS_ThrowTypeError(ctx, "invalid arguments");
    }

    uint32_t opts = 0;
    if (!JS_IsUndefined(argv[1]) && JS_ToUint32(ctx, &opts, argv[1])) {
        return JS_ThrowTypeError(ctx, "invalid arguments");
    }
    opts = opts & TJS_TEXT_CODING_OPTIONS_MASK;

    if (!(d->flags & TJS_UTF8_DECODER_FLAG_DO_NOT_FLUSH)) {
        d->bytes_seen = 0;
        d->bytes_needed = 0;
        d->code_point = 0;
        d->lower_bound = 0x80;
        d->upper_bound = 0xbf;
        d->flags = 0;
    }

    if (opts & TJS_TEXT_CODING_OPTION_STREAM) {
        d->flags |= TJS_UTF8_DECODER_FLAG_DO_NOT_FLUSH;
    } else {
        d->flags &= ~TJS_UTF8_DECODER_FLAG_DO_NOT_FLUSH;
    }

    DynBuf s;
    tjs_dbuf_init(ctx, &s);
    if (dbuf_claim(&s, bufsz) < 0) {
        return JS_ThrowOutOfMemory(ctx);
    }
    uint8_t *ptr = buf - 1;
    uint8_t *end = buf + bufsz;
    JSValue err = JS_NULL;
    do {
        ptr++;                                                              // next item
        if (ptr >= end && d->flags & TJS_UTF8_DECODER_FLAG_DO_NOT_FLUSH) {  // end of queue
            goto end_ok;
        } else {  // otherwise eoq is handled in decoder_handler, so skip this for streaming mode
            uint32_t res = tjs_utf8_decoder_process_item(ctx, d, &ptr, end, opts, &s);
            switch (res) {
                case 1:  // finished
                    goto end_ok;
                case -1:  // error
                    err = JS_ThrowTypeError(ctx, "decoding error");
                    goto end_error;
                case -2:  // internal error
                    err = JS_ThrowInternalError(ctx, "internal error");
                    goto end_error;
                case 0:  // continue
                    break;
            }
        }
    } while (true);

end_ok:;
    JSValue str = JS_NewStringLen(ctx, (const char *) s.buf, s.size);
    dbuf_free(&s);
    return str;

end_error:
    if (JS_IsNull(err)) {
        err = JS_ThrowInternalError(ctx, "unknown error");
    }
    dbuf_free(&s);
    return err;
}

static const JSCFunctionListEntry tjs_utf8_decoder_proto_funcs[] = {
    TJS_CFUNC_DEF("decode", 2, tjs_utf8_decoder_decode),
};

static void init_tjs_utf8_decoder_class(JSContext *ctx, JSValue obj) {
    JS_NewClassID(JS_GetRuntime(ctx), &tjs_utf8_decoder_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_utf8_decoder_class_id, &tjs_utf8_decoder_class);
    JSValue tjs_utf8_decoder_proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx,
                               tjs_utf8_decoder_proto,
                               tjs_utf8_decoder_proto_funcs,
                               countof(tjs_utf8_decoder_proto_funcs));
    JS_SetClassProto(ctx, tjs_utf8_decoder_class_id, tjs_utf8_decoder_proto);
    JSValue tjs_utf8_decoder_constructor =
        JS_NewCFunction2(ctx, tjs_utf8_decoder_create, tjs_utf8_decoder_class.class_name, 1, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx,
                              obj,
                              tjs_utf8_decoder_class.class_name,
                              tjs_utf8_decoder_constructor,
                              JS_PROP_CONFIGURABLE | JS_PROP_WRITABLE | JS_PROP_ENUMERABLE);
    JSValue flags_obj = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, flags_obj, tjs_utf8_decoder_opts, countof(tjs_utf8_decoder_opts));
    JS_SetPropertyStr(ctx, tjs_utf8_decoder_constructor, "opts", flags_obj);
}

#pragma endregion "UTF8 Decoder"

#pragma region "UTF8 Encoder"

static int tjs_utf8_encoder_handler(uint32_t cp, bool eoq, uint8_t buf[4]) {
    if (eoq) {
        return 0;
    }
    size_t sz = 0;
    if (cp <= 0x7f) {  // 0x00 to 0x7F
        buf[0] = cp;
        return 1;
    } else if (cp <= 0x7ff) {  // 0x80 to 0x7FF
        buf[0] = 0xc0 | (cp >> 6);
        buf[1] = 0x80 | (cp & 0x3f);
        sz = 2;
    } else if (cp <= 0xffff) {  // 0x800 to 0xFFFF
        buf[0] = 0xe0 | (cp >> 12);
        buf[1] = 0x80 | ((cp >> 6) & 0x3f);
        buf[2] = 0x80 | (cp & 0x3f);
        sz = 3;
    } else if (cp <= 0x10ffff) {  // 0x10000 to 0x10FFFF
        buf[0] = 0xf0 | (cp >> 18);
        buf[1] = 0x80 | ((cp >> 12) & 0x3f);
        buf[2] = 0x80 | ((cp >> 6) & 0x3f);
        buf[3] = 0x80 | (cp & 0x3f);
        sz = 4;
    } else {
        return -1;
    }
    return sz;
}

static JSValue tjs_utf8_encoder_encode(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    if (argc != 1) {
        return JS_ThrowRangeError(ctx, "invalid arguments");
    }

    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "invalid arguments");
    }

    size_t len;
    const char *str = JS_ToCStringLen2(ctx, &len, argv[0], false);
    if (!str) {
        return JS_EXCEPTION;
    }
    const uint8_t *buf = (const uint8_t *) str;
    DynBuf dbuf;
    tjs_dbuf_init(ctx, &dbuf);
    dbuf_claim(&dbuf, len * 1.5);
    JSValue ret = JS_NULL;

    const uint8_t *ptr = buf;
    while (true) {
        bool eoq = ptr == (buf + len);
        uint32_t cp = 0;
        if (!eoq) {
            cp = utf8_decode(ptr, &ptr);
        }
        if ((cp >= 0xD800 && cp <= 0xDBFF) || (cp >= 0xDC00 && cp <= 0xDFFF)) {  // surrogate
            cp = 0xfffd;
        }
        uint8_t buf2[4];
        int res = tjs_utf8_encoder_handler(cp, eoq, buf2);
        if (TJS__LIKELY(res > 0)) {
            if (dbuf_put(&dbuf, buf2, res)) {
                ret = JS_ThrowOutOfMemory(ctx);
                dbuf_free(&dbuf);
                break;
            }
        } else if (TJS__UNLIKELY(res < 0)) {
            if (res <= -2) {
                ret = JS_ThrowInternalError(ctx, "unknown decoding error");
            } else {
                ret = JS_ThrowTypeError(ctx, "decoder error");
            }
            dbuf_free(&dbuf);
            break;
        } else if (TJS__UNLIKELY(res == 0)) {
            ret = TJS_NewUint8Array(ctx, dbuf.buf, dbuf.size);
            if (JS_IsException(ret)) {
                dbuf_free(&dbuf);
            }
            break;
        }
        if (eoq) {
            break;
        }
    }
    JS_FreeCString(ctx, str);
    return ret;
}

#pragma endregion "UTF8 Encoder"

void tjs__mod_text_coding_init(JSContext *ctx, JSValue ns) {
    JSValue obj = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, ns, "textCoding", obj);
    init_tjs_utf8_decoder_class(ctx, obj);

    JSValue utf8_encode2 = JS_NewCFunction2(ctx, tjs_utf8_encoder_encode, "utf8_encode2", 1, JS_CFUNC_generic, 0);
    JS_SetPropertyStr(ctx, obj, "utf8_encode", utf8_encode2);
}

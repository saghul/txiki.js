/*
 * txiki.js
 *
 * Copyright (c) 2019-present Saúl Ibarra Corretgé <s@saghul.net>
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

#include <ada_c.h>
#include <string.h>


/* Forward declarations. */
static JSClassID tjs_urlsearchparams_class_id;

typedef struct {
    ada_url_search_params params;
    JSValue url_obj; /* back-ref to parent URL or JS_UNDEFINED */
} TJSURLSearchParams;


/*
 * URL
 */

static JSClassID tjs_url_class_id;

typedef struct {
    ada_url url;
    JSValue search_params; /* cached URLSearchParams or JS_UNDEFINED */
} TJSURL;

static void tjs_url_finalizer(JSRuntime *rt, JSValue val) {
    TJSURL *u = JS_GetOpaque(val, tjs_url_class_id);
    if (u) {
        if (u->url) {
            ada_free(u->url);
        }
        JS_FreeValueRT(rt, u->search_params);
        js_free_rt(rt, u);
    }
}

static void tjs_url_gc_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSURL *u = JS_GetOpaque(val, tjs_url_class_id);
    if (u) {
        JS_MarkValue(rt, u->search_params, mark_func);
    }
}

static JSClassDef tjs_url_class = {
    "URL",
    .finalizer = tjs_url_finalizer,
    .gc_mark = tjs_url_gc_mark,
};

static TJSURL *tjs_url_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_url_class_id);
}

static JSValue tjs_new_urlsearchparams_from_search(JSContext *ctx, const char *search, size_t len, JSValue url_obj);
static void tjs_urlsearchparams_sync_to_url(JSContext *ctx, JSValue sp_val);

static JSValue tjs_new_url(JSContext *ctx, ada_url url) {
    JSValue obj = JS_NewObjectClass(ctx, tjs_url_class_id);
    if (JS_IsException(obj)) {
        ada_free(url);
        return obj;
    }

    TJSURL *u = js_mallocz(ctx, sizeof(*u));
    if (!u) {
        ada_free(url);
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    u->url = url;
    u->search_params = JS_UNDEFINED;
    JS_SetOpaque(obj, u);
    return obj;
}

static JSValue tjs_url_constructor(JSContext *ctx, JSValue new_target, int argc, JSValue *argv) {
    const char *input = JS_ToCString(ctx, argv[0]);
    if (!input) {
        return JS_EXCEPTION;
    }

    ada_url url;
    if (argc > 1 && !JS_IsUndefined(argv[1])) {
        const char *base = JS_ToCString(ctx, argv[1]);
        if (!base) {
            JS_FreeCString(ctx, input);
            return JS_EXCEPTION;
        }
        url = ada_parse_with_base(input, strlen(input), base, strlen(base));
        JS_FreeCString(ctx, base);
    } else {
        url = ada_parse(input, strlen(input));
    }

    JS_FreeCString(ctx, input);

    if (!ada_is_valid(url)) {
        ada_free(url);
        return JS_ThrowTypeError(ctx, "Invalid URL");
    }

    return tjs_new_url(ctx, url);
}

/* Update the associated URLSearchParams when URL.search changes. */
static void tjs_url_sync_search_params(JSContext *ctx, TJSURL *u) {
    if (JS_IsUndefined(u->search_params)) {
        return;
    }

    /* Get current search string from URL and update the search params. */
    ada_string search = ada_get_search(u->url);
    /* Skip leading '?' if present. */
    const char *data = search.data;
    size_t len = search.length;
    if (len > 0 && data[0] == '?') {
        data++;
        len--;
    }

    TJSURLSearchParams *sp = JS_GetOpaque2(ctx, u->search_params, tjs_urlsearchparams_class_id);
    if (sp && sp->params) {
        ada_search_params_reset(sp->params, data, len);
    }
}

#define URL_GETTER(name)                                                                                               \
    static JSValue tjs_url_get_##name(JSContext *ctx, JSValue this_val) {                                              \
        TJSURL *u = tjs_url_get(ctx, this_val);                                                                        \
        if (!u)                                                                                                        \
            return JS_EXCEPTION;                                                                                       \
        ada_string s = ada_get_##name(u->url);                                                                         \
        return JS_NewStringLen(ctx, s.data, s.length);                                                                 \
    }

#define URL_SETTER_BOOL(name)                                                                                          \
    static JSValue tjs_url_set_##name(JSContext *ctx, JSValue this_val, JSValue val) {                                 \
        TJSURL *u = tjs_url_get(ctx, this_val);                                                                        \
        if (!u)                                                                                                        \
            return JS_EXCEPTION;                                                                                       \
        const char *str = JS_ToCString(ctx, val);                                                                      \
        if (!str)                                                                                                      \
            return JS_EXCEPTION;                                                                                       \
        ada_set_##name(u->url, str, strlen(str));                                                                      \
        JS_FreeCString(ctx, str);                                                                                      \
        return JS_UNDEFINED;                                                                                           \
    }

#define URL_SETTER_VOID(name)                                                                                          \
    static JSValue tjs_url_set_##name(JSContext *ctx, JSValue this_val, JSValue val) {                                 \
        TJSURL *u = tjs_url_get(ctx, this_val);                                                                        \
        if (!u)                                                                                                        \
            return JS_EXCEPTION;                                                                                       \
        const char *str = JS_ToCString(ctx, val);                                                                      \
        if (!str)                                                                                                      \
            return JS_EXCEPTION;                                                                                       \
        ada_set_##name(u->url, str, strlen(str));                                                                      \
        JS_FreeCString(ctx, str);                                                                                      \
        return JS_UNDEFINED;                                                                                           \
    }

URL_GETTER(href)
URL_GETTER(protocol)
URL_GETTER(username)
URL_GETTER(password)
URL_GETTER(host)
URL_GETTER(hostname)
URL_GETTER(port)
URL_GETTER(pathname)
URL_GETTER(hash)

static JSValue tjs_url_get_search(JSContext *ctx, JSValue this_val) {
    TJSURL *u = tjs_url_get(ctx, this_val);
    if (!u) {
        return JS_EXCEPTION;
    }
    ada_string s = ada_get_search(u->url);
    return JS_NewStringLen(ctx, s.data, s.length);
}

static JSValue tjs_url_get_origin(JSContext *ctx, JSValue this_val) {
    TJSURL *u = tjs_url_get(ctx, this_val);
    if (!u) {
        return JS_EXCEPTION;
    }
    ada_owned_string s = ada_get_origin(u->url);
    JSValue val = JS_NewStringLen(ctx, s.data, s.length);
    ada_free_owned_string(s);
    return val;
}

static JSValue tjs_url_set_href(JSContext *ctx, JSValue this_val, JSValue val) {
    TJSURL *u = tjs_url_get(ctx, this_val);
    if (!u) {
        return JS_EXCEPTION;
    }
    const char *str = JS_ToCString(ctx, val);
    if (!str) {
        return JS_EXCEPTION;
    }
    bool ok = ada_set_href(u->url, str, strlen(str));
    JS_FreeCString(ctx, str);
    if (!ok) {
        return JS_ThrowTypeError(ctx, "Invalid URL");
    }
    tjs_url_sync_search_params(ctx, u);
    return JS_UNDEFINED;
}

URL_SETTER_BOOL(protocol)
URL_SETTER_BOOL(username)
URL_SETTER_BOOL(password)
URL_SETTER_BOOL(host)
URL_SETTER_BOOL(hostname)
URL_SETTER_BOOL(port)
URL_SETTER_BOOL(pathname)

static JSValue tjs_url_set_search(JSContext *ctx, JSValue this_val, JSValue val) {
    TJSURL *u = tjs_url_get(ctx, this_val);
    if (!u) {
        return JS_EXCEPTION;
    }
    const char *str = JS_ToCString(ctx, val);
    if (!str) {
        return JS_EXCEPTION;
    }
    ada_set_search(u->url, str, strlen(str));
    JS_FreeCString(ctx, str);
    tjs_url_sync_search_params(ctx, u);
    return JS_UNDEFINED;
}

URL_SETTER_VOID(hash)

static JSValue tjs_url_get_searchParams(JSContext *ctx, JSValue this_val) {
    TJSURL *u = tjs_url_get(ctx, this_val);
    if (!u) {
        return JS_EXCEPTION;
    }

    if (JS_IsUndefined(u->search_params)) {
        ada_string search = ada_get_search(u->url);
        const char *data = search.data;
        size_t len = search.length;
        if (len > 0 && data[0] == '?') {
            data++;
            len--;
        }
        u->search_params = tjs_new_urlsearchparams_from_search(ctx, data, len, this_val);
        if (JS_IsException(u->search_params)) {
            u->search_params = JS_UNDEFINED;
            return JS_EXCEPTION;
        }
    }

    return JS_DupValue(ctx, u->search_params);
}

static JSValue tjs_url_toString(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    return tjs_url_get_href(ctx, this_val);
}

static JSValue tjs_url_toJSON(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    return tjs_url_get_href(ctx, this_val);
}

static JSValue tjs_url_canParse(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    const char *input = JS_ToCString(ctx, argv[0]);
    if (!input) {
        return JS_EXCEPTION;
    }

    bool result;
    if (argc > 1 && !JS_IsUndefined(argv[1])) {
        const char *base = JS_ToCString(ctx, argv[1]);
        if (!base) {
            JS_FreeCString(ctx, input);
            return JS_EXCEPTION;
        }
        result = ada_can_parse_with_base(input, strlen(input), base, strlen(base));
        JS_FreeCString(ctx, base);
    } else {
        result = ada_can_parse(input, strlen(input));
    }

    JS_FreeCString(ctx, input);
    return JS_NewBool(ctx, result);
}

static JSValue tjs_url_parse_static(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    const char *input = JS_ToCString(ctx, argv[0]);
    if (!input) {
        return JS_EXCEPTION;
    }

    ada_url url;
    if (argc > 1 && !JS_IsUndefined(argv[1])) {
        const char *base = JS_ToCString(ctx, argv[1]);
        if (!base) {
            JS_FreeCString(ctx, input);
            return JS_EXCEPTION;
        }
        url = ada_parse_with_base(input, strlen(input), base, strlen(base));
        JS_FreeCString(ctx, base);
    } else {
        url = ada_parse(input, strlen(input));
    }

    JS_FreeCString(ctx, input);

    if (!ada_is_valid(url)) {
        ada_free(url);
        return JS_NULL;
    }

    return tjs_new_url(ctx, url);
}

static const JSCFunctionListEntry tjs_url_proto_funcs[] = {
    TJS_CGETSET_DEF("href", tjs_url_get_href, tjs_url_set_href),
    TJS_CGETSET_DEF("origin", tjs_url_get_origin, NULL),
    TJS_CGETSET_DEF("protocol", tjs_url_get_protocol, tjs_url_set_protocol),
    TJS_CGETSET_DEF("username", tjs_url_get_username, tjs_url_set_username),
    TJS_CGETSET_DEF("password", tjs_url_get_password, tjs_url_set_password),
    TJS_CGETSET_DEF("host", tjs_url_get_host, tjs_url_set_host),
    TJS_CGETSET_DEF("hostname", tjs_url_get_hostname, tjs_url_set_hostname),
    TJS_CGETSET_DEF("port", tjs_url_get_port, tjs_url_set_port),
    TJS_CGETSET_DEF("pathname", tjs_url_get_pathname, tjs_url_set_pathname),
    TJS_CGETSET_DEF("search", tjs_url_get_search, tjs_url_set_search),
    TJS_CGETSET_DEF("searchParams", tjs_url_get_searchParams, NULL),
    TJS_CGETSET_DEF("hash", tjs_url_get_hash, tjs_url_set_hash),
    TJS_CFUNC_DEF("toString", 0, tjs_url_toString),
    TJS_CFUNC_DEF("toJSON", 0, tjs_url_toJSON),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "URL", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_url_static_funcs[] = {
    TJS_CFUNC_DEF("canParse", 1, tjs_url_canParse),
    TJS_CFUNC_DEF("parse", 1, tjs_url_parse_static),
};


/*
 * URLSearchParams
 */

static void tjs_urlsearchparams_finalizer(JSRuntime *rt, JSValue val) {
    TJSURLSearchParams *sp = JS_GetOpaque(val, tjs_urlsearchparams_class_id);
    if (sp) {
        if (sp->params) {
            ada_free_search_params(sp->params);
        }
        JS_FreeValueRT(rt, sp->url_obj);
        js_free_rt(rt, sp);
    }
}

static void tjs_urlsearchparams_gc_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSURLSearchParams *sp = JS_GetOpaque(val, tjs_urlsearchparams_class_id);
    if (sp) {
        JS_MarkValue(rt, sp->url_obj, mark_func);
    }
}

static JSClassDef tjs_urlsearchparams_class = {
    "URLSearchParams",
    .finalizer = tjs_urlsearchparams_finalizer,
    .gc_mark = tjs_urlsearchparams_gc_mark,
};

static TJSURLSearchParams *tjs_urlsp_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_urlsearchparams_class_id);
}

static JSValue tjs_new_urlsearchparams_from_search(JSContext *ctx, const char *search, size_t len, JSValue url_obj) {
    JSValue obj = JS_NewObjectClass(ctx, tjs_urlsearchparams_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSURLSearchParams *sp = js_mallocz(ctx, sizeof(*sp));
    if (!sp) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    sp->params = ada_parse_search_params(search, len);
    sp->url_obj = JS_DupValue(ctx, url_obj);
    JS_SetOpaque(obj, sp);
    return obj;
}

/* Sync URLSearchParams changes back to parent URL. */
static void tjs_urlsearchparams_sync_to_url(JSContext *ctx, JSValue sp_val) {
    TJSURLSearchParams *sp = JS_GetOpaque2(ctx, sp_val, tjs_urlsearchparams_class_id);
    if (!sp || JS_IsUndefined(sp->url_obj)) {
        return;
    }

    TJSURL *u = tjs_url_get(ctx, sp->url_obj);
    if (!u) {
        return;
    }

    ada_owned_string str = ada_search_params_to_string(sp->params);
    if (str.length == 0) {
        ada_clear_search(u->url);
    } else {
        ada_set_search(u->url, str.data, str.length);
    }
    ada_free_owned_string(str);
}

static JSValue tjs_urlsearchparams_constructor(JSContext *ctx, JSValue new_target, int argc, JSValue *argv) {
    const char *init_str = "";
    const char *init_str_orig = NULL; /* Original pointer for JS_FreeCString. */
    size_t init_len = 0;
    JSValue obj = JS_UNDEFINED;

    if (argc > 0 && !JS_IsUndefined(argv[0])) {
        /* Handle string input. */
        if (JS_IsString(argv[0])) {
            init_str_orig = JS_ToCStringLen(ctx, &init_len, argv[0]);
            if (!init_str_orig) {
                return JS_EXCEPTION;
            }
            init_str = init_str_orig;
            /* Skip leading '?' */
            if (init_len > 0 && init_str[0] == '?') {
                init_str++;
                init_len--;
            }
        } else if (JS_IsArray(argv[0])) {
            /* Handle array of pairs: [[key, value], ...] */
            JSValue len_val = JS_GetPropertyStr(ctx, argv[0], "length");
            int64_t len;
            JS_ToInt64(ctx, &len, len_val);
            JS_FreeValue(ctx, len_val);

            obj = JS_NewObjectClass(ctx, tjs_urlsearchparams_class_id);
            if (JS_IsException(obj)) {
                return obj;
            }

            TJSURLSearchParams *sp = js_mallocz(ctx, sizeof(*sp));
            if (!sp) {
                JS_FreeValue(ctx, obj);
                return JS_EXCEPTION;
            }
            sp->params = ada_parse_search_params("", 0);
            sp->url_obj = JS_UNDEFINED;
            JS_SetOpaque(obj, sp);

            for (int64_t i = 0; i < len; i++) {
                JSValue pair = JS_GetPropertyInt64(ctx, argv[0], i);
                JSValue key_val = JS_GetPropertyInt64(ctx, pair, 0);
                JSValue val_val = JS_GetPropertyInt64(ctx, pair, 1);
                const char *key = JS_ToCString(ctx, key_val);
                const char *val = JS_ToCString(ctx, val_val);
                if (key && val) {
                    ada_search_params_append(sp->params, key, strlen(key), val, strlen(val));
                }
                if (key) {
                    JS_FreeCString(ctx, key);
                }
                if (val) {
                    JS_FreeCString(ctx, val);
                }
                JS_FreeValue(ctx, key_val);
                JS_FreeValue(ctx, val_val);
                JS_FreeValue(ctx, pair);
            }
            return obj;
        } else if (JS_IsObject(argv[0])) {
            /* Check if it's a URLSearchParams instance. */
            TJSURLSearchParams *other = JS_GetOpaque(argv[0], tjs_urlsearchparams_class_id);
            if (other && other->params) {
                ada_owned_string str = ada_search_params_to_string(other->params);
                obj = JS_NewObjectClass(ctx, tjs_urlsearchparams_class_id);
                if (JS_IsException(obj)) {
                    ada_free_owned_string(str);
                    return obj;
                }
                TJSURLSearchParams *sp = js_mallocz(ctx, sizeof(*sp));
                if (!sp) {
                    ada_free_owned_string(str);
                    JS_FreeValue(ctx, obj);
                    return JS_EXCEPTION;
                }
                sp->params = ada_parse_search_params(str.data, str.length);
                sp->url_obj = JS_UNDEFINED;
                ada_free_owned_string(str);
                JS_SetOpaque(obj, sp);
                return obj;
            }

            /* Handle plain object: {key: value, ...} */
            JSPropertyEnum *props = NULL;
            uint32_t prop_count = 0;
            if (JS_GetOwnPropertyNames(ctx, &props, &prop_count, argv[0], JS_GPN_STRING_MASK | JS_GPN_ENUM_ONLY) < 0) {
                return JS_EXCEPTION;
            }

            obj = JS_NewObjectClass(ctx, tjs_urlsearchparams_class_id);
            if (JS_IsException(obj)) {
                js_free(ctx, props);
                return obj;
            }

            TJSURLSearchParams *sp = js_mallocz(ctx, sizeof(*sp));
            if (!sp) {
                js_free(ctx, props);
                JS_FreeValue(ctx, obj);
                return JS_EXCEPTION;
            }
            sp->params = ada_parse_search_params("", 0);
            sp->url_obj = JS_UNDEFINED;
            JS_SetOpaque(obj, sp);

            for (uint32_t i = 0; i < prop_count; i++) {
                JSValue val = JS_GetProperty(ctx, argv[0], props[i].atom);
                const char *key = JS_AtomToCString(ctx, props[i].atom);
                const char *val_str = JS_ToCString(ctx, val);
                if (key && val_str) {
                    ada_search_params_append(sp->params, key, strlen(key), val_str, strlen(val_str));
                }
                if (key) {
                    JS_FreeCString(ctx, key);
                }
                if (val_str) {
                    JS_FreeCString(ctx, val_str);
                }
                JS_FreeValue(ctx, val);
            }

            for (uint32_t i = 0; i < prop_count; i++) {
                JS_FreeAtom(ctx, props[i].atom);
            }
            js_free(ctx, props);
            return obj;
        }
    }

    /* Default: parse from string. */
    obj = JS_NewObjectClass(ctx, tjs_urlsearchparams_class_id);
    if (JS_IsException(obj)) {
        if (init_str_orig) {
            JS_FreeCString(ctx, init_str_orig);
        }
        return obj;
    }

    TJSURLSearchParams *sp = js_mallocz(ctx, sizeof(*sp));
    if (!sp) {
        if (init_str_orig) {
            JS_FreeCString(ctx, init_str_orig);
        }
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    sp->params = ada_parse_search_params(init_str, init_len);
    sp->url_obj = JS_UNDEFINED;
    if (init_str_orig) {
        JS_FreeCString(ctx, init_str_orig);
    }
    JS_SetOpaque(obj, sp);
    return obj;
}

static JSValue tjs_urlsearchparams_append(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSURLSearchParams *sp = tjs_urlsp_get(ctx, this_val);
    if (!sp) {
        return JS_EXCEPTION;
    }

    const char *key = JS_ToCString(ctx, argv[0]);
    if (!key) {
        return JS_EXCEPTION;
    }
    const char *val = JS_ToCString(ctx, argv[1]);
    if (!val) {
        JS_FreeCString(ctx, key);
        return JS_EXCEPTION;
    }

    ada_search_params_append(sp->params, key, strlen(key), val, strlen(val));
    JS_FreeCString(ctx, key);
    JS_FreeCString(ctx, val);
    tjs_urlsearchparams_sync_to_url(ctx, this_val);
    return JS_UNDEFINED;
}

static JSValue tjs_urlsearchparams_delete(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSURLSearchParams *sp = tjs_urlsp_get(ctx, this_val);
    if (!sp) {
        return JS_EXCEPTION;
    }

    const char *key = JS_ToCString(ctx, argv[0]);
    if (!key) {
        return JS_EXCEPTION;
    }

    if (argc > 1 && !JS_IsUndefined(argv[1])) {
        const char *val = JS_ToCString(ctx, argv[1]);
        if (!val) {
            JS_FreeCString(ctx, key);
            return JS_EXCEPTION;
        }
        ada_search_params_remove_value(sp->params, key, strlen(key), val, strlen(val));
        JS_FreeCString(ctx, val);
    } else {
        ada_search_params_remove(sp->params, key, strlen(key));
    }

    JS_FreeCString(ctx, key);
    tjs_urlsearchparams_sync_to_url(ctx, this_val);
    return JS_UNDEFINED;
}

static JSValue tjs_urlsearchparams_get_method(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSURLSearchParams *sp = tjs_urlsp_get(ctx, this_val);
    if (!sp) {
        return JS_EXCEPTION;
    }

    const char *key = JS_ToCString(ctx, argv[0]);
    if (!key) {
        return JS_EXCEPTION;
    }

    if (!ada_search_params_has(sp->params, key, strlen(key))) {
        JS_FreeCString(ctx, key);
        return JS_NULL;
    }

    ada_string val = ada_search_params_get(sp->params, key, strlen(key));
    JS_FreeCString(ctx, key);
    return JS_NewStringLen(ctx, val.data, val.length);
}

static JSValue tjs_urlsearchparams_getAll(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSURLSearchParams *sp = tjs_urlsp_get(ctx, this_val);
    if (!sp) {
        return JS_EXCEPTION;
    }

    const char *key = JS_ToCString(ctx, argv[0]);
    if (!key) {
        return JS_EXCEPTION;
    }

    ada_strings strs = ada_search_params_get_all(sp->params, key, strlen(key));
    JS_FreeCString(ctx, key);

    size_t len = ada_strings_size(strs);
    JSValue arr = JS_NewArray(ctx);
    for (size_t i = 0; i < len; i++) {
        ada_string s = ada_strings_get(strs, i);
        JS_SetPropertyUint32(ctx, arr, i, JS_NewStringLen(ctx, s.data, s.length));
    }
    ada_free_strings(strs);
    return arr;
}

static JSValue tjs_urlsearchparams_has(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSURLSearchParams *sp = tjs_urlsp_get(ctx, this_val);
    if (!sp) {
        return JS_EXCEPTION;
    }

    const char *key = JS_ToCString(ctx, argv[0]);
    if (!key) {
        return JS_EXCEPTION;
    }

    bool result;
    if (argc > 1 && !JS_IsUndefined(argv[1])) {
        const char *val = JS_ToCString(ctx, argv[1]);
        if (!val) {
            JS_FreeCString(ctx, key);
            return JS_EXCEPTION;
        }
        result = ada_search_params_has_value(sp->params, key, strlen(key), val, strlen(val));
        JS_FreeCString(ctx, val);
    } else {
        result = ada_search_params_has(sp->params, key, strlen(key));
    }

    JS_FreeCString(ctx, key);
    return JS_NewBool(ctx, result);
}

static JSValue tjs_urlsearchparams_set(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSURLSearchParams *sp = tjs_urlsp_get(ctx, this_val);
    if (!sp) {
        return JS_EXCEPTION;
    }

    const char *key = JS_ToCString(ctx, argv[0]);
    if (!key) {
        return JS_EXCEPTION;
    }
    const char *val = JS_ToCString(ctx, argv[1]);
    if (!val) {
        JS_FreeCString(ctx, key);
        return JS_EXCEPTION;
    }

    ada_search_params_set(sp->params, key, strlen(key), val, strlen(val));
    JS_FreeCString(ctx, key);
    JS_FreeCString(ctx, val);
    tjs_urlsearchparams_sync_to_url(ctx, this_val);
    return JS_UNDEFINED;
}

static JSValue tjs_urlsearchparams_sort(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSURLSearchParams *sp = tjs_urlsp_get(ctx, this_val);
    if (!sp) {
        return JS_EXCEPTION;
    }

    ada_search_params_sort(sp->params);
    tjs_urlsearchparams_sync_to_url(ctx, this_val);
    return JS_UNDEFINED;
}

static JSValue tjs_urlsearchparams_toString(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSURLSearchParams *sp = tjs_urlsp_get(ctx, this_val);
    if (!sp) {
        return JS_EXCEPTION;
    }

    ada_owned_string str = ada_search_params_to_string(sp->params);
    JSValue val = JS_NewStringLen(ctx, str.data, str.length);
    ada_free_owned_string(str);
    return val;
}

static JSValue tjs_urlsearchparams_entries(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSURLSearchParams *sp = tjs_urlsp_get(ctx, this_val);
    if (!sp) {
        return JS_EXCEPTION;
    }

    ada_url_search_params_entries_iter iter = ada_search_params_get_entries(sp->params);
    JSValue arr = JS_NewArray(ctx);
    uint32_t idx = 0;
    while (ada_search_params_entries_iter_has_next(iter)) {
        ada_string_pair pair = ada_search_params_entries_iter_next(iter);
        JSValue entry = JS_NewArray(ctx);
        JS_SetPropertyUint32(ctx, entry, 0, JS_NewStringLen(ctx, pair.key.data, pair.key.length));
        JS_SetPropertyUint32(ctx, entry, 1, JS_NewStringLen(ctx, pair.value.data, pair.value.length));
        JS_SetPropertyUint32(ctx, arr, idx++, entry);
    }
    ada_free_search_params_entries_iter(iter);
    return arr;
}

static JSValue tjs_urlsearchparams_keys(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSURLSearchParams *sp = tjs_urlsp_get(ctx, this_val);
    if (!sp) {
        return JS_EXCEPTION;
    }

    ada_url_search_params_keys_iter iter = ada_search_params_get_keys(sp->params);
    JSValue arr = JS_NewArray(ctx);
    uint32_t idx = 0;
    while (ada_search_params_keys_iter_has_next(iter)) {
        ada_string key = ada_search_params_keys_iter_next(iter);
        JS_SetPropertyUint32(ctx, arr, idx++, JS_NewStringLen(ctx, key.data, key.length));
    }
    ada_free_search_params_keys_iter(iter);
    return arr;
}

static JSValue tjs_urlsearchparams_values(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSURLSearchParams *sp = tjs_urlsp_get(ctx, this_val);
    if (!sp) {
        return JS_EXCEPTION;
    }

    ada_url_search_params_values_iter iter = ada_search_params_get_values(sp->params);
    JSValue arr = JS_NewArray(ctx);
    uint32_t idx = 0;
    while (ada_search_params_values_iter_has_next(iter)) {
        ada_string val = ada_search_params_values_iter_next(iter);
        JS_SetPropertyUint32(ctx, arr, idx++, JS_NewStringLen(ctx, val.data, val.length));
    }
    ada_free_search_params_values_iter(iter);
    return arr;
}

static JSValue tjs_urlsearchparams_forEach(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSURLSearchParams *sp = tjs_urlsp_get(ctx, this_val);
    if (!sp) {
        return JS_EXCEPTION;
    }

    JSValue callback = argv[0];
    JSValue this_arg = argc > 1 ? argv[1] : JS_UNDEFINED;

    ada_url_search_params_entries_iter iter = ada_search_params_get_entries(sp->params);
    while (ada_search_params_entries_iter_has_next(iter)) {
        ada_string_pair pair = ada_search_params_entries_iter_next(iter);
        JSValue args[3];
        args[0] = JS_NewStringLen(ctx, pair.value.data, pair.value.length);
        args[1] = JS_NewStringLen(ctx, pair.key.data, pair.key.length);
        args[2] = JS_DupValue(ctx, this_val);
        JSValue ret = JS_Call(ctx, callback, this_arg, 3, args);
        JS_FreeValue(ctx, args[0]);
        JS_FreeValue(ctx, args[1]);
        JS_FreeValue(ctx, args[2]);
        if (JS_IsException(ret)) {
            ada_free_search_params_entries_iter(iter);
            return JS_EXCEPTION;
        }
        JS_FreeValue(ctx, ret);
    }
    ada_free_search_params_entries_iter(iter);
    return JS_UNDEFINED;
}

static JSValue tjs_urlsearchparams_get_size(JSContext *ctx, JSValue this_val) {
    TJSURLSearchParams *sp = tjs_urlsp_get(ctx, this_val);
    if (!sp) {
        return JS_EXCEPTION;
    }
    return JS_NewUint32(ctx, (uint32_t) ada_search_params_size(sp->params));
}

static const JSCFunctionListEntry tjs_urlsearchparams_proto_funcs[] = {
    TJS_CFUNC_DEF("append", 2, tjs_urlsearchparams_append),
    TJS_CFUNC_DEF("delete", 1, tjs_urlsearchparams_delete),
    TJS_CFUNC_DEF("get", 1, tjs_urlsearchparams_get_method),
    TJS_CFUNC_DEF("getAll", 1, tjs_urlsearchparams_getAll),
    TJS_CFUNC_DEF("has", 1, tjs_urlsearchparams_has),
    TJS_CFUNC_DEF("set", 2, tjs_urlsearchparams_set),
    TJS_CFUNC_DEF("sort", 0, tjs_urlsearchparams_sort),
    TJS_CFUNC_DEF("toString", 0, tjs_urlsearchparams_toString),
    TJS_CFUNC_DEF("entries", 0, tjs_urlsearchparams_entries),
    TJS_CFUNC_DEF("keys", 0, tjs_urlsearchparams_keys),
    TJS_CFUNC_DEF("values", 0, tjs_urlsearchparams_values),
    TJS_CFUNC_DEF("forEach", 1, tjs_urlsearchparams_forEach),
    TJS_CGETSET_DEF("size", tjs_urlsearchparams_get_size, NULL),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "URLSearchParams", JS_PROP_CONFIGURABLE),
};


/*
 * Module init
 */

void tjs__mod_url_init(JSContext *ctx, JSValue ns) {
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSValue proto, obj;

    /* URL */
    JS_NewClassID(rt, &tjs_url_class_id);
    JS_NewClass(rt, tjs_url_class_id, &tjs_url_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_url_proto_funcs, countof(tjs_url_proto_funcs));
    obj = JS_NewCFunction2(ctx, tjs_url_constructor, "URL", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, obj, tjs_url_static_funcs, countof(tjs_url_static_funcs));
    JS_SetConstructor(ctx, obj, proto);
    JS_SetClassProto(ctx, tjs_url_class_id, proto);
    JS_DefinePropertyValueStr(ctx, ns, "URL", obj, JS_PROP_C_W_E);

    /* URLSearchParams */
    JS_NewClassID(rt, &tjs_urlsearchparams_class_id);
    JS_NewClass(rt, tjs_urlsearchparams_class_id, &tjs_urlsearchparams_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_urlsearchparams_proto_funcs, countof(tjs_urlsearchparams_proto_funcs));
    obj = JS_NewCFunction2(ctx, tjs_urlsearchparams_constructor, "URLSearchParams", 0, JS_CFUNC_constructor, 0);
    JS_SetConstructor(ctx, obj, proto);
    JS_SetClassProto(ctx, tjs_urlsearchparams_class_id, proto);
    JS_DefinePropertyValueStr(ctx, ns, "URLSearchParams", obj, JS_PROP_C_W_E);
}

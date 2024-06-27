/*
 * txiki.js
 *
 * Copyright (c) 2022-present Saúl Ibarra Corretgé <s@saghul.net>
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

#include "curl-utils.h"
#include "curl-websocket.h"
#include "private.h"

enum { WS_EVENT_CLOSE = 0, WS_EVENT_ERROR, WS_EVENT_MESSAGE, WS_EVENT_OPEN, WS_EVENT_MAX };

enum { WS_STATE_CONNECTING = 0, WS_STATE_OPEN, WS_STATE_CLOSING, WS_STATE_CLOSED };

typedef struct {
    JSContext *ctx;
    JSValue events[WS_EVENT_MAX];
    CURL *curl_h;
    CURLM *curlm_h;
    unsigned short ready_state;
    struct cws_callbacks ws_callbacks;
} TJSWs;

static JSClassID tjs_ws_class_id;

static void tjs_ws_finalizer(JSRuntime *rt, JSValue val) {
    TJSWs *w = JS_GetOpaque(val, tjs_ws_class_id);
    if (w) {
        if (w->curl_h) {
            curl_multi_remove_handle(w->curlm_h, w->curl_h);
            cws_free(w->curl_h);
        }
        for (int i = 0; i < WS_EVENT_MAX; i++)
            JS_FreeValueRT(rt, w->events[i]);
        js_free_rt(rt, w);
    }
}

static void tjs_ws_mark(JSRuntime *rt, JSValue val, JS_MarkFunc *mark_func) {
    TJSWs *w = JS_GetOpaque(val, tjs_ws_class_id);
    if (w) {
        for (int i = 0; i < WS_EVENT_MAX; i++)
            JS_MarkValue(rt, w->events[i], mark_func);
    }
}

static JSClassDef tjs_ws_class = {
    "WebSocket",
    .finalizer = tjs_ws_finalizer,
    .gc_mark = tjs_ws_mark,
};

static TJSWs *tjs_ws_get(JSContext *ctx, JSValue obj) {
    return JS_GetOpaque2(ctx, obj, tjs_ws_class_id);
}

static void maybe_emit_event(TJSWs *w, int event, JSValue arg) {
    JSContext *ctx = w->ctx;
    JSValue event_func = w->events[event];
    if (!JS_IsFunction(ctx, event_func)) {
        JS_FreeValue(ctx, arg);
        return;
    }

    tjs_call_handler(ctx, event_func, 1, &arg);

    JS_FreeValue(ctx, arg);
}

static void cws__on_connect(void *data, CURL *easy, const char *websocket_protocols) {
    TJSWs *w = (TJSWs *) data;

    w->ready_state = WS_STATE_OPEN;

    JSValue v = JS_NewString(w->ctx, websocket_protocols ? websocket_protocols : "");
    maybe_emit_event(w, WS_EVENT_OPEN, v);
}

static void cws__on_text(void *data, CURL *easy, const char *text, size_t len) {
    TJSWs *w = (TJSWs *) data;

    JSValue v = JS_NewStringLen(w->ctx, text, len);
    maybe_emit_event(w, WS_EVENT_MESSAGE, v);
}

static void cws__on_binary(void *data, CURL *easy, const void *mem, size_t len) {
    TJSWs *w = (TJSWs *) data;

    JSValue v = JS_NewArrayBufferCopy(w->ctx, mem, len);
    maybe_emit_event(w, WS_EVENT_MESSAGE, v);
}

static void cws__on_close(void *data,
                          CURL *easy,
                          enum cws_close_reason reason,
                          const char *reason_text,
                          size_t reason_text_len) {
    TJSWs *w = (TJSWs *) data;

    w->ready_state = WS_STATE_CLOSED;

    JSContext *ctx = w->ctx;
    JSValue event = JS_NewObjectProto(ctx, JS_NULL);
    JS_DefinePropertyValueStr(ctx, event, "code", JS_NewInt32(ctx, reason), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, event, "reason", JS_NewStringLen(ctx, reason_text, reason_text_len), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx,
                              event,
                              "wasClean",
                              JS_NewBool(ctx, reason == CWS_CLOSE_REASON_NORMAL),
                              JS_PROP_C_W_E);

    maybe_emit_event(w, WS_EVENT_CLOSE, event);
}

static JSValue tjs_ws_constructor(JSContext *ctx, JSValue new_target, int argc, JSValue *argv) {
    JSValue obj = JS_NewObjectClass(ctx, tjs_ws_class_id);
    if (JS_IsException(obj))
        return obj;

    TJSWs *w = js_mallocz(ctx, sizeof(*w));
    if (!w) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    const char *url = JS_ToCString(ctx, argv[0]);
    const char *protocols = JS_IsNull(argv[1]) ? NULL : JS_ToCString(ctx, argv[1]);

    w->ctx = ctx;

    for (int i = 0; i < WS_EVENT_MAX; i++) {
        w->events[i] = JS_UNDEFINED;
    }

    w->ws_callbacks.on_binary = &cws__on_binary;
    w->ws_callbacks.on_close = &cws__on_close;
    w->ws_callbacks.on_connect = &cws__on_connect;
    w->ws_callbacks.on_text = &cws__on_text;
    w->ws_callbacks.data = w;

    w->curlm_h = tjs__get_curlm(ctx);
    w->curl_h = tjs__curl_easy_init(cws_new(url, protocols, &(w->ws_callbacks)));

    JS_FreeCString(ctx, url);
    JS_FreeCString(ctx, protocols);

    curl_multi_add_handle(w->curlm_h, w->curl_h);

    w->ready_state = WS_STATE_CONNECTING;

    JS_SetOpaque(obj, w);
    return obj;
}

static JSValue tjs_ws_event_get(JSContext *ctx, JSValue this_val, int magic) {
    TJSWs *w = tjs_ws_get(ctx, this_val);
    if (!w)
        return JS_EXCEPTION;
    return JS_DupValue(ctx, w->events[magic]);
}

static JSValue tjs_ws_event_set(JSContext *ctx, JSValue this_val, JSValue value, int magic) {
    TJSWs *w = tjs_ws_get(ctx, this_val);
    if (!w)
        return JS_EXCEPTION;
    if (JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value)) {
        JS_FreeValue(ctx, w->events[magic]);
        w->events[magic] = JS_DupValue(ctx, value);
    }
    return JS_UNDEFINED;
}

static JSValue tjs_ws_readystate_get(JSContext *ctx, JSValue this_val) {
    TJSWs *w = tjs_ws_get(ctx, this_val);
    if (!w)
        return JS_EXCEPTION;
    return JS_NewInt32(ctx, w->ready_state);
}

static JSValue tjs_ws_close(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWs *w = tjs_ws_get(ctx, this_val);
    if (!w)
        return JS_EXCEPTION;

    if (w->ready_state < WS_STATE_CLOSING) {
        int code;
        JS_ToInt32(ctx, &code, argv[0]);
        size_t len;
        const char *reason = JS_ToCStringLen(ctx, &len, argv[1]);
        cws_close(w->curl_h, code, reason, len);
        JS_FreeCString(ctx, reason);
        w->ready_state = WS_STATE_CLOSING;
    }

    return JS_UNDEFINED;
}

static JSValue tjs_ws_sendBinary(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWs *w = tjs_ws_get(ctx, this_val);
    if (!w)
        return JS_EXCEPTION;

    if (w->ready_state == WS_STATE_OPEN) {
        size_t size;
        uint8_t *buf = JS_GetArrayBuffer(ctx, &size, argv[0]);
        if (!buf)
            return JS_EXCEPTION;

        uint64_t off;
        if (JS_ToIndex(ctx, &off, argv[1]))
            return JS_EXCEPTION;

        uint64_t len;
        if (JS_ToIndex(ctx, &len, argv[2]))
            return JS_EXCEPTION;

        cws_send_binary(w->curl_h, buf + off, len);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_ws_sendText(JSContext *ctx, JSValue this_val, int argc, JSValue *argv) {
    TJSWs *w = tjs_ws_get(ctx, this_val);
    if (!w)
        return JS_EXCEPTION;

    if (w->ready_state == WS_STATE_OPEN) {
        const char *text = JS_ToCString(ctx, argv[0]);
        cws_send_text(w->curl_h, text);
        JS_FreeCString(ctx, text);
    }

    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_ws_class_funcs[] = {
    JS_PROP_INT32_DEF("CONNECTING", WS_STATE_CONNECTING, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("OPEN", WS_STATE_OPEN, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("CLOSING", WS_STATE_CLOSING, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("CLOSED", WS_STATE_CLOSED, JS_PROP_ENUMERABLE),
};

static const JSCFunctionListEntry tjs_ws_proto_funcs[] = {
    JS_CGETSET_MAGIC_DEF("onclose", tjs_ws_event_get, tjs_ws_event_set, WS_EVENT_CLOSE),
    JS_CGETSET_MAGIC_DEF("onerror", tjs_ws_event_get, tjs_ws_event_set, WS_EVENT_ERROR),
    JS_CGETSET_MAGIC_DEF("onmessage", tjs_ws_event_get, tjs_ws_event_set, WS_EVENT_MESSAGE),
    JS_CGETSET_MAGIC_DEF("onopen", tjs_ws_event_get, tjs_ws_event_set, WS_EVENT_OPEN),
    JS_CGETSET_DEF("readyState", tjs_ws_readystate_get, NULL),
    TJS_CFUNC_DEF("close", 2, tjs_ws_close),
    TJS_CFUNC_DEF("sendBinary", 1, tjs_ws_sendBinary),
    TJS_CFUNC_DEF("sendText", 1, tjs_ws_sendText),
};

void tjs__mod_ws_init(JSContext *ctx, JSValue ns) {
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSValue proto, obj;

    /* WebSocket class */
    JS_NewClassID(rt, &tjs_ws_class_id);
    JS_NewClass(rt, tjs_ws_class_id, &tjs_ws_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_ws_proto_funcs, countof(tjs_ws_proto_funcs));
    JS_SetClassProto(ctx, tjs_ws_class_id, proto);

    /* WebSocket object */
    obj = JS_NewCFunction2(ctx, tjs_ws_constructor, "WebSocket", 2, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, obj, tjs_ws_class_funcs, countof(tjs_ws_class_funcs));
    JS_DefinePropertyValueStr(ctx, ns, "WebSocket", obj, JS_PROP_C_W_E);
}

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

#include "private.h"
#include "utils.h"

typedef struct {
    uv_fs_event_t handle;
    JSContext* ctx;
    JSValue callback;
    int closed;
    int finalized;
} TJSFsWatch;

static JSClassID tjs_fswatch_class_id;

static TJSFsWatch *tjs_fswatch_get(JSValueConst obj) {
    return JS_GetOpaque(obj, tjs_fswatch_class_id);
}

static void uv__fsevent_close_cb(uv_handle_t *handle) {
    TJSFsWatch *fw = handle->data;
    if (fw) {
        fw->closed = 1;
        if (fw->finalized)
            free(fw);
    }
}

static void maybe_close(TJSFsWatch *fw) {
    if (!uv_is_closing((uv_handle_t *) &fw->handle))
        uv_close((uv_handle_t *) &fw->handle, uv__fsevent_close_cb);
}

static void tjs_fswatch_finalizer(JSRuntime *rt, JSValue val) {
    TJSFsWatch *fw = tjs_fswatch_get(val);
    if (fw) {
        JS_FreeValueRT(rt, fw->callback);
        fw->finalized = 1;
        if (fw->closed)
            free(fw);
        else
            maybe_close(fw);
    }
}

static void tjs_fswatch_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    TJSFsWatch *fw = tjs_fswatch_get(val);
    if (fw) {
        JS_MarkValue(rt, fw->callback, mark_func);
    }
}

static JSClassDef tjs_fswatch_class = {
    "FsWatcher",
    .finalizer = tjs_fswatch_finalizer,
    .gc_mark = tjs_fswatch_mark,
};

static JSValue tjs_fswatch_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSFsWatch *fw = tjs_fswatch_get(this_val);
    if (!fw)
        return JS_EXCEPTION;
    maybe_close(fw);
    return JS_UNDEFINED;
}

static JSValue tjs_fswatch_path_get(JSContext *ctx, JSValueConst this_val) {
    TJSFsWatch *fw = tjs_fswatch_get(this_val);
    if (!fw)
        return JS_UNDEFINED;

    char buf[1024];
    size_t size = sizeof(buf);
    char *dbuf = buf;
    int r;

    r = uv_fs_event_getpath(&fw->handle, dbuf, &size);
    if (r != 0) {
        if (r != UV_ENOBUFS)
            return tjs_throw_errno(ctx, r);
        dbuf = js_malloc(ctx, size);
        if (!dbuf)
            return JS_EXCEPTION;
        uv_fs_event_getpath(&fw->handle, dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            return tjs_throw_errno(ctx, r);
        }
    }

    JSValue ret = JS_NewStringLen(ctx, dbuf, size);

    if (dbuf != buf)
        js_free(ctx, dbuf);

    return ret;
}

static void uv__fs_event_cb(uv_fs_event_t* handle, const char* filename, int events, int status) {
    TJSFsWatch *fw = handle->data;
    CHECK_NOT_NULL(fw);
    JSContext *ctx = fw->ctx;

    // TODO: handle error case?
    if (status != 0)
        return;

    // libuv could set both, if we get rename, ignroe change.

    JSValue event;
    if (events & UV_RENAME) {
        event = JS_NewString(ctx, "rename");
    } else if (events & UV_CHANGE) {
        event = JS_NewString(ctx, "change");
    } else {
        // This shouldn't happen.
        CHECK(0 && "invalid fs events");
    }

    JSValue args[2] = {
        JS_NewString(ctx, filename),
        event,
    };

    tjs_call_handler(ctx, fw->callback, countof(args), args);

    JS_FreeValue(ctx, args[0]);
    JS_FreeValue(ctx, args[1]);
}

static JSValue tjs_fs_watch(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    if (!JS_IsFunction(ctx, argv[1])) {
        JS_FreeCString(ctx, path);
        return JS_ThrowTypeError(ctx, "no callback function provided");
    }

    JSValue obj = JS_NewObjectClass(ctx, tjs_fswatch_class_id);
    if (JS_IsException(obj)) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    TJSFsWatch *fw = calloc(1, sizeof(*fw));
    if (!fw) {
        JS_FreeCString(ctx, path);
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    int r = uv_fs_event_init(tjs_get_loop(ctx), &fw->handle);
    if (r != 0) {
        JS_FreeCString(ctx, path);
        JS_FreeValue(ctx, obj);
        free(fw);
        return JS_ThrowInternalError(ctx, "couldn't initialize handle");
    }
    
    r = uv_fs_event_start(&fw->handle, uv__fs_event_cb, path, UV_FS_EVENT_RECURSIVE);
    if (r != 0) {
        JS_FreeCString(ctx, path);
        JS_FreeValue(ctx, obj);
        free(fw);
        return tjs_throw_errno(ctx, r);
    }

    JS_FreeCString(ctx, path);

    fw->ctx = ctx;
    fw->handle.data = fw;
    fw->callback = JS_DupValue(ctx, argv[1]);

    JS_SetOpaque(obj, fw);
    return obj;
}

static const JSCFunctionListEntry tjs_fswatch_proto_funcs[] = {
    TJS_CFUNC_DEF("close", 0, tjs_fswatch_close),
    JS_CGETSET_DEF("path", tjs_fswatch_path_get, NULL),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "FsWatcher", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_fswatch_funcs[] = {
    TJS_CFUNC_DEF("watch", 2, tjs_fs_watch),
};

void tjs__mod_fswatch_init(JSContext *ctx, JSValue ns) {
    JS_NewClassID(&tjs_fswatch_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_fswatch_class_id, &tjs_fswatch_class);
    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_fswatch_proto_funcs, countof(tjs_fswatch_proto_funcs));
    JS_SetClassProto(ctx, tjs_fswatch_class_id, proto);

    JS_SetPropertyFunctionList(ctx, ns, tjs_fswatch_funcs, countof(tjs_fswatch_funcs));
}

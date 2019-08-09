/*
 * QuickJS libuv bindings
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

#include "../cutils.h"
#include "error.h"
#include "fs.h"
#include "utils.h"


static JSClassID js_uv_file_class_id;

typedef struct {
    JSContext *ctx;
    uv_file fd;
} JSUVFile;

static void js_uv_file_finalizer(JSRuntime *rt, JSValue val) {
    JSUVFile *f = JS_GetOpaque(val, js_uv_file_class_id);
    if (f) {
        if (f->fd != -1) {
            uv_fs_t req;
            uv_fs_close(NULL, &req, f->fd, NULL);
            uv_fs_req_cleanup(&req);
        }
        JSContext *ctx = f->ctx;
        js_free(ctx, f);
    }
}

static JSClassDef js_uv_file_class = {
    "File",
    .finalizer = js_uv_file_finalizer,
};

typedef struct {
    uv_fs_t req;
    JSContext *ctx;
    JSValue obj;
    struct {
        JSValue promise;
        JSValue resolving_funcs[2];
    } result;
    struct {
        JSValue buf;
    } rw;
} JSUVFsReq;

static JSValue js_new_uv_file(JSContext *ctx, uv_file fd) {
    JSUVFile *f;
    JSValue obj;

    obj = JS_NewObjectClass(ctx, js_uv_file_class_id);
    if (JS_IsException(obj))
        return obj;

    f = js_malloc(ctx, sizeof(*f));
    if (!f) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    f->ctx = ctx;
    f->fd = fd;

    JS_SetOpaque(obj, f);

    return obj;
}

static JSUVFile *js_uv_file_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, js_uv_file_class_id);
}

static void js_uv_fsreq_init(JSContext *ctx, JSUVFsReq *fr, JSValue obj) {
    fr->ctx = ctx;
    fr->req.data = fr;

    if (JS_IsUndefined(obj))
        fr->obj = JS_UNDEFINED;
    else
        fr->obj = JS_DupValue(ctx, obj);

    fr->rw.buf = JS_UNDEFINED;

    JSValue promise = JS_NewPromiseCapability(ctx, fr->result.resolving_funcs);
    fr->result.promise = JS_DupValue(ctx, promise);
}

static void uv__fs_req_cb(uv_fs_t* req) {
    JSUVFsReq *fr = req->data;
    if (!fr)
        return;

    JSContext *ctx = fr->ctx;
    JSValue ret;

    if (fr->req.result < 0) {
        JSValue error = js_new_uv_error(ctx, fr->req.result);
        ret = JS_Call(ctx, fr->result.resolving_funcs[1], JS_UNDEFINED, 1, (JSValueConst *)&error);
        JS_FreeValue(ctx, error);

        goto end;
    }

    JSValue arg;
    JSUVFile *f;

    switch (fr->req.fs_type) {
    case UV_FS_OPEN:
        arg = js_new_uv_file(ctx, fr->req.result);
        break;
    case UV_FS_CLOSE:
        arg = JS_UNDEFINED;
        f = js_uv_file_get(ctx, fr->obj);
        if (f)
            f->fd = -1;
        break;
    case UV_FS_READ:
    case UV_FS_WRITE:
        arg = JS_NewInt32(ctx, fr->req.result);
        break;

    default:
        abort();
    }

    uv_fs_req_cleanup(&fr->req);

    ret = JS_Call(ctx, fr->result.resolving_funcs[0], JS_UNDEFINED, 1, (JSValueConst *)&arg);

end:
        JS_FreeValue(ctx, ret); /* XXX: what to do if exception ? */

        JS_FreeValue(ctx, fr->result.promise);
        JS_FreeValue(ctx, fr->result.resolving_funcs[0]);
        JS_FreeValue(ctx, fr->result.resolving_funcs[1]);
        JS_FreeValue(ctx, fr->obj);
        JS_FreeValue(ctx, fr->rw.buf);

        js_free(ctx, fr);
}

static JSValue js_uv_file_rw(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv, int magic) {
    JSUVFile *f = js_uv_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    uv_loop_t *loop = js_uv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    JSUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    /* arg 0: buffer */
    size_t size;
    uint8_t *buf = JS_GetArrayBuffer(ctx, &size, argv[0]);
    if (!buf)
        return JS_EXCEPTION;
    
    /* arg 1: offset (within the buffer) */
    uint64_t off;
    if (JS_IsUndefined(argv[1]))
        off = 0;
    else if (JS_ToIndex(ctx, &off, argv[1]))
        return JS_EXCEPTION;

    /* arg 2: buffer length */
    uint64_t len;
    if (JS_IsUndefined(argv[2]))
        len = size;
    else if (JS_ToIndex(ctx, &len, argv[2]))
       return JS_EXCEPTION;

    if (off + len > size)
        return JS_ThrowRangeError(ctx, "read/write array buffer overflow");

    /* arg 3: position (on the file) */
    uint64_t pos;
    if (JS_IsUndefined(argv[3]))
        pos = 0;
    else if (JS_ToIndex(ctx, &pos, argv[3]))
        return JS_EXCEPTION;

    uv_buf_t b = uv_buf_init((char*) buf + off, len);

    int r;
    UV_EXTERN int uv_fs_read(uv_loop_t* loop,
                         uv_fs_t* req,
                         uv_file file,
                         const uv_buf_t bufs[],
                         unsigned int nbufs,
                         int64_t offset,
                         uv_fs_cb cb);
    if (magic)
        r = uv_fs_write(loop, &fr->req, f->fd, &b, 1, pos, uv__fs_req_cb);
    else
        r = uv_fs_read(loop, &fr->req, f->fd, &b, 1, pos, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return js_uv_throw_errno(ctx, r);
    }

    js_uv_fsreq_init(ctx, fr, this_val);
    fr->rw.buf = JS_DupValue(ctx, argv[0]);
    return fr->result.promise;
}

static JSValue js_uv_file_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    JSUVFile *f = js_uv_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    uv_loop_t *loop = js_uv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    JSUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_close(loop, &fr->req, f->fd, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return js_uv_throw_errno(ctx, r);
    }

    js_uv_fsreq_init(ctx, fr, this_val);
    return fr->result.promise;
}

static JSValue js_uv_file_fileno(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    JSUVFile *f = js_uv_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    return JS_NewInt32(ctx, f->fd);
}

static int js__uv_open_flags(const char *strflags, int len) {
    int flags = 0, read = 0, write = 0;

    for (int i = 0; i < len; i++) {
        switch (strflags[i]) {
        case 'r':
            read = 1;
            break;
        case 'w':
            write = 1;
            flags |= O_TRUNC | O_CREAT;
            break;
        case 'a':
            write = 1;
            flags |= O_APPEND | O_CREAT;
            break;
        case '+':
            read = 1;
            write = 1;
            break;
        case 'x':
            flags |= O_EXCL;
            break;
        default:
            break;
        }
    }

    flags |= read ? (write ? O_RDWR : O_RDONLY) : (write ? O_WRONLY : 0);

    return flags;
}

static JSValue js_uv_fs_open(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path;
    const char *strflags;
    int flags, len;
    int32_t mode;
    uv_loop_t *loop;

    loop = js_uv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;
    strflags = JS_ToCStringLen(ctx, &len, argv[1], 0);
    if (!strflags)
        return JS_EXCEPTION;
    flags = js__uv_open_flags(strflags, len);
    if (JS_ToInt32(ctx, &mode, argv[2]))
        return JS_EXCEPTION;

    JSUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_open(loop, &fr->req, path, flags, mode, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return js_uv_throw_errno(ctx, r);
    }

    js_uv_fsreq_init(ctx, fr, JS_UNDEFINED);
    return fr->result.promise;
}

static const JSCFunctionListEntry js_uv_file_proto_funcs[] = {
    JS_CFUNC_MAGIC_DEF("read", 4, js_uv_file_rw, 0 ),
    JS_CFUNC_MAGIC_DEF("write", 4, js_uv_file_rw, 1 ),
    JS_CFUNC_DEF("close", 0, js_uv_file_close ),
    JS_CFUNC_DEF("fileno", 0, js_uv_file_fileno ),
};

static const JSCFunctionListEntry js_uv_fs_funcs[] = {
    JS_CFUNC_DEF("open", 3, js_uv_fs_open ),
};

void js_uv_mod_fs_init(JSContext *ctx, JSModuleDef *m) {
    JSValue proto, obj;

    JS_NewClassID(&js_uv_file_class_id);
    JS_NewClass(JS_GetRuntime(ctx), js_uv_file_class_id, &js_uv_file_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, js_uv_file_proto_funcs, countof(js_uv_file_proto_funcs));
    JS_SetClassProto(ctx, js_uv_file_class_id, proto);
    obj = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, obj, js_uv_fs_funcs, countof(js_uv_fs_funcs));
    JS_SetModuleExport(ctx, m, "fs", obj);
}

void js_uv_mod_fs_export(JSContext *ctx, JSModuleDef *m) {
    JS_AddModuleExport(ctx, m, "fs");
}

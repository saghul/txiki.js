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


static JSClassID quv_file_class_id;

typedef struct {
    JSContext *ctx;
    uv_file fd;
    char *path;
} JSUVFile;

static void quv_file_finalizer(JSRuntime *rt, JSValue val) {
    JSUVFile *f = JS_GetOpaque(val, quv_file_class_id);
    if (f) {
        if (f->fd != -1) {
            uv_fs_t req;
            uv_fs_close(NULL, &req, f->fd, NULL);
            uv_fs_req_cleanup(&req);
        }
        JSContext *ctx = f->ctx;
        js_free(ctx, f->path);
        js_free(ctx, f);
    }
}

static JSClassDef quv_file_class = {
    "File",
    .finalizer = quv_file_finalizer,
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

static JSValue js__stat2obj(JSContext *ctx, uv_stat_t *st) {
    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);
#define SET_UINT64_FIELD(x) JS_SetPropertyStr(ctx, obj, stringify(x), JS_NewBigUint64(ctx, st->x))
    SET_UINT64_FIELD(st_dev);
    SET_UINT64_FIELD(st_mode);
    SET_UINT64_FIELD(st_nlink);
    SET_UINT64_FIELD(st_uid);
    SET_UINT64_FIELD(st_gid);
    SET_UINT64_FIELD(st_rdev);
    SET_UINT64_FIELD(st_ino);
    SET_UINT64_FIELD(st_size);
    SET_UINT64_FIELD(st_blksize);
    SET_UINT64_FIELD(st_blocks);
    SET_UINT64_FIELD(st_flags);
    SET_UINT64_FIELD(st_gen);
#undef SET_UINT64_FIELD
#define SET_TIMESPEC_FIELD(x) JS_SetPropertyStr(ctx, obj, stringify(x), JS_NewFloat64(ctx, st->x.tv_sec + 1e-9*st->x.tv_nsec))
    SET_TIMESPEC_FIELD(st_atim);
    SET_TIMESPEC_FIELD(st_mtim);
    SET_TIMESPEC_FIELD(st_ctim);
    SET_TIMESPEC_FIELD(st_birthtim);
#undef SET_TIMESPEC_FIELD
    return obj;
}

static JSValue js_new_uv_file(JSContext *ctx, uv_file fd, const char *path) {
    JSUVFile *f;
    JSValue obj;

    obj = JS_NewObjectClass(ctx, quv_file_class_id);
    if (JS_IsException(obj))
        return obj;

    f = js_malloc(ctx, sizeof(*f));
    if (!f) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    f->path = js_strdup(ctx, path);
    if (!f->path) {
        js_free(ctx, f);
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    f->ctx = ctx;
    f->fd = fd;

    JS_SetOpaque(obj, f);

    return obj;
}

static JSUVFile *quv_file_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, quv_file_class_id);
}

static void quv_fsreq_init(JSContext *ctx, JSUVFsReq *fr, JSValue obj) {
    fr->ctx = ctx;
    fr->req.data = fr;
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
        arg = js_new_uv_file(ctx, fr->req.result, fr->req.path);
        break;
    case UV_FS_CLOSE:
        arg = JS_UNDEFINED;
        f = quv_file_get(ctx, fr->obj);
        if (f) {
            f->fd = -1;
            js_free(ctx, f->path);
            f->path = NULL;
        }
        break;
    case UV_FS_READ:
    case UV_FS_WRITE:
        arg = JS_NewInt32(ctx, fr->req.result);
        break;

    case UV_FS_STAT:
    case UV_FS_LSTAT:
    case UV_FS_FSTAT:
        arg = js__stat2obj(ctx, &fr->req.statbuf);
        break;

    case UV_FS_REALPATH:
        arg = JS_NewString(ctx, fr->req.ptr);
        break;

    case UV_FS_COPYFILE:
    case UV_FS_RENAME:
    case UV_FS_RMDIR:
    case UV_FS_UNLINK:
        arg = JS_UNDEFINED;
        break;

    case UV_FS_MKDTEMP:
        arg = JS_NewString(ctx, fr->req.path);
        break;

    default:
        abort();
    }

    ret = JS_Call(ctx, fr->result.resolving_funcs[0], JS_UNDEFINED, 1, (JSValueConst *)&arg);

end:
    uv_fs_req_cleanup(&fr->req);

    JS_FreeValue(ctx, ret); /* XXX: what to do if exception ? */

    JS_FreeValue(ctx, fr->result.promise);
    JS_FreeValue(ctx, fr->result.resolving_funcs[0]);
    JS_FreeValue(ctx, fr->result.resolving_funcs[1]);
    JS_FreeValue(ctx, fr->obj);
    JS_FreeValue(ctx, fr->rw.buf);

    js_free(ctx, fr);
}

static JSValue quv_file_rw(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv, int magic) {
    JSUVFile *f = quv_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    uv_loop_t *loop = quv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    /* arg 0: buffer */
    JSValue jsData = argv[0];
    size_t size;
    char *buf;
    if (magic && JS_IsString(jsData))
        buf = (char*) JS_ToCStringLen(ctx, &size, jsData);
    else
        buf = (char*) JS_GetArrayBuffer(ctx, &size, jsData);

    if (!buf)
        return JS_EXCEPTION;
    
    /* arg 1: offset (within the buffer) */
    uint64_t off = 0;
    if (!JS_IsUndefined(argv[1]) && JS_ToIndex(ctx, &off, argv[1]))
        return JS_EXCEPTION;

    /* arg 2: buffer length */
    uint64_t len = size;
    if (!JS_IsUndefined(argv[2]) && JS_ToIndex(ctx, &len, argv[2]))
       return JS_EXCEPTION;

    if (off + len > size)
        return JS_ThrowRangeError(ctx, "read/write array buffer overflow");

    /* arg 3: position (on the file) */
    uint64_t pos = 0;
    if (!JS_IsUndefined(argv[3]) && JS_ToIndex(ctx, &pos, argv[3]))
        return JS_EXCEPTION;

    JSUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    uv_buf_t b = uv_buf_init(buf + off, len);

    int r;
    if (magic)
        r = uv_fs_write(loop, &fr->req, f->fd, &b, 1, pos, uv__fs_req_cb);
    else
        r = uv_fs_read(loop, &fr->req, f->fd, &b, 1, pos, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    quv_fsreq_init(ctx, fr, this_val);
    fr->rw.buf = JS_DupValue(ctx, argv[0]);
    return fr->result.promise;
}

static JSValue quv_file_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    JSUVFile *f = quv_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    uv_loop_t *loop = quv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    JSUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_close(loop, &fr->req, f->fd, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    quv_fsreq_init(ctx, fr, this_val);
    return fr->result.promise;
}

static JSValue quv_file_stat(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    JSUVFile *f = quv_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    uv_loop_t *loop = quv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    JSUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_fstat(loop, &fr->req, f->fd, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    quv_fsreq_init(ctx, fr, this_val);
    return fr->result.promise;
}

static JSValue quv_file_fileno(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    JSUVFile *f = quv_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    return JS_NewInt32(ctx, f->fd);
}

static JSValue quv_file_path_get(JSContext *ctx, JSValueConst this_val) {
    JSUVFile *f = quv_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;
    if (!f->path)
        return JS_UNDEFINED;
    return JS_NewString(ctx, f->path);
}

static int js__uv_open_flags(const char *strflags, size_t len) {
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

static JSValue quv_fs_open(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path;
    const char *strflags;
    size_t len;
    int flags;
    int32_t mode;
    uv_loop_t *loop;

    loop = quv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;
    strflags = JS_ToCStringLen(ctx, &len, argv[1]);
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
        return quv_throw_errno(ctx, r);
    }

    quv_fsreq_init(ctx, fr, JS_UNDEFINED);
    return fr->result.promise;
}

static JSValue quv_fs_stat(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv, int magic) {
    uv_loop_t *loop = quv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    JSUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r;
    if (magic)
        r = uv_fs_lstat(loop, &fr->req, path, uv__fs_req_cb);
    else
        r = uv_fs_stat(loop, &fr->req, path, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    quv_fsreq_init(ctx, fr, JS_UNDEFINED);
    return fr->result.promise;
}

static JSValue quv_fs_realpath(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    uv_loop_t *loop = quv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    JSUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_realpath(loop, &fr->req, path, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    quv_fsreq_init(ctx, fr, JS_UNDEFINED);
    return fr->result.promise;
}

static JSValue quv_fs_unlink(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    uv_loop_t *loop = quv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    JSUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_unlink(loop, &fr->req, path, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    quv_fsreq_init(ctx, fr, JS_UNDEFINED);
    return fr->result.promise;
}

static JSValue quv_fs_rename(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    uv_loop_t *loop = quv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    const char *new_path = JS_ToCString(ctx, argv[1]);
    if (!new_path)
        return JS_EXCEPTION;

    JSUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_rename(loop, &fr->req, path, new_path, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    quv_fsreq_init(ctx, fr, JS_UNDEFINED);
    return fr->result.promise;
}

static JSValue quv_fs_mkdtemp(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    uv_loop_t *loop = quv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    const char *tpl = JS_ToCString(ctx, argv[0]);
    if (!tpl)
        return JS_EXCEPTION;

    JSUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_mkdtemp(loop, &fr->req, tpl, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    quv_fsreq_init(ctx, fr, JS_UNDEFINED);
    return fr->result.promise;
}

static JSValue quv_fs_rmdir(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    uv_loop_t *loop = quv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    JSUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_rmdir(loop, &fr->req, path, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    quv_fsreq_init(ctx, fr, JS_UNDEFINED);
    return fr->result.promise;
}

static JSValue quv_fs_copyfile(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    uv_loop_t *loop = quv_get_loop(ctx);
    if (!loop)
        return JS_ThrowInternalError(ctx, "couldn't find libuv loop");

    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    const char *new_path = JS_ToCString(ctx, argv[1]);
    if (!new_path)
        return JS_EXCEPTION;

    int32_t flags;
    if (JS_ToInt32(ctx, &flags, argv[2]))
        return JS_EXCEPTION;

    JSUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_copyfile(loop, &fr->req, path, new_path, flags, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    quv_fsreq_init(ctx, fr, JS_UNDEFINED);
    return fr->result.promise;
}

static const JSCFunctionListEntry quv_file_proto_funcs[] = {
    JS_CFUNC_MAGIC_DEF("read", 4, quv_file_rw, 0 ),
    JS_CFUNC_MAGIC_DEF("write", 4, quv_file_rw, 1 ),
    JS_CFUNC_DEF("close", 0, quv_file_close ),
    JS_CFUNC_DEF("fileno", 0, quv_file_fileno ),
    JS_CFUNC_DEF("stat", 0, quv_file_stat ),
    JS_CGETSET_DEF("path", quv_file_path_get, NULL ),
};

static const JSCFunctionListEntry quv_fs_funcs[] = {
    JSUV_CONST(UV_FS_COPYFILE_EXCL),
    JSUV_CONST(UV_FS_COPYFILE_FICLONE),
    JSUV_CONST(UV_FS_COPYFILE_FICLONE_FORCE),
    JS_CFUNC_DEF("open", 3, quv_fs_open ),
    JS_CFUNC_MAGIC_DEF("stat", 1, quv_fs_stat, 0 ),
    JS_CFUNC_MAGIC_DEF("lstat", 1, quv_fs_stat, 1 ),
    JS_CFUNC_DEF("realpath", 1, quv_fs_realpath ),
    JS_CFUNC_DEF("unlink", 1, quv_fs_unlink ),
    JS_CFUNC_DEF("rename", 2, quv_fs_rename ),
    JS_CFUNC_DEF("mkdtemp", 1, quv_fs_mkdtemp ),
    JS_CFUNC_DEF("rmdir", 1, quv_fs_rmdir ),
    JS_CFUNC_DEF("copyfile", 3, quv_fs_copyfile ),
};

void quv_mod_fs_init(JSContext *ctx, JSModuleDef *m) {
    JSValue proto, obj;

    JS_NewClassID(&quv_file_class_id);
    JS_NewClass(JS_GetRuntime(ctx), quv_file_class_id, &quv_file_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, quv_file_proto_funcs, countof(quv_file_proto_funcs));
    JS_SetClassProto(ctx, quv_file_class_id, proto);
    obj = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, obj, quv_fs_funcs, countof(quv_fs_funcs));
    JS_SetModuleExport(ctx, m, "fs", obj);
}

void quv_mod_fs_export(JSContext *ctx, JSModuleDef *m) {
    JS_AddModuleExport(ctx, m, "fs");
}

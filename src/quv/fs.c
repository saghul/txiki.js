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

#include "private.h"
#include "utils.h"


static JSClassID quv_file_class_id;

typedef struct {
    JSContext *ctx;
    uv_file fd;
    JSValue path;
} QUVFile;

static void quv_file_finalizer(JSRuntime *rt, JSValue val) {
    QUVFile *f = JS_GetOpaque(val, quv_file_class_id);
    if (f) {
        if (f->fd != -1) {
            uv_fs_t req;
            uv_fs_close(NULL, &req, f->fd, NULL);
            uv_fs_req_cleanup(&req);
        }
        JS_FreeValueRT(rt, f->path);
        js_free_rt(rt, f);
    }
}

static JSClassDef quv_file_class = {
    "File",
    .finalizer = quv_file_finalizer,
};

static JSClassID quv_dir_class_id;

typedef struct {
    JSContext *ctx;
    uv_dir_t *dir;
    uv_dirent_t dirent;
    JSValue path;
    bool done;
} QUVDir;

static void quv_dir_finalizer(JSRuntime *rt, JSValue val) {
    QUVDir *d = JS_GetOpaque(val, quv_dir_class_id);
    if (d) {
        if (d->dir) {
            uv_fs_t req;
            uv_fs_closedir(NULL, &req, d->dir, NULL);
            uv_fs_req_cleanup(&req);
        }
        JS_FreeValueRT(rt, d->path);
        js_free_rt(rt, d);
    }
}

static JSClassDef quv_dir_class = { "Directory", .finalizer = quv_dir_finalizer };

typedef struct {
    uv_fs_t req;
    JSContext *ctx;
    JSValue obj;
    QUVPromise result;
    struct {
        JSValue buf;
    } rw;
} QUVFsReq;

typedef struct {
    uv_work_t req;
    DynBuf dbuf;
    JSContext *ctx;
    int r;
    char *filename;
    QUVPromise result;
} QUVReadFileReq;

static JSValue js__stat2obj(JSContext *ctx, uv_stat_t *st) {
    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);
#define SET_UINT64_FIELD(x)                                                                                            \
    JS_DefinePropertyValueStr(ctx, obj, STRINGIFY(x), JS_NewBigUint64(ctx, st->x), JS_PROP_C_W_E)
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
#define SET_TIMESPEC_FIELD(x)                                                                                          \
    JS_DefinePropertyValueStr(ctx,                                                                                     \
                              obj,                                                                                     \
                              STRINGIFY(x),                                                                            \
                              JS_NewFloat64(ctx, st->x.tv_sec + 1e-9 * st->x.tv_nsec),                                 \
                              JS_PROP_C_W_E)
    SET_TIMESPEC_FIELD(st_atim);
    SET_TIMESPEC_FIELD(st_mtim);
    SET_TIMESPEC_FIELD(st_ctim);
    SET_TIMESPEC_FIELD(st_birthtim);
#undef SET_TIMESPEC_FIELD
    return obj;
}

static JSValue quv_new_file(JSContext *ctx, uv_file fd, const char *path) {
    QUVFile *f;
    JSValue obj;

    obj = JS_NewObjectClass(ctx, quv_file_class_id);
    if (JS_IsException(obj))
        return obj;

    f = js_malloc(ctx, sizeof(*f));
    if (!f) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    f->path = JS_NewString(ctx, path);
    f->ctx = ctx;
    f->fd = fd;

    JS_SetOpaque(obj, f);
    return obj;
}

static QUVFile *quv_file_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, quv_file_class_id);
}

static JSValue quv_new_dir(JSContext *ctx, uv_dir_t *dir, const char *path) {
    QUVDir *d;
    JSValue obj;

    obj = JS_NewObjectClass(ctx, quv_dir_class_id);
    if (JS_IsException(obj))
        return obj;

    d = js_malloc(ctx, sizeof(*d));
    if (!d) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    d->path = JS_NewString(ctx, path);
    d->ctx = ctx;
    d->dir = dir;
    d->done = false;

    JS_SetOpaque(obj, d);
    return obj;
}

static QUVDir *quv_dir_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, quv_dir_class_id);
}

static JSValue quv_fsreq_init(JSContext *ctx, QUVFsReq *fr, JSValue obj) {
    fr->ctx = ctx;
    fr->req.data = fr;
    fr->obj = JS_DupValue(ctx, obj);
    fr->rw.buf = JS_UNDEFINED;

    return QUV_InitPromise(ctx, &fr->result);
}

static void uv__fs_req_cb(uv_fs_t *req) {
    QUVFsReq *fr = req->data;
    if (!fr)
        return;

    JSContext *ctx = fr->ctx;
    JSValue arg;
    QUVFile *f;
    QUVDir *d;
    bool is_reject = false;

    if (fr->req.result < 0) {
        arg = quv_new_error(ctx, fr->req.result);
        is_reject = true;
        goto skip;
    }

    switch (fr->req.fs_type) {
        case UV_FS_OPEN:
            arg = quv_new_file(ctx, fr->req.result, fr->req.path);
            break;
        case UV_FS_CLOSE:
            arg = JS_UNDEFINED;
            f = quv_file_get(ctx, fr->obj);
            CHECK_NOT_NULL(f);
            f->fd = -1;
            JS_FreeValue(ctx, f->path);
            f->path = JS_UNDEFINED;
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

        case UV_FS_OPENDIR:
            arg = quv_new_dir(ctx, fr->req.ptr, fr->req.path);
            break;

        case UV_FS_CLOSEDIR:
            arg = JS_UNDEFINED;
            d = quv_dir_get(ctx, fr->obj);
            CHECK_NOT_NULL(d);
            d->dir = NULL;
            JS_FreeValue(ctx, d->path);
            d->path = JS_UNDEFINED;
            break;

        case UV_FS_READDIR:
            d = quv_dir_get(ctx, fr->obj);
            d->done = fr->req.result == 0;
            arg = JS_NewObjectProto(ctx, JS_NULL);
            JS_DefinePropertyValueStr(ctx, arg, "done", JS_NewBool(ctx, d->done), JS_PROP_C_W_E);
            if (fr->req.result != 0) {
                JSValue item = JS_NewObjectProto(ctx, JS_NULL);
                JS_DefinePropertyValueStr(ctx, item, "name", JS_NewString(ctx, d->dirent.name), JS_PROP_C_W_E);
                JS_DefinePropertyValueStr(ctx, item, "type", JS_NewInt32(ctx, d->dirent.type), JS_PROP_C_W_E);
                JS_DefinePropertyValueStr(ctx, arg, "value", item, JS_PROP_C_W_E);
            }
            break;

        default:
            abort();
    }

skip:
    QUV_SettlePromise(ctx, &fr->result, is_reject, 1, (JSValueConst *) &arg);

    JS_FreeValue(ctx, fr->obj);
    JS_FreeValue(ctx, fr->rw.buf);

    uv_fs_req_cleanup(&fr->req);
    js_free(ctx, fr);
}

/* File functions */

static JSValue quv_file_rw(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv, int magic) {
    QUVFile *f = quv_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    /* arg 0: buffer */
    JSValue jsData = argv[0];
    size_t size;
    char *buf;
    if (magic && JS_IsString(jsData))
        buf = (char *) JS_ToCStringLen(ctx, &size, jsData);
    else
        buf = (char *) JS_GetArrayBuffer(ctx, &size, jsData);

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

    QUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    uv_buf_t b = uv_buf_init(buf + off, len);

    int r;
    if (magic)
        r = uv_fs_write(quv_get_loop(ctx), &fr->req, f->fd, &b, 1, pos, uv__fs_req_cb);
    else
        r = uv_fs_read(quv_get_loop(ctx), &fr->req, f->fd, &b, 1, pos, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    quv_fsreq_init(ctx, fr, this_val);
    fr->rw.buf = JS_DupValue(ctx, argv[0]);
    return fr->result.p;
}

static JSValue quv_file_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    QUVFile *f = quv_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    QUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_close(quv_get_loop(ctx), &fr->req, f->fd, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    return quv_fsreq_init(ctx, fr, this_val);
}

static JSValue quv_file_stat(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    QUVFile *f = quv_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    QUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_fstat(quv_get_loop(ctx), &fr->req, f->fd, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    return quv_fsreq_init(ctx, fr, this_val);
}

static JSValue quv_file_fileno(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    QUVFile *f = quv_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    return JS_NewInt32(ctx, f->fd);
}

static JSValue quv_file_path_get(JSContext *ctx, JSValueConst this_val) {
    QUVFile *f = quv_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;
    return JS_DupValue(ctx, f->path);
}

/* Dir functions */

static JSValue quv_dir_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    QUVDir *d = quv_dir_get(ctx, this_val);
    if (!d)
        return JS_EXCEPTION;

    QUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_closedir(quv_get_loop(ctx), &fr->req, d->dir, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    return quv_fsreq_init(ctx, fr, this_val);
}

static JSValue quv_dir_path_get(JSContext *ctx, JSValueConst this_val) {
    QUVDir *d = quv_dir_get(ctx, this_val);
    if (!d)
        return JS_EXCEPTION;
    return JS_DupValue(ctx, d->path);
}

static JSValue quv_dir_next(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    QUVDir *d = quv_dir_get(ctx, this_val);
    if (!d)
        return JS_EXCEPTION;

    if (d->done)
        return JS_UNDEFINED;

    QUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    d->dir->dirents = &d->dirent;
    d->dir->nentries = 1;

    int r = uv_fs_readdir(quv_get_loop(ctx), &fr->req, d->dir, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    return quv_fsreq_init(ctx, fr, this_val);
}

static JSValue quv_dir_iterator(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    return JS_DupValue(ctx, this_val);
}

/* Module functions */

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

    path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;
    strflags = JS_ToCStringLen(ctx, &len, argv[1]);
    if (!strflags)
        return JS_EXCEPTION;

    flags = js__uv_open_flags(strflags, len);
    if (JS_ToInt32(ctx, &mode, argv[2]))
        return JS_EXCEPTION;

    QUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_open(quv_get_loop(ctx), &fr->req, path, flags, mode, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    return quv_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue quv_fs_stat(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv, int magic) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    QUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r;
    if (magic)
        r = uv_fs_lstat(quv_get_loop(ctx), &fr->req, path, uv__fs_req_cb);
    else
        r = uv_fs_stat(quv_get_loop(ctx), &fr->req, path, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    return quv_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue quv_fs_realpath(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    QUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_realpath(quv_get_loop(ctx), &fr->req, path, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    return quv_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue quv_fs_unlink(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    QUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_unlink(quv_get_loop(ctx), &fr->req, path, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    return quv_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue quv_fs_rename(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    const char *new_path = JS_ToCString(ctx, argv[1]);
    if (!new_path)
        return JS_EXCEPTION;

    QUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_rename(quv_get_loop(ctx), &fr->req, path, new_path, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    return quv_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue quv_fs_mkdtemp(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *tpl = JS_ToCString(ctx, argv[0]);
    if (!tpl)
        return JS_EXCEPTION;

    QUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_mkdtemp(quv_get_loop(ctx), &fr->req, tpl, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    return quv_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue quv_fs_rmdir(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    QUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_rmdir(quv_get_loop(ctx), &fr->req, path, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    return quv_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue quv_fs_copyfile(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    const char *new_path = JS_ToCString(ctx, argv[1]);
    if (!new_path)
        return JS_EXCEPTION;

    int32_t flags;
    if (JS_ToInt32(ctx, &flags, argv[2]))
        return JS_EXCEPTION;

    QUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_copyfile(quv_get_loop(ctx), &fr->req, path, new_path, flags, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    return quv_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue quv_fs_readdir(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    QUVFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_opendir(quv_get_loop(ctx), &fr->req, path, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    return quv_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static void quv__readfile_free(JSRuntime *rt, void *opaque, void *ptr) {
    QUVReadFileReq *fr = opaque;
    CHECK_NOT_NULL(fr);

    dbuf_free(&fr->dbuf);
    js_free_rt(rt, fr->filename);
    js_free_rt(rt, fr);
}

static void quv__readfile_work_cb(uv_work_t *req) {
    QUVReadFileReq *fr = req->data;
    CHECK_NOT_NULL(fr);

    fr->r = quv__load_file(fr->ctx, &fr->dbuf, fr->filename);
}

static void quv__readfile_after_work_cb(uv_work_t *req, int status) {
    QUVReadFileReq *fr = req->data;
    CHECK_NOT_NULL(fr);

    JSContext *ctx = fr->ctx;
    JSValue arg;
    bool is_reject = false;

    if (status != 0) {
        arg = quv_new_error(ctx, status);
        is_reject = true;
    } else if (fr->r < 0) {
        arg = quv_new_error(ctx, fr->r);
        is_reject = true;
    } else {
        arg = JS_NewArrayBuffer(ctx, fr->dbuf.buf, fr->dbuf.size, quv__readfile_free, (void *) fr, false);
    }

    QUV_SettlePromise(ctx, &fr->result, is_reject, 1, (JSValueConst *) &arg);

    if (is_reject)
        quv__readfile_free(JS_GetRuntime(ctx), (void *) fr, NULL);
}

static JSValue quv_fs_readfile(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    QUVReadFileReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    fr->ctx = ctx;
    dbuf_init(&fr->dbuf);
    fr->r = -1;
    fr->filename = js_strdup(ctx, path);
    fr->req.data = fr;

    int r = uv_queue_work(quv_get_loop(ctx), &fr->req, quv__readfile_work_cb, quv__readfile_after_work_cb);
    if (r != 0) {
        js_free(ctx, fr->filename);
        js_free(ctx, fr);
        return quv_throw_errno(ctx, r);
    }

    return QUV_InitPromise(ctx, &fr->result);
}

static const JSCFunctionListEntry quv_file_proto_funcs[] = {
    JS_CFUNC_MAGIC_DEF("read", 4, quv_file_rw, 0),
    JS_CFUNC_MAGIC_DEF("write", 4, quv_file_rw, 1),
    JS_CFUNC_DEF("close", 0, quv_file_close),
    JS_CFUNC_DEF("fileno", 0, quv_file_fileno),
    JS_CFUNC_DEF("stat", 0, quv_file_stat),
    JS_CGETSET_DEF("path", quv_file_path_get, NULL),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "File", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry quv_dir_proto_funcs[] = {
    JS_CFUNC_DEF("close", 0, quv_dir_close),
    JS_CGETSET_DEF("path", quv_dir_path_get, NULL),
    JS_CFUNC_DEF("next", 0, quv_dir_next),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Dir", JS_PROP_CONFIGURABLE),
    JS_CFUNC_DEF("[Symbol.asyncIterator]", 0, quv_dir_iterator),
};

static const JSCFunctionListEntry quv_fs_funcs[] = {
    QUV_CONST(UV_DIRENT_UNKNOWN),
    QUV_CONST(UV_DIRENT_FILE),
    QUV_CONST(UV_DIRENT_DIR),
    QUV_CONST(UV_DIRENT_LINK),
    QUV_CONST(UV_DIRENT_FIFO),
    QUV_CONST(UV_DIRENT_SOCKET),
    QUV_CONST(UV_DIRENT_CHAR),
    QUV_CONST(UV_DIRENT_BLOCK),
    QUV_CONST(UV_FS_COPYFILE_EXCL),
    QUV_CONST(UV_FS_COPYFILE_FICLONE),
    QUV_CONST(UV_FS_COPYFILE_FICLONE_FORCE),
    QUV_CONST(S_IFMT),
    QUV_CONST(S_IFIFO),
    QUV_CONST(S_IFCHR),
    QUV_CONST(S_IFDIR),
    QUV_CONST(S_IFBLK),
    QUV_CONST(S_IFREG),
    QUV_CONST(S_IFSOCK),
    QUV_CONST(S_IFLNK),
    QUV_CONST(S_ISGID),
    QUV_CONST(S_ISUID),
    JS_CFUNC_DEF("open", 3, quv_fs_open),
    JS_CFUNC_MAGIC_DEF("stat", 1, quv_fs_stat, 0),
    JS_CFUNC_MAGIC_DEF("lstat", 1, quv_fs_stat, 1),
    JS_CFUNC_DEF("realpath", 1, quv_fs_realpath),
    JS_CFUNC_DEF("unlink", 1, quv_fs_unlink),
    JS_CFUNC_DEF("rename", 2, quv_fs_rename),
    JS_CFUNC_DEF("mkdtemp", 1, quv_fs_mkdtemp),
    JS_CFUNC_DEF("rmdir", 1, quv_fs_rmdir),
    JS_CFUNC_DEF("copyfile", 3, quv_fs_copyfile),
    JS_CFUNC_DEF("readdir", 1, quv_fs_readdir),
    JS_CFUNC_DEF("readFile", 1, quv_fs_readfile),
};

void quv_mod_fs_init(JSContext *ctx, JSModuleDef *m) {
    JSValue proto, obj;

    /* File object */
    JS_NewClassID(&quv_file_class_id);
    JS_NewClass(JS_GetRuntime(ctx), quv_file_class_id, &quv_file_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, quv_file_proto_funcs, countof(quv_file_proto_funcs));
    JS_SetClassProto(ctx, quv_file_class_id, proto);

    /* Dir object */
    JS_NewClassID(&quv_dir_class_id);
    JS_NewClass(JS_GetRuntime(ctx), quv_dir_class_id, &quv_dir_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, quv_dir_proto_funcs, countof(quv_dir_proto_funcs));
    JS_SetClassProto(ctx, quv_dir_class_id, proto);

    obj = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, obj, quv_fs_funcs, countof(quv_fs_funcs));
    JS_SetModuleExport(ctx, m, "fs", obj);
}

void quv_mod_fs_export(JSContext *ctx, JSModuleDef *m) {
    JS_AddModuleExport(ctx, m, "fs");
}

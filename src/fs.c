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
#include "utils.h"

#include <string.h>


static JSClassID tjs_file_class_id;

typedef struct {
    JSContext *ctx;
    uv_file fd;
    JSValue path;
} TJSFile;

static void tjs_file_finalizer(JSRuntime *rt, JSValue val) {
    TJSFile *f = JS_GetOpaque(val, tjs_file_class_id);
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

static JSClassDef tjs_file_class = {
    "File",
    .finalizer = tjs_file_finalizer,
};

static JSClassID tjs_dir_class_id;

typedef struct {
    JSContext *ctx;
    uv_dir_t *dir;
    uv_dirent_t dirent;
    JSValue path;
    bool done;
} TJSDir;

static void tjs_dir_finalizer(JSRuntime *rt, JSValue val) {
    TJSDir *d = JS_GetOpaque(val, tjs_dir_class_id);
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

static JSClassDef tjs_dir_class = { "Directory", .finalizer = tjs_dir_finalizer };

typedef struct {
    uv_fs_t req;
    JSContext *ctx;
    JSValue obj;
    TJSPromise result;
    struct {
        JSValue tarray;
    } rw;
} TJSFsReq;

typedef struct {
    uv_work_t req;
    DynBuf dbuf;
    JSContext *ctx;
    int r;
    char *filename;
    TJSPromise result;
} TJSReadFileReq;

static JSValue js__stat2obj(JSContext *ctx, uv_stat_t *st) {
    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);
#define SET_UINT64_FIELD(x)                                                                                            \
    JS_DefinePropertyValueStr(ctx, obj, STRINGIFY(x), JS_NewUint32(ctx, st->x), JS_PROP_C_W_E)
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

static JSValue tjs_new_file(JSContext *ctx, uv_file fd, const char *path) {
    TJSFile *f;
    JSValue obj;

    obj = JS_NewObjectClass(ctx, tjs_file_class_id);
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

static TJSFile *tjs_file_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, tjs_file_class_id);
}

static JSValue tjs_new_dir(JSContext *ctx, uv_dir_t *dir, const char *path) {
    TJSDir *d;
    JSValue obj;

    obj = JS_NewObjectClass(ctx, tjs_dir_class_id);
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

static TJSDir *tjs_dir_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, tjs_dir_class_id);
}

static JSValue tjs_fsreq_init(JSContext *ctx, TJSFsReq *fr, JSValue obj) {
    fr->ctx = ctx;
    fr->req.data = fr;
    fr->obj = JS_DupValue(ctx, obj);
    fr->rw.tarray = JS_UNDEFINED;

    return TJS_InitPromise(ctx, &fr->result);
}

static void uv__fs_req_cb(uv_fs_t *req) {
    TJSFsReq *fr = req->data;
    if (!fr)
        return;

    JSContext *ctx = fr->ctx;
    JSValue arg;
    TJSFile *f;
    TJSDir *d;
    bool is_reject = false;

    if (req->result < 0) {
        arg = tjs_new_error(ctx, fr->req.result);
        is_reject = true;
        goto skip;
    }

    switch (req->fs_type) {
        case UV_FS_OPEN:
            arg = tjs_new_file(ctx, fr->req.result, fr->req.path);
            break;
        case UV_FS_CLOSE:
            arg = JS_UNDEFINED;
            f = tjs_file_get(ctx, fr->obj);
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
        case UV_FS_FDATASYNC:
        case UV_FS_FSYNC:
        case UV_FS_FTRUNCATE:
        case UV_FS_RENAME:
        case UV_FS_RMDIR:
        case UV_FS_UNLINK:
            arg = JS_UNDEFINED;
            break;

        case UV_FS_MKDTEMP:
            arg = JS_NewString(ctx, fr->req.path);
            break;

        case UV_FS_MKSTEMP:
            arg = tjs_new_file(ctx, fr->req.result, fr->req.path);
            break;

        case UV_FS_OPENDIR:
            arg = tjs_new_dir(ctx, fr->req.ptr, fr->req.path);
            break;

        case UV_FS_CLOSEDIR:
            arg = JS_UNDEFINED;
            d = tjs_dir_get(ctx, fr->obj);
            CHECK_NOT_NULL(d);
            d->dir = NULL;
            JS_FreeValue(ctx, d->path);
            d->path = JS_UNDEFINED;
            break;

        case UV_FS_READDIR:
            d = tjs_dir_get(ctx, fr->obj);
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
    TJS_SettlePromise(ctx, &fr->result, is_reject, 1, (JSValueConst *) &arg);

    JS_FreeValue(ctx, fr->obj);
    JS_FreeValue(ctx, fr->rw.tarray);

    uv_fs_req_cleanup(&fr->req);
    js_free(ctx, fr);
}

/* File functions */

static JSValue tjs_file_rw(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv, int magic) {
    TJSFile *f = tjs_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    /* arg 0: buffer */
    size_t size;
    uint8_t *buf = JS_GetUint8Array(ctx, &size, argv[0]);
    if (!buf)
        return JS_EXCEPTION;

    /* arg 1: position (on the file) */
    int64_t pos = -1;
    if (!JS_IsUndefined(argv[1]) && JS_ToInt64(ctx, &pos, argv[1]))
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    uv_buf_t b = uv_buf_init((char *)buf, size);

    int r;
    if (magic)
        r = uv_fs_write(tjs_get_loop(ctx), &fr->req, f->fd, &b, 1, pos, uv__fs_req_cb);
    else
        r = uv_fs_read(tjs_get_loop(ctx), &fr->req, f->fd, &b, 1, pos, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    tjs_fsreq_init(ctx, fr, this_val);
    fr->rw.tarray = JS_DupValue(ctx, argv[0]);
    return fr->result.p;
}

static JSValue tjs_file_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSFile *f = tjs_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_close(tjs_get_loop(ctx), &fr->req, f->fd, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, this_val);
}

static JSValue tjs_file_stat(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSFile *f = tjs_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_fstat(tjs_get_loop(ctx), &fr->req, f->fd, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, this_val);
}

static JSValue tjs_file_truncate(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSFile *f = tjs_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    int64_t offset = 0;
    if (!JS_IsUndefined(argv[0]) && JS_ToInt64(ctx, &offset, argv[0]))
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_ftruncate(tjs_get_loop(ctx), &fr->req, f->fd, offset, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, this_val);
}

static JSValue tjs_file_sync(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSFile *f = tjs_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_fsync(tjs_get_loop(ctx), &fr->req, f->fd, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, this_val);
}

static JSValue tjs_file_datasync(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSFile *f = tjs_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_fdatasync(tjs_get_loop(ctx), &fr->req, f->fd, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, this_val);
}

static JSValue tjs_file_fileno(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSFile *f = tjs_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;

    return JS_NewInt32(ctx, f->fd);
}

static JSValue tjs_file_path_get(JSContext *ctx, JSValueConst this_val) {
    TJSFile *f = tjs_file_get(ctx, this_val);
    if (!f)
        return JS_EXCEPTION;
    return JS_DupValue(ctx, f->path);
}

/* Dir functions */

static JSValue tjs_dir_close(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSDir *d = tjs_dir_get(ctx, this_val);
    if (!d)
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    int r = uv_fs_closedir(tjs_get_loop(ctx), &fr->req, d->dir, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, this_val);
}

static JSValue tjs_dir_path_get(JSContext *ctx, JSValueConst this_val) {
    TJSDir *d = tjs_dir_get(ctx, this_val);
    if (!d)
        return JS_EXCEPTION;
    return JS_DupValue(ctx, d->path);
}

static JSValue tjs_dir_next(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    TJSDir *d = tjs_dir_get(ctx, this_val);
    if (!d)
        return JS_EXCEPTION;

    if (d->done)
        return JS_UNDEFINED;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr)
        return JS_EXCEPTION;

    d->dir->dirents = &d->dirent;
    d->dir->nentries = 1;

    int r = uv_fs_readdir(tjs_get_loop(ctx), &fr->req, d->dir, uv__fs_req_cb);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, this_val);
}

static JSValue tjs_dir_iterator(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
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

static JSValue tjs_fs_open(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path;
    const char *strflags;
    size_t len;
    int flags;
    int32_t mode;

    path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    strflags = JS_ToCStringLen(ctx, &len, argv[1]);
    if (!strflags) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }
    flags = js__uv_open_flags(strflags, len);
    JS_FreeCString(ctx, strflags);

    mode = 0;
    if (!JS_IsUndefined(argv[2]) && JS_ToInt32(ctx, &mode, argv[2])) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    int r = uv_fs_open(tjs_get_loop(ctx), &fr->req, path, flags, mode, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue tjs_fs_new_stdio_file(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path;
    uv_file fd;

    path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    if (JS_ToInt32(ctx, &fd, argv[1])) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    JSValue obj = tjs_new_file(ctx, fd, path);

    JS_FreeCString(ctx, path);

    return obj;
}

static JSValue tjs_fs_stat(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv, int magic) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    int r;
    if (magic)
        r = uv_fs_lstat(tjs_get_loop(ctx), &fr->req, path, uv__fs_req_cb);
    else
        r = uv_fs_stat(tjs_get_loop(ctx), &fr->req, path, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue tjs_fs_realpath(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    int r = uv_fs_realpath(tjs_get_loop(ctx), &fr->req, path, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue tjs_fs_unlink(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    int r = uv_fs_unlink(tjs_get_loop(ctx), &fr->req, path, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue tjs_fs_rename(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    const char *new_path = JS_ToCString(ctx, argv[1]);
    if (!new_path) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr) {
        JS_FreeCString(ctx, path);
        JS_FreeCString(ctx, new_path);
        return JS_EXCEPTION;
    }

    int r = uv_fs_rename(tjs_get_loop(ctx), &fr->req, path, new_path, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    JS_FreeCString(ctx, new_path);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue tjs_fs_mkdtemp(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *tpl = JS_ToCString(ctx, argv[0]);
    if (!tpl)
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr) {
        JS_FreeCString(ctx, tpl);
        return JS_EXCEPTION;
    }

    int r = uv_fs_mkdtemp(tjs_get_loop(ctx), &fr->req, tpl, uv__fs_req_cb);
    JS_FreeCString(ctx, tpl);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue tjs_fs_mkstemp(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *tpl = JS_ToCString(ctx, argv[0]);
    if (!tpl)
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr) {
        JS_FreeCString(ctx, tpl);
        return JS_EXCEPTION;
    }

    int r = uv_fs_mkstemp(tjs_get_loop(ctx), &fr->req, tpl, uv__fs_req_cb);
    JS_FreeCString(ctx, tpl);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue tjs_fs_rmdir(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    int r = uv_fs_rmdir(tjs_get_loop(ctx), &fr->req, path, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue tjs_fs_copyfile(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    const char *new_path = JS_ToCString(ctx, argv[1]);
    if (!new_path) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    int32_t flags;
    if (JS_ToInt32(ctx, &flags, argv[2])) {
        JS_FreeCString(ctx, path);
        JS_FreeCString(ctx, new_path);
        return JS_EXCEPTION;
    }

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr) {
        JS_FreeCString(ctx, path);
        JS_FreeCString(ctx, new_path);
        return JS_EXCEPTION;
    }

    int r = uv_fs_copyfile(tjs_get_loop(ctx), &fr->req, path, new_path, flags, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    JS_FreeCString(ctx, new_path);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue tjs_fs_readdir(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    int r = uv_fs_opendir(tjs_get_loop(ctx), &fr->req, path, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static void tjs__readfile_work_cb(uv_work_t *req) {
    TJSReadFileReq *fr = req->data;
    CHECK_NOT_NULL(fr);

    fr->r = tjs__load_file(fr->ctx, &fr->dbuf, fr->filename);
}

static void tjs__readfile_after_work_cb(uv_work_t *req, int status) {
    TJSReadFileReq *fr = req->data;
    CHECK_NOT_NULL(fr);

    JSContext *ctx = fr->ctx;
    JSValue arg;
    bool is_reject = false;

    if (status != 0) {
        arg = tjs_new_error(ctx, status);
        is_reject = true;
        dbuf_free(&fr->dbuf);
    } else if (fr->r < 0) {
        arg = tjs_new_error(ctx, fr->r);
        is_reject = true;
        dbuf_free(&fr->dbuf);
    } else {
        arg = TJS_NewUint8Array(ctx, fr->dbuf.buf, fr->dbuf.size);
        if (JS_IsException(arg))
            dbuf_free(&fr->dbuf);
    }

    TJS_SettlePromise(ctx, &fr->result, is_reject, 1, (JSValueConst *) &arg);

    js_free(ctx, fr->filename);
    js_free(ctx, fr);
}

static JSValue tjs_fs_readfile(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    TJSReadFileReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    fr->ctx = ctx;
    dbuf_init(&fr->dbuf);
    fr->r = -1;
    fr->filename = js_strdup(ctx, path);
    fr->req.data = fr;
    JS_FreeCString(ctx, path);

    int r = uv_queue_work(tjs_get_loop(ctx), &fr->req, tjs__readfile_work_cb, tjs__readfile_after_work_cb);
    if (r != 0) {
        js_free(ctx, fr->filename);
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return TJS_InitPromise(ctx, &fr->result);
}

static const JSCFunctionListEntry tjs_file_proto_funcs[] = {
    JS_CFUNC_MAGIC_DEF("read", 2, tjs_file_rw, 0),
    JS_CFUNC_MAGIC_DEF("write", 2, tjs_file_rw, 1),
    TJS_CFUNC_DEF("close", 0, tjs_file_close),
    TJS_CFUNC_DEF("fileno", 0, tjs_file_fileno),
    TJS_CFUNC_DEF("stat", 0, tjs_file_stat),
    TJS_CFUNC_DEF("truncate", 1, tjs_file_truncate),
    TJS_CFUNC_DEF("sync", 0, tjs_file_sync),
    TJS_CFUNC_DEF("datasync", 0, tjs_file_datasync),
    JS_CGETSET_DEF("path", tjs_file_path_get, NULL),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "File", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_dir_proto_funcs[] = {
    TJS_CFUNC_DEF("close", 0, tjs_dir_close),
    JS_CGETSET_DEF("path", tjs_dir_path_get, NULL),
    TJS_CFUNC_DEF("next", 0, tjs_dir_next),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Dir", JS_PROP_CONFIGURABLE),
    TJS_CFUNC_DEF("[Symbol.asyncIterator]", 0, tjs_dir_iterator),
};

static const JSCFunctionListEntry tjs_fs_funcs[] = {
    TJS_UVCONST(DIRENT_UNKNOWN),
    TJS_UVCONST(DIRENT_FILE),
    TJS_UVCONST(DIRENT_DIR),
    TJS_UVCONST(DIRENT_LINK),
    TJS_UVCONST(DIRENT_FIFO),
    TJS_UVCONST(DIRENT_SOCKET),
    TJS_UVCONST(DIRENT_CHAR),
    TJS_UVCONST(DIRENT_BLOCK),
    TJS_CONST2("COPYFILE_EXCL", UV_FS_COPYFILE_EXCL),
    TJS_CONST2("COPYFILE_FICLONE", UV_FS_COPYFILE_FICLONE),
    TJS_CONST2("COPYFILE_FICLONE_FORCE", UV_FS_COPYFILE_FICLONE_FORCE),
    TJS_CONST(S_IFMT),
    TJS_CONST(S_IFIFO),
    TJS_CONST(S_IFCHR),
    TJS_CONST(S_IFDIR),
    TJS_CONST(S_IFBLK),
    TJS_CONST(S_IFREG),
#ifdef S_IFSOCK
    TJS_CONST(S_IFSOCK),
#endif
    TJS_CONST(S_IFLNK),
#ifdef S_ISGID
    TJS_CONST(S_ISGID),
#endif
#ifdef S_ISUID
    TJS_CONST(S_ISUID),
#endif
    TJS_CFUNC_DEF("open", 3, tjs_fs_open),
    TJS_CFUNC_DEF("newStdioFile", 2, tjs_fs_new_stdio_file),
    TJS_CFUNC_MAGIC_DEF("stat", 1, tjs_fs_stat, 0),
    TJS_CFUNC_MAGIC_DEF("lstat", 1, tjs_fs_stat, 1),
    TJS_CFUNC_DEF("realpath", 1, tjs_fs_realpath),
    TJS_CFUNC_DEF("unlink", 1, tjs_fs_unlink),
    TJS_CFUNC_DEF("rename", 2, tjs_fs_rename),
    TJS_CFUNC_DEF("mkdtemp", 1, tjs_fs_mkdtemp),
    TJS_CFUNC_DEF("mkstemp", 1, tjs_fs_mkstemp),
    TJS_CFUNC_DEF("rmdir", 1, tjs_fs_rmdir),
    TJS_CFUNC_DEF("copyfile", 3, tjs_fs_copyfile),
    TJS_CFUNC_DEF("readdir", 1, tjs_fs_readdir),
    TJS_CFUNC_DEF("readFile", 1, tjs_fs_readfile),
};

void tjs__mod_fs_init(JSContext *ctx, JSValue ns) {
    JSValue proto;

    /* File object */
    JS_NewClassID(&tjs_file_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_file_class_id, &tjs_file_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_file_proto_funcs, countof(tjs_file_proto_funcs));
    JS_SetClassProto(ctx, tjs_file_class_id, proto);

    /* Dir object */
    JS_NewClassID(&tjs_dir_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_dir_class_id, &tjs_dir_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_dir_proto_funcs, countof(tjs_dir_proto_funcs));
    JS_SetClassProto(ctx, tjs_dir_class_id, proto);

    JS_SetPropertyFunctionList(ctx, ns, tjs_fs_funcs, countof(tjs_fs_funcs));
}

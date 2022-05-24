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
#include <uv.h>


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
    uv_dirent_t dirent; // TODO: Use an array and an index.
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

static JSClassID tjs_dirent_class_id;

typedef struct {
    JSValue name;
    uv_dirent_type_t type;
} TJSDirEnt;

static void tjs_dirent_finalizer(JSRuntime *rt, JSValue val) {
    TJSDirEnt *de = JS_GetOpaque(val, tjs_dirent_class_id);
    if (de) {
        JS_FreeValueRT(rt, de->name);
        js_free_rt(rt, de);
    }
}

static JSClassDef tjs_dirent_class = { "DirEnt", .finalizer = tjs_dirent_finalizer };

static JSClassID tjs_stat_class_id;

typedef struct {
    uint64_t st_mode;
} TJSStatResult;

static void tjs_stat_finalizer(JSRuntime *rt, JSValue val) {
    TJSStatResult *sr = JS_GetOpaque(val, tjs_stat_class_id);
    if (sr) {
        js_free_rt(rt, sr);
    }
}

static JSClassDef tjs_stat_class = { "StatResult", .finalizer = tjs_stat_finalizer };

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

static JSValue tjs_new_dirent(JSContext *ctx, uv_dirent_t *dent) {
    JSValue obj = JS_NewObjectClass(ctx, tjs_dirent_class_id);
    if (JS_IsException(obj))
        return obj;

    TJSDirEnt *de = js_malloc(ctx, sizeof(*de));
    if (!de) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    de->name = JS_NewString(ctx, dent->name);
    de->type = dent->type;

    JS_SetOpaque(obj, de);
    return obj;
}

static TJSDirEnt *tjs_dirent_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, tjs_dirent_class_id);
}

static JSValue tjs_new_stat(JSContext *ctx, uv_stat_t *st) {
    JSValue obj = JS_NewObjectClass(ctx, tjs_stat_class_id);
    if (JS_IsException(obj))
        return obj;

    TJSStatResult *sr = js_malloc(ctx, sizeof(*sr));
    if (!sr) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    sr->st_mode = st->st_mode;

#define SET_UINT64_FIELD(x) \
    JS_DefinePropertyValueStr(ctx, \
        obj, \
        STRINGIFY(x), \
        JS_NewUint32(ctx, st->st_##x), \
        JS_PROP_C_W_E);
    
    SET_UINT64_FIELD(dev);
    SET_UINT64_FIELD(mode);
    SET_UINT64_FIELD(nlink);
    SET_UINT64_FIELD(uid);
    SET_UINT64_FIELD(gid);
    SET_UINT64_FIELD(rdev);
    SET_UINT64_FIELD(ino);
    SET_UINT64_FIELD(size);
    SET_UINT64_FIELD(blksize);
    SET_UINT64_FIELD(blocks);
    SET_UINT64_FIELD(flags);
#undef SET_UINT64_FIELD

#define SET_TIMESPEC_FIELD(x) \
    JS_DefinePropertyValueStr(ctx, \
        obj, \
        STRINGIFY(x), \
        TJS_NewDate(ctx, st->st_##x.tv_sec * 1e3 + st->st_##x.tv_nsec / 1e6), \
        JS_PROP_C_W_E);
    SET_TIMESPEC_FIELD(atim);
    SET_TIMESPEC_FIELD(mtim);
    SET_TIMESPEC_FIELD(ctim);
    SET_TIMESPEC_FIELD(birthtim);
#undef SET_TIMESPEC_FIELD

    JS_SetOpaque(obj, sr);
    return obj;
}

static TJSStatResult *tjs_stat_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, tjs_stat_class_id);
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
            arg = tjs_new_stat(ctx, &fr->req.statbuf);
            break;

        case UV_FS_REALPATH:
            arg = JS_NewString(ctx, fr->req.ptr);
            break;

        case UV_FS_COPYFILE:
        case UV_FS_FDATASYNC:
        case UV_FS_FSYNC:
        case UV_FS_FTRUNCATE:
        case UV_FS_MKDIR:
        case UV_FS_RENAME:
        case UV_FS_RMDIR:
        case UV_FS_UNLINK:
        case UV_FS_CHOWN:
        case UV_FS_LCHOWN:
        case UV_FS_CHMOD:
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
                JSValue item = tjs_new_dirent(ctx, &d->dirent);
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

/* DirEnt functions */

static JSValue tjs_dirent_name_get(JSContext *ctx, JSValueConst this_val) {
    TJSDirEnt *de = tjs_dirent_get(ctx, this_val);
    if (!de)
        return JS_EXCEPTION;
    return JS_DupValue(ctx, de->name);
}

static JSValue tjs_dirent_isblockdevice(JSContext *ctx, JSValueConst this_val) {
    TJSDirEnt *de = tjs_dirent_get(ctx, this_val);
    if (!de)
        return JS_EXCEPTION;

    return JS_NewBool(ctx, de->type == UV_DIRENT_BLOCK);
}

static JSValue tjs_dirent_ischaracterdevice(JSContext *ctx, JSValueConst this_val) {
    TJSDirEnt *de = tjs_dirent_get(ctx, this_val);
    if (!de)
        return JS_EXCEPTION;

    return JS_NewBool(ctx, de->type == UV_DIRENT_CHAR);
}

static JSValue tjs_dirent_isdirectory(JSContext *ctx, JSValueConst this_val) {
    TJSDirEnt *de = tjs_dirent_get(ctx, this_val);
    if (!de)
        return JS_EXCEPTION;

    return JS_NewBool(ctx, de->type == UV_DIRENT_DIR);
}

static JSValue tjs_dirent_isfifo(JSContext *ctx, JSValueConst this_val) {
    TJSDirEnt *de = tjs_dirent_get(ctx, this_val);
    if (!de)
        return JS_EXCEPTION;

    return JS_NewBool(ctx, de->type == UV_DIRENT_FIFO);
}

static JSValue tjs_dirent_isfile(JSContext *ctx, JSValueConst this_val) {
    TJSDirEnt *de = tjs_dirent_get(ctx, this_val);
    if (!de)
        return JS_EXCEPTION;

    return JS_NewBool(ctx, de->type == UV_DIRENT_FILE);
}

static JSValue tjs_dirent_issocket(JSContext *ctx, JSValueConst this_val) {
    TJSDirEnt *de = tjs_dirent_get(ctx, this_val);
    if (!de)
        return JS_EXCEPTION;

    return JS_NewBool(ctx, de->type == UV_DIRENT_SOCKET);
}

static JSValue tjs_dirent_issymlink(JSContext *ctx, JSValueConst this_val) {
    TJSDirEnt *de = tjs_dirent_get(ctx, this_val);
    if (!de)
        return JS_EXCEPTION;

    return JS_NewBool(ctx, de->type == UV_DIRENT_LINK);
}

/* StatResult functions */

static JSValue tjs_stat_isblockdevice(JSContext *ctx, JSValueConst this_val) {
    TJSStatResult *sr = tjs_stat_get(ctx, this_val);
    if (!sr)
        return JS_EXCEPTION;

    return JS_NewBool(ctx, (sr->st_mode & S_IFMT) == S_IFBLK);
}

static JSValue tjs_stat_ischaracterdevice(JSContext *ctx, JSValueConst this_val) {
    TJSStatResult *sr = tjs_stat_get(ctx, this_val);
    if (!sr)
        return JS_EXCEPTION;

    return JS_NewBool(ctx, (sr->st_mode & S_IFMT) == S_IFCHR);
}

static JSValue tjs_stat_isdirectory(JSContext *ctx, JSValueConst this_val) {
    TJSStatResult *sr = tjs_stat_get(ctx, this_val);
    if (!sr)
        return JS_EXCEPTION;

    return JS_NewBool(ctx, (sr->st_mode & S_IFMT) == S_IFDIR);
}

static JSValue tjs_stat_isfifo(JSContext *ctx, JSValueConst this_val) {
    TJSStatResult *sr = tjs_stat_get(ctx, this_val);
    if (!sr)
        return JS_EXCEPTION;

    return JS_NewBool(ctx, (sr->st_mode & S_IFMT) == S_IFIFO);
}

static JSValue tjs_stat_isfile(JSContext *ctx, JSValueConst this_val) {
    TJSStatResult *sr = tjs_stat_get(ctx, this_val);
    if (!sr)
        return JS_EXCEPTION;

    return JS_NewBool(ctx, (sr->st_mode & S_IFMT) == S_IFREG);
}

static JSValue tjs_stat_issocket(JSContext *ctx, JSValueConst this_val) {
    TJSStatResult *sr = tjs_stat_get(ctx, this_val);
    if (!sr)
        return JS_EXCEPTION;

#if defined(S_IFSOCK)
    return JS_NewBool(ctx, (sr->st_mode & S_IFMT) == S_IFSOCK);
#else
    return JS_FALSE;
#endif
}

static JSValue tjs_stat_issymlink(JSContext *ctx, JSValueConst this_val) {
    TJSStatResult *sr = tjs_stat_get(ctx, this_val);
    if (!sr)
        return JS_EXCEPTION;

    return JS_NewBool(ctx, (sr->st_mode & S_IFMT) == S_IFLNK);
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

    mode = 0666;
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

static JSValue tjs_fs_mkdir(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    int32_t mode = 0777;
    if (argc >= 2 && !JS_IsUndefined(argv[1])) {
        if (JS_ToInt32(ctx, &mode, argv[1])) {
            JS_FreeCString(ctx, path);
            return JS_EXCEPTION;
        }
    }

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    int r = uv_fs_mkdir(tjs_get_loop(ctx), &fr->req, path, mode, uv__fs_req_cb);
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

static JSValue tjs_fs_xchown(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv, bool symlinks) {
    if (!JS_IsString(argv[0]))
        return JS_ThrowTypeError(ctx, "expected a string for path parameter");

    int uid;
    if (JS_IsUndefined(argv[1]) || JS_ToInt32(ctx, &uid, argv[1]))
        return JS_ThrowTypeError(ctx, "expected a number for uid parameter");

    int gid;
    if (JS_IsUndefined(argv[2]) || JS_ToInt32(ctx, &gid, argv[2]))
        return JS_ThrowTypeError(ctx, "expected a number for gid parameter");

    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    int r = (symlinks ? uv_fs_chown : uv_fs_lchown)(tjs_get_loop(ctx), &fr->req, path, uid, gid, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static JSValue tjs_fs_chown(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    return tjs_fs_xchown(ctx, this_val, argc, argv, true);
}

static JSValue tjs_fs_lchown(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    return tjs_fs_xchown(ctx, this_val, argc, argv, false);
}

static JSValue tjs_fs_chmod(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    if (!JS_IsString(argv[0]))
        return JS_ThrowTypeError(ctx, "expected a string for path parameter");

    int mode;
    if (JS_IsUndefined(argv[1]) || JS_ToInt32(ctx, &mode, argv[1]))
        return JS_ThrowTypeError(ctx, "expected a number for mode parameter");

    const char *path = JS_ToCString(ctx, argv[0]);
    if (!path)
        return JS_EXCEPTION;

    TJSFsReq *fr = js_malloc(ctx, sizeof(*fr));
    if (!fr) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    int r = uv_fs_chmod(tjs_get_loop(ctx), &fr->req, path, mode, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    if (r != 0) {
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, r);
    }

    return tjs_fsreq_init(ctx, fr, JS_UNDEFINED);
}

static const JSCFunctionListEntry tjs_file_proto_funcs[] = {
    TJS_CFUNC_MAGIC_DEF("read", 2, tjs_file_rw, 0),
    TJS_CFUNC_MAGIC_DEF("write", 2, tjs_file_rw, 1),
    TJS_CFUNC_DEF("close", 0, tjs_file_close),
    TJS_CFUNC_DEF("fileno", 0, tjs_file_fileno),
    TJS_CFUNC_DEF("stat", 0, tjs_file_stat),
    TJS_CFUNC_DEF("truncate", 1, tjs_file_truncate),
    TJS_CFUNC_DEF("sync", 0, tjs_file_sync),
    TJS_CFUNC_DEF("datasync", 0, tjs_file_datasync),
    TJS_CGETSET_DEF("path", tjs_file_path_get, NULL),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "FileHandle", JS_PROP_C_W_E),
};

static const JSCFunctionListEntry tjs_dir_proto_funcs[] = {
    TJS_CFUNC_DEF("close", 0, tjs_dir_close),
    JS_CGETSET_DEF("path", tjs_dir_path_get, NULL),
    TJS_CFUNC_DEF("next", 0, tjs_dir_next),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "DirHandle", JS_PROP_C_W_E),
    TJS_CFUNC_DEF("[Symbol.asyncIterator]", 0, tjs_dir_iterator),
};

static const JSCFunctionListEntry tjs_dirent_proto_funcs[] = {
    TJS_CGETSET_DEF("isBlockDevice", tjs_dirent_isblockdevice, NULL),
    TJS_CGETSET_DEF("isCharacterDevice", tjs_dirent_ischaracterdevice, NULL),
    TJS_CGETSET_DEF("isDirectory", tjs_dirent_isdirectory, NULL),
    TJS_CGETSET_DEF("isFIFO", tjs_dirent_isfifo, NULL),
    TJS_CGETSET_DEF("isFile", tjs_dirent_isfile, NULL),
    TJS_CGETSET_DEF("isSocket", tjs_dirent_issocket, NULL),
    TJS_CGETSET_DEF("isSymbolicLink", tjs_dirent_issymlink, NULL),
    TJS_CGETSET_DEF("name", tjs_dirent_name_get, NULL),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "DirEnt", JS_PROP_C_W_E),
};

static const JSCFunctionListEntry tjs_stat_proto_funcs[] = {
    TJS_CGETSET_DEF("isBlockDevice", tjs_stat_isblockdevice, NULL),
    TJS_CGETSET_DEF("isCharacterDevice", tjs_stat_ischaracterdevice, NULL),
    TJS_CGETSET_DEF("isDirectory", tjs_stat_isdirectory, NULL),
    TJS_CGETSET_DEF("isFIFO", tjs_stat_isfifo, NULL),
    TJS_CGETSET_DEF("isFile", tjs_stat_isfile, NULL),
    TJS_CGETSET_DEF("isSocket", tjs_stat_issocket, NULL),
    TJS_CGETSET_DEF("isSymbolicLink", tjs_stat_issymlink, NULL),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "StatResult", JS_PROP_C_W_E),
};

static const JSCFunctionListEntry tjs_fs_funcs[] = {
    TJS_CONST2("COPYFILE_EXCL", UV_FS_COPYFILE_EXCL),
    TJS_CONST2("COPYFILE_FICLONE", UV_FS_COPYFILE_FICLONE),
    TJS_CONST2("COPYFILE_FICLONE_FORCE", UV_FS_COPYFILE_FICLONE_FORCE),
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
    TJS_CFUNC_DEF("mkdir", 2, tjs_fs_mkdir),
    TJS_CFUNC_DEF("copyfile", 3, tjs_fs_copyfile),
    TJS_CFUNC_DEF("readdir", 1, tjs_fs_readdir),
    TJS_CFUNC_DEF("readFile", 1, tjs_fs_readfile),
    TJS_CFUNC_DEF("chown", 3, tjs_fs_chown),
    TJS_CFUNC_DEF("lchown", 3, tjs_fs_lchown),
    TJS_CFUNC_DEF("chmod", 2, tjs_fs_chmod),
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

    /* DirEnt object */
    JS_NewClassID(&tjs_dirent_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_dirent_class_id, &tjs_dirent_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_dirent_proto_funcs, countof(tjs_dirent_proto_funcs));
    JS_SetClassProto(ctx, tjs_dirent_class_id, proto);

    /* StatResult object */
    JS_NewClassID(&tjs_stat_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_stat_class_id, &tjs_stat_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_stat_proto_funcs, countof(tjs_stat_proto_funcs));
    JS_SetClassProto(ctx, tjs_stat_class_id, proto);

    JS_SetPropertyFunctionList(ctx, ns, tjs_fs_funcs, countof(tjs_fs_funcs));
}

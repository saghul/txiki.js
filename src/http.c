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

const static int   BACKLOG  = 128;

typedef struct {
    JSContext *ctx;
    uv_tcp_t server;
    char *server;
    int port;
} QUVHttp;

static JSClassID quv_http_class_id;

/*void close_cb(uv_handle_t *handle) {
  client_t *client = (client_t *) handle->data;
  free(client);
}

void shutdown_cb(uv_shutdown_t *shutdown_req, int status) {
  uv_close((uv_handle_t *) shutdown_req->handle, close_cb);
  free(shutdown_req);
}

void alloc_cb(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
  buf->base = malloc(suggested_size);
  buf->len = suggested_size;
  ASSERT(buf->base != NULL);
}

void read_cb(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf) {
  int r = 0;
  client_t *client = (client_t *) handle->data;

  if (nread >= 0) {
    size_t parsed = http_parser_execute(&client->parser, &parser_settings, buf->base, nread);

    if (parsed < nread) {
      LOG("parse error\n");
      uv_close((uv_handle_t *) handle, close_cb);
    }

  } else {
    if (nread == UV_EOF) {
      // do nothing
    } else {
      LOGF("read: %s\n", uv_strerror(nread));
    }

    uv_shutdown_t *shutdown_req = malloc(sizeof(uv_shutdown_t));
    r = uv_shutdown(shutdown_req, handle, shutdown_cb);
    ASSERT(r == 0);
  }
  free(buf->base);
}

void connection_cb(uv_stream_t *server, int status) {
  ASSERT(status == 0);

  uv_tcp_t client_handle;

  int r = uv_tcp_init(server->loop, &client_handle);
  ASSERT(r == 0);

  r = uv_accept(server, (uv_stream_t *) &client_handle);
  if (r) {
    uv_shutdown_t *shutdown_req = malloc(sizeof(uv_shutdown_t));
    uv_shutdown(shutdown_req, (uv_stream_t *) &client_handle, shutdown_cb);
    ASSERT(r == 0);
  }

  r = uv_read_start((uv_stream_t *) &client->handle, alloc_cb, read_cb);
}

void write_cb(uv_write_t* write_req, int status) {
  uv_close((uv_handle_t *) write_req->handle, close_cb);
  free(write_req);
}

int headers_complete_cb(http_parser* parser) {
  client_t *client = (client_t *) parser->data;

  uv_write_t *write_req = malloc(sizeof(uv_write_t));
  uv_buf_t buf = uv_buf_init(RESPONSE, sizeof(RESPONSE));
  int r = uv_write(write_req, (uv_stream_t *) &client->handle, &buf, 1, write_cb);
  ASSERT(r == 0);

  return 1;
}*/

static void uv__http_close_cb(uv_handle_t *handle) {
    QUVHttp *h = handle->data;
    CHECK_NOT_NULL(u);
    u->closed = 1;
    if (u->finalized)
        free(u);
}

static void maybe_close(QUVHttp *h) {
    if (!uv_is_closing((uv_handle_t *) &h->http))
        uv_close((uv_handle_t *) &h->http, uv__http_close_cb);
}

static void quv_http_finalizer(JSRuntime *rt, JSValue val) {
    QUVHttp *h = JS_GetOpaque(val, quv_http_class_id);
    if (u) {
        QUV_FreePromiseRT(rt, &h->read.result);
        JS_FreeValueRT(rt, u->read.b.buffer);
        u->finalized = 1;
        if (u->closed)
            free(u);
        else
            maybe_close(u);
    }
}

static void quv_http_mark(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func) {
    QUVHttp *h = JS_GetOpaque(val, quv_http_class_id);
    if (u) {
        QUV_MarkPromise(rt, &h->read.result, mark_func);
        JS_MarkValue(rt, u->read.b.buffer, mark_func);
    }
}

static JSClassDef quv_http_class = {
    "HTTP",
    .finalizer = quv_http_finalizer,
    .gc_mark = quv_http_mark,
};

static QUVHttp *quv_http_get(JSContext *ctx, JSValueConst obj) {
    return JS_GetOpaque2(ctx, obj, quv_http_class_id);
}

static JSValue quv_new_http(JSContext *ctx, const char *host, int port) {
    QUVHttp *h;
    JSValue obj;
    int r;

    obj = JS_NewObjectClass(ctx, quv_http_class_id);
    if (JS_IsException(obj))
        return obj;

    h = calloc(1, sizeof(*h));
    if (!h) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    uv_loop_t *loop = quv_get_loop(ctx)
    int r = uv_tcp_init(loop, &h->server);
    if (r) {
        JS_FreeValue(ctx, obj);
        free(h);
        return JS_ThrowInternalError(ctx, "couldn't uv_tcp_init");
    }
    struct sockaddr_in addr;
    r = uv_ip4_addr(host, port, &addr);
    if (r) {
        JS_FreeValue(ctx, obj);
        free(h);
        return JS_ThrowInternalError(ctx, "couldn't uv_ip4_addr");
    }
    r = uv_tcp_bind(&server, (struct sockaddr *) &addr, 0);
    if (r) {
        JS_FreeValue(ctx, obj);
        free(h);
        return JS_ThrowInternalError(ctx, "couldn't uv_tcp_bind");
    }
    r = uv_listen((uv_stream_t *) &server, BACKLOG, connection_cb);
    if (r) {
        JS_FreeValue(ctx, obj);
        free(h);
        return JS_ThrowInternalError(ctx, "couldn't uv_listen");
    }

    h->host = host;
    h->port = port;

    JS_SetOpaque(obj, h);
    return obj;
}

static JSValue quv_http_constructor(JSContext *ctx, JSValueConst new_target, int argc, JSValueConst *argv) {
    const char *host;
    int port;

    host = JS_ToCString(ctx, argv[0]);
    if (!host)
        return JS_EXCEPTION;
    if (JS_ToInt32(ctx, &port, argv[1]))
        return JS_EXCEPTION;

    return quv_new_http(ctx, host, port);
}

static const JSCFunctionListEntry quv_http_proto_funcs[] = {
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "HTTP", JS_PROP_CONFIGURABLE),
};

void quv_mod_http_init(JSContext *ctx, JSModuleDef *m) {
    JSValue proto, obj;

    /* HTTP class */
    JS_NewClassID(&quv_http_class_id);
    JS_NewClass(JS_GetRuntime(ctx), quv_http_class_id, &quv_http_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, quv_http_proto_funcs, countof(quv_http_proto_funcs));
    JS_SetClassProto(ctx, quv_http_class_id, proto);

    /* HTTP object */
    obj = JS_NewCFunction2(ctx, quv_http_constructor, "HTTP", 1, JS_CFUNC_constructor, 0);
    JS_SetModuleExport(ctx, m, "HTTP", obj);
}

void quv_mod_http_export(JSContext *ctx, JSModuleDef *m) {
    JS_AddModuleExport(ctx, m, "HTTP");
}

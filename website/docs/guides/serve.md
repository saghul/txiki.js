---
sidebar_position: 5
title: Serving HTTP
---

# Serving HTTP

txiki.js includes a high-performance HTTP/HTTPS server with WebSocket support. The quickest way to stand one up is the `tjs serve` command, which runs a module that default-exports a `fetch` handler.

## `tjs serve`

```bash
tjs serve app.js
```

The module must `export default` an object with a `fetch` method (and, optionally, `websocket` handlers):

```js
// app.js
export default {
    fetch(request) {
        const url = new URL(request.url);

        return new Response(`Hello World!\nYou requested: ${url.pathname}\n`);
    },
};
```

The handler receives a standard [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and returns a [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) (or a promise resolving to one). On startup, the server prints the address it is listening on:

```
Listening on http://localhost:8000/
```

### Options

| Option | Description |
|--------|-------------|
| `-p`, `--port PORT` | Port to listen on (default `8000`) |
| `--tls-cert FILE` | Path to a TLS certificate PEM file (enables HTTPS) |
| `--tls-key FILE` | Path to the matching TLS private key PEM file |

`--tls-cert` and `--tls-key` must be supplied together.

### The request context

The `fetch` handler receives a second argument — a context object — with the server instance and the remote client address:

```js
export default {
    fetch(request, { server, remoteAddress }) {
        console.log(`request from ${remoteAddress}`);

        return new Response('ok');
    },
};
```

`server` is used to upgrade requests to WebSockets (see below).

## WebSockets

To accept WebSocket connections, call `server.upgrade(request)` from the `fetch` handler when an upgrade is requested, and provide a `websocket` object with event handlers:

```js
// ws-echo-server.js — run with: tjs serve ws-echo-server.js
export default {
    fetch(request, { server }) {
        if (request.headers.get('upgrade') === 'websocket') {
            server.upgrade(request);

            return;
        }

        return new Response('This is a WebSocket server.\n');
    },
    websocket: {
        open(ws) {
            console.log('Client connected');
        },
        message(ws, data) {
            ws.sendText(`echo: ${data}`);
        },
        close(ws, code, reason) {
            console.log(`Client disconnected: ${code} ${reason}`);
        },
    },
};
```

`server.upgrade()` must be called synchronously inside `fetch`, and the handler should return without a `Response` once it does. The connection object passed to the handlers exposes:

| Member | Description |
|--------|-------------|
| `ws.sendText(string)` | Send a text message |
| `ws.sendBinary(Uint8Array)` | Send a binary message |
| `ws.close(code?, reason?)` | Close the connection |
| `ws.data` | Arbitrary data associated at upgrade time via `server.upgrade(request, { data })` |

## HTTPS

Generate a self-signed certificate for local testing:

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'
```

Then serve over HTTPS:

```bash
tjs serve --tls-cert cert.pem --tls-key key.pem app.js
```

The startup log reflects the `https://` scheme.

## Programmatic API

`tjs serve` is a thin wrapper around [`tjs.serve()`](/docs/api/global.tjs.Function.serve), which you can call directly for full control — custom bind address, TLS configuration as in-memory PEM strings, graceful shutdown, and more:

```js
const cert = new TextDecoder().decode(await tjs.readFile('cert.pem'));
const key = new TextDecoder().decode(await tjs.readFile('key.pem'));

const server = tjs.serve({
    port: 8443,
    tls: { cert, key },
    fetch(request) {
        return new Response('Hello HTTPS!\n');
    },
});

console.log(`Listening on https://localhost:${server.port}/`);
```

A shorthand form accepts just the `fetch` handler:

```js
const server = tjs.serve((request) => new Response('Hello!'));
```

The returned [`Server`](/docs/api/global.tjs.Interface.Server) exposes `server.port` and `await server.close()`. It is also async-disposable, so `await using server = tjs.serve(...)` closes it automatically at the end of the scope. See [`ServeOptions`](/docs/api/global.tjs.Interface.ServeOptions) for the full set of options, including the [`TlsOptions`](/docs/api/global.tjs.Interface.TlsOptions) `ca`, `passphrase`, and `requestCert` fields for mutual TLS.

### HTTP/2

HTTPS connections negotiate HTTP/2 automatically via ALPN: a client that advertises `h2` gets HTTP/2, otherwise the connection falls back to HTTP/1.1. The request handler is identical either way.

To restrict which protocols the server offers, set `tls.alpn` to a list in preference order. For example, `alpn: ['h2']` requires HTTP/2 — a client that cannot speak it has no protocol in common and fails the TLS handshake instead of downgrading:

```js
tjs.serve({
    tls: { cert, key, alpn: ['h2'] },
    fetch(request) {
        return new Response('HTTP/2 only\n');
    },
});
```

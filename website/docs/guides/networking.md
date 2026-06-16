---
sidebar_position: 2
title: Networking
---

# Networking

txiki.js provides low-level networking through the WHATWG [Direct Sockets](https://wicg.github.io/direct-sockets/) API, exposed as global socket constructors. Every socket is stream-based: connecting (or accepting) resolves to a `{ readable, writable, ... }` object you read from and write to with the standard Web Streams API.

There are two ways to create sockets:

- The **global socket classes** (`TCPSocket`, `TLSSocket`, `UDPSocket`, `PipeSocket`, and their server variants). This is the primary, example-driven API.
- A **Promise-based** `tjs.connect()` / `tjs.listen()` shorthand in the `tjs` namespace that returns the same socket objects.

## The socket model

Each socket constructor returns immediately. The connection (or listener) is established asynchronously, so you `await` the readonly `.opened` Promise to get the streams and address info:

```js
const sock = new TCPSocket('example.com', 80);
const { readable, writable, remoteAddress, remotePort } = await sock.opened;
```

| Member | Description |
|--------|-------------|
| `opened` | Promise that resolves with the open info (`{ readable, writable, ... }`) once connected, or rejects on failure |
| `closed` | Promise that resolves once the socket is fully torn down |
| `close()` | Initiates close; `await socket.closed` to wait for full teardown |

Client sockets resolve `opened` to a duplex pair: a `readable` (a `ReadableStream<Uint8Array>`) and a `writable` (a `WritableStream<Uint8Array>`). **Server** sockets resolve `opened` to a `readable` whose chunks are *accepted client sockets* — you iterate it to accept connections.

All socket classes implement `AsyncDisposable`, so `await using` closes them automatically at the end of the scope (see [Auto-close with `await using`](#auto-close-with-await-using)).

## TCP

### Echo server

A TCP server resolves `opened` to a `readable` stream of accepted `TCPSocket` instances. Read it in a loop to accept connections, then handle each one's own `opened` streams:

```js
async function handleConnection(conn) {
    const { readable, writable, remoteAddress, remotePort } = await conn.opened;

    console.log(`Accepted ${remoteAddress}:${remotePort}`);

    // Echo everything back to the client.
    await readable.pipeTo(writable);
    console.log('connection closed!');
}

const server = new TCPServerSocket('127.0.0.1', { localPort: 1234 });
const { readable, localAddress, localPort } = await server.opened;

console.log(`Listening on ${localAddress}:${localPort}`);

const reader = readable.getReader();

while (true) {
    const { value: conn, done } = await reader.read();

    if (done) {
        break;
    }

    // Handle each connection without blocking the accept loop.
    handleConnection(conn);
}
```

### Client

```js
const client = new TCPSocket('127.0.0.1', 1234);
const { readable, writable, remoteAddress, remotePort } = await client.opened;

console.log(`Connected to ${remoteAddress}:${remotePort}`);

const writer = writable.getWriter();
await writer.write(new TextEncoder().encode('hello\n'));
writer.releaseLock();

const reader = readable.getReader();
const { value } = await reader.read();
console.log(new TextDecoder().decode(value));

client.close();
await client.closed;
```

### Options

`new TCPSocket(remoteAddress, remotePort, options?)`:

| Option | Type | Description |
|--------|------|-------------|
| `noDelay` | `boolean` | Disable Nagle's algorithm |
| `keepAliveDelay` | `number` | TCP keep-alive delay in seconds |
| `dnsQueryType` | `'ipv4' \| 'ipv6'` | Force a resolution family for `remoteAddress` |

`new TCPServerSocket(localAddress, options?)`:

| Option | Type | Description |
|--------|------|-------------|
| `localPort` | `number` | Port to bind (0 or omitted picks a free port) |
| `backlog` | `number` | Pending-connection queue length |
| `ipv6Only` | `boolean` | Bind IPv6 only (no dual-stack) |

## TLS

`TLSSocket` and `TLSServerSocket` mirror the TCP classes but transparently encrypt the connection: the bytes you read and write are always plaintext — TLS framing is handled for you. The open info also carries the negotiated ALPN protocol (`alpn: string | null`).

### Client

By default a client trusts the embedded Mozilla CA bundle. Pass a custom `ca` (and optionally disable verification) to talk to a server with a self-signed certificate, and `sni` / `alpn` to control the handshake:

```js
const ca = new TextDecoder().decode(await tjs.readFile('ca.pem'));

const client = new TLSSocket('localhost', 8443, {
    ca,                       // trust this CA instead of the default bundle
    sni: 'localhost',         // Server Name Indication (defaults to remoteAddress)
    alpn: ['h2', 'http/1.1'], // protocols to offer
    verifyPeer: true,         // default for clients
});

const { readable, writable, alpn } = await client.opened;
console.log(`Negotiated ALPN: ${alpn}`);
```

### Server

A TLS server requires a PEM `cert` and `key`. Accepted clients are `TLSSocket` instances with the handshake already complete:

```js
const cert = new TextDecoder().decode(await tjs.readFile('cert.pem'));
const key = new TextDecoder().decode(await tjs.readFile('key.pem'));

const server = new TLSServerSocket('127.0.0.1', {
    localPort: 8443,
    cert,
    key,
    alpn: ['http/1.1'],
});

const { readable, localPort } = await server.opened;
console.log(`TLS listening on ${localPort}`);

const reader = readable.getReader();

while (true) {
    const { value: conn, done } = await reader.read();
    if (done) {
        break;
    }
    const { readable: r, writable: w } = await conn.opened;
    r.pipeTo(w); // echo
}
```

Generate a self-signed certificate for local testing with:

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'
```

### Mutual TLS

For mutual TLS, the server sets `ca` (the CA that signed acceptable client certificates) plus `verifyPeer: true`, and each client presents its own `cert` / `key`:

```js
// Server: require and verify client certificates.
const server = new TLSServerSocket('127.0.0.1', {
    localPort: 8443,
    cert, key,
    ca: clientCa,
    verifyPeer: true,
});

// Client: present a certificate.
const client = new TLSSocket('localhost', 8443, {
    ca: serverCa,
    cert: clientCert,
    key: clientKey,
});
```

### TLS options

`TLSSocket` accepts every `TCPSocket` option (`noDelay`, `keepAliveDelay`, `dnsQueryType`) plus:

| Option | Type | Description |
|--------|------|-------------|
| `sni` | `string` | Server Name Indication hostname (defaults to `remoteAddress`) |
| `alpn` | `string[]` | ALPN protocol list to negotiate |
| `ca` | `string` | PEM CA certificate(s) to trust (defaults to the Mozilla bundle) |
| `cert` | `string` | PEM client certificate for mutual TLS |
| `key` | `string` | PEM client private key for mutual TLS |
| `verifyPeer` | `boolean` | Verify the peer's certificate (default `true` for clients) |

`TLSServerSocket` requires `cert` and `key`, and additionally accepts `ca`, `verifyPeer`, `alpn`, `localPort`, `backlog`, and `ipv6Only`.

> For HTTP/HTTPS servers you usually want the higher-level [`tjs.serve()`](/docs/api/global.tjs.Function.serve) API instead of raw TLS sockets.

## UDP

`UDPSocket` is a single connectionless object with both `readable` and `writable` streams. Incoming chunks are `UDPMessage` objects (`{ data, remoteAddress, remotePort }`); to send, write a `UDPMessage` with the destination address and port.

```js
const server = new UDPSocket({
    localAddress: '127.0.0.1',
    localPort: 1234,
});
const { readable, writable, localAddress, localPort } = await server.opened;

console.log(`Listening on ${localAddress}:${localPort}`);

const reader = readable.getReader();
const writer = writable.getWriter();

while (true) {
    const { value: msg, done } = await reader.read();
    if (done) {
        break;
    }

    // Echo the datagram back to its sender.
    await writer.write({
        data: msg.data,
        remoteAddress: msg.remoteAddress,
        remotePort: msg.remotePort,
    });
}
```

If you set `remoteAddress` / `remotePort` when constructing the socket, the socket is "connected" and you can write `{ data }` without per-message addressing.

### Multicast

The UDP open info includes a `multicastController` for joining and leaving groups. Combine it with the multicast send options to build a publisher/subscriber:

```js
const sock = new UDPSocket({
    localPort: 5000,
    reuseAddr: true,
    multicastTimeToLive: 4,      // allow up to 4 router hops
    multicastLoopback: true,     // also receive our own packets
    multicastAllowAddressSharing: true, // multiple listeners on the same addr/port
});
const { writable, multicastController } = await sock.opened;

await multicastController.joinGroup('239.1.2.3');
console.log('joined:', multicastController.joinedGroups);

const writer = writable.getWriter();
await writer.write({
    data: new TextEncoder().encode('hello group'),
    remoteAddress: '239.1.2.3',
    remotePort: 5000,
});

// Later, stop receiving.
await multicastController.leaveGroup('239.1.2.3');
```

| `MulticastController` member | Description |
|------------------------------|-------------|
| `joinGroup(ip)` | Join a multicast group (Promise) |
| `leaveGroup(ip)` | Leave a multicast group (Promise) |
| `joinedGroups` | Frozen array of currently joined group addresses |

### UDP options

| Option | Type | Description |
|--------|------|-------------|
| `localAddress` / `localPort` | `string` / `number` | Local bind address and port |
| `remoteAddress` / `remotePort` | `string` / `number` | Default destination (makes the socket "connected") |
| `dnsQueryType` | `'ipv4' \| 'ipv6'` | Force a resolution family |
| `reuseAddr` | `boolean` | Allow reusing the local address |
| `ipv6Only` | `boolean` | Bind IPv6 only |
| `multicastTimeToLive` | `number` | TTL for multicast packets (default `1`) |
| `multicastLoopback` | `boolean` | Loop sent multicast packets back to the sender (default `true`) |
| `multicastAllowAddressSharing` | `boolean` | Permit multiple listeners on the same multicast addr/port (default `false`) |

## Unix domain sockets / named pipes

`PipeSocket` and `PipeServerSocket` use a filesystem path (Unix domain socket) or a named pipe path on Windows. They behave exactly like the TCP classes minus the host/port:

```js
// Server
const server = new PipeServerSocket('/tmp/fooPipe');
const { readable, localAddress } = await server.opened;
console.log(`Listening on ${localAddress}`);

const reader = readable.getReader();
while (true) {
    const { value: conn, done } = await reader.read();
    if (done) {
        break;
    }
    const { readable: r, writable: w } = await conn.opened;
    r.pipeTo(w); // echo
}
```

```js
// Client
const client = new PipeSocket('/tmp/fooPipe');
const { writable } = await client.opened;
const writer = writable.getWriter();
await writer.write(new TextEncoder().encode('ping\n'));
```

`PipeServerSocket` accepts an optional `{ backlog }` option.

## Auto-close with `await using`

Every socket class is async-disposable. With `await using`, the socket's `close()` is called and its `closed` Promise is awaited when the binding leaves scope — even on early return or throw — so you never leak a connection:

```js
async function fetchBanner(host, port) {
    await using client = new TCPSocket(host, port);
    const { readable } = await client.opened;
    const { value } = await readable.getReader().read();
    return new TextDecoder().decode(value);
    // client is closed automatically here
}
```

## Promise-based API

`tjs.connect()` and `tjs.listen()` are thin wrappers that construct the matching socket class and resolve its `opened` Promise — handy when the transport is dynamic. They return the *same* socket objects documented above.

```js
// Connect
const tcp = await tjs.connect('tcp', 'example.com', 80);
const tls = await tjs.connect('tls', 'example.com', 443, { alpn: ['h2'] });
const pipe = await tjs.connect('pipe', '/tmp/fooPipe');
const udp = await tjs.connect('udp', '127.0.0.1', 1234);

// Listen
const tcpServer = await tjs.listen('tcp', '127.0.0.1', 1234);
const tlsServer = await tjs.listen('tls', '127.0.0.1', 8443, { cert, key });
const pipeServer = await tjs.listen('pipe', '/tmp/fooPipe');
```

| Function | Signature |
|----------|-----------|
| `tjs.connect` | `connect(transport, host, port?, options?)` → `Promise<Socket>` |
| `tjs.listen` | `listen(transport, host, port?, options?)` → `Promise<ServerSocket>` |

`transport` is one of `'tcp'`, `'tls'`, `'pipe'`, or `'udp'`. The host is resolved with [`tjs.lookup`](#dns-resolution) before connecting. TLS connect accepts the same `sni` / `alpn` / `ca` / `cert` / `key` / `verifyPeer` fields as `TLSSocket`; TLS listen requires `cert` and `key`.

See the full reference at [`tjs.connect`](/docs/api/global.tjs.Function.connect) and [`tjs.listen`](/docs/api/global.tjs.Function.listen).

## DNS resolution

`tjs.lookup()` performs a `getaddrinfo(3)` lookup. By default it returns the first match as a single `Addr` (`{ family, ip }`); pass `{ all: true }` for every result:

```js
const addr = await tjs.lookup('example.com');
console.log(addr.ip, addr.family);

const all = await tjs.lookup('example.com', { all: true });
for (const a of all) {
    console.log(a.ip);
}
```

| Option | Type | Description |
|--------|------|-------------|
| `family` | `number` | Resolve only this address family, given as a numeric `AF_*` constant (the same value reported in `Addr.family`). To simply force IPv4 or IPv6 when connecting, prefer the socket-level `dnsQueryType: 'ipv4' \| 'ipv6'` option instead. |
| `all` | `boolean` | Return all results as an array instead of the first match |

See [`tjs.lookup`](/docs/api/global.tjs.Function.lookup) for details.

## See also

- [Web Platform APIs](../features/web-platform-apis.md) — `fetch`, `WebSocket`, and other higher-level networking
- [Modules](modules.md) — importing code, including over the network

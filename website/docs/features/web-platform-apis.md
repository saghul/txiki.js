---
sidebar_position: 1
title: Web Platform APIs
---

# Web Platform APIs

txiki.js implements a number of Web Platform APIs to provide a familiar environment for JavaScript developers.

## Supported APIs

| API | Notes |
|-----|-------|
| [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) / [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) | Includes static `AbortSignal.abort()`, `timeout()`, `any()` |
| [atob / btoa](https://developer.mozilla.org/en-US/docs/Web/API/btoa) | Base64 encode/decode |
| [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) | |
| [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) | Cross-worker pub/sub messaging |
| [Channel Messaging API](https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API) | `MessageChannel` / `MessagePort`, transferable across workers |
| [CompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream) / [DecompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream) | Formats: `gzip`, `deflate`, `deflate-raw` |
| [Console](https://developer.mozilla.org/en-US/docs/Web/API/Console) | |
| [Crypto](https://developer.mozilla.org/en-US/docs/Web/API/Crypto) | Includes [SubtleCrypto](#web-crypto-subtlecrypto) |
| [Direct Sockets](https://wicg.github.io/direct-sockets/) | TCP, TLS, UDP and Unix pipe sockets — see the [Networking](../guides/networking.md) guide |
| [DOMException](https://developer.mozilla.org/en-US/docs/Web/API/DOMException) | |
| [Encoding API](https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API) | `TextEncoder` / `TextDecoder`, plus the streaming [`TextEncoderStream`](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoderStream) / [`TextDecoderStream`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream) |
| [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) | |
| [fetch](https://fetch.spec.whatwg.org/) | |
| [File](https://developer.mozilla.org/en-US/docs/Web/API/File) | |
| [FileReader](https://developer.mozilla.org/en-US/docs/Web/API/FileReader) | |
| [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) | |
| [Import attributes](../guides/modules.md#import-attributes) | JSON, text, and bytes |
| [Navigator.userAgentData](https://wicg.github.io/ua-client-hints/#interface) | |
| [Performance](https://developer.mozilla.org/en-US/docs/Web/API/Performance) | |
| [queueMicrotask](https://developer.mozilla.org/en-US/docs/Web/API/queueMicrotask) | |
| [setTimeout, setInterval](https://developer.mozilla.org/en-US/docs/Web/API/setTimeout) | |
| [Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) | `localStorage` persists to SQLite at `$TJS_HOME/localStorage.db`; `sessionStorage` is in-memory |
| [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) | |
| [structuredClone](https://developer.mozilla.org/en-US/docs/Web/API/structuredClone) | |
| [URL](https://developer.mozilla.org/en-US/docs/Web/API/URL) | |
| [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) | |
| [URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) | |
| [WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly) | Interpreter-based ([WAMR](https://github.com/bytecodealliance/wasm-micro-runtime)); some [limitations](#webassembly) |
| [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) | [Extensions](#websocket--websocketstream-headers) |
| [WebSocketStream](https://developer.mozilla.org/en-US/docs/Web/API/WebSocketStream) | [Extensions](#websocket--websocketstream-headers) |
| [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Worker) | Structured-clone messaging with transferables (`ArrayBuffer`, `MessagePort`) |
| [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) | |

## Web Crypto (SubtleCrypto)

The global `crypto` object implements both [`getRandomValues()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues) / [`randomUUID()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID) and the full [`crypto.subtle`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) ([`SubtleCrypto`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)) API.

All twelve `SubtleCrypto` methods are available: `digest`, `encrypt`, `decrypt`, `sign`, `verify`, `generateKey`, `deriveBits`, `deriveKey`, `importKey`, `exportKey`, `wrapKey`, and `unwrapKey`.

| Category | Algorithms |
|----------|-----------|
| Digest | SHA-1, SHA-256, SHA-384, SHA-512 |
| Symmetric encryption | AES-CBC, AES-CTR, AES-GCM |
| Key wrapping | AES-KW, plus `wrapKey`/`unwrapKey` with the encryption algorithms |
| Asymmetric encryption | RSA-OAEP |
| Signatures | RSASSA-PKCS1-v1_5, RSA-PSS, ECDSA, Ed25519, HMAC |
| Key agreement | ECDH, X25519 |
| Key derivation | PBKDF2, HKDF |

```js
// Hash some bytes.
const data = new TextEncoder().encode('hello world');
const digest = await crypto.subtle.digest('SHA-256', data);
console.log(new Uint8Array(digest));

// Generate an AES-GCM key and encrypt.
const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12));
const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
```

For synchronous, streaming, or MD5/SHA-3 hashing, see the [`tjs:hashing`](../guides/hashing.md) standard-library module.

## Extensions

### WebSocket / WebSocketStream headers

Both `WebSocket` and `WebSocketStream` support setting custom HTTP headers on the client handshake request. This is a non-standard extension useful for authentication, API keys, and other scenarios where you need to send headers during the WebSocket upgrade.

Certain headers related to the WebSocket handshake itself (e.g. `Connection`, `Upgrade`, `Sec-WebSocket-*`) are forbidden and will throw a `TypeError`.

#### WebSocket

Instead of passing protocols as the second argument, pass an options object with `headers` (and optionally `protocols`):

```js
const ws = new WebSocket('wss://example.com/ws', {
    protocols: ['chat'],
    headers: {
        'Authorization': 'Bearer my-token',
        'X-Custom-Header': 'value',
    },
});
```

The `headers` option accepts a plain object, a `Headers` instance, or an array of `[name, value]` pairs.

#### WebSocketStream

Pass `headers` in the options object:

```js
const wss = new WebSocketStream('wss://example.com/ws', {
    protocols: ['chat'],
    headers: {
        'Authorization': 'Bearer my-token',
    },
});

const { readable, writable } = await wss.opened;
```

## WebAssembly

WebAssembly is powered by the [WAMR](https://github.com/bytecodealliance/wasm-micro-runtime) interpreter. Most of the JavaScript API is implemented:

- `WebAssembly.validate()`, `compile()`, `instantiate()`, and the `compileStreaming()` / `instantiateStreaming()` variants.
- `Module` (including `Module.exports()` and `Module.imports()`), `Instance`, `Memory`, `Table`, `Global`, and the `CompileError` / `LinkError` / `RuntimeError` types.
- Function, global, and memory imports.
- The reference-types, SIMD, and bulk-memory proposals. `externref` / `funcref` work for exported functions, globals, and tables.

The following are **not** currently supported:

- **Table imports** — a `Table` cannot be supplied through the import object. Table *exports* work.
- **Reference types in imported functions** — `externref` / `funcref` as parameters or results of JS-backed imported functions.
- **Multi-value returns from imported functions** — multi-value returns from *exported* functions work.
- **Re-instantiating a `Module` with different imports** — imports are resolved at the module level, so passing a new import object to a second `new WebAssembly.Instance(module, ...)` reuses the first set. Use `WebAssembly.instantiate(bytes, importObject)` to get independent instances.

To run WASI modules, see [`tjs:wasi`](../api/tjs-wasi.md).

## WinterTC compliance

txiki.js aims to be [WinterTC](https://wintertc.org/) compliant. You can track the progress [here](https://github.com/saghul/txiki.js/issues/418).

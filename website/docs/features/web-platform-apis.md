---
sidebar_position: 1
title: Web Platform APIs
---

# Web Platform APIs

txiki.js implements a number of Web Platform APIs to provide a familiar environment for JavaScript developers.

## Supported APIs

| API | Notes |
|-----|-------|
| [Console](https://developer.mozilla.org/en-US/docs/Web/API/Console) | |
| [Crypto](https://developer.mozilla.org/en-US/docs/Web/API/Crypto) | No subtle support |
| [Direct Sockets](https://wicg.github.io/direct-sockets/) | |
| [Encoding API](https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API) | |
| [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) | |
| [fetch](https://fetch.spec.whatwg.org/) | |
| [JSON modules](https://github.com/tc39/proposal-json-modules) | |
| [Navigator.userAgentData](https://wicg.github.io/ua-client-hints/#interface) | |
| [Performance](https://developer.mozilla.org/en-US/docs/Web/API/Performance) | |
| [setTimeout, setInterval](https://developer.mozilla.org/en-US/docs/Web/API/setTimeout) | |
| [Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) | |
| [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) | |
| [URL](https://developer.mozilla.org/en-US/docs/Web/API/URL) | |
| [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) | |
| [URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) | |
| [WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly) | No tables, globals or memory support |
| [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) | [Extensions](#websocket--websocketstream-headers) |
| [WebSocketStream](https://developer.mozilla.org/en-US/docs/Web/API/WebSocketStream) | [Extensions](#websocket--websocketstream-headers) |
| [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Worker) | |

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

## WinterTC compliance

txiki.js aims to be [WinterTC](https://wintertc.org/) compliant. You can track the progress [here](https://github.com/saghul/txiki.js/issues/418).

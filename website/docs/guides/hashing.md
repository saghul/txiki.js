---
sidebar_position: 6
title: Hashing
---

# Hashing

The `tjs:hashing` module computes cryptographic hashes synchronously, with support for incremental (streaming) input and a range of algorithms including MD5, SHA-1, SHA-2, and SHA-3.

## Quick start

Create a hash, feed it bytes, then read the digest:

```js
import { createHash } from 'tjs:hashing';

const bytes = new TextEncoder().encode('hello world');
const digest = createHash('sha256').update(bytes).digest();

console.log(digest);
// b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
```

`createHash()` returns a `Hash` object. `update()` is chainable, so a one-shot hash fits on a single line.

## API

### `createHash(type)`

Creates a `Hash` for the given algorithm. `type` is case-insensitive (`'SHA256'` and `'sha256'` are equivalent). An unknown type throws a `TypeError`.

### `Hash` methods

| Method | Returns | Description |
| --- | --- | --- |
| `update(data)` | `Hash` | Feeds `data` (a `Uint8Array`) into the hash. Chainable and may be called any number of times. |
| `digest()` | `string` | Finalizes the hash and returns it as a lowercase hex string. |
| `bytes()` | `Uint8Array` | Finalizes the hash and returns the raw digest bytes. |

`update()` takes bytes. To hash a string, encode it first with `TextEncoder`:

```js
import { createHash } from 'tjs:hashing';

const data = new TextEncoder().encode('the quick brown fox');
const hash = createHash('sha1').update(data);

console.log(hash.digest());
```

## Hex vs raw bytes

`digest()` and `bytes()` produce the same hash in two representations. Use `digest()` when you want a printable/storable string, and `bytes()` when you need the raw value (for example, to compare against another buffer or to use as a key):

```js
import { createHash } from 'tjs:hashing';

const data = new TextEncoder().encode('txiki.js');

const hex = createHash('sha256').update(data).digest();
const raw = createHash('sha256').update(data).bytes();

console.log(typeof hex);          // string
console.log(raw instanceof Uint8Array, raw.length); // true 32
```

Both methods finalize the hash and cache the result, so you can call them more than once on the same `Hash` and get the same value. Do not call `update()` after finalizing — feed all input first, then read the digest.

## Streaming larger input

Because `update()` accumulates state, you can hash data incrementally instead of buffering it all in memory. This is handy for large files or data arriving in chunks:

```js
import { createHash } from 'tjs:hashing';

const hash = createHash('sha256');
const file = await tjs.open('big-file.bin', 'r');
const buf = new Uint8Array(65536);

while (true) {
    const n = await file.read(buf);

    if (n === null) {
        break;
    }

    hash.update(buf.subarray(0, n));
}

await file.close();
console.log(hash.digest());
```

Chained calls work the same way — each `update()` adds to the running hash:

```js
import { createHash } from 'tjs:hashing';

const enc = new TextEncoder();
const digest = createHash('sha512')
    .update(enc.encode('part one '))
    .update(enc.encode('part two'))
    .digest();

console.log(digest);
```

## Supported algorithms

`SUPPORTED_TYPES` lists every accepted algorithm name:

```js
import { SUPPORTED_TYPES } from 'tjs:hashing';

console.log(SUPPORTED_TYPES);
// [
//   'md5', 'sha1', 'sha224', 'sha256',
//   'sha384', 'sha512', 'sha512_224', 'sha512_256',
//   'sha3_224', 'sha3_256', 'sha3_384', 'sha3_512'
// ]
```

| Family | Algorithms |
| --- | --- |
| MD5 | `md5` |
| SHA-1 | `sha1` |
| SHA-2 | `sha224`, `sha256`, `sha384`, `sha512`, `sha512_224`, `sha512_256` |
| SHA-3 | `sha3_224`, `sha3_256`, `sha3_384`, `sha3_512` |

Pass any of these names to `createHash()`. You can also validate input against the list before hashing:

```js
import { createHash, SUPPORTED_TYPES } from 'tjs:hashing';

function hashWith(type, bytes) {
    if (!SUPPORTED_TYPES.includes(type.toLowerCase())) {
        throw new Error(`unsupported hash: ${type}`);
    }

    return createHash(type).update(bytes).digest();
}
```

## vs Web Crypto

txiki.js also ships the [Web Platform Web Crypto API](../features/web-platform-apis.md) via `crypto.subtle.digest()`. The two cover different needs:

| | `tjs:hashing` | `crypto.subtle.digest()` |
| --- | --- | --- |
| Style | Synchronous | Asynchronous (returns a `Promise`) |
| Input | Streaming via repeated `update()` | One-shot — whole buffer at once |
| Output | Hex string or `Uint8Array` | `ArrayBuffer` (raw bytes) |
| Algorithms | Includes MD5 and SHA-3 | SHA-1, SHA-256, SHA-384, SHA-512 only |

Reach for `tjs:hashing` when you want a synchronous call, need to stream data through `update()`, or need MD5 or SHA-3. Reach for Web Crypto when you want standards-compatible code that also runs in browsers:

```js
const data = new TextEncoder().encode('hello world');
const buf = await crypto.subtle.digest('SHA-256', data);
const hex = [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

console.log(hex);
```

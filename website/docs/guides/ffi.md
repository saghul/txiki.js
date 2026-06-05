---
sidebar_position: 6
title: FFI (Native Libraries)
---

# FFI (Native Libraries)

The `tjs:ffi` module lets you call functions in native shared libraries directly
from JavaScript — no C compiler, no build step, no bindings to maintain. It is
built on [libffi](https://sourceware.org/libffi/) and supports scalar types,
strings, buffers, pointers, structs, and callbacks.

> FFI is inherently unsafe: you are calling arbitrary native code with
> JavaScript-supplied arguments. A wrong type or a stale pointer can crash the
> process. Treat the signatures you declare as a contract you must get right.

## Loading a library

The quickest way in is [`dlopen`](/docs/api/tjs-ffi.Function.dlopen): give it a
library path and a description of the symbols you want, and it returns ready-to-call functions.

```javascript
import { dlopen, Lib } from 'tjs:ffi';

const { symbols, close } = dlopen(Lib.LIBC_NAME, {
    getpid: { returns: 'i32' },
    abs: { args: ['i32'], returns: 'i32' },
});

console.log('pid:', symbols.getpid());
console.log('abs(-5):', symbols.abs(-5));

close(); // release the library handle when done
```

`Lib.LIBC_NAME` and `Lib.LIBM_NAME` resolve to the platform's C and math
libraries. For your own libraries, build the path with the platform-specific
`suffix`:

```javascript
import { suffix } from 'tjs:ffi';

const path = `./libmystuff.${suffix}`; // dylib / so / dll
```

## Types

Each argument and the return value need a type. Types can be given as string
aliases or as objects from the [`types`](/docs/api/tjs-ffi.Variable.types) table.

| Alias | C type |
|-------|--------|
| `'i8'` / `'u8'` … `'i64'` / `'u64'` | `int8_t` … `uint64_t` |
| `'int'`, `'long'`, `'char'`, `'size_t'`, … | the matching C type |
| `'f32'`, `'f64'` | `float`, `double` |
| `'ptr'` | `void *` |
| `'string'` | `char *` (auto-converted to/from a JS string) |
| `'buffer'` | `void *` backed by a `Uint8Array` |
| `'void'` | `void` (return only) |

See [`TypeAlias`](/docs/api/tjs-ffi.TypeAlias.TypeAlias.md) for the full list.
`returns` defaults to `'void'` and `args` to `[]`.

## Strings and buffers

`'string'` arguments are transparently converted from a JS string to a
NUL-terminated `char *`, and `'string'` return values are read back into a JS
string. For raw memory, pass a `Uint8Array` as a `'buffer'`:

```javascript
import { dlopen, Lib, bufferToString } from 'tjs:ffi';

const { symbols } = dlopen(Lib.LIBC_NAME, {
    // int snprintf(char *str, size_t size, const char *format, ...);
    snprintf: { args: ['buffer', 'size_t', 'string'], returns: 'int', fixed: 3 },
});

const out = new Uint8Array(64);
symbols.snprintf(out, out.length, 'hello');
console.log(bufferToString(out)); // "hello"
```

### Variadic functions

For variadic C functions, set `fixed` to the number of fixed (non-variadic)
arguments. Above, `snprintf` has three fixed parameters before the `...`.

## Structs

Use the lower-level [`Lib`](/docs/api/tjs-ffi.Class.Lib) /
[`CFunction`](/docs/api/tjs-ffi.Class.CFunction) API together with
[`StructType`](/docs/api/tjs-ffi.Class.StructType) to pass or return structs by
value. Field layout (including padding) is computed for you.

```javascript
import { Lib, CFunction, StructType, types } from 'tjs:ffi';

const lib = new Lib(`./libmystuff.${suffix}`);

// struct point { int x; int y; };
const Point = new StructType([['x', types.sint], ['y', types.sint]], 'point');

// struct point make_point(int x, int y);
const makePoint = new CFunction(lib.symbol('make_point'), Point, [types.sint, types.sint]);

console.log(makePoint.call(3, 4)); // { x: 3, y: 4 }
```

## Callbacks

Wrap a JS function in a [`JSCallback`](/docs/api/tjs-ffi.Class.JSCallback) to
pass it where C expects a function pointer.

```javascript
import { Lib, CFunction, JSCallback, types } from 'tjs:ffi';

const lib = new Lib(`./libmystuff.${suffix}`);

// int call_it(int (*fn)(int), int arg);
const callIt = new CFunction(lib.symbol('call_it'), types.sint, [types.jscallback, types.sint]);

const cb = new JSCallback(types.sint, [types.sint], (n) => n * 2);

console.log(callIt.call(cb, 21)); // 42
```

Keep the `JSCallback` alive for as long as C might call it; if it is garbage
collected, the function pointer becomes dangling.

## Pointers

Functions that return or accept pointers work with
[`NativePointer`](/docs/api/tjs-ffi.Interface.NativePointer), an opaque handle to
a native address. You can offset it, compare it, and read typed values out of it
with the [`read`](/docs/api/tjs-ffi.Variable.read) helpers:

```javascript
import { read } from 'tjs:ffi';

const p = symbols.get_thing();   // returns a NativePointer
const first = read.i32(p);       // read an int32 at p
const second = read.i32(p, 4);   // read an int32 at p + 4 bytes
const inner = read.ptr(p, 8);    // read a pointer field
```

To go the other way, [`bufferToPointer`](/docs/api/tjs-ffi.Function.bufferToPointer)
gives you a pointer to a `Uint8Array`'s memory.

## Working with native memory (zero-copy)

The `read` helpers copy one value at a time. When a function hands you a pointer
to a block of memory, you can instead get a **zero-copy view** over it — a
`Uint8Array` or `ArrayBuffer` that aliases the native memory directly, with no
copying:

```javascript
const p = symbols.get_pixels();            // NativePointer to width*height*4 bytes
const pixels = p.toUint8Array(w * h * 4);  // a view, not a copy

pixels[0] = 255;                           // writes straight to the native buffer
```

`toArrayBuffer(byteLength, byteOffset?)` returns the buffer instead of a typed
array, and both methods accept a `byteOffset` to start further into the memory:

```javascript
const header = p.toArrayBuffer(16);        // first 16 bytes
const body = p.toUint8Array(len, 16);      // everything after the header
```

### Lifetimes

A zero-copy view aliases memory the runtime does **not** own and does **not**
track. If that memory is freed, reallocated, or moved while a view still points
at it, reading or writing the view is undefined behaviour and can crash the
process. You are responsible for keeping the memory alive for at least as long as
every view over it.

When the memory is owned by a JavaScript object — for example, a `Uint8Array` you
got a pointer into — keep a reference to that object alive for as long as any
view over its memory is in use, so the garbage collector can't reclaim it:

```javascript
import { bufferToPointer } from 'tjs:ffi';

const src = new Uint8Array([1, 2, 3, 4]);
const view = bufferToPointer(src).toUint8Array(src.length);

view[0] = 42;
console.log(src[0]); // 42 — same memory; keep `src` reachable while `view` lives
```

### Freeing native memory

`tjs:ffi` never frees native memory for you. If a library hands you a buffer that
*you* must free, you have two options.

For deterministic cleanup, free it yourself when you're done:

```javascript
const { symbols } = dlopen(Lib.LIBC_NAME, {
    free: { args: ['ptr'] },
});

symbols.free(p);
```

For cleanup tied to the view's lifetime, use a
[`FinalizationRegistry`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry):

```javascript
const registry = new FinalizationRegistry((ptr) => symbols.free(ptr));

const view = p.toUint8Array(len);
registry.register(view, p); // free(p) runs after `view` is collected
```

> Cleanup via `FinalizationRegistry` is **not** guaranteed to run promptly (or at
> all, at shutdown). Prefer explicit freeing when timing matters.

### Invalidating a view

The buffer returned by these methods (and the `.buffer` of a `Uint8Array` view)
is an [`ExternalArrayBuffer`](/docs/api/tjs-ffi.Interface.ExternalArrayBuffer) — a
real `ArrayBuffer` with one extra method, `detach()`. After you free the native
memory, call it to neutralize the view so later access reads empty instead of
touching freed memory:

```javascript
const buf = p.toArrayBuffer(len);
// ... use buf ...
symbols.free(p);
buf.detach(); // buf.byteLength is now 0, buf.detached is true
```

Unlike `ArrayBuffer.prototype.transfer()`, `detach()` does not read or copy the
bytes, so it is safe to call *after* the memory is gone. For a view returned as a
`Uint8Array`, call `view.buffer.detach()`.

## Closing libraries

Close a `Lib` (or the handle from `dlopen`) when you're finished. `Lib`
implements `Symbol.dispose`, so `using` closes it automatically at scope exit:

```javascript
import { Lib } from 'tjs:ffi';

{
    using lib = new Lib(Lib.LIBC_NAME);
    // ... use lib ...
} // lib.close() runs here
```

After a library is closed, symbols obtained from it must not be used.

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
| `'buffer'` | `void *` backed by a `Uint8Array` (argument only) |
| `'void'` | `void` (return only) |

See [`TypeAlias`](/docs/api/tjs-ffi.TypeAlias.TypeAlias) for the full list.
`returns` defaults to `'void'` and `args` to `[]`.

`'buffer'` can only be used as an argument: a returned `void *` has no known
length, so use `'ptr'` and create a view over it (see
[Working with native memory](#working-with-native-memory-zero-copy)).

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

[`bufferToString`](/docs/api/tjs-ffi.Function.bufferToString) reads a
NUL-terminated `char *` out of a buffer; its inverse,
[`stringToBuffer`](/docs/api/tjs-ffi.Function.stringToBuffer), encodes a JS
string into a `Uint8Array` you can pass as a `'buffer'`.

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

### Passing a struct by value

When a parameter *is* a struct (passed by value), use the `StructType` as the
argument type and pass a plain object:

```javascript
// double point_len(struct point p);
const pointLen = new CFunction(lib.symbol('point_len'), types.double, [Point]);

console.log(pointLen.call({ x: 3, y: 4 })); // 5
```

### Passing a struct by reference

The common C idiom takes a pointer to a struct (`struct point *`). Wrap the
object with [`Pointer.createRef`](/docs/api/tjs-ffi.Class.Pointer) to pass a
pointer to its bytes — passing a bare object would be a type error:

```javascript
import { Pointer } from 'tjs:ffi';

// void scale_point(struct point *p, double f);
const scalePoint = new CFunction(lib.symbol('scale_point'), types.void, [new PointerType(Point), types.double]);

const ref = Pointer.createRef(Point, { x: 3, y: 4 });
scalePoint.call(ref, 2);
console.log(ref.deref()); // { x: 6, y: 8 } — read the mutated value back
```

`createRef` keeps the backing buffer alive for as long as the `Pointer` is
reachable; [`deref`](/docs/api/tjs-ffi.Class.Pointer) reads the (possibly
mutated) value back.

### Arrays and fixed-size strings

For fixed-length array fields, use [`ArrayType`](/docs/api/tjs-ffi.Class.ArrayType)
(`new ArrayType(types.sint32, 4, 'int4')`), and for `char[N]` fields that hold a
string use [`StaticStringType`](/docs/api/tjs-ffi.Class.StaticStringType), which
converts to/from a JS string.

## Callbacks

Wrap a JS function in a [`JSCallback`](/docs/api/tjs-ffi.Class.JSCallback) to
pass it where C expects a function pointer.

```javascript
import { Lib, CFunction, JSCallback, types } from 'tjs:ffi';

const lib = new Lib(`./libmystuff.${suffix}`);

// int call_it(int (*fn)(int), int arg);
const callIt = new CFunction(lib.symbol('call_it'), types.sint, [types.jscallback(), types.sint]);

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

`read.u64` / `read.i64` return a JS `number`, which can't represent every 64-bit
value: results above `Number.MAX_SAFE_INTEGER` (2⁵³−1) lose precision, and a
`u64` with its high bit set reads back negative. For exact 64-bit values, read
the raw bytes with `toUint8Array` instead.

To go the other way, [`bufferToPointer`](/docs/api/tjs-ffi.Function.bufferToPointer)
gives you a pointer to a `Uint8Array`'s memory.

### Passing pointers between threads

A `NativePointer` is not [structured-cloneable](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects),
so you cannot `postMessage` it to a [`Worker`](/docs/api/tjs-worker) directly.
Instead, send its address — [`pointer.value`](/docs/api/tjs-ffi.Interface.NativePointer),
a `bigint` that clones by value — and rebuild the pointer on the other side with
[`createPointer`](/docs/api/tjs-ffi.Function.createPointer):

```javascript
// main.js
import { dlopen, suffix } from 'tjs:ffi';

const { symbols } = dlopen(`./libfoo.${suffix}`, {
    make_thing: { args: [], returns: 'ptr' },
});
const thing = symbols.make_thing();          // a NativePointer

const worker = new Worker('./worker.js');
worker.postMessage({ addr: thing.value });   // send the bigint, not the pointer
```

```javascript
// worker.js
import { createPointer } from 'tjs:ffi';

self.onmessage = e => {
    const thing = createPointer(e.data.addr); // same address, valid here
    // ... use `thing` with a library loaded in this worker ...
};
```

Two notable things the runtime does **not** do for you, both essential:

- **Lifetime.** The address is just a number — nothing keeps the memory it refers
  to alive. The thread that owns the memory must not free it (and, for a pointer
  into a JS buffer, must keep that buffer referenced) until every other thread is
  done with it.
- **Thread-safety.** A valid pointer does not make the C API behind it safe to call
  from another thread. Many libraries are not thread-safe. Confirm the library allows
  the off-thread use

### Typed pointers

[`Pointer`](/docs/api/tjs-ffi.Class.Pointer) pairs an address with the type it
points at, so you can pass values by reference and read them back without
juggling offsets. [`Pointer.createRef(type, value)`](/docs/api/tjs-ffi.Class.Pointer)
allocates a buffer holding `value` and returns a pointer to it (it keeps the
buffer alive while the `Pointer` is reachable); `createRefFromBuf(type, buf)`
wraps an existing buffer. Use a [`PointerType`](/docs/api/tjs-ffi.Class.PointerType)
as the argument/return type to declare a `T *` parameter:

```javascript
import { Lib, CFunction, PointerType, Pointer, types } from 'tjs:ffi';

const libc = new Lib(Lib.LIBC_NAME);

// struct tm *localtime(const time_t *timep);
const localtime = new CFunction(libc.symbol('localtime'), new PointerType(Tm), [new PointerType(types.sint64)]);

const tmPtr = localtime.call(Pointer.createRef(types.sint64, 1658319387));
console.log(tmPtr.deref()); // { sec, min, hour, ... } — deref reads the struct
```

`deref()` reads one level of indirection; `derefAll()` follows a multi-level
pointer all the way down.

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

## Declaring symbols from C prototypes

Instead of describing each symbol by hand, you can paste C declarations and let
[`Lib.parseCProto`](/docs/api/tjs-ffi.Class.Lib) register the structs, typedefs
and functions for you. Functions then become callable by name with
`lib.call(name, ...)`, and types are retrievable with `lib.getType(name)`:

```javascript
import { Lib, Pointer } from 'tjs:ffi';

const lib = new Lib(`./libmystuff.${suffix}`);

lib.parseCProto(`
    struct point { int x; int y; };
    int point_sum(struct point *p);
`);

const Point = lib.getType('struct point');
console.log(lib.call('point_sum', Pointer.createRef(Point, { x: 3, y: 4 }))); // 7
```

The parser understands scalar types, pointers, fixed-size array members,
structs, typedefs and function pointers (registered as callbacks). `lib.call`
pairs with `lib.getFunc(name)` / `lib.registerFunction(name, fn)` and
`lib.getType` / `lib.registerType(name, type)` if you want to inspect or extend
the registry.

## Error handling

Many libc-style functions report failure by setting `errno`. Read it with
[`errno()`](/docs/api/tjs-ffi.Function.errno) and turn a code into a message
with [`strerror()`](/docs/api/tjs-ffi.Function.strerror):

```javascript
import { errno, strerror } from 'tjs:ffi';

if (symbols.some_call() < 0) {
    console.log('failed:', strerror(errno()));
}
```

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

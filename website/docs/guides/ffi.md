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

[`dlopen`](/docs/api/tjs-ffi.Function.dlopen) is the way in: give it a library
path and a description of the symbols you want, and it returns ready-to-call
functions.

```javascript
import { dlopen, LIBC_NAME } from 'tjs:ffi';

const { symbols, close } = dlopen(LIBC_NAME, {
    getpid: { returns: 'i32' },
    abs: { args: ['i32'], returns: 'i32' },
});

console.log('pid:', symbols.getpid());
console.log('abs(-5):', symbols.abs(-5));

close(); // release the library handle when done
```

[`LIBC_NAME`](/docs/api/tjs-ffi.Variable.LIBC_NAME) and
[`LIBM_NAME`](/docs/api/tjs-ffi.Variable.LIBM_NAME) resolve to the platform's C
and math libraries. For your own libraries, build the path with the
platform-specific [`suffix`](/docs/api/tjs-ffi.Variable.suffix):

```javascript
import { suffix } from 'tjs:ffi';

const path = `./libmystuff.${suffix}`; // dylib / so / dll
```

Everything a library exports is declared in that symbol map: a function with
`args` / `returns`, a global variable with [`type`](#global-variables), and both
under whichever JS name you like via [`name`](#binding-a-symbol-more-than-once).

> **Breaking change.** Earlier versions also exposed a lower-level `Lib` /
> `DlSymbol` / `CFunction` trio, and `dlopen`'s result carried the underlying
> `Lib` as `lib`. Those are gone: `new Lib(path)` is the `dlopen` call itself,
> `new CFunction(lib.symbol('f'), ...)` is an `args`/`returns` entry,
> `lib.symbol('g').addr` is a `type` entry, and `lib.parseCProto(header)` is
> [`dlopenCProto`](#declaring-symbols-from-c-prototypes).

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
| `'bool_u8'`, `'bool_u32'` | a C flag as a JS boolean, one or four bytes wide |
| `'void'` | `void` (return only) |

See [`TypeAlias`](/docs/api/tjs-ffi.TypeAlias.TypeAlias) for the full list.
`returns` defaults to `'void'` and `args` to `[]`.

`'buffer'` can only be used as an argument: a returned `void *` has no known
length, so use `'ptr'` and create a view over it (see
[Working with native memory](#working-with-native-memory-zero-copy)).

`'bool_u8'` is C99 `bool` (and ObjC `BOOL`), `'bool_u32'` is Win32 `BOOL`; both
marshal a JS boolean, and anything nonzero reads back as `true`. A
[struct](#structs) can be an argument or return type too — see below.

## Strings and buffers

`'string'` arguments are transparently converted from a JS string to a
NUL-terminated `char *`, and `'string'` return values are read back into a JS
string. For raw memory, pass a `Uint8Array` as a `'buffer'`:

```javascript
import { dlopen, LIBC_NAME, bufferToString } from 'tjs:ffi';

const { symbols } = dlopen(LIBC_NAME, {
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

A binding's call signature is fixed when the library is opened, so a variadic
function is only callable at the arity you declared. To use it at more than one
arity, bind it more than once.

### Binding a symbol more than once

By default the key an entry is listed under is both the JS property name and the
C symbol to resolve. `name` separates the two, which is what lets the same C
symbol be bound twice:

```javascript
import { dlopen, LIBC_NAME, bufferToString } from 'tjs:ffi';

const { symbols, close } = dlopen(LIBC_NAME, {
    // int snprintf(char *str, size_t size, const char *format, ...);
    snprintf1: { name: 'snprintf', args: ['buffer', 'size_t', 'string', 'i32'], returns: 'int', fixed: 3 },
    snprintf2: { name: 'snprintf', args: ['buffer', 'size_t', 'string', 'i32', 'i32'], returns: 'int', fixed: 3 },
});

const buf = new Uint8Array(32);

symbols.snprintf1(buf, buf.length, 'x=%d', 7);
console.log(bufferToString(buf)); // "x=7"

symbols.snprintf2(buf, buf.length, 'x=%d y=%d', 7, 8);
console.log(bufferToString(buf)); // "x=7 y=8"

close();
```

The same field also exposes an awkward C name under a friendlier one
(`readConfig: { name: 'mylib_read_config_v2', ... }`). Only the keys are bound —
the C name behind them never appears in `symbols`.

### Optional symbols

A symbol that fails to resolve makes the whole `dlopen` throw (and closes the
handle again). Mark an entry `optional` to probe for a symbol instead: if it is
missing, the property is left out of `symbols` altogether, so `in` tells you
whether the library you got has it.

```javascript
import { dlopen, LIBC_NAME } from 'tjs:ffi';

const { symbols, close } = dlopen(LIBC_NAME, {
    strlen: { args: ['string'], returns: 'size_t' },
    // A BSD extension: always there on macOS, on glibc only since 2.38.
    strlcpy: { args: ['buffer', 'string', 'size_t'], returns: 'size_t', optional: true },
});

if ('strlcpy' in symbols) {
    // ... use the fast path ...
} else {
    // ... fall back to snprintf ...
}

close();
```

Only the resolution is guarded: an `optional` entry that resolves but is
declared wrong still throws.

## Global variables

An entry with `type` — instead of `args` / `returns` — declares a *data* symbol,
i.e. a global variable. It binds to a level-1
[`Pointer`](/docs/api/tjs-ffi.Class.Pointer) at the variable's address rather
than to a callable, so `deref()` reads its current value:

```javascript
import { dlopen, suffix } from 'tjs:ffi';

const { symbols, close } = dlopen(`./libmystuff.${suffix}`, {
    // int mystuff_version;
    mystuff_version: { type: 'int' },
    // const char *mystuff_build;
    mystuff_build: { type: 'string' },
});

console.log(symbols.mystuff_version.deref()); // 3
console.log(symbols.mystuff_build.deref());   // "2026-07-30"

close();
```

`type` is mutually exclusive with `args` and `returns`; an entry carrying both
throws a `TypeError`.

The binding is always level 1, because the symbol's address *is* the variable.
A global that is itself a pointer you want to follow twice — `int *thing` — is
reached by rebuilding the pointer at the same address with the level it really
has:

```javascript
import { dlopen, Pointer, types, suffix } from 'tjs:ffi';

const { symbols, close } = dlopen(`./libmystuff.${suffix}`, {
    // int *mystuff_count_ptr;
    mystuff_count_ptr: { type: types.sint },
});

const ptr = new Pointer(symbols.mystuff_count_ptr.addr, 2, types.sint);

console.log(ptr.derefAll()); // the int behind both levels

close();
```

Keep the bound `Pointer` reachable while you use the rebuilt one: it is what
keeps the library loaded, and the rebuilt pointer carries no such tie.

## Structs

[`defineStruct`](/docs/api/tjs-ffi.Function.defineStruct) describes a C struct as
a list of `[ name, type ]` fields and hands back a type that packs a plain JS
object into struct bytes and unpacks them back again:

```javascript
import { defineStruct } from 'tjs:ffi';

// struct point { int x; int y; };
const Point = defineStruct([
    ['x', 'i32'],
    ['y', 'i32'],
]);

const bytes = Point.pack({ x: 3, y: 4 }); // a Uint8Array, Point.size long

console.log(Point.unpack(bytes));     // { x: 3, y: 4 }
console.log(Point.size, Point.align); // 8 4
```

The layout is libffi's, so the offsets, the padding, the size and the alignment
are the ones the platform's C compiler produced rather than a guess.
[`describe()`](/docs/api/tjs-ffi.Interface.StructDef) reports it field by field,
which is where to look first when a struct does not agree with C:

```javascript
console.log(Point.describe());
// [ { name: 'x', offset: 0, size: 4, type: 'i32' },
//   { name: 'y', offset: 4, size: 4, type: 'i32' } ]
```

A field's type is anything from the [types table](#types), as an alias or as a
`types` object, plus the shapes only a struct has: another `defineStruct()` type
for a [nested struct](#nested-structs), [`defineEnum()`](#enums) for an enum,
`[elementType]` for a [pointer to a run of elements](#pointer-to-array-fields),
and [`ArrayType` / `StaticStringType`](#arrays-inside-the-struct) for an array
member. Two of the primitives behave specially and are used constantly:
`'pointer'` packs from and unpacks to a [`NativePointer`](#pointers) or `null`,
never a number, and `'cstring'` encodes a JS string into a buffer of its own and
stores *its* address, which `unpack` reads back as a string (`null` for a null
`char *`). Whatever `pack` allocated for a field stays alive for as long as the
bytes holding its address do, so there is nothing for you to keep a reference to.

### Passing and returning a struct by value

A `defineStruct()` type is a type like any other, so it can be a symbol's
argument or return type — the struct is then passed and returned by value, and
`pack` / `unpack` happen for you:

```javascript
import { dlopen, defineStruct, suffix } from 'tjs:ffi';

// struct point { int x; int y; };
const Point = defineStruct([['x', 'i32'], ['y', 'i32']]);

const { symbols, close } = dlopen(`./libmystuff.${suffix}`, {
    // struct point make_point(int x, int y);
    make_point: { args: ['int', 'int'], returns: Point },
    // double point_len(struct point p);
    point_len: { args: [Point], returns: 'f64' },
});

console.log(symbols.make_point(3, 4));          // { x: 3, y: 4 }
console.log(symbols.point_len({ x: 3, y: 4 })); // 5

close();
```

### Passing a struct by reference

The more common C idiom takes a pointer to a struct (`struct point *`). Declare
the parameter as a `'buffer'` and hand it the packed bytes; C writes into them,
and `unpack` reads the result back out of the same bytes:

```javascript
const { symbols, close } = dlopen(`./libmystuff.${suffix}`, {
    // void scale_point(struct point *p, double f);
    scale_point: { args: ['buffer', 'f64'] },
});

const p = Point.pack({ x: 3, y: 4 });

symbols.scale_point(p, 2);
console.log(Point.unpack(p)); // { x: 6, y: 8 }
```

Holding the bytes is what lets you pass the same struct twice, or read it back
after several calls. When you don't care about them, declare the parameter as a
[`PointerType`](/docs/api/tjs-ffi.Class.PointerType) and let
[`Pointer.createRef`](/docs/api/tjs-ffi.Class.Pointer) pack and `deref()` unpack:

```javascript
import { Pointer, PointerType } from 'tjs:ffi';

const lib = dlopen(`./libmystuff.${suffix}`, {
    scale_point: { args: [new PointerType(Point), 'f64'] },
});

const ref = Pointer.createRef(Point, { x: 3, y: 4 });

lib.symbols.scale_point(ref, 2);
console.log(ref.deref()); // { x: 6, y: 8 }
```

`createRef` keeps the buffer it packed alive for as long as the `Pointer` is
reachable. Passing a bare object where a `PointerType` is expected is a
`TypeError`, not a silent NULL.

### Nested structs

A `defineStruct()` type used as a field type is laid out inline, by value, at the
offset libffi gave it — the nested bytes are part of the outer struct:

```javascript
// struct rect { struct point origin; struct point size; };
const Rect = defineStruct([['origin', Point], ['size', Point]]);

const { symbols, close } = dlopen(`./libmystuff.${suffix}`, {
    // int rect_area(struct rect *r);
    rect_area: { args: ['buffer'], returns: 'int' },
});

const r = Rect.pack({ origin: { x: 1, y: 1 }, size: { x: 3, y: 4 } });

console.log(Rect.size);            // 16
console.log(symbols.rect_area(r)); // 12
console.log(Rect.unpack(r));       // { origin: { x: 1, y: 1 }, size: { x: 3, y: 4 } }

close();
```

When C keeps the sub-struct behind a pointer instead (`struct limits *`, the
usual spelling of an optional or shared one), add `asPointer` to the field: the
nested struct gets a buffer of its own and the field holds its address. A missing
or `null` sub-struct is a null pointer, and unpacks back as `null` rather than as
a struct of zeroes — the two mean different things to the function reading it:

```javascript
// struct limits { uint32_t min_size; uint32_t max_size; };
const Limits = defineStruct([['minSize', 'u32'], ['maxSize', 'u32']]);

// struct device_desc { uint32_t id; struct limits *limits; };
const Device = defineStruct([
    ['id', 'u32'],
    ['limits', Limits, { asPointer: true, optional: true }],
]);

const { symbols, close } = dlopen(`./libmystuff.${suffix}`, {
    // int device_desc_span(struct device_desc *d);
    device_desc_span: { args: ['buffer'], returns: 'int' },
});

const d = Device.pack({ id: 7, limits: { minSize: 16, maxSize: 1024 } });

console.log(symbols.device_desc_span(d)); // 1008 — C followed the stored address
console.log(Device.unpack(d));            // { id: 7, limits: { minSize: 16, maxSize: 1024 } }
console.log(Device.unpack(Device.pack({ id: 8 }))); // { id: 8, limits: null }

close();
```

### Pointer-to-array fields

`{ T *data; size_t len }` is most of what C hands around, and it takes two fields
to describe: `[elementType]` declares the pointer to the run of elements, and
`lengthOf` marks the field holding how many there are. `pack` allocates the
elements, writes them, and fills in both halves; `unpack` reads the count and
materialises the elements as a JS array:

```javascript
// struct byte_span { unsigned char *data; size_t len; };
const Span = defineStruct([
    ['data', ['u8']],
    ['len', 'size_t', { lengthOf: 'data' }],
]);

const { symbols, close } = dlopen(`./libmystuff.${suffix}`, {
    // unsigned sum_bytes(struct byte_span *s);
    sum_bytes: { args: ['buffer'], returns: 'u32' },
});

const s = Span.pack({ data: [1, 2, 3, 250] });

console.log(symbols.sum_bytes(s)); // 256

const { data, len } = Span.unpack(s);

console.log(data, len); // [ 1, 2, 3, 250 ] 4n

close();
```

The count is written by the field it counts — the only place it is known for
certain — so the object you pack never mentions it, and the bytes and the length
cannot come to disagree. (`len` above is a `bigint` because `size_t` is a 64-bit
integer; a `'u32'` count would be a number.) An empty run is a null pointer with
a count of zero, and unpacks back as `[]`.

The element type is anything a field can be, since the marshalling is the same
one field types get: a primitive, an [enum](#enums), a nested `defineStruct()`
(a pointer to an array of structs), `'cstring'` for `char **argv`, or an
`ArrayType`.

### Counted strings

A `'cstring'` field with a `lengthOf` field of its own is C's counted string —
`{ const char *data; size_t len }`, which need not be NUL-terminated at all.
`pack` derives the byte count from the string, and `unpack` reads exactly that
many bytes instead of scanning for a NUL:

```javascript
// struct slice { const char *data; size_t len; };
const Slice = defineStruct([
    ['data', 'cstring'],
    ['len', 'size_t', { lengthOf: 'data' }],
]);

const { symbols, close } = dlopen(`./libmystuff.${suffix}`, {
    // unsigned count_char(struct slice *s, int c);
    count_char: { args: ['buffer', 'int'], returns: 'u32' },
});

const s = Slice.pack({ data: 'hello, héllo' });

console.log(symbols.count_char(s, 'l'.charCodeAt(0))); // 4

const { data, len } = Slice.unpack(s);

console.log(data, len); // hello, héllo 13n — 13 bytes for 12 characters

close();
```

The count is in bytes, not characters, and the terminator is written but not
counted: a consumer that goes by the length sees exactly the string, and one that
expects a C string still finds its NUL.

### Enums

[`defineEnum`](/docs/api/tjs-ffi.Function.defineEnum) maps member names to
values, in both directions: a field of that type packs from a name and unpacks
back to one.

```javascript
import { dlopen, defineEnum, defineStruct, suffix } from 'tjs:ffi';

// enum log_level { LOG_DEBUG, LOG_INFO, LOG_ERROR };
const LogLevel = defineEnum({ DEBUG: 0, INFO: 1, ERROR: 2 });

// struct message { enum log_level level; unsigned code; };
const Message = defineStruct([['level', LogLevel], ['code', 'u32']]);

const { symbols, close } = dlopen(`./libmystuff.${suffix}`, {
    // int message_is_error(struct message *m);
    message_is_error: { args: ['buffer'], returns: 'int' },
});

const m = Message.pack({ level: 'ERROR', code: 42 });

console.log(symbols.message_is_error(m)); // 1
console.log(Message.unpack(m));           // { level: 'ERROR', code: 42 }
console.log(LogLevel.members.ERROR);      // 2

close();
```

The C type behind the mapping is not in the mapping, so it is the second
argument — `defineEnum({ LOW: 0, HIGH: 1 }, 'u8')` for an `enum : uint8_t`. It
defaults to `int`, which is what a compiler gives an enum whose enumerators fit
in one, and the only default under which a negative enumerator (an error code)
round trips.

A name the enum does not have, or bytes holding a value it has no name for, throw
a `RangeError` naming the field: passing the raw number through would put a value
in the struct that C has no case for. A raw value packs too, but only if the
mapping declares it.

### Field options

A third element on a field entry carries its options. They exist so that the
struct definition holds what would otherwise be spelled out at every call site: a
default, a field that may be left out, a unit conversion, a check, a member only
some platforms have.

```javascript
const Config = defineStruct([
    // Required: a missing `id` is a TypeError. A validator rejects a value C
    // would choke on, before it reaches the bytes.
    ['id', 'u32', {
        validate: (value, field) => {
            if (value === 0) {
                throw new RangeError(`${field} must be set`);
            }
        },
    }],
    // Stored in milliseconds, spelled in seconds. The default is transformed
    // like any other value.
    ['timeout', 'u32', {
        default: 5,
        packTransform: seconds => seconds * 1000,
        unpackTransform: ms => ms / 1000,
    }],
    // May be left out, in which case the field is zeroed — here a null char*.
    ['label', 'cstring', { optional: true }],
    ['verbose', 'bool_u32', { default: false }],
    // Not part of the struct at all where the condition is false: it does not
    // show up in the layout, and does not shift the fields after it either.
    ['win32Handle', 'pointer', {
        condition: () => navigator.userAgentData.platform === 'Windows',
    }],
]);

console.log(Config.unpack(Config.pack({ id: 1 })));
// { id: 1, timeout: 5, label: null, verbose: false }
```

A field with neither `default` nor `optional` is required, so
`Config.pack({ timeout: 1 })` throws a `TypeError` naming `id`, and
`Config.pack({ id: 0 })` throws the validator's `RangeError`. A validator is
called with the value, the field's name (for its message) and `{ input }`, the
whole object being packed; `validate` also takes a list of them, all of which run.

`default` and `optional` both make a field's absence acceptable, and `default`
wins when a field has both — `optional` then only says that leaving it out is not
an error. Absent means `undefined`, not `null`: `null` is the value a pointer or
a `'cstring'` field takes for a null address, so it is packed rather than replaced.
A `condition` is answered once, when the struct is defined and the layout is
computed, never per pack. An unknown option name throws, since a misspelled
`optional` otherwise reads as a field that does not have one.

The remaining two options belong to the shapes above:
[`lengthOf`](#pointer-to-array-fields) pairs a count with the field it counts,
and [`asPointer`](#nested-structs) puts a nested struct behind a pointer.

### Letting C fill a struct in

When the callee is the one filling the struct in,
[`allocStruct`](/docs/api/tjs-ffi.Function.allocStruct) hands out zeroed struct
bytes with a buffer allocated for each named array field and its address and
count already written — the shape such a function expects to be handed. Reading
the result back is a plain `unpack`:

```javascript
import { dlopen, allocStruct, defineStruct, suffix } from 'tjs:ffi';

// struct int_list { unsigned count; int *items; };
const IntList = defineStruct([
    ['count', 'u32', { lengthOf: 'items' }],
    ['items', ['int']],
]);

const { symbols, close } = dlopen(`./libmystuff.${suffix}`, {
    // void fill_int_list(struct int_list *l);
    fill_int_list: { args: ['buffer'] },
});

const { bytes, arrays } = allocStruct(IntList, { lengths: { items: 4 } });

symbols.fill_int_list(bytes);

console.log(IntList.unpack(bytes));                  // { count: 4, items: [ 10, 20, 30, 40 ] }
console.log(new Int32Array(arrays.items.buffer)[0]); // 10 — the very memory C wrote into

close();
```

`arrays` exposes each of those element buffers, so you can also read them
directly, as above. A `'cstring'` field counts in bytes:
`lengths: { s: 16 }` is room for C to write a 16-byte string into.

### Many structs at once

`unpack` allocates a result object and `pack` allocates a buffer, which is one
allocation per element too many when the struct in question arrives by the
thousand. Three methods work in storage the caller owns instead:
`unpackList(buf, count)` reads a run of structs packed back to back,
`unpackInto(buf, target, offset)` writes the fields into an object you reuse, and
`packListInto(objects, buf, offset)` writes a run of structs into one buffer.

```javascript
import { dlopen, defineStruct, Pointer, PointerType, types, suffix } from 'tjs:ffi';

// struct sample { uint32_t code; float value; };
const Sample = defineStruct([['code', 'u32'], ['value', 'f32']]);

const { symbols, close } = dlopen(`./libmystuff.${suffix}`, {
    // struct sample *get_samples(unsigned *count);
    get_samples: { args: [new PointerType(types.uint32)], returns: 'ptr' },
    // float sum_samples(struct sample *s, unsigned count);
    sum_samples: { args: ['buffer', 'u32'], returns: 'f32' },
});

const countRef = Pointer.createRef(types.uint32, 0);
const first = symbols.get_samples(countRef);
const count = countRef.deref();
const run = first.toUint8Array(count * Sample.size); // a view over the library's memory

console.log(Sample.unpackList(run, count));
// [ { code: 1, value: 0.5 }, { code: 2, value: 1.5 }, { code: 3, value: 2.5 } ]

// One object for the whole loop, instead of one per element.
const sample = {};
let total = 0;

for (let i = 0; i < count; i++) {
    Sample.unpackInto(run, sample, i * Sample.size);
    total += sample.value;
}

console.log(total); // 4.5

// The other direction: one buffer for the whole run.
const out = new Uint8Array(Sample.size * 3);

Sample.packListInto([
    { code: 1, value: 1 },
    { code: 2, value: 2 },
    { code: 3, value: 3 },
], out);

console.log(symbols.sum_samples(out, 3)); // 6

close();
```

A read or a write that would run off the end of the buffer throws a `RangeError`
rather than being clamped.

### Arrays inside the struct

An array *member* — `int cells[4]`, `char name[8]` — is not the pointer above but
storage inside the struct, and it is declared with the type that describes it:
[`ArrayType`](/docs/api/tjs-ffi.Class.ArrayType) for the elements, and
[`StaticStringType`](/docs/api/tjs-ffi.Class.StaticStringType) for a `char[N]`
holding a string, which converts to and from a JS string.

```javascript
import { dlopen, defineStruct, ArrayType, StaticStringType, types, suffix } from 'tjs:ffi';

// struct grid { char name[8]; int cells[4]; };
const Grid = defineStruct([
    ['name', new StaticStringType(8, 'char[8]')],
    ['cells', new ArrayType(types.sint32, 4, 'int[4]')],
]);

const { symbols, close } = dlopen(`./libmystuff.${suffix}`, {
    // char *sprint_grid(struct grid *g);
    sprint_grid: { args: ['buffer'], returns: 'string' },
});

const g = Grid.pack({ name: 'abc', cells: [1, -2, 3, -4] });

console.log(symbols.sprint_grid(g)); // "abc:1,-2,3,-4"
console.log(Grid.unpack(g));         // { name: 'abc', cells: [ 1, -2, 3, -4 ] }

close();
```

A string longer than the member is a `RangeError`, not a truncation.

### Where `StructType` still fits

[`StructType`](/docs/api/tjs-ffi.Class.StructType) is the libffi-facing layer
`defineStruct` builds its layout on, and it is still exported. The one place you
meet it is [`dlopenCProto`](#declaring-symbols-from-c-prototypes): it parses a
header at runtime and hands its structs back as `StructType` instances, which
marshal plain objects just as well —
`Pointer.createRef(types.get('struct point'), { x: 3, y: 4 })`.

For a struct you describe yourself, reach for `defineStruct`: it takes the field
list rather than a type object per field, gives you `pack` / `unpack` on their
own, and covers the shapes `StructType` has no notion of — strings, enums,
counted arrays, defaults, optional fields.

## Callbacks

Wrap a JS function in a [`JSCallback`](/docs/api/tjs-ffi.Class.JSCallback) to
pass it where C expects a function pointer. Declare the parameter as
`types.jscallback()`:

```javascript
import { dlopen, JSCallback, types, suffix } from 'tjs:ffi';

const { symbols, close } = dlopen(`./libmystuff.${suffix}`, {
    // int call_it(int (*fn)(int), int arg);
    call_it: { args: [types.jscallback(), types.sint], returns: types.sint },
});

const cb = new JSCallback(types.sint, [types.sint], (n) => n * 2);

console.log(symbols.call_it(cb, 21)); // 42

close();
```

Keep the `JSCallback` alive for as long as C might call it; if it is garbage
collected, the function pointer becomes dangling.

### Passing a native function pointer

Sometimes the function pointer C wants is not a JS function but another function
from a native library — a destructor to hand to a registry, a comparator the
library itself provides. A `{ type }` entry gives you its address: `type` binds
*any* symbol as a `Pointer` at its address, function or data alike, and `.addr`
is the raw pointer to pass along. Declare the parameter as `'ptr'`, since
`types.jscallback()` accepts nothing but a `JSCallback`:

```javascript
import { dlopen, suffix } from 'tjs:ffi';

const { symbols, close } = dlopen(`./libmystuff.${suffix}`, {
    // int call_it(int (*fn)(int), int arg);
    call_it: { args: ['ptr', 'int'], returns: 'int' },
    // int times_two(int n); — bound for its address, not to be called from JS.
    times_two: { type: 'void' },
});

console.log(symbols.call_it(symbols.times_two.addr, 21)); // 42

close();
```

Declare the pointee as `'void'`, as above: for a function symbol there is no
meaningful thing being pointed at, and `deref()` would read the function's
machine code as data. On such a pointer, `.addr` is the only member you may
touch. If you want to *call* the function from JS as well, add a second entry
for it with `args` / `returns` — `name` lets both live in the same map.

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

A NULL pointer is JavaScript `null`, never a `NativePointer`: a function returning
`'ptr'` gives you `NativePointer | null`, and passing `null` where C expects a
pointer sends NULL. Check for it before dereferencing.

`read.u64` / `read.i64` return a JS `number`, which can't represent every 64-bit
value: results above `Number.MAX_SAFE_INTEGER` (2⁵³−1) lose precision, and a
`u64` with its high bit set reads back negative. For exact 64-bit values, read
the raw bytes with `toUint8Array` instead.

To go the other way, [`bufferToPointer`](/docs/api/tjs-ffi.Function.bufferToPointer)
gives you a pointer to a `Uint8Array`'s memory.

### Passing pointers between threads

A `NativePointer` is not [structured-cloneable](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects),
so you cannot `postMessage` it to a `Worker` directly.
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
import { dlopen, LIBC_NAME, PointerType, Pointer, defineStruct, types } from 'tjs:ffi';

const Tm = defineStruct([
    ['sec', 'int'], ['min', 'int'], ['hour', 'int'],
    ['mday', 'int'], ['mon', 'int'], ['year', 'int'],
]);

const { symbols, close } = dlopen(LIBC_NAME, {
    // struct tm *localtime(const time_t *timep);
    localtime: { args: [new PointerType(types.sint64)], returns: new PointerType(Tm) },
});

const tmPtr = symbols.localtime(Pointer.createRef(types.sint64, 1658319387));
console.log(tmPtr.deref()); // { sec, min, hour, ... } — deref reads the struct

close();
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
const { symbols } = dlopen(LIBC_NAME, {
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
[`dlopenCProto`](/docs/api/tjs-ffi.Function.dlopenCProto) do it for you: it binds
every function the header declares and hands back the types it defines along the
way. `symbols` is exactly what `dlopen` returns; `types` is a `Map` keyed by the
name each type was declared under, e.g. `'struct point'`.

```javascript
import { dlopenCProto, Pointer, suffix } from 'tjs:ffi';

const { symbols, types, close } = dlopenCProto(`./libmystuff.${suffix}`, `
    struct point { int x; int y; };
    int point_sum(struct point *p);
`);

const Point = types.get('struct point');

console.log(symbols.point_sum(Pointer.createRef(Point, { x: 3, y: 4 }))); // 7

close();
```

The parser understands scalar types, pointers, fixed-size array members,
structs, typedefs and function pointers (registered as callbacks). A typedef is
keyed under its own name as well (`types.get('p_t')`), and a pointer type the
header used under the name with the stars (`types.get('p_t*')`). Since the
header is parsed at runtime, the resulting signatures are opaque to TypeScript —
declare the symbols by hand if you want them typed.

A struct from that map is a [`StructType`](#where-structtype-still-fits): it
marshals plain objects as an argument or a return value, but it knows nothing of
the string, enum and counted-array shapes [`defineStruct`](#structs) adds.
Describe the struct with `defineStruct` too when you want those.

## Error handling

Many libc-style functions report failure by setting `errno`. Read it with
[`errno()`](/docs/api/tjs-ffi.Function.errno) and turn a code into a message
with [`strerror()`](/docs/api/tjs-ffi.Function.strerror):

```javascript
import { dlopen, LIBC_NAME, errno, strerror } from 'tjs:ffi';

const { symbols, close } = dlopen(LIBC_NAME, {
    chdir: { args: ['string'], returns: 'int' },
});

if (symbols.chdir('/no/such/directory') < 0) {
    console.log('failed:', strerror(errno())); // "No such file or directory"
}

close();
```

## Closing libraries

`dlopen` and `dlopenCProto` both hand back a `close()` that releases the library
handle, and both results implement `Symbol.dispose` as an alias for it, so
`using` closes the library at scope exit:

```javascript
import { dlopen, LIBC_NAME } from 'tjs:ffi';

{
    using lib = dlopen(LIBC_NAME, {
        getpid: { returns: 'i32' },
    });

    console.log(lib.symbols.getpid());
} // lib.close() runs here
```

Closing twice is harmless — an explicit `close()` inside a `using` scope is fine.
After a library is closed, the symbols bound from it must not be used: the
functions in `symbols` and any `Pointer` to a global still exist, but the code
and data they refer to are gone.

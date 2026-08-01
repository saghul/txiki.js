import assert from 'tjs:assert';
import { dlopen } from 'tjs:ffi';

// 'c' and 'm' name the platform's C and math libraries, whose file names differ
// per platform.
{
    using lib = dlopen('c', {
        strlen: { args: [ 'string' ], returns: 'size_t' },
    });

    assert.eq(lib.symbols.strlen('hello'), 5);
}

{
    using lib = dlopen('m', {
        sqrt: { args: [ 'f64' ], returns: 'f64' },
    });

    assert.eq(lib.symbols.sqrt(144), 12);
}

// Only these two names are aliased; everything else reaches the loader as
// written, so a library that does not exist still fails. This is what keeps the
// two cases above from passing for any name at all.
assert.throws(() => dlopen('definitely-not-a-library', {}), Error);

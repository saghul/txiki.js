import FFI from 'tjs:ffi';

const sopath = `./build/libffi-test.${FFI.suffix}`;

export { FFI, sopath };

import { run, test } from './t.js';

test('global is not configurable / writable', t => {
    t.throws(() => { globalThis.global = 'foo'; }, TypeError, 'assigning global throws');
    t.is(globalThis, global, 'globalThis is global')
});

test('window is not configurable / writable', t => {
    t.throws(() => { globalThis.window = 'foo'; }, TypeError, 'assigning window throws');
    t.is(globalThis, window, 'globalThis is window')
});


if (import.meta.main) {
    run();
}

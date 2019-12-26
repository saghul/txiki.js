import { run, test } from './t.js';

test('should be futile to rewriting global', t => {
    globalThis.global = 'foo';
    t.is(globalThis, global, 'globalThis is global')
});

test('should be futile to rewriting window', t => {
    globalThis.window = 'foo';
    t.is(globalThis, window, 'globalThis is window')
});


if (import.meta.main) {
    run();
}

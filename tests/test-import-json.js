import { run, test } from './t.js';

test('importing JSON works', async t => {
    const { default: data } = await import('./fixtures/data.json');
    t.eq(data.widget.debug, 'on', 'string data matches');
    t.eq(data.widget.window.width, 500, 'number data matches');
});


if (import.meta.main) {
    run();
}

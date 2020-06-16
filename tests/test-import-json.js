import assert from './assert.js';

(async () => {
    const { default: data } = await import('./fixtures/data.json');
    assert.eq(data.widget.debug, 'on', 'string data matches');
    assert.eq(data.widget.window.width, 500, 'number data matches');
})();

import assert from './assert.js';
import data from './fixtures/data.json';

(async () => {
    assert.eq(data.widget.debug, 'on', 'string data matches');
    assert.eq(data.widget.window.width, 500, 'number data matches');
})();

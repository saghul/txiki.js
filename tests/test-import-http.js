import assert from 'tjs:assert';

import { spawnServe } from './helpers/serve-spawn.js';

const { proc, port } = await spawnServe('serve-echo.js');

try {
    await import(`http://127.0.0.1:${port}/lodash.js`);

    const words = ['sky', 'wood', 'forest', 'falcon', 'pear', 'ocean', 'universe'];
    assert.eq(_.first(words), 'sky', '_.first works');
    assert.eq(_.last(words), 'universe', '_.last works');
} finally {
    proc.kill('SIGTERM');
    await proc.wait();
}

import assert from './assert.js';


(async () => {
    const info = tjs.userInfo();

    if (tjs.platform === 'windows') {
        assert.eq(info.uid, -1);
        assert.eq(info.gid, -1);
        assert.eq(info.shell, null);
    } else {
        assert.notEqual(info.uid, -1);
        assert.notEqual(info.gid, -1);
        assert.notEqual(info.shell, null);
    }

    assert.ok(info.username);
    assert.ok(info.homedir);
})();

import assert from 'tjs:assert';


const { uid, gid, shell, userName, homeDir } = tjs.userInfo;

if (tjs.platform === 'windows') {
    assert.eq(uid, -1);
    assert.eq(gid, -1);
    assert.eq(shell, null);
} else {
    assert.notEqual(uid, -1);
    assert.notEqual(gid, -1);
    assert.notEqual(shell, null);
}

assert.ok(userName);
assert.ok(homeDir);

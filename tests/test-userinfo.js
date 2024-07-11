import assert from 'tjs:assert';


const { userId, groupId, shell, userName, homeDir } = tjs.system.userInfo;

if (tjs.system.platform === 'windows') {
    assert.eq(userId, -1);
    assert.eq(groupId, -1);
    assert.eq(shell, null);
} else {
    assert.notEqual(userId, -1);
    assert.notEqual(groupId, -1);
    assert.notEqual(shell, null);
}

assert.ok(userName);
assert.ok(homeDir);

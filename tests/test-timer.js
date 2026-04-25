import assert from 'tjs:assert';


const runner1 = () => Promise.resolve();
await runner1();
assert.ok(true, 'Promise microtask should be supported');

const runner2 = () => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, 100);
    });
};
await runner2();
assert.ok(true, 'setTimeout timer should be supported');

const runner3 = () => {
    return new Promise(resolve => {
        const siblings = [];
        for (let i = 0; i < 32; i++) {
            siblings.push(setTimeout(() => {}, 1_000_000));
        }

        let selfId;
        let fired = false;
        selfId = setTimeout(() => {
            clearTimeout(selfId);
            fired = true;
        }, 1);

        setTimeout(() => {
            for (const id of siblings) {
                clearTimeout(id);
            }
            resolve(fired);
        }, 50);
    });
};
assert.ok(await runner3(), 'timer can clear itself from its callback');

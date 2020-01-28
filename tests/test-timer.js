import { run, test } from './t.js';

test('basic timer', async t => {
    const runner1 = () => Promise.resolve();
    await runner1();
    t.ok(true, 'Promise microtask should be supported');

    const runner2 = () => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, 100);
        });
    };
    await runner2();
    t.ok(true, 'setTimeout timer should be supported');
});

test('async task sequence', async t => {
    const runner1 = () => {
        let str = '';
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                str += 'B';
                resolve(str);
            }, 0);
            Promise.resolve().then(() => str += 'A');
        });
    };
    const result1 = await runner1();
    t.equal(result1, 'AB', 'Promise microtask should run before setTimeout');


    const runner2 = () => {
        let str = '';
        return new Promise((resolve, reject) => {
            setTimeout(() => str += 'B', 0);
            Promise.resolve().then(() => str += 'A');
    
            setTimeout(() => {
                setTimeout(() => {
                    setTimeout(() => {
                        str += 'H';
                        resolve(str);
                    }, 0);
                    str += 'D';
                    Promise.resolve().then(() => str += 'E');
                    Promise.resolve().then(() => str += 'F');
                    Promise.resolve().then(() => str += 'G');
                }, 0);
                Promise.resolve().then(() => str += 'C');
            }, 100);
        });
    };

    const result2 = await runner2();
    t.equal(result2, 'ABCDEFGH', 'nesting task sequence matches');
});


if (import.meta.main) {
    run();
}

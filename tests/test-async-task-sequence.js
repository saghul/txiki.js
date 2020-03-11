import assert from './assert.js';


(async () => {
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
    assert.equal(result1, 'AB', 'Promise microtask should run before setTimeout');

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
    assert.equal(result2, 'ABCDEFGH', 'nesting task sequence matches');
})();

// lookup example.
//

const res = await tjs.lookup(tjs.args[3], { all: true });
console.log(JSON.stringify(res, undefined, 2));

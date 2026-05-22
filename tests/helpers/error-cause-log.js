const inner = new Error('inner boom');
const outer = new Error('outer boom', { cause: inner });
console.log(outer);

const inner = new Error('inner boom');
const middle = new Error('middle boom', { cause: inner });
throw new Error('outer boom', { cause: middle });

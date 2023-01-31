import assert from 'tjs:assert';


const hostname = tjs.gethostname();

assert.equal(typeof hostname, 'string');

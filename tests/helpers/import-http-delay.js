import assert from 'tjs:assert';

const port = tjs.env.ECHO_PORT;

// This import should fail with a timeout error.
await import(`http://127.0.0.1:${port}/delay/10`);

assert.ok(false);

import assert from 'tjs:assert';

// This import should fail with a timeout error.
import 'https://httpbin.org/delay/10';

assert.ok(false);

import assert from 'tjs:assert';

// This import should fail with a timeout error.
import 'https://postman-echo.com/delay/10';

assert.ok(false);

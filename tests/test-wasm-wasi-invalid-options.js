import assert from 'tjs:assert';
import { WASI } from 'tjs:wasi';

const base = { version: 'wasi_snapshot_preview1' };

// returnOnExit must be a boolean.
assert.throws(() => new WASI({ ...base, returnOnExit: 1 }), TypeError, 'numeric returnOnExit throws');
assert.throws(() => new WASI({ ...base, returnOnExit: 'yes' }), TypeError, 'string returnOnExit throws');

// stdio fds must be non-negative integers.
for (const name of [ 'stdin', 'stdout', 'stderr' ]) {
    assert.throws(() => new WASI({ ...base, [name]: -1 }), TypeError, `${name} = -1 throws`);
    assert.throws(() => new WASI({ ...base, [name]: 1.5 }), TypeError, `${name} = 1.5 throws`);
    assert.throws(() => new WASI({ ...base, [name]: '0' }), TypeError, `${name} = "0" throws`);
    assert.throws(() => new WASI({ ...base, [name]: NaN }), TypeError, `${name} = NaN throws`);
}

// Valid values must not throw.
assert.doesNotThrow(() => new WASI({ ...base, returnOnExit: false, stdin: 0, stdout: 1, stderr: 2 }),
    'valid options accepted');

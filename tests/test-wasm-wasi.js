import assert from 'tjs:assert';
import path from 'tjs:path';


async function testWasi() {
    const args = [
        tjs.exepath,
        'run',
        path.join(import.meta.dirname, 'wasi', 'test.wasm')
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe' });
    const status = await proc.wait();
    assert.eq(status.exit_status, 0, 'WASI ran successfully');
    assert.eq(status.term_signal, null, 'WASI ran successfully 2');
    const buf = new Uint8Array(4096);
    const nread = await proc.stdout.read(buf);
    assert.ok(nread > 0, 'stdout was read');
    const dataStr = new TextDecoder().decode(buf.subarray(0, nread));
    assert.ok(dataStr.match(/Hello world/), 'data matches 1');
    assert.ok(dataStr.match(/Constructor OK/), 'data matches 2');
    assert.ok(dataStr.match(/Hello printf!/), 'data matches 3');
    assert.ok(dataStr.match(/fib\(20\)/), 'data matches 4');
}

async function testEmptyWasm() {
    const args = [
        tjs.exepath,
        'run',
        path.join(import.meta.dirname, 'wasi', 'empty.wasm')
    ];
    const proc = tjs.spawn(args, { stderr: 'pipe' });
    const status = await proc.wait();
    assert.eq(status.exit_status, 1, 'WASI failed to run');
    const buf = new Uint8Array(4096);
    const nread = await proc.stderr.read(buf);
    assert.ok(nread > 0, 'stderr was read');
    const dataStr = new TextDecoder().decode(buf.subarray(0, nread));
    assert.ok(dataStr.match(/TypeError: invalid buffer/));
}

async function testBadWasm() {
    const args = [
        tjs.exepath,
        'run',
        path.join(import.meta.dirname, 'wasi', 'bad.wasm')
    ];
    const proc = tjs.spawn(args, { stderr: 'pipe' });
    const status = await proc.wait();
    assert.eq(status.exit_status, 1, 'WASI failed to run');
    const buf = new Uint8Array(4096);
    const nread = await proc.stderr.read(buf);
    assert.ok(nread > 0, 'stderr was read');
    const dataStr = new TextDecoder().decode(buf.subarray(0, nread));
    assert.ok(dataStr.match(/CompileError: underrun while parsing Wasm binary/));
}

testWasi();
testEmptyWasm();
testBadWasm();

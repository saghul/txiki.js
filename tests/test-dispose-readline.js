import assert from 'tjs:assert';
import { createInterface } from 'tjs:readline';


function makeInput(lines = []) {
    const encoder = new TextEncoder();

    return new ReadableStream({
        start(controller) {
            for (const line of lines) {
                controller.enqueue(encoder.encode(line + '\n'));
            }

            controller.close();
        }
    });
}

function makeOutput() {
    return new WritableStream({
        write() {},
    });
}

async function testBasicDispose() {
    const input = makeInput([ 'hello', 'world' ]);
    const output = makeOutput();

    let rlRef;

    {
        using rl = createInterface({ input, output, terminal: false });

        rlRef = rl;

        // Read one line so the loop runs at least once.
        const line = await rl.readline();

        assert.eq(line, 'hello');
    }

    // After scope exit, rl is closed. readline() returns null once closed
    // and queue is drained.
    const after = await rlRef.readline();

    assert.eq(after, 'world', 'queue is drained before returning null');

    const final = await rlRef.readline();

    assert.eq(final, null, 'returns null after close + drained');
}

function testManualCloseThenDispose() {
    const input = makeInput();
    const output = makeOutput();

    let rlRef;

    {
        using rl = createInterface({ input, output, terminal: false });

        rl.close(); // explicit close
        rlRef = rl;
    }

    // Manual close + dispose must not throw.
    rlRef.close(); // third close — still no throw
}

function testDoubleClose() {
    const input = makeInput();
    const output = makeOutput();

    const rl = createInterface({ input, output, terminal: false });

    rl.close();
    rl.close(); // second close must be a no-op
}

function testDisposeSymbolPresent() {
    const input = makeInput();
    const output = makeOutput();

    const rl = createInterface({ input, output, terminal: false });

    assert.eq(typeof rl[Symbol.dispose], 'function');

    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(rl), Symbol.dispose);

    assert.ok(descriptor);
    assert.eq(descriptor.enumerable, false);
    assert.eq(descriptor.writable, true);
    assert.eq(descriptor.configurable, true);

    rl.close();
}

await testBasicDispose();
testManualCloseThenDispose();
testDoubleClose();
testDisposeSymbolPresent();

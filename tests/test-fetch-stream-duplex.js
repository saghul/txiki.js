import assert from 'tjs:assert';

// ReadableStream body without duplex option throws
const stream = new ReadableStream({
    start(controller) {
        controller.enqueue(new TextEncoder().encode('test'));
        controller.close();
    }
});

let threw = false;

try {
    await fetch('https://postman-echo.com/post', {
        method: 'POST',
        body: stream
        // Missing duplex: 'half'
    });
} catch (e) {
    threw = true;
    assert.ok(e instanceof TypeError, 'throws TypeError');
    assert.ok(e.message.includes('duplex'), 'error mentions duplex');
}

assert.ok(threw, 'should throw without duplex option');

import assert from './assert.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

(async () => {
    const file = await tjs.mkstemp('testFile_XXXXXX');
    const path = file.path;

    assert.ok(file.writable instanceof WritableStream);

    const readable = new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode('hello '));
            controller.enqueue(encoder.encode('world!'));
            controller.close();
        },
    });
    await readable.pipeTo(file.writable);

    const data = await tjs.readFile(path);
    assert.eq(decoder.decode(data), "hello world!");

    await tjs.unlink(path);
})();

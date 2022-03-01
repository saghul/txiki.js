function silentClose(handle) {
    try {
        handle.close();
    } catch { }
}

const CHUNK_SIZE = 16640;  // Borrowed from Deno.

export function readableStreamForHandle(handle) {
    return new ReadableStream({
        autoAllocateChunkSize: CHUNK_SIZE,
        type: 'bytes',
        async pull(controller) {
            const buf = controller.byobRequest.view;
            try {
                const nread = await handle.read(buf);
                if (!nread) {
                    silentClose(handle);
                    controller.close();
                    controller.byobRequest.respond(0);
                } else {
                    controller.byobRequest.respond(nread);
                }
            } catch (e) {
                controller.error(e);
                silentClose(handle);
            }
        },
        cancel() {
            silentClose(handle);
        }
    });
}

export function writableStreamForHandle(handle) {
    return new WritableStream({
        async write(chunk, controller) {
            try {
                await handle.write(chunk);
            } catch (e) {
                controller.error(e);
                silentClose(handle);
            }
        },
        close() {
            silentClose(handle);
        },
        abort() {
            silentClose(handle);
        }
    });
}

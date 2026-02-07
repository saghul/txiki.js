function silentClose(handle) {
    try {
        handle.close();
    } catch {
        // Ignored.
    }
}

const CHUNK_SIZE = 16640;  // Borrowed from Deno.

export function readFromHandle(handle, buf) {
    const { promise, resolve, reject } = Promise.withResolvers();

    handle.onread = nread => {
        handle.onread = null;

        if (typeof nread === 'number') {
            handle.stopRead();
            resolve(nread);
        } else if (nread === null) {
            resolve(null);
        } else if (typeof nread === 'undefined') {
            resolve(null);
        } else {
            reject(nread);
        }
    };

    handle.startRead(buf);

    return promise;
}

export function initWriteQueue(handle) {
    const queue = [];

    handle.onwrite = error => {
        const entry = queue.shift();

        if (entry) {
            if (error) {
                entry.reject(error);
            } else {
                entry.resolve();
            }
        }
    };

    return queue;
}

export function writeWithQueue(handle, queue, buf) {
    const result = handle.write(buf);

    if (typeof result === 'number') {
        return Promise.resolve(result);
    }

    const { promise, resolve, reject } = Promise.withResolvers();

    queue.push({ resolve, reject });

    return promise;
}

export function readableStreamForHandle(handle) {
    return new ReadableStream({
        autoAllocateChunkSize: CHUNK_SIZE,
        type: 'bytes',
        async pull(controller) {
            const buf = controller.byobRequest.view;

            try {
                const nread = await readFromHandle(handle, buf);

                if (nread === null) {
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

export function writableStreamForHandle(handle, writeFn) {
    return new WritableStream({
        async write(chunk, controller) {
            try {
                await writeFn(chunk);
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

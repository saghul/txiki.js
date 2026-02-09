function silentClose(handle) {
    try {
        handle.close();
    } catch {
        // Ignored.
    }
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
    let reading = false;

    return new ReadableStream({
        start(controller) {
            handle.onread = chunk => {
                if (chunk instanceof Uint8Array) {
                    controller.enqueue(chunk);

                    if (controller.desiredSize <= 0) {
                        handle.stopRead();
                        reading = false;
                    }
                } else if (chunk === null) {
                    reading = false;
                    controller.close();
                    silentClose(handle);
                } else if (chunk instanceof Error) {
                    reading = false;
                    controller.error(chunk);
                    silentClose(handle);
                } else {
                    // undefined - handle closed
                    reading = false;
                    controller.close();
                }
            };
        },
        pull() {
            if (!reading) {
                reading = true;
                handle.startRead();
            }
        },
        cancel() {
            if (reading) {
                handle.stopRead();
                reading = false;
            }

            handle.onread = null;
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

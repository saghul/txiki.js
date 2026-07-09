import core from 'tjs:internal/core';

function silentClose(handle) {
    try {
        handle.close();
    } catch {
        // Ignored.
    }
}

async function readAllChunks(stream) {
    const reader = stream.getReader();
    const chunks = [];


    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        chunks.push(value);
    }

    let totalLength = 0;

    for (const chunk of chunks) {
        totalLength += chunk.byteLength;
    }

    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return result;
}

class ProcessReadableStream extends ReadableStream {
    constructor(handle) {
        let reading = false;

        super({
            start(controller) {
                handle.onread = (data, error) => {
                    if (error) {
                        handle.stopRead();
                        reading = false;
                        handle.onread = null;
                        controller.error(error);
                    } else if (data === null) {
                        handle.stopRead();
                        reading = false;
                        handle.onread = null;
                        controller.close();
                        silentClose(handle);
                    } else {
                        controller.enqueue(data);

                        if (controller.desiredSize <= 0) {
                            handle.stopRead();
                            reading = false;
                        }
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

    arrayBuffer() {
        return readAllChunks(this).then(bytes => bytes.buffer);
    }

    bytes() {
        return readAllChunks(this);
    }

    text() {
        return readAllChunks(this).then(bytes => new TextDecoder().decode(bytes));
    }
}

class ProcessWritableStream extends WritableStream {
    constructor(handle) {
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

        super({
            async write(chunk, controller) {
                try {
                    // write() returns true when the chunk was fully written
                    // inline (uv_try_write) and false when an async write was
                    // queued, in which case onwrite fires on completion.
                    const result = handle.write(chunk);

                    if (!result) {
                        const { promise, resolve, reject } = Promise.withResolvers();

                        queue.push({ resolve, reject });
                        await promise;
                    }
                } catch (e) {
                    controller.error(e);
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
}

class Subprocess {
    #proc;
    #stdin;
    #stdout;
    #stderr;
    #waitPromise;

    constructor(proc, waitPromise, stdin, stdout, stderr) {
        this.#proc = proc;
        this.#waitPromise = waitPromise;
        this.#stdin = stdin ?? null;
        this.#stdout = stdout ?? null;
        this.#stderr = stderr ?? null;
    }

    get pid() {
        return this.#proc.pid;
    }

    get stdin() {
        return this.#stdin;
    }

    get stdout() {
        return this.#stdout;
    }

    get stderr() {
        return this.#stderr;
    }

    kill(sig) {
        return this.#proc.kill(sig);
    }

    wait() {
        return this.#waitPromise;
    }

    async [Symbol.asyncDispose]() {
        try {
            this.#proc.kill('SIGTERM');
        } catch {
            // Already exited or no longer killable.
        }

        await this.#waitPromise;
    }
}

export function spawn(args, options) {
    const opts = { ...options };
    let stdin, stdout, stderr;

    if (opts.stdin === 'pipe') {
        const handle = new core.Pipe();

        opts.stdin = handle;
        stdin = new ProcessWritableStream(handle);
    }

    if (opts.stdout === 'pipe') {
        const handle = new core.Pipe();

        opts.stdout = handle;
        stdout = new ProcessReadableStream(handle);
    }

    if (opts.stderr === 'pipe') {
        const handle = new core.Pipe();

        opts.stderr = handle;
        stderr = new ProcessReadableStream(handle);
    }

    const { promise, resolve } = Promise.withResolvers();

    opts.onexit = resolve;

    const proc = core.spawn(args, opts);

    return new Subprocess(proc, promise, stdin, stdout, stderr);
}

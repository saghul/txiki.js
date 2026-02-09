const core = globalThis[Symbol.for('tjs.internal.core')];

const kProcess = Symbol('kProcess');
const kStdin = Symbol('kStdin');
const kStdout = Symbol('kStdout');
const kStderr = Symbol('kStderr');

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

    // eslint-disable-next-line no-constant-condition
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
                    const result = handle.write(chunk);

                    if (typeof result !== 'number') {
                        const { promise, resolve, reject } = Promise.withResolvers();

                        queue.push({ resolve, reject });
                        await promise;
                    }
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
}

class Subprocess {
    constructor(proc, stdin, stdout, stderr) {
        this[kProcess] = proc;
        this[kStdin] = stdin ?? null;
        this[kStdout] = stdout ?? null;
        this[kStderr] = stderr ?? null;
    }

    get pid() {
        return this[kProcess].pid;
    }

    get stdin() {
        return this[kStdin];
    }

    get stdout() {
        return this[kStdout];
    }

    get stderr() {
        return this[kStderr];
    }

    kill(sig) {
        return this[kProcess].kill(sig);
    }

    wait() {
        return this[kProcess].wait();
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

    const proc = core.spawn(args, opts);

    return new Subprocess(proc, stdin, stdout, stderr);
}

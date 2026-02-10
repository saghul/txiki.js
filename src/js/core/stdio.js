const core = globalThis[Symbol.for('tjs.internal.core')];

const CHUNK_SIZE = 16640;

const kHandle = Symbol('kHandle');
const kType = Symbol('kType');

function silentClose(handle) {
    try {
        handle.close();
    } catch {
        // Ignored.
    }
}

class StdioReadableStream extends ReadableStream {
    constructor(handle, type) {
        if (type === 'file') {
            super({
                autoAllocateChunkSize: CHUNK_SIZE,
                type: 'bytes',
                async pull(controller) {
                    const buf = controller.byobRequest.view;

                    try {
                        const nread = await handle.read(buf);

                        if (nread === null) {
                            silentClose(handle);
                            controller.close();
                            controller.byobRequest.respond(0);
                        } else {
                            controller.byobRequest.respond(nread);
                        }
                    } catch (e) {
                        controller.error(e);
                    }
                },
                cancel() {
                    silentClose(handle);
                }
            });
        } else {
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

        this[kHandle] = handle;
        this[kType] = type;
    }

    get isTerminal() {
        return this[kType] === 'tty';
    }

    get type() {
        return this[kType];
    }

    setRawMode(rawMode) {
        if (!this.isTerminal) {
            throw new Error('not a terminal');
        }

        const ttyMode = rawMode ? core.TTY_MODE_RAW : core.TTY_MODE_NORMAL;

        this[kHandle].setMode(ttyMode);
    }
}

class StdioWritableStream extends WritableStream {
    constructor(handle, type) {
        if (type === 'file') {
            super({
                async write(chunk, controller) {
                    try {
                        await handle.write(chunk);
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
        } else {
            super({
                start(controller) {
                    handle.onwrite = error => {
                        if (error) {
                            controller.error(error);
                        }
                    };
                },
                write(chunk, controller) {
                    try {
                        handle.write(chunk);
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

        this[kHandle] = handle;
        this[kType] = type;
    }

    get isTerminal() {
        return this[kType] === 'tty';
    }

    get type() {
        return this[kType];
    }

    get width() {
        if (!this.isTerminal) {
            throw new Error('not a terminal');
        }

        return this[kHandle].getWinSize().width;
    }

    get height() {
        if (!this.isTerminal) {
            throw new Error('not a terminal');
        }

        return this[kHandle].getWinSize().height;
    }
}

function createStdioStream(fd) {
    const isStdin = fd === core.STDIN_FILENO;
    const type = core.guessHandle(fd);

    switch (type) {
        case 'tty': {
            const rawHandle = new core.TTY(fd, isStdin);

            // Do blocking writes for TTYs:
            // https://github.com/nodejs/node/blob/014dad5953a632f44e668f9527f546c6e1bb8b86/lib/tty.js#L112
            if (!isStdin && core.platform !== 'windows') {
                rawHandle.setBlocking(true);
            }

            if (isStdin) {
                return new StdioReadableStream(rawHandle, type);
            }

            return new StdioWritableStream(rawHandle, type);
        }

        case 'pipe': {
            const rawHandle = new core.Pipe();

            rawHandle.open(fd);

            // Do blocking writes on Windows.
            if (!isStdin && core.platform === 'windows') {
                rawHandle.setBlocking(true);
            }

            if (isStdin) {
                return new StdioReadableStream(rawHandle, type);
            }

            return new StdioWritableStream(rawHandle, type);
        }

        case 'file': {
            const rawHandle = new core.File(fd, pathByFd(fd));

            if (isStdin) {
                return new StdioReadableStream(rawHandle, type);
            }

            return new StdioWritableStream(rawHandle, type);
        }

        default:
            return undefined;
    }
}

function pathByFd(fd) {
    switch (fd) {
        case core.STDIN_FILENO:
            return '<stdin>';
        case core.STDOUT_FILENO:
            return '<stdout>';
        case core.STDERR_FILENO:
            return '<stderr>';
        default:
            return '';
    }
}

export function createStdin() {
    return createStdioStream(core.STDIN_FILENO);
}

export function createStdout() {
    return createStdioStream(core.STDOUT_FILENO);
}

export function createStderr() {
    return createStdioStream(core.STDERR_FILENO);
}

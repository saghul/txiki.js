const core = globalThis[Symbol.for('tjs.internal.core')];

const CHUNK_SIZE = 16640;

const kHandle = Symbol('kHandle');
const kType = Symbol('kType');
const kClosed = Symbol('kClosed');

class StdioReadableStream extends ReadableStream {
    constructor(handle, type) {
        // Shared state object so source callbacks can mark the stream as closed.
        const state = { closed: false };

        if (type === 'file') {
            super({
                autoAllocateChunkSize: CHUNK_SIZE,
                type: 'bytes',
                async pull(controller) {
                    const buf = controller.byobRequest.view;

                    try {
                        const nread = await handle.read(buf);

                        if (nread === null) {
                            state.closed = true;
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
                    state.closed = true;
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
                            state.closed = true;
                            controller.close();
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
                    state.closed = true;

                    // Don't let the handle keep the event loop alive
                    // now that reading is done.
                    handle.unref();
                }
            });
        }

        this[kHandle] = handle;
        this[kType] = type;
        this[kClosed] = state;
    }

    get isClosed() {
        return this[kClosed].closed;
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
        // Shared state object so sink callbacks can mark the stream as closed.
        const state = { closed: false };

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
                    state.closed = true;
                },
                abort() {
                    state.closed = true;
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
                    state.closed = true;
                },
                abort() {
                    state.closed = true;
                }
            });
        }

        this[kHandle] = handle;
        this[kType] = type;
        this[kClosed] = state;
    }

    get isClosed() {
        return this[kClosed].closed;
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

function createHandle(fd) {
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

            return { handle: rawHandle, type, isStdin };
        }

        case 'pipe': {
            const rawHandle = new core.Pipe();

            rawHandle.open(fd);

            // Do blocking writes on Windows.
            if (!isStdin && core.platform === 'windows') {
                rawHandle.setBlocking(true);
            }

            return { handle: rawHandle, type, isStdin };
        }

        case 'file': {
            const rawHandle = new core.File(fd, pathByFd(fd));

            return { handle: rawHandle, type, isStdin };
        }

        default:
            return undefined;
    }
}

function createStreamFromHandle(info) {
    if (!info) {
        return undefined;
    }

    if (info.isStdin) {
        return new StdioReadableStream(info.handle, info.type);
    }

    return new StdioWritableStream(info.handle, info.type);
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

function createStdioAccessor(fd) {
    let handleInfo;
    let stream;

    return () => {
        if (!handleInfo) {
            handleInfo = createHandle(fd);
        }

        if (!stream || stream.isClosed) {
            stream = createStreamFromHandle(handleInfo);
        }

        return stream;
    };
}

export const getStdin = createStdioAccessor(core.STDIN_FILENO);
export const getStdout = createStdioAccessor(core.STDOUT_FILENO);
export const getStderr = createStdioAccessor(core.STDERR_FILENO);

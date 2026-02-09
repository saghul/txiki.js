import {
    initWriteQueue, writeWithQueue, readableStreamForHandle, writableStreamForHandle
} from './stream-utils.js';

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

function readableStreamForFileHandle(handle) {
    return new ReadableStream({
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
                silentClose(handle);
            }
        },
        cancel() {
            silentClose(handle);
        }
    });
}

function createReadableStdio(handle, type, isFile) {
    const stream = isFile ? readableStreamForFileHandle(handle) : readableStreamForHandle(handle);

    stream[kHandle] = handle;
    stream[kType] = type;

    Object.defineProperty(stream, 'isTerminal', {
        get() {
            return this[kType] === 'tty';
        }
    });

    Object.defineProperty(stream, 'type', {
        get() {
            return this[kType];
        }
    });

    Object.defineProperty(stream, 'setRawMode', {
        value(rawMode) {
            if (!this.isTerminal) {
                throw new Error('not a terminal');
            }

            const ttyMode = rawMode ? core.TTY_MODE_RAW : core.TTY_MODE_NORMAL;

            this[kHandle].setMode(ttyMode);
        }
    });

    return stream;
}

function createWritableStdio(rawHandle, writeFn, type) {
    const stream = writableStreamForHandle(rawHandle, writeFn);

    stream[kHandle] = rawHandle;
    stream[kType] = type;

    Object.defineProperty(stream, 'isTerminal', {
        get() {
            return this[kType] === 'tty';
        }
    });

    Object.defineProperty(stream, 'type', {
        get() {
            return this[kType];
        }
    });

    Object.defineProperty(stream, 'width', {
        get() {
            if (!this.isTerminal) {
                throw new Error('not a terminal');
            }

            return this[kHandle].getWinSize().width;
        }
    });

    Object.defineProperty(stream, 'height', {
        get() {
            if (!this.isTerminal) {
                throw new Error('not a terminal');
            }

            return this[kHandle].getWinSize().height;
        }
    });

    return stream;
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
                return createReadableStdio(rawHandle, type, false);
            }

            const writeQueue = initWriteQueue(rawHandle);

            return createWritableStdio(rawHandle, buf => writeWithQueue(rawHandle, writeQueue, buf), type);
        }

        case 'pipe': {
            const rawHandle = new core.Pipe();

            rawHandle.open(fd);

            // Do blocking writes on Windows.
            if (!isStdin && core.platform === 'windows') {
                rawHandle.setBlocking(true);
            }

            if (isStdin) {
                return createReadableStdio(rawHandle, type, false);
            }

            const writeQueue = initWriteQueue(rawHandle);

            return createWritableStdio(rawHandle, buf => writeWithQueue(rawHandle, writeQueue, buf), type);
        }

        case 'file': {
            const rawHandle = new core.File(fd, pathByFd(fd));

            if (isStdin) {
                return createReadableStdio(rawHandle, type, true);
            }

            return createWritableStdio(rawHandle, buf => rawHandle.write(buf), type);
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

const core = globalThis[Symbol.for('tjs.internal.core')];

const kStdioHandle = Symbol('kStdioHandle');
const kStdioHandleType = Symbol('kStdioHandleType');


class BaseIOStream {
    constructor(handle, type) {
        this[kStdioHandle] = handle;
        this[kStdioHandleType] = type;
    }

    get isTerminal() {
        return this.type ===  'tty';
    }

    get type() {
        return this[kStdioHandleType];
    }
}

class InputStream extends BaseIOStream {
    async read(buf) {
        return this[kStdioHandle].read(buf);
    }

    setRawMode(rawMode) {
        if (!this.isTerminal) {
            throw new Error('not a terminal');
        }

        const ttyMode = rawMode ? core.TTY_MODE_RAW : core.TTY_MODE_NORMAL;

        this[kStdioHandle].setMode(ttyMode);
    }
}

class OutputStream extends BaseIOStream {
    async write(buf) {
        return this[kStdioHandle].write(buf);
    }

    get height() {
        if (!this.isTerminal) {
            throw new Error('not a terminal');
        }

        return this[kStdioHandle].getWinSize().height;
    }

    get width() {
        if (!this.isTerminal) {
            throw new Error('not a terminal');
        }

        return this[kStdioHandle].getWinSize().width;
    }
}

function createStdioStream(fd) {
    const isStdin = fd === core.STDIN_FILENO;
    const StreamType = isStdin ? InputStream : OutputStream;
    const type = core.guessHandle(fd);

    switch (type) {
        case 'tty': {
            const handle = new core.TTY(fd, isStdin);

            // Do blocking writes for TTYs:
            // https://github.com/nodejs/node/blob/014dad5953a632f44e668f9527f546c6e1bb8b86/lib/tty.js#L112
            if (!isStdin && core.platform !== 'windows') {
                handle.setBlocking(true);
            }

            return new StreamType(handle, type);
        }

        case 'pipe': {
            const handle = new core.Pipe();

            handle.open(fd);

            // Do blocking writes on Windows.
            if (!isStdin && core.platform === 'windows') {
                handle.setBlocking(true);
            }

            return new StreamType(handle, type);
        }

        case 'file': {
            const handle = core.newStdioFile(pathByFd(fd), fd);

            return new StreamType(handle, type);
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

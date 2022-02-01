import * as core from '@tjs/core';

const kStdioHandle = Symbol('kStdioHandle');
const kStdioHandleType = Symbol('kStdioHandleType');


class BaseIOStream {
    constructor(handle, type) {
        this[kStdioHandle] = handle;
        this[kStdioHandleType] = type;
    }

    get isTTY() {
        return this[kStdioHandleType] ===  'tty';
    }
}

class InputStream extends BaseIOStream {
    async read(buf) {
        return this[kStdioHandle].read(buf);
    }

    setMode(mode) {
        if (!this.isTTY) {
            throw new Error('not a TTY')
        }
        this[kStdioHandle].setMode(mode);
    }
}

class OutputStream extends BaseIOStream {
    async write(buf) {
        return this[kStdioHandle].write(buf);
    }

    get height() {
        if (!this.isTTY) {
            throw new Error('not a TTY')
        }
        return this[kStdioHandle].getWinSize().height;
    }

    get width() {
        if (!this.isTTY) {
            throw new Error('not a TTY')
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

            return new StreamType(handle, type);
        }
        case 'pipe': {
            const handle = new core.Pipe();

            handle.open(fd);

            return new StreamType(handle, type);
        }
        case 'file':
            // TODO.
        default:
            return undefined;
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

import {
    initWriteQueue, writeWithQueue, readableStreamForHandle, writableStreamForHandle
} from './stream-utils.js';

const core = globalThis[Symbol.for('tjs.internal.core')];

const kProcess = Symbol('kProcess');
const kStdin = Symbol('kStdin');
const kStdout = Symbol('kStdout');
const kStderr = Symbol('kStderr');

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

function createWritableForPipe(handle) {
    const writeQueue = initWriteQueue(handle);

    return writableStreamForHandle(handle, buf => writeWithQueue(handle, writeQueue, buf));
}

export function spawn(args, options) {
    const opts = { ...options };
    let stdin, stdout, stderr;

    if (opts.stdin === 'pipe') {
        const handle = new core.Pipe();

        opts.stdin = handle;
        stdin = createWritableForPipe(handle);
    }

    if (opts.stdout === 'pipe') {
        const handle = new core.Pipe();

        opts.stdout = handle;
        stdout = readableStreamForHandle(handle);
    }

    if (opts.stderr === 'pipe') {
        const handle = new core.Pipe();

        opts.stderr = handle;
        stderr = readableStreamForHandle(handle);
    }

    const proc = core.spawn(args, opts);

    return new Subprocess(proc, stdin, stdout, stderr);
}

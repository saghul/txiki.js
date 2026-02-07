import { readFromHandle, initWriteQueue, writeWithQueue } from './stream-utils.js';

const core = globalThis[Symbol.for('tjs.internal.core')];

const kHandle = Symbol('kHandle');
const kWriteQueue = Symbol('kWriteQueue');
const kProcess = Symbol('kProcess');
const kStdin = Symbol('kStdin');
const kStdout = Symbol('kStdout');
const kStderr = Symbol('kStderr');

class SubprocessPipe {
    constructor(handle) {
        this[kHandle] = handle;
        this[kWriteQueue] = initWriteQueue(handle);
    }

    read(buf) {
        return readFromHandle(this[kHandle], buf);
    }

    write(buf) {
        return writeWithQueue(this[kHandle], this[kWriteQueue], buf);
    }

    fileno() {
        return this[kHandle].fileno();
    }
}

class Subprocess {
    constructor(proc, stdin, stdout, stderr) {
        this[kProcess] = proc;
        this[kStdin] = stdin;
        this[kStdout] = stdout;
        this[kStderr] = stderr;
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
    let stdinPipe, stdoutPipe, stderrPipe;

    if (opts.stdin === 'pipe') {
        const handle = new core.Pipe();

        opts.stdin = handle;
        stdinPipe = new SubprocessPipe(handle);
    }

    if (opts.stdout === 'pipe') {
        const handle = new core.Pipe();

        opts.stdout = handle;
        stdoutPipe = new SubprocessPipe(handle);
    }

    if (opts.stderr === 'pipe') {
        const handle = new core.Pipe();

        opts.stderr = handle;
        stderrPipe = new SubprocessPipe(handle);
    }

    const proc = core.spawn(args, opts);

    return new Subprocess(proc, stdinPipe, stdoutPipe, stderrPipe);
}

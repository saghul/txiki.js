import { readableStreamForHandle, writableStreamForHandle } from './stream-utils.js';

const core = globalThis.__bootstrap;


export async function open(path, mode) {
    const handle = await core.open(path, mode);

    return new FileHandle(handle);
}

export async function mkstemp(template) {
    const handle = await core.mkstemp(template);

    return new FileHandle(handle);
}

const kHandle = Symbol('kHandle');
const kReadable = Symbol('kReadable');
const kWritable = Symbol('kWritable');

class FileHandle {
    constructor(handle) {
        this[kHandle] = handle;
    }

    get path() {
        return this[kHandle].path;
    }

    get readable() {
        if (!this[kReadable]) {
            this[kReadable] = readableStreamForHandle(this[kHandle]);
        }
        return this[kReadable];
    }

    get writable() {
        if (!this[kWritable]) {
            this[kWritable] = writableStreamForHandle(this[kHandle]);
        }
        return this[kWritable];
    }

    read(buf, offset) {
        return this[kHandle].read(buf, offset);
    }

    write(buf, offset) {
        return this[kHandle].write(buf, offset);
    }

    stat() {
        return this[kHandle].stat();
    }

    truncate(offset) {
        return this[kHandle].truncate(offset);
    }

    sync() {
        return this[kHandle].sync();
    }

    datasync() {
        return this[kHandle].datasync();
    }

    close() {
        this[kHandle].close();
    }
}
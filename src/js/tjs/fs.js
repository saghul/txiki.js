import { readableStreamForHandle, writableStreamForHandle } from './stream-utils.js';

const core = globalThis.__bootstrap;

const kReadable = Symbol('kReadable');
const kWritable = Symbol('kWritable');

const fhProxyHandler = {
    get (target, prop) {
        switch (prop) {
            case 'readable': {
                if (!target[kReadable]) {
                    target[kReadable] = readableStreamForHandle(target);
                }
                return target[kReadable];
            }
            case 'writable': {
                if (!target[kWritable]) {
                    target[kWritable] = writableStreamForHandle(target);
                }
                return target[kWritable];
            }
            default: {
                if (typeof target[prop] == 'function') {
                    return (...args) => {
                        return target[prop].apply(target, args);
                    }
                }

                return target[prop];
            }
        }
    }
};

export async function open(path, mode) {
    const handle = await core.open(path, mode);

    return new Proxy(handle, fhProxyHandler);
}

export async function mkstemp(template) {
    const handle = await core.mkstemp(template);

    return new Proxy(handle, fhProxyHandler);
}

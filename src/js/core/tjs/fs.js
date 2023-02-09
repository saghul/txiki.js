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
                if (typeof target[prop] === 'function') {
                    return (...args) => target[prop].apply(target, args);
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

// Lazy load.
let pathMod;

export async function mkdir(path, options = { mode: 0o777, recursive: false }) {
    if (!options.recursive) {
        return core.mkdir(path, options.mode);
    }

    if (!pathMod) {
        const { default: pathModule } = await import('tjs:path');

        pathMod = pathModule;
    }

    const paths = path.split(pathMod.sep);
    let curPath = '';

    for (const p of paths) {
        curPath = pathMod.join(curPath, p);

        try {
            await core.mkdir(curPath, options.mode);
        } catch (e) {
            // Cannot rely on checking for EEXIST since the OS could throw other errors like EROFS.

            const st = await core.stat(curPath);

            if (!st.isDirectory) {
                throw e;
            }
        }
    }
}

export async function mkstemp(template) {
    const handle = await core.mkstemp(template);

    return new Proxy(handle, fhProxyHandler);
}

const core = globalThis[Symbol.for('tjs.internal.core')];

import pathModule from './path.js';
import { readableStreamForHandle, writableStreamForHandle } from './stream-utils.js';

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

export async function mkstemp(template) {
    const handle = await core.mkstemp(template);

    return new Proxy(handle, fhProxyHandler);
}

export async function mkdir(path, options = { mode: 0o777, recursive: false }) {
    if (!options.recursive) {
        return core.mkdir(path, options.mode);
    }

    const parent = pathModule.dirname(path);

    if (parent === path) {
        return;
    }

    await mkdir(parent, options);

    try {
        return await core.mkdir(path, options.mode);
    } catch (e) {
        // Cannot rely on checking for EEXIST since the OS could throw other errors like EROFS.

        const st = await core.stat(path);

        if (!st.isDirectory) {
            throw e;
        }
    }
}

// This is an adaptation of the 'rimraf' version bundled in Node.
//

const notEmptyErrors = new Set([
    'ENOTEMPTY',
    'EEXIST',
    'EPERM'
]);
const retryErrors = new Set([
    'EBUSY',
    'EMFILE',
    'ENFILE',
    'ENOTEMPTY',
    'EPERM'
]);
const isWindows = core.platform === 'windows';
const _epermHandler = isWindows ? _fixWinEPERM : _rmdir;

export async function rm(path, options = { maxRetries: 0, retryDelay: 100 }) {
    let stats;

    try {
        stats = await core.lstat(path);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return;
        }

        // Windows can EPERM on stat.
        if (isWindows && err.code === 'EPERM') {
            await _fixWinEPERM(path, options, err);
        }
    }

    try {
        if (stats?.isDirectory) {
            await _rmdir(path, options, null);
        } else {
            await _unlink(path, options);
        }
    } catch (err) {
        if (err.code === 'ENOENT') {
            return;
        }

        if (err.code === 'EPERM') {
            return _epermHandler(path, options, err);
        }

        if (err.code !== 'EISDIR') {
            throw err;
        }

        await _rmdir(path, options, err);
    }
}


async function _unlink(path, options) {
    const tries = options.maxRetries + 1;

    for (let i = 1; i <= tries; i++) {
        try {
            return core.unlink(path);
        } catch (err) {
            // Only sleep if this is not the last try, and the delay is greater
            // than zero, and an error was encountered that warrants a retry.
            if (retryErrors.has(err.code) && i < tries && options.retryDelay > 0) {
                await sleep(i * options.retryDelay);
            } else if (err.code === 'ENOENT') {
                // The file is already gone.
                return;
            } else if (i === tries) {
                throw err;
            }
        }
    }
}


async function _rmdir(path, options, originalErr) {
    try {
        await core.rmdir(path);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return;
        }

        if (err.code === 'ENOTDIR') {
            throw originalErr || err;
        }

        if (notEmptyErrors.has(err.code)) {
            // Removing failed. Try removing all children and then retrying the
            // original removal. Windows has a habit of not closing handles promptly
            // when files are deleted, resulting in spurious ENOTEMPTY failures. Work
            // around that issue by retrying on Windows.

            const dirIter = await core.readdir(path);

            for await (const item of dirIter) {
                const childPath = pathModule.join(path, item.name);

                await rm(childPath, options);
            }

            const tries = options.maxRetries + 1;

            for (let i = 1; i <= tries; i++) {
                try {
                    return core.rmdir(path);
                } catch (err) {
                    // Only sleep if this is not the last try, and the delay is greater
                    // than zero, and an error was encountered that warrants a retry.
                    if (retryErrors.has(err.code) && i < tries && options.retryDelay > 0) {
                        await sleep(i * options.retryDelay);
                    } else if (err.code === 'ENOENT') {
                        // The file is already gone.
                        return;
                    } else if (i === tries) {
                        throw err;
                    }
                }
            }
        }

        throw originalErr || err;
    }
}


async function _fixWinEPERM(path, options, originalErr) {
    try {
        await core.chmod(path, 0o666);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return;
        }

        throw originalErr;
    }

    let stats;

    try {
        stats = await core.stat(path);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return;
        }

        throw originalErr;
    }

    if (stats.isDirectory) {
        return _rmdir(path, options, originalErr);
    } else {
        return _unlink(path, options);
    }
}

async function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

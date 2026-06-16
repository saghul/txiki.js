import core from 'tjs:internal/core';

let transpilerInstance = null;
let transpilerModule = null;

const TYPESCRIPT_VERSION = '0.1.0';

function initTranspiler() {
    if (transpilerInstance) {
        return true;
    }

    let wasmBytes;

    if (core.typescriptEmbedded) {
        wasmBytes = core.typescriptEmbedded;
    } else {
        const tjsHome = (tjs.env && tjs.env.TJS_HOME) ? tjs.env.TJS_HOME : tjs.homeDir + '/.tjs';
        const tsDir = tjsHome + '/typescript/' + TYPESCRIPT_VERSION;
        const wasmPath = tsDir + '/oxc_transpiler.wasm';

        try {
            const data = core.syncReadFile(wasmPath);
            if (data) {
                wasmBytes = data;
            }
        } catch (e) {}
    }

    if (!wasmBytes) {
        return false;
    }

    try {
        transpilerModule = new WebAssembly.Module(wasmBytes);

        const wasiImport = {
            'wasi_snapshot_preview1': {
                random_get: function(buf, bufLen) { return 0; },
                environ_get: function(environ, environBuf) { return 0; },
                environ_sizes_get: function(count, bufSize) { return 0; },
                fd_write: function(fd, iovs, iovsLen, nwritten) { return 0; },
                proc_exit: function(code) { /* ignore */ },
            }
        };

        transpilerInstance = new WebAssembly.Instance(transpilerModule, wasiImport);
        return true;
    } catch (e) {
        return false;
    }
}

export function transpile(filename, source, options) {
    if (!initTranspiler()) {
        throw new Error('TypeScript transpiler not available');
    }

    const mem = transpilerInstance.exports.memory;
    const fn = transpilerInstance.exports.transpile;

    const input = JSON.stringify({
        source,
        filename: filename || 'untitled.ts',
        options: options || {}
    });

    const inputBytes = new TextEncoder().encode(input);
    const inputLen = inputBytes.length;
    const outputMax = 256 * 1024;

    const neededBytes = inputLen + outputMax + 4096;
    const pageSize = 65536;
    const neededPages = Math.ceil(neededBytes / pageSize);
    const currentPages = mem.buffer.byteLength / pageSize;
    if (neededPages > currentPages) {
        mem.grow(neededPages - currentPages);
    }

    const buf = new Uint8Array(mem.buffer);
    const inputOffset = 8192;
    const outputOffset = inputOffset + inputLen + 8;

    buf.set(inputBytes, inputOffset);

    const written = fn(inputOffset, inputLen, outputOffset, outputMax);

    if (written < 0) {
        throw new Error('TypeScript transpilation failed (returned ' + written + ')');
    }

    const resultStr = new TextDecoder().decode(
        new Uint8Array(mem.buffer, outputOffset, written)
    );
    const result = JSON.parse(resultStr);

    if (result.error) {
        throw new Error('Transpilation error: ' + result.error);
    }

    return result.code;
}

export function isAvailable() {
    return true;
}

/* global tjs */
import core from 'tjs:internal/core';

let transpilerInstance = null;
let transpilerModule = null;

async function loadEmbedded() {
    const bytes = core.typescriptEmbedded;

    if (bytes) {
        return compileAndInstantiate(bytes);
    }

    return false;
}

async function loadFromCache() {
    const tjsHome = (tjs.env && tjs.env.TJS_HOME) || tjs.homeDir + '/.tjs';
    const cacheDir = tjsHome + '/typescript/' + tjs.version;
    const wasmPath = cacheDir + '/oxc_transpiler.wasm';

    try {
        const data = await tjs.readFile(wasmPath);

        if (data) {
            return await compileAndInstantiate(data);
        }
    } catch (_) {
        // File not cached.
    }

    return false;
}

async function downloadAndCache() {
    const downloadUrl = 'https://github.com/saghul/txiki.js/releases/download/v' + tjs.version + '/oxc_transpiler.wasm';
    const tjsHome = (tjs.env && tjs.env.TJS_HOME) || tjs.homeDir + '/.tjs';
    const cacheDir = tjsHome + '/typescript/' + tjs.version;
    const wasmPath = cacheDir + '/oxc_transpiler.wasm';

    const res = await fetch(downloadUrl);

    if (!res.ok) {
        throw new Error(
            'Failed to download TypeScript transpiler for tjs v' + tjs.version +
            ': ' + res.status + ' ' + res.statusText + '\n' +
            'Build it locally with: make oxc'
        );
    }

    const blob = await res.blob();
    const wasmBytes = new Uint8Array(await blob.arrayBuffer());

    await tjs.makeDir(cacheDir, { recursive: true });
    await tjs.writeFile(wasmPath, wasmBytes);

    return await compileAndInstantiate(wasmBytes);
}

async function compileAndInstantiate(wasmBytes) {
    transpilerModule = new WebAssembly.Module(wasmBytes);

    const wasiImport = {
        'wasi_snapshot_preview1': {
            random_get: function(_buf, _bufLen) {
                return 0;
            },
            environ_get: function(_environ, _environBuf) {
                return 0;
            },
            environ_sizes_get: function(_count, _bufSize) {
                return 0;
            },
            fd_write: function(_fd, _iovs, _iovsLen, _nwritten) {
                return 0;
            },
            proc_exit: function(_code) { /* ignore */ },
        }
    };

    transpilerInstance = new WebAssembly.Instance(transpilerModule, wasiImport);

    return true;
}

async function ensureTranspiler() {
    if (transpilerInstance) {
        return true;
    }

    if (await loadEmbedded()) {
        return true;
    }

    if (await loadFromCache()) {
        return true;
    }

    return await downloadAndCache();
}

await ensureTranspiler();

export function transpile(filename, source, options) {
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

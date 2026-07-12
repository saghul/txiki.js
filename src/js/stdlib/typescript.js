/* global tjs */
import core from 'tjs:internal/core';

const TRANSPILER_VERSION = '0.1.1';

let transpilerInstance = null;
let transpilerModule = null;

async function loadEmbedded() {
    const bytes = core.typescriptEmbedded;

    if (bytes) {
        return compileAndInstantiate(bytes);
    }

    return false;
}

function cacheDir() {
    const tjsHome = (tjs.env && tjs.env.TJS_HOME) || tjs.homeDir + '/.tjs';

    return tjsHome + '/typescript/' + TRANSPILER_VERSION;
}

function wasmPath() {
    return cacheDir() + '/oxc_transpiler.wasm';
}

function downloadUrl() {
    const base = 'https://github.com/KaruroChori/txikijs-ts-transpiler';

    return base + '/releases/download/v' + TRANSPILER_VERSION + '/oxc_transpiler.wasm';
}

async function loadFromCache() {
    try {
        const data = await tjs.readFile(wasmPath());

        if (data) {
            return await compileAndInstantiate(data);
        }
    } catch (_) {
        // File not cached.
    }

    return false;
}

async function downloadAndCache() {
    const url = downloadUrl();
    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(
            'Failed to download TypeScript transpiler v' + TRANSPILER_VERSION +
            ': ' + res.status + ' ' + res.statusText
        );
    }

    const blob = await res.blob();
    const wasmBytes = new Uint8Array(await blob.arrayBuffer());

    await tjs.makeDir(cacheDir(), { recursive: true });
    await tjs.writeFile(wasmPath(), wasmBytes);

    return await compileAndInstantiate(wasmBytes);
}

function compileAndInstantiate(wasmBytes) {
    transpilerModule = new WebAssembly.Module(wasmBytes);

    transpilerInstance = new WebAssembly.Instance(transpilerModule);

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

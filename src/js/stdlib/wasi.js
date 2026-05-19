/**
 * WASI (WebAssembly System Interface) implementation.
 * @module tjs:wasi
 */

import core from 'tjs:internal/core';
const wasm = core.wasm;

const SUPPORTED_WASI_VERSIONS = [ 'wasi_unstable', 'wasi_snapshot_preview1' ];

export class WASI {
    #started = false;
    #options;
    #version;
    #wasiImport;

    constructor(options = {}) {
        if (options === null || typeof options !== 'object') {
            throw new TypeError('options must be an object');
        }

        // Validate and store version (required)
        const version = options.version;

        if (version === undefined) {
            throw new TypeError(
                `options.version is required. Supported versions: ${SUPPORTED_WASI_VERSIONS.join(', ')}`);
        }

        if (!SUPPORTED_WASI_VERSIONS.includes(version)) {
            throw new TypeError(
                `Unsupported WASI version "${version}". Supported versions: ${SUPPORTED_WASI_VERSIONS.join(', ')}`);
        }

        this.#version = version;

        this.#options = JSON.parse(JSON.stringify({
            args: options.args ?? [],
            env: options.env ?? {},
            preopens: options.preopens ?? {}
        }));

        // wasiImport is used to identify this as a WASI instance
        // The actual WASI functions are handled by WAMR internally
        this.#wasiImport = { _configure: nativeModule => this._configure(nativeModule) };
    }

    get wasiImport() {
        return this.#wasiImport;
    }

    // Called by WebAssembly.Instance via duck typing
    // Receives the raw native module handle
    _configure(nativeModule) {
        // Pass WASI options to the native layer
        // This must be called before instantiation
        const opts = this.#options;

        wasm.setWasiOptions(
            nativeModule,
            opts.args,
            opts.env,
            opts.preopens
        );
    }

    getImportObject() {
        return { [this.#version]: this.wasiImport };
    }

    start(instance) {
        if (this.#started) {
            throw new Error('WASI instance has already started');
        }

        if (!instance.exports._start) {
            throw new TypeError('WASI entrypoint not found');
        }

        this.#started = true;

        instance.exports._start();
    }
}

export default WASI;

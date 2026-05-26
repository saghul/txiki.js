/* global tjs */

/**
 * WASI (WebAssembly System Interface) implementation.
 * @module tjs:wasi
 */

import core from 'tjs:internal/core';
const wasm = core.wasm;

const SUPPORTED_WASI_VERSIONS = [ 'wasi_unstable', 'wasi_snapshot_preview1' ];

// Hand-off key between this module and the WebAssembly.Instance polyfill, which
// live in separate bundles. A global-registry symbol lets both sides obtain the
// same key without a shared import. The value behind it is only a pair of thin
// invoker closures; the real logic stays in the #private methods they call.
const kWasiHooks = Symbol.for('tjs.wasi.hooks');

function validateFd(value, name) {
    if (value === undefined) {
        return undefined;
    }

    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new TypeError(`options.${name} must be a non-negative integer file descriptor`);
    }

    return value;
}

export class WASI {
    #started = false;
    #options;
    #version;
    #returnOnExit;
    #nativeInstance = null;
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

        const returnOnExit = options.returnOnExit ?? true;

        if (typeof returnOnExit !== 'boolean') {
            throw new TypeError('options.returnOnExit must be a boolean');
        }

        this.#returnOnExit = returnOnExit;

        this.#options = {
            ...JSON.parse(JSON.stringify({
                args: options.args ?? [],
                env: options.env ?? {},
                preopens: options.preopens ?? {}
            })),
            stdin: validateFd(options.stdin, 'stdin'),
            stdout: validateFd(options.stdout, 'stdout'),
            stderr: validateFd(options.stderr, 'stderr')
        };

        // The import namespace WAMR sees is opaque (WASI functions are resolved
        // internally). Its only content is a symbol-keyed hook table the
        // polyfill uses to drive our #private configure/postInstantiate.
        this.#wasiImport = Object.freeze({
            [kWasiHooks]: Object.freeze({
                configure: nativeModule => this.#configure(nativeModule),
                postInstantiate: nativeInstance => this.#postInstantiate(nativeInstance),
            }),
        });
    }

    get wasiImport() {
        return this.#wasiImport;
    }

    // Called before instantiation with the raw native module handle.
    #configure(nativeModule) {
        const opts = this.#options;

        wasm.setWasiOptions(
            nativeModule,
            opts.args,
            opts.env,
            opts.preopens,
            opts.stdin,
            opts.stdout,
            opts.stderr
        );
    }

    // Called after instantiation; stores the raw instance handle so start()
    // can drive _start() natively.
    #postInstantiate(nativeInstance) {
        this.#nativeInstance = nativeInstance;
    }

    getImportObject() {
        return { [this.#version]: this.#wasiImport };
    }

    start(instance) {
        if (this.#started) {
            throw new Error('WASI instance has already started');
        }

        if (!instance.exports._start) {
            throw new TypeError('WASI entrypoint not found');
        }

        if (!this.#nativeInstance) {
            throw new Error('WASI was not bound to this instance; ' +
                'pass wasi.getImportObject() or wasi.wasiImport to WebAssembly.Instance');
        }

        this.#started = true;

        const code = wasm.runWasiStart(this.#nativeInstance);

        if (this.#returnOnExit) {
            return code;
        }

        tjs.exit(code);
    }
}

export default WASI;

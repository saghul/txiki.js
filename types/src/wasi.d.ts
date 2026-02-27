/**
 * WASI (WebAssembly System Interface) implementation.
 *
 * Run WebAssembly modules that use the WASI interface for system access
 * such as filesystem operations, environment variables, and command-line arguments.
 *
 * ```js
 * import { WASI } from 'tjs:wasi';
 *
 * const wasi = new WASI({ version: 'wasi_snapshot_preview1' });
 * const { instance } = await WebAssembly.instantiate(
 *     await tjs.readFile('module.wasm'),
 *     wasi.getImportObject(),
 * );
 * wasi.start(instance);
 * ```
 *
 * @module tjs:wasi
 */

declare module 'tjs:wasi' {
    export type WASIVersion = 'wasi_unstable' | 'wasi_snapshot_preview1';

    export interface WASIOptions {
        /** Required. The WASI version to use. */
        version: WASIVersion;
        /** Command line arguments. */
        args?: string[];
        /** Environment variables as key-value pairs. */
        env?: Record<string, string>;
        /** Pre-opened directories mapping guest paths to host paths. */
        preopens?: Record<string, string>;
    }

    export class WASI {
        constructor(options: WASIOptions);

        /** Object to pass to WebAssembly.Instance importObject. */
        readonly wasiImport: object;

        /** Returns import object with the appropriate WASI namespace. */
        getImportObject(): Record<string, object>;

        /** Start the WASI instance. */
        start(instance: WebAssembly.Instance): void;
    }

    export default WASI;
}

/**
 * WASI (WebAssembly System Interface) implementation.
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

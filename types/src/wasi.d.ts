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
        /**
         * By default, when the WASI application calls `proc_exit()`,
         * {@link WASI.start} returns the exit code rather than terminating the
         * process. Set to `false` to make the process exit with that code
         * instead.
         * @default true
         */
        returnOnExit?: boolean;
        /**
         * The file descriptor used as standard input in the WASI application.
         * On Windows this must be a regular file or standard-stream fd; sockets
         * and pipes are not supported.
         * @default 0
         */
        stdin?: number;
        /**
         * The file descriptor used as standard output in the WASI application.
         * On Windows this must be a regular file or standard-stream fd; sockets
         * and pipes are not supported.
         * @default 1
         */
        stdout?: number;
        /**
         * The file descriptor used as standard error in the WASI application.
         * On Windows this must be a regular file or standard-stream fd; sockets
         * and pipes are not supported.
         * @default 2
         */
        stderr?: number;
    }

    export class WASI {
        constructor(options: WASIOptions);

        /** Object to pass to WebAssembly.Instance importObject. */
        readonly wasiImport: object;

        /** Returns import object with the appropriate WASI namespace. */
        getImportObject(): Record<string, object>;

        /**
         * Start the WASI instance, running its `_start` export.
         *
         * Returns the exit code passed to `proc_exit()` (or `0` on a clean
         * return). When `returnOnExit` is `false`, the process is terminated
         * with that code and this function does not return.
         */
        start(instance: WebAssembly.Instance): number;
    }

    export default WASI;
}

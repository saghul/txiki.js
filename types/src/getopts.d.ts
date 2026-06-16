/**
 * Command line options parsing module.
 *
 * Parse command line arguments into a structured object. Supports aliases,
 * typed options (string/boolean), default values, and stop-early behavior.
 *
 * ```js
 * import getopts from 'tjs:getopts';
 *
 * const opts = getopts(tjs.args.slice(1), {
 *     alias: { h: 'help', v: 'version' },
 *     boolean: ['help', 'version'],
 * });
 *
 * if (opts.help) {
 *     console.log('Usage: myapp [options]');
 * }
 * ```
 *
 * @module tjs:getopts
 */

declare module 'tjs:getopts'{
    export interface ParsedOptions {
        /** Positional (non-option) arguments, in order. */
        _: string[]
        /** Parsed option values, keyed by option name (and any aliases). */
        [key: string]: any
    }

    export interface Options {
        /** Map of option name to one or more aliases; aliases share the same value. */
        alias?: { [key: string]: string | string[] }
        /** Option names to always coerce to strings (e.g. `--port 80` yields `"80"`). */
        string?: string[]
        /** Option names to always treat as booleans, so the following token is not consumed as a value. */
        boolean?: string[]
        /** Map of option name to default value, used when the option is absent. */
        default?: { [key: string]: any }
        /** Callback invoked for each unrecognized option; return `false` to drop it, `true` (default) to keep it. */
        unknown?: (optionName: string) => boolean
        /** When `true`, the first positional argument and everything after it are pushed into `_`. */
        stopEarly?: boolean
    }


    /**
    * @param argv Arguments to parse.
    * @param options Parsing options (configuration).
    * @returns The parsed arguments.
    */
    function getoptsFunc(argv: string[], options?: Options): ParsedOptions;

    export default getoptsFunc;
}

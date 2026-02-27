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
        _: string[]
        [key: string]: any
    }

    export interface Options {
        alias?: { [key: string]: string | string[] }
        string?: string[]
        boolean?: string[]
        default?: { [key: string]: any }
        unknown?: (optionName: string) => boolean
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

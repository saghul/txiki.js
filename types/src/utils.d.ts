/**
 * Utility functions for formatting and inspecting values.
 *
 * Provides `inspect` for pretty-printing JavaScript values and `format` for
 * printf-style string formatting, following the
 * [Console Standard](https://console.spec.whatwg.org/#formatter).
 *
 * ```js
 * import { inspect, format } from 'tjs:utils';
 *
 * console.log(inspect({ a: 1, b: [2, 3] }, { colors: true }));
 * console.log(format('Hello %s, you are %d', 'Alice', 30));
 * ```
 *
 * @module tjs:utils
 */

declare module 'tjs:utils' {
    /**
     * Format any JS value to be well readable.
     *
     * @returns resulting string
     */
    export function inspect(value: unknown, options?: { depth?: number, colors?: boolean, showHidden?: boolean }): string;

    /**
     * Print format string and insert given values, see https://console.spec.whatwg.org/#formatter
     * Leftover values are appended to the end.
     *
     * @returns resulting string
     */
    export function format(format: string, ...args: unknown[]): string;

    /**
     * Format given values to a well readable string.
     *
     * @returns resulting string
     */
    export function format(...values: unknown[]): string;
}

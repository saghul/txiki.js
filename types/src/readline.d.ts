/**
 * Interactive line editing module.
 *
 * Provides a readline interface for interactive CLI programs with support for
 * line editing, history, tab completion, syntax colorization, and ANSI colors.
 *
 * ```js
 * import { createInterface, c } from 'tjs:readline';
 *
 * const rl = createInterface({ input: tjs.stdin, output: tjs.stdout });
 * const name = await rl.question(c.bold.green('What is your name? '));
 * rl.write(`Hello, ${name}!\n`);
 * rl.close();
 * ```
 *
 * @module tjs:readline
 */

declare module 'tjs:readline' {
    /**
     * Result returned by a completer function.
     */
    export interface CompleterResult {
        /** Array of completion candidates. */
        completions: string[];
        /** The substring being completed (used to determine how much to replace). */
        substring?: string;
    }

    /**
     * A token produced by a colorize function for syntax highlighting.
     */
    export interface ColorToken {
        /** The text content of the token. */
        text: string;
        /** ANSI escape sequence to apply as style (e.g. '\x1b[31m'). */
        style?: string;
    }

    /**
     * Options for creating a readline interface.
     */
    export interface InterfaceOptions {
        /** The input stream to read from. */
        input: ReadableStream<Uint8Array>;
        /** The output stream to write to. */
        output: WritableStream<Uint8Array>;
        /** The prompt string to display. Default: `'> '`. */
        prompt?: string;
        /** Maximum number of history entries. Set to 0 to disable. Default: `100`. */
        historySize?: number;
        /** Whether the input is a terminal. Auto-detected from input if not specified. */
        terminal?: boolean;
        /** Async function called for tab completion. */
        completer?: (line: string, cursor: number) => Promise<CompleterResult> | CompleterResult;
        /** Function called to colorize the current line for display. */
        colorize?: (line: string) => ColorToken[];
        /** If true, Enter inserts a newline and Ctrl+D submits. Default: `false`. */
        multiline?: boolean;
    }

    /**
     * A readline interface for interactive line editing.
     *
     * Supports full line editing with Emacs-style key bindings, history navigation,
     * tab completion, and syntax colorization when connected to a terminal.
     * Falls back to simple line-buffered input for non-TTY streams.
     */
    export class ReadlineInterface {
        /** The current line buffer (read-only). */
        readonly line: string;
        /** The current cursor position in the line buffer (read-only). */
        readonly cursor: number;
        /** The history array. Can be read or replaced. */
        history: string[];
        /** Whether multiline mode is enabled. */
        multiline: boolean;

        /**
         * Read a single line from input.
         *
         * Displays the configured prompt and waits for the user to submit a line.
         * Returns `null` on EOF (Ctrl+D on empty line) or after {@link close} is called.
         */
        readline(): Promise<string | null>;

        /**
         * Display a one-shot prompt and read a line.
         *
         * Like {@link readline} but temporarily overrides the prompt string.
         *
         * @param prompt The prompt to display.
         */
        question(prompt: string): Promise<string | null>;

        /**
         * Add an entry to the history.
         *
         * The entry is trimmed and deduplicated against the last history entry.
         *
         * @param entry The history entry to add.
         */
        addHistoryEntry(entry: string): void;

        /**
         * Write text to the output stream.
         *
         * @param text The text to write.
         */
        write(text: string): void;

        /** Clear the current line on the terminal. No-op if not a terminal. */
        clearLine(): void;

        /**
         * Move the cursor by a delta on the terminal.
         *
         * @param dx Number of positions to move (positive = right, negative = left).
         */
        moveCursor(dx: number): void;

        /**
         * Close the interface.
         *
         * Restores terminal mode, releases stream locks, and resolves any pending
         * readline with `null`. Ends async iteration.
         */
        close(): void;

        /** Async iterator that yields lines until EOF or close. */
        [Symbol.asyncIterator](): AsyncIterableIterator<string>;
    }

    /**
     * A chainable ANSI color/style function.
     *
     * Can be called directly to apply the style: `c.red('text')`.
     * Can be chained for compound styles: `c.bold.green('text')`.
     */
    export interface StyleFunction {
        (text: string): string;
        readonly bold: StyleFunction;
        readonly dim: StyleFunction;
        readonly italic: StyleFunction;
        readonly underline: StyleFunction;
        readonly inverse: StyleFunction;
        readonly strikethrough: StyleFunction;
        readonly black: StyleFunction;
        readonly red: StyleFunction;
        readonly green: StyleFunction;
        readonly yellow: StyleFunction;
        readonly blue: StyleFunction;
        readonly magenta: StyleFunction;
        readonly cyan: StyleFunction;
        readonly white: StyleFunction;
        readonly gray: StyleFunction;
        readonly grey: StyleFunction;
        readonly brightRed: StyleFunction;
        readonly brightGreen: StyleFunction;
        readonly brightYellow: StyleFunction;
        readonly brightBlue: StyleFunction;
        readonly brightMagenta: StyleFunction;
        readonly brightCyan: StyleFunction;
        readonly brightWhite: StyleFunction;
        readonly bgBlack: StyleFunction;
        readonly bgRed: StyleFunction;
        readonly bgGreen: StyleFunction;
        readonly bgYellow: StyleFunction;
        readonly bgBlue: StyleFunction;
        readonly bgMagenta: StyleFunction;
        readonly bgCyan: StyleFunction;
        readonly bgWhite: StyleFunction;
    }

    /**
     * ANSI color helper with chainable style modifiers.
     *
     * @example
     * ```js
     * import { c } from 'tjs:readline';
     *
     * c.red('error!');              // red text
     * c.bold.green('success');      // bold green text
     * c.rgb(255, 128, 0)('orange'); // RGB color
     * c.strip(ansiString);          // strip ANSI escapes
     * c.isColorSupported;           // boolean
     * ```
     */
    export const c: StyleFunction & {
        /**
         * Create a style function for an RGB foreground color.
         *
         * @param r Red component (0-255).
         * @param g Green component (0-255).
         * @param b Blue component (0-255).
         */
        rgb(r: number, g: number, b: number): StyleFunction;
        /**
         * Create a style function for an RGB background color.
         *
         * @param r Red component (0-255).
         * @param g Green component (0-255).
         * @param b Blue component (0-255).
         */
        bgRgb(r: number, g: number, b: number): StyleFunction;
        /**
         * Strip all ANSI escape sequences from a string.
         *
         * @param str The string to strip.
         */
        strip(str: string): string;
        /** Whether color output is supported (checks `NO_COLOR` env and terminal). */
        readonly isColorSupported: boolean;
    };

    /**
     * Check whether color output is supported.
     *
     * Returns `false` if `NO_COLOR` environment variable is set,
     * `true` if `FORCE_COLOR` is set, otherwise checks if stdout is a terminal.
     */
    export function isColorSupported(): boolean;

    /**
     * Create a new readline interface.
     *
     * @param options Configuration options.
     *
     * @example
     * ```js
     * import { createInterface } from 'tjs:readline';
     *
     * const rl = createInterface({
     *   input: tjs.stdin,
     *   output: tjs.stdout,
     *   prompt: '> ',
     * });
     *
     * for await (const line of rl) {
     *   rl.write(`You said: ${line}\n`);
     * }
     *
     * rl.close();
     * ```
     */
    export function createInterface(options: InterfaceOptions): ReadlineInterface;

    const _default: {
        createInterface: typeof createInterface;
        c: typeof c;
    };
    export default _default;
}

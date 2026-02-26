/* global tjs */

/*
 * txiki.js REPL - Built on top of tjs:readline
 *
 * Original QuickJS REPL:
 *   Copyright (c) 2017-2020 Fabrice Bellard
 *   Copyright (c) 2017-2020 Charlie Gordon
 *
 * Readline-based adaptation:
 *   Copyright (c) 2024-present Saúl Ibarra Corretgé <s@saghul.net>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import { c, createInterface } from 'tjs:readline';
import { inspect } from 'tjs:utils';

import { colorizeJs, isWord } from './colorize.js';
import { clearHistory, loadHistory, saveHistory } from './history.js';


const { evalScript, loadScript } = globalThis[Symbol.for('tjs.internal.core')];

const RESET = '\x1b[0m';

function ansi(name) {
    if (!name) {
        return '';
    }

    const fn = c[name];

    if (!fn) {
        return '';
    }

    return fn('').slice(0, -RESET.length);
}

const themes = {
    dark: {
        annotation: 'cyan',
        boolean: 'brightWhite',
        comment: 'white',
        date: 'magenta',
        default: 'brightGreen',
        error: 'brightRed',
        function: 'brightYellow',
        identifier: 'brightGreen',
        keyword: 'brightMagenta',
        null: 'brightWhite',
        number: 'green',
        other: 'white',
        propname: 'white',
        regexp: 'cyan',
        string: 'brightCyan',
        symbol: 'brightWhite',
        undefined: 'brightWhite',
    },
    light: {
        annotation: 'cyan',
        boolean: 'brightMagenta',
        comment: 'grey',
        date: 'magenta',
        default: 'black',
        error: 'red',
        function: 'brightYellow',
        identifier: 'black',
        keyword: 'brightMagenta',
        null: 'brightMagenta',
        number: 'green',
        other: 'black',
        propname: 'black',
        regexp: 'cyan',
        string: 'brightCyan',
        symbol: 'grey',
        undefined: 'brightMagenta',
    },
};

let styles = themes.dark;
let showTime = false;
let showColors = true;
let showHidden = false;
let showDepth = 2;
let useStrict = false;

let mexpr = '';
let pstate = '';

const ps1 = '> ';
const ps2 = '  ... ';

let evalTime = 0;

let rl;

function puts(s) {
    rl.write(String(s));
}

// --- Colorize callback for readline ---

function colorizeLine(cmd) {
    const str = mexpr ? mexpr + '\n' + cmd : cmd;
    const start = str.length - cmd.length;
    const colorstate = colorizeJs(str);
    const styleNames = colorstate[2];
    const tokens = [];
    let j = start;

    while (j < str.length) {
        const style = styleNames[j] || 'default';
        let k = j;

        while (k + 1 < str.length && (styleNames[k + 1] || 'default') === style) {
            k++;
        }

        k++;

        const color = ansi(styles[style]) || '';

        tokens.push({
            text: str.substring(j, k),
            style: color,
        });
        j = k;
    }

    return tokens;
}

// --- Tab completion ---

const keywords = [
    'await ', 'catch (', 'class ', 'const ', 'else ', 'export ', 'for ',
    'function ', 'if (', 'import ', 'instanceof ', 'let ', 'new ',
    'return', 'super ', 'this.', 'try {', 'typeof ', 'var ', 'while (',
    'yield ',
];

function isBlank(ch) {
    return typeof ch === 'string' && '\t\r\n\f\v'.includes(ch[0]);
}

function isNamedProperty(line, end) {
    let pos = end;

    while (pos > 0 && isWord(line[pos - 1])) {
        pos--;
    }

    while (pos > 0 && isBlank(line[pos - 1])) {
        pos--;
    }

    return pos > 0 && line[pos - 1] === '.';
}

function getContextWord(line, end) {
    let pos = end;

    while (pos > 0 && isWord(line[pos - 1])) {
        pos--;
    }

    return line.slice(pos, end);
}

function getContextObject(line, pos) {
    if (pos <= 0) {
        return globalThis;
    }

    let ch = line[pos - 1];

    if (pos === 1 && (ch === '\\' || ch === '.')) {
        return directives;
    }

    if ('\'"`@#)]}\\'.indexOf(ch) >= 0) {
        return void 0;
    }

    if (ch === '.') {
        pos--;
        ch = line[pos - 1];

        switch (ch) {
            case '\'':
            case '"':
            case '`':
                return 'a';
            case ']':
                return [];
            case '/':
                return / /;
            default:
                if (isWord(ch)) {
                    const base = getContextWord(line, pos);
                    const basePos = pos - base.length;

                    if (base === 'true' || base === 'false') {
                        return true;
                    }

                    if (base === 'null') {
                        return null;
                    }

                    if (base === 'this') {
                        return globalThis;
                    }

                    if (!isNaN(+base)) {
                        return 0;
                    }

                    const obj = getContextObject(line, basePos);

                    if (obj === null || obj === void 0) {
                        return obj;
                    }

                    if (typeof obj[base] !== 'undefined') {
                        return obj[base];
                    }

                    if (basePos >= 3 && line[basePos - 1] === '/' && base.match(/^[dgimsuvy]+$/)) {
                        return RegExp();
                    }
                }

                break;
        }

        return {};
    }

    return globalThis;
}

function symcmp(a, b) {
    if (a[0] !== b[0]) {
        if (a[0] === '_') {
            return 1;
        }

        if (b[0] === '_') {
            return -1;
        }
    }

    if (a < b) {
        return -1;
    }

    if (a > b) {
        return +1;
    }

    return 0;
}

function getCompletions(line, pos) {
    const s = getContextWord(line, pos);
    const ctxObj = getContextObject(line, pos - s.length);
    const r = [];

    if (!isNamedProperty(line, pos)) {
        for (const kw of keywords) {
            if (kw.startsWith(s)) {
                r.push(kw);
            }
        }
    }

    // Enumerate properties from object and its prototype chain,
    // add non-numeric regular properties with s as a prefix.
    for (let i = 0, obj = ctxObj; i < 10 && obj !== null && obj !== void 0; i++) {
        const props = Object.getOwnPropertyNames(obj);

        for (let j = 0; j < props.length; j++) {
            const prop = props[j];

            if (typeof prop === 'string' && '' + (+prop) !== prop && prop.startsWith(s)) {
                r.push(prop);
            }
        }

        obj = Object.getPrototypeOf(obj);
    }

    if (r.length > 1) {
        r.sort(symcmp);

        let j = 1;

        for (let i = 1; i < r.length; i++) {
            if (r[i] !== r[i - 1]) {
                r[j++] = r[i];
            }
        }

        r.length = j;
    }

    return { completions: r, substring: s, ctx: ctxObj };
}

// --- Value display ---

function print(val) {
    puts(inspect(val, { depth: showDepth, colors: showColors, showHidden }) + '\n');
}

// --- Directives ---

function handleDirective(a) {
    if (a === '?') {
        help();

        return true;
    }

    if (a[0] !== '\\' && a[0] !== '.') {
        return false;
    }

    let pos = 1;

    while (pos < a.length && a[pos] !== ' ') {
        pos++;
    }

    const cmd = a.substring(1, pos);
    let partial = 0;
    let fun;

    for (const p in directives) {
        if (p.startsWith(cmd)) {
            fun = directives[p];
            partial++;

            if (p === cmd) {
                partial = 0;

                break;
            }
        }
    }

    if (fun && partial < 2) {
        fun(a.substring(pos).trim());
    } else {
        puts(`Unknown directive: ${cmd}\n`);
    }

    return true;
}

function help() {
    const sel = n => n ? '*' : ' ';

    puts('.help    print this help\n' +
         '.time   ' + sel(showTime) + 'toggle timing display\n' +
         '.strict ' + sel(useStrict) + 'toggle strict mode evaluation\n' +
         `.depth   set object depth (current: ${showDepth})\n` +
         '.hidden ' + sel(showHidden) + 'toggle hidden properties display\n' +
         '.color  ' + sel(showColors) + 'toggle colored output\n' +
         '.dark   ' + sel(styles === themes.dark) + 'select dark color theme\n' +
         '.light  ' + sel(styles === themes.light) + 'select light color theme\n' +
         '.clear   clear the terminal\n' +
         '.clear-history  clear command history\n' +
         '.load    load source code from a file\n' +
         '.quit    exit\n');
}

function load(s) {
    if (s.lastIndexOf('.') <= s.lastIndexOf('/')) {
        s += '.js';
    }

    try {
        loadScript(s);
    } catch (e) {
        puts(`${e}\n`);
    }
}

function exit(code) {
    saveHistory(rl);
    rl.close();
    tjs.exit(code);
}

function toBool(s, def) {
    return s ? '1 true yes Yes'.includes(s) : def;
}

const directives = Object.setPrototypeOf({
    'help': help,
    'load': load,
    'time': s => {
        showTime = toBool(s, !showTime);
    },
    'strict': s => {
        useStrict = toBool(s, !useStrict);
    },
    'depth': s => {
        showDepth = +s || 2;
    },
    'hidden': s => {
        showHidden = toBool(s, !showHidden);
    },
    'color': s => {
        showColors = toBool(s, !showColors);
    },
    'dark': () => {
        styles = themes.dark;
    },
    'light': () => {
        styles = themes.light;
    },
    'clear': () => {
        puts('\x1b[H\x1b[J');
    },
    'clear-history': () => {
        clearHistory(rl);
    },
    'quit': () => {
        exit(0);
    },
}, null);

// --- Config ---

function loadConfig() {
    const colorfgbg = tjs.env.COLORFGBG;
    let m;

    if (colorfgbg && (m = colorfgbg.match(/(\d+);(\d+)/))) {
        if (+m[2] !== 0) {
            styles = themes.light;
        }
    }

    const noColor = tjs.env.NO_COLOR;

    if (noColor && +noColor[0] !== 0) {
        showColors = false;
    }
}

// --- Eval loop ---

let evalStartTime;

async function evalAndPrint(expr) {
    if (useStrict) {
        expr = '"use strict"; void 0;' + expr;
    }

    evalStartTime = performance.now();

    try {
        let result = await Promise.try(evalScript, expr, { backtrace_barrier: true, async: true });

        result = result.value;
        evalTime = performance.now() - evalStartTime;
        print(result);
        globalThis._ = result;
    } catch (error) {
        evalTime = performance.now() - evalStartTime;

        if (showColors) {
            puts(ansi(styles.error));
        }

        if (error instanceof Error) {
            puts(error);
            puts('\n');

            if (error.stack) {
                puts(error.stack);
            }
        } else {
            puts('Throw: ');
            puts(error);
            puts('\n');
        }

        if (showColors) {
            puts(RESET);
        }
    }
}

async function handleCmd(expr) {
    if (!expr) {
        return;
    }

    if (mexpr) {
        expr = mexpr + '\n' + expr;
    } else {
        if (handleDirective(expr)) {
            return;
        }
    }

    const colorstate = colorizeJs(expr);

    pstate = colorstate[0];

    if (pstate) {
        mexpr = expr;

        return;
    }

    mexpr = '';

    await evalAndPrint(expr);

    tjs.engine.gc.run();
}

// --- Build the prompt string ---

let plen = 0;

function getPrompt() {
    let prompt = pstate;

    if (mexpr) {
        prompt += ' '.repeat(Math.max(0, plen - prompt.length));
        prompt += ps2;
    } else {
        if (showTime) {
            const t = evalTime / 1000;

            prompt += t.toFixed(6) + ' ';
        }

        plen = prompt.length;
        prompt += ps1;
    }

    return prompt;
}

// --- Main loop ---

// Avoid aborting in unhandled promises on the REPL.
window.addEventListener('unhandledrejection', event => {
    event.preventDefault();
});

loadConfig();

// Create the readline interface.
// Must be done before loadHistory (which sets rl.history)
// and before puts can be used (which uses rl.write).
rl = createInterface({
    input: tjs.stdin,
    output: tjs.stdout,
    prompt: getPrompt(),
    historySize: 1000,
    completer: getCompletions,
    colorize: showColors && tjs.stdin.isTerminal ? colorizeLine : null,
    onInterrupt(repeated) {
        if (repeated) {
            exit(0);
        }

        puts('\n(Press Ctrl-C again to quit)\n');

        return true;
    },
});

await loadHistory(rl);

puts('Welcome to txiki.js - Type ".help" for help\n');

// Main REPL loop.
while (true) {
    const line = await rl.question(getPrompt());

    if (line === null) {
        break;
    }

    await handleCmd(line);
}

exit(0);

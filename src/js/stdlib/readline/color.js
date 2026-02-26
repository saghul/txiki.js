const ANSI_CODES = {
    reset: '0',
    bold: '1',
    dim: '2',
    italic: '3',
    underline: '4',
    inverse: '7',
    strikethrough: '9',
    black: '30',
    red: '31',
    green: '32',
    yellow: '33',
    blue: '34',
    magenta: '35',
    cyan: '36',
    white: '37',
    gray: '90',
    grey: '90',
    brightRed: '91',
    brightGreen: '92',
    brightYellow: '93',
    brightBlue: '94',
    brightMagenta: '95',
    brightCyan: '96',
    brightWhite: '97',
    bgBlack: '40',
    bgRed: '41',
    bgGreen: '42',
    bgYellow: '43',
    bgBlue: '44',
    bgMagenta: '45',
    bgCyan: '46',
    bgWhite: '47',
};

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

function isColorSupported() {
    const g = globalThis;

    if (g.tjs) {
        if (g.tjs.env.NO_COLOR) {
            return false;
        }

        if (g.tjs.env.FORCE_COLOR) {
            return true;
        }

        try {
            return g.tjs.stdout.isTerminal;
        } catch {
            return false;
        }
    }

    return false;
}

function makeStyler(codes) {
    function styler(str) {
        return `\x1b[${codes.join(';')}m${str}\x1b[0m`;
    }

    return new Proxy(styler, {
        get(target, prop) {
            if (prop === 'call' || prop === 'apply' || prop === 'bind') {
                return target[prop].bind(target);
            }

            if (typeof prop === 'symbol') {
                return target[prop];
            }

            const code = ANSI_CODES[prop];

            if (code !== undefined) {
                return makeStyler([ ...codes, code ]);
            }

            return undefined;
        }
    });
}

const c = new Proxy({}, {
    get(target, prop) {
        if (prop === 'strip') {
            return str => str.replace(ANSI_REGEX, '');
        }

        if (prop === 'isColorSupported') {
            return isColorSupported();
        }

        if (prop === 'rgb') {
            return (r, g, b) => makeStyler([ `38;2;${r};${g};${b}` ]);
        }

        if (prop === 'bgRgb') {
            return (r, g, b) => makeStyler([ `48;2;${r};${g};${b}` ]);
        }

        if (typeof prop === 'symbol') {
            return target[prop];
        }

        const code = ANSI_CODES[prop];

        if (code !== undefined) {
            return makeStyler([ code ]);
        }

        return undefined;
    }
});

export { c, isColorSupported };
export default c;

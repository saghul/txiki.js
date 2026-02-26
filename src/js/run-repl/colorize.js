function isAlpha(ch) {
    return typeof ch === 'string' &&
        ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z'));
}

function isDigit(ch) {
    return typeof ch === 'string' && (ch >= '0' && ch <= '9');
}

export function isWord(ch) {
    return typeof ch === 'string' &&
        (isAlpha(ch) || isDigit(ch) || ch === '_' || ch === '$');
}

function isBalanced(a, b) {
    switch (a + b) {
        case '()':
        case '[]':
        case '{}':
            return true;
    }

    return false;
}

export function colorizeJs(str) {
    let i, ch, start;
    const n = str.length;
    let style, state = '', level = 0;
    let canRegex = 1;
    const r = [];

    function pushState(s) {
        state += s;
    }

    function lastState() {
        return state.substring(state.length - 1);
    }

    function popState() {
        const s = lastState();

        state = state.substring(0, state.length - 1);

        return s;
    }

    function parseBlockComment() {
        style = 'comment';
        pushState('/');

        for (i++; i < n - 1; i++) {
            if (str[i] === '*' && str[i + 1] === '/') {
                i += 2;
                popState();

                break;
            }
        }
    }

    function parseLineComment() {
        style = 'comment';

        for (i++; i < n; i++) {
            if (str[i] === '\n') {
                break;
            }
        }
    }

    function parseString(delim) {
        style = 'string';
        pushState(delim);

        while (i < n) {
            ch = str[i++];

            if (ch === '\n') {
                style = 'error';

                continue;
            }

            if (ch === '\\') {
                if (i >= n) {
                    break;
                }

                i++;
            } else if (ch === delim) {
                popState();

                break;
            }
        }
    }

    function parseRegex() {
        style = 'regexp';
        pushState('/');

        while (i < n) {
            ch = str[i++];

            if (ch === '\n') {
                style = 'error';

                continue;
            }

            if (ch === '\\') {
                if (i < n) {
                    i++;
                }

                continue;
            }

            if (lastState() === '[') {
                if (ch === ']') {
                    popState();
                }

                // ECMA 5: ignore '/' inside char classes
                continue;
            }

            if (ch === '[') {
                pushState('[');

                if (str[i] === '[' || str[i] === ']') {
                    i++;
                }

                continue;
            }

            if (ch === '/') {
                popState();

                while (i < n && isWord(str[i])) {
                    i++;
                }

                break;
            }
        }
    }

    function parseNumber() {
        style = 'number';

        while (i < n && (isWord(str[i]) || (str[i] === '.' && (i === n - 1 || str[i + 1] !== '.')))) {
            i++;
        }
    }

    const jsKeywords = '|' +
        'break|case|catch|continue|debugger|default|delete|do|' +
        'else|finally|for|function|if|in|instanceof|new|' +
        'return|switch|this|throw|try|typeof|while|with|' +
        'class|const|enum|import|export|extends|super|' +
        'implements|interface|let|var|package|private|protected|' +
        'public|static|yield|' +
        'void|undefined|null|true|false|Infinity|NaN|' +
        'eval|arguments|' +
        'await|';

    const jsNoRegex = '|this|super|undefined|null|true|false|Infinity|NaN|arguments|';

    function parseIdentifier() {
        canRegex = 1;

        while (i < n && isWord(str[i])) {
            i++;
        }

        const s = str.substring(start, i);
        const w = '|' + s + '|';

        if (jsKeywords.indexOf(w) >= 0) {
            style = 'keyword';

            if (s === 'true' || s === 'false') {
                style = 'boolean';
            } else if (s === 'null') {
                style = 'null';
            } else if (s === 'undefined') {
                style = 'undefined';
            }

            if (jsNoRegex.indexOf(w) >= 0) {
                canRegex = 0;
            }

            return;
        }

        let i1 = i;

        while (i1 < n && str[i1] === ' ') {
            i1++;
        }

        if (i1 < n && str[i1] === '(') {
            style = 'function';

            return;
        }

        style = 'identifier';
        canRegex = 0;
    }

    function setStyle(from, to) {
        while (r.length < from) {
            r.push('default');
        }

        while (r.length < to) {
            r.push(style);
        }
    }

    for (i = 0; i < n;) {
        style = null;
        start = i;

        switch (ch = str[i++]) {
            case ' ':
            case '\t':
            case '\r':
            case '\n':
                continue;
            case '+':
            case '-':
                if (i < n && str[i] === ch) {
                    i++;

                    continue;
                }

                canRegex = 1;

                continue;
            case '/':
                if (i < n && str[i] === '*') {
                    parseBlockComment();

                    break;
                }

                if (i < n && str[i] === '/') {
                    parseLineComment();

                    break;
                }

                if (canRegex) {
                    parseRegex();
                    canRegex = 0;

                    break;
                }

                canRegex = 1;

                continue;
            case '\'':
            case '"':
            case '`':
                parseString(ch);
                canRegex = 0;

                break;
            case '(':
            case '[':
            case '{':
                canRegex = 1;
                level++;
                pushState(ch);

                continue;
            case ')':
            case ']':
            case '}':
                canRegex = 0;

                if (level > 0 && isBalanced(lastState(), ch)) {
                    level--;
                    popState();

                    continue;
                }

                style = 'error';

                break;
            default:
                if (isDigit(ch)) {
                    parseNumber();
                    canRegex = 0;

                    break;
                }

                if (isWord(ch)) {
                    parseIdentifier();

                    break;
                }

                canRegex = 1;

                continue;
        }

        if (style) {
            setStyle(start, i);
        }
    }

    setStyle(n, n);

    return [ state, level, r ];
}

// --- Utility functions ---

function ucsLength(str) {
    let len = 0;
    const strLen = str.length;

    for (let i = 0; i < strLen; i++) {
        const cp = str.charCodeAt(i);

        if (cp < 0xdc00 || cp >= 0xe000) {
            len++;
        }
    }

    return len;
}

function isTrailingSurrogate(ch) {
    if (typeof ch !== 'string') {
        return false;
    }

    const d = ch.codePointAt(0);

    return d >= 0xdc00 && d < 0xe000;
}

function isWord(ch) {
    return typeof ch === 'string' &&
        ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') ||
         (ch >= '0' && ch <= '9') || ch === '_' || ch === '$');
}

// Return codes from key handlers.
const ACCEPT = -1;
const ABORT = -2;
const EOF = -3;

// --- ReadlineInterface ---

class ReadlineInterface {
    #input;
    #output;
    #reader;
    #writer;
    #encoder = new TextEncoder();
    #terminal;
    #closed = false;
    #line = '';
    #cursor = 0;
    #historyArr = [];
    #historyIndex = 0;
    #pending = null;
    #lineQueue = [];
    #lastLine = '';
    #lastCursorPos = 0;
    #termCursorX = 0;
    #termWidth = 80;
    #killRing = [];
    #killRingIndex = 0;
    #yankLen = 0;
    #undoStack = [];
    #redoStack = [];
    #searchMode = false;
    #searchDirection = -1;
    #searchQuery = '';
    #searchMatchIndex = -1;
    #searchFailing = false;
    #searchSavedLine = '';
    #searchSavedCursor = 0;
    #utf8State = 0;
    #utf8Val = 0;
    #escState = 0;
    #escKeys = '';
    #thisFun = null;
    #lastFun = null;
    #multilineEnabled;
    #multilineBuffer = '';
    #prompt;
    #historySize;
    #completer;
    #colorize;
    #onInterrupt;
    #prompted = false;

    constructor(options = {}) {
        const {
            input,
            output,
            prompt = '> ',
            historySize = 100,
            terminal,
            completer = null,
            colorize = null,
            multiline = false,
            onInterrupt = null,
        } = options;

        if (!input) {
            throw new TypeError('input is required');
        }

        if (!output) {
            throw new TypeError('output is required');
        }

        this.#input = input;
        this.#output = output;
        this.#reader = input.getReader();
        this.#writer = output.getWriter();

        if (terminal !== undefined) {
            this.#terminal = terminal;
        } else {
            this.#terminal = typeof input.isTerminal === 'boolean' ? input.isTerminal : false;
        }

        this.#prompt = prompt;
        this.#historySize = historySize;
        this.#completer = completer;
        this.#colorize = colorize;
        this.#multilineEnabled = multiline;
        this.#onInterrupt = onInterrupt;

        if (this.#terminal) {
            try {
                this.#termWidth = output.width || 80;
            } catch {
                this.#termWidth = 80;
            }
        }

        this.#startReadLoop();
    }

    // --- Public getters/setters ---

    get line() {
        return this.#line;
    }

    get cursor() {
        return this.#cursor;
    }

    get history() {
        return this.#historyArr;
    }

    set history(arr) {
        this.#historyArr = arr;
        this.#historyIndex = arr.length;
    }

    get multiline() {
        return this.#multilineEnabled;
    }

    set multiline(val) {
        this.#multilineEnabled = !!val;
    }

    // --- Public methods ---

    addHistoryEntry(str) {
        str = str.trimEnd();

        if (!str) {
            return;
        }

        if (this.#historyArr.length && this.#historyArr[this.#historyArr.length - 1] === str) {
            return;
        }

        this.#historyArr.push(str);

        if (this.#historySize > 0 && this.#historyArr.length > this.#historySize) {
            this.#historyArr = this.#historyArr.slice(-this.#historySize);
        }

        this.#historyIndex = this.#historyArr.length;
    }

    write(text) {
        if (this.#closed) {
            return;
        }

        this.#writer.write(this.#encoder.encode(String(text)));
    }

    clearLine() {
        if (!this.#terminal) {
            return;
        }

        this.#puts('\r\x1b[J');
        this.#termCursorX = 0;
    }

    moveCursor(dx) {
        if (!this.#terminal) {
            return;
        }

        this.#doMoveCursor(dx);
    }

    async question(prompt) {
        if (this.#closed && this.#lineQueue.length === 0) {
            return null;
        }

        const saved = this.#prompt;

        this.#prompt = prompt;

        const answer = await this.readline();

        this.#prompt = saved;

        return answer;
    }

    close() {
        if (this.#closed) {
            return;
        }

        this.#closed = true;

        if (this.#terminal) {
            try {
                this.#input.setRawMode(false);
            } catch {
                // Ignore.
            }
        }

        try {
            this.#reader.releaseLock();
        } catch {
            // Ignore.
        }

        try {
            this.#writer.releaseLock();
        } catch {
            // Ignore.
        }

        if (this.#pending) {
            this.#pending(null);
            this.#pending = null;
        }
    }

    async readline() {
        if (this.#lineQueue.length > 0) {
            return this.#lineQueue.shift();
        }

        if (this.#closed) {
            return null;
        }

        if (this.#terminal) {
            this.#printPrompt();
            this.#prompted = true;
            this.#update();
        } else {
            this.#puts(this.#prompt);
        }

        const { promise, resolve } = Promise.withResolvers();

        this.#pending = resolve;

        return promise;
    }

    [Symbol.asyncIterator]() {
        return {
            next: async () => {
                const line = await this.readline();

                if (line === null) {
                    return { value: undefined, done: true };
                }

                return { value: line, done: false };
            }
        };
    }

    // --- Private: Output helpers ---

    #puts(str) {
        this.#writer.write(this.#encoder.encode(str));
    }

    #printCsi(n, code) {
        this.#puts('\x1b[' + (n !== 1 ? n : '') + code);
    }

    #doMoveCursor(delta) {
        const tw = this.#termWidth;

        if (delta > 0) {
            while (delta !== 0) {
                if (this.#termCursorX === tw - 1) {
                    this.#puts('\n');
                    this.#termCursorX = 0;
                    delta--;
                } else {
                    const l = Math.min(tw - 1 - this.#termCursorX, delta);

                    this.#printCsi(l, 'C');
                    delta -= l;
                    this.#termCursorX += l;
                }
            }
        } else {
            delta = -delta;

            while (delta !== 0) {
                if (this.#termCursorX === 0) {
                    this.#printCsi(1, 'A');
                    this.#printCsi(tw - 1, 'C');
                    delta--;
                    this.#termCursorX = tw - 1;
                } else {
                    const l = Math.min(delta, this.#termCursorX);

                    this.#printCsi(l, 'D');
                    delta -= l;
                    this.#termCursorX -= l;
                }
            }
        }
    }

    // --- Private: Display ---

    #update() {
        const cmd = this.#line;
        const cursorPos = this.#cursor;
        const lastCmd = this.#lastLine;
        const lastCursorPos = this.#lastCursorPos;

        if (cmd !== lastCmd) {
            if (!this.#colorize && lastCmd.substring(0, lastCursorPos) === cmd.substring(0, lastCursorPos)) {
                this.#puts(cmd.substring(lastCursorPos));
            } else {
                this.#doMoveCursor(-ucsLength(lastCmd.substring(0, lastCursorPos)));

                if (this.#colorize) {
                    const tokens = this.#colorize(cmd);

                    if (tokens && Array.isArray(tokens)) {
                        for (const token of tokens) {
                            if (token.style) {
                                this.#puts(token.style);
                            }

                            this.#puts(token.text);

                            if (token.style) {
                                this.#puts('\x1b[0m');
                            }
                        }
                    } else {
                        this.#puts(cmd);
                    }
                } else {
                    this.#puts(cmd);
                }
            }

            this.#termCursorX = (this.#termCursorX + ucsLength(cmd)) % this.#termWidth;

            if (this.#termCursorX === 0) {
                this.#puts(' \x08');
            }

            this.#puts('\x1b[J');
            this.#lastLine = cmd;
            this.#lastCursorPos = cmd.length;
        }

        if (cursorPos > this.#lastCursorPos) {
            this.#doMoveCursor(ucsLength(cmd.substring(this.#lastCursorPos, cursorPos)));
        } else if (cursorPos < this.#lastCursorPos) {
            this.#doMoveCursor(-ucsLength(cmd.substring(cursorPos, this.#lastCursorPos)));
        }

        this.#lastCursorPos = cursorPos;
    }

    #printPrompt() {
        this.#puts(this.#prompt);
        this.#termCursorX = ucsLength(this.#prompt) % this.#termWidth;
        this.#lastLine = '';
        this.#lastCursorPos = 0;
    }

    // --- Private: Editing ---

    #insert(str, skipUndo) {
        if (str) {
            if (!skipUndo) {
                this.#saveUndo();
            }

            this.#line = this.#line.substring(0, this.#cursor) + str + this.#line.substring(this.#cursor);
            this.#cursor += str.length;
        }
    }

    #skipWordForward(pos) {
        while (pos < this.#line.length && !isWord(this.#line.charAt(pos))) {
            pos++;
        }

        while (pos < this.#line.length && isWord(this.#line.charAt(pos))) {
            pos++;
        }

        return pos;
    }

    #skipWordBackward(pos) {
        while (pos > 0 && !isWord(this.#line.charAt(pos - 1))) {
            pos--;
        }

        while (pos > 0 && isWord(this.#line.charAt(pos - 1))) {
            pos--;
        }

        return pos;
    }

    #deleteCharDir(dir) {
        let start = this.#cursor;

        if (dir < 0) {
            start--;

            while (isTrailingSurrogate(this.#line.charAt(start))) {
                start--;
            }
        }

        let end = start + 1;

        while (isTrailingSurrogate(this.#line.charAt(end))) {
            end++;
        }

        if (start >= 0 && start < this.#line.length) {
            if (this.#lastFun === 'killRegion') {
                this.#killRegion(start, end, dir);
            } else {
                this.#saveUndo();
                this.#line = this.#line.substring(0, start) + this.#line.substring(end);
                this.#cursor = start;
            }
        }
    }

    #saveUndo() {
        this.#undoStack.push({ line: this.#line, cursor: this.#cursor });
        this.#redoStack.length = 0;
    }

    #killRegion(start, end, dir) {
        this.#saveUndo();

        const s = this.#line.substring(start, end);

        if (this.#lastFun !== 'killRegion') {
            this.#killRing.push(s);

            if (this.#killRing.length > 32) {
                this.#killRing.shift();
            }
        } else if (dir < 0) {
            this.#killRing[this.#killRing.length - 1] = s + this.#killRing[this.#killRing.length - 1];
        } else {
            this.#killRing[this.#killRing.length - 1] = this.#killRing[this.#killRing.length - 1] + s;
        }

        this.#killRingIndex = this.#killRing.length - 1;
        this.#line = this.#line.substring(0, start) + this.#line.substring(end);

        if (this.#cursor > end) {
            this.#cursor -= end - start;
        } else if (this.#cursor > start) {
            this.#cursor = start;
        }

        this.#thisFun = 'killRegion';
    }

    #clampCursor() {
        if (this.#cursor < 0) {
            this.#cursor = 0;
        } else if (this.#cursor > this.#line.length) {
            this.#cursor = this.#line.length;
        }
    }

    // --- Private: Tab completion ---

    async #doCompletion() {
        if (!this.#completer) {
            return;
        }

        let result;

        try {
            result = await this.#completer(this.#line, this.#cursor);
        } catch {
            return;
        }

        if (!result || !result.completions || !result.completions.length) {
            return;
        }

        const tab = result.completions;
        const s = result.substring || '';

        // Find common prefix among all completions.
        let len = tab[0].length;

        for (let i = 1; i < tab.length; i++) {
            for (let j = 0; j < len; j++) {
                if (tab[i][j] !== tab[0][j]) {
                    len = j;

                    break;
                }
            }
        }

        // Insert the common part beyond what's already typed.
        for (let k = s.length; k < len; k++) {
            this.#insert(tab[0][k]);
        }

        // If double-tab and multiple completions, display them.
        if (this.#lastFun === 'completion' && tab.length >= 2) {
            let maxWidth = 0;

            for (let m = 0; m < tab.length; m++) {
                maxWidth = Math.max(maxWidth, tab[m].length);
            }

            maxWidth += 2;

            const nCols = Math.max(1, Math.floor((this.#termWidth + 1) / maxWidth));
            const nRows = Math.ceil(tab.length / nCols);

            this.#puts('\n');

            for (let row = 0; row < nRows; row++) {
                for (let col = 0; col < nCols; col++) {
                    const idx = col * nRows + row;

                    if (idx >= tab.length) {
                        break;
                    }

                    let entry = tab[idx];

                    if (col !== nCols - 1) {
                        entry = entry.padEnd(maxWidth);
                    }

                    this.#puts(entry);
                }

                this.#puts('\n');
            }

            this.#printPrompt();
        }

        this.#thisFun = 'completion';
        this.#update();
    }

    // --- Private: Key handlers ---
    // Each returns ACCEPT/ABORT/EOF to stop further processing, or undefined to continue.

    #beginningOfLine() {
        this.#cursor = 0;
    }

    #endOfLine() {
        this.#cursor = this.#line.length;
    }

    #forwardChar() {
        if (this.#cursor < this.#line.length) {
            this.#cursor++;

            while (isTrailingSurrogate(this.#line.charAt(this.#cursor))) {
                this.#cursor++;
            }
        }
    }

    #backwardChar() {
        if (this.#cursor > 0) {
            this.#cursor--;

            while (isTrailingSurrogate(this.#line.charAt(this.#cursor))) {
                this.#cursor--;
            }
        }
    }

    #forwardWord() {
        this.#cursor = this.#skipWordForward(this.#cursor);
    }

    #backwardWord() {
        this.#cursor = this.#skipWordBackward(this.#cursor);
    }

    #deleteChar() {
        this.#deleteCharDir(1);
    }

    #backwardDeleteChar() {
        this.#deleteCharDir(-1);
    }

    #transposeChars() {
        let pos = this.#cursor;

        if (this.#line.length > 1 && pos > 0) {
            this.#saveUndo();

            if (pos === this.#line.length) {
                pos--;
            }

            this.#line = this.#line.substring(0, pos - 1) + this.#line.substring(pos, pos + 1) +
                this.#line.substring(pos - 1, pos) + this.#line.substring(pos + 1);
            this.#cursor = pos + 1;
        }
    }

    #transposeWords() {
        const p1 = this.#skipWordBackward(this.#cursor);
        const p2 = this.#skipWordForward(p1);
        const p4 = this.#skipWordForward(this.#cursor);
        const p3 = this.#skipWordBackward(p4);

        if (p1 < p2 && p2 <= this.#cursor && this.#cursor <= p3 && p3 < p4) {
            this.#saveUndo();
            this.#line = this.#line.substring(0, p1) + this.#line.substring(p3, p4) +
                this.#line.substring(p2, p3) + this.#line.substring(p1, p2);
            this.#cursor = p4;
        }
    }

    #upcaseWord() {
        const end = this.#skipWordForward(this.#cursor);

        if (end !== this.#cursor) {
            this.#saveUndo();
            this.#line = this.#line.substring(0, this.#cursor) +
                this.#line.substring(this.#cursor, end).toUpperCase() +
                this.#line.substring(end);
        }
    }

    #downcaseWord() {
        const end = this.#skipWordForward(this.#cursor);

        if (end !== this.#cursor) {
            this.#saveUndo();
            this.#line = this.#line.substring(0, this.#cursor) +
                this.#line.substring(this.#cursor, end).toLowerCase() +
                this.#line.substring(end);
        }
    }

    #killLine() {
        this.#killRegion(this.#cursor, this.#line.length, 1);
    }

    #backwardKillLine() {
        this.#killRegion(0, this.#cursor, -1);
    }

    #killWord() {
        this.#killRegion(this.#cursor, this.#skipWordForward(this.#cursor), 1);
    }

    #backwardKillWord() {
        this.#killRegion(this.#skipWordBackward(this.#cursor), this.#cursor, -1);
    }

    #yank() {
        if (this.#killRing.length === 0) {
            return;
        }

        this.#killRingIndex = this.#killRing.length - 1;

        const text = this.#killRing[this.#killRingIndex];

        this.#insert(text);
        this.#yankLen = text.length;
        this.#thisFun = 'yank';
    }

    #yankPop() {
        if (this.#lastFun !== 'yank' || this.#killRing.length === 0) {
            return;
        }

        this.#saveUndo();

        // Remove the previously yanked text.
        const start = this.#cursor - this.#yankLen;

        this.#line = this.#line.substring(0, start) + this.#line.substring(this.#cursor);
        this.#cursor = start;

        // Cycle backward through the kill ring.
        this.#killRingIndex = (this.#killRingIndex - 1 + this.#killRing.length) % this.#killRing.length;

        const text = this.#killRing[this.#killRingIndex];

        this.#insert(text, true);
        this.#yankLen = text.length;
        this.#thisFun = 'yank';
    }

    #undo() {
        if (this.#undoStack.length === 0) {
            return;
        }

        this.#redoStack.push({ line: this.#line, cursor: this.#cursor });

        const state = this.#undoStack.pop();

        this.#line = state.line;
        this.#cursor = state.cursor;
    }

    #redo() {
        if (this.#redoStack.length === 0) {
            return;
        }

        this.#undoStack.push({ line: this.#line, cursor: this.#cursor });

        const state = this.#redoStack.pop();

        this.#line = state.line;
        this.#cursor = state.cursor;
    }

    #previousHistory() {
        if (this.#historyIndex > 0) {
            if (this.#historyIndex === this.#historyArr.length) {
                this.#historyArr.push(this.#line);
            }

            this.#historyIndex--;
            this.#line = this.#historyArr[this.#historyIndex];
            this.#cursor = this.#line.length;
        }
    }

    #nextHistory() {
        if (this.#historyIndex < this.#historyArr.length - 1) {
            this.#historyIndex++;
            this.#line = this.#historyArr[this.#historyIndex];
            this.#cursor = this.#line.length;
        }
    }

    // --- Private: Incremental search (Ctrl+R / Ctrl+S) ---

    #searchStart(direction) {
        if (this.#searchMode) {
            this.#searchNext(direction);

            return;
        }

        this.#searchMode = true;
        this.#searchDirection = direction;
        this.#searchQuery = '';
        this.#searchMatchIndex = -1;
        this.#searchFailing = false;
        this.#searchSavedLine = this.#line;
        this.#searchSavedCursor = this.#cursor;
        this.#searchUpdateDisplay();
    }

    #searchNext(direction) {
        this.#searchDirection = direction;

        if (this.#searchQuery.length === 0) {
            this.#searchPerform();

            return;
        }

        // Advance past the current match before searching again.
        const next = this.#searchMatchIndex + direction;

        if (next < 0 || next >= this.#historyArr.length) {
            this.#searchFailing = true;
            this.#searchUpdateDisplay();

            return;
        }

        this.#searchMatchIndex = next;
        this.#searchPerform();
    }

    #searchPerform() {
        const query = this.#searchQuery;
        const arr = this.#historyArr;
        const dir = this.#searchDirection;

        if (arr.length === 0) {
            this.#searchFailing = true;
            this.#searchUpdateDisplay();

            return;
        }

        // Starting index for the scan.
        let start = this.#searchMatchIndex;

        if (start < 0 || start >= arr.length) {
            start = dir === -1 ? arr.length - 1 : 0;
        }

        const len = arr.length;

        for (let i = 0; i < len; i++) {
            const idx = dir === -1
                ? (start - i + len) % len
                : (start + i) % len;

            if (query.length === 0 || arr[idx].includes(query)) {
                this.#searchMatchIndex = idx;
                this.#searchFailing = false;
                this.#line = arr[idx];
                this.#cursor = query.length > 0 ? arr[idx].indexOf(query) : arr[idx].length;
                this.#searchUpdateDisplay();

                return;
            }
        }

        this.#searchFailing = true;
        this.#searchUpdateDisplay();
    }

    #searchUpdateDisplay() {
        const dirLabel = this.#searchDirection === -1 ? 'reverse-i-search' : 'i-search';
        const prefix = this.#searchFailing ? `(failing ${dirLabel})` : `(${dirLabel})`;
        const searchPrompt = `${prefix}\`${this.#searchQuery}': `;

        this.clearLine();
        this.#puts(searchPrompt);
        this.#termCursorX = ucsLength(searchPrompt) % this.#termWidth;
        this.#lastLine = '';
        this.#lastCursorPos = 0;
        this.#update();
    }

    #searchAccept() {
        this.#searchMode = false;
        this.clearLine();
        this.#printPrompt();
        this.#update();
    }

    #searchAbort() {
        this.#searchMode = false;
        this.#line = this.#searchSavedLine;
        this.#cursor = this.#searchSavedCursor;
        this.clearLine();
        this.#printPrompt();
        this.#update();
    }

    #searchHandleKey(keys) {
        switch (keys) {
            case '\x12': // Ctrl+R
                this.#searchNext(-1);

                return;
            case '\x13': // Ctrl+S
                this.#searchNext(1);

                return;
            case '\x07': // Ctrl+G
                this.#searchAbort();

                return;
            case '\x7f': // Backspace
            case '\x08': // Ctrl+H
                if (this.#searchQuery.length === 0) {
                    this.#searchAbort();
                } else {
                    this.#searchQuery = this.#searchQuery.slice(0, -1);
                    // Reset match index to search from the end again.
                    this.#searchMatchIndex = this.#searchDirection === -1
                        ? this.#historyArr.length - 1
                        : 0;
                    this.#searchPerform();
                }

                return;
            case '\x0a': // Line Feed (Enter)
            case '\x0d': // Carriage Return
                this.#searchAccept();
                this.#handleKey(keys);

                return;
            default:
                break;
        }

        // Printable character: append to query and re-search.
        if (ucsLength(keys) === 1 && keys >= ' ') {
            this.#searchQuery += keys;

            // When adding a char, search from the current match position.
            if (this.#searchMatchIndex < 0) {
                this.#searchMatchIndex = this.#searchDirection === -1
                    ? this.#historyArr.length - 1
                    : 0;
            }

            this.#searchPerform();

            return;
        }

        // Any other key: accept and re-dispatch.
        this.#searchAccept();
        this.#handleKey(keys);
    }

    #completion() {
        this.#doCompletion();
        this.#thisFun = 'completion';
    }

    #clearScreen() {
        this.#puts('\x1b[H\x1b[J');
        this.#printPrompt();
        this.#update();

        return ABORT;
    }

    #acceptLine() {
        this.#puts('\n');

        if (this.#multilineEnabled) {
            // In multiline mode, Enter inserts a newline.
            this.#multilineBuffer += (this.#multilineBuffer ? '\n' : '') + this.#line;
            this.#line = '';
            this.#cursor = 0;
            this.#lastLine = '';
            this.#lastCursorPos = 0;
            this.#puts('... ');
            this.#termCursorX = 4;

            return undefined;
        }

        this.addHistoryEntry(this.#line);
        this.#enqueueLine(this.#line);

        return ACCEPT;
    }

    #controlC() {
        if (this.#onInterrupt) {
            this.#thisFun = 'controlC';

            if (this.#onInterrupt(this.#lastFun === 'controlC')) {
                return ABORT;
            }
        }

        this.#puts('\n');
        this.#line = '';
        this.#cursor = 0;
        this.#lastLine = '';
        this.#lastCursorPos = 0;
        this.#printPrompt();
    }

    #controlD() {
        if (this.#multilineEnabled) {
            // In multiline mode, Ctrl+D submits.
            const full = this.#multilineBuffer +
                (this.#multilineBuffer ? '\n' : '') + this.#line;

            this.#puts('\n');
            this.#multilineBuffer = '';

            if (full) {
                this.addHistoryEntry(full);
            }

            this.#enqueueLine(full || null);

            return ACCEPT;
        }

        if (this.#line.length === 0) {
            this.#puts('\n');
            this.#enqueueLine(null);

            return EOF;
        }

        this.#deleteCharDir(1);

        return undefined;
    }

    // --- Private: Key map ---
    // Maps key sequences to bound methods. Built once in the constructor area
    // but defined as a getter for access to private methods.

    get #keyMap() {
        // Cache on first access.
        if (this._km) {
            return this._km;
        }

        this._km = new Map([
            // Ctrl keys
            [ '\x01', () => this.#beginningOfLine() ],        // Ctrl+A
            [ '\x02', () => this.#backwardChar() ],            // Ctrl+B
            [ '\x03', () => this.#controlC() ],                // Ctrl+C
            [ '\x04', () => this.#controlD() ],                // Ctrl+D
            [ '\x05', () => this.#endOfLine() ],               // Ctrl+E
            [ '\x06', () => this.#forwardChar() ],             // Ctrl+F
            [ '\x08', () => this.#backwardDeleteChar() ],      // Ctrl+H / Backspace
            [ '\x09', () => this.#completion() ],              // Tab
            [ '\x0a', () => this.#acceptLine() ],              // Line Feed
            [ '\x0b', () => this.#killLine() ],                // Ctrl+K
            [ '\x0c', () => this.#clearScreen() ],             // Ctrl+L
            [ '\x0d', () => this.#acceptLine() ],              // Carriage Return
            [ '\x0e', () => this.#nextHistory() ],             // Ctrl+N
            [ '\x10', () => this.#previousHistory() ],         // Ctrl+P
            [ '\x12', () => this.#searchStart(-1) ],           // Ctrl+R
            [ '\x13', () => this.#searchStart(1) ],            // Ctrl+S
            [ '\x14', () => this.#transposeChars() ],          // Ctrl+T
            [ '\x15', () => this.#backwardKillLine() ],        // Ctrl+U
            [ '\x17', () => this.#backwardKillWord() ],        // Ctrl+W
            [ '\x19', () => this.#yank() ],                    // Ctrl+Y
            [ '\x1e', () => this.#redo() ],                    // Ctrl+6
            [ '\x1f', () => this.#undo() ],                    // Ctrl+-

            // Arrow keys (ANSI)
            [ '\x1b[A', () => this.#previousHistory() ],      // Up
            [ '\x1b[B', () => this.#nextHistory() ],           // Down
            [ '\x1b[C', () => this.#forwardChar() ],           // Right
            [ '\x1b[D', () => this.#backwardChar() ],          // Left

            // Arrow keys (SS3 / application mode)
            [ '\x1bOA', () => this.#previousHistory() ],      // Up
            [ '\x1bOB', () => this.#nextHistory() ],           // Down
            [ '\x1bOC', () => this.#forwardChar() ],           // Right
            [ '\x1bOD', () => this.#backwardChar() ],          // Left

            // Home/End
            [ '\x1b[H', () => this.#beginningOfLine() ],      // Home (xterm)
            [ '\x1b[F', () => this.#endOfLine() ],            // End (xterm)
            [ '\x1b[1~', () => this.#beginningOfLine() ],     // Home (vt)
            [ '\x1b[4~', () => this.#endOfLine() ],           // End (vt)
            [ '\x1bOH', () => this.#beginningOfLine() ],      // Home (SS3)
            [ '\x1bOF', () => this.#endOfLine() ],            // End (SS3)

            // Delete
            [ '\x1b[3~', () => this.#deleteChar() ],          // Delete
            [ '\x7f', () => this.#backwardDeleteChar() ],      // Backspace

            // Ctrl+Arrow (word movement)
            [ '\x1b[1;5C', () => this.#forwardWord() ],       // Ctrl+Right
            [ '\x1b[1;5D', () => this.#backwardWord() ],      // Ctrl+Left

            // Meta (Alt) sequences
            [ '\x1bf', () => this.#forwardWord() ],            // Meta+F
            [ '\x1bb', () => this.#backwardWord() ],           // Meta+B
            [ '\x1bd', () => this.#killWord() ],               // Meta+D
            [ '\x1bk', () => this.#backwardKillLine() ],       // Meta+K
            [ '\x1bl', () => this.#downcaseWord() ],           // Meta+L
            [ '\x1bu', () => this.#upcaseWord() ],             // Meta+U
            [ '\x1bt', () => this.#transposeWords() ],         // Meta+T
            [ '\x1by', () => this.#yankPop() ],                // Meta+Y
            [ '\x1b\x7f', () => this.#backwardKillWord() ],   // Meta+Backspace
        ]);

        return this._km;
    }

    // --- Private: Key dispatch ---

    #handleByte(byte) {
        if (this.#utf8State !== 0 && byte >= 0x80 && byte < 0xc0) {
            this.#utf8Val = (this.#utf8Val << 6) | (byte & 0x3f);
            this.#utf8State--;

            if (this.#utf8State === 0) {
                this.#handleChar(this.#utf8Val);
            }
        } else if (byte >= 0xc0 && byte < 0xf8) {
            this.#utf8State = 1 + (byte >= 0xe0) + (byte >= 0xf0);
            this.#utf8Val = byte & ((1 << (6 - this.#utf8State)) - 1);
        } else {
            this.#utf8State = 0;
            this.#handleChar(byte);
        }
    }

    #handleChar(codepoint) {
        const ch = String.fromCodePoint(codepoint);

        switch (this.#escState) {
            case 0:
                if (ch === '\x1b') {
                    this.#escKeys = ch;
                    this.#escState = 1;
                } else {
                    this.#handleKey(ch);
                }

                break;
            case 1:
                this.#escKeys += ch;

                if (ch === '[') {
                    this.#escState = 2;
                } else if (ch === 'O') {
                    this.#escState = 3;
                } else {
                    this.#handleKey(this.#escKeys);
                    this.#escState = 0;
                }

                break;
            case 2: // CSI
                this.#escKeys += ch;

                if (!(ch === ';' || (ch >= '0' && ch <= '9'))) {
                    this.#handleKey(this.#escKeys);
                    this.#escState = 0;
                }

                break;
            case 3: // ESC O
                this.#escKeys += ch;
                this.#handleKey(this.#escKeys);
                this.#escState = 0;

                break;
        }
    }

    #handleKey(keys) {
        if (this.#searchMode) {
            this.#searchHandleKey(keys);

            return;
        }

        const handler = this.#keyMap.get(keys);

        if (handler) {
            this.#thisFun = null;

            const result = handler();

            this.#lastFun = this.#thisFun;

            if (result === ACCEPT || result === ABORT || result === EOF) {
                return;
            }
        } else if (ucsLength(keys) === 1 && keys >= ' ') {
            this.#insert(keys);
            this.#lastFun = 'insert';
        }

        this.#clampCursor();

        if (this.#prompted) {
            this.#update();
        }
    }

    // --- Private: Line delivery ---

    #enqueueLine(line) {
        this.#line = '';
        this.#cursor = 0;
        this.#lastLine = '';
        this.#lastCursorPos = 0;
        this.#prompted = false;

        if (this.#pending) {
            const resolve = this.#pending;

            this.#pending = null;
            resolve(line);
        } else {
            this.#lineQueue.push(line);
        }
    }

    // --- Private: Read loop ---

    async #startReadLoop() {
        if (this.#terminal) {
            await this.#ttyReadLoop();
        } else {
            await this.#lineReadLoop();
        }
    }

    async #ttyReadLoop() {
        try {
            this.#input.setRawMode(true);
        } catch {
            // Ignore.
        }

        try {
            while (!this.#closed) {
                const { value, done } = await this.#reader.read();

                if (done) {
                    this.#enqueueLine(null);

                    break;
                }

                for (let i = 0; i < value.byteLength; i++) {
                    this.#handleByte(value[i]);
                }
            }
        } catch {
            // Stream closed or errored.
        }
    }

    async #lineReadLoop() {
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (!this.#closed) {
                const { value, done } = await this.#reader.read();

                if (done) {
                    if (buffer.length > 0) {
                        this.#enqueueLine(buffer);
                        buffer = '';
                    }

                    this.#enqueueLine(null);

                    break;
                }

                buffer += decoder.decode(value, { stream: true });

                let nlIndex;

                while ((nlIndex = buffer.indexOf('\n')) !== -1) {
                    let line = buffer.substring(0, nlIndex);

                    if (line.endsWith('\r')) {
                        line = line.slice(0, -1);
                    }

                    buffer = buffer.substring(nlIndex + 1);
                    this.#enqueueLine(line);
                }
            }
        } catch {
            // Stream closed or errored.
        }
    }
}

function createInterface(options) {
    return new ReadlineInterface(options);
}

export { createInterface, ReadlineInterface };

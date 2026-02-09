/* global tjs */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const LF = '\n'.charCodeAt();
const CR = '\r'.charCodeAt();

async function readStdinLine() {
    const reader = tjs.stdin.getReader();
    const buf = [];

    try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { value, done } = await reader.read();

            if (done || !value || value.length === 0) {
                break;
            }

            let lineEnd = false;

            for (let i = 0; i < value.length; i++) {
                const c = value[i];

                if (c === CR) {
                    if (i + 1 < value.length && value[i + 1] === LF) {
                        i++;
                    }

                    lineEnd = true;
                    break;
                }

                if (c === LF) {
                    lineEnd = true;
                    break;
                }

                buf.push(c);
            }

            if (lineEnd) {
                break;
            }
        }
    } finally {
        reader.releaseLock();
    }

    return decoder.decode(new Uint8Array(buf));
}

export async function alert(msg) {
    if (!tjs.stdin.isTerminal) {
        return;
    }

    const writer = tjs.stdout.getWriter();

    try {
        await writer.write(encoder.encode(msg + ' [Enter] '));
    } finally {
        writer.releaseLock();
    }

    await readStdinLine();
}

export async function confirm(msg = 'Confirm') {
    if (!tjs.stdin.isTerminal) {
        return false;
    }

    const writer = tjs.stdout.getWriter();

    try {
        await writer.write(encoder.encode(msg + ' [y/N] '));
    } finally {
        writer.releaseLock();
    }

    const answer = await readStdinLine();

    return answer.toLowerCase()[0] === 'y';
}

export async function prompt(msg = 'Prompt', def = null) {
    if (!tjs.stdin.isTerminal) {
        return null;
    }

    const writer = tjs.stdout.getWriter();

    try {
        await writer.write(encoder.encode(msg + ' '));
    } finally {
        writer.releaseLock();
    }

    return await readStdinLine() || def;
}

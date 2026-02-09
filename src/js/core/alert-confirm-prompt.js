/* global tjs */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const LF = '\n'.charCodeAt();
const CR = '\r'.charCodeAt();

async function readStdinLine() {
    const reader = tjs.stdin.getReader({ mode: 'byob' });
    const buf = [];

    try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { value, done } = await reader.read(new Uint8Array(1));

            if (done || !value || value.length === 0) {
                break;
            }

            const c = value[0];

            if (c === CR) {
                const { value: value2, done: done2 } = await reader.read(new Uint8Array(1));

                if (!done2 && value2 && value2.length > 0 && value2[0] === LF) {
                    break;
                }

                buf.push(CR);

                if (done2 || !value2 || value2.length === 0) {
                    break;
                }
            }

            if (c === LF) {
                break;
            }

            buf.push(c);
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

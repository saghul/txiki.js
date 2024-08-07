/* global tjs */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const LF = '\n'.charCodeAt();
const CR = '\r'.charCodeAt();

async function readStdinLine() {
    const c = new Uint8Array(1);
    const buf = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const n = await tjs.stdin.read(c);

        if (n === 0) {
            break;
        }

        if (c[0] === CR) {
            const n = await tjs.stdin.read(c);

            if (c[0] === LF) {
                break;
            }

            buf.push(CR);

            if (n === 0) {
                break;
            }
        }

        if (c[0] === LF) {
            break;
        }

        buf.push(c[0]);
    }

    return decoder.decode(new Uint8Array(buf));
}

export async function alert(msg) {
    if (!tjs.stdin.isTerminal) {
        return;
    }

    await tjs.stdout.write(encoder.encode(msg + ' [Enter] '));
    await readStdinLine();
}

export async function confirm(msg = 'Confirm') {
    if (!tjs.stdin.isTerminal) {
        return false;
    }

    await tjs.stdout.write(encoder.encode(msg + ' [y/N] '));

    const answer = await readStdinLine();

    return answer.toLowerCase()[0] === 'y';
}

export async function prompt(msg = 'Prompt', def = null) {
    if (!tjs.stdin.isTerminal) {
        return null;
    }

    await tjs.stdout.write(encoder.encode(msg + ' '));

    return await readStdinLine() || def;
}

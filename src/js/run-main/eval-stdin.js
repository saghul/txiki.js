/* global tjs */

export async function evalStdin() {
    const gEval = globalThis.eval;
    const decoder = new TextDecoder();
    const buf = [];
    const reader = tjs.stdin.getReader();

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        buf.push(...value);
    }

    gEval(decoder.decode(new Uint8Array(buf)));
}

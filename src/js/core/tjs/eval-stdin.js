/* global tjs */

export async function evalStdin() {
    const gEval = globalThis.eval;
    const decoder = new TextDecoder();
    const readBuf = new Uint8Array(4096);
    const buf = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const n = await tjs.stdin.read(readBuf);

        if (n === null) {
            break;
        }

        buf.push(...readBuf.subarray(0, n));
    }

    gEval(decoder.decode(new Uint8Array(buf)));
}

const gEval = globalThis.eval;
const decoder = new TextDecoder();

(async () => {
    const readBuf = new Uint8Array(4096);
    const buf = [];

    while (true) {
        const n = await tjs.stdin.read(readBuf);

        if (n === 0) {
            break;
        }

        buf.push(...readBuf.subarray(0, n));
    }

    gEval(decoder.decode(new Uint8Array(buf)));
})();

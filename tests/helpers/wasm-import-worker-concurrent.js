// Several Workers creating Modules and Instances with JS imports at once.
// WAMR keeps imported natives in a process-global list that it does not lock,
// so linking imports on several threads at once must be serialized by txiki.

const WORKERS = Number(tjs.env.WORKERS ?? 8);
const ROUNDS = Number(tjs.env.ROUNDS ?? 2000);
// Each Worker also stops after this long, so slow (Debug) builds stay well
// within the test timeout and don't starve the tests running alongside.
const DURATION_MS = Number(tjs.env.DURATION_MS ?? 5000);

// (module (import "env" "cb" (func (param i32) (result i32)))
//         (func (export "run") (param i32) (result i32) local.get 0 call 0))
const bytes = [
    0, 97, 115, 109, 1, 0, 0, 0, 1, 6, 1, 96, 1, 127, 1, 127, 2, 10, 1, 3, 101, 110, 118, 2, 99, 98, 0, 0,
    3, 2, 1, 0, 7, 7, 1, 3, 114, 117, 110, 0, 1, 10, 8, 1, 6, 0, 32, 0, 16, 0, 11,
];

const workerSrc = `
const bytes = new Uint8Array([${bytes.join(',')}]);
let bad = 0;
const end = Date.now() + ${DURATION_MS};
for (let i = 0; i < ${ROUNDS} && Date.now() < end; i++) {
    if (!WebAssembly.validate(bytes)) bad++;
    const mod = new WebAssembly.Module(bytes);
    const a = new WebAssembly.Instance(mod, { env: { cb: x => x + 1 } });
    const b = new WebAssembly.Instance(mod, { env: { cb: x => x + 2 } });
    if (a.exports.run(10) !== 11 || b.exports.run(10) !== 12) bad++;
}
self.postMessage({ bad });
`;
const url = URL.createObjectURL(new Blob([ workerSrc ], { type: 'text/javascript' }));
const workers = [];
const jobs = [];

for (let i = 0; i < WORKERS; i++) {
    const w = new Worker(url);

    workers.push(w);
    jobs.push(new Promise((resolve, reject) => {
        w.onmessage = e => resolve(e.data.bad);
        w.onerror = e => reject(new Error(`worker ${i}: ${e.message}`));
    }));
}

try {
    const bad = (await Promise.all(jobs)).reduce((a, b) => a + b, 0);

    if (bad > 0) {
        console.log(`bad results: ${bad}`);
        tjs.exit(1);
    }
} catch (e) {
    console.log(String(e));
    tjs.exit(1);
} finally {
    for (const w of workers) {
        w.terminate();
    }
}

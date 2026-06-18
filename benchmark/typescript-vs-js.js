import { transpile } from 'tjs:typescript';

function makeSource(body) {
    return body.trim().split('\n').map(s => s.trim()).join('\n');
}

const cases = [
    {
        name: 'tiny',
        ts: makeSource(`
            const x: number = 1;
            const y: string = "hi";
            const z = x + y;
        `),
        js: makeSource(`
            const x = 1;
            const y = "hi";
            const z = x + y;
        `),
        lines: 3,
    },
    {
        name: 'small',
        ts: Array.from({ length: 10 }, (_, i) =>
            `function fn${i}(x: number): number { return x + ${i}; }`).join('\n'),
        js: Array.from({ length: 10 }, (_, i) =>
            `function fn${i}(x) { return x + ${i}; }`).join('\n'),
        lines: 10,
    },
    {
        name: 'medium',
        ts: Array.from({ length: 50 }, (_, i) =>
            `function fn${i}(x: number): number { return x * ${i} + 1; }`).join('\n'),
        js: Array.from({ length: 50 }, (_, i) =>
            `function fn${i}(x) { return x * ${i} + 1; }`).join('\n'),
        lines: 50,
    },
    {
        name: 'large',
        ts: Array.from({ length: 200 }, (_, i) =>
            `function fn${i}(x: number): number { return x * ${i} + ${i}; }`).join('\n') +
            '\nconst result: number = 0;',
        js: Array.from({ length: 200 }, (_, i) =>
            `function fn${i}(x) { return x * ${i} + ${i}; }`).join('\n') +
            '\nconst result = 0;',
        lines: 202,
    },
    {
        name: 'realworld',
        ts: makeSource(`
            interface Config { port: number; host: string; }
            async function load(path: string): Promise<Config> {
                const data = await readFile(path);
                const cfg: Config = JSON.parse(new TextDecoder().decode(data));
                if (cfg.port < 0 || cfg.port > 65535) throw new Error('bad');
                return cfg;
            }
            export async function start(path: string): Promise<void> {
                const cfg: Config = await load(path);
                tjs.serve({ port: cfg.port, fetch(r: Request): Response { return new Response('ok'); } });
            }
        `),
        js: makeSource(`
            async function load(path) {
                const data = await readFile(path);
                const cfg = JSON.parse(new TextDecoder().decode(data));
                if (cfg.port < 0 || cfg.port > 65535) throw new Error('bad');
                return cfg;
            }
            async function start(path) {
                const cfg = await load(path);
                tjs.serve({ port: cfg.port, fetch(req) { return new Response('ok'); } });
            }
        `),
        lines: 12,
    },
];

console.log('=== TypeScript vs JavaScript benchmark ===\n');
console.log('                          size  lines  transpile(ms)  compile(ms)  ratio  overhead(ms)');
console.log('  ' + '-'.repeat(80));

// Warmup transpiler
transpile('/tmp/warm.ts', 'let x = 1');

for (const c of cases) {
    const N = c.lines <= 10 ? 2000 : c.lines <= 50 ? 1000 : 100;

    // TS transpilation
    let t1 = Date.now();
    for (let i = 0; i < N; i++) {
        transpile('/tmp/t.ts', c.ts);
    }
    let t2 = Date.now();
    const tsMs = (t2 - t1) / N;

    // JS compile + eval
    let t3 = Date.now();
    for (let i = 0; i < N; i++) {
        eval(c.js);
    }
    let t4 = Date.now();
    const jsMs = (t4 - t3) / N;

    const ratio = jsMs > 0 ? (tsMs / jsMs).toFixed(1) : ' N/A';
    const kb = (c.ts.length / 1024).toFixed(1);
    const name = c.name.padEnd(16);
    const size = kb.padStart(5);
    const lines = String(c.lines).padStart(5);
    const tsStr = tsMs.toFixed(3).padStart(12);
    const jsStr = jsMs.toFixed(3).padStart(12);
    const ratioStr = String(ratio).padStart(6) + 'x';
    const overhead = (tsMs - jsMs).toFixed(3).padStart(12);

    console.log(`  ${name}${size}KB${lines}  ${tsStr}  ${jsStr}  ${ratioStr} ${overhead}`);
}

console.log('\nNotes:');
console.log('- transpile: oxc running in WAMR (WASM interpreter, fast-interp mode)');
console.log('- compile:   QuickJS compiling + executing the equivalent JavaScript');
console.log('- ratio > 1 means transpilation is slower (expected: WASM is interpreted)');
console.log('- Test ran with tjs v' + tjs.version);

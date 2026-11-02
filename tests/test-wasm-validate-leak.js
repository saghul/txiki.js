import assert from 'tjs:assert';

// RSS can't tell a free from a leak under ASan: its free quarantine (256 MB by
// default) keeps freed chunks resident. Windows has no portable RSS source here.
if (navigator.userAgentData.platform === 'Windows' || tjs.env.ASAN_OPTIONS || tjs.env.TJS_GC_STRESS) {
    tjs.exit(0);
}

const MiB = 1024 * 1024;

async function rssKiB() {
    if (navigator.userAgentData.platform === 'Linux') {
        // Busybox ps (alpine) has no "-o rss= -p".
        const status = new TextDecoder().decode(await tjs.readFile('/proc/self/status'));

        return parseInt(status.match(/^VmRSS:\s+(\d+)\s+kB/m)[1], 10);
    }

    const proc = tjs.spawn([ 'ps', '-o', 'rss=', '-p', String(tjs.pid) ], { stdout: 'pipe' });
    const [ out ] = await Promise.all([ proc.stdout.text(), proc.wait() ]);

    return parseInt(out.trim(), 10);
}

function leb128(n) {
    const out = [];

    do {
        let b = n & 0x7f;

        n >>>= 7;

        if (n) {
            b |= 0x80;
        }

        out.push(b);
    } while (n);

    return out;
}

// An empty module with a single 4 MiB custom section.
const payloadSize = 4 * MiB;
const name = [ 1, 0x78 ];
const header = [ 0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x00, ...leb128(name.length + payloadSize), ...name ];
const buf = new Uint8Array(header.length + payloadSize);

buf.set(header);

for (let i = header.length; i < buf.length; i++) {
    buf[i] = i & 0xff;
}

const orig = buf.slice();

for (let i = 0; i < 4; i++) {
    assert.ok(WebAssembly.validate(buf), 'module is valid');
}

const before = await rssKiB();

for (let i = 0; i < 64; i++) {
    assert.ok(WebAssembly.validate(buf), 'module is valid');
}

const after = await rssKiB();
const growthMiB = (after - before) / 1024;

assert.ok(growthMiB < 64, `RSS grew ${growthMiB.toFixed(1)} MiB over 64 validations`);
assert.ok(buf.every((v, i) => v === orig[i]), 'validate() does not modify the input bytes');

// Hashing benchmark: native (mbedtls) vs JS (npm packages).
//
// Install the JS packages, bundle with esbuild, and run:
//
//   npm install --no-save js-md5 js-sha1 js-sha256 js-sha3 js-sha512
//   npx esbuild benchmark/hashing.js --bundle --outfile=/tmp/bench-hashing.js \
//     --external:'tjs:*' --external:buffer --external:crypto \
//     --target=esnext --platform=neutral --format=esm --main-fields=main,module
//   ./build/tjs run /tmp/bench-hashing.js
//

import md5 from 'js-md5';
import sha1 from 'js-sha1';
import { sha256 } from 'js-sha256';
import { sha512 } from 'js-sha512';
import { sha3_256 } from 'js-sha3';
import { createHash } from 'tjs:hashing';

const ITERATIONS = 10000;
const shortInput = 'The quick brown fox jumps over the lazy dog.';
const longInput = shortInput.repeat(100);

const algorithms = [
    { name: 'md5', jsFn: (d) => md5(d), type: 'md5' },
    { name: 'sha1', jsFn: (d) => sha1(d), type: 'sha1' },
    { name: 'sha256', jsFn: (d) => sha256(d), type: 'sha256' },
    { name: 'sha512', jsFn: (d) => sha512(d), type: 'sha512' },
    { name: 'sha3_256', jsFn: (d) => sha3_256(d), type: 'sha3_256' },
];

const inputs = [
    { name: 'short (44 B)', data: shortInput },
    { name: 'long (4.4 KB)', data: longInput },
];

const pad = (s, n) => s.padEnd(n);
const fmtMs = (ms) => ms.toFixed(1).padStart(8) + ' ms';

console.log(`Hashing benchmark — ${ITERATIONS} iterations\n`);
console.log(`${pad('Algorithm', 10)} ${pad('Input', 14)} ${pad('JS', 12)} ${pad('Native', 12)} ${'Speedup'}`);
console.log('-'.repeat(62));

for (const input of inputs) {
    for (const algo of algorithms) {
        const t0 = performance.now();

        for (let i = 0; i < ITERATIONS; i++) {
            algo.jsFn(input.data);
        }

        const jsTime = performance.now() - t0;

        const t1 = performance.now();

        for (let i = 0; i < ITERATIONS; i++) {
            createHash(algo.type).update(input.data).digest();
        }

        const nativeTime = performance.now() - t1;
        const speedup = (jsTime / nativeTime).toFixed(1) + 'x';

        console.log(`${pad(algo.name, 10)} ${pad(input.name, 14)} ${fmtMs(jsTime)} ${fmtMs(nativeTime)} ${speedup.padStart(7)}`);
    }
}

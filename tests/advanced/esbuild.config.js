const esbuild = require('esbuild');
const path = require('path');

const modules = [
    { entry: 'generator/hono.js', out: 'generated/hono.js' },
];

for (const mod of modules) {
    console.log(`generating ${mod.out}...`);
    esbuild.buildSync({
        entryPoints: [path.join(__dirname, mod.entry)],
        bundle: true,
        outfile: path.join(__dirname, mod.out),
        format: 'esm',
        platform: 'neutral',
        target: 'es2023',
        minify: false,
    });
}

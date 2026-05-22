const esbuild = require('esbuild');
const path = require('path');

const modules = [
    { entry: 'generator/cheerio.js', out: 'generated/cheerio.js', platform: 'browser' },
    { entry: 'generator/hono.js', out: 'generated/hono.js', platform: 'neutral' },
];

for (const mod of modules) {
    console.log(`generating ${mod.out}...`);
    esbuild.buildSync({
        entryPoints: [path.join(__dirname, mod.entry)],
        bundle: true,
        outfile: path.join(__dirname, mod.out),
        format: 'esm',
        platform: mod.platform,
        target: 'esnext',
        minify: false,
    });
}

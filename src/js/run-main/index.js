/* global tjs */

import getopts from 'tjs:getopts';
import path from 'tjs:path';
import { WASI } from 'tjs:wasi';

import { bundle } from './bundle.js';
import { evalStdin } from './eval-stdin.js';
import { mkdirSync } from './mkdirSync.js';
import { runTests } from './run-tests.js';
import { TpkTrailer, runTpk, appInit, appPack, appCompile } from './tpk.js';

const core = globalThis[Symbol.for('tjs.internal.core')];

/**
 * Before we do anything else, create our "home" directory,
 * so other parts of the code which need it can find it.
 * Also set the cookie jar path, since it's needed when
 * initializing lws.
 */
const TJS_HOME = tjs.env.TJS_HOME ?? path.join(tjs.homeDir, '.tjs');

try {
    mkdirSync(TJS_HOME, { recursive: true });
} catch (_) {
    // Ignore.
}

core.setCookieJarPath(path.join(TJS_HOME, 'cookies.txt'));

/**
 * CA bundle override.
 * Precedence: --tls-ca > TJS_CA_BUNDLE > SSL_CERT_FILE > embedded bundle.
 * The value is applied later in option parsing, but we resolve the env
 * var fallback here so it's available regardless of subcommand.
 */
const TJS_CA_BUNDLE = tjs.env.TJS_CA_BUNDLE ?? tjs.env.SSL_CERT_FILE ?? null;

/**
 * Trailer for standalone binaries. When some code gets bundled with the tjs
 * executable we add a 12 byte trailer. The first 8 bytes are the magic
 * string that helps us understand this is a standalone binary, and the
 * remaining 4 are the offset (from the beginning of the binary) where the
 * bundled data is located.
 *
 * The offset is stored as a 32bit little-endian number.
 */
const Trailer = {
    Magic: 'tx1k1.js',
    MagicSize: 8,
    DataSize: 4,
    Size: 12
};

const exeName = path.basename(tjs.args[0]);
const help = `Usage: ${exeName} [options] [subcommand]

Options:
  -v, --version
        Print version information

  -h, --help
        Print help

  --memory-limit LIMIT
        Set the memory limit for the JavaScript runtime

  --stack-size STACKSIZE
        Set the maximum JavaScript stack size

  --wasm-stack-size SIZE
        Set the WebAssembly stack size (default: 524288)

  --tls-ca FILE
        Path to a custom CA bundle PEM file
        (env: TJS_CA_BUNDLE, SSL_CERT_FILE)

Subcommands:
  run
        Run a JavaScript program

  eval
        Evaluate a JavaScript expression

  serve
        Serve an HTTP application

  test
        Run tests in the given directory

  bundle [options] infile [outfile]
        Bundle a JavaScript/TypeScript file using esbuild

  compile infile [outfile]
        Compile the given file into a standalone executable

  app <subcommand>
        Manage tpk app packages`;

const helpBundle = `Usage: ${exeName} bundle [options] infile [outfile]

Bundle a JavaScript/TypeScript file using esbuild. If outfile is not
specified it defaults to <infile-stem>.bundle.js.

Options:
  -m, --minify    Minify the output

Any other --option flags are passed through to esbuild.`;

const helpEval = `Usage: ${exeName} eval EXPRESSION`;

const helpRun = `Usage: ${exeName} run FILE`;

const helpApp = `Usage: ${exeName} app <subcommand>

Subcommands:
  init
        Create a template app in the current directory

  pack [outfile]
        Package the app into a .tpk file

  compile [outfile]
        Compile the app into a standalone executable`;

const helpServe = `Usage: ${exeName} serve [options] FILE

The file must default export an object with a fetch method:

  export default {
      fetch(request, { server }) {
          if (request.headers.get('upgrade') === 'websocket') {
              server.upgrade(request);
              return;
          }
          return new Response('hello');
      },
      websocket: {
          open(ws) {},
          message(ws, msg) {},
          close(ws) {},
      },
  };

Options:
  -p, --port PORT
        Port to listen on (default: 8000)
  --tls-cert FILE
        Path to TLS certificate PEM file
  --tls-key FILE
        Path to TLS private key PEM file`;

const decoder = new TextDecoder();

// First, let's check if this is a standalone binary.
const isBundled = await (async () => {
    const exef = await tjs.open(tjs.exePath, 'rb');
    const exeSize = (await exef.stat()).size;

    // Check for TPK bundle first (4-byte magic at EOF).
    const tpkMagicBuf = new Uint8Array(TpkTrailer.MagicSize);

    await exef.read(tpkMagicBuf, exeSize - TpkTrailer.MagicSize);

    if (decoder.decode(tpkMagicBuf) === TpkTrailer.Magic) {
        await runTpk(exef, exeSize);

        return true;
    }

    // Check for bytecode bundle (12-byte trailer).
    const trailerBuf = new Uint8Array(Trailer.Size);

    await exef.read(trailerBuf, exeSize - Trailer.Size);

    const magic = new Uint8Array(trailerBuf.buffer, 0, Trailer.MagicSize);
    const maybeMagic = decoder.decode(magic);

    if (maybeMagic === Trailer.Magic) {
        const dw = new DataView(trailerBuf.buffer, Trailer.MagicSize, Trailer.DataSize);
        const offset = dw.getUint32(0, true);
        const buf = new Uint8Array(exeSize - offset - Trailer.Size);

        await exef.read(buf, offset);
        await exef.close();

        const bytecode = tjs.engine.deserialize(buf);

        await tjs.engine.evalBytecode(bytecode);

        return true;
    }

    await exef.close();
})();

if (!isBundled) {
    const options = getopts(tjs.args.slice(1), {
        alias: {
            eval: 'e',
            help: 'h',
            version: 'v'
        },
        boolean: [ 'h', 'v' ],
        string: [ 'e', 'tls-ca' ],
        stopEarly: true,
        unknown: option => {
            if (![ 'memory-limit', 'stack-size', 'wasm-stack-size' ].includes(option)) {
                throw `unrecognized option: ${option}`;
            }

            return option;
        }
    });

    if (options.help) {
        console.log(help);
    } else if (options.version) {
        console.log(`v${tjs.version}`);
    } else {
        const memoryLimit = options['memory-limit'];
        const stackSize = options['stack-size'];

        if (typeof memoryLimit !== 'undefined') {
            core.setMemoryLimit(parseNumberOption(memoryLimit, 'memory-limit'));
        }

        if (typeof stackSize !== 'undefined') {
            core.setMaxStackSize(parseNumberOption(stackSize, 'stack-size'));
        }

        const wasmStackSize = options['wasm-stack-size'];

        if (typeof wasmStackSize !== 'undefined') {
            core.setWasmStackSize(parseNumberOption(wasmStackSize, 'wasm-stack-size'));
        }

        const caBundlePath = options['tls-ca'] || TJS_CA_BUNDLE;

        if (caBundlePath) {
            core.setCABundlePath(path.resolve(caBundlePath));
        }

        const [ command, ...subargv ] = options._;

        if (!command) {
            if (tjs.stdin.isTerminal) {
                core.runRepl();
            } else {
                evalStdin();
            }
        } else if (command === 'eval') {
            const [ expr ] = subargv;

            if (!expr) {
                throw helpEval;
            }

            core.evalScript(expr);
        } else if (command === 'run') {
            const [ filename ] = subargv;

            if (!filename) {
                throw helpRun;
            }

            const ext = path.extname(filename).toLowerCase();

            if (ext === '.wasm') {
                const bytes = await tjs.readFile(filename);
                const module = new WebAssembly.Module(bytes);
                const wasi = new WASI({
                    version: 'wasi_snapshot_preview1',
                    args: subargv,
                    preopens: {
                        '.': tjs.cwd,
                        '/': '/'
                    }
                });
                const instance = new WebAssembly.Instance(module, wasi.getImportObject());

                wasi.start(instance);
            } else {
                await core.evalFile(filename);
            }
        } else if (command === 'serve') {
            const serveOpts = getopts(subargv, {
                alias: { port: 'p' },
                string: [ 'p', 'tls-cert', 'tls-key' ],
            });

            const [ filename ] = serveOpts._;

            if (!filename) {
                throw helpServe;
            }

            const port = serveOpts.port ? parseNumberOption(serveOpts.port, 'port') : 8000;
            const tlsCertPath = serveOpts['tls-cert'];
            const tlsKeyPath = serveOpts['tls-key'];

            if ((tlsCertPath && !tlsKeyPath) || (!tlsCertPath && tlsKeyPath)) {
                throw 'Both --tls-cert and --tls-key must be specified';
            }

            let tls;

            if (tlsCertPath && tlsKeyPath) {
                tls = {
                    cert: decoder.decode(await tjs.readFile(tlsCertPath)),
                    key: decoder.decode(await tjs.readFile(tlsKeyPath)),
                };
            }

            const mod = await import(path.resolve(filename));
            const handler = mod.default?.fetch;

            if (typeof handler !== 'function') {
                throw 'Module must default export an object with a fetch method';
            }

            const server = tjs.serve({ fetch: handler, port, tls, websocket: mod.default.websocket });
            const scheme = tls ? 'https' : 'http';

            console.log(`Listening on ${scheme}://localhost:${server.port}/`);
        } else if (command === 'bundle') {
            const ok = await bundle(TJS_HOME, subargv);

            if (!ok) {
                throw helpBundle;
            }
        } else if (command === 'test') {
            const [ dir ] = subargv;

            runTests(dir);
        } else if (command === 'compile') {
            const [ infile, outfile ] = subargv;

            if (!infile) {
                throw help;
            }

            const infilePath = path.parse(infile);
            const data = await tjs.readFile(infile);
            const bytecode = tjs.engine.serialize(tjs.engine.compile(data, infilePath.base));
            const exe = await tjs.readFile(tjs.exePath);
            const exeSize = exe.length;
            const newBuffer = exe.buffer.transfer(exeSize + bytecode.length + Trailer.Size);
            const newExe = new Uint8Array(newBuffer);

            newExe.set(bytecode, exeSize);
            newExe.set(new TextEncoder().encode(Trailer.Magic), exeSize + bytecode.length);

            const dw = new DataView(newBuffer, exeSize + bytecode.length + Trailer.MagicSize, Trailer.DataSize);

            dw.setUint32(0, exeSize, true);

            let newFileName = outfile ?? `${infilePath.name}`;

            if (navigator.userAgentData.platform === 'Windows' && !newFileName.endsWith('.exe')) {
                newFileName += '.exe';
            }

            await tjs.writeFile(newFileName, newExe, { mode: 0o755 });
        } else if (command === 'app') {
            const [ appCommand, ...appSubargv ] = subargv;

            if (!appCommand) {
                throw helpApp;
            }

            if (appCommand === 'init') {
                await appInit();
            } else if (appCommand === 'pack') {
                const [ outfile ] = appSubargv;

                await appPack(outfile);
            } else if (appCommand === 'compile') {
                const [ outfile ] = appSubargv;

                await appCompile(outfile);
            } else {
                throw helpApp;
            }
        } else {
            throw help;
        }
    }
}

function parseNumberOption(num, option) {
    const n = Number.parseInt(num, 10);

    if (Number.isNaN(n)) {
        throw new Error(`Invalid number ${num} for option ${option}`);
    }

    return n;
}


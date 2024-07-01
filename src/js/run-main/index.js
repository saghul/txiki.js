/* global tjs */

import getopts from 'tjs:getopts';
import path from 'tjs:path';

import { evalStdin } from './eval-stdin.js';
import { runTests } from './run-tests.js';

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

const core = globalThis[Symbol.for('tjs.internal.core')];

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

Subcommands:
  run
        Run a JavaScript program

  eval
        Evaluate a JavaScript expression

  test
        Run tests in the given directory

  compile infile [outfile]
        Compile the given file into a standalone executable`;

const helpEval = `Usage: ${exeName} eval EXPRESSION`;

const helpRun = `Usage: ${exeName} run FILE`;

// First, let's check if this is a standalone binary.
await (async () => {
    const exef = await tjs.open(tjs.exepath, 'rb');
    const exeSize = (await exef.stat()).size;
    const trailerBuf = new Uint8Array(Trailer.Size);

    await exef.read(trailerBuf, exeSize - Trailer.Size);

    const magic = new Uint8Array(trailerBuf.buffer, 0, Trailer.MagicSize);
    const maybeMagic = new TextDecoder().decode(magic);

    if (maybeMagic === Trailer.Magic) {
        const dw = new DataView(trailerBuf.buffer, Trailer.MagicSize, Trailer.DataSize);
        const offset = dw.getUint32(0, true);
        const buf = new Uint8Array(offset - Trailer.Size);

        await exef.read(buf, offset);
        await exef.close();

        const bytecode = tjs.deserialize(buf);

        await tjs.evalBytecode(bytecode);

        tjs.exit(0);
    }

    await exef.close();
})();

const options = getopts(tjs.args.slice(1), {
    alias: {
        eval: 'e',
        help: 'h',
        version: 'v'
    },
    boolean: [ 'h', 'v' ],
    string: [ 'e' ],
    stopEarly: true,
    unknown: option => {
        if (![ 'memory-limit', 'stack-size' ].includes(option)) {
            console.log(`${exeName}: unrecognized option: ${option}`);
            tjs.exit(1);
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

    const [ command, ...subargv ] = options._;

    if (!command) {
        if (core.isStdinTty()) {
            core.runRepl();
        } else {
            evalStdin();
        }
    } else if (command === 'eval') {
        const [ expr ] = subargv;

        if (!expr) {
            console.log(helpEval);
            tjs.exit(1);
        }

        core.evalScript(expr);
    } else if (command === 'run') {
        const [ filename ] = subargv;

        if (!filename) {
            console.log(helpRun);
            tjs.exit(1);
        }

        const ext = path.extname(filename).toLowerCase();

        if (ext === '.wasm') {
            const bytes = await tjs.readFile(filename);
            const module = new WebAssembly.Module(bytes);
            const wasi = new WebAssembly.WASI({ args: subargv.slice(1) });
            const importObject = { wasi_unstable: wasi.wasiImport };
            const instance = new WebAssembly.Instance(module, importObject);

            wasi.start(instance);
        } else {
            await core.evalFile(filename);
        }
    } else if (command === 'test') {
        const [ dir ] = subargv;

        runTests(dir);
    } else if (command === 'compile') {
        const [ infile, outfile ] = subargv;

        if (!infile) {
            console.log(help);
            tjs.exit(1);
        }

        const infilePath = path.parse(infile);
        const data = await tjs.readFile(infile);
        const bytecode = tjs.serialize(tjs.compile(data, infilePath.base));
        const exe = await tjs.readFile(tjs.exepath);
        const exeSize = exe.length;
        const newBuffer = exe.buffer.transfer(exeSize + bytecode.length + Trailer.Size);
        const newExe = new Uint8Array(newBuffer);

        newExe.set(bytecode, exeSize);
        newExe.set(new TextEncoder().encode(Trailer.Magic), exeSize + bytecode.length);

        const dw = new DataView(newBuffer, exeSize + bytecode.length + Trailer.MagicSize, Trailer.DataSize);

        dw.setUint32(0, exeSize, true);

        let newFileName = outfile ?? `${infilePath.name}`;

        if (tjs.platform === 'windows' && !newFileName.endsWith('.exe')) {
            newFileName += '.exe';
        }

        try {
            await tjs.stat(newFileName);
            console.log('Target file exists already');
            tjs.exit(1);
        } catch (_) {
            // Ignore.
        }

        const newFile = await tjs.open(newFileName, 'wb');

        await newFile.write(newExe);
        await newFile.chmod(0o755);
        await newFile.close();
    } else {
        console.log(help);
        tjs.exit(1);
    }
}


function parseNumberOption(num, option) {
    const n = Number.parseInt(num, 10);

    if (Number.isNaN(n)) {
        throw new Error(`Invalid number ${num} for option ${option}`);
    }

    return n;
}

/* global tjs */

import { getopts, path } from '@tjs/std';

const {
    evalFile,
    evalScript,
    evalStdin,
    isStdinTty,
    runRepl,
    setMaxStackSize,
    setMemoryLimit
} = tjs[Symbol.for('tjs.internal')];

const exeName = path.basename(tjs.args[0]);
const help = `Usage: ${exeName} [options] [file]

Options:
  -v, --version                   print version
  -h, --help                      list options
  -e, --eval EXPR                 evaluate EXPR
  --memory-limit LIMIT            set the memory limit
  --stack-size STACKSIZE          set max stack size`;

const options = getopts(tjs.args.slice(1), {
    alias: {
        eval: 'e',
        help: 'h',
        version: 'v'
    },
    boolean: [ 'h', 'v' ],
    string: [ 'e' ],
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
        setMemoryLimit(parseNumberOption(memoryLimit, 'memory-limit'));
    }

    if (typeof stackSize !== 'undefined') {
        setMaxStackSize(parseNumberOption(stackSize, 'stack-size'));
    }

    const [ filename ] = options._;

    if (options.eval) {
        evalScript(options.eval);
    } else if (filename) {
        // XXX: This looks weird. This file is being JS_Eval'd when we call `evalFile`,
        // which does another JS_Eval, and something get's messed up :-(
        globalThis.queueMicrotask(() => evalFile(filename));
    } else if (isStdinTty()) {
        runRepl();
    } else {
        evalStdin();
    }
}


function parseNumberOption(num, option) {
    const n = Number.parseInt(num, 10);

    if (Number.isNaN(n)) {
        throw new Error(`Invalid number ${num} for option ${option}`);
    }

    return n;
}

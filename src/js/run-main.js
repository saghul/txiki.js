/* global tjs */

import getopts from 'tjs:getopts';
import path from 'tjs:path';

const internals = tjs[Symbol.for('tjs.internal')];

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
        Run tests in the given directory`;

const helpEval = `Usage: ${exeName} eval EXPRESSION`;

const helpRun = `Usage: ${exeName} run FILE`;

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
        internals.core.setMemoryLimit(parseNumberOption(memoryLimit, 'memory-limit'));
    }

    if (typeof stackSize !== 'undefined') {
        internals.core.setMaxStackSize(parseNumberOption(stackSize, 'stack-size'));
    }

    const [ command, ...subargv ] = options._;

    if (!command) {
        if (internals.core.isStdinTty()) {
            internals.runRepl();
        } else {
            internals.evalStdin();
        }
    } else if (command === 'eval') {
        const [ expr ] = subargv;

        if (!expr) {
            console.log(helpEval);
            tjs.exit(1);
        }

        internals.core.evalScript(expr);
    } else if (command === 'run') {
        const [ filename ] = subargv;

        if (!filename) {
            console.log(helpRun);
            tjs.exit(1);
        }

        internals.core.evalFile(filename);
    } else if (command === 'test') {
        const [ dir ] = subargv;

        internals.runTests(dir);
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

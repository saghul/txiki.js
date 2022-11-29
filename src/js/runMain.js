/* global tjs */

import { getopts } from '@tjs/std';

const {
    evalFile,
    evalScript,
    evalStdin,
    isStdinTty,
    runRepl
} = tjs[Symbol.for('tjs.internal')];
const options = getopts(tjs.args.slice(1), {
    alias: {
        eval: 'e',
        help: 'h',
        version: 'v'
    },
    boolean: [ 'h', 'v' ],
    string: [ 'e' ]
});
const [ filename ] = options['_'];

// TODO: move all options here.

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

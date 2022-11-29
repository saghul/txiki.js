/* global tjs */

import { getopts } from '@tjs/std';

(() => {
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

    // TODO: move all options here.

    if (options.eval) {
        return evalScript(options.eval);
    }

    const [ filename ] = options['_'];

    if (filename) {
        return evalFile(filename);
    }

    if (isStdinTty()) {
        return runRepl();
    }

    return evalStdin();
})();

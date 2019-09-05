// Minimal console object.
//

class Console {

    log(...args) {
        quv.print(...args);
    }

    info(...args) {
        quv.print(...args);
    }

    warn(...args) {
        quv.print(...args);
    }

    error(...args) {
        quv.print(...args);
    }

    assert(expression, ...args) {
        if (!expression) {
            this.error(...args);
        }
    }

    trace(...args) {
        const err = new Error();
        err.name = 'Trace';
        err.message = args.map(String).join(' ');
    
        try {
            throw err;
        } catch (e) {
            // remove entry for this very function
            const tmpStack = e.stack.split('\n');
            tmpStack.splice(0, 1);
            this.error(e);
            this.error(tmpStack.join('\n'));
        }
    }
}


export { Console };

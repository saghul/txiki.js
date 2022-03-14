import { path } from '@tjs/std';


const TIMEOUT = 10 * 1000;

const colors = {
    none:    "\x1b[0m",
    black:   "\x1b[30m",
    red:     "\x1b[31m",
    green:   "\x1b[32m",
    yellow:  "\x1b[33m",
    blue:    "\x1b[34m",
    magenta: "\x1b[35m",
    cyan:    "\x1b[36m",
    white:   "\x1b[37m",
    gray:    "\x1b[30;1m",
    grey:    "\x1b[30;1m",
    bright_red:     "\x1b[31;1m",
    bright_green:   "\x1b[32;1m",
    bright_yellow:  "\x1b[33;1m",
    bright_blue:    "\x1b[34;1m",
    bright_magenta: "\x1b[35;1m",
    bright_cyan:    "\x1b[36;1m",
    bright_white:   "\x1b[37;1m",
};


class Test {
    constructor(fileName) {
        this._fileName = fileName;
    }

    run() {
        const args = [ tjs.exepath, this._fileName ];
        this._proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
        this._stdout = this._slurpStdio(this._proc.stdout);
        this._stderr = this._slurpStdio(this._proc.stderr);
        this._timer = setTimeout(() => {
            this._proc.kill(tjs.SIGKILL);
            this._timeout = true;
        }, TIMEOUT);
        this._proc_exit = this._proc.wait();
        this._proc_exit.then(() => {
            clearTimeout(this._timer);
        })
    }

    async wait() {
        const [ status_, stdout, stderr ] = await Promise.allSettled([this._proc_exit, this._stdout, this._stderr]);
        const status = status_.value;

        return {
            name: path.basename(this._fileName),
            failed: status.exit_status !== 0 || status.term_signal !== null,
            status,
            stdout: stdout.value,
            stderr: stderr.value,
            timeout: Boolean(this._timeout)
        };
    }

    async _slurpStdio(s) {
        const decoder = new TextDecoder();
        const chunks = [];
        const buf = new Uint8Array(4096);
        while (true) {
            const nread = await s.read(buf);
            if (!nread) {
                break;
            }
            chunks.push(buf.slice(0, nread));
        }

        return chunks.map(chunk => decoder.decode(chunk)).join('');
    }
}

function printResult(result) {
    const status = result.timeout ? colors.yellow+'TIMEOUT' : (result.failed ? colors.red+'FAIL' : colors.green+'OK');
    console.log(`${result.name.padEnd(40, ' ')} ${status+colors.none}`);
    if (result.failed) {
        console.log('status:');
        console.log(result.status);
        if (result.stdout) {
            console.log('stdout:');
            console.log(result.stdout);
        }
        if (result.stderr) {
            console.log('stderr:');
            console.log(result.stderr);
        }
    }
}

(async function() {
    const dir = await tjs.realpath(tjs.args[2] || import.meta.dirname);
    const dirIter = await tjs.readdir(dir);
    const tests = [];

    for await (const item of dirIter) {
        const { name } = item;
        if (name.startsWith('test-') && name.endsWith('.js')) {
            tests.push(new Test(path.join(dir, name)));
        }
    }

    let failed = 0;
    const testConcurrency = tjs.environ.TJS_TEST_CONCURRENCY ?? tjs.availableParallelism();
    const running = new Set();

    while (true) {
        if (tests.length === 0 && running.size === 0) {
            break;
        }

        const n = testConcurrency - running.size;
        const willRun = tests.splice(0, n);

        for (const test of willRun) {
            test.run();
            const p = test.wait().then(r => {
                running.delete(p);
                return r;
            })
            running.add(p);
        }

        const result = await Promise.race(running);
        printResult(result);
        if (result.failed) {
            failed += 1;
        }
    }

    tjs.exit(failed);
})();

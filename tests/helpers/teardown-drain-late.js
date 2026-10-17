// Child for the test-teardown-drain-late-*.js tests. It throws (uncaught) while
// a large pipe write is pending on socket A. Teardown closes A, the write
// rejects with ECANCELED during the teardown drain, and its rejection handler
// creates a new resource after its subsystem was already torn down:
//   read  - pulls a reader on socket B, which isn't reading (startRead pin)
//   write - a large write on B, whose peer isn't reading (write request pin)
//   timer - setTimeout + setInterval
//   fetch - fetch() against a closed local port (re-creates the lws context)
//   fetch-port - fetch(), then a MessagePort message whose handler fetches
//                again. It runs in the next iteration's poll phase, after the
//                reap began closing that lws context but before the closing
//                phase, and re-creates the context once more.
// Teardown must still release it: Debug builds abort with "Object leaks" and
// a JS_FreeRuntime assertion otherwise.

import path from 'tjs:path';

const variant = tjs.args.at(-1);
const MiB = 1024 * 1024;

// Above what a pipe buffers while the peer isn't reading, on every platform.
const SIZE = 8 * MiB;

function pipeName() {
    const name = `tjs-teardown-drain-late-${tjs.pid}`;

    if (navigator.userAgentData.platform === 'Windows') {
        return `\\\\?\\pipe\\${name}`;
    }

    return path.join(tjs.tmpDir, `${name}.sock`);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const server = new PipeServerSocket(pipeName());
const sopened = await server.opened;
const acceptReader = sopened.readable.getReader();

async function connect() {
    const sock = new PipeSocket(sopened.localAddress);
    const opened = await sock.opened;
    const { value: conn } = await acceptReader.read();
    const copened = await conn.opened;

    return { sock, opened, conn, copened };
}

// A: not reading, and its peer isn't either, so the big write stays queued.
const A = await connect();

await A.opened.readable.cancel();

const awriter = A.opened.writable.getWriter();

// B: open but unpinned at teardown (not reading, nothing in flight), with a
// peer that is open but not reading either, so detach leaves both alone.
const B = await connect();
const bwriter = B.opened.writable.getWriter();
const cwriter = B.copened.writable.getWriter();
let breader;

if (variant === 'read') {
    // B gets one chunk, its queue fills and it stops reading.
    breader = B.opened.readable.getReader();
    await cwriter.write(new Uint8Array(1024));
} else {
    await B.opened.readable.cancel();
}

// B's peer gets one chunk, its queue fills and it stops reading.
await bwriter.write(new Uint8Array(1024));
await sleep(50);

let closedPort;

if (variant === 'fetch' || variant === 'fetch-port') {
    const tmp = new TCPServerSocket('127.0.0.1', { localPort: 0 });

    closedPort = (await tmp.opened).localPort;
    tmp.close();
}

const { port1, port2 } = variant === 'fetch-port' ? new MessageChannel() : {};

if (port2) {
    port2.onmessage = () => {
        fetch(`http://127.0.0.1:${closedPort}/`).catch(() => {});
        console.error(`late ${variant} re-issued from a port message`);
    };
}

function lateOperation() {
    switch (variant) {
        case 'read':
            breader.read().then(() => breader.read()).catch(() => {});
            break;
        case 'write':
            bwriter.write(new Uint8Array(SIZE)).catch(() => {});
            break;
        case 'timer':
            setTimeout(() => {}, 10);
            setInterval(() => {}, 10);
            break;
        case 'fetch':
            fetch(`http://127.0.0.1:${closedPort}/`).catch(() => {});
            break;
        case 'fetch-port':
            fetch(`http://127.0.0.1:${closedPort}/`).catch(() => {});
            port1.postMessage('go');
            break;
        default:
            throw new Error(`unknown variant ${variant}`);
    }
}

awriter.write(new Uint8Array(SIZE)).then(
    () => console.error('A: write completed, no drain-time handler ran'),
    e => {
        lateOperation();
        console.error(`late ${variant} issued during the teardown drain (${e?.message})`);
    });

await sleep(100);

throw new Error('teardown with a pending write');

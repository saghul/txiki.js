// Keep an HTTP request in flight against a local server that accepts the
// connection but never responds, then throw at top level. On this abnormal exit
// the runtime must tear down the lws-backed client cleanly (no crash).
const server = await tjs.listen('tcp', '127.0.0.1', 0);
const { readable, localPort } = await server.opened;
(async () => {
    const r = readable.getReader();
    for (;;) {
        const { done } = await r.read(); // accept connections, never reply
        if (done) {
            break;
        }
    }
})();
fetch(`http://127.0.0.1:${localPort}/`).then(() => {}).catch(() => {});
await new Promise(r => setTimeout(r, 40));
throw new Error('uncaught with an in-flight fetch');

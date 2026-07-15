// Keep a raw TCP socket actively reading, then throw at top level. On this
// abnormal exit the runtime must tear down cleanly (no use-after-free / crash).
const server = await tjs.listen('tcp', '127.0.0.1', 0);
const { readable, localPort } = await server.opened;
(async () => {
    const { value: sconn } = await readable.getReader().read();
    const { writable } = await sconn.opened;
    const w = writable.getWriter();
    for (;;) {
        await w.write(new Uint8Array(4096)); // keep sending
    }
})();
const con = await tjs.connect('tcp', '127.0.0.1', localPort);
const { readable: cr } = await con.opened;
(async () => {
    const r = cr.getReader();
    for (;;) {
        const { done } = await r.read();
        if (done) {
            break;
        }
    }
})();
await new Promise(res => setTimeout(res, 60));
throw new Error('uncaught with a live raw-socket read');

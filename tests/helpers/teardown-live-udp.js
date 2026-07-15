// Keep a UDP socket actively receiving, then throw at top level. On this
// abnormal exit the runtime must tear down cleanly (no use-after-free / crash).
const server = new UDPSocket({ localAddress: '127.0.0.1' });
const info = await server.opened;
(async () => {
    const r = info.readable.getReader();
    for (;;) {
        const { done } = await r.read();
        if (done) {
            break;
        }
    }
})();
await new Promise(r => setTimeout(r, 30));
throw new Error('uncaught with a live udp recv');

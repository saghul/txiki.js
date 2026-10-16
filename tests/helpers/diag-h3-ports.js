// TEMPORARY diagnostic (removed before review): how often does the UDP side of
// an OS-assigned TCP port fail to bind on this machine?
const N = 300;
const failures = [];
const ports = [];

for (let i = 0; i < N; i++) {
    const tcp = await tjs.listen('tcp', '127.0.0.1', 0);
    const port = (await tcp.opened).localPort;

    ports.push(port);

    try {
        const udp = await tjs.listen('udp', '127.0.0.1', port);

        await udp.opened;
        udp.close();
    } catch (e) {
        failures.push({ port, error: `${e.name}: ${e.message} (${e.code ?? e.errno ?? ''})` });
    }

    tcp.close();
}

console.log(`TCP bind(0) -> UDP same-port probe: ${failures.length}/${N} failed`);
console.log(`port range seen: ${Math.min(...ports)}-${Math.max(...ports)}`);

for (const f of failures.slice(0, 60)) {
    console.log(`  port ${f.port}: ${f.error}`);
}

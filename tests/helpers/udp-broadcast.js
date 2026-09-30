const toInt = ip => ip.split('.').reduce((n, octet) => ((n << 8) | Number(octet)) >>> 0, 0);
const toIp = n => [ 24, 16, 8, 0 ].map(s => (n >>> s) & 255).join('.');

// Subnet broadcast address of the first non-internal IPv4 interface, or null
// when there is none (e.g. sandboxed CI).
export function subnetBroadcast() {
    const iface = tjs.system.networkInterfaces.find(i => !i.internal && !i.address.includes(':'));

    if (!iface) {
        return null;
    }

    return toIp((toInt(iface.address) | ~toInt(iface.netmask)) >>> 0);
}

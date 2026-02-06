const core = globalThis[Symbol.for('tjs.internal.core')];

const system = Object.create(null);

Object.defineProperty(system, 'cpus', {
    enumerable: true,
    configurable: false,
    get: core.cpuInfo
});

Object.defineProperty(system, 'loadAvg', {
    enumerable: true,
    configurable: false,
    get: core.loadavg
});

Object.defineProperty(system, 'networkInterfaces', {
    enumerable: true,
    configurable: false,
    get: core.networkInterfaces
});

Object.defineProperty(system, 'uptime', {
    enumerable: true,
    configurable: false,
    get: core.uptime
});

Object.defineProperty(system, 'userInfo', {
    enumerable: true,
    configurable: false,
    get: () => core.userInfo
});

export default system;

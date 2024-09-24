const core = globalThis[Symbol.for('tjs.internal.core')];
const uname = core.uname();

const system = Object.create(null);

Object.defineProperty(system, 'arch', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: uname.machine
});

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


Object.defineProperty(system, 'osRelease', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: uname.release
});


Object.defineProperty(system, 'platform', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: core.platform
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

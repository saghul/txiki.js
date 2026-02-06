const core = globalThis[Symbol.for('tjs.internal.core')];
const uname = core.uname();

const kBrands = Symbol('kBrands');
const kMobile = Symbol('kMobile');
const kPlatform = Symbol('kPlatform');


function getNavigatorPlatform(machine, platform) {
    if (platform === 'darwin') {
        // On macOS, modern browsers return 'MacIntel' even if running on Apple Silicon.
        return 'MacIntel';
    } else if (platform === 'windows') {
        // On Windows, modern browsers return 'Win32' even if running on a 64-bit version of Windows.
        // https://developer.mozilla.org/en-US/docs/Web/API/Navigator/platform#usage_notes
        return 'Win32';
    } else if (platform === 'linux') {
        if (machine === 'i686') {
            return 'Linux i686';
        } else if (machine === 'x86_64') {
            return 'Linux x86_64';
        }

        return `Linux ${machine}`;
    } else if (platform === 'freebsd') {
        if (machine === 'i386') {
            return 'FreeBSD i386';
        } else if (machine === 'amd64') {
            return 'FreeBSD amd64';
        }

        return `FreeBSD ${machine}`;
    } else if (platform === 'openbsd') {
        if (machine === 'i386') {
            return 'OpenBSD i386';
        } else if (machine === 'amd64') {
            return 'OpenBSD amd64';
        }

        return `OpenBSD ${machine}`;
    }

    return `${platform} ${machine}`;
}

function getUADataPlatform(platform) {
    switch (platform) {
        case 'darwin': return 'macOS';
        case 'windows': return 'Windows';
        case 'linux': return 'Linux';
        case 'freebsd': return 'FreeBSD';
        case 'openbsd': return 'OpenBSD';
        default: return platform;
    }
}

function getArchitecture(machine) {
    switch (machine) {
        case 'x86_64':
        case 'amd64':
        case 'i686':
        case 'i386':
            return 'x86';
        case 'arm64':
        case 'aarch64':
            return 'arm';
        default:
            return machine;
    }
}

function getBitness(machine) {
    switch (machine) {
        case 'x86_64':
        case 'amd64':
        case 'arm64':
        case 'aarch64':
            return '64';
        case 'i686':
        case 'i386':
            return '32';
        default:
            return '';
    }
}

function getPlatformVersion(release) {
    const parts = release.split('.');

    return [ parts[0] ?? '0', parts[1] ?? '0', parts[2] ?? '0' ].join('.');
}

const majorVersion = core.version.split('.')[0];

class NavigatorUAData {
    constructor() {
        this[kBrands] = Object.freeze([ Object.freeze({ brand: 'txiki.js', version: majorVersion }) ]);
        this[kMobile] = false;
        this[kPlatform] = getUADataPlatform(core.platform);
    }

    get brands() {
        return this[kBrands];
    }

    get mobile() {
        return this[kMobile];
    }

    get platform() {
        return this[kPlatform];
    }

    getHighEntropyValues(hints) {
        if (!Array.isArray(hints)) {
            return Promise.reject(new TypeError('hints must be an array'));
        }

        const result = {
            brands: this[kBrands],
            mobile: this[kMobile],
            platform: this[kPlatform],
        };

        for (const hint of hints) {
            switch (hint) {
                case 'architecture':
                    result.architecture = getArchitecture(uname.machine);
                    break;
                case 'bitness':
                    result.bitness = getBitness(uname.machine);
                    break;
                case 'fullVersionList':
                    result.fullVersionList = Object.freeze([
                        Object.freeze({ brand: 'txiki.js', version: core.version }),
                    ]);
                    break;
                case 'model':
                    result.model = '';
                    break;
                case 'platformVersion':
                    result.platformVersion = getPlatformVersion(uname.release);
                    break;
                case 'wow64':
                    result.wow64 = false;
                    break;
                case 'formFactors':
                    result.formFactors = Object.freeze([ 'Desktop' ]);
                    break;
            }
        }

        return Promise.resolve(result);
    }

    toJSON() {
        return {
            brands: this[kBrands],
            mobile: this[kMobile],
            platform: this[kPlatform],
        };
    }

    get [Symbol.toStringTag]() {
        return 'NavigatorUAData';
    }
}

const userAgentData = new NavigatorUAData();

class Navigator {
    get userAgent() {
        return `txiki.js/${core.version}`;
    }

    get hardwareConcurrency() {
        return core.availableParallelism();
    }

    get platform() {
        return getNavigatorPlatform(uname.machine, core.platform);
    }

    get userAgentData() {
        return userAgentData;
    }

    get [Symbol.toStringTag]() {
        return 'Navigator';
    }
}

Object.defineProperty(globalThis, 'navigator', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: new Navigator(),
});

Object.defineProperty(globalThis, 'NavigatorUAData', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: NavigatorUAData,
});

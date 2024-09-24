const core = globalThis[Symbol.for('tjs.internal.core')];
const uname = core.uname();


function getNavigatorPlatform(arch, platform) {
    if (platform === 'darwin') {
        // On macOS, modern browsers return 'MacIntel' even if running on Apple Silicon.
        return 'MacIntel';
    } else if (platform === 'windows') {
        // On Windows, modern browsers return 'Win32' even if running on a 64-bit version of Windows.
        // https://developer.mozilla.org/en-US/docs/Web/API/Navigator/platform#usage_notes
        return 'Win32';
    } else if (platform === 'linux') {
        if (arch === 'ia32') {
            return 'Linux i686';
        } else if (arch === 'x64') {
            return 'Linux x86_64';
        }

        return `Linux ${arch}`;
    } else if (platform === 'freebsd') {
        if (arch === 'ia32') {
            return 'FreeBSD i386';
        } else if (arch === 'x64') {
            return 'FreeBSD amd64';
        }

        return `FreeBSD ${arch}`;
    } else if (platform === 'openbsd') {
        if (arch === 'ia32') {
            return 'OpenBSD i386';
        } else if (arch === 'x64') {
            return 'OpenBSD amd64';
        }

        return `OpenBSD ${arch}`;
    }

    return `${platform} ${arch}`;
}

class Navigator {
    get userAgent() {
        return `txiki.js/${core.version}`;
    }

    get hardwareConcurrency() {
        return core.availableParallelism();
    }

    get platform() {
        return getNavigatorPlatform(uname.arch, core.platform);
    }

    get [Symbol.toStringTag]() {
        return 'Navigator';
    }
}

Object.defineProperty(globalThis, 'navigator', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: new Navigator()
});

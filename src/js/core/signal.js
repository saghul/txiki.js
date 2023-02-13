const core = globalThis.__bootstrap;

export function signal(sig, handler) {
    const signum = core.signals[sig];

    if (typeof signum === 'undefined') {
        throw new Error(`invalid signal: ${sig}`);
    }

    return core.signal(signum, handler);
}

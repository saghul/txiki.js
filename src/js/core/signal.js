const core = globalThis[Symbol.for('tjs.internal.core')];

const data = Object.create(null);


function getSigData(signum) {
    return data[signum] ?? (data[signum] = { sh: undefined, listeners: new Set() });
}

function getSigNum(sig) {
    const signum = core.signals[sig];

    if (typeof signum === 'undefined') {
        throw new Error(`invalid signal: ${sig}`);
    }

    return signum;
}

export function addSignalListener(sig, listener) {
    const signum = getSigNum(sig);
    const sd = getSigData(signum);

    sd.listeners.add(listener);

    if (!sd.sh) {
        sd.sh = core.signal(signum, () => {
            for (const listener of sd.listeners) {
                listener();
            }
        });
    }
}

export function removeSignalListener(sig, listener) {
    const signum = getSigNum(sig);
    const sd = getSigData(signum);

    sd.listeners.delete(listener);

    if (sd.listeners.size === 0 && sd.sh) {
        sd.sh.close();
        sd.sh = undefined;
    }
}

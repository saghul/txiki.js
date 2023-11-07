const core = globalThis.__bootstrap;

const timers = new Set();

globalThis.setTimeout = (fn, ms) => {
    const t = core.setTimeout(fn, ms);

    timers.add(t);

    return t;
};

globalThis.clearTimeout = t => {
    core.clearTimeout(t);
    timers.delete(t);
};

globalThis.setInterval = (fn, ms) => {
    const t = core.setInterval(fn, ms);

    timers.add(t);

    return t;
};

globalThis.clearInterval = t => {
    core.clearInterval(t);
    timers.delete(t);
};

const core = globalThis.__bootstrap;

const timers = new Map();
let nextId = 1;

function getNextId() {
    let id;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        id = nextId++;

        if (!timers.has(id)) {
            break;
        }

        if (nextId >= Number.MAX_SAFE_INTEGER) {
            nextId = 1;
        }
    }

    return id;
}

globalThis.setTimeout = (fn, ms, ...args) => {
    const timer = core.setTimeout(fn, ms, ...args);
    const id = getNextId();

    timers.set(id, timer);

    return id;
};

globalThis.clearTimeout = id => {
    const timer = timers.get(id);

    if (timer) {
        core.clearTimeout(timer);
    }

    timers.delete(id);
};

globalThis.setInterval = (fn, ms, ...args) => {
    const timer = core.setInterval(fn, ms, ...args);
    const id = getNextId();

    timers.set(id, timer);

    return id;
};

globalThis.clearInterval = id => {
    const timer = timers.get(id);

    if (timer) {
        core.clearInterval(timer);
    }

    timers.delete(id);
};

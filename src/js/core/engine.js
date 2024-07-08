const core = globalThis[Symbol.for('tjs.internal.core')];

const engine = Object.create(null);

Object.defineProperty(engine, 'compile', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: core.compile
});

Object.defineProperty(engine, 'serialize', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: core.serialize
});

Object.defineProperty(engine, 'deserialize', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: core.deserialize
});

Object.defineProperty(engine, 'evalBytecode', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: core.evalBytecode
});

// Interface for the garbage collection
const gcState = {
    enabled: true,
    threshold: core.gc.getThreshold()
};

Object.defineProperty(engine, 'gc', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: {
        run: () => core.gc.run(),

        set enabled(value) {
            if (value) {
                core.gc.setThreshold(gcState.threshold);
            } else {
                core.gc.setThreshold(-1);
            }

            gcState.enabled=value;
        },
        get enabled() {
            return gcState.enabled;
        },

        set threshold(value) {
            if (gcState.enabled) {
                core.gc.setThreshold(value);
            }

            gcState.threshold = value;
        },
        get threshold() {
            const tmp = core.gc.getThreshold();

            if (tmp !== -1) {
                gcState.threshold = tmp;
            }

            return gcState.threshold;
        },
    }
});

Object.defineProperty(engine, 'versions', {
    enumerable: true,
    configurable: false,
    writable: false,
    value: Object.freeze(core.versions)
});

export default engine;

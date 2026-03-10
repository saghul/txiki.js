const core = globalThis[Symbol.for('tjs.internal.core')];

const env = new Proxy({}, {
    ownKeys() {
        return core.envKeys();
    },
    getOwnPropertyDescriptor(_, prop) {
        if (typeof prop === 'string') {
            try {
                const val = core.getenv(prop);

                return { value: val, writable: true, enumerable: true, configurable: true };
            } catch (_) { /* Ignored. */ }
        }

        return undefined;
    },
    get(_, prop) {
        if (prop === Symbol.toStringTag) {
            return JSON.stringify(core.environ(), null, 2);
        } else if (prop === 'toJSON') {
            return () => core.environ();
        } else if (typeof prop === 'string') {
            try {
                return core.getenv(prop);
            } catch (_) { /* Ignored. */ }
        }

        return undefined;
    },
    set(_, prop, val) {
        core.setenv(prop, val);

        return true;
    },
    deleteProperty(_, prop) {
        core.unsetenv(prop);

        return true;
    },
    has(_, key) {
        return core.envKeys().includes(key);
    }
});

export default env;

const core = globalThis[Symbol.for('tjs.internal.core')];

const env = new Proxy({}, {
    ownKeys() {
        return core.envKeys();
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
        return key in core.envKeys();
    }
});

export default env;

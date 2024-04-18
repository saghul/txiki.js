const core = globalThis[Symbol.for('tjs.internal.core')];

const env = new Proxy({}, {
    ownKeys() {
        return core._envKeys();
    },
    get(_, prop) {
        if (prop === Symbol.toStringTag) {
            return JSON.stringify(core._environ(), null, 2);
        } else if (prop === 'toJSON') {
            return () => core._environ();
        } else if (typeof prop === 'string') {
            try {
                return core._getenv(prop);
            } catch (_) { /* Ignored. */ }
        }

        return undefined;
    },
    set(_, prop, val) {
        core._setenv(prop, val);

        return true;
    },
    deleteProperty(_, prop) {
        core._unsetenv(prop);

        return true;
    },
    has(_, key) {
        return key in core._envKeys();
    }
});

export default env;

const core = globalThis[Symbol.for('tjs.internal.core')];

/**
 * A somewhat naive implementation. It will always copy array buffers, but this drawback
 * comes with the upside of a very simple implementation. We rely on QuickJS's ability
 * to serialize / deserialize objects.
 */
globalThis.structuredClone = (value, options = {}) => {
    const transfers = options?.transfer ?? [];

    for (const t of transfers) {
        if (!core.isArrayBuffer(t)) {
            throw new DOMException('Transferrable is not an ArrayBuffer', 'DataCloneError');
        }
    }

    let ret;

    try {
        ret = core.deserialize(core.serialize(value));
    } catch (e) {
        throw new DOMException(e.message, 'DataCloneError');
    }

    for (const t of transfers) {
        core.detachArrayBuffer(t);
    }

    return ret;
};

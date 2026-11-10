import core from 'tjs:internal/core';

// Immutable buffers include those pinned by an in-flight native write;
// detaching one would free memory the write still reads.
function checkTransferable(t) {
    if (core.isImmutableArrayBuffer(t)) {
        throw new DOMException('Cannot transfer an immutable ArrayBuffer', 'DataCloneError');
    }
}

// Blob and File keep their data in private fields, which QuickJS can't serialize,
// so copy them directly. This only handles a top-level Blob or File.
function cloneValue(value) {
    const { Blob, File } = globalThis;

    if (File && value instanceof File) {
        return new File([ value ], value.name, { type: value.type, lastModified: value.lastModified });
    }

    if (Blob && value instanceof Blob) {
        return new Blob([ value ], { type: value.type });
    }

    return core.deserialize(core.serialize(value));
}

/**
 * A somewhat naive implementation. It will always copy array buffers, but this drawback
 * comes with the upside of a very simple implementation. We rely on QuickJS's ability
 * to serialize / deserialize objects.
 */
globalThis.structuredClone = (value, options = {}) => {
    // Snapshot the list so no user code (iterators, accessors) runs between
    // the final check and the detach below.
    const transfers = [ ...(options?.transfer ?? []) ];

    for (let i = 0; i < transfers.length; i++) {
        if (!core.isArrayBuffer(transfers[i])) {
            throw new DOMException('Transferrable is not an ArrayBuffer', 'DataCloneError');
        }

        checkTransferable(transfers[i]);
    }

    if (typeof value === 'symbol') {
        throw new DOMException(`${String(value)} could not be cloned.`, 'DataCloneError');
    }

    let ret;

    try {
        ret = cloneValue(value);
    } catch (e) {
        throw new DOMException(e.message, 'DataCloneError');
    }

    // Serialization can run user code (getters) that pins a buffer, so check
    // again before detaching anything: either all transfers detach or none.
    for (let i = 0; i < transfers.length; i++) {
        checkTransferable(transfers[i]);
    }

    for (let i = 0; i < transfers.length; i++) {
        core.detachArrayBuffer(transfers[i]);
    }

    return ret;
};

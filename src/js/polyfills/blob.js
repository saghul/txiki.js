// 64 KiB (same size chrome slice theirs blob into Uint8array's)
const POOL_SIZE = 65536;
const { isView } = ArrayBuffer;

/**
 * @param {(Blob | Uint8Array)[]} parts
 * @returns {AsyncIterableIterator<Uint8Array>}
 */
async function * toIterator (parts) {
    for (const part of parts) {
        if (isView(part)) {
            let position = part.byteOffset;
            const end = part.byteOffset + part.byteLength;

            while (position !== end) {
                const size = Math.min(end - position, POOL_SIZE);
                const chunk = part.buffer.slice(position, position + size);

                position += chunk.byteLength;
                yield new Uint8Array(chunk);
            }
        } else {
            yield * part.stream();
        }
    }
}

class Blob {
    /** @type {Array.<(Blob|Uint8Array)>} */
    #parts = [];
    #type = '';
    #size = 0;
    #endings = 'transparent';

    /**
     * The Blob() constructor returns a new Blob object. The content
     * of the blob consists of the concatenation of the values given
     * in the parameter array.
     *
     * @param {*} blobParts
     * @param {{ type?: string, endings?: string }} [options]
     */
    constructor (blobParts = [], options = {}) {
        if (typeof blobParts !== 'object' || blobParts === null) {
            throw new TypeError('Failed to construct \'Blob\': The provided value cannot be converted to a sequence.');
        }

        if (typeof blobParts[Symbol.iterator] !== 'function') {
            throw new TypeError('Failed to construct \'Blob\': The object must have a callable @@iterator property.');
        }

        if (typeof options !== 'object' && typeof options !== 'function') {
            throw new TypeError('Failed to construct \'Blob\': parameter 2 cannot convert to dictionary.');
        }

        if (options === null) {
            options = {};
        }


        const encoder = new TextEncoder();

        for (const element of blobParts) {
            let part;

            if (isView(element)) {
                part = new Uint8Array(
                    element.buffer.slice(
                        element.byteOffset,
                        element.byteOffset + element.byteLength
                    )
                );
            } else if (element instanceof ArrayBuffer) {
                part = new Uint8Array(element.slice(0));
            } else if (element instanceof Blob) {
                part = element;
            } else {
                part = encoder.encode(`${element}`);
            }

            const size = isView(part) ? part.byteLength : part.size;

            // Avoid pushing empty parts into the array to better GC them
            if (size) {
                this.#size += size;
                this.#parts.push(part);
            }
        }

        this.#endings = `${options.endings === undefined ? 'transparent' : options.endings}`;
        const type = options.type === undefined ? '' : String(options.type);

        this.#type = /^[\x20-\x7E]*$/.test(type) ? type : '';
    }

    /**
     * The Blob interface's size property returns the
     * size of the Blob in bytes.
     */
    get size () {
        return this.#size;
    }

    /**
     * The type property of a Blob object returns the MIME type of the file.
     */
    get type () {
        return this.#type;
    }

    /**
     * The text() method in the Blob interface returns a Promise
     * that resolves with a string containing the contents of
     * the blob, interpreted as UTF-8.
     *
     * @return {Promise<string>}
     */
    async text () {
        // More optimized than using this.arrayBuffer()
        // that requires twice as much ram
        const decoder = new TextDecoder();
        let str = '';

        for await (const part of this.stream()) {
            str += decoder.decode(part, { stream: true });
        }

        // Remaining
        str += decoder.decode();

        return str;
    }

    /**
     * The arrayBuffer() method in the Blob interface returns a
     * Promise that resolves with the contents of the blob as
     * binary data contained in an ArrayBuffer.
     *
     * @return {Promise<ArrayBuffer>}
     */
    async arrayBuffer () {
        const data = new Uint8Array(this.size);
        let offset = 0;

        for await (const chunk of this.stream()) {
            data.set(chunk, offset);
            offset += chunk.length;
        }

        return data.buffer;
    }

    stream () {
        const it = toIterator(this.#parts);

        return new ReadableStream({
            type: 'bytes',
            async pull (ctrl) {
                const chunk = await it.next();

                chunk.done ? ctrl.close() : ctrl.enqueue(chunk.value);
            },

            async cancel () {
                await it.return();
            }
        });
    }

    /**
     * The Blob interface's slice() method creates and returns a
     * new Blob object which contains data from a subset of the
     * blob on which it's called.
     *
     * @param {number} [start]
     * @param {number} [end]
     * @param {string} [type]
     */
    slice (start = 0, end = this.size, type = '') {
        const { size } = this;

        let relativeStart = start < 0 ? Math.max(size + start, 0) : Math.min(start, size);
        let relativeEnd = end < 0 ? Math.max(size + end, 0) : Math.min(end, size);

        const span = Math.max(relativeEnd - relativeStart, 0);
        const parts = this.#parts;
        const blobParts = [];
        let added = 0;

        for (const part of parts) {
            // don't add the overflow to new blobParts
            if (added >= span) {
                break;
            }

            const size = isView(part) ? part.byteLength : part.size;

            if (relativeStart && size <= relativeStart) {
                // Skip the beginning and change the relative
                // start & end position as we skip the unwanted parts
                relativeStart -= size;
                relativeEnd -= size;
            } else {
                let chunk;

                if (isView(part)) {
                    chunk = part.subarray(relativeStart, Math.min(size, relativeEnd));
                    added += chunk.byteLength;
                } else {
                    chunk = part.slice(relativeStart, Math.min(size, relativeEnd));
                    added += chunk.size;
                }

                relativeEnd -= size;
                blobParts.push(chunk);
                relativeStart = 0; // All next sequential parts should start at 0
            }
        }

        const blob = new Blob([], { type: `${type}` });

        blob.#size = span;
        blob.#parts = blobParts;

        return blob;
    }

    get [Symbol.toStringTag] () {
        return 'Blob';
    }
}

Object.defineProperties(Blob.prototype, {
    size: { enumerable: true },
    type: { enumerable: true },
    slice: { enumerable: true }
});

Object.defineProperty(window, 'Blob', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Blob
});

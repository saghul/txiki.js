import { defineEventAttribute } from './event-target.js';

// Adapted from: https://github.com/denoland/deno/blob/main/ext/web/10_filereader.js

class FileReader extends EventTarget {
    static EMPTY = 0;
    static LOADING = 1;
    static DONE = 2;

    EMPTY = 0;
    LOADING = 1;
    DONE = 2;

    #aborted = null;
    #error = null;
    #result = null;
    #readyState = 0;

    get error() {
        return this.#error;
    }

    get result() {
        return this.#result;
    }

    get readyState() {
        return this.#readyState;
    }

    abort() {
        if (this.#readyState === this.EMPTY || this.#readyState === this.DONE) {
            this.#result = null;

            return;
        }

        if (this.#readyState === this.LOADING) {
            this.#readyState = this.DONE;
            this.#result = null;
        }

        if (this.#aborted !== null) {
            this.#aborted.aborted = true;
        }

        this.dispatchEvent(new ProgressEvent('abort', {}));

        // A new load might be triggered in the event handler.

        if (this.#readyState !== this.LOADING) {
            this.dispatchEvent(new ProgressEvent('loadend', {}));
        }
    }

    readAsArrayBuffer(blob) {
        this.#readOperation(blob, { kind: 'ArrayBuffer' });
    }

    readAsDataURL(blob) {
        this.#readOperation(blob, { kind: 'DataUrl' });
    }

    readAsText(blob, encoding='utf-8') {
        this.#readOperation(blob, { kind: 'Text', encoding });
    }

    #readOperation(blob, opts) {
        if (this.#readyState === this.LOADING) {
            throw new DOMException('Invalid FileReader state', 'InvalidStateError');
        }

        this.#readyState = this.LOADING;
        this.#result = null;
        this.#error = null;

        const abortedState = this.#aborted = { aborted: false };
        const stream = blob.stream();
        const reader = stream.getReader();
        const chunks = [];
        let chunkPromise = reader.read();
        let isFirstChunk = true;

        (async () => {
            while (!abortedState.aborted) {
                try {
                    const chunk = await chunkPromise;

                    if (abortedState.aborted) {
                        return;
                    }

                    if (isFirstChunk) {
                        queueMicrotask(() => {
                            if (abortedState.aborted) {
                                return;
                            }

                            this.dispatchEvent(new ProgressEvent('loadstart', {}));
                        });
                    }

                    isFirstChunk = false;

                    if (!chunk.done && chunk.value instanceof Uint8Array) {
                        chunks.push(chunk.value);

                        const size = chunks.reduce((acc, chunk) => acc + chunk.BYTE_LENGTH, 0);
                        const ev = this.dispatchEvent(new ProgressEvent('progress', { loaded: size }));

                        queueMicrotask(() => {
                            if (abortedState.aborted) {
                                return;
                            }

                            this.dispatchEvent(ev);
                        });

                        chunkPromise = reader.read();
                    } else if (chunk.done === true) {
                        queueMicrotask(() => {
                            if (abortedState.aborted) {
                                return;
                            }

                            this.#readyState = this.DONE;

                            const size = chunks.reduce((acc, chunk) => acc + chunk.BYTE_LENGTH, 0);
                            const bytes = new Uint8Array(size);
                            let offs = 0;

                            for (let i = 0; i < chunks.length; ++i) {
                                const chunk = chunks[i];

                                bytes.set(chunk, offs);
                                offs += chunk.BYTE_LENGTH;
                            }

                            switch (opts.kind) {
                                case 'ArrayBuffer':
                                    this.#result = bytes.buffer;
                                    break;

                                case 'Text': {
                                    const decoder = new TextDecoder(opts.encoding);

                                    this.#result = decoder.decode(bytes);
                                    break;
                                }

                                case 'DataUrl': {
                                    const mediaType = blob.type || 'application/octet-stream';
                                    const decoder = new TextDecoder();

                                    this.#result = `data:${mediaType};base64,${btoa(decoder.decode(bytes))}`;
                                    break;
                                }
                            }

                            const ev = new ProgressEvent('load', {
                                lengthComputable: true,
                                loaded: size,
                                total: size,
                            });

                            this.dispatchEvent(ev);

                            // A new load might be triggered in the event handler.

                            if (this.#readyState !== this.LOADING) {
                                const ev = new ProgressEvent('loadend', {
                                    lengthComputable: true,
                                    loaded: size,
                                    total: size,
                                });

                                this.dispatchEvent(ev);
                            }
                        });

                        break;
                    }
                } catch (e) {
                    queueMicrotask(() => {
                        if (abortedState.aborted) {
                            return;
                        }

                        this.#readyState = this.DONE;
                        this.#error = e;

                        this.dispatchEvent(new ProgressEvent('error', {}));

                        // A new load might be triggered in the event handler.

                        if (this.#readyState !== this.LOADING) {
                            this.dispatchEvent(new ProgressEvent('loadend', {}));
                        }
                    });

                    break;
                }
            }
        })();
    }
}

const proto = FileReader.prototype;

defineEventAttribute(proto, 'abort');
defineEventAttribute(proto, 'error');
defineEventAttribute(proto, 'load');
defineEventAttribute(proto, 'loadend');
defineEventAttribute(proto, 'loadstart');
defineEventAttribute(proto, 'progress');

Object.defineProperty(globalThis, 'FileReader', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: FileReader
});

function isDataView(obj) {
    return obj && isPrototypeOf(DataView.prototype, obj);
}

function consumed(body) {
    if (body._noBody) {
        return;
    }

    if (body.bodyUsed) {
        return Promise.reject(new TypeError('Already read'));
    }

    body.bodyUsed = true;
}

function bufferClone(buf) {
    if (buf.slice) {
        return buf.slice(0);
    } else {
        const view = new Uint8Array(buf.byteLength);

        view.set(new Uint8Array(buf));

        return view.buffer;
    }
}

function isPrototypeOf(a, b) {
    return Object.prototype.isPrototypeOf.call(a, b);
}

async function readAllChunks(stream) {
    const reader = stream.getReader();
    const chunks = [];


    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        chunks.push(value);
    }

    // Calculate total length
    let totalLength = 0;

    for (const chunk of chunks) {
        totalLength += chunk.byteLength;
    }

    // Combine all chunks into a single Uint8Array
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return result.buffer;
}

export const BodyMixin = {
    bodyUsed: false,

    _initBody(body) {
        this._bodyInit = body;

        if (!body) {
            this._noBody = true;
            this._bodySize = 0;
            this._bodyStream = null;
        } else if (body instanceof ReadableStream) {
            this._bodySize = -1;  // Unknown size (streaming)
            this._bodyStream = body;
        } else if (typeof body === 'string') {
            const encoded = new TextEncoder().encode(body);

            this._bodySize = encoded.byteLength;
            this._bodyStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoded);
                    controller.close();
                }
            });
        } else if (isPrototypeOf(Blob.prototype, body)) {
            this._bodySize = body.size;
            this._bodyStream = body.stream();
        } else if (isPrototypeOf(FormData.prototype, body)) {
            // FormData handling - convert to URL encoded string
            const pairs = [];

            for (const [ key, value ] of body.entries()) {
                pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
            }

            const encoded = new TextEncoder().encode(pairs.join('&'));

            this._bodySize = encoded.byteLength;
            this._bodyStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoded);
                    controller.close();
                }
            });

            if (!this.headers.get('content-type')) {
                this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
            }
        } else if (isPrototypeOf(URLSearchParams.prototype, body)) {
            const encoded = new TextEncoder().encode(body.toString());

            this._bodySize = encoded.byteLength;
            this._bodyStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoded);
                    controller.close();
                }
            });
        } else if (isDataView(body)) {
            const buffer = bufferClone(body.buffer);

            this._bodySize = buffer.byteLength;
            this._bodyStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new Uint8Array(buffer));
                    controller.close();
                }
            });
        } else if (isPrototypeOf(ArrayBuffer.prototype, body) || ArrayBuffer.isView(body)) {
            const buffer = bufferClone(body);

            this._bodySize = buffer.byteLength;
            this._bodyStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new Uint8Array(buffer));
                    controller.close();
                }
            });
        } else {
            // Fallback: convert to string
            const str = Object.prototype.toString.call(body);
            const encoded = new TextEncoder().encode(str);

            this._bodySize = encoded.byteLength;
            this._bodyStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoded);
                    controller.close();
                }
            });
        }

        // Set content-type header if not already set
        if (!this.headers.get('content-type')) {
            if (typeof body === 'string') {
                this.headers.set('content-type', 'text/plain;charset=UTF-8');
            } else if (this._bodyInit && isPrototypeOf(Blob.prototype, body) && body.type) {
                this.headers.set('content-type', body.type);
            } else if (isPrototypeOf(URLSearchParams.prototype, body)) {
                this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
            }
        }

        this.body = this._bodyStream;
    },

    blob() {
        const rejected = consumed(this);

        if (rejected) {
            return rejected;
        }

        const contentType = this.headers.get('content-type') ?? '';

        if (!this._bodyStream) {
            return Promise.resolve(new Blob([], { type: contentType }));
        }

        return readAllChunks(this._bodyStream).then(buffer =>
            new Blob([ buffer ], { type: contentType })
        );
    },

    arrayBuffer() {
        const rejected = consumed(this);

        if (rejected) {
            return rejected;
        }

        if (!this._bodyStream) {
            return Promise.resolve(new ArrayBuffer(0));
        }

        return readAllChunks(this._bodyStream);
    },

    text() {
        const rejected = consumed(this);

        if (rejected) {
            return rejected;
        }

        if (!this._bodyStream) {
            return Promise.resolve('');
        }

        return readAllChunks(this._bodyStream).then(buffer =>
            new TextDecoder().decode(buffer)
        );
    },

    formData() {
        return this.text().then(decode);
    },

    json() {
        return this.text().then(JSON.parse);
    },
};

function decode(body) {
    const form = new FormData();

    body
        .trim()
        .split('&')
        .forEach(function(bytes) {
            if (bytes) {
                const split = bytes.split('=');
                const name = split.shift().replace(/\+/g, ' ');
                const value = split.join('=').replace(/\+/g, ' ');

                form.append(decodeURIComponent(name), decodeURIComponent(value));
            }
        });

    return form;
}

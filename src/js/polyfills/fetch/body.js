import { getFormDataBlob } from '../form-data.js';


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
            // Serialize as multipart/form-data so File/Blob parts are sent as
            // their raw bytes (WHATWG Fetch). getFormDataBlob() builds the
            // multipart body and reports the boundary via the Blob's type.
            const blob = getFormDataBlob(body);

            this._bodySize = blob.size;
            this._bodyStream = blob.stream();

            if (!this.headers.get('content-type')) {
                this.headers.set('content-type', blob.type);
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
        const contentType = this.headers.get('content-type') ?? '';

        if (/^multipart\/form-data/i.test(contentType)) {
            const boundary = getBoundary(contentType);

            if (!boundary) {
                return Promise.reject(new TypeError('Failed to parse body as FormData: missing multipart boundary'));
            }

            return this.arrayBuffer().then(buffer =>
                parseMultipart(new Uint8Array(buffer), boundary)
            );
        }

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

function getBoundary(contentType) {
    const match = /;\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);

    if (!match) {
        return null;
    }

    return (match[1] ?? match[2]).trim();
}

function indexOfBytes(haystack, needle, from) {
    const last = haystack.length - needle.length;

    outer: for (let i = from; i <= last; i++) {
        for (let j = 0; j < needle.length; j++) {
            if (haystack[i + j] !== needle[j]) {
                continue outer;
            }
        }

        return i;
    }

    return -1;
}

// Inverse of the escaping the multipart serializer applies to field names and
// filenames (see form-data.js _blob()).
function unescapeFieldName(value) {
    return value
        .replace(/%0A/gi, '\n')
        .replace(/%0D/gi, '\r')
        .replace(/%22/gi, '"');
}

function appendPart(form, headerText, content) {
    let name = null;
    let filename = null;
    let partType = null;

    for (const line of headerText.split('\r\n')) {
        const colon = line.indexOf(':');

        if (colon === -1) {
            continue;
        }

        const headerName = line.slice(0, colon).trim().toLowerCase();
        const headerValue = line.slice(colon + 1).trim();

        if (headerName === 'content-disposition') {
            const nameMatch = /;\s*name="([^"]*)"/i.exec(headerValue);
            const filenameMatch = /;\s*filename="([^"]*)"/i.exec(headerValue);

            if (nameMatch) {
                name = unescapeFieldName(nameMatch[1]);
            }

            if (filenameMatch) {
                filename = unescapeFieldName(filenameMatch[1]);
            }
        } else if (headerName === 'content-type') {
            partType = headerValue;
        }
    }

    if (name === null) {
        return;
    }

    if (filename === null) {
        form.append(name, new TextDecoder().decode(content));
    } else {
        const options = partType ? { type: partType } : {};

        form.append(name, new File([ content ], filename, options), filename);
    }
}

function parseMultipart(bytes, boundary) {
    const form = new FormData();
    const delimiter = new TextEncoder().encode('--' + boundary);
    const CRLFCRLF = [ 0x0d, 0x0a, 0x0d, 0x0a ];

    let pos = indexOfBytes(bytes, delimiter, 0);

    if (pos === -1) {
        return form;
    }

    pos += delimiter.length;

    while (true) {
        // Closing delimiter "--boundary--" terminates the body.
        if (bytes[pos] === 0x2d && bytes[pos + 1] === 0x2d) {
            break;
        }

        // Skip the CRLF that follows the delimiter.
        if (bytes[pos] === 0x0d && bytes[pos + 1] === 0x0a) {
            pos += 2;
        }

        const next = indexOfBytes(bytes, delimiter, pos);

        if (next === -1) {
            break;
        }

        // The delimiter is preceded by a CRLF that belongs to the framing.
        let end = next;

        if (bytes[end - 2] === 0x0d && bytes[end - 1] === 0x0a) {
            end -= 2;
        }

        // Split the part into headers and content at the blank line.
        const part = bytes.subarray(pos, end);
        const headerEnd = indexOfBytes(part, CRLFCRLF, 0);

        if (headerEnd !== -1) {
            const headerText = new TextDecoder().decode(part.subarray(0, headerEnd));
            const content = part.subarray(headerEnd + CRLFCRLF.length);

            appendPart(form, headerText, content);
        }

        pos = next + delimiter.length;
    }

    return form;
}

/* Blob.js
 * A Blob, File, FileReader & URL implementation.
 * 2020-02-01
 *
 * By Eli Grey, https://eligrey.com
 * By Jimmy Wärting, https://github.com/jimmywarting
 * License: MIT
 *   See https://github.com/eligrey/Blob.js/blob/master/LICENSE.md
 */

let createObjectURL = URL.createObjectURL;
let revokeObjectURL = URL.revokeObjectURL;
const textEncode = globalThis.textEncode;
const textDecode = globalThis.textDecode;
// var core = globalThis.__bootstrap;

function bufferClone(buf) {
    const view = new Array(buf.byteLength);
    const array = new Uint8Array(buf);
    let i = view.length;

    while (i--) {
        view[i] = array[i];
    }

    return view;
}

function array2base64(input) {
    const byteToCharMap =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

    const output = [];

    for (let i = 0; i < input.length; i += 3) {
        const byte1 = input[i];
        const haveByte2 = i + 1 < input.length;
        const byte2 = haveByte2 ? input[i + 1] : 0;
        const haveByte3 = i + 2 < input.length;
        const byte3 = haveByte3 ? input[i + 2] : 0;

        const outByte1 = byte1 >> 2;
        const outByte2 = ((byte1 & 0x03) << 4) | (byte2 >> 4);
        let outByte3 = ((byte2 & 0x0f) << 2) | (byte3 >> 6);
        let outByte4 = byte3 & 0x3f;

        if (!haveByte3) {
            outByte4 = 64;

            if (!haveByte2) {
                outByte3 = 64;
            }
        }

        output.push(
            byteToCharMap[outByte1],
            byteToCharMap[outByte2],
            byteToCharMap[outByte3],
            byteToCharMap[outByte4]
        );
    }

    return output.join('');
}

function getObjectTypeName(o) {
    return Object.prototype.toString.call(o).slice(8, -1);
}

function isPrototypeOf(c, o) {
    return (
        typeof c === 'object' &&
        Object.prototype.isPrototypeOf.call(c.prototype, o)
    );
}

function isDataView(o) {
    return (
        getObjectTypeName(o) === 'DataView' ||
        isPrototypeOf(globalThis.DataView, o)
    );
}

const arrayBufferClassNames = [
    'Int8Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'Int16Array',
    'Uint16Array',
    'Int32Array',
    'Uint32Array',
    'Float32Array',
    'Float64Array',
    'ArrayBuffer',
];

function includes(a, v) {
    return a.includes(v);
}

function isArrayBuffer(o) {
    return (
        includes(arrayBufferClassNames, getObjectTypeName(o)) ||
        isPrototypeOf(globalThis.ArrayBuffer, o)
    );
}

function concatTypedArrays(chunks) {
    let size = 0;
    let j = chunks.length;

    while (j--) {
        size += chunks[j].length;
    }

    const b = new Uint8Array(size);
    let offset = 0;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        b.set(chunk, offset);
        offset += chunk.byteLength || chunk.length;
    }

    return b;
}

/** ******************************************************/
/*                   Blob constructor                   */
/** ******************************************************/
class Blob {
    constructor(chunks, opts) {
        chunks = chunks ? chunks.slice() : [];
        opts = opts === null ? {} : opts;

        for (let i = 0, len = chunks.length; i < len; i++) {
            const chunk = chunks[i];

            if (chunk instanceof Blob) {
                chunks[i] = chunk._buffer;
            } else if (typeof chunk === 'string') {
                chunks[i] = textEncode(chunk);
            } else if (isDataView(chunk)) {
                chunks[i] = bufferClone(chunk.buffer);
            } else if (isArrayBuffer(chunk)) {
                chunks[i] = bufferClone(chunk);
            } else {
                chunks[i] = textEncode(String(chunk));
            }
        }

        this._buffer = concatTypedArrays(chunks);
        this.size = this._buffer.length;

        this.type = opts.type || '';

        if (/[^\u0020-\u007E]/.test(this.type)) {
            this.type = '';
        } else {
            this.type = this.type.toLowerCase();
        }
    }

    arrayBuffer() {
        return Promise.resolve(this._buffer.buffer || this._buffer);
    }

    stream() {
        let position = 0;
        const blob = this;

        return new ReadableStream({
            type: 'bytes',
            autoAllocateChunkSize: 524288,

            pull(controller) {
                const v = controller.byobRequest.view;
                const chunk = blob.slice(position, position + v.byteLength);

                return chunk.arrayBuffer().then(buffer => {
                    const uint8array = new Uint8Array(buffer);
                    const bytesRead = uint8array.byteLength;

                    position += bytesRead;
                    v.set(uint8array);
                    controller.byobRequest.respond(bytesRead);

                    if (position >= blob.size) {
                        controller.close();
                    }
                });
            },
        });
    }

    text() {
        return Promise.resolve(textDecode(this._buffer));
    }

    slice(start, end, type) {
        const slice = this._buffer.slice(
            start || 0,
            end || this._buffer.length
        );

        return new Blob([ slice ], { type });
    }

    toString() {
        return '[object Blob]';
    }
}

/** ******************************************************/
/*                   File constructor                   */
/** ******************************************************/
class File extends Blob {
    constructor(chunks, name, opts = {}) {
        super(chunks, opts);

        this.name = name.replace(/\//g, ':');
        this.lastModifiedDate = opts.lastModified
            ? new Date(opts.lastModified)
            : new Date();
        this.lastModified = +this.lastModifiedDate;
    }

    toString() {
        return '[object File]';
    }
}

if (Object.setPrototypeOf) {
    Object.setPrototypeOf(File, Blob);
} else {
    try {
        File.__proto__ = Blob;
    } catch (e) {
        /**/
    }
}

/** ******************************************************/
/*                FileReader constructor                */
/** ******************************************************/
class FileReader {
    constructor() {
        const delegate = document.createDocumentFragment();

        this.addEventListener = delegate.addEventListener;

        this.dispatchEvent = function (evt) {
            const local = this[`on${evt.type}`];

            if (typeof local === 'function') {
                local(evt);
            }

            delegate.dispatchEvent(evt);
        };

        this.removeEventListener = delegate.removeEventListener;
    }

    readAsDataURL(blob) {
        _read(this, blob, 'readAsDataURL');
        this.result = `data:${blob.type};base64,${array2base64(blob._buffer)}`;
    }

    readAsText(blob) {
        _read(this, blob, 'readAsText');
        this.result = textDecode(blob._buffer);
    }

    readAsArrayBuffer(blob) {
        _read(this, blob, 'readAsText');
        // return ArrayBuffer when possible
        this.result = (blob._buffer.buffer || blob._buffer).slice();
    }

    abort() {}
}

function _read(fr, blob, kind) {
    if (!(blob instanceof Blob)) {
        throw new TypeError(
            `Failed to execute '${kind}' on 'FileReader': parameter 1 is not of type 'Blob'.`
        );
    }

    fr.result = '';

    setTimeout(function () {
        this.readyState = FileReader.LOADING;
        fr.dispatchEvent(new Event('load'));
        fr.dispatchEvent(new Event('loadend'));
    });
}

FileReader.EMPTY = 0;
FileReader.LOADING = 1;
FileReader.DONE = 2;
FileReader.prototype.error = null;
FileReader.prototype.onabort = null;
FileReader.prototype.onerror = null;
FileReader.prototype.onload = null;
FileReader.prototype.onloadend = null;
FileReader.prototype.onloadstart = null;
FileReader.prototype.onprogress = null;

/** ******************************************************/
/*                         URL                          */
/** ******************************************************/
URL.createObjectURL = blob =>
    blob instanceof Blob
        ? `data:${blob.type};base64,${array2base64(blob._buffer)}`
        : createObjectURL.call(URL, blob);

URL.revokeObjectURL = url => {
    revokeObjectURL && revokeObjectURL.call(URL, url);
};

/** ******************************************************/
/*                         XHR                          */
/** ******************************************************/
const _send = XMLHttpRequest && XMLHttpRequest.prototype.send;

if (_send) {
    XMLHttpRequest.prototype.send = function (data) {
        if (data instanceof Blob) {
            this.setRequestHeader('Content-Type', data.type);
            _send.call(this, textDecode(data._buffer));
        } else {
            _send.call(this, data);
        }
    };
}

export { Blob };

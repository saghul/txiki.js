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

function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
        reader.onload = function() {
            resolve(reader.result);
        };

        reader.onerror = function() {
            reject(reader.error);
        };
    });
}

function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);

    reader.readAsArrayBuffer(blob);

    return promise;
}

function readBlobAsText(blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);
    var match = /charset=([A-Za-z0-9_-]+)/.exec(blob.type);
    var encoding = match ? match[1] : 'utf-8';

    reader.readAsText(blob, encoding);

    return promise;
}

function readArrayBufferAsText(buf) {
    var view = new Uint8Array(buf);
    var chars = new Array(view.length);

    for (var i = 0; i < view.length; i++) {
        chars[i] = String.fromCharCode(view[i]);
    }

    return chars.join('');
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

export const BodyMixin = {
    bodyUsed: false,

    _initBody(body) {
        this._bodyInit = body;

        if (!body) {
            this._noBody = true;
            this._bodyText = '';
        } else if (typeof body === 'string') {
            this._bodyText = body;
        } else if (isPrototypeOf(Blob.prototype, body)) {
            this._bodyBlob = body;
        } else if (isPrototypeOf(FormData.prototype, body)) {
            this._bodyFormData = body;
        } else if (isPrototypeOf(URLSearchParams.prototype, body)) {
            this._bodyText = body.toString();
        } else if (isDataView(body)) {
            this._bodyArrayBuffer = bufferClone(body.buffer);
        } else if (isPrototypeOf(ArrayBuffer.prototype, body) || ArrayBuffer.isView(body)) {
            this._bodyArrayBuffer = bufferClone(body);
        } else {
            this._bodyText = body = Object.prototype.toString.call(body);
        }

        if (!this.headers.get('content-type')) {
            if (typeof body === 'string') {
                this.headers.set('content-type', 'text/plain;charset=UTF-8');
            } else if (this._bodyBlob && this._bodyBlob.type) {
                this.headers.set('content-type', this._bodyBlob.type);
            } else if (isPrototypeOf(URLSearchParams.prototype, body)) {
                this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
            }
        }
    },

    blob() {
        const rejected = consumed(this);

        if (rejected) {
            return rejected;
        }

        if (this._bodyBlob) {
            return Promise.resolve(this._bodyBlob);
        } else if (this._bodyArrayBuffer) {
            return Promise.resolve(new Blob([ this._bodyArrayBuffer ]));
        } else if (this._bodyFormData) {
            throw new Error('could not read FormData body as blob');
        } else {
            return Promise.resolve(new Blob([ this._bodyText ]));
        }
    },

    arrayBuffer() {
        if (this._bodyArrayBuffer) {
            var isConsumed = consumed(this);

            if (isConsumed) {
                return isConsumed;
            } else if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
                return Promise.resolve(
                    this._bodyArrayBuffer.buffer.slice(
                        this._bodyArrayBuffer.byteOffset,
                        this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
                    )
                );
            } else {
                return Promise.resolve(this._bodyArrayBuffer);
            }
        } else {
            return this.blob().then(readBlobAsArrayBuffer);
        }
    },

    text() {
        const rejected = consumed(this);

        if (rejected) {
            return rejected;
        }

        if (this._bodyBlob) {
            return readBlobAsText(this._bodyBlob);
        } else if (this._bodyArrayBuffer) {
            return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer));
        } else if (this._bodyFormData) {
            throw new Error('could not read FormData body as text');
        } else {
            return Promise.resolve(this._bodyText);
        }
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

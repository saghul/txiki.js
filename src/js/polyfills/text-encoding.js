const core = globalThis.__bootstrap;
const { Utf8Decoder, utf8_encode } = core.textCoding;

class TextEncoder {
    constructor(label = 'utf-8') {
        label = label.toLowerCase().trim();

        if (label !== 'utf-8') {
            throw new RangeError('Unsupported encoding: ' + label);
        }
    }
    get encoding() {
        return 'utf-8';
    }
    encode(input = '') {
        return utf8_encode(input);
    }
}

globalThis.TextEncoder = TextEncoder;


const Decoders = {
    'utf-8': Utf8Decoder,
    'utf8': Utf8Decoder,
    'unicode-1-1-utf-8': Utf8Decoder,
    'unicode11utf8': Utf8Decoder,
    'unicode20utf8': Utf8Decoder,
    'x-unicode20utf8': Utf8Decoder,
};

class TextDecoder {
    #impl;
    #opts = 0;
    constructor(encoding = 'utf8', options = {}) {
        const label = encoding.toLowerCase().trim();
        const constr = Decoders[label];

        if (!constr) {
            throw new RangeError('Unsupported encoding: ' + encoding);
        }

        this.#impl = new constr();

        if (options.fatal) {
            this.#opts |= Utf8Decoder.opts.fatal;
        }

        if (options.ignoreBOM) {
            this.#opts |= Utf8Decoder.opts.ignoreBOM;
        }
    }
    get encoding() {
        return 'utf-8';
    }
    get fatal() {
        return (this.#opts & Utf8Decoder.opts.fatal) > 0;
    }
    get ignoreBOM() {
        return (this.#opts & Utf8Decoder.opts.ignoreBOM) > 0;
    }
    decode(buf, options) {
        let opts = this.#opts;

        if (options?.stream) {
            opts |= Utf8Decoder.opts.stream;
        }

        if (buf === undefined) {
            buf = new Uint8Array(0);
        } else if (typeof buf === 'object' && buf instanceof ArrayBuffer) {
            buf = new Uint8Array(buf);
        } else if (typeof buf === 'object' && 'buffer' in buf &&
            buf.buffer instanceof ArrayBuffer
        ) {
            buf = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        } else {
            throw new TypeError('Expected TypedArray or ArrayBuffer or ArrayBufferView');
        }

        const res = this.#impl.decode(buf, opts);

        return res;
    }
}

globalThis.TextDecoder = TextDecoder;

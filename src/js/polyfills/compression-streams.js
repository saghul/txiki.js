const core = globalThis[Symbol.for('tjs.internal.core')];
const NativeCompressor = core.Compressor;
const NativeDecompressor = core.Decompressor;

const MZ_NO_FLUSH = 0;
const MZ_FINISH = 4;

const validFormats = [ 'gzip', 'deflate', 'deflate-raw' ];

function toUint8Array(chunk) {
    if (chunk instanceof Uint8Array) {
        return chunk;
    }

    if (chunk instanceof ArrayBuffer) {
        return new Uint8Array(chunk);
    }

    if (ArrayBuffer.isView(chunk)) {
        return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    }

    throw new TypeError('chunk must be a BufferSource');
}

class CompressionStream {
    constructor(format) {
        if (!validFormats.includes(format)) {
            throw new TypeError(`Unsupported compression format: '${format}'`);
        }

        const compressor = new NativeCompressor(format);

        const { readable, writable } = new TransformStream({
            transform(chunk, controller) {
                const input = toUint8Array(chunk);
                const result = compressor.process(input, MZ_NO_FLUSH);

                if (result.length > 0) {
                    controller.enqueue(result);
                }
            },
            flush(controller) {
                const result = compressor.process(new Uint8Array(0), MZ_FINISH);

                if (result.length > 0) {
                    controller.enqueue(result);
                }
            }
        });

        this.readable = readable;
        this.writable = writable;
    }
}

class DecompressionStream {
    constructor(format) {
        if (!validFormats.includes(format)) {
            throw new TypeError(`Unsupported compression format: '${format}'`);
        }

        const decompressor = new NativeDecompressor(format);

        const { readable, writable } = new TransformStream({
            transform(chunk, controller) {
                const input = toUint8Array(chunk);
                const result = decompressor.process(input);

                if (result.length > 0) {
                    controller.enqueue(result);
                }
            }
        });

        this.readable = readable;
        this.writable = writable;
    }
}

globalThis.CompressionStream = CompressionStream;
globalThis.DecompressionStream = DecompressionStream;

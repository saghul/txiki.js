import { digestAlgorithms, nativeDigest, toUint8Array } from './helpers.js';

export function digest(algorithm, data) {
    const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;
    const typeId = digestAlgorithms[name];

    if (typeId === undefined) {
        return Promise.reject(new DOMException(`Unrecognized algorithm name: ${name}`, 'NotSupportedError'));
    }

    let bytes;

    try {
        bytes = toUint8Array(data);
    } catch (e) {
        return Promise.reject(e);
    }

    const { promise, resolve, reject } = Promise.withResolvers();

    nativeDigest(typeId, bytes, (err, result) => {
        if (err) {
            reject(new DOMException(err, 'OperationError'));
        } else {
            resolve(result.buffer);
        }
    });

    return promise;
}

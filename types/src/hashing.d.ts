/**
 * Hash computation module.
 *
 * Compute cryptographic hashes using a variety of algorithms including
 * MD5, SHA-1, SHA-2, and SHA-3 families.
 *
 * ```js
 * import { createHash } from 'tjs:hashing';
 *
 * const hash = createHash('sha256');
 * hash.update('hello world');
 * console.log(hash.digest()); // hex string
 * ```
 *
 * @module tjs:hashing
 */

declare module 'tjs:hashing'{
    export type HashType = 'md5' | 'sha1' | 'sha256' | 'sha224' | 'sha512' | 'sha384' | 'sha512_256' | 'sha512_224' | 'sha3_512' | 'sha3_384' | 'sha3_256' | 'sha3_224'

    export interface HashObj {
        /**
         * Feed more data into the hash. Can be called repeatedly to hash data
         * incrementally. Accepts a string (UTF-8 encoded) or raw bytes.
         * Returns the same object so calls can be chained.
         */
        update(data: string | Uint8Array): HashObj;

        /** Finalize the hash and return it as a lowercase hex string. */
        digest(): string;

        /** Finalize the hash and return the raw digest bytes. */
        bytes(): Uint8Array;
    }

    /** Array of all supported hash algorithm names (the keys accepted by {@link createHash}). */
    export const SUPPORTED_TYPES: readonly HashType[];

    export function createHash(type: HashType): HashObj;
}

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
        update(data: string): HashObj;
        digest(): string;
        bytes(): Uint8Array;
    }

    export const SUPPORTED_TYPES: HashType;

    export function createHash(type: HashType): HashObj;
}

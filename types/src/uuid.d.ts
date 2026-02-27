/**
 * UUID generation and parsing module.
 *
 * This is the [uuid](https://www.npmjs.com/package/uuid) module (v13) on npm.
 * Supports generating v1 (timestamp), v3 (MD5 namespace), v4 (random),
 * v5 (SHA-1 namespace), v6 (reordered timestamp), and v7 (Unix epoch time-based) UUIDs.
 *
 * ```js
 * import { v7, validate } from 'tjs:uuid';
 *
 * const id = v7();
 * console.log(id);           // e.g. '01932c08-e774-7484-a548-1ff098b05a47'
 * console.log(validate(id)); // true
 * ```
 *
 * @module tjs:uuid
 */

declare module 'tjs:uuid'{
    // Based on uuid 13.0.0
    // Project: https://github.com/uuidjs/uuid

    /** A UUID value, either as a string or a byte array. */
    export type UUIDTypes<TBuf extends Uint8Array = Uint8Array> = string | TBuf;

    /** Options for v1 UUID generation. */
    export type Version1Options = {
        node?: Uint8Array;
        clockseq?: number;
        random?: Uint8Array;
        rng?: () => Uint8Array;
        msecs?: number;
        nsecs?: number;
    };

    /** Options for v4 UUID generation. */
    export type Version4Options = {
        random?: Uint8Array;
        rng?: () => Uint8Array;
    };

    /** Options for v6 UUID generation (same as v1). */
    export type Version6Options = Version1Options;

    /** Options for v7 UUID generation. */
    export type Version7Options = {
        random?: Uint8Array;
        msecs?: number;
        seq?: number;
        rng?: () => Uint8Array;
    };

    /** Generate a v1 (timestamp) UUID. */
    export function v1(options?: Version1Options, buf?: undefined, offset?: number): string;
    export function v1<TBuf extends Uint8Array = Uint8Array>(options: Version1Options | undefined, buf: TBuf, offset?: number): TBuf;

    /** Generate a v3 (MD5 namespace) UUID. */
    export function v3(value: string | Uint8Array, namespace: UUIDTypes, buf?: undefined, offset?: number): string;
    export function v3<TBuf extends Uint8Array = Uint8Array>(value: string | Uint8Array, namespace: UUIDTypes, buf: TBuf, offset?: number): TBuf;
    export namespace v3 {
        /** DNS namespace UUID. */
        var DNS: string;
        /** URL namespace UUID. */
        var URL: string;
    }

    /** Generate a v4 (random) UUID. */
    export function v4(options?: Version4Options, buf?: undefined, offset?: number): string;
    export function v4<TBuf extends Uint8Array = Uint8Array>(options: Version4Options | undefined, buf: TBuf, offset?: number): TBuf;

    /** Generate a v5 (SHA-1 namespace) UUID. */
    export function v5(value: string | Uint8Array, namespace: UUIDTypes, buf?: undefined, offset?: number): string;
    export function v5<TBuf extends Uint8Array = Uint8Array>(value: string | Uint8Array, namespace: UUIDTypes, buf: TBuf, offset?: number): TBuf;
    export namespace v5 {
        /** DNS namespace UUID. */
        var DNS: string;
        /** URL namespace UUID. */
        var URL: string;
    }

    /** Generate a v6 (reordered timestamp) UUID. */
    export function v6(options?: Version6Options, buf?: undefined, offset?: number): string;
    export function v6<TBuf extends Uint8Array = Uint8Array>(options: Version6Options | undefined, buf: TBuf, offset?: number): TBuf;

    /** Generate a v7 (Unix epoch time-based) UUID. */
    export function v7(options?: Version7Options, buf?: undefined, offset?: number): string;
    export function v7<TBuf extends Uint8Array = Uint8Array>(options: Version7Options | undefined, buf: TBuf, offset?: number): TBuf;

    /** Convert a v1 UUID to a v6 UUID. */
    export function v1ToV6(uuid: string): string;
    export function v1ToV6(uuid: Uint8Array): Uint8Array;

    /** Convert a v6 UUID to a v1 UUID. */
    export function v6ToV1(uuid: string): string;
    export function v6ToV1(uuid: Uint8Array): Uint8Array;

    /** Nil UUID: `"00000000-0000-0000-0000-000000000000"`. */
    export const NIL: string;

    /** Max UUID: `"ffffffff-ffff-ffff-ffff-ffffffffffff"`. */
    export const MAX: string;

    /** Parse a UUID string into a `Uint8Array`. */
    export function parse(uuid: string): Uint8Array;

    /** Convert a UUID byte array to a string. */
    export function stringify(arr: Uint8Array, offset?: number): string;

    /** Validate a UUID string. */
    export function validate(uuid: unknown): boolean;

    /** Get the version number of a UUID string. */
    export function version(uuid: string): number;
}

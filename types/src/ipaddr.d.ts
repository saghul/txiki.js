/**
 * IP address utilities module.
 *
 * Parse, validate, and manipulate IPv4 and IPv6 addresses. Supports CIDR
 * notation, range detection, subnet matching, and address conversion.
 * Based on the [ipaddr.js](https://github.com/whitequark/ipaddr.js) library.
 *
 * ```js
 * import ipaddr from 'tjs:ipaddr';
 *
 * const addr = ipaddr.parse('192.168.1.1');
 * console.log(addr.kind());  // 'ipv4'
 * console.log(addr.range()); // 'private'
 * console.log(ipaddr.isValid('::1')); // true
 * ```
 *
 * @module tjs:ipaddr
 */

declare module 'tjs:ipaddr'{
    type IPvXRangeDefaults = 'unicast' | 'unspecified' | 'multicast' | 'linkLocal' | 'loopback' | 'reserved';
    type IPv4Range = IPvXRangeDefaults | 'broadcast' | 'carrierGradeNat' | 'private';
    type IPv6Range = IPvXRangeDefaults | 'uniqueLocal' | 'ipv4Mapped' | 'rfc6145' | 'rfc6052' | '6to4' | 'teredo';

    interface RangeList<T> {
        [name: string]: [T, number] | [T, number][];
    }

    // Common methods/properties for IPv4 and IPv6 classes.
    class IP {
        prefixLengthFromSubnetMask(): number | null;
        toByteArray(): number[];
        toNormalizedString(): string;
        toString(): string;
    }

    // NOTE: `tjs:ipaddr` exposes a single default export (the ipaddr.js object).
    // The functions and classes below are declared without `export` because they
    // are reachable as members of that default object, not as named module
    // exports (importing them by name throws at runtime).

    class IPv4 extends IP {
        static broadcastAddressFromCIDR(addr: string): IPv4;
        static isIPv4(addr: string): boolean;
        static isValidFourPartDecimal(addr: string): boolean;
        static isValid(addr: string): boolean;
        static networkAddressFromCIDR(addr: string): IPv4;
        static parse(addr: string): IPv4;
        static parseCIDR(addr: string): [IPv4, number];
        static subnetMaskFromPrefixLength(prefix: number): IPv4;
        constructor(octets: number[]);
        octets: number[]
        
        kind(): 'ipv4';
        match(what: IPv4 | IPv6 | [IPv4 | IPv6, number], bits?: number): boolean;
        range(): IPv4Range;
        subnetMatch(rangeList: RangeList<IPv4>, defaultName?: string): string;
        toIPv4MappedAddress(): IPv6;
    }

    class IPv6 extends IP {
        static broadcastAddressFromCIDR(addr: string): IPv6;
        static isIPv6(addr: string): boolean;
        static isValid(addr: string): boolean;
        static networkAddressFromCIDR(addr: string): IPv6;
        static parse(addr: string): IPv6;
        static parseCIDR(addr: string): [IPv6, number];
        static subnetMaskFromPrefixLength(prefix: number): IPv6;
        constructor(parts: number[]);
        parts: number[]
        zoneId?: string
        
        isIPv4MappedAddress(): boolean;
        kind(): 'ipv6';
        match(what: IPv4 | IPv6 | [IPv4 | IPv6, number], bits?: number): boolean;
        range(): IPv6Range;
        subnetMatch(rangeList: RangeList<IPv6>, defaultName?: string): string;
        toIPv4Address(): IPv4;
        toRFC5952String(): string;
    }

    /**
     * The module's default export: the [ipaddr.js](https://github.com/whitequark/ipaddr.js)
     * object, exposing the parsing/validation helpers and the {@link IPv4} / {@link IPv6} classes.
     */
    const ipaddr: {
        /** Build an address from a byte array (4 bytes for IPv4, 16 for IPv6). */
        fromByteArray(bytes: number[]): IPv4 | IPv6;
        /** Returns `true` if the string is a valid IPv4 or IPv6 address. */
        isValid(addr: string): boolean;
        /** Parse an IPv4 or IPv6 address, throwing on invalid input. */
        parse(addr: string): IPv4 | IPv6;
        /** Parse an address in CIDR notation, returning `[address, prefixLength]`. */
        parseCIDR(mask: string): [IPv4 | IPv6, number];
        /** Parse an address, converting IPv4-mapped IPv6 addresses to IPv4. */
        process(addr: string): IPv4 | IPv6;
        /** Match an address against a list of named ranges. */
        subnetMatch(addr: IPv4 | IPv6, rangeList: RangeList<IPv4 | IPv6>, defaultName?: string): string;
        readonly IPv4: typeof IPv4;
        readonly IPv6: typeof IPv6;
    };

    // Type-only exports: these classes are reachable as members of the default
    // export at runtime, but exporting their *types* lets TypeScript consumers
    // reference them (e.g. `import type { IPv4 } from 'tjs:ipaddr'`).
    export type { IP, IPv4, IPv6, RangeList, IPvXRangeDefaults, IPv4Range, IPv6Range };

    export default ipaddr;
}

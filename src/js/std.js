var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, copyDefault, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && (copyDefault || key !== "default"))
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toESM = (module2, isNodeMode) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", !isNodeMode && module2 && module2.__esModule ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};

// node_modules/ipaddr.js/lib/ipaddr.js
var require_ipaddr = __commonJS({
  "node_modules/ipaddr.js/lib/ipaddr.js"(exports2, module2) {
    (function(root2) {
      "use strict";
      const ipv4Part = "(0?\\d+|0x[a-f0-9]+)";
      const ipv4Regexes = {
        fourOctet: new RegExp(`^${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}$`, "i"),
        threeOctet: new RegExp(`^${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}$`, "i"),
        twoOctet: new RegExp(`^${ipv4Part}\\.${ipv4Part}$`, "i"),
        longValue: new RegExp(`^${ipv4Part}$`, "i")
      };
      const octalRegex = new RegExp(`^0[0-7]+$`, "i");
      const hexRegex = new RegExp(`^0x[a-f0-9]+$`, "i");
      const zoneIndex = "%[0-9a-z]{1,}";
      const ipv6Part = "(?:[0-9a-f]+::?)+";
      const ipv6Regexes = {
        zoneIndex: new RegExp(zoneIndex, "i"),
        "native": new RegExp(`^(::)?(${ipv6Part})?([0-9a-f]+)?(::)?(${zoneIndex})?$`, "i"),
        deprecatedTransitional: new RegExp(`^(?:::)(${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}(${zoneIndex})?)$`, "i"),
        transitional: new RegExp(`^((?:${ipv6Part})|(?:::)(?:${ipv6Part})?)${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}(${zoneIndex})?$`, "i")
      };
      function expandIPv6(string, parts) {
        if (string.indexOf("::") !== string.lastIndexOf("::")) {
          return null;
        }
        let colonCount = 0;
        let lastColon = -1;
        let zoneId = (string.match(ipv6Regexes.zoneIndex) || [])[0];
        let replacement, replacementCount;
        if (zoneId) {
          zoneId = zoneId.substring(1);
          string = string.replace(/%.+$/, "");
        }
        while ((lastColon = string.indexOf(":", lastColon + 1)) >= 0) {
          colonCount++;
        }
        if (string.substr(0, 2) === "::") {
          colonCount--;
        }
        if (string.substr(-2, 2) === "::") {
          colonCount--;
        }
        if (colonCount > parts) {
          return null;
        }
        replacementCount = parts - colonCount;
        replacement = ":";
        while (replacementCount--) {
          replacement += "0:";
        }
        string = string.replace("::", replacement);
        if (string[0] === ":") {
          string = string.slice(1);
        }
        if (string[string.length - 1] === ":") {
          string = string.slice(0, -1);
        }
        parts = function() {
          const ref = string.split(":");
          const results = [];
          for (let i = 0; i < ref.length; i++) {
            results.push(parseInt(ref[i], 16));
          }
          return results;
        }();
        return {
          parts,
          zoneId
        };
      }
      function matchCIDR(first, second, partSize, cidrBits) {
        if (first.length !== second.length) {
          throw new Error("ipaddr: cannot match CIDR for objects with different lengths");
        }
        let part = 0;
        let shift;
        while (cidrBits > 0) {
          shift = partSize - cidrBits;
          if (shift < 0) {
            shift = 0;
          }
          if (first[part] >> shift !== second[part] >> shift) {
            return false;
          }
          cidrBits -= partSize;
          part += 1;
        }
        return true;
      }
      function parseIntAuto(string) {
        if (hexRegex.test(string)) {
          return parseInt(string, 16);
        }
        if (string[0] === "0" && !isNaN(parseInt(string[1], 10))) {
          if (octalRegex.test(string)) {
            return parseInt(string, 8);
          }
          throw new Error(`ipaddr: cannot parse ${string} as octal`);
        }
        return parseInt(string, 10);
      }
      function padPart(part, length) {
        while (part.length < length) {
          part = `0${part}`;
        }
        return part;
      }
      const ipaddr2 = {};
      ipaddr2.IPv4 = function() {
        function IPv4(octets) {
          if (octets.length !== 4) {
            throw new Error("ipaddr: ipv4 octet count should be 4");
          }
          let i, octet;
          for (i = 0; i < octets.length; i++) {
            octet = octets[i];
            if (!(0 <= octet && octet <= 255)) {
              throw new Error("ipaddr: ipv4 octet should fit in 8 bits");
            }
          }
          this.octets = octets;
        }
        IPv4.prototype.SpecialRanges = {
          unspecified: [[new IPv4([0, 0, 0, 0]), 8]],
          broadcast: [[new IPv4([255, 255, 255, 255]), 32]],
          multicast: [[new IPv4([224, 0, 0, 0]), 4]],
          linkLocal: [[new IPv4([169, 254, 0, 0]), 16]],
          loopback: [[new IPv4([127, 0, 0, 0]), 8]],
          carrierGradeNat: [[new IPv4([100, 64, 0, 0]), 10]],
          "private": [
            [new IPv4([10, 0, 0, 0]), 8],
            [new IPv4([172, 16, 0, 0]), 12],
            [new IPv4([192, 168, 0, 0]), 16]
          ],
          reserved: [
            [new IPv4([192, 0, 0, 0]), 24],
            [new IPv4([192, 0, 2, 0]), 24],
            [new IPv4([192, 88, 99, 0]), 24],
            [new IPv4([198, 51, 100, 0]), 24],
            [new IPv4([203, 0, 113, 0]), 24],
            [new IPv4([240, 0, 0, 0]), 4]
          ]
        };
        IPv4.prototype.kind = function() {
          return "ipv4";
        };
        IPv4.prototype.match = function(other, cidrRange) {
          let ref;
          if (cidrRange === void 0) {
            ref = other;
            other = ref[0];
            cidrRange = ref[1];
          }
          if (other.kind() !== "ipv4") {
            throw new Error("ipaddr: cannot match ipv4 address with non-ipv4 one");
          }
          return matchCIDR(this.octets, other.octets, 8, cidrRange);
        };
        IPv4.prototype.prefixLengthFromSubnetMask = function() {
          let cidr = 0;
          let stop = false;
          const zerotable = {
            0: 8,
            128: 7,
            192: 6,
            224: 5,
            240: 4,
            248: 3,
            252: 2,
            254: 1,
            255: 0
          };
          let i, octet, zeros;
          for (i = 3; i >= 0; i -= 1) {
            octet = this.octets[i];
            if (octet in zerotable) {
              zeros = zerotable[octet];
              if (stop && zeros !== 0) {
                return null;
              }
              if (zeros !== 8) {
                stop = true;
              }
              cidr += zeros;
            } else {
              return null;
            }
          }
          return 32 - cidr;
        };
        IPv4.prototype.range = function() {
          return ipaddr2.subnetMatch(this, this.SpecialRanges);
        };
        IPv4.prototype.toByteArray = function() {
          return this.octets.slice(0);
        };
        IPv4.prototype.toIPv4MappedAddress = function() {
          return ipaddr2.IPv6.parse(`::ffff:${this.toString()}`);
        };
        IPv4.prototype.toNormalizedString = function() {
          return this.toString();
        };
        IPv4.prototype.toString = function() {
          return this.octets.join(".");
        };
        return IPv4;
      }();
      ipaddr2.IPv4.broadcastAddressFromCIDR = function(string) {
        try {
          const cidr = this.parseCIDR(string);
          const ipInterfaceOctets = cidr[0].toByteArray();
          const subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
          const octets = [];
          let i = 0;
          while (i < 4) {
            octets.push(parseInt(ipInterfaceOctets[i], 10) | parseInt(subnetMaskOctets[i], 10) ^ 255);
            i++;
          }
          return new this(octets);
        } catch (e) {
          throw new Error("ipaddr: the address does not have IPv4 CIDR format");
        }
      };
      ipaddr2.IPv4.isIPv4 = function(string) {
        return this.parser(string) !== null;
      };
      ipaddr2.IPv4.isValid = function(string) {
        try {
          new this(this.parser(string));
          return true;
        } catch (e) {
          return false;
        }
      };
      ipaddr2.IPv4.isValidFourPartDecimal = function(string) {
        if (ipaddr2.IPv4.isValid(string) && string.match(/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){3}$/)) {
          return true;
        } else {
          return false;
        }
      };
      ipaddr2.IPv4.networkAddressFromCIDR = function(string) {
        let cidr, i, ipInterfaceOctets, octets, subnetMaskOctets;
        try {
          cidr = this.parseCIDR(string);
          ipInterfaceOctets = cidr[0].toByteArray();
          subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
          octets = [];
          i = 0;
          while (i < 4) {
            octets.push(parseInt(ipInterfaceOctets[i], 10) & parseInt(subnetMaskOctets[i], 10));
            i++;
          }
          return new this(octets);
        } catch (e) {
          throw new Error("ipaddr: the address does not have IPv4 CIDR format");
        }
      };
      ipaddr2.IPv4.parse = function(string) {
        const parts = this.parser(string);
        if (parts === null) {
          throw new Error("ipaddr: string is not formatted like an IPv4 Address");
        }
        return new this(parts);
      };
      ipaddr2.IPv4.parseCIDR = function(string) {
        let match;
        if (match = string.match(/^(.+)\/(\d+)$/)) {
          const maskLength = parseInt(match[2]);
          if (maskLength >= 0 && maskLength <= 32) {
            const parsed = [this.parse(match[1]), maskLength];
            Object.defineProperty(parsed, "toString", {
              value: function() {
                return this.join("/");
              }
            });
            return parsed;
          }
        }
        throw new Error("ipaddr: string is not formatted like an IPv4 CIDR range");
      };
      ipaddr2.IPv4.parser = function(string) {
        let match, part, value;
        if (match = string.match(ipv4Regexes.fourOctet)) {
          return function() {
            const ref = match.slice(1, 6);
            const results = [];
            for (let i = 0; i < ref.length; i++) {
              part = ref[i];
              results.push(parseIntAuto(part));
            }
            return results;
          }();
        } else if (match = string.match(ipv4Regexes.longValue)) {
          value = parseIntAuto(match[1]);
          if (value > 4294967295 || value < 0) {
            throw new Error("ipaddr: address outside defined range");
          }
          return function() {
            const results = [];
            let shift;
            for (shift = 0; shift <= 24; shift += 8) {
              results.push(value >> shift & 255);
            }
            return results;
          }().reverse();
        } else if (match = string.match(ipv4Regexes.twoOctet)) {
          return function() {
            const ref = match.slice(1, 4);
            const results = [];
            value = parseIntAuto(ref[1]);
            if (value > 16777215 || value < 0) {
              throw new Error("ipaddr: address outside defined range");
            }
            results.push(parseIntAuto(ref[0]));
            results.push(value >> 16 & 255);
            results.push(value >> 8 & 255);
            results.push(value & 255);
            return results;
          }();
        } else if (match = string.match(ipv4Regexes.threeOctet)) {
          return function() {
            const ref = match.slice(1, 5);
            const results = [];
            value = parseIntAuto(ref[2]);
            if (value > 65535 || value < 0) {
              throw new Error("ipaddr: address outside defined range");
            }
            results.push(parseIntAuto(ref[0]));
            results.push(parseIntAuto(ref[1]));
            results.push(value >> 8 & 255);
            results.push(value & 255);
            return results;
          }();
        } else {
          return null;
        }
      };
      ipaddr2.IPv4.subnetMaskFromPrefixLength = function(prefix) {
        prefix = parseInt(prefix);
        if (prefix < 0 || prefix > 32) {
          throw new Error("ipaddr: invalid IPv4 prefix length");
        }
        const octets = [0, 0, 0, 0];
        let j = 0;
        const filledOctetCount = Math.floor(prefix / 8);
        while (j < filledOctetCount) {
          octets[j] = 255;
          j++;
        }
        if (filledOctetCount < 4) {
          octets[filledOctetCount] = Math.pow(2, prefix % 8) - 1 << 8 - prefix % 8;
        }
        return new this(octets);
      };
      ipaddr2.IPv6 = function() {
        function IPv6(parts, zoneId) {
          let i, part;
          if (parts.length === 16) {
            this.parts = [];
            for (i = 0; i <= 14; i += 2) {
              this.parts.push(parts[i] << 8 | parts[i + 1]);
            }
          } else if (parts.length === 8) {
            this.parts = parts;
          } else {
            throw new Error("ipaddr: ipv6 part count should be 8 or 16");
          }
          for (i = 0; i < this.parts.length; i++) {
            part = this.parts[i];
            if (!(0 <= part && part <= 65535)) {
              throw new Error("ipaddr: ipv6 part should fit in 16 bits");
            }
          }
          if (zoneId) {
            this.zoneId = zoneId;
          }
        }
        IPv6.prototype.SpecialRanges = {
          unspecified: [new IPv6([0, 0, 0, 0, 0, 0, 0, 0]), 128],
          linkLocal: [new IPv6([65152, 0, 0, 0, 0, 0, 0, 0]), 10],
          multicast: [new IPv6([65280, 0, 0, 0, 0, 0, 0, 0]), 8],
          loopback: [new IPv6([0, 0, 0, 0, 0, 0, 0, 1]), 128],
          uniqueLocal: [new IPv6([64512, 0, 0, 0, 0, 0, 0, 0]), 7],
          ipv4Mapped: [new IPv6([0, 0, 0, 0, 0, 65535, 0, 0]), 96],
          rfc6145: [new IPv6([0, 0, 0, 0, 65535, 0, 0, 0]), 96],
          rfc6052: [new IPv6([100, 65435, 0, 0, 0, 0, 0, 0]), 96],
          "6to4": [new IPv6([8194, 0, 0, 0, 0, 0, 0, 0]), 16],
          teredo: [new IPv6([8193, 0, 0, 0, 0, 0, 0, 0]), 32],
          reserved: [[new IPv6([8193, 3512, 0, 0, 0, 0, 0, 0]), 32]]
        };
        IPv6.prototype.isIPv4MappedAddress = function() {
          return this.range() === "ipv4Mapped";
        };
        IPv6.prototype.kind = function() {
          return "ipv6";
        };
        IPv6.prototype.match = function(other, cidrRange) {
          let ref;
          if (cidrRange === void 0) {
            ref = other;
            other = ref[0];
            cidrRange = ref[1];
          }
          if (other.kind() !== "ipv6") {
            throw new Error("ipaddr: cannot match ipv6 address with non-ipv6 one");
          }
          return matchCIDR(this.parts, other.parts, 16, cidrRange);
        };
        IPv6.prototype.prefixLengthFromSubnetMask = function() {
          let cidr = 0;
          let stop = false;
          const zerotable = {
            0: 16,
            32768: 15,
            49152: 14,
            57344: 13,
            61440: 12,
            63488: 11,
            64512: 10,
            65024: 9,
            65280: 8,
            65408: 7,
            65472: 6,
            65504: 5,
            65520: 4,
            65528: 3,
            65532: 2,
            65534: 1,
            65535: 0
          };
          let part, zeros;
          for (let i = 7; i >= 0; i -= 1) {
            part = this.parts[i];
            if (part in zerotable) {
              zeros = zerotable[part];
              if (stop && zeros !== 0) {
                return null;
              }
              if (zeros !== 16) {
                stop = true;
              }
              cidr += zeros;
            } else {
              return null;
            }
          }
          return 128 - cidr;
        };
        IPv6.prototype.range = function() {
          return ipaddr2.subnetMatch(this, this.SpecialRanges);
        };
        IPv6.prototype.toByteArray = function() {
          let part;
          const bytes = [];
          const ref = this.parts;
          for (let i = 0; i < ref.length; i++) {
            part = ref[i];
            bytes.push(part >> 8);
            bytes.push(part & 255);
          }
          return bytes;
        };
        IPv6.prototype.toFixedLengthString = function() {
          const addr = function() {
            const results = [];
            for (let i = 0; i < this.parts.length; i++) {
              results.push(padPart(this.parts[i].toString(16), 4));
            }
            return results;
          }.call(this).join(":");
          let suffix = "";
          if (this.zoneId) {
            suffix = `%${this.zoneId}`;
          }
          return addr + suffix;
        };
        IPv6.prototype.toIPv4Address = function() {
          if (!this.isIPv4MappedAddress()) {
            throw new Error("ipaddr: trying to convert a generic ipv6 address to ipv4");
          }
          const ref = this.parts.slice(-2);
          const high = ref[0];
          const low = ref[1];
          return new ipaddr2.IPv4([high >> 8, high & 255, low >> 8, low & 255]);
        };
        IPv6.prototype.toNormalizedString = function() {
          const addr = function() {
            const results = [];
            for (let i = 0; i < this.parts.length; i++) {
              results.push(this.parts[i].toString(16));
            }
            return results;
          }.call(this).join(":");
          let suffix = "";
          if (this.zoneId) {
            suffix = `%${this.zoneId}`;
          }
          return addr + suffix;
        };
        IPv6.prototype.toRFC5952String = function() {
          const regex = /((^|:)(0(:|$)){2,})/g;
          const string = this.toNormalizedString();
          let bestMatchIndex = 0;
          let bestMatchLength = -1;
          let match;
          while (match = regex.exec(string)) {
            if (match[0].length > bestMatchLength) {
              bestMatchIndex = match.index;
              bestMatchLength = match[0].length;
            }
          }
          if (bestMatchLength < 0) {
            return string;
          }
          return `${string.substring(0, bestMatchIndex)}::${string.substring(bestMatchIndex + bestMatchLength)}`;
        };
        IPv6.prototype.toString = function() {
          return this.toNormalizedString().replace(/((^|:)(0(:|$))+)/, "::");
        };
        return IPv6;
      }();
      ipaddr2.IPv6.broadcastAddressFromCIDR = function(string) {
        try {
          const cidr = this.parseCIDR(string);
          const ipInterfaceOctets = cidr[0].toByteArray();
          const subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
          const octets = [];
          let i = 0;
          while (i < 16) {
            octets.push(parseInt(ipInterfaceOctets[i], 10) | parseInt(subnetMaskOctets[i], 10) ^ 255);
            i++;
          }
          return new this(octets);
        } catch (e) {
          throw new Error(`ipaddr: the address does not have IPv6 CIDR format (${e})`);
        }
      };
      ipaddr2.IPv6.isIPv6 = function(string) {
        return this.parser(string) !== null;
      };
      ipaddr2.IPv6.isValid = function(string) {
        if (typeof string === "string" && string.indexOf(":") === -1) {
          return false;
        }
        try {
          const addr = this.parser(string);
          new this(addr.parts, addr.zoneId);
          return true;
        } catch (e) {
          return false;
        }
      };
      ipaddr2.IPv6.networkAddressFromCIDR = function(string) {
        let cidr, i, ipInterfaceOctets, octets, subnetMaskOctets;
        try {
          cidr = this.parseCIDR(string);
          ipInterfaceOctets = cidr[0].toByteArray();
          subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
          octets = [];
          i = 0;
          while (i < 16) {
            octets.push(parseInt(ipInterfaceOctets[i], 10) & parseInt(subnetMaskOctets[i], 10));
            i++;
          }
          return new this(octets);
        } catch (e) {
          throw new Error(`ipaddr: the address does not have IPv6 CIDR format (${e})`);
        }
      };
      ipaddr2.IPv6.parse = function(string) {
        const addr = this.parser(string);
        if (addr.parts === null) {
          throw new Error("ipaddr: string is not formatted like an IPv6 Address");
        }
        return new this(addr.parts, addr.zoneId);
      };
      ipaddr2.IPv6.parseCIDR = function(string) {
        let maskLength, match, parsed;
        if (match = string.match(/^(.+)\/(\d+)$/)) {
          maskLength = parseInt(match[2]);
          if (maskLength >= 0 && maskLength <= 128) {
            parsed = [this.parse(match[1]), maskLength];
            Object.defineProperty(parsed, "toString", {
              value: function() {
                return this.join("/");
              }
            });
            return parsed;
          }
        }
        throw new Error("ipaddr: string is not formatted like an IPv6 CIDR range");
      };
      ipaddr2.IPv6.parser = function(string) {
        let addr, i, match, octet, octets, zoneId;
        if (match = string.match(ipv6Regexes.deprecatedTransitional)) {
          return this.parser(`::ffff:${match[1]}`);
        }
        if (ipv6Regexes.native.test(string)) {
          return expandIPv6(string, 8);
        }
        if (match = string.match(ipv6Regexes.transitional)) {
          zoneId = match[6] || "";
          addr = expandIPv6(match[1].slice(0, -1) + zoneId, 6);
          if (addr.parts) {
            octets = [
              parseInt(match[2]),
              parseInt(match[3]),
              parseInt(match[4]),
              parseInt(match[5])
            ];
            for (i = 0; i < octets.length; i++) {
              octet = octets[i];
              if (!(0 <= octet && octet <= 255)) {
                return null;
              }
            }
            addr.parts.push(octets[0] << 8 | octets[1]);
            addr.parts.push(octets[2] << 8 | octets[3]);
            return {
              parts: addr.parts,
              zoneId: addr.zoneId
            };
          }
        }
        return null;
      };
      ipaddr2.IPv6.subnetMaskFromPrefixLength = function(prefix) {
        prefix = parseInt(prefix);
        if (prefix < 0 || prefix > 128) {
          throw new Error("ipaddr: invalid IPv6 prefix length");
        }
        const octets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        let j = 0;
        const filledOctetCount = Math.floor(prefix / 8);
        while (j < filledOctetCount) {
          octets[j] = 255;
          j++;
        }
        if (filledOctetCount < 16) {
          octets[filledOctetCount] = Math.pow(2, prefix % 8) - 1 << 8 - prefix % 8;
        }
        return new this(octets);
      };
      ipaddr2.fromByteArray = function(bytes) {
        const length = bytes.length;
        if (length === 4) {
          return new ipaddr2.IPv4(bytes);
        } else if (length === 16) {
          return new ipaddr2.IPv6(bytes);
        } else {
          throw new Error("ipaddr: the binary input is neither an IPv6 nor IPv4 address");
        }
      };
      ipaddr2.isValid = function(string) {
        return ipaddr2.IPv6.isValid(string) || ipaddr2.IPv4.isValid(string);
      };
      ipaddr2.parse = function(string) {
        if (ipaddr2.IPv6.isValid(string)) {
          return ipaddr2.IPv6.parse(string);
        } else if (ipaddr2.IPv4.isValid(string)) {
          return ipaddr2.IPv4.parse(string);
        } else {
          throw new Error("ipaddr: the address has neither IPv6 nor IPv4 format");
        }
      };
      ipaddr2.parseCIDR = function(string) {
        try {
          return ipaddr2.IPv6.parseCIDR(string);
        } catch (e) {
          try {
            return ipaddr2.IPv4.parseCIDR(string);
          } catch (e2) {
            throw new Error("ipaddr: the address has neither IPv6 nor IPv4 CIDR format");
          }
        }
      };
      ipaddr2.process = function(string) {
        const addr = this.parse(string);
        if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) {
          return addr.toIPv4Address();
        } else {
          return addr;
        }
      };
      ipaddr2.subnetMatch = function(address, rangeList, defaultName) {
        let i, rangeName, rangeSubnets, subnet;
        if (defaultName === void 0 || defaultName === null) {
          defaultName = "unicast";
        }
        for (rangeName in rangeList) {
          if (Object.prototype.hasOwnProperty.call(rangeList, rangeName)) {
            rangeSubnets = rangeList[rangeName];
            if (rangeSubnets[0] && !(rangeSubnets[0] instanceof Array)) {
              rangeSubnets = [rangeSubnets];
            }
            for (i = 0; i < rangeSubnets.length; i++) {
              subnet = rangeSubnets[i];
              if (address.kind() === subnet[0].kind() && address.match.apply(address, subnet)) {
                return rangeName;
              }
            }
          }
        }
        return defaultName;
      };
      if (typeof module2 !== "undefined" && module2.exports) {
        module2.exports = ipaddr2;
      } else {
        root2.ipaddr = ipaddr2;
      }
    })(exports2);
  }
});

// node_modules/path-browserify/index.js
var require_path_browserify = __commonJS({
  "node_modules/path-browserify/index.js"(exports2, module2) {
    "use strict";
    function assertPath(path2) {
      if (typeof path2 !== "string") {
        throw new TypeError("Path must be a string. Received " + JSON.stringify(path2));
      }
    }
    function normalizeStringPosix(path2, allowAboveRoot) {
      var res = "";
      var lastSegmentLength = 0;
      var lastSlash = -1;
      var dots = 0;
      var code;
      for (var i = 0; i <= path2.length; ++i) {
        if (i < path2.length)
          code = path2.charCodeAt(i);
        else if (code === 47)
          break;
        else
          code = 47;
        if (code === 47) {
          if (lastSlash === i - 1 || dots === 1) {
          } else if (lastSlash !== i - 1 && dots === 2) {
            if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 || res.charCodeAt(res.length - 2) !== 46) {
              if (res.length > 2) {
                var lastSlashIndex = res.lastIndexOf("/");
                if (lastSlashIndex !== res.length - 1) {
                  if (lastSlashIndex === -1) {
                    res = "";
                    lastSegmentLength = 0;
                  } else {
                    res = res.slice(0, lastSlashIndex);
                    lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
                  }
                  lastSlash = i;
                  dots = 0;
                  continue;
                }
              } else if (res.length === 2 || res.length === 1) {
                res = "";
                lastSegmentLength = 0;
                lastSlash = i;
                dots = 0;
                continue;
              }
            }
            if (allowAboveRoot) {
              if (res.length > 0)
                res += "/..";
              else
                res = "..";
              lastSegmentLength = 2;
            }
          } else {
            if (res.length > 0)
              res += "/" + path2.slice(lastSlash + 1, i);
            else
              res = path2.slice(lastSlash + 1, i);
            lastSegmentLength = i - lastSlash - 1;
          }
          lastSlash = i;
          dots = 0;
        } else if (code === 46 && dots !== -1) {
          ++dots;
        } else {
          dots = -1;
        }
      }
      return res;
    }
    function _format(sep, pathObject) {
      var dir = pathObject.dir || pathObject.root;
      var base = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
      if (!dir) {
        return base;
      }
      if (dir === pathObject.root) {
        return dir + base;
      }
      return dir + sep + base;
    }
    var posix = {
      resolve: function resolve() {
        var resolvedPath = "";
        var resolvedAbsolute = false;
        var cwd;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path2;
          if (i >= 0)
            path2 = arguments[i];
          else {
            if (cwd === void 0)
              cwd = process.cwd();
            path2 = cwd;
          }
          assertPath(path2);
          if (path2.length === 0) {
            continue;
          }
          resolvedPath = path2 + "/" + resolvedPath;
          resolvedAbsolute = path2.charCodeAt(0) === 47;
        }
        resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute);
        if (resolvedAbsolute) {
          if (resolvedPath.length > 0)
            return "/" + resolvedPath;
          else
            return "/";
        } else if (resolvedPath.length > 0) {
          return resolvedPath;
        } else {
          return ".";
        }
      },
      normalize: function normalize(path2) {
        assertPath(path2);
        if (path2.length === 0)
          return ".";
        var isAbsolute = path2.charCodeAt(0) === 47;
        var trailingSeparator = path2.charCodeAt(path2.length - 1) === 47;
        path2 = normalizeStringPosix(path2, !isAbsolute);
        if (path2.length === 0 && !isAbsolute)
          path2 = ".";
        if (path2.length > 0 && trailingSeparator)
          path2 += "/";
        if (isAbsolute)
          return "/" + path2;
        return path2;
      },
      isAbsolute: function isAbsolute(path2) {
        assertPath(path2);
        return path2.length > 0 && path2.charCodeAt(0) === 47;
      },
      join: function join() {
        if (arguments.length === 0)
          return ".";
        var joined;
        for (var i = 0; i < arguments.length; ++i) {
          var arg = arguments[i];
          assertPath(arg);
          if (arg.length > 0) {
            if (joined === void 0)
              joined = arg;
            else
              joined += "/" + arg;
          }
        }
        if (joined === void 0)
          return ".";
        return posix.normalize(joined);
      },
      relative: function relative(from, to) {
        assertPath(from);
        assertPath(to);
        if (from === to)
          return "";
        from = posix.resolve(from);
        to = posix.resolve(to);
        if (from === to)
          return "";
        var fromStart = 1;
        for (; fromStart < from.length; ++fromStart) {
          if (from.charCodeAt(fromStart) !== 47)
            break;
        }
        var fromEnd = from.length;
        var fromLen = fromEnd - fromStart;
        var toStart = 1;
        for (; toStart < to.length; ++toStart) {
          if (to.charCodeAt(toStart) !== 47)
            break;
        }
        var toEnd = to.length;
        var toLen = toEnd - toStart;
        var length = fromLen < toLen ? fromLen : toLen;
        var lastCommonSep = -1;
        var i = 0;
        for (; i <= length; ++i) {
          if (i === length) {
            if (toLen > length) {
              if (to.charCodeAt(toStart + i) === 47) {
                return to.slice(toStart + i + 1);
              } else if (i === 0) {
                return to.slice(toStart + i);
              }
            } else if (fromLen > length) {
              if (from.charCodeAt(fromStart + i) === 47) {
                lastCommonSep = i;
              } else if (i === 0) {
                lastCommonSep = 0;
              }
            }
            break;
          }
          var fromCode = from.charCodeAt(fromStart + i);
          var toCode = to.charCodeAt(toStart + i);
          if (fromCode !== toCode)
            break;
          else if (fromCode === 47)
            lastCommonSep = i;
        }
        var out = "";
        for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
          if (i === fromEnd || from.charCodeAt(i) === 47) {
            if (out.length === 0)
              out += "..";
            else
              out += "/..";
          }
        }
        if (out.length > 0)
          return out + to.slice(toStart + lastCommonSep);
        else {
          toStart += lastCommonSep;
          if (to.charCodeAt(toStart) === 47)
            ++toStart;
          return to.slice(toStart);
        }
      },
      _makeLong: function _makeLong(path2) {
        return path2;
      },
      dirname: function dirname(path2) {
        assertPath(path2);
        if (path2.length === 0)
          return ".";
        var code = path2.charCodeAt(0);
        var hasRoot = code === 47;
        var end = -1;
        var matchedSlash = true;
        for (var i = path2.length - 1; i >= 1; --i) {
          code = path2.charCodeAt(i);
          if (code === 47) {
            if (!matchedSlash) {
              end = i;
              break;
            }
          } else {
            matchedSlash = false;
          }
        }
        if (end === -1)
          return hasRoot ? "/" : ".";
        if (hasRoot && end === 1)
          return "//";
        return path2.slice(0, end);
      },
      basename: function basename(path2, ext) {
        if (ext !== void 0 && typeof ext !== "string")
          throw new TypeError('"ext" argument must be a string');
        assertPath(path2);
        var start = 0;
        var end = -1;
        var matchedSlash = true;
        var i;
        if (ext !== void 0 && ext.length > 0 && ext.length <= path2.length) {
          if (ext.length === path2.length && ext === path2)
            return "";
          var extIdx = ext.length - 1;
          var firstNonSlashEnd = -1;
          for (i = path2.length - 1; i >= 0; --i) {
            var code = path2.charCodeAt(i);
            if (code === 47) {
              if (!matchedSlash) {
                start = i + 1;
                break;
              }
            } else {
              if (firstNonSlashEnd === -1) {
                matchedSlash = false;
                firstNonSlashEnd = i + 1;
              }
              if (extIdx >= 0) {
                if (code === ext.charCodeAt(extIdx)) {
                  if (--extIdx === -1) {
                    end = i;
                  }
                } else {
                  extIdx = -1;
                  end = firstNonSlashEnd;
                }
              }
            }
          }
          if (start === end)
            end = firstNonSlashEnd;
          else if (end === -1)
            end = path2.length;
          return path2.slice(start, end);
        } else {
          for (i = path2.length - 1; i >= 0; --i) {
            if (path2.charCodeAt(i) === 47) {
              if (!matchedSlash) {
                start = i + 1;
                break;
              }
            } else if (end === -1) {
              matchedSlash = false;
              end = i + 1;
            }
          }
          if (end === -1)
            return "";
          return path2.slice(start, end);
        }
      },
      extname: function extname(path2) {
        assertPath(path2);
        var startDot = -1;
        var startPart = 0;
        var end = -1;
        var matchedSlash = true;
        var preDotState = 0;
        for (var i = path2.length - 1; i >= 0; --i) {
          var code = path2.charCodeAt(i);
          if (code === 47) {
            if (!matchedSlash) {
              startPart = i + 1;
              break;
            }
            continue;
          }
          if (end === -1) {
            matchedSlash = false;
            end = i + 1;
          }
          if (code === 46) {
            if (startDot === -1)
              startDot = i;
            else if (preDotState !== 1)
              preDotState = 1;
          } else if (startDot !== -1) {
            preDotState = -1;
          }
        }
        if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
          return "";
        }
        return path2.slice(startDot, end);
      },
      format: function format(pathObject) {
        if (pathObject === null || typeof pathObject !== "object") {
          throw new TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof pathObject);
        }
        return _format("/", pathObject);
      },
      parse: function parse2(path2) {
        assertPath(path2);
        var ret = { root: "", dir: "", base: "", ext: "", name: "" };
        if (path2.length === 0)
          return ret;
        var code = path2.charCodeAt(0);
        var isAbsolute = code === 47;
        var start;
        if (isAbsolute) {
          ret.root = "/";
          start = 1;
        } else {
          start = 0;
        }
        var startDot = -1;
        var startPart = 0;
        var end = -1;
        var matchedSlash = true;
        var i = path2.length - 1;
        var preDotState = 0;
        for (; i >= start; --i) {
          code = path2.charCodeAt(i);
          if (code === 47) {
            if (!matchedSlash) {
              startPart = i + 1;
              break;
            }
            continue;
          }
          if (end === -1) {
            matchedSlash = false;
            end = i + 1;
          }
          if (code === 46) {
            if (startDot === -1)
              startDot = i;
            else if (preDotState !== 1)
              preDotState = 1;
          } else if (startDot !== -1) {
            preDotState = -1;
          }
        }
        if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
          if (end !== -1) {
            if (startPart === 0 && isAbsolute)
              ret.base = ret.name = path2.slice(1, end);
            else
              ret.base = ret.name = path2.slice(startPart, end);
          }
        } else {
          if (startPart === 0 && isAbsolute) {
            ret.name = path2.slice(1, startDot);
            ret.base = path2.slice(1, end);
          } else {
            ret.name = path2.slice(startPart, startDot);
            ret.base = path2.slice(startPart, end);
          }
          ret.ext = path2.slice(startDot, end);
        }
        if (startPart > 0)
          ret.dir = path2.slice(0, startPart - 1);
        else if (isAbsolute)
          ret.dir = "/";
        return ret;
      },
      sep: "/",
      delimiter: ":",
      win32: null,
      posix: null
    };
    posix.posix = posix;
    module2.exports = posix;
  }
});

// node_modules/js-md5/src/md5.js
var require_md5 = __commonJS({
  "node_modules/js-md5/src/md5.js"(exports, module) {
    (function() {
      "use strict";
      var ERROR = "input is invalid type";
      var WINDOW = typeof window === "object";
      var root = WINDOW ? window : {};
      if (root.JS_MD5_NO_WINDOW) {
        WINDOW = false;
      }
      var WEB_WORKER = !WINDOW && typeof self === "object";
      var NODE_JS = !root.JS_MD5_NO_NODE_JS && typeof process === "object" && process.versions && process.versions.node;
      if (NODE_JS) {
        root = global;
      } else if (WEB_WORKER) {
        root = self;
      }
      var COMMON_JS = !root.JS_MD5_NO_COMMON_JS && typeof module === "object" && module.exports;
      var AMD = typeof define === "function" && define.amd;
      var ARRAY_BUFFER = !root.JS_MD5_NO_ARRAY_BUFFER && typeof ArrayBuffer !== "undefined";
      var HEX_CHARS = "0123456789abcdef".split("");
      var EXTRA = [128, 32768, 8388608, -2147483648];
      var SHIFT = [0, 8, 16, 24];
      var OUTPUT_TYPES = ["hex", "array", "digest", "buffer", "arrayBuffer", "base64"];
      var BASE64_ENCODE_CHAR = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
      var blocks = [], buffer8;
      if (ARRAY_BUFFER) {
        var buffer = new ArrayBuffer(68);
        buffer8 = new Uint8Array(buffer);
        blocks = new Uint32Array(buffer);
      }
      if (root.JS_MD5_NO_NODE_JS || !Array.isArray) {
        Array.isArray = function(obj) {
          return Object.prototype.toString.call(obj) === "[object Array]";
        };
      }
      if (ARRAY_BUFFER && (root.JS_MD5_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView)) {
        ArrayBuffer.isView = function(obj) {
          return typeof obj === "object" && obj.buffer && obj.buffer.constructor === ArrayBuffer;
        };
      }
      var createOutputMethod = function(outputType) {
        return function(message) {
          return new Md5(true).update(message)[outputType]();
        };
      };
      var createMethod = function() {
        var method2 = createOutputMethod("hex");
        if (NODE_JS) {
          method2 = nodeWrap(method2);
        }
        method2.create = function() {
          return new Md5();
        };
        method2.update = function(message) {
          return method2.create().update(message);
        };
        for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
          var type = OUTPUT_TYPES[i];
          method2[type] = createOutputMethod(type);
        }
        return method2;
      };
      var nodeWrap = function(method) {
        var crypto = eval("require('crypto')");
        var Buffer = eval("require('buffer').Buffer");
        var nodeMethod = function(message) {
          if (typeof message === "string") {
            return crypto.createHash("md5").update(message, "utf8").digest("hex");
          } else {
            if (message === null || message === void 0) {
              throw ERROR;
            } else if (message.constructor === ArrayBuffer) {
              message = new Uint8Array(message);
            }
          }
          if (Array.isArray(message) || ArrayBuffer.isView(message) || message.constructor === Buffer) {
            return crypto.createHash("md5").update(new Buffer(message)).digest("hex");
          } else {
            return method(message);
          }
        };
        return nodeMethod;
      };
      function Md5(sharedMemory) {
        if (sharedMemory) {
          blocks[0] = blocks[16] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
          this.blocks = blocks;
          this.buffer8 = buffer8;
        } else {
          if (ARRAY_BUFFER) {
            var buffer2 = new ArrayBuffer(68);
            this.buffer8 = new Uint8Array(buffer2);
            this.blocks = new Uint32Array(buffer2);
          } else {
            this.blocks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          }
        }
        this.h0 = this.h1 = this.h2 = this.h3 = this.start = this.bytes = this.hBytes = 0;
        this.finalized = this.hashed = false;
        this.first = true;
      }
      Md5.prototype.update = function(message) {
        if (this.finalized) {
          return;
        }
        var notString, type = typeof message;
        if (type !== "string") {
          if (type === "object") {
            if (message === null) {
              throw ERROR;
            } else if (ARRAY_BUFFER && message.constructor === ArrayBuffer) {
              message = new Uint8Array(message);
            } else if (!Array.isArray(message)) {
              if (!ARRAY_BUFFER || !ArrayBuffer.isView(message)) {
                throw ERROR;
              }
            }
          } else {
            throw ERROR;
          }
          notString = true;
        }
        var code, index = 0, i, length = message.length, blocks2 = this.blocks;
        var buffer82 = this.buffer8;
        while (index < length) {
          if (this.hashed) {
            this.hashed = false;
            blocks2[0] = blocks2[16];
            blocks2[16] = blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = 0;
          }
          if (notString) {
            if (ARRAY_BUFFER) {
              for (i = this.start; index < length && i < 64; ++index) {
                buffer82[i++] = message[index];
              }
            } else {
              for (i = this.start; index < length && i < 64; ++index) {
                blocks2[i >> 2] |= message[index] << SHIFT[i++ & 3];
              }
            }
          } else {
            if (ARRAY_BUFFER) {
              for (i = this.start; index < length && i < 64; ++index) {
                code = message.charCodeAt(index);
                if (code < 128) {
                  buffer82[i++] = code;
                } else if (code < 2048) {
                  buffer82[i++] = 192 | code >> 6;
                  buffer82[i++] = 128 | code & 63;
                } else if (code < 55296 || code >= 57344) {
                  buffer82[i++] = 224 | code >> 12;
                  buffer82[i++] = 128 | code >> 6 & 63;
                  buffer82[i++] = 128 | code & 63;
                } else {
                  code = 65536 + ((code & 1023) << 10 | message.charCodeAt(++index) & 1023);
                  buffer82[i++] = 240 | code >> 18;
                  buffer82[i++] = 128 | code >> 12 & 63;
                  buffer82[i++] = 128 | code >> 6 & 63;
                  buffer82[i++] = 128 | code & 63;
                }
              }
            } else {
              for (i = this.start; index < length && i < 64; ++index) {
                code = message.charCodeAt(index);
                if (code < 128) {
                  blocks2[i >> 2] |= code << SHIFT[i++ & 3];
                } else if (code < 2048) {
                  blocks2[i >> 2] |= (192 | code >> 6) << SHIFT[i++ & 3];
                  blocks2[i >> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
                } else if (code < 55296 || code >= 57344) {
                  blocks2[i >> 2] |= (224 | code >> 12) << SHIFT[i++ & 3];
                  blocks2[i >> 2] |= (128 | code >> 6 & 63) << SHIFT[i++ & 3];
                  blocks2[i >> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
                } else {
                  code = 65536 + ((code & 1023) << 10 | message.charCodeAt(++index) & 1023);
                  blocks2[i >> 2] |= (240 | code >> 18) << SHIFT[i++ & 3];
                  blocks2[i >> 2] |= (128 | code >> 12 & 63) << SHIFT[i++ & 3];
                  blocks2[i >> 2] |= (128 | code >> 6 & 63) << SHIFT[i++ & 3];
                  blocks2[i >> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
                }
              }
            }
          }
          this.lastByteIndex = i;
          this.bytes += i - this.start;
          if (i >= 64) {
            this.start = i - 64;
            this.hash();
            this.hashed = true;
          } else {
            this.start = i;
          }
        }
        if (this.bytes > 4294967295) {
          this.hBytes += this.bytes / 4294967296 << 0;
          this.bytes = this.bytes % 4294967296;
        }
        return this;
      };
      Md5.prototype.finalize = function() {
        if (this.finalized) {
          return;
        }
        this.finalized = true;
        var blocks2 = this.blocks, i = this.lastByteIndex;
        blocks2[i >> 2] |= EXTRA[i & 3];
        if (i >= 56) {
          if (!this.hashed) {
            this.hash();
          }
          blocks2[0] = blocks2[16];
          blocks2[16] = blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = 0;
        }
        blocks2[14] = this.bytes << 3;
        blocks2[15] = this.hBytes << 3 | this.bytes >>> 29;
        this.hash();
      };
      Md5.prototype.hash = function() {
        var a, b, c, d, bc, da, blocks2 = this.blocks;
        if (this.first) {
          a = blocks2[0] - 680876937;
          a = (a << 7 | a >>> 25) - 271733879 << 0;
          d = (-1732584194 ^ a & 2004318071) + blocks2[1] - 117830708;
          d = (d << 12 | d >>> 20) + a << 0;
          c = (-271733879 ^ d & (a ^ -271733879)) + blocks2[2] - 1126478375;
          c = (c << 17 | c >>> 15) + d << 0;
          b = (a ^ c & (d ^ a)) + blocks2[3] - 1316259209;
          b = (b << 22 | b >>> 10) + c << 0;
        } else {
          a = this.h0;
          b = this.h1;
          c = this.h2;
          d = this.h3;
          a += (d ^ b & (c ^ d)) + blocks2[0] - 680876936;
          a = (a << 7 | a >>> 25) + b << 0;
          d += (c ^ a & (b ^ c)) + blocks2[1] - 389564586;
          d = (d << 12 | d >>> 20) + a << 0;
          c += (b ^ d & (a ^ b)) + blocks2[2] + 606105819;
          c = (c << 17 | c >>> 15) + d << 0;
          b += (a ^ c & (d ^ a)) + blocks2[3] - 1044525330;
          b = (b << 22 | b >>> 10) + c << 0;
        }
        a += (d ^ b & (c ^ d)) + blocks2[4] - 176418897;
        a = (a << 7 | a >>> 25) + b << 0;
        d += (c ^ a & (b ^ c)) + blocks2[5] + 1200080426;
        d = (d << 12 | d >>> 20) + a << 0;
        c += (b ^ d & (a ^ b)) + blocks2[6] - 1473231341;
        c = (c << 17 | c >>> 15) + d << 0;
        b += (a ^ c & (d ^ a)) + blocks2[7] - 45705983;
        b = (b << 22 | b >>> 10) + c << 0;
        a += (d ^ b & (c ^ d)) + blocks2[8] + 1770035416;
        a = (a << 7 | a >>> 25) + b << 0;
        d += (c ^ a & (b ^ c)) + blocks2[9] - 1958414417;
        d = (d << 12 | d >>> 20) + a << 0;
        c += (b ^ d & (a ^ b)) + blocks2[10] - 42063;
        c = (c << 17 | c >>> 15) + d << 0;
        b += (a ^ c & (d ^ a)) + blocks2[11] - 1990404162;
        b = (b << 22 | b >>> 10) + c << 0;
        a += (d ^ b & (c ^ d)) + blocks2[12] + 1804603682;
        a = (a << 7 | a >>> 25) + b << 0;
        d += (c ^ a & (b ^ c)) + blocks2[13] - 40341101;
        d = (d << 12 | d >>> 20) + a << 0;
        c += (b ^ d & (a ^ b)) + blocks2[14] - 1502002290;
        c = (c << 17 | c >>> 15) + d << 0;
        b += (a ^ c & (d ^ a)) + blocks2[15] + 1236535329;
        b = (b << 22 | b >>> 10) + c << 0;
        a += (c ^ d & (b ^ c)) + blocks2[1] - 165796510;
        a = (a << 5 | a >>> 27) + b << 0;
        d += (b ^ c & (a ^ b)) + blocks2[6] - 1069501632;
        d = (d << 9 | d >>> 23) + a << 0;
        c += (a ^ b & (d ^ a)) + blocks2[11] + 643717713;
        c = (c << 14 | c >>> 18) + d << 0;
        b += (d ^ a & (c ^ d)) + blocks2[0] - 373897302;
        b = (b << 20 | b >>> 12) + c << 0;
        a += (c ^ d & (b ^ c)) + blocks2[5] - 701558691;
        a = (a << 5 | a >>> 27) + b << 0;
        d += (b ^ c & (a ^ b)) + blocks2[10] + 38016083;
        d = (d << 9 | d >>> 23) + a << 0;
        c += (a ^ b & (d ^ a)) + blocks2[15] - 660478335;
        c = (c << 14 | c >>> 18) + d << 0;
        b += (d ^ a & (c ^ d)) + blocks2[4] - 405537848;
        b = (b << 20 | b >>> 12) + c << 0;
        a += (c ^ d & (b ^ c)) + blocks2[9] + 568446438;
        a = (a << 5 | a >>> 27) + b << 0;
        d += (b ^ c & (a ^ b)) + blocks2[14] - 1019803690;
        d = (d << 9 | d >>> 23) + a << 0;
        c += (a ^ b & (d ^ a)) + blocks2[3] - 187363961;
        c = (c << 14 | c >>> 18) + d << 0;
        b += (d ^ a & (c ^ d)) + blocks2[8] + 1163531501;
        b = (b << 20 | b >>> 12) + c << 0;
        a += (c ^ d & (b ^ c)) + blocks2[13] - 1444681467;
        a = (a << 5 | a >>> 27) + b << 0;
        d += (b ^ c & (a ^ b)) + blocks2[2] - 51403784;
        d = (d << 9 | d >>> 23) + a << 0;
        c += (a ^ b & (d ^ a)) + blocks2[7] + 1735328473;
        c = (c << 14 | c >>> 18) + d << 0;
        b += (d ^ a & (c ^ d)) + blocks2[12] - 1926607734;
        b = (b << 20 | b >>> 12) + c << 0;
        bc = b ^ c;
        a += (bc ^ d) + blocks2[5] - 378558;
        a = (a << 4 | a >>> 28) + b << 0;
        d += (bc ^ a) + blocks2[8] - 2022574463;
        d = (d << 11 | d >>> 21) + a << 0;
        da = d ^ a;
        c += (da ^ b) + blocks2[11] + 1839030562;
        c = (c << 16 | c >>> 16) + d << 0;
        b += (da ^ c) + blocks2[14] - 35309556;
        b = (b << 23 | b >>> 9) + c << 0;
        bc = b ^ c;
        a += (bc ^ d) + blocks2[1] - 1530992060;
        a = (a << 4 | a >>> 28) + b << 0;
        d += (bc ^ a) + blocks2[4] + 1272893353;
        d = (d << 11 | d >>> 21) + a << 0;
        da = d ^ a;
        c += (da ^ b) + blocks2[7] - 155497632;
        c = (c << 16 | c >>> 16) + d << 0;
        b += (da ^ c) + blocks2[10] - 1094730640;
        b = (b << 23 | b >>> 9) + c << 0;
        bc = b ^ c;
        a += (bc ^ d) + blocks2[13] + 681279174;
        a = (a << 4 | a >>> 28) + b << 0;
        d += (bc ^ a) + blocks2[0] - 358537222;
        d = (d << 11 | d >>> 21) + a << 0;
        da = d ^ a;
        c += (da ^ b) + blocks2[3] - 722521979;
        c = (c << 16 | c >>> 16) + d << 0;
        b += (da ^ c) + blocks2[6] + 76029189;
        b = (b << 23 | b >>> 9) + c << 0;
        bc = b ^ c;
        a += (bc ^ d) + blocks2[9] - 640364487;
        a = (a << 4 | a >>> 28) + b << 0;
        d += (bc ^ a) + blocks2[12] - 421815835;
        d = (d << 11 | d >>> 21) + a << 0;
        da = d ^ a;
        c += (da ^ b) + blocks2[15] + 530742520;
        c = (c << 16 | c >>> 16) + d << 0;
        b += (da ^ c) + blocks2[2] - 995338651;
        b = (b << 23 | b >>> 9) + c << 0;
        a += (c ^ (b | ~d)) + blocks2[0] - 198630844;
        a = (a << 6 | a >>> 26) + b << 0;
        d += (b ^ (a | ~c)) + blocks2[7] + 1126891415;
        d = (d << 10 | d >>> 22) + a << 0;
        c += (a ^ (d | ~b)) + blocks2[14] - 1416354905;
        c = (c << 15 | c >>> 17) + d << 0;
        b += (d ^ (c | ~a)) + blocks2[5] - 57434055;
        b = (b << 21 | b >>> 11) + c << 0;
        a += (c ^ (b | ~d)) + blocks2[12] + 1700485571;
        a = (a << 6 | a >>> 26) + b << 0;
        d += (b ^ (a | ~c)) + blocks2[3] - 1894986606;
        d = (d << 10 | d >>> 22) + a << 0;
        c += (a ^ (d | ~b)) + blocks2[10] - 1051523;
        c = (c << 15 | c >>> 17) + d << 0;
        b += (d ^ (c | ~a)) + blocks2[1] - 2054922799;
        b = (b << 21 | b >>> 11) + c << 0;
        a += (c ^ (b | ~d)) + blocks2[8] + 1873313359;
        a = (a << 6 | a >>> 26) + b << 0;
        d += (b ^ (a | ~c)) + blocks2[15] - 30611744;
        d = (d << 10 | d >>> 22) + a << 0;
        c += (a ^ (d | ~b)) + blocks2[6] - 1560198380;
        c = (c << 15 | c >>> 17) + d << 0;
        b += (d ^ (c | ~a)) + blocks2[13] + 1309151649;
        b = (b << 21 | b >>> 11) + c << 0;
        a += (c ^ (b | ~d)) + blocks2[4] - 145523070;
        a = (a << 6 | a >>> 26) + b << 0;
        d += (b ^ (a | ~c)) + blocks2[11] - 1120210379;
        d = (d << 10 | d >>> 22) + a << 0;
        c += (a ^ (d | ~b)) + blocks2[2] + 718787259;
        c = (c << 15 | c >>> 17) + d << 0;
        b += (d ^ (c | ~a)) + blocks2[9] - 343485551;
        b = (b << 21 | b >>> 11) + c << 0;
        if (this.first) {
          this.h0 = a + 1732584193 << 0;
          this.h1 = b - 271733879 << 0;
          this.h2 = c - 1732584194 << 0;
          this.h3 = d + 271733878 << 0;
          this.first = false;
        } else {
          this.h0 = this.h0 + a << 0;
          this.h1 = this.h1 + b << 0;
          this.h2 = this.h2 + c << 0;
          this.h3 = this.h3 + d << 0;
        }
      };
      Md5.prototype.hex = function() {
        this.finalize();
        var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3;
        return HEX_CHARS[h0 >> 4 & 15] + HEX_CHARS[h0 & 15] + HEX_CHARS[h0 >> 12 & 15] + HEX_CHARS[h0 >> 8 & 15] + HEX_CHARS[h0 >> 20 & 15] + HEX_CHARS[h0 >> 16 & 15] + HEX_CHARS[h0 >> 28 & 15] + HEX_CHARS[h0 >> 24 & 15] + HEX_CHARS[h1 >> 4 & 15] + HEX_CHARS[h1 & 15] + HEX_CHARS[h1 >> 12 & 15] + HEX_CHARS[h1 >> 8 & 15] + HEX_CHARS[h1 >> 20 & 15] + HEX_CHARS[h1 >> 16 & 15] + HEX_CHARS[h1 >> 28 & 15] + HEX_CHARS[h1 >> 24 & 15] + HEX_CHARS[h2 >> 4 & 15] + HEX_CHARS[h2 & 15] + HEX_CHARS[h2 >> 12 & 15] + HEX_CHARS[h2 >> 8 & 15] + HEX_CHARS[h2 >> 20 & 15] + HEX_CHARS[h2 >> 16 & 15] + HEX_CHARS[h2 >> 28 & 15] + HEX_CHARS[h2 >> 24 & 15] + HEX_CHARS[h3 >> 4 & 15] + HEX_CHARS[h3 & 15] + HEX_CHARS[h3 >> 12 & 15] + HEX_CHARS[h3 >> 8 & 15] + HEX_CHARS[h3 >> 20 & 15] + HEX_CHARS[h3 >> 16 & 15] + HEX_CHARS[h3 >> 28 & 15] + HEX_CHARS[h3 >> 24 & 15];
      };
      Md5.prototype.toString = Md5.prototype.hex;
      Md5.prototype.digest = function() {
        this.finalize();
        var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3;
        return [
          h0 & 255,
          h0 >> 8 & 255,
          h0 >> 16 & 255,
          h0 >> 24 & 255,
          h1 & 255,
          h1 >> 8 & 255,
          h1 >> 16 & 255,
          h1 >> 24 & 255,
          h2 & 255,
          h2 >> 8 & 255,
          h2 >> 16 & 255,
          h2 >> 24 & 255,
          h3 & 255,
          h3 >> 8 & 255,
          h3 >> 16 & 255,
          h3 >> 24 & 255
        ];
      };
      Md5.prototype.array = Md5.prototype.digest;
      Md5.prototype.arrayBuffer = function() {
        this.finalize();
        var buffer2 = new ArrayBuffer(16);
        var blocks2 = new Uint32Array(buffer2);
        blocks2[0] = this.h0;
        blocks2[1] = this.h1;
        blocks2[2] = this.h2;
        blocks2[3] = this.h3;
        return buffer2;
      };
      Md5.prototype.buffer = Md5.prototype.arrayBuffer;
      Md5.prototype.base64 = function() {
        var v12, v2, v32, base64Str = "", bytes = this.array();
        for (var i = 0; i < 15; ) {
          v12 = bytes[i++];
          v2 = bytes[i++];
          v32 = bytes[i++];
          base64Str += BASE64_ENCODE_CHAR[v12 >>> 2] + BASE64_ENCODE_CHAR[(v12 << 4 | v2 >>> 4) & 63] + BASE64_ENCODE_CHAR[(v2 << 2 | v32 >>> 6) & 63] + BASE64_ENCODE_CHAR[v32 & 63];
        }
        v12 = bytes[i];
        base64Str += BASE64_ENCODE_CHAR[v12 >>> 2] + BASE64_ENCODE_CHAR[v12 << 4 & 63] + "==";
        return base64Str;
      };
      var exports = createMethod();
      if (COMMON_JS) {
        module.exports = exports;
      } else {
        root.md5 = exports;
        if (AMD) {
          define(function() {
            return exports;
          });
        }
      }
    })();
  }
});

// node_modules/js-sha1/src/sha1.js
var require_sha1 = __commonJS({
  "node_modules/js-sha1/src/sha1.js"(exports, module) {
    (function() {
      "use strict";
      var root = typeof window === "object" ? window : {};
      var NODE_JS = !root.JS_SHA1_NO_NODE_JS && typeof process === "object" && process.versions && process.versions.node;
      if (NODE_JS) {
        root = global;
      }
      var COMMON_JS = !root.JS_SHA1_NO_COMMON_JS && typeof module === "object" && module.exports;
      var AMD = typeof define === "function" && define.amd;
      var HEX_CHARS = "0123456789abcdef".split("");
      var EXTRA = [-2147483648, 8388608, 32768, 128];
      var SHIFT = [24, 16, 8, 0];
      var OUTPUT_TYPES = ["hex", "array", "digest", "arrayBuffer"];
      var blocks = [];
      var createOutputMethod = function(outputType) {
        return function(message) {
          return new Sha1(true).update(message)[outputType]();
        };
      };
      var createMethod = function() {
        var method2 = createOutputMethod("hex");
        if (NODE_JS) {
          method2 = nodeWrap(method2);
        }
        method2.create = function() {
          return new Sha1();
        };
        method2.update = function(message) {
          return method2.create().update(message);
        };
        for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
          var type = OUTPUT_TYPES[i];
          method2[type] = createOutputMethod(type);
        }
        return method2;
      };
      var nodeWrap = function(method) {
        var crypto = eval("require('crypto')");
        var Buffer = eval("require('buffer').Buffer");
        var nodeMethod = function(message) {
          if (typeof message === "string") {
            return crypto.createHash("sha1").update(message, "utf8").digest("hex");
          } else if (message.constructor === ArrayBuffer) {
            message = new Uint8Array(message);
          } else if (message.length === void 0) {
            return method(message);
          }
          return crypto.createHash("sha1").update(new Buffer(message)).digest("hex");
        };
        return nodeMethod;
      };
      function Sha1(sharedMemory) {
        if (sharedMemory) {
          blocks[0] = blocks[16] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
          this.blocks = blocks;
        } else {
          this.blocks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        }
        this.h0 = 1732584193;
        this.h1 = 4023233417;
        this.h2 = 2562383102;
        this.h3 = 271733878;
        this.h4 = 3285377520;
        this.block = this.start = this.bytes = this.hBytes = 0;
        this.finalized = this.hashed = false;
        this.first = true;
      }
      Sha1.prototype.update = function(message) {
        if (this.finalized) {
          return;
        }
        var notString = typeof message !== "string";
        if (notString && message.constructor === root.ArrayBuffer) {
          message = new Uint8Array(message);
        }
        var code, index = 0, i, length = message.length || 0, blocks2 = this.blocks;
        while (index < length) {
          if (this.hashed) {
            this.hashed = false;
            blocks2[0] = this.block;
            blocks2[16] = blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = 0;
          }
          if (notString) {
            for (i = this.start; index < length && i < 64; ++index) {
              blocks2[i >> 2] |= message[index] << SHIFT[i++ & 3];
            }
          } else {
            for (i = this.start; index < length && i < 64; ++index) {
              code = message.charCodeAt(index);
              if (code < 128) {
                blocks2[i >> 2] |= code << SHIFT[i++ & 3];
              } else if (code < 2048) {
                blocks2[i >> 2] |= (192 | code >> 6) << SHIFT[i++ & 3];
                blocks2[i >> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
              } else if (code < 55296 || code >= 57344) {
                blocks2[i >> 2] |= (224 | code >> 12) << SHIFT[i++ & 3];
                blocks2[i >> 2] |= (128 | code >> 6 & 63) << SHIFT[i++ & 3];
                blocks2[i >> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
              } else {
                code = 65536 + ((code & 1023) << 10 | message.charCodeAt(++index) & 1023);
                blocks2[i >> 2] |= (240 | code >> 18) << SHIFT[i++ & 3];
                blocks2[i >> 2] |= (128 | code >> 12 & 63) << SHIFT[i++ & 3];
                blocks2[i >> 2] |= (128 | code >> 6 & 63) << SHIFT[i++ & 3];
                blocks2[i >> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
              }
            }
          }
          this.lastByteIndex = i;
          this.bytes += i - this.start;
          if (i >= 64) {
            this.block = blocks2[16];
            this.start = i - 64;
            this.hash();
            this.hashed = true;
          } else {
            this.start = i;
          }
        }
        if (this.bytes > 4294967295) {
          this.hBytes += this.bytes / 4294967296 << 0;
          this.bytes = this.bytes % 4294967296;
        }
        return this;
      };
      Sha1.prototype.finalize = function() {
        if (this.finalized) {
          return;
        }
        this.finalized = true;
        var blocks2 = this.blocks, i = this.lastByteIndex;
        blocks2[16] = this.block;
        blocks2[i >> 2] |= EXTRA[i & 3];
        this.block = blocks2[16];
        if (i >= 56) {
          if (!this.hashed) {
            this.hash();
          }
          blocks2[0] = this.block;
          blocks2[16] = blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = 0;
        }
        blocks2[14] = this.hBytes << 3 | this.bytes >>> 29;
        blocks2[15] = this.bytes << 3;
        this.hash();
      };
      Sha1.prototype.hash = function() {
        var a = this.h0, b = this.h1, c = this.h2, d = this.h3, e = this.h4;
        var f2, j, t, blocks2 = this.blocks;
        for (j = 16; j < 80; ++j) {
          t = blocks2[j - 3] ^ blocks2[j - 8] ^ blocks2[j - 14] ^ blocks2[j - 16];
          blocks2[j] = t << 1 | t >>> 31;
        }
        for (j = 0; j < 20; j += 5) {
          f2 = b & c | ~b & d;
          t = a << 5 | a >>> 27;
          e = t + f2 + e + 1518500249 + blocks2[j] << 0;
          b = b << 30 | b >>> 2;
          f2 = a & b | ~a & c;
          t = e << 5 | e >>> 27;
          d = t + f2 + d + 1518500249 + blocks2[j + 1] << 0;
          a = a << 30 | a >>> 2;
          f2 = e & a | ~e & b;
          t = d << 5 | d >>> 27;
          c = t + f2 + c + 1518500249 + blocks2[j + 2] << 0;
          e = e << 30 | e >>> 2;
          f2 = d & e | ~d & a;
          t = c << 5 | c >>> 27;
          b = t + f2 + b + 1518500249 + blocks2[j + 3] << 0;
          d = d << 30 | d >>> 2;
          f2 = c & d | ~c & e;
          t = b << 5 | b >>> 27;
          a = t + f2 + a + 1518500249 + blocks2[j + 4] << 0;
          c = c << 30 | c >>> 2;
        }
        for (; j < 40; j += 5) {
          f2 = b ^ c ^ d;
          t = a << 5 | a >>> 27;
          e = t + f2 + e + 1859775393 + blocks2[j] << 0;
          b = b << 30 | b >>> 2;
          f2 = a ^ b ^ c;
          t = e << 5 | e >>> 27;
          d = t + f2 + d + 1859775393 + blocks2[j + 1] << 0;
          a = a << 30 | a >>> 2;
          f2 = e ^ a ^ b;
          t = d << 5 | d >>> 27;
          c = t + f2 + c + 1859775393 + blocks2[j + 2] << 0;
          e = e << 30 | e >>> 2;
          f2 = d ^ e ^ a;
          t = c << 5 | c >>> 27;
          b = t + f2 + b + 1859775393 + blocks2[j + 3] << 0;
          d = d << 30 | d >>> 2;
          f2 = c ^ d ^ e;
          t = b << 5 | b >>> 27;
          a = t + f2 + a + 1859775393 + blocks2[j + 4] << 0;
          c = c << 30 | c >>> 2;
        }
        for (; j < 60; j += 5) {
          f2 = b & c | b & d | c & d;
          t = a << 5 | a >>> 27;
          e = t + f2 + e - 1894007588 + blocks2[j] << 0;
          b = b << 30 | b >>> 2;
          f2 = a & b | a & c | b & c;
          t = e << 5 | e >>> 27;
          d = t + f2 + d - 1894007588 + blocks2[j + 1] << 0;
          a = a << 30 | a >>> 2;
          f2 = e & a | e & b | a & b;
          t = d << 5 | d >>> 27;
          c = t + f2 + c - 1894007588 + blocks2[j + 2] << 0;
          e = e << 30 | e >>> 2;
          f2 = d & e | d & a | e & a;
          t = c << 5 | c >>> 27;
          b = t + f2 + b - 1894007588 + blocks2[j + 3] << 0;
          d = d << 30 | d >>> 2;
          f2 = c & d | c & e | d & e;
          t = b << 5 | b >>> 27;
          a = t + f2 + a - 1894007588 + blocks2[j + 4] << 0;
          c = c << 30 | c >>> 2;
        }
        for (; j < 80; j += 5) {
          f2 = b ^ c ^ d;
          t = a << 5 | a >>> 27;
          e = t + f2 + e - 899497514 + blocks2[j] << 0;
          b = b << 30 | b >>> 2;
          f2 = a ^ b ^ c;
          t = e << 5 | e >>> 27;
          d = t + f2 + d - 899497514 + blocks2[j + 1] << 0;
          a = a << 30 | a >>> 2;
          f2 = e ^ a ^ b;
          t = d << 5 | d >>> 27;
          c = t + f2 + c - 899497514 + blocks2[j + 2] << 0;
          e = e << 30 | e >>> 2;
          f2 = d ^ e ^ a;
          t = c << 5 | c >>> 27;
          b = t + f2 + b - 899497514 + blocks2[j + 3] << 0;
          d = d << 30 | d >>> 2;
          f2 = c ^ d ^ e;
          t = b << 5 | b >>> 27;
          a = t + f2 + a - 899497514 + blocks2[j + 4] << 0;
          c = c << 30 | c >>> 2;
        }
        this.h0 = this.h0 + a << 0;
        this.h1 = this.h1 + b << 0;
        this.h2 = this.h2 + c << 0;
        this.h3 = this.h3 + d << 0;
        this.h4 = this.h4 + e << 0;
      };
      Sha1.prototype.hex = function() {
        this.finalize();
        var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3, h4 = this.h4;
        return HEX_CHARS[h0 >> 28 & 15] + HEX_CHARS[h0 >> 24 & 15] + HEX_CHARS[h0 >> 20 & 15] + HEX_CHARS[h0 >> 16 & 15] + HEX_CHARS[h0 >> 12 & 15] + HEX_CHARS[h0 >> 8 & 15] + HEX_CHARS[h0 >> 4 & 15] + HEX_CHARS[h0 & 15] + HEX_CHARS[h1 >> 28 & 15] + HEX_CHARS[h1 >> 24 & 15] + HEX_CHARS[h1 >> 20 & 15] + HEX_CHARS[h1 >> 16 & 15] + HEX_CHARS[h1 >> 12 & 15] + HEX_CHARS[h1 >> 8 & 15] + HEX_CHARS[h1 >> 4 & 15] + HEX_CHARS[h1 & 15] + HEX_CHARS[h2 >> 28 & 15] + HEX_CHARS[h2 >> 24 & 15] + HEX_CHARS[h2 >> 20 & 15] + HEX_CHARS[h2 >> 16 & 15] + HEX_CHARS[h2 >> 12 & 15] + HEX_CHARS[h2 >> 8 & 15] + HEX_CHARS[h2 >> 4 & 15] + HEX_CHARS[h2 & 15] + HEX_CHARS[h3 >> 28 & 15] + HEX_CHARS[h3 >> 24 & 15] + HEX_CHARS[h3 >> 20 & 15] + HEX_CHARS[h3 >> 16 & 15] + HEX_CHARS[h3 >> 12 & 15] + HEX_CHARS[h3 >> 8 & 15] + HEX_CHARS[h3 >> 4 & 15] + HEX_CHARS[h3 & 15] + HEX_CHARS[h4 >> 28 & 15] + HEX_CHARS[h4 >> 24 & 15] + HEX_CHARS[h4 >> 20 & 15] + HEX_CHARS[h4 >> 16 & 15] + HEX_CHARS[h4 >> 12 & 15] + HEX_CHARS[h4 >> 8 & 15] + HEX_CHARS[h4 >> 4 & 15] + HEX_CHARS[h4 & 15];
      };
      Sha1.prototype.toString = Sha1.prototype.hex;
      Sha1.prototype.digest = function() {
        this.finalize();
        var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3, h4 = this.h4;
        return [
          h0 >> 24 & 255,
          h0 >> 16 & 255,
          h0 >> 8 & 255,
          h0 & 255,
          h1 >> 24 & 255,
          h1 >> 16 & 255,
          h1 >> 8 & 255,
          h1 & 255,
          h2 >> 24 & 255,
          h2 >> 16 & 255,
          h2 >> 8 & 255,
          h2 & 255,
          h3 >> 24 & 255,
          h3 >> 16 & 255,
          h3 >> 8 & 255,
          h3 & 255,
          h4 >> 24 & 255,
          h4 >> 16 & 255,
          h4 >> 8 & 255,
          h4 & 255
        ];
      };
      Sha1.prototype.array = Sha1.prototype.digest;
      Sha1.prototype.arrayBuffer = function() {
        this.finalize();
        var buffer2 = new ArrayBuffer(20);
        var dataView = new DataView(buffer2);
        dataView.setUint32(0, this.h0);
        dataView.setUint32(4, this.h1);
        dataView.setUint32(8, this.h2);
        dataView.setUint32(12, this.h3);
        dataView.setUint32(16, this.h4);
        return buffer2;
      };
      var exports = createMethod();
      if (COMMON_JS) {
        module.exports = exports;
      } else {
        root.sha1 = exports;
        if (AMD) {
          define(function() {
            return exports;
          });
        }
      }
    })();
  }
});

// node_modules/js-sha256/src/sha256.js
var require_sha256 = __commonJS({
  "node_modules/js-sha256/src/sha256.js"(exports, module) {
    (function() {
      "use strict";
      var ERROR = "input is invalid type";
      var WINDOW = typeof window === "object";
      var root = WINDOW ? window : {};
      if (root.JS_SHA256_NO_WINDOW) {
        WINDOW = false;
      }
      var WEB_WORKER = !WINDOW && typeof self === "object";
      var NODE_JS = !root.JS_SHA256_NO_NODE_JS && typeof process === "object" && process.versions && process.versions.node;
      if (NODE_JS) {
        root = global;
      } else if (WEB_WORKER) {
        root = self;
      }
      var COMMON_JS = !root.JS_SHA256_NO_COMMON_JS && typeof module === "object" && module.exports;
      var AMD = typeof define === "function" && define.amd;
      var ARRAY_BUFFER = !root.JS_SHA256_NO_ARRAY_BUFFER && typeof ArrayBuffer !== "undefined";
      var HEX_CHARS = "0123456789abcdef".split("");
      var EXTRA = [-2147483648, 8388608, 32768, 128];
      var SHIFT = [24, 16, 8, 0];
      var K = [
        1116352408,
        1899447441,
        3049323471,
        3921009573,
        961987163,
        1508970993,
        2453635748,
        2870763221,
        3624381080,
        310598401,
        607225278,
        1426881987,
        1925078388,
        2162078206,
        2614888103,
        3248222580,
        3835390401,
        4022224774,
        264347078,
        604807628,
        770255983,
        1249150122,
        1555081692,
        1996064986,
        2554220882,
        2821834349,
        2952996808,
        3210313671,
        3336571891,
        3584528711,
        113926993,
        338241895,
        666307205,
        773529912,
        1294757372,
        1396182291,
        1695183700,
        1986661051,
        2177026350,
        2456956037,
        2730485921,
        2820302411,
        3259730800,
        3345764771,
        3516065817,
        3600352804,
        4094571909,
        275423344,
        430227734,
        506948616,
        659060556,
        883997877,
        958139571,
        1322822218,
        1537002063,
        1747873779,
        1955562222,
        2024104815,
        2227730452,
        2361852424,
        2428436474,
        2756734187,
        3204031479,
        3329325298
      ];
      var OUTPUT_TYPES = ["hex", "array", "digest", "arrayBuffer"];
      var blocks = [];
      if (root.JS_SHA256_NO_NODE_JS || !Array.isArray) {
        Array.isArray = function(obj) {
          return Object.prototype.toString.call(obj) === "[object Array]";
        };
      }
      if (ARRAY_BUFFER && (root.JS_SHA256_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView)) {
        ArrayBuffer.isView = function(obj) {
          return typeof obj === "object" && obj.buffer && obj.buffer.constructor === ArrayBuffer;
        };
      }
      var createOutputMethod = function(outputType, is2242) {
        return function(message) {
          return new Sha256(is2242, true).update(message)[outputType]();
        };
      };
      var createMethod = function(is2242) {
        var method2 = createOutputMethod("hex", is2242);
        if (NODE_JS) {
          method2 = nodeWrap(method2, is2242);
        }
        method2.create = function() {
          return new Sha256(is2242);
        };
        method2.update = function(message) {
          return method2.create().update(message);
        };
        for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
          var type = OUTPUT_TYPES[i];
          method2[type] = createOutputMethod(type, is2242);
        }
        return method2;
      };
      var nodeWrap = function(method, is224) {
        var crypto = eval("require('crypto')");
        var Buffer = eval("require('buffer').Buffer");
        var algorithm = is224 ? "sha224" : "sha256";
        var nodeMethod = function(message) {
          if (typeof message === "string") {
            return crypto.createHash(algorithm).update(message, "utf8").digest("hex");
          } else {
            if (message === null || message === void 0) {
              throw new Error(ERROR);
            } else if (message.constructor === ArrayBuffer) {
              message = new Uint8Array(message);
            }
          }
          if (Array.isArray(message) || ArrayBuffer.isView(message) || message.constructor === Buffer) {
            return crypto.createHash(algorithm).update(new Buffer(message)).digest("hex");
          } else {
            return method(message);
          }
        };
        return nodeMethod;
      };
      var createHmacOutputMethod = function(outputType, is2242) {
        return function(key, message) {
          return new HmacSha256(key, is2242, true).update(message)[outputType]();
        };
      };
      var createHmacMethod = function(is2242) {
        var method2 = createHmacOutputMethod("hex", is2242);
        method2.create = function(key) {
          return new HmacSha256(key, is2242);
        };
        method2.update = function(key, message) {
          return method2.create(key).update(message);
        };
        for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
          var type = OUTPUT_TYPES[i];
          method2[type] = createHmacOutputMethod(type, is2242);
        }
        return method2;
      };
      function Sha256(is2242, sharedMemory) {
        if (sharedMemory) {
          blocks[0] = blocks[16] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
          this.blocks = blocks;
        } else {
          this.blocks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        }
        if (is2242) {
          this.h0 = 3238371032;
          this.h1 = 914150663;
          this.h2 = 812702999;
          this.h3 = 4144912697;
          this.h4 = 4290775857;
          this.h5 = 1750603025;
          this.h6 = 1694076839;
          this.h7 = 3204075428;
        } else {
          this.h0 = 1779033703;
          this.h1 = 3144134277;
          this.h2 = 1013904242;
          this.h3 = 2773480762;
          this.h4 = 1359893119;
          this.h5 = 2600822924;
          this.h6 = 528734635;
          this.h7 = 1541459225;
        }
        this.block = this.start = this.bytes = this.hBytes = 0;
        this.finalized = this.hashed = false;
        this.first = true;
        this.is224 = is2242;
      }
      Sha256.prototype.update = function(message) {
        if (this.finalized) {
          return;
        }
        var notString, type = typeof message;
        if (type !== "string") {
          if (type === "object") {
            if (message === null) {
              throw new Error(ERROR);
            } else if (ARRAY_BUFFER && message.constructor === ArrayBuffer) {
              message = new Uint8Array(message);
            } else if (!Array.isArray(message)) {
              if (!ARRAY_BUFFER || !ArrayBuffer.isView(message)) {
                throw new Error(ERROR);
              }
            }
          } else {
            throw new Error(ERROR);
          }
          notString = true;
        }
        var code, index = 0, i, length = message.length, blocks2 = this.blocks;
        while (index < length) {
          if (this.hashed) {
            this.hashed = false;
            blocks2[0] = this.block;
            blocks2[16] = blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = 0;
          }
          if (notString) {
            for (i = this.start; index < length && i < 64; ++index) {
              blocks2[i >> 2] |= message[index] << SHIFT[i++ & 3];
            }
          } else {
            for (i = this.start; index < length && i < 64; ++index) {
              code = message.charCodeAt(index);
              if (code < 128) {
                blocks2[i >> 2] |= code << SHIFT[i++ & 3];
              } else if (code < 2048) {
                blocks2[i >> 2] |= (192 | code >> 6) << SHIFT[i++ & 3];
                blocks2[i >> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
              } else if (code < 55296 || code >= 57344) {
                blocks2[i >> 2] |= (224 | code >> 12) << SHIFT[i++ & 3];
                blocks2[i >> 2] |= (128 | code >> 6 & 63) << SHIFT[i++ & 3];
                blocks2[i >> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
              } else {
                code = 65536 + ((code & 1023) << 10 | message.charCodeAt(++index) & 1023);
                blocks2[i >> 2] |= (240 | code >> 18) << SHIFT[i++ & 3];
                blocks2[i >> 2] |= (128 | code >> 12 & 63) << SHIFT[i++ & 3];
                blocks2[i >> 2] |= (128 | code >> 6 & 63) << SHIFT[i++ & 3];
                blocks2[i >> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
              }
            }
          }
          this.lastByteIndex = i;
          this.bytes += i - this.start;
          if (i >= 64) {
            this.block = blocks2[16];
            this.start = i - 64;
            this.hash();
            this.hashed = true;
          } else {
            this.start = i;
          }
        }
        if (this.bytes > 4294967295) {
          this.hBytes += this.bytes / 4294967296 << 0;
          this.bytes = this.bytes % 4294967296;
        }
        return this;
      };
      Sha256.prototype.finalize = function() {
        if (this.finalized) {
          return;
        }
        this.finalized = true;
        var blocks2 = this.blocks, i = this.lastByteIndex;
        blocks2[16] = this.block;
        blocks2[i >> 2] |= EXTRA[i & 3];
        this.block = blocks2[16];
        if (i >= 56) {
          if (!this.hashed) {
            this.hash();
          }
          blocks2[0] = this.block;
          blocks2[16] = blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = 0;
        }
        blocks2[14] = this.hBytes << 3 | this.bytes >>> 29;
        blocks2[15] = this.bytes << 3;
        this.hash();
      };
      Sha256.prototype.hash = function() {
        var a = this.h0, b = this.h1, c = this.h2, d = this.h3, e = this.h4, f2 = this.h5, g = this.h6, h = this.h7, blocks2 = this.blocks, j, s0, s1, maj, t1, t2, ch, ab, da, cd, bc;
        for (j = 16; j < 64; ++j) {
          t1 = blocks2[j - 15];
          s0 = (t1 >>> 7 | t1 << 25) ^ (t1 >>> 18 | t1 << 14) ^ t1 >>> 3;
          t1 = blocks2[j - 2];
          s1 = (t1 >>> 17 | t1 << 15) ^ (t1 >>> 19 | t1 << 13) ^ t1 >>> 10;
          blocks2[j] = blocks2[j - 16] + s0 + blocks2[j - 7] + s1 << 0;
        }
        bc = b & c;
        for (j = 0; j < 64; j += 4) {
          if (this.first) {
            if (this.is224) {
              ab = 300032;
              t1 = blocks2[0] - 1413257819;
              h = t1 - 150054599 << 0;
              d = t1 + 24177077 << 0;
            } else {
              ab = 704751109;
              t1 = blocks2[0] - 210244248;
              h = t1 - 1521486534 << 0;
              d = t1 + 143694565 << 0;
            }
            this.first = false;
          } else {
            s0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
            s1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
            ab = a & b;
            maj = ab ^ a & c ^ bc;
            ch = e & f2 ^ ~e & g;
            t1 = h + s1 + ch + K[j] + blocks2[j];
            t2 = s0 + maj;
            h = d + t1 << 0;
            d = t1 + t2 << 0;
          }
          s0 = (d >>> 2 | d << 30) ^ (d >>> 13 | d << 19) ^ (d >>> 22 | d << 10);
          s1 = (h >>> 6 | h << 26) ^ (h >>> 11 | h << 21) ^ (h >>> 25 | h << 7);
          da = d & a;
          maj = da ^ d & b ^ ab;
          ch = h & e ^ ~h & f2;
          t1 = g + s1 + ch + K[j + 1] + blocks2[j + 1];
          t2 = s0 + maj;
          g = c + t1 << 0;
          c = t1 + t2 << 0;
          s0 = (c >>> 2 | c << 30) ^ (c >>> 13 | c << 19) ^ (c >>> 22 | c << 10);
          s1 = (g >>> 6 | g << 26) ^ (g >>> 11 | g << 21) ^ (g >>> 25 | g << 7);
          cd = c & d;
          maj = cd ^ c & a ^ da;
          ch = g & h ^ ~g & e;
          t1 = f2 + s1 + ch + K[j + 2] + blocks2[j + 2];
          t2 = s0 + maj;
          f2 = b + t1 << 0;
          b = t1 + t2 << 0;
          s0 = (b >>> 2 | b << 30) ^ (b >>> 13 | b << 19) ^ (b >>> 22 | b << 10);
          s1 = (f2 >>> 6 | f2 << 26) ^ (f2 >>> 11 | f2 << 21) ^ (f2 >>> 25 | f2 << 7);
          bc = b & c;
          maj = bc ^ b & d ^ cd;
          ch = f2 & g ^ ~f2 & h;
          t1 = e + s1 + ch + K[j + 3] + blocks2[j + 3];
          t2 = s0 + maj;
          e = a + t1 << 0;
          a = t1 + t2 << 0;
        }
        this.h0 = this.h0 + a << 0;
        this.h1 = this.h1 + b << 0;
        this.h2 = this.h2 + c << 0;
        this.h3 = this.h3 + d << 0;
        this.h4 = this.h4 + e << 0;
        this.h5 = this.h5 + f2 << 0;
        this.h6 = this.h6 + g << 0;
        this.h7 = this.h7 + h << 0;
      };
      Sha256.prototype.hex = function() {
        this.finalize();
        var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3, h4 = this.h4, h5 = this.h5, h6 = this.h6, h7 = this.h7;
        var hex = HEX_CHARS[h0 >> 28 & 15] + HEX_CHARS[h0 >> 24 & 15] + HEX_CHARS[h0 >> 20 & 15] + HEX_CHARS[h0 >> 16 & 15] + HEX_CHARS[h0 >> 12 & 15] + HEX_CHARS[h0 >> 8 & 15] + HEX_CHARS[h0 >> 4 & 15] + HEX_CHARS[h0 & 15] + HEX_CHARS[h1 >> 28 & 15] + HEX_CHARS[h1 >> 24 & 15] + HEX_CHARS[h1 >> 20 & 15] + HEX_CHARS[h1 >> 16 & 15] + HEX_CHARS[h1 >> 12 & 15] + HEX_CHARS[h1 >> 8 & 15] + HEX_CHARS[h1 >> 4 & 15] + HEX_CHARS[h1 & 15] + HEX_CHARS[h2 >> 28 & 15] + HEX_CHARS[h2 >> 24 & 15] + HEX_CHARS[h2 >> 20 & 15] + HEX_CHARS[h2 >> 16 & 15] + HEX_CHARS[h2 >> 12 & 15] + HEX_CHARS[h2 >> 8 & 15] + HEX_CHARS[h2 >> 4 & 15] + HEX_CHARS[h2 & 15] + HEX_CHARS[h3 >> 28 & 15] + HEX_CHARS[h3 >> 24 & 15] + HEX_CHARS[h3 >> 20 & 15] + HEX_CHARS[h3 >> 16 & 15] + HEX_CHARS[h3 >> 12 & 15] + HEX_CHARS[h3 >> 8 & 15] + HEX_CHARS[h3 >> 4 & 15] + HEX_CHARS[h3 & 15] + HEX_CHARS[h4 >> 28 & 15] + HEX_CHARS[h4 >> 24 & 15] + HEX_CHARS[h4 >> 20 & 15] + HEX_CHARS[h4 >> 16 & 15] + HEX_CHARS[h4 >> 12 & 15] + HEX_CHARS[h4 >> 8 & 15] + HEX_CHARS[h4 >> 4 & 15] + HEX_CHARS[h4 & 15] + HEX_CHARS[h5 >> 28 & 15] + HEX_CHARS[h5 >> 24 & 15] + HEX_CHARS[h5 >> 20 & 15] + HEX_CHARS[h5 >> 16 & 15] + HEX_CHARS[h5 >> 12 & 15] + HEX_CHARS[h5 >> 8 & 15] + HEX_CHARS[h5 >> 4 & 15] + HEX_CHARS[h5 & 15] + HEX_CHARS[h6 >> 28 & 15] + HEX_CHARS[h6 >> 24 & 15] + HEX_CHARS[h6 >> 20 & 15] + HEX_CHARS[h6 >> 16 & 15] + HEX_CHARS[h6 >> 12 & 15] + HEX_CHARS[h6 >> 8 & 15] + HEX_CHARS[h6 >> 4 & 15] + HEX_CHARS[h6 & 15];
        if (!this.is224) {
          hex += HEX_CHARS[h7 >> 28 & 15] + HEX_CHARS[h7 >> 24 & 15] + HEX_CHARS[h7 >> 20 & 15] + HEX_CHARS[h7 >> 16 & 15] + HEX_CHARS[h7 >> 12 & 15] + HEX_CHARS[h7 >> 8 & 15] + HEX_CHARS[h7 >> 4 & 15] + HEX_CHARS[h7 & 15];
        }
        return hex;
      };
      Sha256.prototype.toString = Sha256.prototype.hex;
      Sha256.prototype.digest = function() {
        this.finalize();
        var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3, h4 = this.h4, h5 = this.h5, h6 = this.h6, h7 = this.h7;
        var arr = [
          h0 >> 24 & 255,
          h0 >> 16 & 255,
          h0 >> 8 & 255,
          h0 & 255,
          h1 >> 24 & 255,
          h1 >> 16 & 255,
          h1 >> 8 & 255,
          h1 & 255,
          h2 >> 24 & 255,
          h2 >> 16 & 255,
          h2 >> 8 & 255,
          h2 & 255,
          h3 >> 24 & 255,
          h3 >> 16 & 255,
          h3 >> 8 & 255,
          h3 & 255,
          h4 >> 24 & 255,
          h4 >> 16 & 255,
          h4 >> 8 & 255,
          h4 & 255,
          h5 >> 24 & 255,
          h5 >> 16 & 255,
          h5 >> 8 & 255,
          h5 & 255,
          h6 >> 24 & 255,
          h6 >> 16 & 255,
          h6 >> 8 & 255,
          h6 & 255
        ];
        if (!this.is224) {
          arr.push(h7 >> 24 & 255, h7 >> 16 & 255, h7 >> 8 & 255, h7 & 255);
        }
        return arr;
      };
      Sha256.prototype.array = Sha256.prototype.digest;
      Sha256.prototype.arrayBuffer = function() {
        this.finalize();
        var buffer2 = new ArrayBuffer(this.is224 ? 28 : 32);
        var dataView = new DataView(buffer2);
        dataView.setUint32(0, this.h0);
        dataView.setUint32(4, this.h1);
        dataView.setUint32(8, this.h2);
        dataView.setUint32(12, this.h3);
        dataView.setUint32(16, this.h4);
        dataView.setUint32(20, this.h5);
        dataView.setUint32(24, this.h6);
        if (!this.is224) {
          dataView.setUint32(28, this.h7);
        }
        return buffer2;
      };
      function HmacSha256(key, is2242, sharedMemory) {
        var i, type = typeof key;
        if (type === "string") {
          var bytes = [], length = key.length, index = 0, code;
          for (i = 0; i < length; ++i) {
            code = key.charCodeAt(i);
            if (code < 128) {
              bytes[index++] = code;
            } else if (code < 2048) {
              bytes[index++] = 192 | code >> 6;
              bytes[index++] = 128 | code & 63;
            } else if (code < 55296 || code >= 57344) {
              bytes[index++] = 224 | code >> 12;
              bytes[index++] = 128 | code >> 6 & 63;
              bytes[index++] = 128 | code & 63;
            } else {
              code = 65536 + ((code & 1023) << 10 | key.charCodeAt(++i) & 1023);
              bytes[index++] = 240 | code >> 18;
              bytes[index++] = 128 | code >> 12 & 63;
              bytes[index++] = 128 | code >> 6 & 63;
              bytes[index++] = 128 | code & 63;
            }
          }
          key = bytes;
        } else {
          if (type === "object") {
            if (key === null) {
              throw new Error(ERROR);
            } else if (ARRAY_BUFFER && key.constructor === ArrayBuffer) {
              key = new Uint8Array(key);
            } else if (!Array.isArray(key)) {
              if (!ARRAY_BUFFER || !ArrayBuffer.isView(key)) {
                throw new Error(ERROR);
              }
            }
          } else {
            throw new Error(ERROR);
          }
        }
        if (key.length > 64) {
          key = new Sha256(is2242, true).update(key).array();
        }
        var oKeyPad = [], iKeyPad = [];
        for (i = 0; i < 64; ++i) {
          var b = key[i] || 0;
          oKeyPad[i] = 92 ^ b;
          iKeyPad[i] = 54 ^ b;
        }
        Sha256.call(this, is2242, sharedMemory);
        this.update(iKeyPad);
        this.oKeyPad = oKeyPad;
        this.inner = true;
        this.sharedMemory = sharedMemory;
      }
      HmacSha256.prototype = new Sha256();
      HmacSha256.prototype.finalize = function() {
        Sha256.prototype.finalize.call(this);
        if (this.inner) {
          this.inner = false;
          var innerHash = this.array();
          Sha256.call(this, this.is224, this.sharedMemory);
          this.update(this.oKeyPad);
          this.update(innerHash);
          Sha256.prototype.finalize.call(this);
        }
      };
      var exports = createMethod();
      exports.sha256 = exports;
      exports.sha224 = createMethod(true);
      exports.sha256.hmac = createHmacMethod();
      exports.sha224.hmac = createHmacMethod(true);
      if (COMMON_JS) {
        module.exports = exports;
      } else {
        root.sha256 = exports.sha256;
        root.sha224 = exports.sha224;
        if (AMD) {
          define(function() {
            return exports;
          });
        }
      }
    })();
  }
});

// node_modules/js-sha512/src/sha512.js
var require_sha512 = __commonJS({
  "node_modules/js-sha512/src/sha512.js"(exports2, module2) {
    (function() {
      "use strict";
      var INPUT_ERROR = "input is invalid type";
      var FINALIZE_ERROR = "finalize already called";
      var WINDOW2 = typeof window === "object";
      var root2 = WINDOW2 ? window : {};
      if (root2.JS_SHA512_NO_WINDOW) {
        WINDOW2 = false;
      }
      var WEB_WORKER2 = !WINDOW2 && typeof self === "object";
      var NODE_JS2 = !root2.JS_SHA512_NO_NODE_JS && typeof process === "object" && process.versions && process.versions.node;
      if (NODE_JS2) {
        root2 = global;
      } else if (WEB_WORKER2) {
        root2 = self;
      }
      var COMMON_JS2 = !root2.JS_SHA512_NO_COMMON_JS && typeof module2 === "object" && module2.exports;
      var AMD2 = typeof define === "function" && define.amd;
      var ARRAY_BUFFER2 = !root2.JS_SHA512_NO_ARRAY_BUFFER && typeof ArrayBuffer !== "undefined";
      var HEX_CHARS2 = "0123456789abcdef".split("");
      var EXTRA2 = [-2147483648, 8388608, 32768, 128];
      var SHIFT2 = [24, 16, 8, 0];
      var K2 = [
        1116352408,
        3609767458,
        1899447441,
        602891725,
        3049323471,
        3964484399,
        3921009573,
        2173295548,
        961987163,
        4081628472,
        1508970993,
        3053834265,
        2453635748,
        2937671579,
        2870763221,
        3664609560,
        3624381080,
        2734883394,
        310598401,
        1164996542,
        607225278,
        1323610764,
        1426881987,
        3590304994,
        1925078388,
        4068182383,
        2162078206,
        991336113,
        2614888103,
        633803317,
        3248222580,
        3479774868,
        3835390401,
        2666613458,
        4022224774,
        944711139,
        264347078,
        2341262773,
        604807628,
        2007800933,
        770255983,
        1495990901,
        1249150122,
        1856431235,
        1555081692,
        3175218132,
        1996064986,
        2198950837,
        2554220882,
        3999719339,
        2821834349,
        766784016,
        2952996808,
        2566594879,
        3210313671,
        3203337956,
        3336571891,
        1034457026,
        3584528711,
        2466948901,
        113926993,
        3758326383,
        338241895,
        168717936,
        666307205,
        1188179964,
        773529912,
        1546045734,
        1294757372,
        1522805485,
        1396182291,
        2643833823,
        1695183700,
        2343527390,
        1986661051,
        1014477480,
        2177026350,
        1206759142,
        2456956037,
        344077627,
        2730485921,
        1290863460,
        2820302411,
        3158454273,
        3259730800,
        3505952657,
        3345764771,
        106217008,
        3516065817,
        3606008344,
        3600352804,
        1432725776,
        4094571909,
        1467031594,
        275423344,
        851169720,
        430227734,
        3100823752,
        506948616,
        1363258195,
        659060556,
        3750685593,
        883997877,
        3785050280,
        958139571,
        3318307427,
        1322822218,
        3812723403,
        1537002063,
        2003034995,
        1747873779,
        3602036899,
        1955562222,
        1575990012,
        2024104815,
        1125592928,
        2227730452,
        2716904306,
        2361852424,
        442776044,
        2428436474,
        593698344,
        2756734187,
        3733110249,
        3204031479,
        2999351573,
        3329325298,
        3815920427,
        3391569614,
        3928383900,
        3515267271,
        566280711,
        3940187606,
        3454069534,
        4118630271,
        4000239992,
        116418474,
        1914138554,
        174292421,
        2731055270,
        289380356,
        3203993006,
        460393269,
        320620315,
        685471733,
        587496836,
        852142971,
        1086792851,
        1017036298,
        365543100,
        1126000580,
        2618297676,
        1288033470,
        3409855158,
        1501505948,
        4234509866,
        1607167915,
        987167468,
        1816402316,
        1246189591
      ];
      var OUTPUT_TYPES2 = ["hex", "array", "digest", "arrayBuffer"];
      var blocks2 = [];
      if (root2.JS_SHA512_NO_NODE_JS || !Array.isArray) {
        Array.isArray = function(obj) {
          return Object.prototype.toString.call(obj) === "[object Array]";
        };
      }
      if (ARRAY_BUFFER2 && (root2.JS_SHA512_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView)) {
        ArrayBuffer.isView = function(obj) {
          return typeof obj === "object" && obj.buffer && obj.buffer.constructor === ArrayBuffer;
        };
      }
      var createOutputMethod2 = function(outputType, bits) {
        return function(message) {
          return new Sha512(bits, true).update(message)[outputType]();
        };
      };
      var createMethod2 = function(bits) {
        var method2 = createOutputMethod2("hex", bits);
        method2.create = function() {
          return new Sha512(bits);
        };
        method2.update = function(message) {
          return method2.create().update(message);
        };
        for (var i = 0; i < OUTPUT_TYPES2.length; ++i) {
          var type = OUTPUT_TYPES2[i];
          method2[type] = createOutputMethod2(type, bits);
        }
        return method2;
      };
      var createHmacOutputMethod2 = function(outputType, bits) {
        return function(key, message) {
          return new HmacSha512(key, bits, true).update(message)[outputType]();
        };
      };
      var createHmacMethod2 = function(bits) {
        var method2 = createHmacOutputMethod2("hex", bits);
        method2.create = function(key) {
          return new HmacSha512(key, bits);
        };
        method2.update = function(key, message) {
          return method2.create(key).update(message);
        };
        for (var i = 0; i < OUTPUT_TYPES2.length; ++i) {
          var type = OUTPUT_TYPES2[i];
          method2[type] = createHmacOutputMethod2(type, bits);
        }
        return method2;
      };
      function Sha512(bits, sharedMemory) {
        if (sharedMemory) {
          blocks2[0] = blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = blocks2[16] = blocks2[17] = blocks2[18] = blocks2[19] = blocks2[20] = blocks2[21] = blocks2[22] = blocks2[23] = blocks2[24] = blocks2[25] = blocks2[26] = blocks2[27] = blocks2[28] = blocks2[29] = blocks2[30] = blocks2[31] = blocks2[32] = 0;
          this.blocks = blocks2;
        } else {
          this.blocks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        }
        if (bits == 384) {
          this.h0h = 3418070365;
          this.h0l = 3238371032;
          this.h1h = 1654270250;
          this.h1l = 914150663;
          this.h2h = 2438529370;
          this.h2l = 812702999;
          this.h3h = 355462360;
          this.h3l = 4144912697;
          this.h4h = 1731405415;
          this.h4l = 4290775857;
          this.h5h = 2394180231;
          this.h5l = 1750603025;
          this.h6h = 3675008525;
          this.h6l = 1694076839;
          this.h7h = 1203062813;
          this.h7l = 3204075428;
        } else if (bits == 256) {
          this.h0h = 573645204;
          this.h0l = 4230739756;
          this.h1h = 2673172387;
          this.h1l = 3360449730;
          this.h2h = 596883563;
          this.h2l = 1867755857;
          this.h3h = 2520282905;
          this.h3l = 1497426621;
          this.h4h = 2519219938;
          this.h4l = 2827943907;
          this.h5h = 3193839141;
          this.h5l = 1401305490;
          this.h6h = 721525244;
          this.h6l = 746961066;
          this.h7h = 246885852;
          this.h7l = 2177182882;
        } else if (bits == 224) {
          this.h0h = 2352822216;
          this.h0l = 424955298;
          this.h1h = 1944164710;
          this.h1l = 2312950998;
          this.h2h = 502970286;
          this.h2l = 855612546;
          this.h3h = 1738396948;
          this.h3l = 1479516111;
          this.h4h = 258812777;
          this.h4l = 2077511080;
          this.h5h = 2011393907;
          this.h5l = 79989058;
          this.h6h = 1067287976;
          this.h6l = 1780299464;
          this.h7h = 286451373;
          this.h7l = 2446758561;
        } else {
          this.h0h = 1779033703;
          this.h0l = 4089235720;
          this.h1h = 3144134277;
          this.h1l = 2227873595;
          this.h2h = 1013904242;
          this.h2l = 4271175723;
          this.h3h = 2773480762;
          this.h3l = 1595750129;
          this.h4h = 1359893119;
          this.h4l = 2917565137;
          this.h5h = 2600822924;
          this.h5l = 725511199;
          this.h6h = 528734635;
          this.h6l = 4215389547;
          this.h7h = 1541459225;
          this.h7l = 327033209;
        }
        this.bits = bits;
        this.block = this.start = this.bytes = this.hBytes = 0;
        this.finalized = this.hashed = false;
      }
      Sha512.prototype.update = function(message) {
        if (this.finalized) {
          throw new Error(FINALIZE_ERROR);
        }
        var notString, type = typeof message;
        if (type !== "string") {
          if (type === "object") {
            if (message === null) {
              throw new Error(INPUT_ERROR);
            } else if (ARRAY_BUFFER2 && message.constructor === ArrayBuffer) {
              message = new Uint8Array(message);
            } else if (!Array.isArray(message)) {
              if (!ARRAY_BUFFER2 || !ArrayBuffer.isView(message)) {
                throw new Error(INPUT_ERROR);
              }
            }
          } else {
            throw new Error(INPUT_ERROR);
          }
          notString = true;
        }
        var code, index = 0, i, length = message.length, blocks3 = this.blocks;
        while (index < length) {
          if (this.hashed) {
            this.hashed = false;
            blocks3[0] = this.block;
            blocks3[1] = blocks3[2] = blocks3[3] = blocks3[4] = blocks3[5] = blocks3[6] = blocks3[7] = blocks3[8] = blocks3[9] = blocks3[10] = blocks3[11] = blocks3[12] = blocks3[13] = blocks3[14] = blocks3[15] = blocks3[16] = blocks3[17] = blocks3[18] = blocks3[19] = blocks3[20] = blocks3[21] = blocks3[22] = blocks3[23] = blocks3[24] = blocks3[25] = blocks3[26] = blocks3[27] = blocks3[28] = blocks3[29] = blocks3[30] = blocks3[31] = blocks3[32] = 0;
          }
          if (notString) {
            for (i = this.start; index < length && i < 128; ++index) {
              blocks3[i >> 2] |= message[index] << SHIFT2[i++ & 3];
            }
          } else {
            for (i = this.start; index < length && i < 128; ++index) {
              code = message.charCodeAt(index);
              if (code < 128) {
                blocks3[i >> 2] |= code << SHIFT2[i++ & 3];
              } else if (code < 2048) {
                blocks3[i >> 2] |= (192 | code >> 6) << SHIFT2[i++ & 3];
                blocks3[i >> 2] |= (128 | code & 63) << SHIFT2[i++ & 3];
              } else if (code < 55296 || code >= 57344) {
                blocks3[i >> 2] |= (224 | code >> 12) << SHIFT2[i++ & 3];
                blocks3[i >> 2] |= (128 | code >> 6 & 63) << SHIFT2[i++ & 3];
                blocks3[i >> 2] |= (128 | code & 63) << SHIFT2[i++ & 3];
              } else {
                code = 65536 + ((code & 1023) << 10 | message.charCodeAt(++index) & 1023);
                blocks3[i >> 2] |= (240 | code >> 18) << SHIFT2[i++ & 3];
                blocks3[i >> 2] |= (128 | code >> 12 & 63) << SHIFT2[i++ & 3];
                blocks3[i >> 2] |= (128 | code >> 6 & 63) << SHIFT2[i++ & 3];
                blocks3[i >> 2] |= (128 | code & 63) << SHIFT2[i++ & 3];
              }
            }
          }
          this.lastByteIndex = i;
          this.bytes += i - this.start;
          if (i >= 128) {
            this.block = blocks3[32];
            this.start = i - 128;
            this.hash();
            this.hashed = true;
          } else {
            this.start = i;
          }
        }
        if (this.bytes > 4294967295) {
          this.hBytes += this.bytes / 4294967296 << 0;
          this.bytes = this.bytes % 4294967296;
        }
        return this;
      };
      Sha512.prototype.finalize = function() {
        if (this.finalized) {
          return;
        }
        this.finalized = true;
        var blocks3 = this.blocks, i = this.lastByteIndex;
        blocks3[32] = this.block;
        blocks3[i >> 2] |= EXTRA2[i & 3];
        this.block = blocks3[32];
        if (i >= 112) {
          if (!this.hashed) {
            this.hash();
          }
          blocks3[0] = this.block;
          blocks3[1] = blocks3[2] = blocks3[3] = blocks3[4] = blocks3[5] = blocks3[6] = blocks3[7] = blocks3[8] = blocks3[9] = blocks3[10] = blocks3[11] = blocks3[12] = blocks3[13] = blocks3[14] = blocks3[15] = blocks3[16] = blocks3[17] = blocks3[18] = blocks3[19] = blocks3[20] = blocks3[21] = blocks3[22] = blocks3[23] = blocks3[24] = blocks3[25] = blocks3[26] = blocks3[27] = blocks3[28] = blocks3[29] = blocks3[30] = blocks3[31] = blocks3[32] = 0;
        }
        blocks3[30] = this.hBytes << 3 | this.bytes >>> 29;
        blocks3[31] = this.bytes << 3;
        this.hash();
      };
      Sha512.prototype.hash = function() {
        var h0h = this.h0h, h0l = this.h0l, h1h = this.h1h, h1l = this.h1l, h2h = this.h2h, h2l = this.h2l, h3h = this.h3h, h3l = this.h3l, h4h = this.h4h, h4l = this.h4l, h5h = this.h5h, h5l = this.h5l, h6h = this.h6h, h6l = this.h6l, h7h = this.h7h, h7l = this.h7l, blocks3 = this.blocks, j, s0h, s0l, s1h, s1l, c1, c2, c3, c4, abh, abl, dah, dal, cdh, cdl, bch, bcl, majh, majl, t1h, t1l, t2h, t2l, chh, chl;
        for (j = 32; j < 160; j += 2) {
          t1h = blocks3[j - 30];
          t1l = blocks3[j - 29];
          s0h = (t1h >>> 1 | t1l << 31) ^ (t1h >>> 8 | t1l << 24) ^ t1h >>> 7;
          s0l = (t1l >>> 1 | t1h << 31) ^ (t1l >>> 8 | t1h << 24) ^ (t1l >>> 7 | t1h << 25);
          t1h = blocks3[j - 4];
          t1l = blocks3[j - 3];
          s1h = (t1h >>> 19 | t1l << 13) ^ (t1l >>> 29 | t1h << 3) ^ t1h >>> 6;
          s1l = (t1l >>> 19 | t1h << 13) ^ (t1h >>> 29 | t1l << 3) ^ (t1l >>> 6 | t1h << 26);
          t1h = blocks3[j - 32];
          t1l = blocks3[j - 31];
          t2h = blocks3[j - 14];
          t2l = blocks3[j - 13];
          c1 = (t2l & 65535) + (t1l & 65535) + (s0l & 65535) + (s1l & 65535);
          c2 = (t2l >>> 16) + (t1l >>> 16) + (s0l >>> 16) + (s1l >>> 16) + (c1 >>> 16);
          c3 = (t2h & 65535) + (t1h & 65535) + (s0h & 65535) + (s1h & 65535) + (c2 >>> 16);
          c4 = (t2h >>> 16) + (t1h >>> 16) + (s0h >>> 16) + (s1h >>> 16) + (c3 >>> 16);
          blocks3[j] = c4 << 16 | c3 & 65535;
          blocks3[j + 1] = c2 << 16 | c1 & 65535;
        }
        var ah = h0h, al = h0l, bh = h1h, bl = h1l, ch = h2h, cl = h2l, dh = h3h, dl = h3l, eh = h4h, el = h4l, fh = h5h, fl = h5l, gh = h6h, gl = h6l, hh = h7h, hl = h7l;
        bch = bh & ch;
        bcl = bl & cl;
        for (j = 0; j < 160; j += 8) {
          s0h = (ah >>> 28 | al << 4) ^ (al >>> 2 | ah << 30) ^ (al >>> 7 | ah << 25);
          s0l = (al >>> 28 | ah << 4) ^ (ah >>> 2 | al << 30) ^ (ah >>> 7 | al << 25);
          s1h = (eh >>> 14 | el << 18) ^ (eh >>> 18 | el << 14) ^ (el >>> 9 | eh << 23);
          s1l = (el >>> 14 | eh << 18) ^ (el >>> 18 | eh << 14) ^ (eh >>> 9 | el << 23);
          abh = ah & bh;
          abl = al & bl;
          majh = abh ^ ah & ch ^ bch;
          majl = abl ^ al & cl ^ bcl;
          chh = eh & fh ^ ~eh & gh;
          chl = el & fl ^ ~el & gl;
          t1h = blocks3[j];
          t1l = blocks3[j + 1];
          t2h = K2[j];
          t2l = K2[j + 1];
          c1 = (t2l & 65535) + (t1l & 65535) + (chl & 65535) + (s1l & 65535) + (hl & 65535);
          c2 = (t2l >>> 16) + (t1l >>> 16) + (chl >>> 16) + (s1l >>> 16) + (hl >>> 16) + (c1 >>> 16);
          c3 = (t2h & 65535) + (t1h & 65535) + (chh & 65535) + (s1h & 65535) + (hh & 65535) + (c2 >>> 16);
          c4 = (t2h >>> 16) + (t1h >>> 16) + (chh >>> 16) + (s1h >>> 16) + (hh >>> 16) + (c3 >>> 16);
          t1h = c4 << 16 | c3 & 65535;
          t1l = c2 << 16 | c1 & 65535;
          c1 = (majl & 65535) + (s0l & 65535);
          c2 = (majl >>> 16) + (s0l >>> 16) + (c1 >>> 16);
          c3 = (majh & 65535) + (s0h & 65535) + (c2 >>> 16);
          c4 = (majh >>> 16) + (s0h >>> 16) + (c3 >>> 16);
          t2h = c4 << 16 | c3 & 65535;
          t2l = c2 << 16 | c1 & 65535;
          c1 = (dl & 65535) + (t1l & 65535);
          c2 = (dl >>> 16) + (t1l >>> 16) + (c1 >>> 16);
          c3 = (dh & 65535) + (t1h & 65535) + (c2 >>> 16);
          c4 = (dh >>> 16) + (t1h >>> 16) + (c3 >>> 16);
          hh = c4 << 16 | c3 & 65535;
          hl = c2 << 16 | c1 & 65535;
          c1 = (t2l & 65535) + (t1l & 65535);
          c2 = (t2l >>> 16) + (t1l >>> 16) + (c1 >>> 16);
          c3 = (t2h & 65535) + (t1h & 65535) + (c2 >>> 16);
          c4 = (t2h >>> 16) + (t1h >>> 16) + (c3 >>> 16);
          dh = c4 << 16 | c3 & 65535;
          dl = c2 << 16 | c1 & 65535;
          s0h = (dh >>> 28 | dl << 4) ^ (dl >>> 2 | dh << 30) ^ (dl >>> 7 | dh << 25);
          s0l = (dl >>> 28 | dh << 4) ^ (dh >>> 2 | dl << 30) ^ (dh >>> 7 | dl << 25);
          s1h = (hh >>> 14 | hl << 18) ^ (hh >>> 18 | hl << 14) ^ (hl >>> 9 | hh << 23);
          s1l = (hl >>> 14 | hh << 18) ^ (hl >>> 18 | hh << 14) ^ (hh >>> 9 | hl << 23);
          dah = dh & ah;
          dal = dl & al;
          majh = dah ^ dh & bh ^ abh;
          majl = dal ^ dl & bl ^ abl;
          chh = hh & eh ^ ~hh & fh;
          chl = hl & el ^ ~hl & fl;
          t1h = blocks3[j + 2];
          t1l = blocks3[j + 3];
          t2h = K2[j + 2];
          t2l = K2[j + 3];
          c1 = (t2l & 65535) + (t1l & 65535) + (chl & 65535) + (s1l & 65535) + (gl & 65535);
          c2 = (t2l >>> 16) + (t1l >>> 16) + (chl >>> 16) + (s1l >>> 16) + (gl >>> 16) + (c1 >>> 16);
          c3 = (t2h & 65535) + (t1h & 65535) + (chh & 65535) + (s1h & 65535) + (gh & 65535) + (c2 >>> 16);
          c4 = (t2h >>> 16) + (t1h >>> 16) + (chh >>> 16) + (s1h >>> 16) + (gh >>> 16) + (c3 >>> 16);
          t1h = c4 << 16 | c3 & 65535;
          t1l = c2 << 16 | c1 & 65535;
          c1 = (majl & 65535) + (s0l & 65535);
          c2 = (majl >>> 16) + (s0l >>> 16) + (c1 >>> 16);
          c3 = (majh & 65535) + (s0h & 65535) + (c2 >>> 16);
          c4 = (majh >>> 16) + (s0h >>> 16) + (c3 >>> 16);
          t2h = c4 << 16 | c3 & 65535;
          t2l = c2 << 16 | c1 & 65535;
          c1 = (cl & 65535) + (t1l & 65535);
          c2 = (cl >>> 16) + (t1l >>> 16) + (c1 >>> 16);
          c3 = (ch & 65535) + (t1h & 65535) + (c2 >>> 16);
          c4 = (ch >>> 16) + (t1h >>> 16) + (c3 >>> 16);
          gh = c4 << 16 | c3 & 65535;
          gl = c2 << 16 | c1 & 65535;
          c1 = (t2l & 65535) + (t1l & 65535);
          c2 = (t2l >>> 16) + (t1l >>> 16) + (c1 >>> 16);
          c3 = (t2h & 65535) + (t1h & 65535) + (c2 >>> 16);
          c4 = (t2h >>> 16) + (t1h >>> 16) + (c3 >>> 16);
          ch = c4 << 16 | c3 & 65535;
          cl = c2 << 16 | c1 & 65535;
          s0h = (ch >>> 28 | cl << 4) ^ (cl >>> 2 | ch << 30) ^ (cl >>> 7 | ch << 25);
          s0l = (cl >>> 28 | ch << 4) ^ (ch >>> 2 | cl << 30) ^ (ch >>> 7 | cl << 25);
          s1h = (gh >>> 14 | gl << 18) ^ (gh >>> 18 | gl << 14) ^ (gl >>> 9 | gh << 23);
          s1l = (gl >>> 14 | gh << 18) ^ (gl >>> 18 | gh << 14) ^ (gh >>> 9 | gl << 23);
          cdh = ch & dh;
          cdl = cl & dl;
          majh = cdh ^ ch & ah ^ dah;
          majl = cdl ^ cl & al ^ dal;
          chh = gh & hh ^ ~gh & eh;
          chl = gl & hl ^ ~gl & el;
          t1h = blocks3[j + 4];
          t1l = blocks3[j + 5];
          t2h = K2[j + 4];
          t2l = K2[j + 5];
          c1 = (t2l & 65535) + (t1l & 65535) + (chl & 65535) + (s1l & 65535) + (fl & 65535);
          c2 = (t2l >>> 16) + (t1l >>> 16) + (chl >>> 16) + (s1l >>> 16) + (fl >>> 16) + (c1 >>> 16);
          c3 = (t2h & 65535) + (t1h & 65535) + (chh & 65535) + (s1h & 65535) + (fh & 65535) + (c2 >>> 16);
          c4 = (t2h >>> 16) + (t1h >>> 16) + (chh >>> 16) + (s1h >>> 16) + (fh >>> 16) + (c3 >>> 16);
          t1h = c4 << 16 | c3 & 65535;
          t1l = c2 << 16 | c1 & 65535;
          c1 = (majl & 65535) + (s0l & 65535);
          c2 = (majl >>> 16) + (s0l >>> 16) + (c1 >>> 16);
          c3 = (majh & 65535) + (s0h & 65535) + (c2 >>> 16);
          c4 = (majh >>> 16) + (s0h >>> 16) + (c3 >>> 16);
          t2h = c4 << 16 | c3 & 65535;
          t2l = c2 << 16 | c1 & 65535;
          c1 = (bl & 65535) + (t1l & 65535);
          c2 = (bl >>> 16) + (t1l >>> 16) + (c1 >>> 16);
          c3 = (bh & 65535) + (t1h & 65535) + (c2 >>> 16);
          c4 = (bh >>> 16) + (t1h >>> 16) + (c3 >>> 16);
          fh = c4 << 16 | c3 & 65535;
          fl = c2 << 16 | c1 & 65535;
          c1 = (t2l & 65535) + (t1l & 65535);
          c2 = (t2l >>> 16) + (t1l >>> 16) + (c1 >>> 16);
          c3 = (t2h & 65535) + (t1h & 65535) + (c2 >>> 16);
          c4 = (t2h >>> 16) + (t1h >>> 16) + (c3 >>> 16);
          bh = c4 << 16 | c3 & 65535;
          bl = c2 << 16 | c1 & 65535;
          s0h = (bh >>> 28 | bl << 4) ^ (bl >>> 2 | bh << 30) ^ (bl >>> 7 | bh << 25);
          s0l = (bl >>> 28 | bh << 4) ^ (bh >>> 2 | bl << 30) ^ (bh >>> 7 | bl << 25);
          s1h = (fh >>> 14 | fl << 18) ^ (fh >>> 18 | fl << 14) ^ (fl >>> 9 | fh << 23);
          s1l = (fl >>> 14 | fh << 18) ^ (fl >>> 18 | fh << 14) ^ (fh >>> 9 | fl << 23);
          bch = bh & ch;
          bcl = bl & cl;
          majh = bch ^ bh & dh ^ cdh;
          majl = bcl ^ bl & dl ^ cdl;
          chh = fh & gh ^ ~fh & hh;
          chl = fl & gl ^ ~fl & hl;
          t1h = blocks3[j + 6];
          t1l = blocks3[j + 7];
          t2h = K2[j + 6];
          t2l = K2[j + 7];
          c1 = (t2l & 65535) + (t1l & 65535) + (chl & 65535) + (s1l & 65535) + (el & 65535);
          c2 = (t2l >>> 16) + (t1l >>> 16) + (chl >>> 16) + (s1l >>> 16) + (el >>> 16) + (c1 >>> 16);
          c3 = (t2h & 65535) + (t1h & 65535) + (chh & 65535) + (s1h & 65535) + (eh & 65535) + (c2 >>> 16);
          c4 = (t2h >>> 16) + (t1h >>> 16) + (chh >>> 16) + (s1h >>> 16) + (eh >>> 16) + (c3 >>> 16);
          t1h = c4 << 16 | c3 & 65535;
          t1l = c2 << 16 | c1 & 65535;
          c1 = (majl & 65535) + (s0l & 65535);
          c2 = (majl >>> 16) + (s0l >>> 16) + (c1 >>> 16);
          c3 = (majh & 65535) + (s0h & 65535) + (c2 >>> 16);
          c4 = (majh >>> 16) + (s0h >>> 16) + (c3 >>> 16);
          t2h = c4 << 16 | c3 & 65535;
          t2l = c2 << 16 | c1 & 65535;
          c1 = (al & 65535) + (t1l & 65535);
          c2 = (al >>> 16) + (t1l >>> 16) + (c1 >>> 16);
          c3 = (ah & 65535) + (t1h & 65535) + (c2 >>> 16);
          c4 = (ah >>> 16) + (t1h >>> 16) + (c3 >>> 16);
          eh = c4 << 16 | c3 & 65535;
          el = c2 << 16 | c1 & 65535;
          c1 = (t2l & 65535) + (t1l & 65535);
          c2 = (t2l >>> 16) + (t1l >>> 16) + (c1 >>> 16);
          c3 = (t2h & 65535) + (t1h & 65535) + (c2 >>> 16);
          c4 = (t2h >>> 16) + (t1h >>> 16) + (c3 >>> 16);
          ah = c4 << 16 | c3 & 65535;
          al = c2 << 16 | c1 & 65535;
        }
        c1 = (h0l & 65535) + (al & 65535);
        c2 = (h0l >>> 16) + (al >>> 16) + (c1 >>> 16);
        c3 = (h0h & 65535) + (ah & 65535) + (c2 >>> 16);
        c4 = (h0h >>> 16) + (ah >>> 16) + (c3 >>> 16);
        this.h0h = c4 << 16 | c3 & 65535;
        this.h0l = c2 << 16 | c1 & 65535;
        c1 = (h1l & 65535) + (bl & 65535);
        c2 = (h1l >>> 16) + (bl >>> 16) + (c1 >>> 16);
        c3 = (h1h & 65535) + (bh & 65535) + (c2 >>> 16);
        c4 = (h1h >>> 16) + (bh >>> 16) + (c3 >>> 16);
        this.h1h = c4 << 16 | c3 & 65535;
        this.h1l = c2 << 16 | c1 & 65535;
        c1 = (h2l & 65535) + (cl & 65535);
        c2 = (h2l >>> 16) + (cl >>> 16) + (c1 >>> 16);
        c3 = (h2h & 65535) + (ch & 65535) + (c2 >>> 16);
        c4 = (h2h >>> 16) + (ch >>> 16) + (c3 >>> 16);
        this.h2h = c4 << 16 | c3 & 65535;
        this.h2l = c2 << 16 | c1 & 65535;
        c1 = (h3l & 65535) + (dl & 65535);
        c2 = (h3l >>> 16) + (dl >>> 16) + (c1 >>> 16);
        c3 = (h3h & 65535) + (dh & 65535) + (c2 >>> 16);
        c4 = (h3h >>> 16) + (dh >>> 16) + (c3 >>> 16);
        this.h3h = c4 << 16 | c3 & 65535;
        this.h3l = c2 << 16 | c1 & 65535;
        c1 = (h4l & 65535) + (el & 65535);
        c2 = (h4l >>> 16) + (el >>> 16) + (c1 >>> 16);
        c3 = (h4h & 65535) + (eh & 65535) + (c2 >>> 16);
        c4 = (h4h >>> 16) + (eh >>> 16) + (c3 >>> 16);
        this.h4h = c4 << 16 | c3 & 65535;
        this.h4l = c2 << 16 | c1 & 65535;
        c1 = (h5l & 65535) + (fl & 65535);
        c2 = (h5l >>> 16) + (fl >>> 16) + (c1 >>> 16);
        c3 = (h5h & 65535) + (fh & 65535) + (c2 >>> 16);
        c4 = (h5h >>> 16) + (fh >>> 16) + (c3 >>> 16);
        this.h5h = c4 << 16 | c3 & 65535;
        this.h5l = c2 << 16 | c1 & 65535;
        c1 = (h6l & 65535) + (gl & 65535);
        c2 = (h6l >>> 16) + (gl >>> 16) + (c1 >>> 16);
        c3 = (h6h & 65535) + (gh & 65535) + (c2 >>> 16);
        c4 = (h6h >>> 16) + (gh >>> 16) + (c3 >>> 16);
        this.h6h = c4 << 16 | c3 & 65535;
        this.h6l = c2 << 16 | c1 & 65535;
        c1 = (h7l & 65535) + (hl & 65535);
        c2 = (h7l >>> 16) + (hl >>> 16) + (c1 >>> 16);
        c3 = (h7h & 65535) + (hh & 65535) + (c2 >>> 16);
        c4 = (h7h >>> 16) + (hh >>> 16) + (c3 >>> 16);
        this.h7h = c4 << 16 | c3 & 65535;
        this.h7l = c2 << 16 | c1 & 65535;
      };
      Sha512.prototype.hex = function() {
        this.finalize();
        var h0h = this.h0h, h0l = this.h0l, h1h = this.h1h, h1l = this.h1l, h2h = this.h2h, h2l = this.h2l, h3h = this.h3h, h3l = this.h3l, h4h = this.h4h, h4l = this.h4l, h5h = this.h5h, h5l = this.h5l, h6h = this.h6h, h6l = this.h6l, h7h = this.h7h, h7l = this.h7l, bits = this.bits;
        var hex = HEX_CHARS2[h0h >> 28 & 15] + HEX_CHARS2[h0h >> 24 & 15] + HEX_CHARS2[h0h >> 20 & 15] + HEX_CHARS2[h0h >> 16 & 15] + HEX_CHARS2[h0h >> 12 & 15] + HEX_CHARS2[h0h >> 8 & 15] + HEX_CHARS2[h0h >> 4 & 15] + HEX_CHARS2[h0h & 15] + HEX_CHARS2[h0l >> 28 & 15] + HEX_CHARS2[h0l >> 24 & 15] + HEX_CHARS2[h0l >> 20 & 15] + HEX_CHARS2[h0l >> 16 & 15] + HEX_CHARS2[h0l >> 12 & 15] + HEX_CHARS2[h0l >> 8 & 15] + HEX_CHARS2[h0l >> 4 & 15] + HEX_CHARS2[h0l & 15] + HEX_CHARS2[h1h >> 28 & 15] + HEX_CHARS2[h1h >> 24 & 15] + HEX_CHARS2[h1h >> 20 & 15] + HEX_CHARS2[h1h >> 16 & 15] + HEX_CHARS2[h1h >> 12 & 15] + HEX_CHARS2[h1h >> 8 & 15] + HEX_CHARS2[h1h >> 4 & 15] + HEX_CHARS2[h1h & 15] + HEX_CHARS2[h1l >> 28 & 15] + HEX_CHARS2[h1l >> 24 & 15] + HEX_CHARS2[h1l >> 20 & 15] + HEX_CHARS2[h1l >> 16 & 15] + HEX_CHARS2[h1l >> 12 & 15] + HEX_CHARS2[h1l >> 8 & 15] + HEX_CHARS2[h1l >> 4 & 15] + HEX_CHARS2[h1l & 15] + HEX_CHARS2[h2h >> 28 & 15] + HEX_CHARS2[h2h >> 24 & 15] + HEX_CHARS2[h2h >> 20 & 15] + HEX_CHARS2[h2h >> 16 & 15] + HEX_CHARS2[h2h >> 12 & 15] + HEX_CHARS2[h2h >> 8 & 15] + HEX_CHARS2[h2h >> 4 & 15] + HEX_CHARS2[h2h & 15] + HEX_CHARS2[h2l >> 28 & 15] + HEX_CHARS2[h2l >> 24 & 15] + HEX_CHARS2[h2l >> 20 & 15] + HEX_CHARS2[h2l >> 16 & 15] + HEX_CHARS2[h2l >> 12 & 15] + HEX_CHARS2[h2l >> 8 & 15] + HEX_CHARS2[h2l >> 4 & 15] + HEX_CHARS2[h2l & 15] + HEX_CHARS2[h3h >> 28 & 15] + HEX_CHARS2[h3h >> 24 & 15] + HEX_CHARS2[h3h >> 20 & 15] + HEX_CHARS2[h3h >> 16 & 15] + HEX_CHARS2[h3h >> 12 & 15] + HEX_CHARS2[h3h >> 8 & 15] + HEX_CHARS2[h3h >> 4 & 15] + HEX_CHARS2[h3h & 15];
        if (bits >= 256) {
          hex += HEX_CHARS2[h3l >> 28 & 15] + HEX_CHARS2[h3l >> 24 & 15] + HEX_CHARS2[h3l >> 20 & 15] + HEX_CHARS2[h3l >> 16 & 15] + HEX_CHARS2[h3l >> 12 & 15] + HEX_CHARS2[h3l >> 8 & 15] + HEX_CHARS2[h3l >> 4 & 15] + HEX_CHARS2[h3l & 15];
        }
        if (bits >= 384) {
          hex += HEX_CHARS2[h4h >> 28 & 15] + HEX_CHARS2[h4h >> 24 & 15] + HEX_CHARS2[h4h >> 20 & 15] + HEX_CHARS2[h4h >> 16 & 15] + HEX_CHARS2[h4h >> 12 & 15] + HEX_CHARS2[h4h >> 8 & 15] + HEX_CHARS2[h4h >> 4 & 15] + HEX_CHARS2[h4h & 15] + HEX_CHARS2[h4l >> 28 & 15] + HEX_CHARS2[h4l >> 24 & 15] + HEX_CHARS2[h4l >> 20 & 15] + HEX_CHARS2[h4l >> 16 & 15] + HEX_CHARS2[h4l >> 12 & 15] + HEX_CHARS2[h4l >> 8 & 15] + HEX_CHARS2[h4l >> 4 & 15] + HEX_CHARS2[h4l & 15] + HEX_CHARS2[h5h >> 28 & 15] + HEX_CHARS2[h5h >> 24 & 15] + HEX_CHARS2[h5h >> 20 & 15] + HEX_CHARS2[h5h >> 16 & 15] + HEX_CHARS2[h5h >> 12 & 15] + HEX_CHARS2[h5h >> 8 & 15] + HEX_CHARS2[h5h >> 4 & 15] + HEX_CHARS2[h5h & 15] + HEX_CHARS2[h5l >> 28 & 15] + HEX_CHARS2[h5l >> 24 & 15] + HEX_CHARS2[h5l >> 20 & 15] + HEX_CHARS2[h5l >> 16 & 15] + HEX_CHARS2[h5l >> 12 & 15] + HEX_CHARS2[h5l >> 8 & 15] + HEX_CHARS2[h5l >> 4 & 15] + HEX_CHARS2[h5l & 15];
        }
        if (bits == 512) {
          hex += HEX_CHARS2[h6h >> 28 & 15] + HEX_CHARS2[h6h >> 24 & 15] + HEX_CHARS2[h6h >> 20 & 15] + HEX_CHARS2[h6h >> 16 & 15] + HEX_CHARS2[h6h >> 12 & 15] + HEX_CHARS2[h6h >> 8 & 15] + HEX_CHARS2[h6h >> 4 & 15] + HEX_CHARS2[h6h & 15] + HEX_CHARS2[h6l >> 28 & 15] + HEX_CHARS2[h6l >> 24 & 15] + HEX_CHARS2[h6l >> 20 & 15] + HEX_CHARS2[h6l >> 16 & 15] + HEX_CHARS2[h6l >> 12 & 15] + HEX_CHARS2[h6l >> 8 & 15] + HEX_CHARS2[h6l >> 4 & 15] + HEX_CHARS2[h6l & 15] + HEX_CHARS2[h7h >> 28 & 15] + HEX_CHARS2[h7h >> 24 & 15] + HEX_CHARS2[h7h >> 20 & 15] + HEX_CHARS2[h7h >> 16 & 15] + HEX_CHARS2[h7h >> 12 & 15] + HEX_CHARS2[h7h >> 8 & 15] + HEX_CHARS2[h7h >> 4 & 15] + HEX_CHARS2[h7h & 15] + HEX_CHARS2[h7l >> 28 & 15] + HEX_CHARS2[h7l >> 24 & 15] + HEX_CHARS2[h7l >> 20 & 15] + HEX_CHARS2[h7l >> 16 & 15] + HEX_CHARS2[h7l >> 12 & 15] + HEX_CHARS2[h7l >> 8 & 15] + HEX_CHARS2[h7l >> 4 & 15] + HEX_CHARS2[h7l & 15];
        }
        return hex;
      };
      Sha512.prototype.toString = Sha512.prototype.hex;
      Sha512.prototype.digest = function() {
        this.finalize();
        var h0h = this.h0h, h0l = this.h0l, h1h = this.h1h, h1l = this.h1l, h2h = this.h2h, h2l = this.h2l, h3h = this.h3h, h3l = this.h3l, h4h = this.h4h, h4l = this.h4l, h5h = this.h5h, h5l = this.h5l, h6h = this.h6h, h6l = this.h6l, h7h = this.h7h, h7l = this.h7l, bits = this.bits;
        var arr = [
          h0h >> 24 & 255,
          h0h >> 16 & 255,
          h0h >> 8 & 255,
          h0h & 255,
          h0l >> 24 & 255,
          h0l >> 16 & 255,
          h0l >> 8 & 255,
          h0l & 255,
          h1h >> 24 & 255,
          h1h >> 16 & 255,
          h1h >> 8 & 255,
          h1h & 255,
          h1l >> 24 & 255,
          h1l >> 16 & 255,
          h1l >> 8 & 255,
          h1l & 255,
          h2h >> 24 & 255,
          h2h >> 16 & 255,
          h2h >> 8 & 255,
          h2h & 255,
          h2l >> 24 & 255,
          h2l >> 16 & 255,
          h2l >> 8 & 255,
          h2l & 255,
          h3h >> 24 & 255,
          h3h >> 16 & 255,
          h3h >> 8 & 255,
          h3h & 255
        ];
        if (bits >= 256) {
          arr.push(h3l >> 24 & 255, h3l >> 16 & 255, h3l >> 8 & 255, h3l & 255);
        }
        if (bits >= 384) {
          arr.push(h4h >> 24 & 255, h4h >> 16 & 255, h4h >> 8 & 255, h4h & 255, h4l >> 24 & 255, h4l >> 16 & 255, h4l >> 8 & 255, h4l & 255, h5h >> 24 & 255, h5h >> 16 & 255, h5h >> 8 & 255, h5h & 255, h5l >> 24 & 255, h5l >> 16 & 255, h5l >> 8 & 255, h5l & 255);
        }
        if (bits == 512) {
          arr.push(h6h >> 24 & 255, h6h >> 16 & 255, h6h >> 8 & 255, h6h & 255, h6l >> 24 & 255, h6l >> 16 & 255, h6l >> 8 & 255, h6l & 255, h7h >> 24 & 255, h7h >> 16 & 255, h7h >> 8 & 255, h7h & 255, h7l >> 24 & 255, h7l >> 16 & 255, h7l >> 8 & 255, h7l & 255);
        }
        return arr;
      };
      Sha512.prototype.array = Sha512.prototype.digest;
      Sha512.prototype.arrayBuffer = function() {
        this.finalize();
        var bits = this.bits;
        var buffer2 = new ArrayBuffer(bits / 8);
        var dataView = new DataView(buffer2);
        dataView.setUint32(0, this.h0h);
        dataView.setUint32(4, this.h0l);
        dataView.setUint32(8, this.h1h);
        dataView.setUint32(12, this.h1l);
        dataView.setUint32(16, this.h2h);
        dataView.setUint32(20, this.h2l);
        dataView.setUint32(24, this.h3h);
        if (bits >= 256) {
          dataView.setUint32(28, this.h3l);
        }
        if (bits >= 384) {
          dataView.setUint32(32, this.h4h);
          dataView.setUint32(36, this.h4l);
          dataView.setUint32(40, this.h5h);
          dataView.setUint32(44, this.h5l);
        }
        if (bits == 512) {
          dataView.setUint32(48, this.h6h);
          dataView.setUint32(52, this.h6l);
          dataView.setUint32(56, this.h7h);
          dataView.setUint32(60, this.h7l);
        }
        return buffer2;
      };
      Sha512.prototype.clone = function() {
        var hash = new Sha512(this.bits, false);
        this.copyTo(hash);
        return hash;
      };
      Sha512.prototype.copyTo = function(hash) {
        var i = 0, attrs = [
          "h0h",
          "h0l",
          "h1h",
          "h1l",
          "h2h",
          "h2l",
          "h3h",
          "h3l",
          "h4h",
          "h4l",
          "h5h",
          "h5l",
          "h6h",
          "h6l",
          "h7h",
          "h7l",
          "start",
          "bytes",
          "hBytes",
          "finalized",
          "hashed",
          "lastByteIndex"
        ];
        for (i = 0; i < attrs.length; ++i) {
          hash[attrs[i]] = this[attrs[i]];
        }
        for (i = 0; i < this.blocks.length; ++i) {
          hash.blocks[i] = this.blocks[i];
        }
      };
      function HmacSha512(key, bits, sharedMemory) {
        var notString, type = typeof key;
        if (type !== "string") {
          if (type === "object") {
            if (key === null) {
              throw new Error(INPUT_ERROR);
            } else if (ARRAY_BUFFER2 && key.constructor === ArrayBuffer) {
              key = new Uint8Array(key);
            } else if (!Array.isArray(key)) {
              if (!ARRAY_BUFFER2 || !ArrayBuffer.isView(key)) {
                throw new Error(INPUT_ERROR);
              }
            }
          } else {
            throw new Error(INPUT_ERROR);
          }
          notString = true;
        }
        var length = key.length;
        if (!notString) {
          var bytes = [], length = key.length, index = 0, code;
          for (var i = 0; i < length; ++i) {
            code = key.charCodeAt(i);
            if (code < 128) {
              bytes[index++] = code;
            } else if (code < 2048) {
              bytes[index++] = 192 | code >> 6;
              bytes[index++] = 128 | code & 63;
            } else if (code < 55296 || code >= 57344) {
              bytes[index++] = 224 | code >> 12;
              bytes[index++] = 128 | code >> 6 & 63;
              bytes[index++] = 128 | code & 63;
            } else {
              code = 65536 + ((code & 1023) << 10 | key.charCodeAt(++i) & 1023);
              bytes[index++] = 240 | code >> 18;
              bytes[index++] = 128 | code >> 12 & 63;
              bytes[index++] = 128 | code >> 6 & 63;
              bytes[index++] = 128 | code & 63;
            }
          }
          key = bytes;
        }
        if (key.length > 128) {
          key = new Sha512(bits, true).update(key).array();
        }
        var oKeyPad = [], iKeyPad = [];
        for (var i = 0; i < 128; ++i) {
          var b = key[i] || 0;
          oKeyPad[i] = 92 ^ b;
          iKeyPad[i] = 54 ^ b;
        }
        Sha512.call(this, bits, sharedMemory);
        this.update(iKeyPad);
        this.oKeyPad = oKeyPad;
        this.inner = true;
        this.sharedMemory = sharedMemory;
      }
      HmacSha512.prototype = new Sha512();
      HmacSha512.prototype.finalize = function() {
        Sha512.prototype.finalize.call(this);
        if (this.inner) {
          this.inner = false;
          var innerHash = this.array();
          Sha512.call(this, this.bits, this.sharedMemory);
          this.update(this.oKeyPad);
          this.update(innerHash);
          Sha512.prototype.finalize.call(this);
        }
      };
      HmacSha512.prototype.clone = function() {
        var hash = new HmacSha512([], this.bits, false);
        this.copyTo(hash);
        hash.inner = this.inner;
        for (var i = 0; i < this.oKeyPad.length; ++i) {
          hash.oKeyPad[i] = this.oKeyPad[i];
        }
        return hash;
      };
      var exports3 = createMethod2(512);
      exports3.sha512 = exports3;
      exports3.sha384 = createMethod2(384);
      exports3.sha512_256 = createMethod2(256);
      exports3.sha512_224 = createMethod2(224);
      exports3.sha512.hmac = createHmacMethod2(512);
      exports3.sha384.hmac = createHmacMethod2(384);
      exports3.sha512_256.hmac = createHmacMethod2(256);
      exports3.sha512_224.hmac = createHmacMethod2(224);
      if (COMMON_JS2) {
        module2.exports = exports3;
      } else {
        root2.sha512 = exports3.sha512;
        root2.sha384 = exports3.sha384;
        root2.sha512_256 = exports3.sha512_256;
        root2.sha512_224 = exports3.sha512_224;
        if (AMD2) {
          define(function() {
            return exports3;
          });
        }
      }
    })();
  }
});

// node_modules/js-sha3/src/sha3.js
var require_sha3 = __commonJS({
  "node_modules/js-sha3/src/sha3.js"(exports2, module2) {
    (function() {
      "use strict";
      var INPUT_ERROR = "input is invalid type";
      var FINALIZE_ERROR = "finalize already called";
      var WINDOW2 = typeof window === "object";
      var root2 = WINDOW2 ? window : {};
      if (root2.JS_SHA3_NO_WINDOW) {
        WINDOW2 = false;
      }
      var WEB_WORKER2 = !WINDOW2 && typeof self === "object";
      var NODE_JS2 = !root2.JS_SHA3_NO_NODE_JS && typeof process === "object" && process.versions && process.versions.node;
      if (NODE_JS2) {
        root2 = global;
      } else if (WEB_WORKER2) {
        root2 = self;
      }
      var COMMON_JS2 = !root2.JS_SHA3_NO_COMMON_JS && typeof module2 === "object" && module2.exports;
      var AMD2 = typeof define === "function" && define.amd;
      var ARRAY_BUFFER2 = !root2.JS_SHA3_NO_ARRAY_BUFFER && typeof ArrayBuffer !== "undefined";
      var HEX_CHARS2 = "0123456789abcdef".split("");
      var SHAKE_PADDING = [31, 7936, 2031616, 520093696];
      var CSHAKE_PADDING = [4, 1024, 262144, 67108864];
      var KECCAK_PADDING = [1, 256, 65536, 16777216];
      var PADDING = [6, 1536, 393216, 100663296];
      var SHIFT2 = [0, 8, 16, 24];
      var RC = [
        1,
        0,
        32898,
        0,
        32906,
        2147483648,
        2147516416,
        2147483648,
        32907,
        0,
        2147483649,
        0,
        2147516545,
        2147483648,
        32777,
        2147483648,
        138,
        0,
        136,
        0,
        2147516425,
        0,
        2147483658,
        0,
        2147516555,
        0,
        139,
        2147483648,
        32905,
        2147483648,
        32771,
        2147483648,
        32770,
        2147483648,
        128,
        2147483648,
        32778,
        0,
        2147483658,
        2147483648,
        2147516545,
        2147483648,
        32896,
        2147483648,
        2147483649,
        0,
        2147516424,
        2147483648
      ];
      var BITS = [224, 256, 384, 512];
      var SHAKE_BITS = [128, 256];
      var OUTPUT_TYPES2 = ["hex", "buffer", "arrayBuffer", "array", "digest"];
      var CSHAKE_BYTEPAD = {
        "128": 168,
        "256": 136
      };
      if (root2.JS_SHA3_NO_NODE_JS || !Array.isArray) {
        Array.isArray = function(obj) {
          return Object.prototype.toString.call(obj) === "[object Array]";
        };
      }
      if (ARRAY_BUFFER2 && (root2.JS_SHA3_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView)) {
        ArrayBuffer.isView = function(obj) {
          return typeof obj === "object" && obj.buffer && obj.buffer.constructor === ArrayBuffer;
        };
      }
      var createOutputMethod2 = function(bits2, padding, outputType) {
        return function(message) {
          return new Keccak(bits2, padding, bits2).update(message)[outputType]();
        };
      };
      var createShakeOutputMethod = function(bits2, padding, outputType) {
        return function(message, outputBits) {
          return new Keccak(bits2, padding, outputBits).update(message)[outputType]();
        };
      };
      var createCshakeOutputMethod = function(bits2, padding, outputType) {
        return function(message, outputBits, n, s) {
          return methods["cshake" + bits2].update(message, outputBits, n, s)[outputType]();
        };
      };
      var createKmacOutputMethod = function(bits2, padding, outputType) {
        return function(key, message, outputBits, s) {
          return methods["kmac" + bits2].update(key, message, outputBits, s)[outputType]();
        };
      };
      var createOutputMethods = function(method2, createMethod3, bits2, padding) {
        for (var i2 = 0; i2 < OUTPUT_TYPES2.length; ++i2) {
          var type = OUTPUT_TYPES2[i2];
          method2[type] = createMethod3(bits2, padding, type);
        }
        return method2;
      };
      var createMethod2 = function(bits2, padding) {
        var method2 = createOutputMethod2(bits2, padding, "hex");
        method2.create = function() {
          return new Keccak(bits2, padding, bits2);
        };
        method2.update = function(message) {
          return method2.create().update(message);
        };
        return createOutputMethods(method2, createOutputMethod2, bits2, padding);
      };
      var createShakeMethod = function(bits2, padding) {
        var method2 = createShakeOutputMethod(bits2, padding, "hex");
        method2.create = function(outputBits) {
          return new Keccak(bits2, padding, outputBits);
        };
        method2.update = function(message, outputBits) {
          return method2.create(outputBits).update(message);
        };
        return createOutputMethods(method2, createShakeOutputMethod, bits2, padding);
      };
      var createCshakeMethod = function(bits2, padding) {
        var w = CSHAKE_BYTEPAD[bits2];
        var method2 = createCshakeOutputMethod(bits2, padding, "hex");
        method2.create = function(outputBits, n, s) {
          if (!n && !s) {
            return methods["shake" + bits2].create(outputBits);
          } else {
            return new Keccak(bits2, padding, outputBits).bytepad([n, s], w);
          }
        };
        method2.update = function(message, outputBits, n, s) {
          return method2.create(outputBits, n, s).update(message);
        };
        return createOutputMethods(method2, createCshakeOutputMethod, bits2, padding);
      };
      var createKmacMethod = function(bits2, padding) {
        var w = CSHAKE_BYTEPAD[bits2];
        var method2 = createKmacOutputMethod(bits2, padding, "hex");
        method2.create = function(key, outputBits, s) {
          return new Kmac(bits2, padding, outputBits).bytepad(["KMAC", s], w).bytepad([key], w);
        };
        method2.update = function(key, message, outputBits, s) {
          return method2.create(key, outputBits, s).update(message);
        };
        return createOutputMethods(method2, createKmacOutputMethod, bits2, padding);
      };
      var algorithms = [
        { name: "keccak", padding: KECCAK_PADDING, bits: BITS, createMethod: createMethod2 },
        { name: "sha3", padding: PADDING, bits: BITS, createMethod: createMethod2 },
        { name: "shake", padding: SHAKE_PADDING, bits: SHAKE_BITS, createMethod: createShakeMethod },
        { name: "cshake", padding: CSHAKE_PADDING, bits: SHAKE_BITS, createMethod: createCshakeMethod },
        { name: "kmac", padding: CSHAKE_PADDING, bits: SHAKE_BITS, createMethod: createKmacMethod }
      ];
      var methods = {}, methodNames = [];
      for (var i = 0; i < algorithms.length; ++i) {
        var algorithm2 = algorithms[i];
        var bits = algorithm2.bits;
        for (var j = 0; j < bits.length; ++j) {
          var methodName = algorithm2.name + "_" + bits[j];
          methodNames.push(methodName);
          methods[methodName] = algorithm2.createMethod(bits[j], algorithm2.padding);
          if (algorithm2.name !== "sha3") {
            var newMethodName = algorithm2.name + bits[j];
            methodNames.push(newMethodName);
            methods[newMethodName] = methods[methodName];
          }
        }
      }
      function Keccak(bits2, padding, outputBits) {
        this.blocks = [];
        this.s = [];
        this.padding = padding;
        this.outputBits = outputBits;
        this.reset = true;
        this.finalized = false;
        this.block = 0;
        this.start = 0;
        this.blockCount = 1600 - (bits2 << 1) >> 5;
        this.byteCount = this.blockCount << 2;
        this.outputBlocks = outputBits >> 5;
        this.extraBytes = (outputBits & 31) >> 3;
        for (var i2 = 0; i2 < 50; ++i2) {
          this.s[i2] = 0;
        }
      }
      Keccak.prototype.update = function(message) {
        if (this.finalized) {
          throw new Error(FINALIZE_ERROR);
        }
        var notString, type = typeof message;
        if (type !== "string") {
          if (type === "object") {
            if (message === null) {
              throw new Error(INPUT_ERROR);
            } else if (ARRAY_BUFFER2 && message.constructor === ArrayBuffer) {
              message = new Uint8Array(message);
            } else if (!Array.isArray(message)) {
              if (!ARRAY_BUFFER2 || !ArrayBuffer.isView(message)) {
                throw new Error(INPUT_ERROR);
              }
            }
          } else {
            throw new Error(INPUT_ERROR);
          }
          notString = true;
        }
        var blocks2 = this.blocks, byteCount = this.byteCount, length = message.length, blockCount = this.blockCount, index = 0, s = this.s, i2, code;
        while (index < length) {
          if (this.reset) {
            this.reset = false;
            blocks2[0] = this.block;
            for (i2 = 1; i2 < blockCount + 1; ++i2) {
              blocks2[i2] = 0;
            }
          }
          if (notString) {
            for (i2 = this.start; index < length && i2 < byteCount; ++index) {
              blocks2[i2 >> 2] |= message[index] << SHIFT2[i2++ & 3];
            }
          } else {
            for (i2 = this.start; index < length && i2 < byteCount; ++index) {
              code = message.charCodeAt(index);
              if (code < 128) {
                blocks2[i2 >> 2] |= code << SHIFT2[i2++ & 3];
              } else if (code < 2048) {
                blocks2[i2 >> 2] |= (192 | code >> 6) << SHIFT2[i2++ & 3];
                blocks2[i2 >> 2] |= (128 | code & 63) << SHIFT2[i2++ & 3];
              } else if (code < 55296 || code >= 57344) {
                blocks2[i2 >> 2] |= (224 | code >> 12) << SHIFT2[i2++ & 3];
                blocks2[i2 >> 2] |= (128 | code >> 6 & 63) << SHIFT2[i2++ & 3];
                blocks2[i2 >> 2] |= (128 | code & 63) << SHIFT2[i2++ & 3];
              } else {
                code = 65536 + ((code & 1023) << 10 | message.charCodeAt(++index) & 1023);
                blocks2[i2 >> 2] |= (240 | code >> 18) << SHIFT2[i2++ & 3];
                blocks2[i2 >> 2] |= (128 | code >> 12 & 63) << SHIFT2[i2++ & 3];
                blocks2[i2 >> 2] |= (128 | code >> 6 & 63) << SHIFT2[i2++ & 3];
                blocks2[i2 >> 2] |= (128 | code & 63) << SHIFT2[i2++ & 3];
              }
            }
          }
          this.lastByteIndex = i2;
          if (i2 >= byteCount) {
            this.start = i2 - byteCount;
            this.block = blocks2[blockCount];
            for (i2 = 0; i2 < blockCount; ++i2) {
              s[i2] ^= blocks2[i2];
            }
            f2(s);
            this.reset = true;
          } else {
            this.start = i2;
          }
        }
        return this;
      };
      Keccak.prototype.encode = function(x, right) {
        var o = x & 255, n = 1;
        var bytes = [o];
        x = x >> 8;
        o = x & 255;
        while (o > 0) {
          bytes.unshift(o);
          x = x >> 8;
          o = x & 255;
          ++n;
        }
        if (right) {
          bytes.push(n);
        } else {
          bytes.unshift(n);
        }
        this.update(bytes);
        return bytes.length;
      };
      Keccak.prototype.encodeString = function(str) {
        var notString, type = typeof str;
        if (type !== "string") {
          if (type === "object") {
            if (str === null) {
              throw new Error(INPUT_ERROR);
            } else if (ARRAY_BUFFER2 && str.constructor === ArrayBuffer) {
              str = new Uint8Array(str);
            } else if (!Array.isArray(str)) {
              if (!ARRAY_BUFFER2 || !ArrayBuffer.isView(str)) {
                throw new Error(INPUT_ERROR);
              }
            }
          } else {
            throw new Error(INPUT_ERROR);
          }
          notString = true;
        }
        var bytes = 0, length = str.length;
        if (notString) {
          bytes = length;
        } else {
          for (var i2 = 0; i2 < str.length; ++i2) {
            var code = str.charCodeAt(i2);
            if (code < 128) {
              bytes += 1;
            } else if (code < 2048) {
              bytes += 2;
            } else if (code < 55296 || code >= 57344) {
              bytes += 3;
            } else {
              code = 65536 + ((code & 1023) << 10 | str.charCodeAt(++i2) & 1023);
              bytes += 4;
            }
          }
        }
        bytes += this.encode(bytes * 8);
        this.update(str);
        return bytes;
      };
      Keccak.prototype.bytepad = function(strs, w) {
        var bytes = this.encode(w);
        for (var i2 = 0; i2 < strs.length; ++i2) {
          bytes += this.encodeString(strs[i2]);
        }
        var paddingBytes = w - bytes % w;
        var zeros = [];
        zeros.length = paddingBytes;
        this.update(zeros);
        return this;
      };
      Keccak.prototype.finalize = function() {
        if (this.finalized) {
          return;
        }
        this.finalized = true;
        var blocks2 = this.blocks, i2 = this.lastByteIndex, blockCount = this.blockCount, s = this.s;
        blocks2[i2 >> 2] |= this.padding[i2 & 3];
        if (this.lastByteIndex === this.byteCount) {
          blocks2[0] = blocks2[blockCount];
          for (i2 = 1; i2 < blockCount + 1; ++i2) {
            blocks2[i2] = 0;
          }
        }
        blocks2[blockCount - 1] |= 2147483648;
        for (i2 = 0; i2 < blockCount; ++i2) {
          s[i2] ^= blocks2[i2];
        }
        f2(s);
      };
      Keccak.prototype.toString = Keccak.prototype.hex = function() {
        this.finalize();
        var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks, extraBytes = this.extraBytes, i2 = 0, j2 = 0;
        var hex = "", block;
        while (j2 < outputBlocks) {
          for (i2 = 0; i2 < blockCount && j2 < outputBlocks; ++i2, ++j2) {
            block = s[i2];
            hex += HEX_CHARS2[block >> 4 & 15] + HEX_CHARS2[block & 15] + HEX_CHARS2[block >> 12 & 15] + HEX_CHARS2[block >> 8 & 15] + HEX_CHARS2[block >> 20 & 15] + HEX_CHARS2[block >> 16 & 15] + HEX_CHARS2[block >> 28 & 15] + HEX_CHARS2[block >> 24 & 15];
          }
          if (j2 % blockCount === 0) {
            f2(s);
            i2 = 0;
          }
        }
        if (extraBytes) {
          block = s[i2];
          hex += HEX_CHARS2[block >> 4 & 15] + HEX_CHARS2[block & 15];
          if (extraBytes > 1) {
            hex += HEX_CHARS2[block >> 12 & 15] + HEX_CHARS2[block >> 8 & 15];
          }
          if (extraBytes > 2) {
            hex += HEX_CHARS2[block >> 20 & 15] + HEX_CHARS2[block >> 16 & 15];
          }
        }
        return hex;
      };
      Keccak.prototype.arrayBuffer = function() {
        this.finalize();
        var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks, extraBytes = this.extraBytes, i2 = 0, j2 = 0;
        var bytes = this.outputBits >> 3;
        var buffer2;
        if (extraBytes) {
          buffer2 = new ArrayBuffer(outputBlocks + 1 << 2);
        } else {
          buffer2 = new ArrayBuffer(bytes);
        }
        var array = new Uint32Array(buffer2);
        while (j2 < outputBlocks) {
          for (i2 = 0; i2 < blockCount && j2 < outputBlocks; ++i2, ++j2) {
            array[j2] = s[i2];
          }
          if (j2 % blockCount === 0) {
            f2(s);
          }
        }
        if (extraBytes) {
          array[i2] = s[i2];
          buffer2 = buffer2.slice(0, bytes);
        }
        return buffer2;
      };
      Keccak.prototype.buffer = Keccak.prototype.arrayBuffer;
      Keccak.prototype.digest = Keccak.prototype.array = function() {
        this.finalize();
        var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks, extraBytes = this.extraBytes, i2 = 0, j2 = 0;
        var array = [], offset, block;
        while (j2 < outputBlocks) {
          for (i2 = 0; i2 < blockCount && j2 < outputBlocks; ++i2, ++j2) {
            offset = j2 << 2;
            block = s[i2];
            array[offset] = block & 255;
            array[offset + 1] = block >> 8 & 255;
            array[offset + 2] = block >> 16 & 255;
            array[offset + 3] = block >> 24 & 255;
          }
          if (j2 % blockCount === 0) {
            f2(s);
          }
        }
        if (extraBytes) {
          offset = j2 << 2;
          block = s[i2];
          array[offset] = block & 255;
          if (extraBytes > 1) {
            array[offset + 1] = block >> 8 & 255;
          }
          if (extraBytes > 2) {
            array[offset + 2] = block >> 16 & 255;
          }
        }
        return array;
      };
      function Kmac(bits2, padding, outputBits) {
        Keccak.call(this, bits2, padding, outputBits);
      }
      Kmac.prototype = new Keccak();
      Kmac.prototype.finalize = function() {
        this.encode(this.outputBits, true);
        return Keccak.prototype.finalize.call(this);
      };
      var f2 = function(s) {
        var h, l, n, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17, b18, b19, b20, b21, b22, b23, b24, b25, b26, b27, b28, b29, b30, b31, b32, b33, b34, b35, b36, b37, b38, b39, b40, b41, b42, b43, b44, b45, b46, b47, b48, b49;
        for (n = 0; n < 48; n += 2) {
          c0 = s[0] ^ s[10] ^ s[20] ^ s[30] ^ s[40];
          c1 = s[1] ^ s[11] ^ s[21] ^ s[31] ^ s[41];
          c2 = s[2] ^ s[12] ^ s[22] ^ s[32] ^ s[42];
          c3 = s[3] ^ s[13] ^ s[23] ^ s[33] ^ s[43];
          c4 = s[4] ^ s[14] ^ s[24] ^ s[34] ^ s[44];
          c5 = s[5] ^ s[15] ^ s[25] ^ s[35] ^ s[45];
          c6 = s[6] ^ s[16] ^ s[26] ^ s[36] ^ s[46];
          c7 = s[7] ^ s[17] ^ s[27] ^ s[37] ^ s[47];
          c8 = s[8] ^ s[18] ^ s[28] ^ s[38] ^ s[48];
          c9 = s[9] ^ s[19] ^ s[29] ^ s[39] ^ s[49];
          h = c8 ^ (c2 << 1 | c3 >>> 31);
          l = c9 ^ (c3 << 1 | c2 >>> 31);
          s[0] ^= h;
          s[1] ^= l;
          s[10] ^= h;
          s[11] ^= l;
          s[20] ^= h;
          s[21] ^= l;
          s[30] ^= h;
          s[31] ^= l;
          s[40] ^= h;
          s[41] ^= l;
          h = c0 ^ (c4 << 1 | c5 >>> 31);
          l = c1 ^ (c5 << 1 | c4 >>> 31);
          s[2] ^= h;
          s[3] ^= l;
          s[12] ^= h;
          s[13] ^= l;
          s[22] ^= h;
          s[23] ^= l;
          s[32] ^= h;
          s[33] ^= l;
          s[42] ^= h;
          s[43] ^= l;
          h = c2 ^ (c6 << 1 | c7 >>> 31);
          l = c3 ^ (c7 << 1 | c6 >>> 31);
          s[4] ^= h;
          s[5] ^= l;
          s[14] ^= h;
          s[15] ^= l;
          s[24] ^= h;
          s[25] ^= l;
          s[34] ^= h;
          s[35] ^= l;
          s[44] ^= h;
          s[45] ^= l;
          h = c4 ^ (c8 << 1 | c9 >>> 31);
          l = c5 ^ (c9 << 1 | c8 >>> 31);
          s[6] ^= h;
          s[7] ^= l;
          s[16] ^= h;
          s[17] ^= l;
          s[26] ^= h;
          s[27] ^= l;
          s[36] ^= h;
          s[37] ^= l;
          s[46] ^= h;
          s[47] ^= l;
          h = c6 ^ (c0 << 1 | c1 >>> 31);
          l = c7 ^ (c1 << 1 | c0 >>> 31);
          s[8] ^= h;
          s[9] ^= l;
          s[18] ^= h;
          s[19] ^= l;
          s[28] ^= h;
          s[29] ^= l;
          s[38] ^= h;
          s[39] ^= l;
          s[48] ^= h;
          s[49] ^= l;
          b0 = s[0];
          b1 = s[1];
          b32 = s[11] << 4 | s[10] >>> 28;
          b33 = s[10] << 4 | s[11] >>> 28;
          b14 = s[20] << 3 | s[21] >>> 29;
          b15 = s[21] << 3 | s[20] >>> 29;
          b46 = s[31] << 9 | s[30] >>> 23;
          b47 = s[30] << 9 | s[31] >>> 23;
          b28 = s[40] << 18 | s[41] >>> 14;
          b29 = s[41] << 18 | s[40] >>> 14;
          b20 = s[2] << 1 | s[3] >>> 31;
          b21 = s[3] << 1 | s[2] >>> 31;
          b2 = s[13] << 12 | s[12] >>> 20;
          b3 = s[12] << 12 | s[13] >>> 20;
          b34 = s[22] << 10 | s[23] >>> 22;
          b35 = s[23] << 10 | s[22] >>> 22;
          b16 = s[33] << 13 | s[32] >>> 19;
          b17 = s[32] << 13 | s[33] >>> 19;
          b48 = s[42] << 2 | s[43] >>> 30;
          b49 = s[43] << 2 | s[42] >>> 30;
          b40 = s[5] << 30 | s[4] >>> 2;
          b41 = s[4] << 30 | s[5] >>> 2;
          b22 = s[14] << 6 | s[15] >>> 26;
          b23 = s[15] << 6 | s[14] >>> 26;
          b4 = s[25] << 11 | s[24] >>> 21;
          b5 = s[24] << 11 | s[25] >>> 21;
          b36 = s[34] << 15 | s[35] >>> 17;
          b37 = s[35] << 15 | s[34] >>> 17;
          b18 = s[45] << 29 | s[44] >>> 3;
          b19 = s[44] << 29 | s[45] >>> 3;
          b10 = s[6] << 28 | s[7] >>> 4;
          b11 = s[7] << 28 | s[6] >>> 4;
          b42 = s[17] << 23 | s[16] >>> 9;
          b43 = s[16] << 23 | s[17] >>> 9;
          b24 = s[26] << 25 | s[27] >>> 7;
          b25 = s[27] << 25 | s[26] >>> 7;
          b6 = s[36] << 21 | s[37] >>> 11;
          b7 = s[37] << 21 | s[36] >>> 11;
          b38 = s[47] << 24 | s[46] >>> 8;
          b39 = s[46] << 24 | s[47] >>> 8;
          b30 = s[8] << 27 | s[9] >>> 5;
          b31 = s[9] << 27 | s[8] >>> 5;
          b12 = s[18] << 20 | s[19] >>> 12;
          b13 = s[19] << 20 | s[18] >>> 12;
          b44 = s[29] << 7 | s[28] >>> 25;
          b45 = s[28] << 7 | s[29] >>> 25;
          b26 = s[38] << 8 | s[39] >>> 24;
          b27 = s[39] << 8 | s[38] >>> 24;
          b8 = s[48] << 14 | s[49] >>> 18;
          b9 = s[49] << 14 | s[48] >>> 18;
          s[0] = b0 ^ ~b2 & b4;
          s[1] = b1 ^ ~b3 & b5;
          s[10] = b10 ^ ~b12 & b14;
          s[11] = b11 ^ ~b13 & b15;
          s[20] = b20 ^ ~b22 & b24;
          s[21] = b21 ^ ~b23 & b25;
          s[30] = b30 ^ ~b32 & b34;
          s[31] = b31 ^ ~b33 & b35;
          s[40] = b40 ^ ~b42 & b44;
          s[41] = b41 ^ ~b43 & b45;
          s[2] = b2 ^ ~b4 & b6;
          s[3] = b3 ^ ~b5 & b7;
          s[12] = b12 ^ ~b14 & b16;
          s[13] = b13 ^ ~b15 & b17;
          s[22] = b22 ^ ~b24 & b26;
          s[23] = b23 ^ ~b25 & b27;
          s[32] = b32 ^ ~b34 & b36;
          s[33] = b33 ^ ~b35 & b37;
          s[42] = b42 ^ ~b44 & b46;
          s[43] = b43 ^ ~b45 & b47;
          s[4] = b4 ^ ~b6 & b8;
          s[5] = b5 ^ ~b7 & b9;
          s[14] = b14 ^ ~b16 & b18;
          s[15] = b15 ^ ~b17 & b19;
          s[24] = b24 ^ ~b26 & b28;
          s[25] = b25 ^ ~b27 & b29;
          s[34] = b34 ^ ~b36 & b38;
          s[35] = b35 ^ ~b37 & b39;
          s[44] = b44 ^ ~b46 & b48;
          s[45] = b45 ^ ~b47 & b49;
          s[6] = b6 ^ ~b8 & b0;
          s[7] = b7 ^ ~b9 & b1;
          s[16] = b16 ^ ~b18 & b10;
          s[17] = b17 ^ ~b19 & b11;
          s[26] = b26 ^ ~b28 & b20;
          s[27] = b27 ^ ~b29 & b21;
          s[36] = b36 ^ ~b38 & b30;
          s[37] = b37 ^ ~b39 & b31;
          s[46] = b46 ^ ~b48 & b40;
          s[47] = b47 ^ ~b49 & b41;
          s[8] = b8 ^ ~b0 & b2;
          s[9] = b9 ^ ~b1 & b3;
          s[18] = b18 ^ ~b10 & b12;
          s[19] = b19 ^ ~b11 & b13;
          s[28] = b28 ^ ~b20 & b22;
          s[29] = b29 ^ ~b21 & b23;
          s[38] = b38 ^ ~b30 & b32;
          s[39] = b39 ^ ~b31 & b33;
          s[48] = b48 ^ ~b40 & b42;
          s[49] = b49 ^ ~b41 & b43;
          s[0] ^= RC[n];
          s[1] ^= RC[n + 1];
        }
      };
      if (COMMON_JS2) {
        module2.exports = methods;
      } else {
        for (i = 0; i < methodNames.length; ++i) {
          root2[methodNames[i]] = methods[methodNames[i]];
        }
        if (AMD2) {
          define(function() {
            return methods;
          });
        }
      }
    })();
  }
});

// node_modules/getopts/index.js
var EMPTYARR = [];
var SHORTSPLIT = /$|[!-@[-`{-~][\s\S]*/g;
var isArray = Array.isArray;
var parseValue = function(any) {
  if (any === "")
    return "";
  if (any === "false")
    return false;
  const maybe = +any;
  return maybe * 0 === 0 ? maybe : any;
};
var parseAlias = function(aliases) {
  let out = {}, alias, prev, any;
  for (let key in aliases) {
    any = aliases[key];
    alias = out[key] = isArray(any) ? any : [any];
    for (let i = 0; i < alias.length; i++) {
      prev = out[alias[i]] = [key];
      for (let k = 0; k < alias.length; k++) {
        if (i !== k)
          prev.push(alias[k]);
      }
    }
  }
  return out;
};
var parseDefault = function(aliases, defaults) {
  let out = {}, alias, value;
  for (let key in defaults) {
    alias = aliases[key];
    value = defaults[key];
    out[key] = value;
    if (alias === void 0) {
      aliases[key] = EMPTYARR;
    } else {
      for (let i = 0; i < alias.length; i++) {
        out[alias[i]] = value;
      }
    }
  }
  return out;
};
var parseOptions = function(aliases, options, value) {
  let out = {}, key, alias;
  if (options !== void 0) {
    for (let i = 0; i < options.length; i++) {
      key = options[i];
      alias = aliases[key];
      out[key] = value;
      if (alias === void 0) {
        aliases[key] = EMPTYARR;
      } else {
        for (let k = 0, end = alias.length; k < end; k++) {
          out[alias[k]] = value;
        }
      }
    }
  }
  return out;
};
var write = function(out, key, value, aliases, unknown) {
  let prev, alias = aliases[key], len = alias === void 0 ? -1 : alias.length;
  if (len >= 0 || unknown === void 0 || unknown(key)) {
    prev = out[key];
    if (prev === void 0) {
      out[key] = value;
    } else {
      if (isArray(prev)) {
        prev.push(value);
      } else {
        out[key] = [prev, value];
      }
    }
    for (let i = 0; i < len; i++) {
      out[alias[i]] = out[key];
    }
  }
};
function getopts_default(argv, opts) {
  let unknown = (opts = opts || {}).unknown, aliases = parseAlias(opts.alias), strings = parseOptions(aliases, opts.string, ""), values = parseDefault(aliases, opts.default), bools = parseOptions(aliases, opts.boolean, false), stopEarly = opts.stopEarly, _ = [], out = { _ }, key, arg, end, match, value;
  for (let i = 0, len = argv.length; i < len; i++) {
    arg = argv[i];
    if (arg[0] !== "-" || arg === "-") {
      if (stopEarly) {
        while (i < len) {
          _.push(argv[i++]);
        }
      } else {
        _.push(arg);
      }
    } else if (arg === "--") {
      while (++i < len) {
        _.push(argv[i]);
      }
    } else if (arg[1] === "-") {
      end = arg.indexOf("=", 2);
      if (arg[2] === "n" && arg[3] === "o" && arg[4] === "-") {
        key = arg.slice(5, end >= 0 ? end : void 0);
        value = false;
      } else if (end >= 0) {
        key = arg.slice(2, end);
        value = bools[key] !== void 0 || (strings[key] === void 0 ? parseValue(arg.slice(end + 1)) : arg.slice(end + 1));
      } else {
        key = arg.slice(2);
        value = bools[key] !== void 0 || (len === i + 1 || argv[i + 1][0] === "-" ? strings[key] === void 0 ? true : "" : strings[key] === void 0 ? parseValue(argv[++i]) : argv[++i]);
      }
      write(out, key, value, aliases, unknown);
    } else {
      SHORTSPLIT.lastIndex = 2;
      match = SHORTSPLIT.exec(arg);
      end = match.index;
      value = match[0];
      for (let k = 1; k < end; k++) {
        write(out, key = arg[k], k + 1 < end ? strings[key] === void 0 || arg.substring(k + 1, k = end) + value : value === "" ? len === i + 1 || argv[i + 1][0] === "-" ? strings[key] === void 0 || "" : bools[key] !== void 0 || (strings[key] === void 0 ? parseValue(argv[++i]) : argv[++i]) : bools[key] !== void 0 || (strings[key] === void 0 ? parseValue(value) : value), aliases, unknown);
      }
    }
  }
  for (let key2 in values)
    if (out[key2] === void 0)
      out[key2] = values[key2];
  for (let key2 in bools)
    if (out[key2] === void 0)
      out[key2] = false;
  for (let key2 in strings)
    if (out[key2] === void 0)
      out[key2] = "";
  return out;
}

// src/js/stdlib/index.js
var import_ipaddr = __toESM(require_ipaddr());
var import_path_browserify = __toESM(require_path_browserify());

// node_modules/uuid/dist/esm-browser/index.js
var esm_browser_exports = {};
__export(esm_browser_exports, {
  NIL: () => nil_default,
  parse: () => parse_default,
  stringify: () => stringify_default,
  v1: () => v1_default,
  v3: () => v3_default,
  v4: () => v4_default,
  v5: () => v5_default,
  validate: () => validate_default,
  version: () => version_default
});

// node_modules/uuid/dist/esm-browser/rng.js
var getRandomValues;
var rnds8 = new Uint8Array(16);
function rng() {
  if (!getRandomValues) {
    getRandomValues = typeof crypto !== "undefined" && crypto.getRandomValues && crypto.getRandomValues.bind(crypto) || typeof msCrypto !== "undefined" && typeof msCrypto.getRandomValues === "function" && msCrypto.getRandomValues.bind(msCrypto);
    if (!getRandomValues) {
      throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    }
  }
  return getRandomValues(rnds8);
}

// node_modules/uuid/dist/esm-browser/regex.js
var regex_default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

// node_modules/uuid/dist/esm-browser/validate.js
function validate(uuid) {
  return typeof uuid === "string" && regex_default.test(uuid);
}
var validate_default = validate;

// node_modules/uuid/dist/esm-browser/stringify.js
var byteToHex = [];
for (i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).substr(1));
}
var i;
function stringify(arr) {
  var offset = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
  var uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
  if (!validate_default(uuid)) {
    throw TypeError("Stringified UUID is invalid");
  }
  return uuid;
}
var stringify_default = stringify;

// node_modules/uuid/dist/esm-browser/v1.js
var _nodeId;
var _clockseq;
var _lastMSecs = 0;
var _lastNSecs = 0;
function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || new Array(16);
  options = options || {};
  var node = options.node || _nodeId;
  var clockseq = options.clockseq !== void 0 ? options.clockseq : _clockseq;
  if (node == null || clockseq == null) {
    var seedBytes = options.random || (options.rng || rng)();
    if (node == null) {
      node = _nodeId = [seedBytes[0] | 1, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
    }
    if (clockseq == null) {
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 16383;
    }
  }
  var msecs = options.msecs !== void 0 ? options.msecs : Date.now();
  var nsecs = options.nsecs !== void 0 ? options.nsecs : _lastNSecs + 1;
  var dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 1e4;
  if (dt < 0 && options.clockseq === void 0) {
    clockseq = clockseq + 1 & 16383;
  }
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === void 0) {
    nsecs = 0;
  }
  if (nsecs >= 1e4) {
    throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
  }
  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;
  msecs += 122192928e5;
  var tl = ((msecs & 268435455) * 1e4 + nsecs) % 4294967296;
  b[i++] = tl >>> 24 & 255;
  b[i++] = tl >>> 16 & 255;
  b[i++] = tl >>> 8 & 255;
  b[i++] = tl & 255;
  var tmh = msecs / 4294967296 * 1e4 & 268435455;
  b[i++] = tmh >>> 8 & 255;
  b[i++] = tmh & 255;
  b[i++] = tmh >>> 24 & 15 | 16;
  b[i++] = tmh >>> 16 & 255;
  b[i++] = clockseq >>> 8 | 128;
  b[i++] = clockseq & 255;
  for (var n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }
  return buf || stringify_default(b);
}
var v1_default = v1;

// node_modules/uuid/dist/esm-browser/parse.js
function parse(uuid) {
  if (!validate_default(uuid)) {
    throw TypeError("Invalid UUID");
  }
  var v;
  var arr = new Uint8Array(16);
  arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
  arr[1] = v >>> 16 & 255;
  arr[2] = v >>> 8 & 255;
  arr[3] = v & 255;
  arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
  arr[5] = v & 255;
  arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
  arr[7] = v & 255;
  arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
  arr[9] = v & 255;
  arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 1099511627776 & 255;
  arr[11] = v / 4294967296 & 255;
  arr[12] = v >>> 24 & 255;
  arr[13] = v >>> 16 & 255;
  arr[14] = v >>> 8 & 255;
  arr[15] = v & 255;
  return arr;
}
var parse_default = parse;

// node_modules/uuid/dist/esm-browser/v35.js
function stringToBytes(str) {
  str = unescape(encodeURIComponent(str));
  var bytes = [];
  for (var i = 0; i < str.length; ++i) {
    bytes.push(str.charCodeAt(i));
  }
  return bytes;
}
var DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
var URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
function v35_default(name, version2, hashfunc) {
  function generateUUID(value, namespace, buf, offset) {
    if (typeof value === "string") {
      value = stringToBytes(value);
    }
    if (typeof namespace === "string") {
      namespace = parse_default(namespace);
    }
    if (namespace.length !== 16) {
      throw TypeError("Namespace must be array-like (16 iterable integer values, 0-255)");
    }
    var bytes = new Uint8Array(16 + value.length);
    bytes.set(namespace);
    bytes.set(value, namespace.length);
    bytes = hashfunc(bytes);
    bytes[6] = bytes[6] & 15 | version2;
    bytes[8] = bytes[8] & 63 | 128;
    if (buf) {
      offset = offset || 0;
      for (var i = 0; i < 16; ++i) {
        buf[offset + i] = bytes[i];
      }
      return buf;
    }
    return stringify_default(bytes);
  }
  try {
    generateUUID.name = name;
  } catch (err) {
  }
  generateUUID.DNS = DNS;
  generateUUID.URL = URL;
  return generateUUID;
}

// node_modules/uuid/dist/esm-browser/md5.js
function md5(bytes) {
  if (typeof bytes === "string") {
    var msg = unescape(encodeURIComponent(bytes));
    bytes = new Uint8Array(msg.length);
    for (var i = 0; i < msg.length; ++i) {
      bytes[i] = msg.charCodeAt(i);
    }
  }
  return md5ToHexEncodedArray(wordsToMd5(bytesToWords(bytes), bytes.length * 8));
}
function md5ToHexEncodedArray(input) {
  var output = [];
  var length32 = input.length * 32;
  var hexTab = "0123456789abcdef";
  for (var i = 0; i < length32; i += 8) {
    var x = input[i >> 5] >>> i % 32 & 255;
    var hex = parseInt(hexTab.charAt(x >>> 4 & 15) + hexTab.charAt(x & 15), 16);
    output.push(hex);
  }
  return output;
}
function getOutputLength(inputLength8) {
  return (inputLength8 + 64 >>> 9 << 4) + 14 + 1;
}
function wordsToMd5(x, len) {
  x[len >> 5] |= 128 << len % 32;
  x[getOutputLength(len) - 1] = len;
  var a = 1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d = 271733878;
  for (var i = 0; i < x.length; i += 16) {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    a = md5ff(a, b, c, d, x[i], 7, -680876936);
    d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
    b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = md5gg(b, c, d, a, x[i], 20, -373897302);
    a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
    d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = md5hh(d, a, b, c, x[i], 11, -358537222);
    c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = md5ii(a, b, c, d, x[i], 6, -198630844);
    d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }
  return [a, b, c, d];
}
function bytesToWords(input) {
  if (input.length === 0) {
    return [];
  }
  var length8 = input.length * 8;
  var output = new Uint32Array(getOutputLength(length8));
  for (var i = 0; i < length8; i += 8) {
    output[i >> 5] |= (input[i / 8] & 255) << i % 32;
  }
  return output;
}
function safeAdd(x, y) {
  var lsw = (x & 65535) + (y & 65535);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return msw << 16 | lsw & 65535;
}
function bitRotateLeft(num, cnt) {
  return num << cnt | num >>> 32 - cnt;
}
function md5cmn(q, a, b, x, s, t) {
  return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}
function md5ff(a, b, c, d, x, s, t) {
  return md5cmn(b & c | ~b & d, a, b, x, s, t);
}
function md5gg(a, b, c, d, x, s, t) {
  return md5cmn(b & d | c & ~d, a, b, x, s, t);
}
function md5hh(a, b, c, d, x, s, t) {
  return md5cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5ii(a, b, c, d, x, s, t) {
  return md5cmn(c ^ (b | ~d), a, b, x, s, t);
}
var md5_default = md5;

// node_modules/uuid/dist/esm-browser/v3.js
var v3 = v35_default("v3", 48, md5_default);
var v3_default = v3;

// node_modules/uuid/dist/esm-browser/v4.js
function v4(options, buf, offset) {
  options = options || {};
  var rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    for (var i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return stringify_default(rnds);
}
var v4_default = v4;

// node_modules/uuid/dist/esm-browser/sha1.js
function f(s, x, y, z) {
  switch (s) {
    case 0:
      return x & y ^ ~x & z;
    case 1:
      return x ^ y ^ z;
    case 2:
      return x & y ^ x & z ^ y & z;
    case 3:
      return x ^ y ^ z;
  }
}
function ROTL(x, n) {
  return x << n | x >>> 32 - n;
}
function sha1(bytes) {
  var K2 = [1518500249, 1859775393, 2400959708, 3395469782];
  var H = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
  if (typeof bytes === "string") {
    var msg = unescape(encodeURIComponent(bytes));
    bytes = [];
    for (var i = 0; i < msg.length; ++i) {
      bytes.push(msg.charCodeAt(i));
    }
  } else if (!Array.isArray(bytes)) {
    bytes = Array.prototype.slice.call(bytes);
  }
  bytes.push(128);
  var l = bytes.length / 4 + 2;
  var N = Math.ceil(l / 16);
  var M = new Array(N);
  for (var _i = 0; _i < N; ++_i) {
    var arr = new Uint32Array(16);
    for (var j = 0; j < 16; ++j) {
      arr[j] = bytes[_i * 64 + j * 4] << 24 | bytes[_i * 64 + j * 4 + 1] << 16 | bytes[_i * 64 + j * 4 + 2] << 8 | bytes[_i * 64 + j * 4 + 3];
    }
    M[_i] = arr;
  }
  M[N - 1][14] = (bytes.length - 1) * 8 / Math.pow(2, 32);
  M[N - 1][14] = Math.floor(M[N - 1][14]);
  M[N - 1][15] = (bytes.length - 1) * 8 & 4294967295;
  for (var _i2 = 0; _i2 < N; ++_i2) {
    var W = new Uint32Array(80);
    for (var t = 0; t < 16; ++t) {
      W[t] = M[_i2][t];
    }
    for (var _t = 16; _t < 80; ++_t) {
      W[_t] = ROTL(W[_t - 3] ^ W[_t - 8] ^ W[_t - 14] ^ W[_t - 16], 1);
    }
    var a = H[0];
    var b = H[1];
    var c = H[2];
    var d = H[3];
    var e = H[4];
    for (var _t2 = 0; _t2 < 80; ++_t2) {
      var s = Math.floor(_t2 / 20);
      var T = ROTL(a, 5) + f(s, b, c, d) + e + K2[s] + W[_t2] >>> 0;
      e = d;
      d = c;
      c = ROTL(b, 30) >>> 0;
      b = a;
      a = T;
    }
    H[0] = H[0] + a >>> 0;
    H[1] = H[1] + b >>> 0;
    H[2] = H[2] + c >>> 0;
    H[3] = H[3] + d >>> 0;
    H[4] = H[4] + e >>> 0;
  }
  return [H[0] >> 24 & 255, H[0] >> 16 & 255, H[0] >> 8 & 255, H[0] & 255, H[1] >> 24 & 255, H[1] >> 16 & 255, H[1] >> 8 & 255, H[1] & 255, H[2] >> 24 & 255, H[2] >> 16 & 255, H[2] >> 8 & 255, H[2] & 255, H[3] >> 24 & 255, H[3] >> 16 & 255, H[3] >> 8 & 255, H[3] & 255, H[4] >> 24 & 255, H[4] >> 16 & 255, H[4] >> 8 & 255, H[4] & 255];
}
var sha1_default = sha1;

// node_modules/uuid/dist/esm-browser/v5.js
var v5 = v35_default("v5", 80, sha1_default);
var v5_default = v5;

// node_modules/uuid/dist/esm-browser/nil.js
var nil_default = "00000000-0000-0000-0000-000000000000";

// node_modules/uuid/dist/esm-browser/version.js
function version(uuid) {
  if (!validate_default(uuid)) {
    throw TypeError("Invalid UUID");
  }
  return parseInt(uuid.substr(14, 1), 16);
}
var version_default = version;

// src/js/stdlib/hashlib.js
var import_js_md5 = __toESM(require_md5());
var import_js_sha1 = __toESM(require_sha1());
var import_js_sha256 = __toESM(require_sha256());
var import_js_sha512 = __toESM(require_sha512());
var import_js_sha3 = __toESM(require_sha3());
var kHashObj = Symbol("kHashObj");
var supportedHashes = {
  md5: import_js_md5.default,
  sha1: import_js_sha1.default,
  sha256: import_js_sha256.sha256,
  sha224: import_js_sha256.sha224,
  sha512: import_js_sha512.sha512,
  sha384: import_js_sha512.sha384,
  sha512_256: import_js_sha512.sha512_256,
  sha512_224: import_js_sha512.sha512_224,
  sha3_512: import_js_sha3.sha3_512,
  sha3_384: import_js_sha3.sha3_384,
  sha3_256: import_js_sha3.sha3_256,
  sha3_224: import_js_sha3.sha3_224
};
var Hash = class {
  constructor(obj) {
    this[kHashObj] = obj.create();
  }
  update(data) {
    this[kHashObj].update(data);
    return this;
  }
  digest() {
    return this[kHashObj].hex();
  }
  bytes() {
    return new Uint8Array(this[kHashObj].array());
  }
};
function createHash(type) {
  const obj = supportedHashes[type.toLowerCase()];
  if (!obj) {
    throw new TypeError("Invalid hash type: " + type);
  }
  return new Hash(obj);
}
createHash.SUPPORTED_TYPES = Object.keys(supportedHashes);
var hashlib_default = createHash;
var export_ipaddr = import_ipaddr.default;
var export_path = import_path_browserify.default;
export {
  hashlib_default as createHash,
  getopts_default as getopts,
  export_ipaddr as ipaddr,
  export_path as path,
  esm_browser_exports as uuid
};
/*
 * [js-sha1]{@link https://github.com/emn178/js-sha1}
 *
 * @version 0.6.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2014-2017
 * @license MIT
 */
/*
 * [js-sha512]{@link https://github.com/emn178/js-sha512}
 *
 * @version 0.8.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2014-2018
 * @license MIT
 */
/**
 * [js-md5]{@link https://github.com/emn178/js-md5}
 *
 * @namespace md5
 * @version 0.7.3
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2014-2017
 * @license MIT
 */
/**
 * [js-sha256]{@link https://github.com/emn178/js-sha256}
 *
 * @version 0.9.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2014-2017
 * @license MIT
 */
/**
 * [js-sha3]{@link https://github.com/emn178/js-sha3}
 *
 * @version 0.8.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2015-2018
 * @license MIT
 */

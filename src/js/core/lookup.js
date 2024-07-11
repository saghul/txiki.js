const core = globalThis[Symbol.for('tjs.internal.core')];

export async function lookup(hostname, options = { family: 0, all: false }) {
    const gaiOpts = {};

    switch (options?.family) {
        case 4:
            gaiOpts.family = core.AF_INET;
            break;
        case 6:
            gaiOpts.family = core.AF_INET6;
            break;
        default:
            gaiOpts.family = core.AF_UNSPEC;
            break;
    }

    const r = await core.getaddrinfo(hostname, gaiOpts);

    if (options.all) {
        return r;
    }

    return r[0];
}

// IPv4 Segment
const v4Seg = '(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])';
const v4Str = `(?:${v4Seg}\\.){3}${v4Seg}`;
const IPv4Reg = new RegExp(`^${v4Str}$`);

// IPv6 Segment
const v6Seg = '(?:[0-9a-fA-F]{1,4})';
const IPv6Reg = new RegExp('^(?:' +
  `(?:${v6Seg}:){7}(?:${v6Seg}|:)|` +
  `(?:${v6Seg}:){6}(?:${v4Str}|:${v6Seg}|:)|` +
  `(?:${v6Seg}:){5}(?::${v4Str}|(?::${v6Seg}){1,2}|:)|` +
  `(?:${v6Seg}:){4}(?:(?::${v6Seg}){0,1}:${v4Str}|(?::${v6Seg}){1,3}|:)|` +
  `(?:${v6Seg}:){3}(?:(?::${v6Seg}){0,2}:${v4Str}|(?::${v6Seg}){1,4}|:)|` +
  `(?:${v6Seg}:){2}(?:(?::${v6Seg}){0,3}:${v4Str}|(?::${v6Seg}){1,5}|:)|` +
  `(?:${v6Seg}:){1}(?:(?::${v6Seg}){0,4}:${v4Str}|(?::${v6Seg}){1,6}|:)|` +
  `(?::(?:(?::${v6Seg}){0,5}:${v4Str}|(?::${v6Seg}){1,7}|:))` +
')(?:%[0-9a-zA-Z-.:]{1,})?$');

function isIPv4(s) {
    return IPv4Reg.test(s);
}

function isIPv6(s) {
    return IPv6Reg.test(s);
}

export function isIP(s) {
    if (isIPv4(s)) {
        return 4;
    } else if (isIPv6(s)) {
        return 6;
    }

    return 0;
}

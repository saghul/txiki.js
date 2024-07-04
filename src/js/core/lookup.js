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

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

    let r;

    try {
        r = await core.getaddrinfo(hostname, gaiOpts);
    } catch (error) {
        if ([ 'ENODATA', 'ENOTFOUND', 'ENOENT' ].includes(error.code)) {
            // On Windows we can get ENOENT when the name exists, but not this record type.
            r = [];
        } else {
            throw error;
        }
    }

    if (options.all) {
        return r;
    }

    return r[0];
}

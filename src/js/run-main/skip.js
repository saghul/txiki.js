/* global tjs */

import pathModule from 'tjs:internal/path';

function matchGlob(pattern, name) {
    const star = pattern.indexOf('*');

    if (star === -1) {
        return pattern === name;
    }

    return name.startsWith(pattern.slice(0, star)) && name.endsWith(pattern.slice(star + 1));
}

export async function buildSkipFilter(dir) {
    let featureSkip = {};

    try {
        const raw = await tjs.readFile(pathModule.join(dir, 'feature-skip.json'));

        featureSkip = JSON.parse(new TextDecoder().decode(raw));
    } catch (_) {
        // No config file - skip nothing.
    }

    const skipPatterns = [];

    for (const [ feature, patterns ] of Object.entries(featureSkip)) {
        if (!(feature in tjs.engine.features)) {
            console.log(`feature-skip.json: unknown feature "${feature}" — ignoring`);
            continue;
        }

        if (!tjs.engine.features[feature]) {
            skipPatterns.push(...patterns);
        }
    }

    return name => skipPatterns.some(p => matchGlob(p, name));
}

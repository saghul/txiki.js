/**
 * Import map resolution per the WICG Import Maps specification.
 * https://wicg.github.io/import-maps/
 */

import pathModule from './path.js';

function sortedByLongestKeyFirst(obj) {
    return Object.keys(obj).sort((a, b) => b.length - a.length);
}

function resolveValue(value, baseDir) {
    if (value === null) {
        return null;
    }

    if (typeof value === 'string' && (value.startsWith('./') || value.startsWith('../'))) {
        return pathModule.join(baseDir, value);
    }

    return value;
}

function resolveSpecifierMap(map, baseDir) {
    const resolved = Object.create(null);

    for (const [ key, value ] of Object.entries(map)) {
        resolved[key] = resolveValue(value, baseDir);
    }

    return resolved;
}

function resolveInSpecifierMap(specifier, specifierMap) {
    // Exact match.
    if (Object.prototype.hasOwnProperty.call(specifierMap, specifier)) {
        return specifierMap[specifier];
    }

    // Prefix match (keys that end with '/').
    for (const key of sortedByLongestKeyFirst(specifierMap)) {
        if (key.endsWith('/') && specifier.startsWith(key)) {
            const target = specifierMap[key];

            if (target === null) {
                return null;
            }

            return target + specifier.slice(key.length);
        }
    }

    return undefined;
}

export function parseImportMap(mapObj, baseDir) {
    const imports = resolveSpecifierMap(mapObj.imports ?? {}, baseDir);
    const rawScopes = mapObj.scopes ?? {};
    const scopes = Object.create(null);

    for (const [ scopeKey, scopeMap ] of Object.entries(rawScopes)) {
        const resolvedKey = resolveValue(scopeKey, baseDir) ?? scopeKey;

        scopes[resolvedKey] = resolveSpecifierMap(scopeMap, baseDir);
    }

    // Pre-sort scope keys longest-first for resolution priority.
    const scopeKeys = sortedByLongestKeyFirst(scopes);

    return function resolve(specifier, parentURL) {
        // 1. Try scopes: find the most-specific scope whose prefix matches parentURL.
        for (const scopeKey of scopeKeys) {
            if (parentURL.startsWith(scopeKey)) {
                const result = resolveInSpecifierMap(specifier, scopes[scopeKey]);

                if (result !== undefined) {
                    return result;
                }
            }
        }

        // 2. Fall back to top-level imports.
        const result = resolveInSpecifierMap(specifier, imports);

        if (result !== undefined) {
            return result;
        }

        // No match.
        return undefined;
    };
}

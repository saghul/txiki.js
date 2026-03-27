import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';

import path from './path.js';

const core = globalThis[Symbol.for('tjs.internal.core')];
const registry = new Map();
const decoder = new TextDecoder();

function extractSourceMappingURL(content) {
    // Search the last 512 bytes for the sourceMappingURL comment.
    const searchRegion = content.length > 512 ? content.slice(content.length - 512) : content;
    const match = searchRegion.match(/\/\/[#@]\s*sourceMappingURL=(.+?)(?:\s|$)/);

    return match ? match[1] : null;
}

function getOrLoadSourceMap(filename) {
    if (registry.has(filename)) {
        return registry.get(filename);
    }

    try {
        // Skip remote URLs.
        if (filename.startsWith('http://') || filename.startsWith('https://')) {
            registry.set(filename, null);

            return null;
        }

        const raw = core.syncReadFile(filename);

        if (!raw) {
            registry.set(filename, null);

            return null;
        }

        const content = decoder.decode(raw);
        const url = extractSourceMappingURL(content);

        if (!url) {
            registry.set(filename, null);

            return null;
        }

        let mapJson;

        if (url.startsWith('data:')) {
            // Inline sourcemap: data:application/json;base64,...
            const commaIndex = url.indexOf(',');

            if (commaIndex < 0) {
                registry.set(filename, null);

                return null;
            }

            mapJson = atob(url.slice(commaIndex + 1));
        } else {
            // External sourcemap file, resolve relative to source.
            const mapPath = url.startsWith('/') ? url : path.join(path.dirname(filename), url);
            const mapRaw = core.syncReadFile(mapPath);

            if (!mapRaw) {
                registry.set(filename, null);

                return null;
            }

            mapJson = decoder.decode(mapRaw);
        }

        const map = new TraceMap(mapJson);

        registry.set(filename, map);

        return map;
    } catch {
        registry.set(filename, null);

        return null;
    }
}

Error.prepareStackTrace = (error, callSites) => {
    const lines = callSites.map(site => {
        const fn = site.getFunctionName() || '<anonymous>';
        const file = site.getFileName();
        const line = site.getLineNumber();
        const col = site.getColumnNumber();

        if (file && line > 0) {
            const sm = getOrLoadSourceMap(file);

            if (sm) {
                // CallSite columns are 1-based, trace-mapping expects 0-based.
                const orig = originalPositionFor(sm, { line, column: col - 1 });

                if (orig.source !== null) {
                    return `    at ${orig.name || fn} (${orig.source}:${orig.line}:${orig.column + 1})`;
                }
            }
        }

        if (site.isNative()) {
            return `    at ${fn} (native)`;
        }

        return `    at ${fn} (${file}:${line}:${col})`;
    });

    return lines.join('\n') + '\n';
};

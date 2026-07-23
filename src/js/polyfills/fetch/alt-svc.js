// Per-origin HTTP/3 discovery cache (RFC 7838 Alt-Svc).
//
// fetch() has no way to know a server speaks HTTP/3 up front, so it learns it:
// a normal h1/h2 response may carry `alt-svc: h3=":443"; ma=86400`, meaning the
// same origin is reachable over HTTP/3. We remember that and route subsequent
// same-origin requests over h3, falling back to h1/h2 if the h3 attempt fails.
//
// Scope kept deliberately small: we only honour an `h3` advertisement for the
// *same host and port* we already connected to (the overwhelmingly common
// case). Entries pointing at a different authority, and draft protocol ids
// (h3-29, ...), are ignored.

const cache = new Map(); // origin ("https://host:port") -> { expires: epoch ms }

function stripQuotes(s) {
    if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
        return s.slice(1, -1);
    }

    return s;
}

// Record any usable h3 advertisement from an Alt-Svc header value.
export function noteAltSvc(origin, altSvcValue, originHost, originPort) {
    if (!altSvcValue) {
        return;
    }

    if (altSvcValue.trim() === 'clear') {
        cache.delete(origin);

        return;
    }

    // Comma-separated list of alt-values: `<proto>="<authority>"; p=v; ...`
    for (const entry of altSvcValue.split(',')) {
        const parts = entry.split(';').map(s => s.trim()).filter(Boolean);

        if (!parts.length) {
            continue;
        }

        const eq = parts[0].indexOf('=');

        if (eq === -1) {
            continue;
        }

        const proto = parts[0].slice(0, eq).trim();

        if (proto !== 'h3') {
            continue; // ignore h3-29 (draft), h2, and everything else
        }

        // authority is `host:port` or `:port` (same host)
        const authority = stripQuotes(parts[0].slice(eq + 1).trim());
        const colon = authority.lastIndexOf(':');

        if (colon === -1) {
            continue;
        }

        const host = authority.slice(0, colon);
        const port = parseInt(authority.slice(colon + 1), 10);

        if (!Number.isInteger(port)) {
            continue;
        }

        // Only upgrade in place: same host (or omitted) and same port.
        if ((host && host !== originHost) || port !== originPort) {
            continue;
        }

        let ma = 86400;

        for (let i = 1; i < parts.length; i++) {
            const m = /^ma\s*=\s*(\d+)$/.exec(parts[i]);

            if (m) {
                ma = parseInt(m[1], 10);
            }
        }

        cache.set(origin, { expires: Date.now() + ma * 1000 });

        return;
    }
}

// True if a non-expired h3 advertisement is cached for this origin.
export function hasH3(origin) {
    const e = cache.get(origin);

    if (!e) {
        return false;
    }

    if (Date.now() >= e.expires) {
        cache.delete(origin);

        return false;
    }

    return true;
}

// Forget the h3 advertisement (called when an h3 attempt fails).
export function dropH3(origin) {
    cache.delete(origin);
}

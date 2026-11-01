import assert from 'tjs:assert';
import path from 'tjs:path';

const url = new URL('./helpers/file-url-mod.js', import.meta.url);
const ns = await import(url.href);

assert.eq(ns.x, 42, 'module imported via file URL');
assert.eq(ns.meta.path, path.join(import.meta.dirname, 'helpers', 'file-url-mod.js'), 'import.meta.path is a native path');
assert.eq(ns.meta.dirname, path.join(import.meta.dirname, 'helpers'), 'import.meta.dirname is a native path');
assert.eq(ns.meta.url, `file://${ns.meta.path}`, 'import.meta.url keeps its usual shape');

const ns2 = await import(`${url.href}?query=1#fragment`);

assert.ok(ns2 === ns, 'query and fragment are ignored');

const ns3 = await import(url.href.replace('file:///', 'file://localhost/'));

assert.ok(ns3 === ns, 'localhost host is accepted');

import assert from 'tjs:assert';
import path from 'tjs:path';

const viaUrl = await import(new URL('./helpers/file-url-mod.js', import.meta.url).href);
const viaPath = await import(path.join(import.meta.dirname, 'helpers', 'file-url-mod.js'));

assert.ok(viaUrl === viaPath, 'file URL and native path load the same module instance');

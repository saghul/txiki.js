import assert from 'tjs:assert';
import { transpile } from 'tjs:typescript';

const r1 = transpile('/tmp/test.tsx', 'const el = <div>hello</div>;');
assert.ok(r1.includes("tjs:jsx-runtime/jsx-runtime"), 'uses tjs:jsx-runtime');
assert.ok(r1.includes('_jsx("div"'), 'jsx function call generated');
assert.ok(r1.includes('children: "hello"'), 'children preserved');

const r2 = transpile('/tmp/test.tsx', 'const el = <div class="app"><span>text</span></div>;');
assert.ok(r2.includes('"app"'), 'props preserved');
assert.ok(r2.includes('"span"'), 'nested elements');

const r3 = transpile('/tmp/test.tsx', 'const el = <><div>1</div><div>2</div></>;');
assert.ok(r3.includes('Fragment'), 'fragment used');

// Verify the tjs:jsx-runtime module can be imported and used
import { jsx, jsxs, Fragment } from 'tjs:jsx-runtime/jsx-runtime';
assert.equal(typeof jsx, 'function', 'jsx is a function');
assert.equal(typeof jsxs, 'function', 'jsxs is a function');
assert.equal(typeof Fragment, 'symbol', 'Fragment is a symbol');

const result = jsx('div', { id: 'test' }, null);
assert.equal(result.tag, 'div', 'element tag correct');
assert.equal(result.props.id, 'test', 'element props correct');
assert.ok(Array.isArray(result.children), 'children is an array');

const result2 = jsx('span', null, null);
assert.equal(result2.tag, 'span', 'fragment children works');

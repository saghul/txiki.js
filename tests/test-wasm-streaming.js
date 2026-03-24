import assert from 'tjs:assert';
import data from './wasm/i32.wasm' with { type: 'bytes' };

// compileStreaming with a Response.
const response1 = new Response(data, {
    headers: { 'content-type': 'application/wasm' }
});
const module = await WebAssembly.compileStreaming(response1);

assert.ok(module instanceof WebAssembly.Module, 'compileStreaming returns a Module');

// instantiateStreaming with a Response.
const response2 = new Response(data, {
    headers: { 'content-type': 'application/wasm' }
});
const result = await WebAssembly.instantiateStreaming(response2);

assert.ok(result.module instanceof WebAssembly.Module, 'instantiateStreaming returns a module');
assert.ok(result.instance instanceof WebAssembly.Instance, 'instantiateStreaming returns an instance');
assert.eq(result.instance.exports.add(1, 2), 3, 'instantiateStreaming instance works');

// compileStreaming with a Promise<Response>.
const response3 = Promise.resolve(new Response(data, {
    headers: { 'content-type': 'application/wasm' }
}));
const module2 = await WebAssembly.compileStreaming(response3);

assert.ok(module2 instanceof WebAssembly.Module, 'compileStreaming works with Promise<Response>');

// Wrong content type should throw.
const response4 = new Response(data, {
    headers: { 'content-type': 'application/javascript' }
});

try {
    await WebAssembly.compileStreaming(response4);
    assert.ok(false, 'should have thrown');
} catch (e) {
    assert.ok(e instanceof TypeError, 'wrong content type throws TypeError');
}

// Non-ok response should throw.
const response5 = new Response(data, {
    status: 404,
    headers: { 'content-type': 'application/wasm' }
});

try {
    await WebAssembly.compileStreaming(response5);
    assert.ok(false, 'should have thrown');
} catch (e) {
    assert.ok(e instanceof TypeError, 'non-ok response throws TypeError');
}

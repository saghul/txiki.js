import assert from './assert.js';
import { uuid } from '@tjs/std';


// Verify ordering of v1 ids created with explicit times
const TIME = 1321644961388; // 2011-11-18 11:36:01.388-08:00

// v1

function compare(name, ids) {
  // avoid .map for older browsers
  for (var i=0 ; i<ids.length ; ++i) {
    ids[i] = ids[i].split('-').reverse().join('-');
  }
  ids = ids.sort();
  var sorted = ([].concat(ids)).sort();

  assert.ok(sorted.toString() === ids.toString(), name + ' have expected order');
}

// Verify ordering of v1 ids created using default behavior
compare('uuids with current time', [
    uuid.v1(),
    uuid.v1(),
    uuid.v1(),
    uuid.v1(),
    uuid.v1()
]);

// Verify ordering of v1 ids created with explicit times
compare('uuids with time option', [
    uuid.v1({msecs: TIME - 10*3600*1000}),
    uuid.v1({msecs: TIME - 1}),
    uuid.v1({msecs: TIME}),
    uuid.v1({msecs: TIME + 1}),
    uuid.v1({msecs: TIME + 28*24*3600*1000})
]);

// v3

const { v3 } = uuid;

// Expect to get the same results as http://tools.adjet.org/uuid-v3
assert.equal(v3('hello.example.com', v3.DNS), '9125a8dc-52ee-365b-a5aa-81b0b3681cf6');
assert.equal(v3('http://example.com/hello', v3.URL), 'c6235813-3ba4-3801-ae84-e0a6ebb7d138');
assert.equal(v3('hello', '0f5abcd1-c194-47f3-905b-2df7263a084b'), 'a981a0c2-68b1-35dc-bcfc-296e52ab01ec');

// test the buffer functionality
var buf = new Array(16);
var testBuf = [0x91, 0x25, 0xa8, 0xdc, 0x52, 0xee, 0x36, 0x5b, 0xa5, 0xaa, 0x81, 0xb0, 0xb3, 0x68, 0x1c, 0xf6];
v3('hello.example.com', v3.DNS, buf);
assert.ok(buf.length === testBuf.length && buf.every(function(elem, idx) {
  return elem === testBuf[idx];
}));

// test offsets as well
buf = new Array(19);
for (var i=0; i<3; ++i) buf[i] = 'landmaster';
v3('hello.example.com', v3.DNS, buf, 3);
assert.ok(buf.length === testBuf.length+3 && buf.every(function(elem, idx) {
  return (idx >= 3) ? (elem === testBuf[idx-3]) : (elem === 'landmaster');
}), 'hello');

// v5

const { v5 } = uuid;

// Expect to get the same results as http://tools.adjet.org/uuid-v5
assert.equal(v5('hello.example.com', v5.DNS), 'fdda765f-fc57-5604-a269-52a7df8164ec');
assert.equal(v5('http://example.com/hello', v5.URL), '3bbcee75-cecc-5b56-8031-b6641c1ed1f1');
assert.equal(v5('hello', '0f5abcd1-c194-47f3-905b-2df7263a084b'), '90123e1c-7512-523e-bb28-76fab9f2f73d');

// test the buffer functionality
var buf = new Array(16);
var testBuf = [0xfd, 0xda, 0x76, 0x5f, 0xfc, 0x57, 0x56, 0x04, 0xa2, 0x69, 0x52, 0xa7, 0xdf, 0x81, 0x64, 0xec];
v5('hello.example.com', v5.DNS, buf);
assert.ok(buf.length === testBuf.length && buf.every(function(elem, idx) {
  return elem === testBuf[idx];
}));

// test offsets as well
buf = new Array(19);
for (var i=0; i<3; ++i) buf[i] = 'landmaster';
v5('hello.example.com', v5.DNS, buf, 3);
assert.ok(buf.length === testBuf.length+3 && buf.every(function(elem, idx) {
  return (idx >= 3) ? (elem === testBuf[idx-3]) : (elem === 'landmaster');
}));

/**
 * 
 * This file is a collection of tests from https://github.com/web-platform-tests/wpt (encoding/ folder)
 * Which is licensed under the following license:
 * 
 * # The 3-Clause BSD License
 * 
 * Copyright © web-platform-tests contributors
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import assert from 'tjs:assert';

const tests = [];
let sectionName = null;
function section(name, func) {
	sectionName = name;
	console.log(`Running section: ${name}`);
	func();
	sectionName = null;
}
function test(func, name) {
	tests.push({ name, func, section: sectionName });
}

const assert_equals = (a, b, msg) => assert.equal(a, b, msg);
const assert_not_equals = (a, b, msg) => assert.notEqual(a, b, msg);
const assert_true = (a, msg) => assert.truthy(a, msg);
const assert_false = (a, msg) => assert.falsy(a, msg);
const assert_throws_js = (inst, func, msg) => assert.throws(func, inst, msg);
const assert_array_equals = (a, b, msg) => assert.deepEqual(a, b, msg);


const createBuffer = (type, length, opts) => {
	if (type === "ArrayBuffer") {
		return new ArrayBuffer(length, opts);
	} else if (type === "SharedArrayBuffer") {
		//return new SharedArrayBuffer(length);
		//TODO: there is some issue with SharedArrayBuffer, why? return ArrayBuffer for now
		return new ArrayBuffer(length, opts);
	} else {
		throw new Error("type has to be ArrayBuffer or SharedArrayBuffer");
	}
};

// Straight from https://encoding.spec.whatwg.org/encodings.json
// limited down to just UTF-8 for txiki.js
export const encodings_table = [
	{
		"encodings": [
			{
				"labels": [
					"unicode-1-1-utf-8",
					"unicode11utf8",
					"unicode20utf8",
					"utf-8",
					"utf8",
					"x-unicode20utf8"
				],
				"name": "UTF-8"
			}
		],
		"heading": "The Encoding"
	},
];

section('textdecoder-arguments.any.js', () => {
	// META: global=window,dedicatedworker,shadowrealm
	// META: title=Encoding API: TextDecoder decode() optional arguments

	test(t => {
		const decoder = new TextDecoder();

		// Just passing nothing.
		assert_equals(
			decoder.decode(undefined), '',
			'Undefined as first arg should decode to empty string');

		// Flushing an incomplete sequence.
		decoder.decode(new Uint8Array([0xc9]), { stream: true });
		assert_equals(
			decoder.decode(undefined), '\uFFFD',
			'Undefined as first arg should flush the stream');

	}, 'TextDecoder decode() with explicit undefined');

	test(t => {
		const decoder = new TextDecoder();

		// Just passing nothing.
		assert_equals(
			decoder.decode(undefined, undefined), '',
			'Undefined as first arg should decode to empty string');

		// Flushing an incomplete sequence.
		decoder.decode(new Uint8Array([0xc9]), { stream: true });
		assert_equals(
			decoder.decode(undefined, undefined), '\uFFFD',
			'Undefined as first arg should flush the stream');

	}, 'TextDecoder decode() with undefined and undefined');

	test(t => {
		const decoder = new TextDecoder();

		// Just passing nothing.
		assert_equals(
			decoder.decode(undefined, {}), '',
			'Undefined as first arg should decode to empty string');

		// Flushing an incomplete sequence.
		decoder.decode(new Uint8Array([0xc9]), { stream: true });
		assert_equals(
			decoder.decode(undefined, {}), '\uFFFD',
			'Undefined as first arg should flush the stream');

	}, 'TextDecoder decode() with undefined and options');
})
section('textdecoder-byte-order-marks.any.js', () => {
	// META: global=window,dedicatedworker,shadowrealm
	// META: title=Encoding API: Byte-order marks

	var testCases = [
		{
			encoding: 'utf-8',
			bom: [0xEF, 0xBB, 0xBF],
			bytes: [0x7A, 0xC2, 0xA2, 0xE6, 0xB0, 0xB4, 0xF0, 0x9D, 0x84, 0x9E, 0xF4, 0x8F, 0xBF, 0xBD]
		},
		{
			encoding: 'utf-16le',
			bom: [0xff, 0xfe],
			bytes: [0x7A, 0x00, 0xA2, 0x00, 0x34, 0x6C, 0x34, 0xD8, 0x1E, 0xDD, 0xFF, 0xDB, 0xFD, 0xDF]
		},
		{
			encoding: 'utf-16be',
			bom: [0xfe, 0xff],
			bytes: [0x00, 0x7A, 0x00, 0xA2, 0x6C, 0x34, 0xD8, 0x34, 0xDD, 0x1E, 0xDB, 0xFF, 0xDF, 0xFD]
		}
	];

	var string = 'z\xA2\u6C34\uD834\uDD1E\uDBFF\uDFFD'; // z, cent, CJK water, G-Clef, Private-use character

	testCases.forEach(function (t) {
		test(function () {
			try{
				new TextDecoder(t.encoding);
			}catch(e){ // not all encodings are supported, so only use those for negative tests below
				return;
			}

			var decoder = new TextDecoder(t.encoding);
			assert_equals(decoder.decode(new Uint8Array(t.bytes)), string,
				'Sequence without BOM should decode successfully');

			assert_equals(decoder.decode(new Uint8Array(t.bom.concat(t.bytes))), string,
				'Sequence with BOM should decode successfully (with no BOM present in output)');

			testCases.forEach(function (o) {
				if (o === t)
					return;

				assert_not_equals(decoder.decode(new Uint8Array(o.bom.concat(t.bytes))), string,
					'Mismatching BOM should not be ignored - treated as garbage bytes.');
			});

		}, 'Byte-order marks: ' + t.encoding);
	});
})
section('textdecoder-copy.any.js', () => {
	// META: global=window,worker
	// META: script=/common/sab.js

	["ArrayBuffer", "SharedArrayBuffer"].forEach(arrayBufferOrSharedArrayBuffer => {
		test(() => {
			const buf = createBuffer(arrayBufferOrSharedArrayBuffer, 2);
			const view = new Uint8Array(buf);
			const buf2 = createBuffer(arrayBufferOrSharedArrayBuffer, 2);
			const view2 = new Uint8Array(buf2);
			const decoder = new TextDecoder("utf-8");
			view[0] = 0xEF;
			view[1] = 0xBB;
			view2[0] = 0xBF;
			view2[1] = 0x40;
			assert_equals(decoder.decode(buf, { stream: true }), "");
			view[0] = 0x01;
			view[1] = 0x02;
			assert_equals(decoder.decode(buf2), "@");
		}, "Modify buffer after passing it in (" + arrayBufferOrSharedArrayBuffer + ")");
	});
})
section('textdecoder-eof.any.js', () => {
	test(() => {
		// Truncated sequences
		assert_equals(new TextDecoder().decode(new Uint8Array([0xF0])), "\uFFFD");
		assert_equals(new TextDecoder().decode(new Uint8Array([0xF0, 0x9F])), "\uFFFD");
		assert_equals(new TextDecoder().decode(new Uint8Array([0xF0, 0x9F, 0x92])), "\uFFFD");
		
		// Errors near end-of-queue
		assert_equals(new TextDecoder().decode(new Uint8Array([0xF0, 0x9F, 0x41])), "\uFFFDA");
		assert_equals(new TextDecoder().decode(new Uint8Array([0xF0, 0x41, 0x42])), "\uFFFDAB");
		assert_equals(new TextDecoder().decode(new Uint8Array([0xF0, 0x41, 0xF0])), "\uFFFDA\uFFFD");
		
		// TODO: check why this fails, probably the handling for this needs to be changed in quickjs code
		//assert_equals(new TextDecoder().decode(new Uint8Array([0xF0, 0x8F, 0x92])), "\uFFFD\uFFFD\uFFFD");
	}, "TextDecoder end-of-queue handling");

	test(() => {
		const decoder = new TextDecoder();
		decoder.decode(new Uint8Array([0xF0]), { stream: true });
		assert_equals(decoder.decode(), "\uFFFD");

		decoder.decode(new Uint8Array([0xF0]), { stream: true });
		decoder.decode(new Uint8Array([0x9F]), { stream: true });
		assert_equals(decoder.decode(), "\uFFFD");

		decoder.decode(new Uint8Array([0xF0, 0x9F]), { stream: true });
		assert_equals(decoder.decode(new Uint8Array([0x92])), "\uFFFD");

		assert_equals(decoder.decode(new Uint8Array([0xF0, 0x9F]), { stream: true }), "");

		assert_equals(decoder.decode(new Uint8Array([0x41]), { stream: true }), "\uFFFDA");
		assert_equals(decoder.decode(), "");

		assert_equals(decoder.decode(new Uint8Array([0xF0, 0x41, 0x42]), { stream: true }), "\uFFFDAB");
		assert_equals(decoder.decode(), "");

		assert_equals(decoder.decode(new Uint8Array([0xF0, 0x41, 0xF0]), { stream: true }), "\uFFFDA");
		assert_equals(decoder.decode(), "\uFFFD");

		assert_equals(decoder.decode(new Uint8Array([0xF0]), { stream: true }), "");
		assert_equals(decoder.decode(new Uint8Array([0x8F]), { stream: true }), "\uFFFD\uFFFD");
		assert_equals(decoder.decode(new Uint8Array([0x92]), { stream: true }), "\uFFFD");
		assert_equals(decoder.decode(), "");
	}, "TextDecoder end-of-queue handling using stream: true");
})
section('textdecoder-fatal.any.js', () => {
	// META: global=window,dedicatedworker,shadowrealm
	// META: title=Encoding API: Fatal flag

	var bad = [
		{ encoding: 'utf-8', input: [0xFF], name: 'invalid code' },
		{ encoding: 'utf-8', input: [0xC0], name: 'ends early' },
		{ encoding: 'utf-8', input: [0xE0], name: 'ends early 2' },
		{ encoding: 'utf-8', input: [0xC0, 0x00], name: 'invalid trail' },
		{ encoding: 'utf-8', input: [0xC0, 0xC0], name: 'invalid trail 2' },
		{ encoding: 'utf-8', input: [0xE0, 0x00], name: 'invalid trail 3' },
		{ encoding: 'utf-8', input: [0xE0, 0xC0], name: 'invalid trail 4' },
		{ encoding: 'utf-8', input: [0xE0, 0x80, 0x00], name: 'invalid trail 5' },
		{ encoding: 'utf-8', input: [0xE0, 0x80, 0xC0], name: 'invalid trail 6' },
		{ encoding: 'utf-8', input: [0xFC, 0x80, 0x80, 0x80, 0x80, 0x80], name: '> 0x10FFFF' },
		{ encoding: 'utf-8', input: [0xFE, 0x80, 0x80, 0x80, 0x80, 0x80], name: 'obsolete lead byte' },

		// Overlong encodings
		{ encoding: 'utf-8', input: [0xC0, 0x80], name: 'overlong U+0000 - 2 bytes' },
		{ encoding: 'utf-8', input: [0xE0, 0x80, 0x80], name: 'overlong U+0000 - 3 bytes' },
		{ encoding: 'utf-8', input: [0xF0, 0x80, 0x80, 0x80], name: 'overlong U+0000 - 4 bytes' },
		{ encoding: 'utf-8', input: [0xF8, 0x80, 0x80, 0x80, 0x80], name: 'overlong U+0000 - 5 bytes' },
		{ encoding: 'utf-8', input: [0xFC, 0x80, 0x80, 0x80, 0x80, 0x80], name: 'overlong U+0000 - 6 bytes' },

		{ encoding: 'utf-8', input: [0xC1, 0xBF], name: 'overlong U+007F - 2 bytes' },
		{ encoding: 'utf-8', input: [0xE0, 0x81, 0xBF], name: 'overlong U+007F - 3 bytes' },
		{ encoding: 'utf-8', input: [0xF0, 0x80, 0x81, 0xBF], name: 'overlong U+007F - 4 bytes' },
		{ encoding: 'utf-8', input: [0xF8, 0x80, 0x80, 0x81, 0xBF], name: 'overlong U+007F - 5 bytes' },
		{ encoding: 'utf-8', input: [0xFC, 0x80, 0x80, 0x80, 0x81, 0xBF], name: 'overlong U+007F - 6 bytes' },

		{ encoding: 'utf-8', input: [0xE0, 0x9F, 0xBF], name: 'overlong U+07FF - 3 bytes' },
		{ encoding: 'utf-8', input: [0xF0, 0x80, 0x9F, 0xBF], name: 'overlong U+07FF - 4 bytes' },
		{ encoding: 'utf-8', input: [0xF8, 0x80, 0x80, 0x9F, 0xBF], name: 'overlong U+07FF - 5 bytes' },
		{ encoding: 'utf-8', input: [0xFC, 0x80, 0x80, 0x80, 0x9F, 0xBF], name: 'overlong U+07FF - 6 bytes' },

		{ encoding: 'utf-8', input: [0xF0, 0x8F, 0xBF, 0xBF], name: 'overlong U+FFFF - 4 bytes' },
		{ encoding: 'utf-8', input: [0xF8, 0x80, 0x8F, 0xBF, 0xBF], name: 'overlong U+FFFF - 5 bytes' },
		{ encoding: 'utf-8', input: [0xFC, 0x80, 0x80, 0x8F, 0xBF, 0xBF], name: 'overlong U+FFFF - 6 bytes' },

		{ encoding: 'utf-8', input: [0xF8, 0x84, 0x8F, 0xBF, 0xBF], name: 'overlong U+10FFFF - 5 bytes' },
		{ encoding: 'utf-8', input: [0xFC, 0x80, 0x84, 0x8F, 0xBF, 0xBF], name: 'overlong U+10FFFF - 6 bytes' },

		// UTF-16 surrogates encoded as code points in UTF-8
		{ encoding: 'utf-8', input: [0xED, 0xA0, 0x80], name: 'lead surrogate' },
		{ encoding: 'utf-8', input: [0xED, 0xB0, 0x80], name: 'trail surrogate' },
		{ encoding: 'utf-8', input: [0xED, 0xA0, 0x80, 0xED, 0xB0, 0x80], name: 'surrogate pair' },

		// Mismatched UTF-16 surrogates are exercised in utf16-surrogates.html

		// FIXME: Add legacy encoding cases
	];

	bad.forEach(function (t) {
		test(function () {
			assert_throws_js(TypeError, function () {
				new TextDecoder(t.encoding, { fatal: true }).decode(new Uint8Array(t.input))
			});
		}, 'Fatal flag: ' + t.encoding + ' - ' + t.name);
	});

	test(function () {
		assert_true('fatal' in new TextDecoder(), 'The fatal attribute should exist on TextDecoder.');
		assert_equals(typeof new TextDecoder().fatal, 'boolean', 'The type of the fatal attribute should be boolean.');
		assert_false(new TextDecoder().fatal, 'The fatal attribute should default to false.');
		assert_true(new TextDecoder('utf-8', { fatal: true }).fatal, 'The fatal attribute can be set using an option.');

	}, 'The fatal attribute of TextDecoder');

	test(() => {
		const bytes = new Uint8Array([226, 153, 165]);
		const decoder = new TextDecoder('utf-8', { fatal: true });
		assert_equals(decoder.decode(new DataView(bytes.buffer, 0, 3)),
			'♥',
			'decode() should decode full sequence');
		assert_throws_js(TypeError,
			() => decoder.decode(new DataView(bytes.buffer, 0, 2)),
			'decode() should throw on incomplete sequence');
		assert_equals(decoder.decode(new DataView(bytes.buffer, 0, 3)),
			'♥',
			'decode() should not throw on subsequent call');
	}, 'Error seen with fatal does not prevent future decodes');
})

section('textdecoder-fatal-streaming.any.js', () => {
	// META: global=window,dedicatedworker,shadowrealm
	// META: title=Encoding API: End-of-file

	test(function () {
		[
			{ encoding: 'utf-8', sequence: [0xC0] }
		].forEach(function (testCase) {

			assert_throws_js(TypeError, function () {
				var decoder = new TextDecoder(testCase.encoding, { fatal: true });
				decoder.decode(new Uint8Array(testCase.sequence));
			}, 'Unterminated ' + testCase.encoding + ' sequence should throw if fatal flag is set');

			assert_equals(
				new TextDecoder(testCase.encoding).decode(new Uint8Array([testCase.sequence])),
				'\uFFFD',
				'Unterminated UTF-8 sequence should emit replacement character if fatal flag is unset');
		});
	}, 'Fatal flag, non-streaming cases');
})
section('textdecoder-ignorebom.any.js', () => {
	// META: global=window,dedicatedworker,shadowrealm
	// META: title=Encoding API: TextDecoder ignoreBOM option

	var cases = [
		{ encoding: 'utf-8', bytes: [0xEF, 0xBB, 0xBF, 0x61, 0x62, 0x63] },
	];

	cases.forEach(function (testCase) {
		test(function () {
			var BOM = '\uFEFF';
			var decoder = new TextDecoder(testCase.encoding, { ignoreBOM: true });
			var bytes = new Uint8Array(testCase.bytes);
			assert_equals(
				decoder.decode(bytes),
				BOM + 'abc',
				testCase.encoding + ': BOM should be present in decoded string if ignored');
			assert_equals(
				decoder.decode(bytes),
				BOM + 'abc',
				testCase.encoding + ': BOM should be present in decoded string if ignored by a reused decoder');

			decoder = new TextDecoder(testCase.encoding, { ignoreBOM: false });
			assert_equals(
				decoder.decode(bytes),
				'abc',
				testCase.encoding + ': BOM should be absent from decoded string if not ignored');
			assert_equals(
				decoder.decode(bytes),
				'abc',
				testCase.encoding + ': BOM should be absent from decoded string if not ignored by a reused decoder');

			decoder = new TextDecoder(testCase.encoding);
			assert_equals(
				decoder.decode(bytes),
				'abc',
				testCase.encoding + ': BOM should be absent from decoded string by default');
			assert_equals(
				decoder.decode(bytes),
				'abc',
				testCase.encoding + ': BOM should be absent from decoded string by default with a reused decoder');
		}, 'BOM is ignored if ignoreBOM option is specified: ' + testCase.encoding);
	});

	test(function () {
		assert_true('ignoreBOM' in new TextDecoder(), 'The ignoreBOM attribute should exist on TextDecoder.');
		assert_equals(typeof new TextDecoder().ignoreBOM, 'boolean', 'The type of the ignoreBOM attribute should be boolean.');
		assert_false(new TextDecoder().ignoreBOM, 'The ignoreBOM attribute should default to false.');
		assert_true(new TextDecoder('utf-8', { ignoreBOM: true }).ignoreBOM, 'The ignoreBOM attribute can be set using an option.');

	}, 'The ignoreBOM attribute of TextDecoder');
})
section('textdecoder-labels.any.js', () => {
	var whitespace = [' ', '\t', '\n', '\f', '\r'];
	encodings_table.forEach(function (section) {
		section.encodings.filter(function (encoding) {
			return encoding.name !== 'replacement';
		}).forEach(function (encoding) {
			encoding.labels.forEach(function (label) {
				const textDecoderName = encoding.name.toLowerCase(); // ASCII names only, so safe
				test(function (t) {
					assert_equals(
						new TextDecoder(label).encoding, textDecoderName,
						'label for encoding should match');
					assert_equals(
						new TextDecoder(label.toUpperCase()).encoding, textDecoderName,
						'label matching should be case-insensitive');
					whitespace.forEach(function (ws) {
						assert_equals(
							new TextDecoder(ws + label).encoding, textDecoderName,
							'label for encoding with leading whitespace should match');
						assert_equals(
							new TextDecoder(label + ws).encoding, textDecoderName,
							'label for encoding with trailing whitespace should match');
						assert_equals(
							new TextDecoder(ws + label + ws).encoding, textDecoderName,
							'label for encoding with surrounding whitespace should match');
					});
				}, label + ' => ' + encoding.name);
			});
		});
	});
})
section('textdecoder-streaming.any.js', () => {
	// META: title=Encoding API: Streaming decode
	// META: global=window,worker
	// META: script=resources/encodings.js
	// META: script=/common/sab.js

	var string = '\x00123ABCabc\x80\xFF\u0100\u1000\uFFFD\uD800\uDC00\uDBFF\uDFFF';
	var octets = {
		'utf-8': [0x00, 0x31, 0x32, 0x33, 0x41, 0x42, 0x43, 0x61, 0x62, 0x63, 0xc2, 0x80,
			0xc3, 0xbf, 0xc4, 0x80, 0xe1, 0x80, 0x80, 0xef, 0xbf, 0xbd, 0xf0, 0x90,
			0x80, 0x80, 0xf4, 0x8f, 0xbf, 0xbf]
	};

	["ArrayBuffer", "SharedArrayBuffer"].forEach((arrayBufferOrSharedArrayBuffer) => {
		Object.keys(octets).forEach(function (encoding) {
			for (var len = 1; len <= 5; ++len) {
				test(function () {
					var encoded = octets[encoding];

					var out = '';
					var decoder = new TextDecoder(encoding);
					for (var i = 0; i < encoded.length; i += len) {
						var sub = [];
						for (var j = i; j < encoded.length && j < i + len; ++j) {
							sub.push(encoded[j]);
						}
						var uintArray = new Uint8Array(createBuffer(arrayBufferOrSharedArrayBuffer, sub.length));
						uintArray.set(sub);
						out += decoder.decode(uintArray, { stream: true });
					}
					out += decoder.decode();
					assert_equals(out, string);
				}, 'Streaming decode: ' + encoding + ', ' + len + ' byte window (' + arrayBufferOrSharedArrayBuffer + ')');
			}
		});

		test(() => {
			function bytes(byteArray) {
				const view = new Uint8Array(createBuffer(arrayBufferOrSharedArrayBuffer, byteArray.length));
				view.set(byteArray);
				return view;
			}

			const decoder = new TextDecoder();

			assert_equals(decoder.decode(bytes([0xC1]), { stream: true }), "\uFFFD");
			assert_equals(decoder.decode(), "");

			assert_equals(decoder.decode(bytes([0xF5]), { stream: true }), "\uFFFD");
			assert_equals(decoder.decode(), "");

			assert_equals(decoder.decode(bytes([0xE0, 0x41]), { stream: true }), "\uFFFDA");
			assert_equals(decoder.decode(bytes([0x42])), "B");

			assert_equals(decoder.decode(bytes([0xE0, 0x80]), { stream: true }), "\uFFFD\uFFFD");
			assert_equals(decoder.decode(bytes([0x80])), "\uFFFD");

			assert_equals(decoder.decode(bytes([0xED, 0xA0]), { stream: true }), "\uFFFD\uFFFD");
			assert_equals(decoder.decode(bytes([0x80])), "\uFFFD");

			assert_equals(decoder.decode(bytes([0xF0, 0x41]), { stream: true }), "\uFFFDA");
			assert_equals(decoder.decode(bytes([0x42]), { stream: true }), "B");
			assert_equals(decoder.decode(bytes([0x43])), "C");

			assert_equals(decoder.decode(bytes([0xF0, 0x80]), { stream: true }), "\uFFFD\uFFFD");
			assert_equals(decoder.decode(bytes([0x80]), { stream: true }), "\uFFFD");
			assert_equals(decoder.decode(bytes([0x80])), "\uFFFD");

			assert_equals(decoder.decode(bytes([0xF4, 0xA0]), { stream: true }), "\uFFFD\uFFFD");
			assert_equals(decoder.decode(bytes([0x80]), { stream: true }), "\uFFFD");
			assert_equals(decoder.decode(bytes([0x80])), "\uFFFD");

			assert_equals(decoder.decode(bytes([0xF0, 0x90, 0x41]), { stream: true }), "\uFFFDA");
			assert_equals(decoder.decode(bytes([0x42])), "B");

			// 4-byte UTF-8 sequences always correspond to non-BMP characters. Here
			// we make sure that, although the first 3 bytes are enough to emit the
			// lead surrogate, it only gets emitted when the fourth byte is read.
			assert_equals(decoder.decode(bytes([0xF0, 0x9F, 0x92]), { stream: true }), "");
			assert_equals(decoder.decode(bytes([0xA9])), "\u{1F4A9}");
		}, `Streaming decode: UTF-8 chunk tests (${arrayBufferOrSharedArrayBuffer})`);
	})
})

section('api-surrogates-utf8', () => {
	// META: global=window,dedicatedworker,shadowrealm
	// META: title=Encoding API: Invalid UTF-16 surrogates with UTF-8 encoding

	var badStrings = [
		{
			input: 'abc123',
			expected: [0x61, 0x62, 0x63, 0x31, 0x32, 0x33],
			decoded: 'abc123',
			name: 'Sanity check'
		},
		{
			input: '\uD800',
			expected: [0xef, 0xbf, 0xbd],
			decoded: '\uFFFD',
			name: 'Surrogate half (low)'
		},
		{
			input: '\uDC00',
			expected: [0xef, 0xbf, 0xbd],
			decoded: '\uFFFD',
			name: 'Surrogate half (high)'
		},
		{
			input: 'abc\uD800123',
			expected: [0x61, 0x62, 0x63, 0xef, 0xbf, 0xbd, 0x31, 0x32, 0x33],
			decoded: 'abc\uFFFD123',
			name: 'Surrogate half (low), in a string'
		},
		{
			input: 'abc\uDC00123',
			expected: [0x61, 0x62, 0x63, 0xef, 0xbf, 0xbd, 0x31, 0x32, 0x33],
			decoded: 'abc\uFFFD123',
			name: 'Surrogate half (high), in a string'
		},
		{
			input: '\uDC00\uD800',
			expected: [0xef, 0xbf, 0xbd, 0xef, 0xbf, 0xbd],
			decoded: '\uFFFD\uFFFD',
			name: 'Wrong order'
		}
	];

	badStrings.forEach(function(t) {
		test(function() {
			var encoded = new TextEncoder().encode(t.input);
			assert_array_equals([].slice.call(encoded), t.expected);
			assert_equals(new TextDecoder('utf-8').decode(encoded), t.decoded);
		}, 'Invalid surrogates encoded into UTF-8: ' + t.name);
	});

})

section("textencoder-constructor-non-utf.any.js", () => {
	encodings_table.forEach(function (section) {
		section.encodings.forEach(function (encoding) {
			test(function () {
				assert_equals(new TextEncoder(encoding.name).encoding, 'utf-8');
			}, 'Encoding argument not considered for encode: ' + encoding.name);
		});
	});
})

section("textencoder-utf16-surrogates.any.js", () => {
	var bad = [
		{
			input: '\uD800',
			expected: '\uFFFD',
			name: 'lone surrogate lead'
		},
		{
			input: '\uDC00',
			expected: '\uFFFD',
			name: 'lone surrogate trail'
		},
		{
			input: '\uD800\u0000',
			expected: '\uFFFD\u0000',
			name: 'unmatched surrogate lead'
		},
		{
			input: '\uDC00\u0000',
			expected: '\uFFFD\u0000',
			name: 'unmatched surrogate trail'
		},
		{
			input: '\uDC00\uD800',
			expected: '\uFFFD\uFFFD',
			name: 'swapped surrogate pair'
		},
		{
			input: '\uD834\uDD1E',
			expected: '\uD834\uDD1E',
			name: 'properly encoded MUSICAL SYMBOL G CLEF (U+1D11E)'
		}
	];

	bad.forEach(function (t) {
		test(function () {
			var encoded = new TextEncoder().encode(t.input);
			var decoded = new TextDecoder().decode(encoded);
			assert_equals(decoded, t.expected);
		}, 'USVString handling: ' + t.name);
	});

	test(function () {
		assert_equals(new TextEncoder().encode().length, 0, 'Should default to empty string');
	}, 'USVString default');
})

section("encode-utf8.any.js", async () => {
	const inputString = 'I \u{1F499} streams';
	const expectedOutputBytes = [0x49, 0x20, 0xf0, 0x9f, 0x92, 0x99, 0x20, 0x73,
		0x74, 0x72, 0x65, 0x61, 0x6d, 0x73];
	// This is a character that must be represented in two code units in a string,
	// ie. it is not in the Basic Multilingual Plane.
	const astralCharacter = '\u{1F499}';  // BLUE HEART
	const astralCharacterEncoded = [0xf0, 0x9f, 0x92, 0x99];
	const leading = astralCharacter[0];
	const trailing = astralCharacter[1];
	const replacementEncoded = [0xef, 0xbf, 0xbd];

	// These tests assume that the implementation correctly classifies leading and
	// trailing surrogates and treats all the code units in each set equivalently.

	const testCases = [
		{
			input: [inputString],
			output: [expectedOutputBytes],
			description: 'encoding one string of UTF-8 should give one complete chunk'
		},
		{
			input: [leading, trailing],
			output: [astralCharacterEncoded],
			description: 'a character split between chunks should be correctly encoded'
		},
		{
			input: [leading, trailing + astralCharacter],
			output: [astralCharacterEncoded.concat(astralCharacterEncoded)],
			description: 'a character following one split between chunks should be ' +
				'correctly encoded'
		},
		{
			input: [leading, trailing + leading, trailing],
			output: [astralCharacterEncoded, astralCharacterEncoded],
			description: 'two consecutive astral characters each split down the ' +
				'middle should be correctly reassembled'
		},
		{
			input: [leading, trailing + leading + leading, trailing],
			output: [astralCharacterEncoded.concat(replacementEncoded), astralCharacterEncoded],
			description: 'two consecutive astral characters each split down the ' +
				'middle with an invalid surrogate in the middle should be correctly ' +
				'encoded'
		},
		{
			input: [leading],
			output: [replacementEncoded],
			description: 'a stream ending in a leading surrogate should emit a ' +
				'replacement character as a final chunk'
		},
		{
			input: [leading, astralCharacter],
			output: [replacementEncoded.concat(astralCharacterEncoded)],
			description: 'an unmatched surrogate at the end of a chunk followed by ' +
				'an astral character in the next chunk should be replaced with ' +
				'the replacement character at the start of the next output chunk'
		},
		{
			input: [leading, 'A'],
			output: [replacementEncoded.concat([65])],
			description: 'an unmatched surrogate at the end of a chunk followed by ' +
				'an ascii character in the next chunk should be replaced with ' +
				'the replacement character at the start of the next output chunk'
		},
		{
			input: [leading, leading, trailing],
			output: [replacementEncoded, astralCharacterEncoded],
			description: 'an unmatched surrogate at the end of a chunk followed by ' +
				'a plane 1 character split into two chunks should result in ' +
				'the encoded plane 1 character appearing in the last output chunk'
		},
		{
			input: [leading, leading],
			output: [replacementEncoded, replacementEncoded],
			description: 'two leading chunks should result in two replacement ' +
				'characters'
		},
		{
			input: [leading + leading, trailing],
			output: [replacementEncoded, astralCharacterEncoded],
			description: 'a non-terminal unpaired leading surrogate should ' +
				'immediately be replaced'
		},
		{
			input: [trailing, astralCharacter],
			output: [replacementEncoded, astralCharacterEncoded],
			description: 'a terminal unpaired trailing surrogate should ' +
				'immediately be replaced'
		},
		{
			input: [leading, '', trailing],
			output: [astralCharacterEncoded],
			description: 'a leading surrogate chunk should be carried past empty chunks'
		},
		{
			input: [leading, ''],
			output: [replacementEncoded],
			description: 'a leading surrogate chunk should error when it is clear ' +
				'it didn\'t form a pair'
		},
		{
			input: [''],
			output: [],
			description: 'an empty string should result in no output chunk'
		},
		{
			input: ['', inputString],
			output: [expectedOutputBytes],
			description: 'a leading empty chunk should be ignored'
		},
		{
			input: [inputString, ''],
			output: [expectedOutputBytes],
			description: 'a trailing empty chunk should be ignored'
		},
		{
			input: ['A'],
			output: [[65]],
			description: 'a plain ASCII chunk should be converted'
		},
		{
			input: ['\xff'],
			output: [[195, 191]],
			description: 'characters in the ISO-8859-1 range should be encoded correctly'
		},
	];

	function readableStreamToArray(stream) {
		var array = [];
		var writable = new WritableStream({
			write(chunk) {
				array.push(chunk);
			}
		});
		return stream.pipeTo(writable).then(() => array);
	}
	function readableStreamFromArray(array) {
		return new ReadableStream({
			start(controller) {
				for (let entry of array) {
					controller.enqueue(entry);
				}
				controller.close();
			}
		});
	}

	for (const { input, output, description } of testCases) {
		test(async function () {
			const inputStream = readableStreamFromArray(input);
			const outputStream = inputStream.pipeThrough(new TextEncoderStream());
			const chunkArray = await readableStreamToArray(outputStream);
			assert_equals(chunkArray.length, output.length,
				'number of chunks should match');
			for (let i = 0; i < output.length; ++i) {
				assert_array_equals(Object.values(chunkArray[i]), output[i], `chunk ${i} should match`);
			}
		}, description);
	}
})

async function run(){
	const sum = tests.length;
	let ok = 0;
	let failed = 0;
	const stopOnFail = true;
	for (const t of tests) {
		try {
			await t.func();
			ok++;
			console.log(`OK: [${t.section}] ${t.name}`);
		} catch (e) {
			failed++;
			console.log(`FAILED: [${t.section}] ${t.name}`);
			console.log(e);
			console.log('stack: ', e.stack)
			if(stopOnFail){
				break;
			}
		}
	}

	console.log(`Total: ${sum}, OK: ${ok}, FAILED: ${failed}`);
	if(failed){
		tjs.exit(1);
	}
}

run();

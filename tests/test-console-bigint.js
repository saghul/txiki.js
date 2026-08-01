import { runTest, checkResult } from './helpers.js';

// A bigint prints with the `n` suffix the literal is written with, everywhere a
// value is formatted. Without a bigint case it fell through to object
// formatting, and a bigint has no own properties, so every one of these used to
// print `{}`.
const tests = [
	{ code: 'console.log(1n);', resultStdout: '1n\n' },
	{ code: 'console.log(-1n);', resultStdout: '-1n\n' },
	{ code: 'console.log(0n);', resultStdout: '0n\n' },

	// Past 2**53 is the whole reason to hold a value as a bigint, so it has to
	// survive printing exactly.
	{ code: 'console.log(18446744073709551615n);', resultStdout: '18446744073709551615n\n' },

	// Nested, where the object formatter reaches it.
	{ code: 'console.log([1n, 2n]);', resultStdout: '[ 1n, 2n ]\n' },
	{ code: 'console.log({a: 1n});', resultStdout: '{ a: 1n }\n' },
	{ code: 'console.log({a: [{b: -5n}]});', resultStdout: '{ a: [ { b: -5n } ] }\n' },

	// Several arguments take a different path than a single one: it formats
	// rather than inspects, and used to push the raw value, printing a bigint as
	// though it were a number.
	{ code: 'console.log(1n, -2n);', resultStdout: '1n -2n\n' },
	{ code: 'console.log("n:", 1n);', resultStdout: 'n: 1n\n' },

	// %d and %i keep the suffix; parseInt() would drop it and, past 2**53,
	// digits with it. %s is String(), and %f a float, so neither does.
	{ code: 'console.log("%d", 1n);', resultStdout: '1n\n' },
	{ code: 'console.log("%i", 9007199254740993n);', resultStdout: '9007199254740993n\n' },
	{ code: 'console.log("%s", 1n);', resultStdout: '1\n' },
	{ code: 'console.log("%f", 1n);', resultStdout: '1\n' },

	// A number is still a number.
	{ code: 'console.log(1, [2], {a: 3});', resultStdout: '1 [ 2 ] { a: 3 }\n' },
];

for (const test of tests) {
	const jscode = test.code;

	const {code, stdout, stderr} = await runTest(jscode);
	if(code !== 0){
		console.error(`Test failed with code ${code}: ${jscode}`);
		console.error(stderr);
		throw new Error('Test failed due to invalid exit code');
	}
	checkResult(stdout, test.resultStdout ?? '', 'stdout');
	checkResult(stderr, test.resultStderr ?? '', 'stderr');
}

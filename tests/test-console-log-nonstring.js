import { runTest, checkResult } from './helpers.js';

// Among several arguments, every non-string is inspected — the same rule a lone
// argument already went through. Naming the types to inspect instead left the
// rest to their String() form, which is empty for null and undefined and the
// whole source text for a function.
const tests = [
	{ code: 'console.log("v:", null);', resultStdout: 'v: null\n' },
	{ code: 'console.log("v:", undefined);', resultStdout: 'v: undefined\n' },
	{ code: 'console.log(null, undefined, null);', resultStdout: 'null undefined null\n' },

	// A function used to print its entire body.
	{ code: 'console.log("f:", function foo(a, b) { return a + b; });', resultStdout: 'f: [Function: foo]\n' },
	{ code: 'console.log("f:", () => 42);', resultStdout: 'f: [Function]\n' },

	// A string is still passed through unquoted: quoting it would be noise at
	// the top level, which is the one reason not to inspect everything.
	{ code: 'console.log("a", "b");', resultStdout: 'a b\n' },
	{ code: 'console.log("q:", "has \'quotes\'");', resultStdout: 'q: has \'quotes\'\n' },

	// A nested string keeps its quotes, since there it is part of a structure.
	{ code: 'console.log("o:", { a: "s" });', resultStdout: 'o: { a: \'s\' }\n' },

	// Everything else is unchanged.
	{ code: 'console.log("v:", 1, true, [1], { a: 1 });', resultStdout: 'v: 1 true [ 1 ] { a: 1 }\n' },
	{ code: 'console.log("r:", /re+/g);', resultStdout: 'r: /re+/g\n' },

	// %s is String(), so it keeps rendering these its own way.
	{ code: 'console.log("%s %s", null, undefined);', resultStdout: 'null undefined\n' },
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

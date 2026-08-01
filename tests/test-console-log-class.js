import { runTest, checkResult } from './helpers.js';

// A class is labelled as a class, not as a function: reported as a Function it
// reads as something callable, and calling a class throws.
const tests = [
	{ code: 'console.log(class Bar {});', resultStdout: '[class Bar]\n' },
	{ code: 'console.log(class {});', resultStdout: '[class (anonymous)]\n' },

	// The superclass is worth having: it is most of what a bare class name
	// leaves out.
	{ code: 'class Bar {}; console.log(class Baz extends Bar {});', resultStdout: '[class Baz extends Bar]\n' },
	{ code: 'class Bar {}; console.log(class extends Bar {});', resultStdout: '[class (anonymous) extends Bar]\n' },

	// Reached through a structure as well as at the top level.
	{ code: 'class Bar {}; console.log([Bar]);', resultStdout: '[ [class Bar] ]\n' },
	{ code: 'class Bar {}; console.log({ c: Bar });', resultStdout: '{ c: [class Bar] }\n' },
	{ code: 'class Bar {}; console.log("c:", Bar);', resultStdout: 'c: [class Bar]\n' },

	// An ordinary function is untouched.
	{ code: 'console.log(function foo() {});', resultStdout: '[Function: foo]\n' },
	{ code: 'console.log(() => 42);', resultStdout: '[Function]\n' },
	{ code: 'console.log(Math.max);', resultStdout: '[Function: max]\n' },

	// A native constructor's source text is `function Array() { [native code] }`,
	// so it is a Function here, which is what it reports itself as.
	{ code: 'console.log(Array);', resultStdout: '[Function: Array]\n' },
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

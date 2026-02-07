import { runTest, checkResult } from './helpers.js';

const tests = [

	// Test console.error()
	{ code: 'console.error("Oops, an error occurred!");', resultStderr: 'Oops, an error occurred!\n' },
	{ code: 'console.error(new Error("Something went wrong!"));', resultStderr: /^Error: Something went wrong!\n(.+(\)|\:\d+)\n)+/  },

	// Test console.warn()
	{ code: 'console.warn("Warning: This is a warning!");', resultStderr: 'Warning: This is a warning!\n'},

	// Test console.trace()
	{ code: 'console.trace("This is a trace!");', resultStderr: /^Trace: This is a trace!\n(.+(\)|\:\d+)\n)+/},
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

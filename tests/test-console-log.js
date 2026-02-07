import { runTest, checkResult } from './helpers.js';

const tests = [

	// Test console.log()
	{ code: 'console.log("Hello, World!");', resultStdout: 'Hello, World!\n' },
	{ code: 'console.log(42);', resultStdout: '42\n' },
	{ code: 'console.log(true);', resultStdout: 'true\n' },
	{ code: 'console.log({a:1,b:2,c:{e:{f:{g:4}}}});', resultStdout: '{ a: 1, b: 2, c: { e: { f: [Object] } } }\n' },
	{ code: 'console.log(1,2,3);', resultStdout: '1 2 3\n' },
	{ code: 'console.log(1,2,[1,2,3]);', resultStdout: '1 2 [ 1, 2, 3 ]\n' },

	// Test console.log('format %s', 'string)
	{ code: 'console.log("format test %s, %i, %j", "string", 42, { answer: 42 });', resultStdout: `format test string, 42, {"answer":42}\n` },	// happy case
	{ code: 'console.log("col1\tcol2", 42);', resultStdout: `col1\tcol2 42\n` },	// still happy case

	// borken cases in browserify/node-util implementation of util.format
	{ code: 'console.log(123, "col1\tcol2", {});', resultStdout: `123 col1\tcol2 {}\n` }, // 123 instead of 42 to better visualize the tab
	{ code: 'console.log({}, "col1\tcol2", 123);', resultStdout: `{} col1\tcol2 123\n` },

	// Test console.info()
	{ code: 'console.info("Information: This is some information.");', resultStdout: 'Information: This is some information.\n' },

	// Test console.debug()
	{ code: 'console.debug("Debugging: This is a debug message.");', resultStdout: 'Debugging: This is a debug message.\n' },

	// Test some symbol usages
	{ code: 'console.log({[Symbol(123)]: "123"})', resultStdout: `{ [Symbol(123)]: '123' }\n` },
	{ code: 'console.log({asd: "123"})', resultStdout: `{ asd: '123' }\n` },
	{ code: 'console.log({"1234": "123"})', resultStdout: `{ '1234': '123' }\n` },

	// Test hidden properties
	{
		code: 'const obj = {};Object.defineProperty(obj, "123", {value: 123, enumerable: false});console.log(obj)',
		resultStdout: `{}\n`
	},
	{
		code: 'const obj = {};Object.defineProperty(obj, "123", {value: 123, enumerable: true});console.log(obj)',
		resultStdout: `{ '123': 123 }\n`
	},
	{
		code: 'const obj = {};Object.defineProperty(obj, Symbol(123), {value: 123, enumerable: false});console.log(obj)',
		resultStdout: `{}\n`
	},
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

import assert from 'tjs:assert';

const tests = [
	// Test console.log()
	{ code: 'console.log("Hello, World!");', result: 'Hello, World!\n' },
	{ code: 'console.log(42);', result: '42\n' },
	{ code: 'console.log(true);', result: 'true\n' },
	{ code: 'console.log({a:1,b:2,c:{e:{f:{g:4}}}});', result: '{ a: 1, b: 2, c: { e: { f: [Object] } } }\n' },
	{ code: 'console.log(1,2,3);', result: '1 2 3\n' },
	{ code: 'console.log(1,2,[1,2,3]);', result: '1 2 [ 1, 2, 3 ]\n' },

	// Test console.error()
	{ code: 'console.error("Oops, an error occurred!");', result: 'Oops, an error occurred!\n', stderr: true },
	{ code: 'console.error(new Error("Something went wrong!"));', result: /^Error: Something went wrong!\n(.+\)\n)+/, stderr: true  },

	// Test console.warn()
	{ code: 'console.warn("Warning: This is a warning!");', result: 'Warning: This is a warning!\n', stderr: true },

	// Test console.trace()
	{ code: 'console.trace("This is a trace!");', result: /^Trace: This is a trace!\n(.+\)\n)+/, stderr: true },

	// Test console.info()
	{ code: 'console.info("Information: This is some information.");', result: 'Information: This is some information.\n' },

	// Test console.debug()
	{ code: 'console.debug("Debugging: This is a debug message.");', result: 'Debugging: This is a debug message.\n' },

	// Test console.table()
	{ code: 'console.table([{ name: "John", age: 30 }, { name: "Jane", age: 25 }]);', result: '┌─────────┬────────┬─────┐\n│ (index) │ name   │ age │\n├─────────┼────────┼─────┤\n│ 0       │ \'John\' │ 30  │\n│ 1       │ \'Jane\' │ 25  │\n└─────────┴────────┴─────┘\n' },

	// Test console.time() and console.timeEnd()
	{ code: 'console.time("timer");\nconsole.timeEnd("timer");', result: 'timer: 0ms\n' },

	// Test console.group() and console.groupEnd()
	{ code: 'console.group("Group 1");\nconsole.log("Hello from Group 1!");\nconsole.groupEnd();console.log("abc")', result: 'Group 1\n Hello from Group 1!\nabc\n' },

	// Test console.groupCollapsed() and console.groupEnd()
	{ code: 'console.groupCollapsed("Group 1");\nconsole.log("Hello from Group 1!");\nconsole.groupEnd();console.log("abc")', result: 'Group 1\n Hello from Group 1!\nabc\n' },

	// Test console.count()
	{ code: 'console.count("count");\nconsole.count("count");\nconsole.count("count");\nconsole.count("count2");', result: 'count: 1\ncount: 2\ncount: 3\ncount2: 1\n' },

	// Test console.clear(), on a non tty clear should not do anything
	{ code: 'console.clear();', result: '' },

	// Test console.clear() effect on group
	{ code: 'console.group("Group 1");console.log("Hello from Group 1!");console.clear();console.log("Hello from Group 0!");', result: 'Group 1\n Hello from Group 1!\nHello from Group 0!\n' },
];

const td = new TextDecoder();
async function runTest(code){
	const args = [
		tjs.exepath,
		'eval',
		code
	];
	const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
	const status = await proc.wait();
	const buf = new Uint8Array(4096);
	const nread = await proc.stdout.read(buf);
	const stdout = td.decode(buf.subarray(0, nread));
	const nread2 = await proc.stderr.read(buf);
	const stderr = td.decode(buf.subarray(0, nread2));
	return {code: status.exit_status, stdout, stderr};
}

for (const test of tests) {
	const jscode = test.code;
	const result = test.result;

	const {code, stdout, stderr} = await runTest(jscode);
	if(code !== 0){
		console.error(`Test failed with code ${code}: ${jscode}`);
		console.error(stderr);
		throw new Error('Test failed due to invalid exit code');
	}
	let resultData;
	if(test.stderr){
		assert.equal(stdout.trim().length, 0);
		resultData = stderr;
	}else{
		assert.equal(stderr.trim().length, 0);
		resultData = stdout;
	}
	if(test.result instanceof RegExp){
		assert.truthy(resultData.match(test.result));
	}else{
		assert.equal(resultData, result);
	}
};

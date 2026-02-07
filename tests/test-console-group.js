import assert from 'tjs:assert';
import { runTest, checkResult } from './helpers.js';

function checkConsoleNamespace(){
	assert.truthy(self.hasOwnProperty("console"), "console exists on the global object");

	const propDesc = Object.getOwnPropertyDescriptor(self, "console");
	assert.equals(propDesc.writable, true, "console must be writable");
	assert.equals(propDesc.enumerable, false, "console must not be enumerable");
	assert.equals(propDesc.configurable, true, "console must be configurable");
	assert.equals(propDesc.value, console, "console must have the right value");

	assert.falsy("Console" in self, "Console (uppercase, as if it were an interface) must not exist");

	const prototype1 = Object.getPrototypeOf(console);
	const prototype2 = Object.getPrototypeOf(prototype1);
	assert.equals(Object.getOwnPropertyNames(prototype1).length, 0, "The [[Prototype]] must have no properties");
	assert.equals(prototype2, Object.prototype, "The [[Prototype]]'s [[Prototype]] must be %ObjectPrototype%");
}

checkConsoleNamespace();

const tests = [

	// Test console.table()
	{ code: 'console.table([{ name: "John", age: 30 }, { name: "Jane", age: 25 }]);', resultStdout: '┌─────────┬────────┬─────┐\n│ (index) │ name   │ age │\n├─────────┼────────┼─────┤\n│ 0       │ \'John\' │ 30  │\n│ 1       │ \'Jane\' │ 25  │\n└─────────┴────────┴─────┘\n' },

	// Test console.group() and console.groupEnd()
	{ code: 'console.group("Group 1");\nconsole.log("Hello from Group 1!");\nconsole.groupEnd();console.log("abc")', resultStdout: 'Group 1\n  Hello from Group 1!\nabc\n' },

	// Test console.groupCollapsed() and console.groupEnd()
	{ code: 'console.groupCollapsed("Group 1");\nconsole.log("Hello from Group 1!");\nconsole.groupEnd();console.log("abc")', resultStdout: 'Group 1\n  Hello from Group 1!\nabc\n' },

	// Test console.clear(), on a non tty clear should not do anything
	{ code: 'console.clear();', resultStdout: '' },

	// Test console.clear() effect on group
	{ code: 'console.group("Group 1");console.log("Hello from Group 1!");console.clear();console.log("Hello from Group 0!");', resultStdout: 'Group 1\n  Hello from Group 1!\nHello from Group 0!\n' },
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

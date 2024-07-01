import assert from 'tjs:assert';

const tests = [
	
	// Test console.log()
	{ code: 'console.log("Hello, World!");', resultStdout: 'Hello, World!\n' },
	{ code: 'console.log(42);', resultStdout: '42\n' },
	{ code: 'console.log(true);', resultStdout: 'true\n' },
	{ code: 'console.log({a:1,b:2,c:{e:{f:{g:4}}}});', resultStdout: '{ a: 1, b: 2, c: { e: { f: [Object] } } }\n' },
	{ code: 'console.log(1,2,3);', resultStdout: '1 2 3\n' },
	{ code: 'console.log(1,2,[1,2,3]);', resultStdout: '1 2 [ 1, 2, 3 ]\n' },

	// Test console.error()
	{ code: 'console.error("Oops, an error occurred!");', resultStderr: 'Oops, an error occurred!\n' },
	{ code: 'console.error(new Error("Something went wrong!"));', resultStderr: /^Error: Something went wrong!\n(.+(\)|\:\d+)\n)+/  },

	// Test console.warn()
	{ code: 'console.warn("Warning: This is a warning!");', resultStderr: 'Warning: This is a warning!\n'},

	// Test console.trace()
	{ code: 'console.trace("This is a trace!");', resultStderr: /^Trace: This is a trace!\n(.+(\)|\:\d+)\n)+/},

	// Test console.info()
	{ code: 'console.info("Information: This is some information.");', resultStdout: 'Information: This is some information.\n' },

	// Test console.debug()
	{ code: 'console.debug("Debugging: This is a debug message.");', resultStdout: 'Debugging: This is a debug message.\n' },

	// Test console.table()
	{ code: 'console.table([{ name: "John", age: 30 }, { name: "Jane", age: 25 }]);', resultStdout: '┌─────────┬────────┬─────┐\n│ (index) │ name   │ age │\n├─────────┼────────┼─────┤\n│ 0       │ \'John\' │ 30  │\n│ 1       │ \'Jane\' │ 25  │\n└─────────┴────────┴─────┘\n' },

	// Test console.time() and console.timeEnd()
	{ code: 'console.time("timer");\nconsole.timeEnd("timer");', resultStdout: /^timer: 0(.\d+)?ms\n$/ },

	// Test console.group() and console.groupEnd()
	{ code: 'console.group("Group 1");\nconsole.log("Hello from Group 1!");\nconsole.groupEnd();console.log("abc")', resultStdout: 'Group 1\n  Hello from Group 1!\nabc\n' },

	// Test console.groupCollapsed() and console.groupEnd()
	{ code: 'console.groupCollapsed("Group 1");\nconsole.log("Hello from Group 1!");\nconsole.groupEnd();console.log("abc")', resultStdout: 'Group 1\n  Hello from Group 1!\nabc\n' },

	// Test console.count()
	{ code: 'console.count("count");\nconsole.count("count");\nconsole.count("count");\nconsole.count("count2");', resultStdout: 'count: 1\ncount: 2\ncount: 3\ncount2: 1\n' },

	// Test console.clear(), on a non tty clear should not do anything
	{ code: 'console.clear();', resultStdout: '' },

	// Test console.clear() effect on group
	{ code: 'console.group("Group 1");console.log("Hello from Group 1!");console.clear();console.log("Hello from Group 0!");', resultStdout: 'Group 1\n  Hello from Group 1!\nHello from Group 0!\n' },

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

	// Tests took from web platform tests:
	{ code: 'console.count();console.count(undefined);console.count("default");console.count({toString() {return "default"}});', resultStdout: 'default: 1\ndefault: 2\ndefault: 3\ndefault: 4\n' },
	{ 
		code: `
			console.count();console.countReset();console.count();console.count(undefined);console.countReset(undefined);
			console.count(undefined);console.count("default");console.countReset("default");console.count("default");
			console.count({toString() {return "default"}});console.countReset({toString() {return "default"}});
			console.count({toString() {return "default"}});console.count("a label");console.countReset();
			console.count("a label");
			console.countReset("b"); /* should produce a warning */
		`,
		resultStdout: `default: 1\ndefault: 1\ndefault: 2\ndefault: 1\ndefault: 2\ndefault: 1\ndefault: 2\ndefault: 3\na label: 1\na label: 2\n`,
		resultStderr: 'countReset: No counter named default\ncountReset: No counter named b\n'
	},
	{ 
		code: `
			["log", "dirxml", "trace", "group", "groupCollapsed"].forEach(method => {
			console[method]("%i", Symbol.for("description"));
			if (method == "group" || method == "groupCollapsed") console.groupEnd();
			console[method]("%d", Symbol.for("description"));
			if (method == "group" || method == "groupCollapsed") console.groupEnd();
			console[method]("%f", Symbol.for("description"));
			if (method == "group" || method == "groupCollapsed") console.groupEnd();
			});
		`,
		resultStdout: `NaN\nNaN\nNaN\nNaN\nNaN\nNaN\nNaN\nNaN\nNaN\nNaN\nNaN\nNaN\n`,
		resultStderr: /^(Trace: NaN\n(.+(\)|\:\d+)\n)+){3}$/
	},
	{ 
		code: `
			console.log("%s", Symbol.for("description"));
			console.dirxml("%s", Symbol.for("description"));
			console.trace("%s", Symbol.for("description"));
			console.group("%s", Symbol.for("description"));
			console.groupEnd();
			console.groupCollapsed("%s", Symbol.for("description"));
			console.groupEnd();
		`,
		resultStdout: `Symbol(description)\nSymbol(description)\nSymbol(description)\nSymbol(description)\n`,
		resultStderr: /^Trace: Symbol\(description\)\n(.+(\)|\:\d+)\n)+$/
	},
	{ code: `console.time();console.timeLog();console.timeEnd();`, resultStdout: /^(default: \d(\.\d+)?ms\n){2}$/ },
	{
		code: `console.time(undefined);console.timeLog(undefined);console.timeLog(undefined, "extra data");console.timeEnd(undefined);`,
		resultStdout: /^default: \d(\.\d+)?ms\ndefault: \d(\.\d+)?ms extra data\ndefault: \d(\.\d+)?ms\n$/
	},
	{
		code: `console.time("default");console.timeLog("default");console.timeLog("default", "extra data");console.timeEnd("default");`,
		resultStdout: /^default: \d(\.\d+)?ms\ndefault: \d(\.\d+)?ms extra data\ndefault: \d(\.\d+)?ms\n$/
	},
	{
		code: `
			console.time({toString() {return "default"}});console.timeLog({toString() {return "default"}});
			console.timeLog({toString() {return "default"}}, "extra data");console.timeEnd({toString() {return "default"}});
		`,
		resultStdout: /^default: \d(\.\d+)?ms\ndefault: \d(\.\d+)?ms extra data\ndefault: \d(\.\d+)?ms\n$/
	},
	{
		code: `
			console.time({toString() {return "custom toString"}});console.timeLog({toString() {return "custom toString"}});
			console.timeLog({toString() {return "custom toString"}}, "extra data");console.timeEnd({toString() {return "custom toString"}});
		`,
		resultStdout: /^custom toString: \d(\.\d+)?ms\ncustom toString: \d(\.\d+)?ms extra data\ncustom toString: \d(\.\d+)?ms\n$/
	},
	{
		code: `console.time("a label");console.timeLog("a label");console.timeLog("a label", "extra data");console.timeEnd("a label");`,
		resultStdout: /^a label: \d(\.\d+)?ms\na label: \d(\.\d+)?ms extra data\na label: \d(\.\d+)?ms\n$/
	},
	{
		code: `console.timeLog("b"); console.timeEnd("b");`,
		resultStderr: 'timeLog: No such timer: b\ntimeEnd: No such timer: b\n'
	}
];

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

const td = new TextDecoder();

async function slurpStdio(s) {
    const chunks = [];
    const buf = new Uint8Array(4096);

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const nread = await s.read(buf);

        if (nread === null) {
            break;
        }

        chunks.push(buf.slice(0, nread));
    }

    return chunks.map(chunk => td.decode(chunk)).join('');
}

async function runTest(code){
	const args = [
		tjs.exepath,
		'eval',
		code
	];
	const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
    const r = await Promise.allSettled([
        proc.wait(),
        slurpStdio(proc.stdout),
        slurpStdio(proc.stderr)
    ]);
    const status = r[0].value;
    const stdout = r[1].value;
    const stderr = r[2].value;

	return {code: status?.exit_status, stdout, stderr};
}

function checkResult(resultData, match, name){
	if(match instanceof RegExp){
		assert.truthy(resultData.match(match), name + ' does not match');
	}else{
		assert.equal(resultData, match, name + ' does not equal');
	}
}

checkConsoleNamespace();

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
};

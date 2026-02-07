import { runTest, checkResult } from './helpers.js';

const tests = [

	// Test console.count()
	{ code: 'console.count("count");\nconsole.count("count");\nconsole.count("count");\nconsole.count("count2");', resultStdout: 'count: 1\ncount: 2\ncount: 3\ncount2: 1\n' },

	// Test console.time() and console.timeEnd()
	{ code: 'console.time("timer");\nconsole.timeEnd("timer");', resultStdout: /^timer: 0(.\d+)?ms\n$/ },

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

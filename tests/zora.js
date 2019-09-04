var zora = (function (exports) {
    'use strict';

    const startTestMessage = (test, offset) => ({
        type: "TEST_START" /* TEST_START */,
        data: test,
        offset
    });
    const assertionMessage = (assertion, offset) => ({
        type: "ASSERTION" /* ASSERTION */,
        data: assertion,
        offset
    });
    const endTestMessage = (test, offset) => ({
        type: "TEST_END" /* TEST_END */,
        data: test,
        offset
    });
    const bailout = (error, offset) => ({
        type: "BAIL_OUT" /* BAIL_OUT */,
        data: error,
        offset
    });

    const delegateToCounter = (counter) => (target) => Object.defineProperties(target, {
        skipCount: {
            get() {
                return counter.skipCount;
            },
        },
        failureCount: {
            get() {
                return counter.failureCount;
            }
        },
        successCount: {
            get() {
                return counter.successCount;
            }
        },
        count: {
            get() {
                return counter.count;
            }
        }
    });
    const counter = () => {
        let success = 0;
        let failure = 0;
        let skip = 0;
        return Object.defineProperties({
            update(assertion) {
                const { pass, skip: isSkipped } = assertion;
                if (isSkipped) {
                    skip++;
                }
                else if (!isAssertionResult(assertion)) {
                    skip += assertion.skipCount;
                    success += assertion.successCount;
                    failure += assertion.failureCount;
                }
                else if (pass) {
                    success++;
                }
                else {
                    failure++;
                }
            }
        }, {
            successCount: {
                get() {
                    return success;
                }
            },
            failureCount: {
                get() {
                    return failure;
                }
            },
            skipCount: {
                get() {
                    return skip;
                }
            },
            count: {
                get() {
                    return skip + success + failure;
                }
            }
        });
    };

    const defaultTestOptions = Object.freeze({
        offset: 0,
        skip: false
    });
    const noop = () => {
    };
    const tester = (description, spec, { offset = 0, skip = false } = defaultTestOptions) => {
        let id = 0;
        let pass = true;
        let executionTime = 0;
        let error = null;
        const testCounter = counter();
        const withTestCounter = delegateToCounter(testCounter);
        const assertions = [];
        const collect = item => assertions.push(item);
        const specFunction = skip === true ? noop : function zora_spec_fn() {
            return spec(assert(collect, offset));
        };
        const testRoutine = (async function () {
            try {
                const start = Date.now();
                const result = await specFunction();
                executionTime = Date.now() - start;
                return result;
            }
            catch (e) {
                error = e;
            }
        })();
        return Object.defineProperties(withTestCounter({
            [Symbol.asyncIterator]: async function* () {
                await testRoutine;
                for (const assertion of assertions) {
                    assertion.id = ++id;
                    if (assertion[Symbol.asyncIterator]) {
                        // Sub test
                        yield startTestMessage({ description: assertion.description }, offset);
                        yield* assertion;
                        if (assertion.error !== null) {
                            // Bubble up the error and return
                            error = assertion.error;
                            pass = false;
                            return;
                        }
                    }
                    yield assertionMessage(assertion, offset);
                    pass = pass && assertion.pass;
                    testCounter.update(assertion);
                }
                return error !== null ?
                    yield bailout(error, offset) :
                    yield endTestMessage(this, offset);
            }
        }), {
            description: {
                enumerable: true,
                value: description
            },
            pass: {
                enumerable: true,
                get() {
                    return pass;
                }
            },
            executionTime: {
                enumerable: true,
                get() {
                    return executionTime;
                }
            },
            length: {
                get() {
                    return assertions.length;
                }
            },
            error: {
                get() {
                    return error;
                }
            },
            routine: {
                value: testRoutine
            },
            skip: {
                value: skip
            }
        });
    };

    var isArray = Array.isArray;
    var keyList = Object.keys;
    var hasProp = Object.prototype.hasOwnProperty;

    var fastDeepEqual = function equal(a, b) {
      if (a === b) return true;

      if (a && b && typeof a == 'object' && typeof b == 'object') {
        var arrA = isArray(a)
          , arrB = isArray(b)
          , i
          , length
          , key;

        if (arrA && arrB) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0;)
            if (!equal(a[i], b[i])) return false;
          return true;
        }

        if (arrA != arrB) return false;

        var dateA = a instanceof Date
          , dateB = b instanceof Date;
        if (dateA != dateB) return false;
        if (dateA && dateB) return a.getTime() == b.getTime();

        var regexpA = a instanceof RegExp
          , regexpB = b instanceof RegExp;
        if (regexpA != regexpB) return false;
        if (regexpA && regexpB) return a.toString() == b.toString();

        var keys = keyList(a);
        length = keys.length;

        if (length !== keyList(b).length)
          return false;

        for (i = length; i-- !== 0;)
          if (!hasProp.call(b, keys[i])) return false;

        for (i = length; i-- !== 0;) {
          key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }

        return true;
      }

      return a!==a && b!==b;
    };

    const isAssertionResult = (result) => {
        return 'operator' in result;
    };
    const specFnRegexp = /zora_spec_fn/;
    const nodeInternal = /node_modules\/.*|\(internal\/.*/;
    const getAssertionLocation = () => {
        const err = new Error();
        const stack = (err.stack || '')
            .split('\n')
            .filter(l => !nodeInternal.test(l) && l !== '');
        const userLandIndex = stack.findIndex(l => specFnRegexp.test(l));
        return (userLandIndex >= 1 ?
            stack[userLandIndex - 1] : (stack[stack.length - 1] || 'N/A'))
            .trim()
            .replace(/^at|^@/, '');
    };
    const assertMethodHook = (fn) => function (...args) {
        // @ts-ignore
        return this.collect(fn(...args));
    };
    const aliasMethodHook = (methodName) => function (...args) {
        return this[methodName](...args);
    };
    const AssertPrototype = {
        equal: assertMethodHook((actual, expected, description = 'should be equivalent') => ({
            pass: fastDeepEqual(actual, expected),
            actual,
            expected,
            description,
            operator: "equal" /* EQUAL */
        })),
        equals: aliasMethodHook('equal'),
        eq: aliasMethodHook('equal'),
        deepEqual: aliasMethodHook('equal'),
        notEqual: assertMethodHook((actual, expected, description = 'should not be equivalent') => ({
            pass: !fastDeepEqual(actual, expected),
            actual,
            expected,
            description,
            operator: "notEqual" /* NOT_EQUAL */
        })),
        notEquals: aliasMethodHook('notEqual'),
        notEq: aliasMethodHook('notEqual'),
        notDeepEqual: aliasMethodHook('notEqual'),
        is: assertMethodHook((actual, expected, description = 'should be the same') => ({
            pass: Object.is(actual, expected),
            actual,
            expected,
            description,
            operator: "is" /* IS */
        })),
        same: aliasMethodHook('is'),
        isNot: assertMethodHook((actual, expected, description = 'should not be the same') => ({
            pass: !Object.is(actual, expected),
            actual,
            expected,
            description,
            operator: "isNot" /* IS_NOT */
        })),
        notSame: aliasMethodHook('isNot'),
        ok: assertMethodHook((actual, description = 'should be truthy') => ({
            pass: Boolean(actual),
            actual,
            expected: 'truthy value',
            description,
            operator: "ok" /* OK */
        })),
        truthy: aliasMethodHook('ok'),
        notOk: assertMethodHook((actual, description = 'should be falsy') => ({
            pass: !Boolean(actual),
            actual,
            expected: 'falsy value',
            description,
            operator: "notOk" /* NOT_OK */
        })),
        falsy: aliasMethodHook('notOk'),
        fail: assertMethodHook((description = 'fail called') => ({
            pass: false,
            actual: 'fail called',
            expected: 'fail not called',
            description,
            operator: "fail" /* FAIL */
        })),
        throws: assertMethodHook((func, expected, description) => {
            let caught;
            let pass;
            let actual;
            if (typeof expected === 'string') {
                [expected, description] = [description, expected];
            }
            try {
                func();
            }
            catch (err) {
                caught = { error: err };
            }
            pass = caught !== undefined;
            actual = caught && caught.error;
            if (expected instanceof RegExp) {
                pass = expected.test(actual) || expected.test(actual && actual.message);
                actual = actual && actual.message || actual;
                expected = String(expected);
            }
            else if (typeof expected === 'function' && caught) {
                pass = actual instanceof expected;
                actual = actual.constructor;
            }
            return {
                pass,
                actual,
                expected,
                description: description || 'should throw',
                operator: "throws" /* THROWS */,
            };
        }),
        doesNotThrow: assertMethodHook((func, expected, description) => {
            let caught;
            if (typeof expected === 'string') {
                [expected, description] = [description, expected];
            }
            try {
                func();
            }
            catch (err) {
                caught = { error: err };
            }
            return {
                pass: caught === undefined,
                expected: 'no thrown error',
                actual: caught && caught.error,
                operator: "doesNotThrow" /* DOES_NOT_THROW */,
                description: description || 'should not throw'
            };
        })
    };
    const assert = (collect, offset) => {
        const actualCollect = item => {
            if (!item.pass) {
                item.at = getAssertionLocation();
            }
            collect(item);
            return item;
        };
        return Object.assign(Object.create(AssertPrototype, { collect: { value: actualCollect } }), {
            test(description, spec, opts = defaultTestOptions) {
                const subTest = tester(description, spec, Object.assign({}, defaultTestOptions, opts, { offset: offset + 1 }));
                collect(subTest);
                return subTest.routine;
            },
            skip(description, spec = noop, opts = defaultTestOptions) {
                return this.test(description, spec, Object.assign({}, opts, { skip: true }));
            }
        });
    };

    // with two arguments
    const curry = (fn) => (a, b) => b === void 0 ? b => fn(a, b) : fn(a, b);
    const toCurriedIterable = gen => curry((a, b) => ({
        [Symbol.asyncIterator]() {
            return gen(a, b);
        }
    }));

    const map = toCurriedIterable(async function* (fn, asyncIterable) {
        let index = 0;
        for await (const i of asyncIterable) {
            yield fn(i, index, asyncIterable);
            index++;
        }
    });

    const filter = toCurriedIterable(async function* (fn, asyncIterable) {
        let index = 0;
        for await (const i of asyncIterable) {
            if (fn(i, index, asyncIterable) === true) {
                yield i;
            }
            index++;
        }
    });

    const print = (message, offset = 0) => {
        console.log(message.padStart(message.length + (offset * 4))); // 4 white space used as indent (see tap-parser)
    };
    const stringifySymbol = (key, value) => {
        if (typeof value === 'symbol') {
            return value.toString();
        }
        return value;
    };
    const printYAML = (obj, offset = 0) => {
        const YAMLOffset = offset + 0.5;
        print('---', YAMLOffset);
        for (const [prop, value] of Object.entries(obj)) {
            print(`${prop}: ${JSON.stringify(stringifySymbol(null, value), stringifySymbol)}`, YAMLOffset + 0.5);
        }
        print('...', YAMLOffset);
    };
    const comment = (value, offset) => {
        print(`# ${value}`, offset);
    };
    const subTestPrinter = (prefix = '') => (message) => {
        const { data } = message;
        const value = `${prefix}${data.description}`;
        comment(value, message.offset);
    };
    const mochaTapSubTest = subTestPrinter('Subtest: ');
    const tapeSubTest = subTestPrinter();
    const assertPrinter = (diagnostic) => (message) => {
        const { data, offset } = message;
        const { pass, description, id } = data;
        const label = pass === true ? 'ok' : 'not ok';
        if (isAssertionResult(data)) {
            print(`${label} ${id} - ${description}`, offset);
            if (pass === false) {
                printYAML(diagnostic(data), offset);
            }
        }
        else {
            const comment = data.skip === true ? 'SKIP' : `${data.executionTime}ms`;
            print(`${pass ? 'ok' : 'not ok'} ${id} - ${description} # ${comment}`, message.offset);
        }
    };
    const tapeAssert = assertPrinter(({ id, pass, description, ...rest }) => rest);
    const mochaTapAssert = assertPrinter(({ expected, id, pass, description, actual, operator, at, ...rest }) => ({
        wanted: expected,
        found: actual,
        at,
        operator,
        ...rest
    }));
    const testEnd = (message) => {
        const length = message.data.length;
        const { offset } = message;
        print(`1..${length}`, offset);
    };
    const printBailout = (message) => {
        print('Bail out! Unhandled error.');
    };
    const reportAsMochaTap = (message) => {
        switch (message.type) {
            case "TEST_START" /* TEST_START */:
                mochaTapSubTest(message);
                break;
            case "ASSERTION" /* ASSERTION */:
                mochaTapAssert(message);
                break;
            case "TEST_END" /* TEST_END */:
                testEnd(message);
                break;
            case "BAIL_OUT" /* BAIL_OUT */:
                printBailout();
                throw message.data;
        }
    };
    const reportAsTapeTap = (message) => {
        switch (message.type) {
            case "TEST_START" /* TEST_START */:
                tapeSubTest(message);
                break;
            case "ASSERTION" /* ASSERTION */:
                tapeAssert(message);
                break;
            case "BAIL_OUT" /* BAIL_OUT */:
                printBailout();
                throw message.data;
        }
    };
    const flatFilter = filter((message) => {
        return message.type === "TEST_START" /* TEST_START */
            || message.type === "BAIL_OUT" /* BAIL_OUT */
            || (message.type === "ASSERTION" /* ASSERTION */ && (isAssertionResult(message.data) || message.data.skip === true));
    });
    const flattenStream = (stream) => {
        let id = 0;
        const mapper = map(message => {
            if (message.type === "ASSERTION" /* ASSERTION */) {
                const mappedData = Object.assign(message.data, { id: ++id });
                return assertionMessage(mappedData, 0);
            }
            return Object.assign({}, message, { offset: 0 });
        });
        return mapper(flatFilter(stream));
    };
    const printSummary = (harness) => {
        print('', 0);
        comment(harness.pass ? 'ok' : 'not ok', 0);
        comment(`success: ${harness.successCount}`, 0);
        comment(`skipped: ${harness.skipCount}`, 0);
        comment(`failure: ${harness.failureCount}`, 0);
    };
    const tapeTapLike = async (stream) => {
        print('TAP version 13');
        const streamInstance = flattenStream(stream);
        for await (const message of streamInstance) {
            reportAsTapeTap(message);
        }
        print(`1..${stream.count}`, 0);
        printSummary(stream);
    };
    const mochaTapLike = async (stream) => {
        print('TAP version 13');
        for await (const message of stream) {
            reportAsMochaTap(message);
        }
        printSummary(stream);
    };

    const harnessFactory = () => {
        const tests = [];
        const testCounter = counter();
        const withTestCounter = delegateToCounter(testCounter);
        const rootOffset = 0;
        const collect = item => tests.push(item);
        const api = assert(collect, rootOffset);
        let pass = true;
        let id = 0;
        const instance = Object.create(api, {
            length: {
                get() {
                    return tests.length;
                }
            },
            pass: {
                get() {
                    return pass;
                }
            }
        });
        return withTestCounter(Object.assign(instance, {
            [Symbol.asyncIterator]: async function* () {
                for (const t of tests) {
                    t.id = ++id;
                    if (t[Symbol.asyncIterator]) {
                        // Sub test
                        yield startTestMessage({ description: t.description }, rootOffset);
                        yield* t;
                        if (t.error !== null) {
                            pass = false;
                            return;
                        }
                    }
                    yield assertionMessage(t, rootOffset);
                    pass = pass && t.pass;
                    testCounter.update(t);
                }
                yield endTestMessage(this, 0);
            },
            report: async (reporter = tapeTapLike) => {
                return reporter(instance);
            }
        }));
    };

    let autoStart = true;
    let indent = false;
    const defaultTestHarness = harnessFactory();
    const rootTest = defaultTestHarness.test.bind(defaultTestHarness);
    rootTest.indent = () => indent = true;
    const test = rootTest;
    const skip = (description, spec, options = {}) => rootTest(description, spec, Object.assign({}, options, { skip: true }));
    rootTest.skip = skip;
    const equal = defaultTestHarness.equal.bind(defaultTestHarness);
    const equals = equal;
    const eq = equal;
    const deepEqual = equal;
    const notEqual = defaultTestHarness.notEqual.bind(defaultTestHarness);
    const notEquals = notEqual;
    const notEq = notEqual;
    const notDeepEqual = notEqual;
    const is = defaultTestHarness.is.bind(defaultTestHarness);
    const same = is;
    const isNot = defaultTestHarness.isNot.bind(defaultTestHarness);
    const notSame = isNot;
    const ok = defaultTestHarness.ok.bind(defaultTestHarness);
    const truthy = ok;
    const notOk = defaultTestHarness.notOk.bind(defaultTestHarness);
    const falsy = notOk;
    const fail = defaultTestHarness.fail.bind(defaultTestHarness);
    const throws = defaultTestHarness.throws.bind(defaultTestHarness);
    const doesNotThrow = defaultTestHarness.doesNotThrow.bind(defaultTestHarness);
    const createHarness = () => {
        autoStart = false;
        return harnessFactory();
    };
    const start = () => {
        if (autoStart) {
            defaultTestHarness.report(indent ? mochaTapLike : tapeTapLike);
        }
    };
    // on next tick start reporting
    // @ts-ignore
    if (typeof window === 'undefined') {
        setTimeout(start, 0);
    }
    else {
        // @ts-ignore
        window.addEventListener('load', start);
    }

    exports.AssertPrototype = AssertPrototype;
    exports.createHarness = createHarness;
    exports.deepEqual = deepEqual;
    exports.doesNotThrow = doesNotThrow;
    exports.eq = eq;
    exports.equal = equal;
    exports.equals = equals;
    exports.fail = fail;
    exports.falsy = falsy;
    exports.is = is;
    exports.isNot = isNot;
    exports.mochaTapLike = mochaTapLike;
    exports.notDeepEqual = notDeepEqual;
    exports.notEq = notEq;
    exports.notEqual = notEqual;
    exports.notEquals = notEquals;
    exports.notOk = notOk;
    exports.notSame = notSame;
    exports.ok = ok;
    exports.same = same;
    exports.skip = skip;
    exports.tapeTapLike = tapeTapLike;
    exports.test = test;
    exports.throws = throws;
    exports.truthy = truthy;

    return exports;

}({}));
//# sourceMappingURL=zora.js.map

/* global tjs */
/** console implementation according to https://console.spec.whatwg.org/ and otherwise inspired by nodejs behavior */

import { format as utilFormat, inspect as utilInspect } from './console-util.js';

function createConsole({
    logger, clearConsole, printer,
    formatter = args => utilFormat(...args),
    inspect = utilInspect
}) {
    if (!printer) {
        throw new Error('Printer is required');
    }

    const _printer = (logLevel, args, options) => {
        printer(logLevel, args, { ...options, indent: groupCount });
    };

    if (!logger) {
        logger = function Logger(logLevel, args, options) {
            if (args.length === 1) {
                _printer(logLevel, args, options);
            } else if (args.length > 1) {
                _printer(logLevel, [ formatter(args) ], options);
            }
        };
    }

    let groupCount = 0;
    const countMap = new Map();
    const timers = new Map();

    const consoleObj = Object.create({});

    // Logging
    consoleObj.assert = function(condition = false, ...data) {
        if (condition) {
            return;
        }

        const message = 'Assertion failed';

        if (data.length === 0) {
            data.push(message);
        } else if (typeof(data[0]) !== 'string') {
            data.unshift(message);
        } else {
            data[0] = message + ': ' + data[0];
        }

        logger('assert', data);
    };

    consoleObj.clear = function() {
        groupCount = 0;
        clearConsole();
    };

    consoleObj.table = function(data, properties) {
        if (properties !== undefined && !Array.isArray(properties)) {
            throw new Error(
                'The \'properties\' argument must be of type Array. ' +
                'Received type string'
            );
        }

        if (data === null || typeof data !== 'object') {
            return _printer('table', data);
        }

        function getProperties(data) {
            const props = [];
            const propsS = new Set();

            for (const i in data) {
                if (typeof data[i] === 'object') {
                    for (const key in data[i]) {
                        if (!propsS.has(key)) {
                            props.push(key);
                            propsS.add(key);
                        }
                    }
                }
            }

            return props;
        }

        if (!properties) {
            properties = getProperties(data);
        }

        function normalize(data) {
            // eslint-disable-next-line no-control-regex
            const colorRegExp = /\u001b\[\d\d?m/g;

            return inspect(data).replace(colorRegExp, '');
        }

        function countBytes(str) {
            return encoder.encode(str).byteLength;
        }

        function getTableData(data, properties, addIndex = true) {
            const rows = [
                addIndex ? [ '(index)', ...properties ] : [ ...properties ]
            ];

            for (const i in data) {
                const row = addIndex ? [ i ] : [];

                for (const p of properties) {
                    row.push(normalize(data[i][p] || ''));
                }

                rows.push(row);
            }

            return rows;
        }

        const rows = getTableData(data, properties);

        const cols = [];

        for (let ci=0;ci<rows[0].length;ci++) {
            for (let ri=0;ri<rows.length;ri++) {
                cols[ci] = { width: Math.max(cols[ci]?.width ?? 0, countBytes(rows[ri][ci])) };
            }
        }

        function renderTable(rows, cols) {
            const tableChars = {
                middleMiddle: '─',
                rowMiddle: '┼',
                topRight: '┐',
                topLeft: '┌',
                leftMiddle: '├',
                topMiddle: '┬',
                bottomRight: '┘',
                bottomLeft: '└',
                bottomMiddle: '┴',
                rightMiddle: '┤',
                left: '│',
                right: '│',
                middle: '│'
            };

            let str = '';

            function drawHorizLine(left, right, middle) {
                str += left;

                for (let ci=0;ci<cols.length;ci++) {
                    if (ci > 0) {
                        str += middle;
                    }

                    str += tableChars.middleMiddle.repeat(cols[ci].width + 2);
                }

                str += right;
            }

            function drawRow(row) {
                for (let ci=0;ci<cols.length;ci++) {
                    if (ci === 0) {
                        str += tableChars.left;
                    } else {
                        str += tableChars.middle;
                    }

                    str += ' ' + row[ci] + (' ').repeat(cols[ci].width - countBytes(row[ci]) + 1);
                }

                str += tableChars.right + '\n';
            }

            for (let ri=0;ri<rows.length;ri++) {
                if (ri === 0) {
                    drawHorizLine(tableChars.topLeft, tableChars.topRight+'\n', tableChars.topMiddle);
                } else if (ri === 1) { // only draw the middle line after the header
                    drawHorizLine(tableChars.leftMiddle, tableChars.rightMiddle+'\n', tableChars.rowMiddle);
                }

                drawRow(rows[ri]);
            }

            drawHorizLine(tableChars.bottomLeft, tableChars.bottomRight, tableChars.bottomMiddle);

            return str;
        }

        _printer('table', [ renderTable(rows, cols) ]);
    };

    consoleObj.trace = function(...data) {
        const stack = (new Error()).stack.trim().split('\n').slice(1).join('\n');

        _printer('trace', [ 'Trace: ' + formatter(data) + '\n' + stack  ]);
    };

    consoleObj.dir = function(item, options) {
        _printer('dir', [ inspect(item) ], options);
    };

    consoleObj.dirxml = function(...data) {
        logger('dirxml', data);
    };

    // Counting
    consoleObj.count = function(label = 'default') {
        label = String(label);
        let count = countMap.get(label) ?? 0;

        count++;
        countMap.set(label, count);
        _printer('count', [ label + ': ' + count ]);
    };

    consoleObj.countReset = function(label = 'default') {
        if (!countMap.delete(label)) {
            logger('countReset', [ 'countReset: No counter named ' + label ], { isWarn: true });
        }
    };

    // Grouping
    consoleObj.group = function(...data) {
        if (data.length > 0) {
            logger('group', data);
        }

        groupCount++;
    };

    consoleObj.groupCollapsed = function(...data) {
        consoleObj.group(...data);
    };

    consoleObj.groupEnd = function() {
        groupCount = Math.max(0, groupCount - 1);
    };

    // Timing
    consoleObj.time = function(label = 'default') {
        label = String(label);

        if (timers.has(label)) {
            logger('time', [ 'Timer ' + label + ' already exists' ], { isWarn: true });
        } else {
            timers.set(label, performance.now());
        }
    };

    consoleObj.timeLog = function(label = 'default', ...data) {
        label = String(label);

        if (!timers.has(label)) {
            logger('timeLog', [ 'timeLog: No such timer: ' + label ], { isWarn: true });
        } else {
            const duration = performance.now() - timers.get(label);

            data.unshift(label + ': ' + duration + 'ms');
            _printer('timeLog', data);
        }
    };

    consoleObj.timeEnd = function(label = 'default') {
        label = String(label);

        if (!timers.has(label)) {
            logger('timeEnd', [ 'timeEnd: No such timer: ' + label ], { isWarn: true });
        } else {
            const start = timers.get(label);

            timers.delete(label);
            const duration = performance.now() - start;

            _printer('timeEnd', [ label + ': ' + duration + 'ms' ]);
        }
    };

    const loggingFuncs = [ 'debug', 'error', 'info', 'log', 'warn' ];

    for (const func of loggingFuncs) {
        consoleObj[func] = function(...args) {
            logger(func, args);
        };
    }

    return consoleObj;
}


const encoder = new TextEncoder();

Object.defineProperty(window, 'console', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: createConsole({
        clearConsole() {
            if (tjs.stdout.isTTY) {
                tjs.stdout.write(encoder.encode('\x1Bc'));
            }
        },
        printer(logLevel, args, { indent, isWarn }) {
            const msg = args.map(arg => {
                if (typeof arg === 'string') {
                    return arg;
                } else {
                    return utilInspect(arg);
                }
            }).join(' ');

            const str = encoder.encode((' ').repeat(indent*2) + msg + '\n');

            if ([ 'error', 'trace', 'warn' ].includes(logLevel) || isWarn) {
                tjs.stderr.write(str);
            } else {
                tjs.stdout.write(str);
            }
        },
    })
});

globalThis[Symbol.for('tjs.internal.core')].createConsole = createConsole;
globalThis[Symbol.for('tjs.internal.core')].inspect = utilInspect;
globalThis[Symbol.for('tjs.internal.core')].format = utilFormat;

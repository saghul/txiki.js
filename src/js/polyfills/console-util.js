// Code from https://github.com/browserify/node-util
// but fixed Symbol handling, added support for %i/%f and removed uneeded stuff (by lal12)


// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function extend(origin, add) {
    // Don't do anything if add isn't an object
    if (!add || !isObject(add)) {
        return origin;
    }

    var keys = Object.keys(add);
    var i = keys.length;

    while (i--) {
        origin[keys[i]] = add[keys[i]];
    }

    return origin;
}

var formatRegExp = /%[sdjif%]/g;

export function format(f) {
    if (!isString(f)) {
        var objects = [];

        for (let i = 0; i < arguments.length; i++) {
            objects.push(inspect(arguments[i]));
        }

        return objects.join(' ');
    }

    let i = 1;
    var args = arguments;
    var len = args.length;
    var str = String(f).replace(formatRegExp, function(x) {
        if (x === '%%') {
            return '%';
        }

        if (i >= len) {
            return x;
        }

        switch (x) {
            case '%s': return String(args[i++]);

            case '%d':
            // eslint-disable-next-line padding-line-between-statements, no-fallthrough
            case '%i':{
                const arg = args[i++];

                return typeof arg === 'symbol' ? NaN : parseInt(arg, 10);
            }

            case '%f':{
                const arg = args[i++];

                return typeof arg === 'symbol' ? NaN : parseFloat(arg);
            }

            case '%j':
                try {
                    return JSON.stringify(args[i++]);
                } catch (_) {
                    return '[Circular]';
                }

            default:
                return x;
        }
    });

    for (var x = args[i]; i < len; x = args[++i]) {
        if (x === null || ![ 'object', 'symbol' ].includes(typeof x)) {
            str += ' ' + x;
        } else {
            str += ' ' + inspect(x);
        }
    }

    return str;
}


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
export function inspect(obj, opts) {
    // default options
    var ctx = {
        seen: [],
        stylize: stylizeNoColor
    };

    // legacy...
    if (arguments.length >= 3) {
        ctx.depth = arguments[2];
    }

    if (arguments.length >= 4) {
        ctx.colors = arguments[3];
    }

    if (opts) {
    // got an "options" object
        extend(ctx, opts);
    }

    // set default options
    if (ctx.showHidden === void 0) {
        ctx.showHidden = false;
    }

    if (ctx.depth === void 0) {
        ctx.depth = 2;
    }

    if (ctx.colors === void 0) {
        ctx.colors = false;
    }

    if (ctx.colors) {
        ctx.stylize = stylizeWithColor;
    }

    return formatValue(ctx, obj, ctx.depth);
}


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
    'bold' : [ 1, 22 ],
    'italic' : [ 3, 23 ],
    'underline' : [ 4, 24 ],
    'inverse' : [ 7, 27 ],
    'white' : [ 37, 39 ],
    'grey' : [ 90, 39 ],
    'black' : [ 30, 39 ],
    'blue' : [ 34, 39 ],
    'cyan' : [ 36, 39 ],
    'green' : [ 32, 39 ],
    'magenta' : [ 35, 39 ],
    'red' : [ 31, 39 ],
    'yellow' : [ 33, 39 ]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
    'special': 'cyan',
    'number': 'yellow',
    'boolean': 'yellow',
    'undefined': 'grey',
    'null': 'bold',
    'string': 'green',
    'date': 'magenta',
    // "name": intentionally not styling
    'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
    var style = inspect.styles[styleType];

    if (style) {
        return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
    } else {
        return str;
    }
}


function stylizeNoColor(str) {
    return str;
}

function formatValue(ctx, value, recurseTimes) {
    // Primitive types cannot have properties
    const primitive = formatPrimitive(ctx, value);

    if (primitive) {
        return primitive;
    }

    // Look up the keys of the object.
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const descriptorsArr = Reflect.ownKeys(descriptors).map(k=>([ k, descriptors[k] ]));
    let keys = descriptorsArr.filter(([ _v, desc ])=>desc.enumerable).map(([ v, _desc ])=>v);
    const visibleKeys = new Set(keys);

    if (ctx.showHidden) {
        keys = descriptorsArr.map(([ v, _desc ])=>v);
    }

    // Some type of object without properties can be shortcutted.
    if (keys.length === 0) {
        if (typeof value === 'function') {
            const name = value.name ? ': ' + value.name : '';

            return ctx.stylize('[Function' + name + ']', 'special');
        }

        if (isRegExp(value)) {
            return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
        }

        if (isDate(value)) {
            return ctx.stylize(Date.prototype.toString.call(value), 'date');
        }

        if (isError(value)) {
            return formatError(value);
        }
    }

    var base = '', array = false, braces = [ '{', '}' ];

    // Make Array say that they are Array
    if (Array.isArray(value)) {
        array = true;
        braces = [ '[', ']' ];
    }

    // Make functions say that they are functions
    if (typeof value === 'function') {
        var n = value.name ? ': ' + value.name : '';

        base = ' [Function' + n + ']';
    }

    // Make RegExps say that they are RegExps
    if (isRegExp(value)) {
        base = ' ' + RegExp.prototype.toString.call(value);
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
        base = ' ' + Date.prototype.toUTCString.call(value);
    }

    // Make error with message first say the error
    if (isError(value)) {
        base = ' ' + formatError(value);
    }

    if (keys.length === 0 && (!array || value.length === 0)) {
        return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
        if (isRegExp(value)) {
            return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
        } else {
            return ctx.stylize('[Object]', 'special');
        }
    }

    ctx.seen.push(value);

    var output;

    if (array) {
        output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
    } else {
        output = keys.map(function(key) {
            return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
        });
    }

    ctx.seen.pop();

    return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
    if (value === void 0) {
        return ctx.stylize('undefined', 'undefined');
    }

    if (isString(value)) {
        var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
            .replace(/'/g, '\\\'')
            .replace(/\\"/g, '"') + '\'';

        return ctx.stylize(simple, 'string');
    }

    if (isNumber(value)) {
        return ctx.stylize('' + value, 'number');
    }

    if (typeof value === 'boolean') {
        return ctx.stylize('' + value, 'boolean');
    }

    // For some reason typeof null is "object", so special case here.
    if (value === null) {
        return ctx.stylize('null', 'null');
    }

    if (isSymbol(value)) {
        return ctx.stylize(value.toString(), 'symbol');
    }
}


function formatError(value) {
    return value.toString() + '\n' + value.stack;
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
    var output = [];

    for (var i = 0, l = value.length; i < l; ++i) {
        if (Object.prototype.hasOwnProperty.call(value, String(i))) {
            output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
                String(i), true));
        } else {
            output.push('');
        }
    }

    keys.forEach(function(key) {
        if (!key.match(/^\d+$/)) {
            output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
                key, true));
        }
    });

    return output;
}

function formatKey(ctx, key, visible) {
    let str = visible ? '' : '[';

    if (typeof key === 'symbol') {
        str += ctx.stylize('[' + formatValue(ctx, key, null) + ']', 'special');
    } else if (key.match(/^([a-zA-Z_][a-zA-Z_0-9]*)$/)) {
        str += ctx.stylize(key, 'name');
    } else {
        str += ctx.stylize('\'' + JSON.stringify(key).slice(1,-1).replace(/\\"/g, '"') + '\'', 'string');
    }

    if (!visible) {
        str += ']';
    }

    return str;
}

function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
    var name, str, desc;

    desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };

    if (desc.get) {
        if (desc.set) {
            str = ctx.stylize('[Getter/Setter]', 'special');
        } else {
            str = ctx.stylize('[Getter]', 'special');
        }
    } else {
        if (desc.set) {
            str = ctx.stylize('[Setter]', 'special');
        }
    }

    if (!str) {
        if (ctx.seen.indexOf(desc.value) < 0) {
            if (recurseTimes === null) {
                str = formatValue(ctx, desc.value, null);
            } else {
                str = formatValue(ctx, desc.value, recurseTimes - 1);
            }

            if (str.indexOf('\n') > -1) {
                if (array) {
                    str = str.split('\n').map(function(line) {
                        return '  ' + line;
                    }).join('\n').slice(2);
                } else {
                    str = '\n' + str.split('\n').map(function(line) {
                        return '   ' + line;
                    }).join('\n');
                }
            }
        } else {
            str = ctx.stylize('[Circular]', 'special');
        }
    }

    if (name === void 0) {
        if (array && typeof key === 'string' && key.match(/^\d+$/)) {
            return str;
        }

        name = formatKey(ctx, key, visibleKeys.has(key));
    }

    return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
    var length = output.reduce(function(prev, cur) {
        // eslint-disable-next-line no-control-regex
        return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
    }, 0);

    if (length > 60) {
        return braces[0] +
           (base === '' ? '\n' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           '\n' +
           braces[1];
    }

    return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}

function isNumber(arg) {
    return typeof arg === 'number';
}

function isString(arg) {
    return typeof arg === 'string';
}

function isSymbol(arg) {
    return typeof arg === 'symbol';
}

function isRegExp(re) {
    return isObject(re) && Object.prototype.toString.call(re) === '[object RegExp]';
}

function isObject(arg) {
    return typeof arg === 'object' && arg !== null;
}

function isDate(d) {
    return isObject(d) && Object.prototype.toString.call(d) === '[object Date]';
}

function isError(e) {
    return isObject(e) &&
      (Object.prototype.toString.call(e) === '[object Error]' || e instanceof Error);
}

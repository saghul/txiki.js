import util from 'util';

const encoder = new TextEncoder();

function print() {
  const text = util.format.apply(null, arguments) + '\n';
  tjs.stdout.write(encoder.encode(text));
}


// Copyright Joyent, Inc. and other Node contributors. MIT license.
// Forked from Node's lib/internal/cli_table.js

function hasOwnProperty(obj, v) {
    if (obj == null) {
      return false;
    }
    return Object.prototype.hasOwnProperty.call(obj, v);
}

const tableChars = {
  middleMiddle: "─",
  rowMiddle: "┼",
  topRight: "┐",
  topLeft: "┌",
  leftMiddle: "├",
  topMiddle: "┬",
  bottomRight: "┘",
  bottomLeft: "└",
  bottomMiddle: "┴",
  rightMiddle: "┤",
  left: "│ ",
  right: " │",
  middle: " │ "
};

const colorRegExp = /\u001b\[\d\d?m/g;

function removeColors(str) {
  return str.replace(colorRegExp, "");
}

function countBytes(str) {
  const normalized = removeColors(String(str)).normalize("NFC");

  return encoder.encode(normalized).byteLength;
}

function renderRow(row, columnWidths) {
  let out = tableChars.left;
  for (let i = 0; i < row.length; i++) {
    const cell = row[i];
    const len = countBytes(cell);
    const needed = (columnWidths[i] - len) / 2;
    // round(needed) + ceil(needed) will always add up to the amount
    // of spaces we need while also left justifying the output.
    out += `${" ".repeat(needed)}${cell}${" ".repeat(Math.ceil(needed))}`;
    if (i !== row.length - 1) {
      out += tableChars.middle;
    }
  }
  out += tableChars.right;
  return out;
}

function cliTable(head, columns) {
  const rows = [];
  const columnWidths = head.map((h) => countBytes(h));
  const longestColumn = columns.reduce(
    (n, a) => Math.max(n, a.length),
    0
  );

  for (let i = 0; i < head.length; i++) {
    const column = columns[i];
    for (let j = 0; j < longestColumn; j++) {
      if (rows[j] === undefined) {
        rows[j] = [];
      }
      const value = (rows[j][i] = hasOwnProperty(column, j) ? column[j] : "");
      const width = columnWidths[i] || 0;
      const counted = countBytes(value);
      columnWidths[i] = Math.max(width, counted);
    }
  }

  const divider = columnWidths.map((i) => tableChars.middleMiddle.repeat(i + 2));

  let result =
    `${tableChars.topLeft}${divider.join(tableChars.topMiddle)}` +
    `${tableChars.topRight}\n${renderRow(head, columnWidths)}\n` +
    `${tableChars.leftMiddle}${divider.join(tableChars.rowMiddle)}` +
    `${tableChars.rightMiddle}\n`;

  for (const row of rows) {
    result += `${renderRow(row, columnWidths)}\n`;
  }

  result +=
    `${tableChars.bottomLeft}${divider.join(tableChars.bottomMiddle)}` +
    tableChars.bottomRight;

  return result;
}


class Console {

    log(...args) {
        print(...args);
    }

    info(...args) {
        print(...args);
    }

    warn(...args) {
        print(...args);
    }

    error(...args) {
        print(...args);
    }

    assert(expression, ...args) {
        if (!expression) {
            this.error(...args);
        }
    }

    dir(o) {
        this.log(util.inspect(o));
    }

    dirxml(o) {
        this.dir(o);
    }

    table(data, properties) {
        if (properties !== undefined && !Array.isArray(properties)) {
          throw new Error(
            "The 'properties' argument must be of type Array. " +
              "Received type string"
          );
        }
    
        if (data === null || typeof data !== "object") {
          return this.log(data);
        }
    
        const objectValues = {};
        const indexKeys = [];
        const values = [];
    
        const stringifyValue = (value) => util.format(value);
        const toTable = (header, body) => this.log(cliTable(header, body));
        const createColumn = (value, shift) => [
          ...(shift ? [...new Array(shift)].map(() => "") : []),
          stringifyValue(value)
        ];
    
        let resultData;
        const isSet = data instanceof Set;
        const isMap = data instanceof Map;
        const valuesKey = "Values";
        const indexKey = isSet || isMap ? "(iteration index)" : "(index)";
    
        if (data instanceof Set) {
          resultData = [...data];
        } else if (data instanceof Map) {
          let idx = 0;
          resultData = {};
    
          data.forEach(
            (v, k) => {
              resultData[idx] = { Key: k, Values: v };
              idx++;
            }
          );
        } else {
          resultData = data;
        }
    
        Object.keys(resultData).forEach(
          (k, idx) => {
            const value = resultData[k];
    
            if (value !== null && typeof value === "object") {
              Object.entries(value).forEach(
                ([k, v]) => {
                  if (properties && !properties.includes(k)) {
                    return;
                  }
    
                  if (objectValues[k]) {
                    objectValues[k].push(stringifyValue(v));
                  } else {
                    objectValues[k] = createColumn(v, idx);
                  }
                }
              );
    
              values.push("");
            } else {
              values.push(stringifyValue(value));
            }
    
            indexKeys.push(k);
          }
        );
    
        const headerKeys = Object.keys(objectValues);
        const bodyValues = Object.values(objectValues);
        const header = [
          indexKey,
          ...(properties || [
            ...headerKeys,
            !isMap && values.length > 0 && valuesKey
          ])
        ].filter(Boolean);
        const body = [indexKeys, ...bodyValues, values];
    
        toTable(header, body);
    }

    trace(...args) {
        const err = new Error();
        err.name = 'Trace';
        err.message = args.map(String).join(' ');
        const tmpStack = err.stack.split('\n');
        tmpStack.splice(0, 1);
        err.stack = tmpStack.join('\n');
        this.error(err);
    }
}


Object.defineProperty(window, 'console', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new Console()
});

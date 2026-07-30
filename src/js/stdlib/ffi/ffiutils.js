export function parseCProto(header) {
    function tokenize(str) {
        const words = str.split(/[ \t]+/);
        const tokens = [];
        const tokenRegex = /(\w+|[^\w])/g;

        for (const w of words) {
            if (w.length === 0) {
                continue;
            }

            let m;

            while ((m = tokenRegex.exec(w))) {
                tokens.push(m[1]);
            }

            tokenRegex.lastIndex = 0;
        }

        return tokens;
    }

    function filterComments(tokens) {
        let comment = null;

        for (let i = 0; i < tokens.length; i++) {
            if (comment?.type === 'line' && tokens[i] === '\n' && tokens[i-1] !== '\\') {
                tokens.splice(comment.start, i - comment.start + 1);
                i = comment.start - 1;
                comment = null;
            } else if (tokens[i] === '*' && tokens[i+1] === '/') {
                if (!comment) {
                    throw new Error('Unexpected */');
                }

                tokens.splice(comment.start, i - comment.start + 2);
                i = comment.start - 1;
                comment = null;
            } else if (!comment) {
                if (tokens[i] === '/' && tokens[i+1] === '*') {
                    comment = { start: i, type: 'block' };
                    i++;
                // handle # preprocessor directives as comments
                } else if ((tokens[i] === '/' && tokens[i+1] === '/') || tokens[i] === '#') {
                    comment = { start: i, type: 'line' };
                    i++;
                } else if (tokens[i] === '\n') { // newlines are only needed for line comments
                    tokens.splice(i, 1);
                    i--;
                }
            }
        }

        if (comment?.type === 'block') {
            throw new Error('Expected closing comment */, but got EOF');
        }
    }

    function sepStatements(tokens, offs = 0) {
        const statements = [];
        let index = offs;
        const firstToken = tokens[index];

        if (firstToken === '[' || firstToken === '(' || firstToken === '{') {
            index++;
            statements._block = firstToken;
        }

        let stTokens = [];

        while (index < tokens.length) {
            const t = tokens[index];

            switch (t) {
                case '{': {
                    const [ sst, newOffs ] = sepStatements(tokens, index);

                    stTokens.push(sst);
                    index = newOffs;

                    break;
                }

                case '(':

                // eslint-disable-next-line no-fallthrough
                case '[': {
                    const [ sst, newOffs ] = sepStatements(tokens, index);

                    stTokens.push(sst);
                    index = newOffs;

                    break;
                }

                case '}':
                    if (firstToken !== '{') {
                        throw new Error('Unexpected '+t);
                    }

                    if (stTokens.length > 0) {
                        throw new Error('expected semicolon as last token of block');
                    }

                    return [ statements, index ];

                case ')':
                    if (firstToken !== '(') {
                        throw new Error('Unexpected '+t);
                    }

                    if (stTokens.length) {
                        statements.push(stTokens);
                    }

                    return [ statements, index ];

                case ']':
                    if (firstToken !== '[') {
                        throw new Error('Unexpected '+t);
                    }

                    if (stTokens.length) {
                        statements.push(stTokens);
                    }

                    return [ statements, index ];

                case ',':
                case ';':
                    if (stTokens.length) {
                        statements.push(stTokens); // cutoff seperator
                    }

                    stTokens = [];
                    break;
                default:
                    stTokens.push(t);
            }

            index++;
        }

        return [ statements, index ];
    }

    function parseSimpleType(st) {
        let info = {
            kind: 'type',
            typeModifiers: [],
            name: '',
            ptr: 0
        };

        for (let i=0; i<st.length; i++) {
            if (st[i]._block === '[') {
                info.arr = st[i].length > 0 ? parseInt(st[i][0]) : true;
                continue;
            }

            switch (st[i]) {
                case 'const':
                    info.const = true;
                    break;
                case 'volatile':
                    info.volatile = true;
                    break;
                case '*':
                    info.ptr++;
                    break;
                case 'long':
                case 'short':
                case 'unsigned':
                case 'signed':
                case 'struct':
                default:
                    if (info.name.length > 0) {
                        info.name += ' ';
                    }

                    info.name += st[i];
            }
        }

        return info;
    }

    function parseType(st) {
        const curlyBlockInd = st.findIndex(e=>e._block === '{');
        const roundBlockInd = st.findIndex(e=>e._block === '(');
        const ptr = st.filter(e=>e === '*').length;

        if (st[0] === 'struct' && curlyBlockInd > -1) {
            return {
                kind: 'type',
                typeModifiers: [],
                name: '',
                ptr,
                struct: parseStruct(st)
            };
        } else if (roundBlockInd > -1) {
            return {
                kind: 'type',
                typeModifiers: [],
                name: '',
                ptr,
                func: parseFunctionProto(st)
            };
        } else {
            return parseSimpleType(st);
        }
    }

    function parseVardef(st) {
        let namePos = st.length - 1;
        let arr;

        if (st.slice(-1)[0]._block === '[') {
            const arrBrack = st.slice(-1)[0];

            arr = arrBrack.length === 0 ? true : parseInt(arrBrack[0]);
            namePos--;
        }

        const info = {
            kind: 'vardef',
            type: parseType(st.slice(0, namePos)),
            name: st[namePos],
        };

        if (arr) {
            info.arr = arr;
        }

        return info;
    }

    function parseTypedef(st) {
        if (st.slice(-1)[0]._block === '(') {
            const func = parseFunctionProto(st.slice(1));

            return {
                kind: 'typedef',
                name: func.name,
                child: func
            };
        }

        return {
            kind: 'typedef',
            name: st.slice(-1)[0],
            child: parseType(st.slice(1, -1))
        };
    }

    function parseStruct(st) {
        const info = {
            kind: 'struct',
        };
        const curlyBlockInd = st.findIndex(e=>e._block === '{');

        if (curlyBlockInd >= 2) {
            if (curlyBlockInd > 2) {
                throw new Error('expected { after struct name');
            }

            info.name = st[1];
        }

        info.members = st[curlyBlockInd].map(parseVardef);

        return info;
    }

    function parseFunctionProto(st) {
        let firstBrackInd = st.findIndex(e=>e._block === '(');
        let secondBrackInd = st[firstBrackInd+1]?._block === '(' ? firstBrackInd + 1 : -1;

        const argBlock = secondBrackInd > 0 ? st[secondBrackInd] : st[firstBrackInd];

        const name = secondBrackInd > 0 ? st[firstBrackInd][0].slice(-1)[0] : st[firstBrackInd - 1];
        const ptr = secondBrackInd > 0 ? st[firstBrackInd][0].filter(e=>e === '*').length : 0;
        const retTypeMaxInd = secondBrackInd > 0 ? firstBrackInd - 1 : firstBrackInd - 2;

        const info = {
            kind: 'function',
            name: name,
            args: argBlock.map(parseVardef),
            modifiers: [],
            ptr
        };
        let offs = 0;

        loop: while (offs < retTypeMaxInd) {
            switch (st[offs]) {
                case 'static':
                case 'inline':
                case 'extern':
                    info.modifiers.push(st[offs]);
                    break;
                default:
                    break loop;
            }

            offs++;
        }

        info.return = parseType(st.slice(offs, retTypeMaxInd+1));

        return info;
    }

    function parseStatement(st) {
        switch (st[0]) {
            case 'typedef':
                return parseTypedef(st);
            case 'struct':
                return parseStruct(st);
            default:
                return parseFunctionProto(st);
        }
    }

    const tokens = tokenize(header);

    filterComments(tokens);
    const [ statements ] = sepStatements(tokens);
    const ast = statements.map(parseStatement);

    return ast;
}

// Canonical key for a C type name: word order in a multi-word type is not
// significant in C ('unsigned long int' == 'long unsigned int'), so sort the
// words, keeping the 'struct' tag and any trailing '*' in place.
function formatTypeName(name) {
    if (name.includes(' ')) {
        const mPtr = name.match(/\*+/g);

        name = name.replace(/\*+/g, '');
        let parts = name.split(/\s+/);
        let struct = false;

        if (parts.includes('struct')) {
            parts = parts.filter(e=>e !== 'struct');
            struct = true;
        }

        name = parts.sort().join(' ');

        if (mPtr) {
            name += mPtr[0];
        }

        if (struct) {
            name = 'struct ' + name;
        }
    }

    return name;
}

// The translator needs the type constructors and the built-in type aliases from
// ffi.js; taking them as arguments keeps this module importable from there
// without a cycle.
export default function buildAstToSymbols({ StructType, ArrayType, PointerType, types, typeMap }) {
    // Turn a parsed header into a dlopen() symbol map plus the types the header
    // declared. Nothing here is bound to a library: dlopen() does the binding,
    // so header-declared functions get the same treatment (fast call path
    // included) as hand-written symbol definitions.
    return function astToSymbols(ast) {
        // Every type name resolvable while translating, seeded with the built-in
        // aliases. `declared` is the subset the header itself introduced, which
        // is what the caller gets back.
        const known = new Map();
        const declared = new Map();
        const symbols = {};
        let unnamedCnt = 0;

        for (const [ t, aliases ] of typeMap) {
            for (const alias of aliases) {
                known.set(formatTypeName(alias), t);
            }
        }

        function registerType(name, type) {
            name = formatTypeName(name);
            known.set(name, type);
            declared.set(name, type);
        }

        function getType(name, ptr = 0) {
            let ffiType = known.get(formatTypeName(name+('*').repeat(ptr)));

            if (ffiType) {
                // look for type specific pointer type first, currently used to map char* to string and void* to pointer
                return ffiType;
            }

            ffiType = known.get(formatTypeName(name));

            if (!ffiType) {
                throw new Error(`Unknown type ${name}`);
            }

            if (ptr > 0) {
                const t = new PointerType(ffiType, ptr);

                registerType(name+('*').repeat(ptr), t);

                return t;
            }

            return ffiType;
        }

        function registerStruct(regname, st) {
            const fields = [];

            for (const m of st.members) {
                if (m.type.kind === 'type') {
                    let t;

                    if (m.type.struct) {
                        registerStruct(m.type.struct.name, m.type.struct);
                        t = getType('struct '+m.type.struct.name, m.type.ptr);
                    } else {
                        t = getType(m.type.name, m.type.ptr);
                    }

                    // Array members (e.g. `char name[16]`) must keep their full
                    // width; otherwise the struct size and every following
                    // offset are computed as if the field were a single element.
                    const arr = m.arr ?? m.type.arr;

                    if (arr !== undefined) {
                        if (arr === true) {
                            throw new Error(`unsized array member '${m.name}' is not supported`);
                        }

                        t = new ArrayType(t, arr, `${t.name ?? m.type.name}[${arr}]`);
                    }

                    fields.push([ m.name, t ]);
                } else {
                    throw new Error('unhandled member type: ' + m.type.kind);
                }
            }

            const stt = new StructType(
                fields,
                st.name ? st.name : `__unnamed_struct_${regname}_${unnamedCnt++}`,
                st.align
            );

            registerType(regname, stt);

            return stt;
        }

        for (const e of ast) {
            switch (e.kind) {
                case 'typedef':
                    if (e.child.kind === 'type') {
                        if (e.child.struct) {
                            registerStruct(e.name ?? 'struct '+e.child.struct.name, e.child.struct);
                            registerType(e.name, getType(e.name ?? 'struct '+e.child.struct.name, e.child.ptr));
                        } else {
                            registerType(e.name, getType(e.child.name));
                        }
                    } else if (e.child.kind === 'function') {
                        registerType(e.name || e.child.name, types.jscallback());
                    } else {
                        throw new Error('unsupported typedef: ' + JSON.stringify(e));
                    }

                    break;
                case 'struct':
                    registerStruct('struct '+e.name, e);
                    break;

                case 'function':
                    symbols[e.name] = {
                        returns: getType(e.return.name, e.return.ptr),
                        args: e.args.map(p => getType(p.type.name, p.type.ptr)),
                    };
                    break;
            }
        }

        return { symbols, types: declared };
    };
}

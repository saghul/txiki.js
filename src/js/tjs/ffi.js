/*
MIT License
Copyright (c) 2021 shajunxing
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const core = globalThis.__bootstrap;
const ffi = core.ffi;

const dlCache = {}; // {'filename': {handle: ..., symbols: {'...': ...}}}

function dlOpen(filename) {
    if (dlCache.hasOwnProperty(filename)) {
        return dlCache[filename];
    }
    // console.log(filename);
    let h = ffi.dlopen(filename, ffi.RTLD_NOW);
    if (h === 0) {
        throw new TypeError(ffi.dlerror());
    }
    let file = { handle: h, symbols: {} };
    dlCache[filename] = file;
    return file;
}

function dlSym(filename, symbol) {
    let file = dlOpen(filename);
    if (file.symbols.hasOwnProperty(symbol)) {
        return file.symbols[symbol];
    }
    // console.log(filename, symbol);
    let pointer = ffi.dlsym(file.handle, symbol);
    if (pointer === 0) {
        throw new TypeError(ffi.dlerror());
    }
    file.symbols[symbol] = pointer;
    return pointer;
}

function dlClose(filename) {
    if (dlCache.hasOwnProperty(filename)) {
        ffi.dlclose(dlCache[filename].handle);
        delete dlCache[filename];
    }
}

const dummy = () => { }

const rint = (issigned, bytewidth) =>
    ptr => ffi.memreadint(ptr, bytewidth, 0, issigned, bytewidth, false);
const rbigint = (issigned, bytewidth) =>
    ptr => ffi.memreadint(ptr, bytewidth, 0, issigned, bytewidth, true);

const wint = bytewidth =>
    (ptr, val) => ffi.memwriteint(ptr, bytewidth, 0, bytewidth, val);

const rfloat = isdouble =>
    ptr => ffi.memreadfloat(ptr, isdouble ? 8 : 4, 0, isdouble);

const wfloat = isdouble =>
    (ptr, val) => ffi.memwritefloat(ptr, isdouble ? 8 : 4, 0, isdouble, val);

const primitiveTypes = { // [ffi_type address, byte width, read function, write function]
    void: [ffi.ffi_type_void, 0, dummy, dummy],
    uint8: [ffi.ffi_type_uint8, 1, rint(false, 1), wint(1)],
    sint8: [ffi.ffi_type_sint8, 1, rint(true, 1), wint(1)],
    uint16: [ffi.ffi_type_uint16, 2, rint(false, 2), wint(2)],
    sint16: [ffi.ffi_type_sint16, 2, rint(true, 2), wint(2)],
    uint32: [ffi.ffi_type_uint32, 4, rint(false, 4), wint(4)],
    sint32: [ffi.ffi_type_sint32, 4, rint(true, 4), wint(4)],
    uint64: [ffi.ffi_type_uint64, 8, rbigint(false, 8), wint(8)],
    sint64: [ffi.ffi_type_sint64, 8, rbigint(true, 8), wint(8)],
    float: [ffi.ffi_type_float, 4, rfloat(false), wfloat(false)],
    double: [ffi.ffi_type_double, 8, rfloat(true), wfloat(true)],
    uchar: [ffi.ffi_type_uchar, 1, rint(false, 1), wint(1)],
    schar: [ffi.ffi_type_schar, 1, rint(true, 1), wint(1)],
    ushort: [ffi.ffi_type_ushort, 2, rint(false, 2), wint(2)],
    sshort: [ffi.ffi_type_sshort, 2, rint(true, 2), wint(2)],
    uint: [ffi.ffi_type_uint, ffi.sizeof_int, rint(false, ffi.sizeof_int), wint(ffi.sizeof_int)],
    sint: [ffi.ffi_type_sint, ffi.sizeof_int, rint(true, ffi.sizeof_int), wint(ffi.sizeof_int)],
    ulong: [ffi.ffi_type_ulong, 8, rbigint(false, 8), wint(8)],
    slong: [ffi.ffi_type_slong, 8, rbigint(true, 8), wint(8)],
    longdouble: [ffi.ffi_type_longdouble, 8, rfloat(true), wfloat(true)],
    pointer: [ffi.ffi_type_pointer, ffi.sizeof_uintptr_t, rbigint(false, ffi.sizeof_uintptr_t), wint(ffi.sizeof_uintptr_t)],
    complex_float: [ffi.ffi_type_complex_float, undefined, undefined, undefined],
    complex_double: [ffi.ffi_type_complex_double, undefined, undefined, undefined],
    complex_longdouble: [ffi.ffi_type_complex_longdouble, undefined, undefined, undefined],
};
primitiveTypes.uint8_t = primitiveTypes.uint8;
primitiveTypes.int8_t = primitiveTypes.sint8;
primitiveTypes.uint16_t = primitiveTypes.uint16;
primitiveTypes.int16_t = primitiveTypes.sint16;
primitiveTypes.uint32_t = primitiveTypes.uint32;
primitiveTypes.int32_t = primitiveTypes.sint32;
primitiveTypes.char = primitiveTypes.schar;
primitiveTypes.short = primitiveTypes.sshort;
primitiveTypes.int = primitiveTypes.sint;
primitiveTypes.long = primitiveTypes.slong;
primitiveTypes.string = primitiveTypes.pointer;
primitiveTypes.uintptr_t = [ffi.ffi_type_uintptr_t, ffi.sizeof_uintptr_t, rbigint(false, ffi.sizeof_uintptr_t), wint(ffi.sizeof_uintptr_t)];
primitiveTypes.intptr_t = [ffi.ffi_type_intptr_t, ffi.sizeof_uintptr_t, rbigint(true, ffi.sizeof_uintptr_t), wint(ffi.sizeof_uintptr_t)];
primitiveTypes.size_t = [ffi.ffi_type_size_t, ffi.sizeof_size_t, rbigint(false, ffi.sizeof_size_t), wint(ffi.sizeof_size_t)];

class MemoryAllocator {
    pointers = []
    alloc = size => {
        let ptr = ffi.malloc(size);
        this.pointers.push(ptr);
        return ptr;
    }
    free = () => {
        while (this.pointers.length > 0) {
            ffi.free(this.pointers.pop());
        }
    }
}

function allocUintptrArray(mem, ...vals) {
    let buflen = ffi.sizeof_uintptr_t * vals.length;
    let buf = mem.alloc(buflen);
    for (let i = 0; i < vals.length; i++) {
        ffi.memwriteint(buf, buflen, ffi.sizeof_uintptr_t * i, ffi.sizeof_uintptr_t, vals[i]);
    }
    return buf;
}

export function readUintptrArray(buf, i) {
    return ffi.memreadint(buf + ffi.sizeof_uintptr_t * i, ffi.sizeof_uintptr_t, 0, true, ffi.sizeof_uintptr_t);
}

export function readUintptr(buf) {
    return ffi.memreadint(buf, ffi.sizeof_uintptr_t, 0, true, ffi.sizeof_uintptr_t);
}

function allocStructType(mem, ...elems) {
    let typ = mem.alloc(ffi.sizeof_ffi_type);
    ffi.memset(typ, 0, ffi.sizeof_ffi_type);
    ffi.memwriteint(typ, ffi.sizeof_ffi_type, ffi.offsetof_ffi_type_type, 2, ffi.FFI_TYPE_STRUCT);
    ffi.memwriteint(typ, ffi.sizeof_ffi_type, ffi.offsetof_ffi_type_elements, ffi.sizeof_uintptr_t,
        allocUintptrArray(mem, ...elems, ffi.NULL));
    return typ;
}

function getStructOffsets(struct_typ, elem_count) {
    let ptr = ffi.malloc(ffi.sizeof_size_t * elem_count);
    let status = ffi.ffi_get_struct_offsets(ffi.FFI_DEFAULT_ABI, struct_typ, ptr);
    if (status != ffi.FFI_OK) {
        ffi.free(ptr);
        throw new TypeError('get_struct_offsets failed with return code ' + status);
    }
    let offsets = []
    for (let i = 0; i < elem_count; i++) {
        offsets.push(ffi.memreadint(ptr, ffi.sizeof_size_t * elem_count, ffi.sizeof_size_t * i, false, ffi.sizeof_size_t))
    }
    ffi.free(ptr);
    return offsets;
}

function parseType(mem, repr) {
    let elementsRepresentations = []
    class Node {
        ffiType = null;
        nBytes = null;
        absOffset = 0;
        children = null;
        childrenRelOffsets = null;
    }
    function buildTree(mem, repr) {
        if (typeof repr === 'string') {
            if (!primitiveTypes.hasOwnProperty(repr)) {
                throw new TypeError('primitive type \"' + repr + '\" not supported');
            }
            elementsRepresentations.push(repr);
            let node = new Node();
            node.ffiType = primitiveTypes[repr][0];
            node.nBytes = primitiveTypes[repr][1];
            return node;
        } else if (Array.isArray(repr)) {
            let node = new Node();
            node.children = [];
            for (let pr of repr) {
                node.children.push(buildTree(mem, pr));
            }
            node.ffiType = allocStructType(mem, ...node.children.map(child => child.ffiType));
            node.childrenRelOffsets = getStructOffsets(node.ffiType, node.children.length);
            return node;
        } else {
            throw new TypeError('type representation neither string nor array');
        }
    }
    let root = buildTree(mem, repr);
    let elementsOffsets = [];
    let lastPrimitiveElementOffset = 0;
    let lastPrimitiveElementByteWidth = 0;
    function walkTree(node) {
        if (node.children !== null) {
            for (let i = 0; i < node.children.length; i++) {
                node.children[i].absOffset = node.childrenRelOffsets[i] + node.absOffset;
                walkTree(node.children[i]);
            }
        } else {
            elementsOffsets.push(node.absOffset);
            lastPrimitiveElementOffset = node.absOffset;
            lastPrimitiveElementByteWidth = node.nBytes;
        }
    }
    walkTree(root);
    let ret = {
        typ: root.ffiType,
        nbytes: lastPrimitiveElementOffset + lastPrimitiveElementByteWidth,
        ereprs: elementsRepresentations,
        eoffsets: elementsOffsets,
    };
    return ret;
}

const cifCache = {};

function getCifCacheIndex(nfixedargs, rrepr, ...areprs) {
    return JSON.stringify([nfixedargs, rrepr, [areprs]]);
}

function prepCif(nfixedargs, rrepr, ...areprs) {
    if (typeof nfixedargs === 'number') {
        if (nfixedargs > areprs.length) {
            throw new TypeError('nfixedargs must <= areprs.length');
        } else if (nfixedargs <= 0) {
            throw new TypeError('nfixedargs must > 0');
        }
    } else if (nfixedargs !== null) {
        throw new TypeError('nfixedargs must be null or number');
    }
    let index = getCifCacheIndex(nfixedargs, rrepr, ...areprs);
    if (cifCache.hasOwnProperty(index)) {
        return cifCache[index];
    }
    let mem = new MemoryAllocator();
    let nargs = areprs.length;
    let aparsed = areprs.map(repr => parseType(mem, repr));
    let rparsed = parseType(mem, rrepr);
    let atypes = allocUintptrArray(mem, ...aparsed.map(parsed => parsed.typ));
    let rtype = rparsed.typ;
    let cif = mem.alloc(ffi.sizeof_ffi_cif);
    let status = nfixedargs === null ?
        ffi.ffi_prep_cif(cif, ffi.FFI_DEFAULT_ABI, nargs, rtype, atypes) :
        ffi.ffi_prep_cif_var(cif, ffi.FFI_DEFAULT_ABI, nfixedargs, nargs, rtype, atypes);
    if (status != ffi.FFI_OK) {
        mem.free();
        throw new TypeError('ffi_prep_cif failed with return code ' + status);
    }
    let cache = {
        index: index,
        mem: mem,
        cif: cif,
        rnbytes: rparsed.nbytes,
        anbytes: aparsed.map(p => p.nbytes),
        rereprs: rparsed.ereprs,
        aereprs: aparsed.map(p => p.ereprs),
        reoffsets: rparsed.eoffsets,
        aeoffsets: aparsed.map(p => p.eoffsets),
    };
    cifCache[index] = cache;
    return cache;
}

export function freeCif(index) {
    if (cifCache.hasOwnProperty(index)) {
        cifCache[index].mem.free();
        delete cifCache[index];
    }
}

class CStringAllocator {
    pointers = []
    to = s => {
        let cstr = ffi.tocstring(s);
        this.pointers.push(cstr);
        return cstr;
    }
    free = () => {
        while (this.pointers.length > 0) {
            ffi.freecstring(this.pointers.pop());
        }
    }
}

export class CFunction {
    mem = new MemoryAllocator();
    cstr = new CStringAllocator();
    cif;
    cifcacheindex;
    cfuncptr;
    rvalue;
    avalues;
    avaluesptr;
    rereprs;
    aereprs;
    reoffsets;
    aeoffsets;
    constructor(filename, symbol, ...args) {
        this.cfuncptr = dlSym(filename, symbol);
        let c = prepCif(...args);
        this.cif = c.cif;
        this.cifcacheindex = c.index;
        this.rvalue = this.mem.alloc(c.rnbytes);
        this.avalues = c.anbytes.map(n => this.mem.alloc(n));
        this.avaluesptr = allocUintptrArray(this.mem, ...this.avalues);
        this.rereprs = c.rereprs;
        this.aereprs = c.aereprs;
        this.reoffsets = c.reoffsets;
        this.aeoffsets = c.aeoffsets;
    }
    invoke = (...args) => {
        let writeArg = (a, e, val) => {
            // console.log(a, e, val)
            let repr = this.aereprs[a][e];
            let f = primitiveTypes[repr][3];
            let p = this.avalues[a] + this.aeoffsets[a][e];
            repr == 'string' ? f(p, this.cstr.to(val)) : f(p, val);
        }
        for (let a = 0; a < args.length; a++) {
            let arg = args[a];
            if (Array.isArray(arg)) {
                for (let e = 0; e < arg.length; e++) {
                    writeArg(a, e, arg[e]);
                }
            } else {
                writeArg(a, 0, arg);
            }
        }
        ffi.ffi_call(this.cif, this.cfuncptr, this.rvalue, this.avaluesptr);
        this.cstr.free();
        let readRet = e => {
            let repr = this.rereprs[e];
            let f = primitiveTypes[repr][2];
            let p = this.rvalue + this.reoffsets[e];
            return repr == 'string' ? ffi.newstring(f(p)) : f(p);
        }
        if (this.rereprs.length == 1) {
            return readRet(0);
        } else {
            let ret = [];
            for (let e = 0; e < this.rereprs.length; e++) {
                ret.push(readRet(e));
            }
            return ret;
        }
    }
    free = () => {
        this.mem.free();
        this.cstr.free();
    }
}

export class CCallback {
    mem = new MemoryAllocator();
    cstr = new CStringAllocator();
    cif;
    cifcacheindex;
    cfuncptr;
    rereprs;
    aereprs;
    reoffsets;
    aeoffsets;
    closure;
    jsfunc;
    userdata;
    constructor(jsfunc, ...args) {
        this.jsfunc = jsfunc;
        let pp = this.mem.alloc(ffi.sizeof_uintptr_t);
        this.closure = ffi.ffi_closure_alloc(ffi.sizeof_ffi_closure, pp);
        this.cfuncptr = ffi.memreadint(pp, ffi.sizeof_uintptr_t, 0, true, ffi.sizeof_uintptr_t);
        let c = prepCif(...args);
        this.cif = c.cif;
        this.cifcacheindex = c.index;
        this.rereprs = c.rereprs;
        this.aereprs = c.aereprs;
        this.reoffsets = c.reoffsets;
        this.aeoffsets = c.aeoffsets;
        this.userdata = this.mem.alloc(ffi.sizeof_ffi_closure_js_func_data);
        ffi.fill_ffi_closure_js_func_data(this.userdata, this.adapter);
        let status = ffi.ffi_prep_closure_loc(
            this.closure, this.cif, ffi.ffi_closure_js_func_adapter, this.userdata, this.cfuncptr);
        if (status != ffi.FFI_OK) {
            this.mem.free();
            this.cstr.free();
            throw new TypeError('ffi_prep_closure_loc failed with return code ' + status);
        }
    }
    adapter = (rvalueptr, avaluesptr) => {
        // console.log('adapter');
        // console.log(rvalueptr, avaluesptr);
        let args = [];
        for (let a = 0; a < this.aereprs.length; a++) {
            let ereprs = this.aereprs[a];
            if (ereprs.length > 1) {
                let arg = [];
                for (let e = 0; e < ereprs.length; e++) {
                    let repr = ereprs[e];
                    let f = primitiveTypes[repr][2];
                    let p = readUintptrArray(avaluesptr, a) + this.aeoffsets[a][e];
                    arg[e] = repr == 'string' ? ffi.newstring(f(p)) : f(p);
                }
                args[a] = arg;
            } else {
                let repr = ereprs[0];
                let f = primitiveTypes[repr][2];
                let p = readUintptrArray(avaluesptr, a);
                // console.log(repr, f, p, f(p));
                args[a] = repr == 'string' ? ffi.newstring(f(p)) : f(p);
            }
            // console.log(a, args[a])
        }
        let ret = this.jsfunc(...args);
        // console.log(ret)
        this.cstr.free(); // free previous call
        // console.log(this.rereprs, typeof this.rereprs)
        if (this.rereprs.length > 1) {
            // console.log('if')
            for (let e = 0; e < this.rereprs.length; e++) {
                let repr = this.rereprs[e];
                let f = primitiveTypes[repr][3];
                let p = rvalueptr + this.reoffsets[e];
                // console.log(repr, f, p);
                repr == 'string' ? f(p, this.cstr.to(ret[e])) : f(p, ret[e]);
            }
        } else {
            // console.log('else')
            let repr = this.rereprs[0];
            let f = primitiveTypes[repr][3];
            let p = rvalueptr;
            // console.log(repr, f, p);
            repr == 'string' ? f(p, this.cstr.to(ret)) : f(p, ret);
        }
    }
    free = () => {
        ffi.ffi_closure_free(this.closure);
        this.mem.free();
        this.cstr.free();
    }
}

export const LIBC_NAME = ffi.LIBC_NAME;
export const LIBM_NAME = ffi.LIBC_NAME;

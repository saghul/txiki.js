const core = globalThis.__bootstrap;
const ffiInt = core.ffi;

export class DlSymbol{
	constructor(name, uvlib, dlsym){
		this._name = name;
		this._uvlib = uvlib;
		this._dlsym = dlsym;
	}
	addr(){
		return this._symbol.addr;
	}
}

export class Lib{
	constructor(libname){
		this._libname = libname;
		this._uvlib = new ffiInt.UvLib(libname);
	}
	symbol(name){
		const symbol = this._uvlib.symbol(name);
		return new DlSymbol(name, this._uvlib, symbol)
	}
	static LIBC_NAME = ffiInt.LIBC_NAME;
	static LIBM_NAME = ffiInt.LIBM_NAME;
};

export class AdvancedType{
	constructor(type, toBuffer, fromBuffer, name){
		this._ffi_type = type;
		this._toBuffer = toBuffer;
		this._fromBuffer = fromBuffer;
		this._name = name;
	}
	toBuffer(data){
		if(this._toBuffer)
			return this._toBuffer(data);
		else
			return this._type.toBuffer(data);
	}
	fromBuffer(buf){
		if(this._fromBuffer)
			return this._fromBuffer(buf);
		else
			return this._type.fromBuffer(buf);
	}
	get ffi_type(){
		return this._ffi_type;
	}
	get name(){
		return this._name;
	}
	alloc(n, str){
		const buf = new Uint8Array(n);
		if(str){
			const arr2 = (new TextEncoder()).encode(str);
			buf.set(arr2, 0);
			if(arr2.length > n)
				throw new Error("passed string is longer than buffer size");
		}
		return buf;
	}
	instance(){
		let ctx = {};
		const obj = {
			toBuffer: (data)=>{
				if(this._toBuffer)
					return this._toBuffer(data, ctx);
				else
					return super.toBuffer(data);
			},
			fromBuffer: (buf)=>{
				if(this._fromBuffer)
					return this._fromBuffer(buf, ctx);
				else
					return super.fromBuffer(buf);
			}
		};
		Object.setPrototypeOf(obj, this);
		return obj;
	}
}


export class CFunction{
	constructor(symbol, rtype, argtypes, fixed){
		this._symbol = symbol;
		this._rtype = rtype;
		this._argtypes = argtypes;
		function getFfiType(t){
			if(t.ffi_type){
				return t.ffi_type;
			}
			return t;
		}
		this._cif = new ffiInt.FfiCif(getFfiType(rtype), ...argtypes.map(getFfiType), fixed);
		this._fixed = fixed;
	}
	call(...argsJs){
		const args = [];
		function getInstance(t){
			if(t.instance){
				return t.instance();
			}
			return t;
		}
		const argtypes = this._argtypes.map(getInstance);
		for(const i in argsJs){
			args[i] = argtypes[i].toBuffer(argsJs[i]);
		}
		const ret = this._cif.call(this._symbol._dlsym, ...args);
		const rtype = getInstance(this._rtype);
		return rtype.fromBuffer(ret);
	}
};

export const types = {
	void: ffiInt.type_void,
	uint8: ffiInt.type_uint8,
	sint8: ffiInt.type_sint8,
	uint16: ffiInt.type_uint16,
	sint16: ffiInt.type_sint16,
	uint32: ffiInt.type_uint32,
	sint32: ffiInt.type_sint32,
	uint64: ffiInt.type_uint64,
	sint64: ffiInt.type_sint64,
	float: ffiInt.type_float,
	double: ffiInt.type_double,
	pointer: ffiInt.type_pointer,
	longdouble: ffiInt.type_longdouble, 
	uchar: ffiInt.type_uchar,
	schar: ffiInt.type_schar,
	ushort: ffiInt.type_ushort,
	sshort: ffiInt.type_sshort,
	uint: ffiInt.type_uint,
	sint: ffiInt.type_sint,
	ulong: ffiInt.type_ulong,
	slong: ffiInt.type_slong,

	string: new AdvancedType(ffiInt.type_pointer, (str, ctx)=>{
		ctx.buf = (new TextEncoder()).encode(str+'\0');
		// cstrings are pointers (char*), the pointer itself is the argument, and since ffi expects pointers to the argument data, 
		// so we effectively need a (char**). 
		// If we return the ptr to the buffer (bigint), the C code will handle the allocation for us.
		return ffiInt.getArrayBufPtr(ctx.buf);
	}, (buf)=>{
		const ptr2 = ffiInt.bufToPtr(buf); // char**
		const ptr1 = ffiInt.derefPtr(ptr2); // char*
		const str = ffiInt.getCString(ptr1); // string
		return str;
	}, "string"),

	buffer: new AdvancedType(ffiInt.type_pointer, (buf, ctx)=>{
		return ffiInt.getArrayBufPtr(buf);
	}, (buf)=>{
		throw new Error('type buffer cannot be used as a return type, since the size is not known!');
	}, "string"),
}

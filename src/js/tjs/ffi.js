const core = globalThis.__bootstrap;
export const ffiInt = core.ffi;

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
	constructor(type, conf){
		this._ffiType = type;
		this._conf = conf;
	}
	toBuffer(data, ctx){
		if(this._conf.toBuffer)
			return this._conf.toBuffer(data, ctx);
		else
			return this._type.toBuffer(data, ctx);
	}
	fromBuffer(buf, ctx){
		if(this._conf.fromBuffer)
			return this._conf.fromBuffer(buf, ctx);
		else
			return this._type.fromBuffer(buf, ctx);
	}
	get ffiType(){
		return this._ffiType;
	}
	get ffiTypeStruct(){
		return this._conf.getFfiTypeStruct ? this._conf.getFfiTypeStruct() : this._ffiType;
	}
	get name(){
		return this._conf.name;
	}
	get size(){
		return this._ffiType.size;
	}
}

export class CFunction{
	constructor(symbol, rtype, argtypes, fixed){
		this._symbol = symbol;
		this._rtype = rtype;
		this._argtypes = argtypes;
		function getFfiType(t){
			if(t.ffiType){
				return t.ffiType;
			}
			return t;
		}
		this._cif = new ffiInt.FfiCif(getFfiType(rtype), ...argtypes.map(getFfiType), fixed);
		this._fixed = fixed;
	}
	call(...argsJs){
		const ctx = {};
		const args = [];
		for(const i in argsJs){
			ctx[i] = {};
			args[i] = this._argtypes[i].toBuffer(argsJs[i], ctx[i]);
		}
		const ret = this._cif.call(this._symbol._dlsym, ...args);
		ctx['ret'] = {};
		return this._rtype.fromBuffer(ret, ctx['ret']);
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

	size: ffiInt.type_size,
	ssize: ffiInt.type_ssize,

	string: new AdvancedType(ffiInt.type_pointer, {
		toBuffer: (str, ctx)=>{
			ctx.buf = (new TextEncoder()).encode(str+'\0');
			// cstrings are pointers char*, the pointer itself is the argument, and since ffi expects pointers to the argument data, 
			// so we effectively need a char**. 
			// If we return the ptr to the buffer, the C code will handle the allocation for us.
			return ffiInt.getArrayBufPtr(ctx.buf);
		}, 
		fromBuffer: (buf)=>{
			const ptr = ffiInt.type_pointer.fromBuffer(buf); // char*
			const str = ffiInt.getCString(ptr); // string
			return str;
		}, 
		name: "string"
	}),

	buffer: new AdvancedType(ffiInt.type_pointer, {
		toBuffer: (buf, ctx)=>{
			return ffiInt.getArrayBufPtr(buf);
		},
		fromBuffer: (buf)=>{
			throw new Error('type buffer cannot be used as a return type, since the size is not known!');
		},
		name: "string"
	}),
}

export function bufferToString(buf){
	return ffiInt.getCString(ffiInt.getArrayBufPtr(buf), buf.length)
}

export class Pointer{
	constructor(addr, level, type){
		this._type = type;
		this._level = level;
		this._addr = addr;
	}
	get addr(){
		return this._addr;
	}
	get level(){
		return this._level;
	}
	get type(){
		return this._type;
	}
	get isNull(){
		return this._addr == 0n;
	}
	deref(){
		if(this.level == 1){
			const addr = this._addr;
			const buf = ffiInt.ptrToBuffer(addr, this._type.size);
			return this._type.fromBuffer(buf, {});
		}else{
			return new Pointer(this._addr, this._level - 1, this._ffiType);
		}
	}
	derefAll(){
		const addr = ffiInt.derefPtr(this._addr, this._level-1);
		const buf = ffiInt.ptrToBuffer(addr, this._type.size);
		return this._type.fromBuffer(buf, {});
	}
	static createRef(type, data){
		const buf = type.toBuffer(data, {});
		return Pointer.createRefFromBuf(type, buf);
	}
	static createRefFromBuf(type, buf){
		const addr = ffiInt.getArrayBufPtr(buf);
		const ptr = new Pointer(addr, 1, type);
		ptr._data = buf; // attach to keep buf from being GCed
		return ptr;
	}
}

export class PointerType extends AdvancedType{
	constructor(type, level = 1){
		super(types.pointer || type, {
			name: (type.name || 'void') + ('*').repeat(level),
		});
		this._level = level;
		this._type = type;
	}
	toBuffer(data, ctx){
		if(data instanceof Pointer){
			return types.pointer.toBuffer(data.addr, ctx);
		}else{
			return types.pointer.toBuffer(data, ctx);
		}
	}
	fromBuffer(buf, ctx){
		return new Pointer(types.pointer.fromBuffer(buf), this._level, this._type);
	}
	get type(){
		return this._type;
	}
	get level(){
		return this._level;
	}
}

export class StructType extends AdvancedType{
	constructor(fields, name){
		const ffitype = new ffiInt.FfiType(...fields.map(([f, t])=>t.ffiTypeStruct || t.ffiType || t));
		super(ffitype, {
			toBuffer: (obj, ctx)=>{
				const buf = new Uint8Array(this._ffiType.size);
				for(let i=0; i<offsets.length; i++){
					const [field, type] = this._fields[i];
					let sbuf = type.fromBuffer(obj[field], ctx);
					buf.set(sbuf, offsets[i]);
				}
				return buf;
			}, 
			fromBuffer: (buf, ctx)=>{
				let obj = {};
				const offsets = this._ffiType.offsets;
				for(let i=0; i<offsets.length; i++){
					const [field, type] = this._fields[i];
					const fbuf = buf.slice(offsets[i], offsets[i] + type.size);
					obj[field] = type.fromBuffer(fbuf, ctx);
				}
				return obj;
			}, 
			name
		});
		this._fields = fields;
	}
	get fields(){
		return this._fields;
	}
}

export class ArrayType extends AdvancedType{
	constructor(type, length, name){
		const ffitype = type.ffiType ? type.ffiType : type;
		const ffisz = ffitype.size;
		super(ffitype, {
			toBuffer: (arr, ctx)=>{
				if(arr.length > this._length)
					throw new RangeError('Array length exceeds type length');
				const buf = new Uint8Array(ffisz*length);
				for(let i=0; i<arr.length; i++){
					let sbuf = type.fromBuffer(arr[i], ctx);
					buf.set(sbuf, i*ffisz);
				}
				return buf;
			}, 
			fromBuffer: (buf, ctx)=>{
				let arr = [];
				for(let i=0; i<this._length; i++){
					arr[i] = type.fromBuffer(buf.slice(i*ffisz, (i+1)*ffisz), ctx);
				}
				return arr;
			}, 
			name,
		});
		this._type = type;
		this._length = length;
	}
	get ffiTypeStruct(){
		if(!this._ffiStruct)
			this._ffiStruct = new ffiInt.FfiType(this._length, this._ffiType);
		return this._ffiStruct;
	}
	get length(){
		return this._length;
	}
	get size(){
		return this._ffiType.size * this._length;
	}
}

export class StaticStringType extends ArrayType{
	constructor(length, name){
		super(types.sint8, length, name);
	}
	toBuffer(str, ctx){
		const txtBuf = (new TextEncoder()).encode(str);
		return super.toBuffer(txtBuf, ctx);
	}
	fromBuffer(buf, ctx){
		return ffiInt.getCString(ffiInt.getArrayBufPtr(buf), buf.length);
	}
}

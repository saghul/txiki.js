declare namespace FFI{
	interface typemap{
		void: void,
		uint8: number,
		sint8: number,
		uint16: number,
		sint16: number,
		uint32: number,
		sint32: number,
		uint64: number,
		sint64: number,
		float: number,
		double: number,
		uchar: string,
		schar: string,
		ushort: number,
		sshort: number,
		uint: number,
		sint: number,
		ulong: number,
		slong: number,
		longdouble: number,
		pointer: number,
		//TODO: add complex types,
	
		uint8_t: number,
		int8_t: number,
		uint16_t: number,
		int16_t: number,
		uint32_t: number,
		int32_t: number,
		char: string,
		short: number,
		int: number,
		long: number,
		string: string,
		uintptr_t: number,
		intptr_t: number,
		size_t: number,
	}
	
	type ffiType = keyof typemap;

	export function readUintptrArray(buf: number, i: number): number;
	export function readUintptr(buf: number): number;
	export function freeCif(index: string): void;

	export class AllocBase{
		readonly cifcacheindex: string;
		/*
		readonly mem: MemoryAllocator;
		readonly cstr: CStringAllocator;
		cif;
		cfuncptr;
		rereprs;
		aereprs;
		reoffsets;
		aeoffsets;
		*/
		free(): void;
	}

	export class CFunction<RT extends ffiType, FFIARGT extends Array<ffiType> = ffiType[]> extends AllocBase{
		/*
		rvalue;
		avalues;
		avaluesptr;
		*/
		constructor(filename: string, symbol: string, argc: number|null, rettype: RT, ...args: [...FFIARGT]);
		invoke(...args: any[]): typemap[RT];
	}

	export class CCallback<RT extends ffiType, FFIARGT extends Array<ffiType> = ffiType[]> extends AllocBase{
		/*
		closure;
		jsfunc;
		userdata;
		*/
		constructor(jsfunc: (...args: any[]) => typemap[RT], argc: number|null, rettype: RT, ...args: [...FFIARGT]);
		//private adapter(rvalueptr: any, avaluesptr: any[][]);
	}

	export const LIBC_SO: string;
	export const LIBM_SO: string;
}

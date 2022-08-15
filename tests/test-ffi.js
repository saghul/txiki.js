import assert from './assert.js';
import initCParser from '../src/js/tjs/ffiutils.js';
const FFI = tjs.ffi;

(function(){
	const libm = new FFI.Lib(FFI.Lib.LIBM_NAME);
	const libc = new FFI.Lib(FFI.Lib.LIBC_NAME);
	
	function testSimpleCalls(){
		
		const absF = new FFI.CFunction(libm.symbol('abs'), FFI.types.sint, [FFI.types.sint]);
		assert.eq(absF.call(-9), 9);

		if(tjs.platform !== 'windows'){ // for some reason, windows (mingw) does not find this function
			const fabsfF = new FFI.CFunction(libm.symbol('fabsf'), FFI.types.float, [FFI.types.float]);
			assert.ok(Math.abs(fabsfF.call(-3.45) - 3.45) < 0.00001);
			assert.eq(fabsfF.call(-4), 4);
		}

		const atoiF = new FFI.CFunction(libc.symbol('atoi'), FFI.types.sint, [FFI.types.string]);
		assert.eq(atoiF.call("1234"), 1234);

		const strerrorF = new FFI.CFunction(libc.symbol('strerror'), FFI.types.string, [FFI.types.sint]);
		assert.eq(strerrorF.call(1 /* EPERM */), "Operation not permitted");

		
		const sprintfF3 = new FFI.CFunction(libc.symbol('sprintf'), FFI.types.sint, [FFI.types.buffer, FFI.types.string, FFI.types.sint], 1);
		const strbuf = new Uint8Array(14);
		assert.eq(sprintfF3.call(strbuf, 'printf test %d\n', 5), 14);
		assert.eq(FFI.bufferToString(strbuf), 'printf test 5\n');

		const strcatF = new FFI.CFunction(libc.symbol('strcat'), FFI.types.string, [FFI.types.buffer, FFI.types.string]);
		const strbuf2 = new Uint8Array(12);
		strbuf2.set((new TextEncoder()).encode('part1:'));
		assert.eq(strcatF.call(strbuf2, "part2"), "part1:part2");
		assert.eq(FFI.bufferToString(strbuf2), "part1:part2");
	}
	
	function testStructs(){
		const divT = new FFI.StructType([['quot', FFI.types.sint], ['rem', FFI.types.sint]], 'div_t');
		const divF = new FFI.CFunction(libc.symbol('div'), divT, [FFI.types.sint, FFI.types.sint]);
		assert.equal(divF.call(10, 3), {quot:3, rem:1});
	}
	
	function testPointersAndStructsOpendir(){
		if(tjs.platform === 'windows'){ // for some reason, windows (mingw) does not find this function
			return;
		}
		const opendirF = new FFI.CFunction(libc.symbol('opendir'), FFI.types.pointer, [FFI.types.string]);
		let direntSt;
		if(tjs.platform == 'darwin'){ // macos has another dirent definition
			direntSt = new FFI.StructType([
				['fileno', FFI.types.uint32],
				['reclen', FFI.types.uint16],
				['type', FFI.types.uint8],
				['namelen', FFI.types.uint8],
				['name', new FFI.StaticStringType(255, 'char255') ],
			], 'dirent');
		}else{
			direntSt = new FFI.StructType([
				['ino', FFI.types.size],
				['type', FFI.types.size],
				['reclen', FFI.types.uint16],
				['type', FFI.types.uint8],
				['name', new FFI.StaticStringType(255, 'char255') ],
			], 'dirent');
		}
		const direntPtrT = new FFI.PointerType(direntSt, 1);
		const readdirF = new FFI.CFunction(libc.symbol('readdir'), direntPtrT, [FFI.types.pointer]);
		const closedirF = new FFI.CFunction(libc.symbol('closedir'), FFI.types.sint, [FFI.types.pointer]);

		const dirH = opendirF.call(import.meta.dirname);
		assert.ok(dirH !== null);
		const fileList = [];
		let direntPtr;
		do{
			direntPtr = readdirF.call(dirH);
			if(!direntPtr.isNull){
				const obj = direntPtr.deref();
				assert.eq(typeof obj, 'object');
				fileList.push(obj);
			}else{
				assert.eq(direntPtr.addr, 0n);
			}
		}while(!direntPtr.isNull);
		assert.ok(fileList.some(e=>e.name == 'test-ffi.js'));
		assert.eq(closedirF.call(dirH), 0);
	}

	function testPointersAndStructsTime(){
		const tmT = new FFI.StructType([
			['sec', FFI.types.sint],
			['min', FFI.types.sint],
			['hour', FFI.types.sint],
			['mday', FFI.types.sint],
			['mon', FFI.types.sint],
			['year', FFI.types.sint],
			['wday', FFI.types.sint],
			['yday', FFI.types.sint],
			['isdst', FFI.types.sint],
		], 'tm');
		const timeF = new FFI.CFunction(libc.symbol('time'), FFI.types.sint64, [FFI.types.pointer]);
		const timestamp = timeF.call(BigInt('0'));
		assert.ok(Date.now()/1000 - timestamp < 2);
		
		const testTimestamp = 1658319387; // test with 2022-07-20T14:16:27+02:00
		const localtimeF = new FFI.CFunction(libc.symbol('localtime'), new FFI.PointerType(tmT, 1), [new FFI.PointerType(FFI.types.sint64, 1)]);
		const tmPtr = localtimeF.call(FFI.Pointer.createRef(FFI.types.sint64, testTimestamp)); // test with 2022-07-20T14:16:27+02:00
		const tm = tmPtr.deref();
		assert.eq(tm.year, 122); // years since 1900
		assert.eq(tm.mon, 6); // month since January, 0-11
		const cmpDate = new Date(testTimestamp*1000);
		assert.eq(tm.mday, cmpDate.getDate()); // day of the month, 1-31
		assert.eq(tm.hour, cmpDate.getHours()); // hours since midnight, 0-23
		assert.eq(tm.min, cmpDate.getMinutes()); // minutes after the hour, 0-59
		assert.eq(tm.sec, cmpDate.getSeconds()); // seconds after the minute, 0-59
		assert.eq(tm.wday, cmpDate.getDay()); // day of the week, Sunday is 0, 0-6
		const startOf2022 = new Date(2022, 0, 1, 0, 0, 0, 0);
		assert.eq(tm.yday, Math.floor((cmpDate-startOf2022)/86e6)-1); // day of the year, 0-365
		assert.eq(tm.isdst, cmpDate.getTimezoneOffset() != (new Date(2022,1,1,1,1,1)).getTimezoneOffset() ? 1 : 0); // daylight saving time, 0 or 1
	}

	function testJsCallback(){
		let sopath = './build/libffi-test.so';
		switch(tjs.platform){
			case 'linux':
				sopath = './build/libffi-test.so';
				break;
			case 'darwin':
				sopath = './build/libffi-test.dylib';
				break;
			case 'windows':
				sopath = './build/libffi-test.dll';
			break;
		}
		const testlib = new FFI.Lib(sopath);
		const callCallbackF = new FFI.CFunction(testlib.symbol('call_callback'), FFI.types.sint, [FFI.types.jscallback, FFI.types.sint]);
		let recv = null;
		const callback = new FFI.JSCallback(FFI.types.sint, [FFI.types.sint], (a)=>{
			recv = a;
			return 2;
		});
		const ret = callCallbackF.call(callback, 4);
		assert.eq(ret, 2);
		assert.eq(recv, 4);
	}

	function testCProtoParser(){
		const {parseCProto} = initCParser(FFI);
		const ast1 = parseCProto(`
			static inline JSValue JS_DupValue(JSContext *ctx, JSValueConst v);
			static unsigned long long int* bla(JSContext *ctx, const int32_t **pres, JSValueConst val);
			struct JSCFunctionListEntry {
				const char *name;
				uint8_t prop_flags;
				uint8_t def_type;
				int16_t magic;
				char bla[23];
				char abc[];
			};
			typedef int JSModuleInitFunc(JSContext *ctx, JSModuleDef *m);
			typedef struct JSRuntime JSRuntime;
			typedef int my_int;
			typedef unsigned long long int my_int2;
			struct struct_in_struct{
				int a;
				struct asd{
					int asd_b;
				} b;
			};
			typedef void * (*myfunc)(int* asd);
		`);
		const expected = [
			{
				"kind": "function",
				"name": "JS_DupValue",
				"args": [
					{
						"kind": "vardef",
						"type": {
							"kind": "type",
							"typeModifiers": [],
							"name": "JSContext",
							"ptr": 1
						},
						"name": "ctx"
					},
					{
						"kind": "vardef",
						"type": {
							"kind": "type",
							"typeModifiers": [],
							"name": "JSValueConst",
							"ptr": 0
						},
						"name": "v"
					}
				],
				"modifiers": [
					"static",
					"inline"
				],
				"ptr": 0,
				"return": {
					"kind": "type",
					"typeModifiers": [],
					"name": "JSValue",
					"ptr": 0
				}
			},
			{
				"kind": "function",
				"name": "bla",
				"args": [
					{
						"kind": "vardef",
						"type": {
							"kind": "type",
							"typeModifiers": [],
							"name": "JSContext",
							"ptr": 1
						},
						"name": "ctx"
					},
					{
						"kind": "vardef",
						"type": {
							"kind": "type",
							"typeModifiers": [],
							"name": "int32_t",
							"ptr": 2,
							"const": true
						},
						"name": "pres"
					},
					{
						"kind": "vardef",
						"type": {
							"kind": "type",
							"typeModifiers": [],
							"name": "JSValueConst",
							"ptr": 0
						},
						"name": "val"
					}
				],
				"modifiers": [
					"static"
				],
				"ptr": 0,
				"return": {
					"kind": "type",
					"typeModifiers": [],
					"name": "unsigned long long int",
					"ptr": 1
				}
			},
			{
				"kind": "struct",
				"name": "JSCFunctionListEntry",
				"members": [
					{
						"kind": "vardef",
						"type": {
							"kind": "type",
							"typeModifiers": [],
							"name": "char",
							"ptr": 1,
							"const": true
						},
						"name": "name"
					},
					{
						"kind": "vardef",
						"type": {
							"kind": "type",
							"typeModifiers": [],
							"name": "uint8_t",
							"ptr": 0
						},
						"name": "prop_flags"
					},
					{
						"kind": "vardef",
						"type": {
							"kind": "type",
							"typeModifiers": [],
							"name": "uint8_t",
							"ptr": 0
						},
						"name": "def_type"
					},
					{
						"kind": "vardef",
						"type": {
							"kind": "type",
							"typeModifiers": [],
							"name": "int16_t",
							"ptr": 0
						},
						"name": "magic"
					},
					{
						"kind": "vardef",
						"type": {
							"kind": "type",
							"typeModifiers": [],
							"name": "char",
							"ptr": 0
						},
						"name": "bla",
						"arr": 23
					},
					{
						"kind": "vardef",
						"type": {
							"kind": "type",
							"typeModifiers": [],
							"name": "char",
							"ptr": 0
						},
						"name": "abc",
						"arr": true
					}
				]
			},
			{
				"kind": "typedef",
				"name": "JSModuleInitFunc",
				"child": {
					"kind": "function",
					"name": "JSModuleInitFunc",
					"args": [
						{
							"kind": "vardef",
							"type": {
								"kind": "type",
								"typeModifiers": [],
								"name": "JSContext",
								"ptr": 1
							},
							"name": "ctx"
						},
						{
							"kind": "vardef",
							"type": {
								"kind": "type",
								"typeModifiers": [],
								"name": "JSModuleDef",
								"ptr": 1
							},
							"name": "m"
						}
					],
					"modifiers": [],
					"ptr": 0,
					"return": {
						"kind": "type",
						"typeModifiers": [],
						"name": "int",
						"ptr": 0
					}
				}
			},
			{
				"kind": "typedef",
				"name": "JSRuntime",
				"child": {
					"kind": "type",
					"typeModifiers": [],
					"name": "struct JSRuntime",
					"ptr": 0
				}
			},
			{
				"kind": "typedef",
				"name": "my_int",
				"child": {
					"kind": "type",
					"typeModifiers": [],
					"name": "int",
					"ptr": 0
				}
			},
			{
				"kind": "typedef",
				"name": "my_int2",
				"child": {
					"kind": "type",
					"typeModifiers": [],
					"name": "unsigned long long int",
					"ptr": 0
				}
			},
			{
				"kind": "struct",
				"name": "struct_in_struct",
				"members": [
					{
						"kind": "vardef",
						"type": {
							"kind": "type",
							"typeModifiers": [],
							"name": "int",
							"ptr": 0
						},
						"name": "a"
					},
					{
						"kind": "vardef",
						"type": {
							"kind": "type",
							"typeModifiers": [],
							"name": "",
							"ptr": 0,
							"struct": {
								"kind": "struct",
								"name": "asd",
								"members": [
									{
										"kind": "vardef",
										"type": {
											"kind": "type",
											"typeModifiers": [],
											"name": "int",
											"ptr": 0
										},
										"name": "asd_b"
									}
								]
							}
						},
						"name": "b"
					}
				]
			},
			{
				"kind": "typedef",
				"name": "myfunc",
				"child": {
					"kind": "function",
					"name": "myfunc",
					"args": [
						{
							"kind": "vardef",
							"type": {
								"kind": "type",
								"typeModifiers": [],
								"name": "int",
								"ptr": 1
							},
							"name": "asd"
						}
					],
					"modifiers": [],
					"ptr": 1,
					"return": {
						"kind": "type",
						"typeModifiers": [],
						"name": "void",
						"ptr": 1
					}
				}
			}
		];
		
		assert.eq(ast1, expected)

		const ast2 = parseCProto(`
			typedef struct bla{
				int a;
			} bla_t;
			typedef struct{
				int a;
			}* bla2_t;
			typedef int[32] asd_t;
			typedef int[] abc_t;
			typedef struct{
				int asd[32];
				int abc[];
			} bla2_t;
		`);

		assert.eq(ast2, [
			{
			  "kind": "typedef",
			  "name": "bla_t",
			  "child": {
				"kind": "type",
				"typeModifiers": [],
				"name": "",
				"ptr": 0,
				"struct": {
				  "kind": "struct",
				  "name": "bla",
				  "members": [
					{
					  "kind": "vardef",
					  "type": {
						"kind": "type",
						"typeModifiers": [],
						"name": "int",
						"ptr": 0
					  },
					  "name": "a"
					}
				  ]
				}
			  }
			},
			{
			  "kind": "typedef",
			  "name": "bla2_t",
			  "child": {
				"kind": "type",
				"typeModifiers": [],
				"name": "",
				"ptr": 1,
				"struct": {
				  "kind": "struct",
				  "members": [
					{
					  "kind": "vardef",
					  "type": {
						"kind": "type",
						"typeModifiers": [],
						"name": "int",
						"ptr": 0
					  },
					  "name": "a"
					}
				  ]
				}
			  }
			},
			{
			  "kind": "typedef",
			  "name": "asd_t",
			  "child": {
				"kind": "type",
				"typeModifiers": [],
				"name": "int",
				"ptr": 0,
				"arr": 32
			  }
			},
			{
			  "kind": "typedef",
			  "name": "abc_t",
			  "child": {
				"kind": "type",
				"typeModifiers": [],
				"name": "int",
				"ptr": 0,
				"arr": true
			  }
			},
			{
			  "kind": "typedef",
			  "name": "bla2_t",
			  "child": {
				"kind": "type",
				"typeModifiers": [],
				"name": "",
				"ptr": 0,
				"struct": {
				  "kind": "struct",
				  "members": [
					{
					  "kind": "vardef",
					  "type": {
						"kind": "type",
						"typeModifiers": [],
						"name": "int",
						"ptr": 0
					  },
					  "name": "asd",
					  "arr": 32
					},
					{
					  "kind": "vardef",
					  "type": {
						"kind": "type",
						"typeModifiers": [],
						"name": "int",
						"ptr": 0
					  },
					  "name": "abc",
					  "arr": true
					}
				  ]
				}
			  }
			}
		]);
	}

	function testLibFromCProto() {
		const libc = new FFI.Lib(FFI.Lib.LIBC_NAME);
		libc.parseCProto(`
			typedef long int time_t;
			typedef long clock_t;
			
			struct tm
			{
			int sec;
			int min;
			int hour;
			int mday;
			int mon;
			int year;
			int wday;
			int yday;
			int isdst;
			long int gmtoff;
			const char *tm_zone;
			};
			
			clock_t clock();
			time_t time (time_t *__timer);
			double difftime (time_t __time1, time_t __time0);
			char* asctime (struct tm *__tp);
		`);

		const clockVal = libc.call('clock');
		assert.ok(typeof clockVal == 'number' && clockVal > 0);
		assert.ok(libc.call('time', [null]) - Date.now()/1000 + 1 < 2 );
		assert.eq(libc.call('difftime', 100, 50), 50);
		const structTmT = libc.getType('struct tm');
		const tmData = {
			sec: 0, min: 0, hour: 0,
			year: 122, mon: 6, mday: 1,
			isdst: 0, gmtoff: 0, tm_zone: 'UTC'
		};
		const tmBuf = structTmT.toBuffer(tmData);
		const regex = /^Sun Jul [0 ]1 00:00:00 2022\n$/;
		assert.truthy(libc.call('asctime', FFI.Pointer.createRefFromBuf(structTmT, tmBuf)).match(regex));
		assert.truthy(libc.call('asctime', FFI.Pointer.createRef(structTmT, tmData)).match(regex));
	}

	function testCProtoPtrInStruct(){
		const libc = new FFI.Lib(FFI.Lib.LIBC_NAME);
		libc.parseCProto(`
		struct a{
			int a;
			int b;
		};
		typedef struct {
			struct a* filter;
			struct a* filter2;
		} asdasd;
		typedef struct {
			int c;
			int d;
			int e;
			int f;
		}* asdasd2;
		`);
		assert.eq(libc.getType('asdasd').size, 2*FFI.types.pointer.size);
		assert.eq(libc.getType('asdasd2').size, FFI.types.pointer.size);
	}

	testSimpleCalls();
	testStructs();
	testPointersAndStructsOpendir();
	testPointersAndStructsTime();
	testJsCallback();
	testCProtoParser();
	testLibFromCProto();
	testCProtoPtrInStruct();

})();

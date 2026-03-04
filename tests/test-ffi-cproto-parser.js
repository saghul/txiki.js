import assert from 'tjs:assert';
import FFI from 'tjs:ffi';
import initCParser from '../src/js/stdlib/ffi/ffiutils.js';

const {parseCProto} = initCParser(FFI);
const ast1 = parseCProto(`
	static inline JSValue JS_DupValue(JSContext *ctx, JSValue v);
	static unsigned long long int* bla(JSContext *ctx, const int32_t **pres, JSValue val);
	struct JSCFunctionListEntry {
		const char *name;
		uint8_t prop_flags;
		uint8_t def_type;
		int16_t magic; // line comment
		char bla[23];
		char abc[];
	};
	#preprocessor directive
	typedef int JSModuleInitFunc(JSContext *ctx, JSModuleDef *m);
	/* block comment */
	typedef struct JSRuntime JSRuntime;
	typedef int my_int;
	/* multiline block comment
		another line
	*/
	typedef unsigned long long int my_int2;
	// multiline line comment \
	another line \
	and another line
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
					"name": "JSValue",
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
					"name": "JSValue",
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

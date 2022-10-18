var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// node_modules/queue-microtask/index.js
var require_queue_microtask = __commonJS({
  "node_modules/queue-microtask/index.js"(exports, module) {
    var promise;
    module.exports = typeof queueMicrotask === "function" ? queueMicrotask.bind(typeof window !== "undefined" ? window : global) : (cb) => (promise || (promise = Promise.resolve())).then(cb).catch((err) => setTimeout(() => {
      throw err;
    }, 0));
  }
});

// node_modules/core-js/internals/fails.js
var require_fails = __commonJS({
  "node_modules/core-js/internals/fails.js"(exports, module) {
    module.exports = function(exec) {
      try {
        return !!exec();
      } catch (error) {
        return true;
      }
    };
  }
});

// node_modules/core-js/internals/function-bind-native.js
var require_function_bind_native = __commonJS({
  "node_modules/core-js/internals/function-bind-native.js"(exports, module) {
    var fails = require_fails();
    module.exports = !fails(function() {
      var test = function() {
      }.bind();
      return typeof test != "function" || test.hasOwnProperty("prototype");
    });
  }
});

// node_modules/core-js/internals/function-uncurry-this-raw.js
var require_function_uncurry_this_raw = __commonJS({
  "node_modules/core-js/internals/function-uncurry-this-raw.js"(exports, module) {
    var NATIVE_BIND = require_function_bind_native();
    var FunctionPrototype = Function.prototype;
    var call = FunctionPrototype.call;
    var uncurryThisWithBind = NATIVE_BIND && FunctionPrototype.bind.bind(call, call);
    module.exports = function(fn) {
      return NATIVE_BIND ? uncurryThisWithBind(fn) : function() {
        return call.apply(fn, arguments);
      };
    };
  }
});

// node_modules/core-js/internals/classof-raw.js
var require_classof_raw = __commonJS({
  "node_modules/core-js/internals/classof-raw.js"(exports, module) {
    var uncurryThisRaw = require_function_uncurry_this_raw();
    var toString = uncurryThisRaw({}.toString);
    var stringSlice = uncurryThisRaw("".slice);
    module.exports = function(it) {
      return stringSlice(toString(it), 8, -1);
    };
  }
});

// node_modules/core-js/internals/function-uncurry-this.js
var require_function_uncurry_this = __commonJS({
  "node_modules/core-js/internals/function-uncurry-this.js"(exports, module) {
    var classofRaw = require_classof_raw();
    var uncurryThisRaw = require_function_uncurry_this_raw();
    module.exports = function(fn) {
      if (classofRaw(fn) === "Function")
        return uncurryThisRaw(fn);
    };
  }
});

// node_modules/core-js/internals/math-trunc.js
var require_math_trunc = __commonJS({
  "node_modules/core-js/internals/math-trunc.js"(exports, module) {
    var ceil = Math.ceil;
    var floor = Math.floor;
    module.exports = Math.trunc || function trunc(x) {
      var n = +x;
      return (n > 0 ? floor : ceil)(n);
    };
  }
});

// node_modules/core-js/internals/to-integer-or-infinity.js
var require_to_integer_or_infinity = __commonJS({
  "node_modules/core-js/internals/to-integer-or-infinity.js"(exports, module) {
    var trunc = require_math_trunc();
    module.exports = function(argument) {
      var number = +argument;
      return number !== number || number === 0 ? 0 : trunc(number);
    };
  }
});

// node_modules/core-js/internals/global.js
var require_global = __commonJS({
  "node_modules/core-js/internals/global.js"(exports, module) {
    var check = function(it) {
      return it && it.Math == Math && it;
    };
    module.exports = check(typeof globalThis == "object" && globalThis) || check(typeof window == "object" && window) || check(typeof self == "object" && self) || check(typeof global == "object" && global) || function() {
      return this;
    }() || Function("return this")();
  }
});

// node_modules/core-js/internals/is-pure.js
var require_is_pure = __commonJS({
  "node_modules/core-js/internals/is-pure.js"(exports, module) {
    module.exports = false;
  }
});

// node_modules/core-js/internals/define-global-property.js
var require_define_global_property = __commonJS({
  "node_modules/core-js/internals/define-global-property.js"(exports, module) {
    var global2 = require_global();
    var defineProperty = Object.defineProperty;
    module.exports = function(key, value) {
      try {
        defineProperty(global2, key, { value, configurable: true, writable: true });
      } catch (error) {
        global2[key] = value;
      }
      return value;
    };
  }
});

// node_modules/core-js/internals/shared-store.js
var require_shared_store = __commonJS({
  "node_modules/core-js/internals/shared-store.js"(exports, module) {
    var global2 = require_global();
    var defineGlobalProperty = require_define_global_property();
    var SHARED = "__core-js_shared__";
    var store = global2[SHARED] || defineGlobalProperty(SHARED, {});
    module.exports = store;
  }
});

// node_modules/core-js/internals/shared.js
var require_shared = __commonJS({
  "node_modules/core-js/internals/shared.js"(exports, module) {
    var IS_PURE = require_is_pure();
    var store = require_shared_store();
    (module.exports = function(key, value) {
      return store[key] || (store[key] = value !== void 0 ? value : {});
    })("versions", []).push({
      version: "3.25.5",
      mode: IS_PURE ? "pure" : "global",
      copyright: "\xA9 2014-2022 Denis Pushkarev (zloirock.ru)",
      license: "https://github.com/zloirock/core-js/blob/v3.25.5/LICENSE",
      source: "https://github.com/zloirock/core-js"
    });
  }
});

// node_modules/core-js/internals/is-null-or-undefined.js
var require_is_null_or_undefined = __commonJS({
  "node_modules/core-js/internals/is-null-or-undefined.js"(exports, module) {
    module.exports = function(it) {
      return it === null || it === void 0;
    };
  }
});

// node_modules/core-js/internals/require-object-coercible.js
var require_require_object_coercible = __commonJS({
  "node_modules/core-js/internals/require-object-coercible.js"(exports, module) {
    var isNullOrUndefined = require_is_null_or_undefined();
    var $TypeError = TypeError;
    module.exports = function(it) {
      if (isNullOrUndefined(it))
        throw $TypeError("Can't call method on " + it);
      return it;
    };
  }
});

// node_modules/core-js/internals/to-object.js
var require_to_object = __commonJS({
  "node_modules/core-js/internals/to-object.js"(exports, module) {
    var requireObjectCoercible = require_require_object_coercible();
    var $Object = Object;
    module.exports = function(argument) {
      return $Object(requireObjectCoercible(argument));
    };
  }
});

// node_modules/core-js/internals/has-own-property.js
var require_has_own_property = __commonJS({
  "node_modules/core-js/internals/has-own-property.js"(exports, module) {
    var uncurryThis = require_function_uncurry_this();
    var toObject = require_to_object();
    var hasOwnProperty2 = uncurryThis({}.hasOwnProperty);
    module.exports = Object.hasOwn || function hasOwn(it, key) {
      return hasOwnProperty2(toObject(it), key);
    };
  }
});

// node_modules/core-js/internals/uid.js
var require_uid = __commonJS({
  "node_modules/core-js/internals/uid.js"(exports, module) {
    var uncurryThis = require_function_uncurry_this();
    var id = 0;
    var postfix = Math.random();
    var toString = uncurryThis(1 .toString);
    module.exports = function(key) {
      return "Symbol(" + (key === void 0 ? "" : key) + ")_" + toString(++id + postfix, 36);
    };
  }
});

// node_modules/core-js/internals/document-all.js
var require_document_all = __commonJS({
  "node_modules/core-js/internals/document-all.js"(exports, module) {
    var documentAll = typeof document == "object" && document.all;
    var IS_HTMLDDA = typeof documentAll == "undefined" && documentAll !== void 0;
    module.exports = {
      all: documentAll,
      IS_HTMLDDA
    };
  }
});

// node_modules/core-js/internals/is-callable.js
var require_is_callable = __commonJS({
  "node_modules/core-js/internals/is-callable.js"(exports, module) {
    var $documentAll = require_document_all();
    var documentAll = $documentAll.all;
    module.exports = $documentAll.IS_HTMLDDA ? function(argument) {
      return typeof argument == "function" || argument === documentAll;
    } : function(argument) {
      return typeof argument == "function";
    };
  }
});

// node_modules/core-js/internals/get-built-in.js
var require_get_built_in = __commonJS({
  "node_modules/core-js/internals/get-built-in.js"(exports, module) {
    var global2 = require_global();
    var isCallable = require_is_callable();
    var aFunction = function(argument) {
      return isCallable(argument) ? argument : void 0;
    };
    module.exports = function(namespace, method) {
      return arguments.length < 2 ? aFunction(global2[namespace]) : global2[namespace] && global2[namespace][method];
    };
  }
});

// node_modules/core-js/internals/engine-user-agent.js
var require_engine_user_agent = __commonJS({
  "node_modules/core-js/internals/engine-user-agent.js"(exports, module) {
    var getBuiltIn = require_get_built_in();
    module.exports = getBuiltIn("navigator", "userAgent") || "";
  }
});

// node_modules/core-js/internals/engine-v8-version.js
var require_engine_v8_version = __commonJS({
  "node_modules/core-js/internals/engine-v8-version.js"(exports, module) {
    var global2 = require_global();
    var userAgent = require_engine_user_agent();
    var process2 = global2.process;
    var Deno = global2.Deno;
    var versions = process2 && process2.versions || Deno && Deno.version;
    var v8 = versions && versions.v8;
    var match;
    var version;
    if (v8) {
      match = v8.split(".");
      version = match[0] > 0 && match[0] < 4 ? 1 : +(match[0] + match[1]);
    }
    if (!version && userAgent) {
      match = userAgent.match(/Edge\/(\d+)/);
      if (!match || match[1] >= 74) {
        match = userAgent.match(/Chrome\/(\d+)/);
        if (match)
          version = +match[1];
      }
    }
    module.exports = version;
  }
});

// node_modules/core-js/internals/symbol-constructor-detection.js
var require_symbol_constructor_detection = __commonJS({
  "node_modules/core-js/internals/symbol-constructor-detection.js"(exports, module) {
    var V8_VERSION = require_engine_v8_version();
    var fails = require_fails();
    module.exports = !!Object.getOwnPropertySymbols && !fails(function() {
      var symbol = Symbol();
      return !String(symbol) || !(Object(symbol) instanceof Symbol) || !Symbol.sham && V8_VERSION && V8_VERSION < 41;
    });
  }
});

// node_modules/core-js/internals/use-symbol-as-uid.js
var require_use_symbol_as_uid = __commonJS({
  "node_modules/core-js/internals/use-symbol-as-uid.js"(exports, module) {
    var NATIVE_SYMBOL = require_symbol_constructor_detection();
    module.exports = NATIVE_SYMBOL && !Symbol.sham && typeof Symbol.iterator == "symbol";
  }
});

// node_modules/core-js/internals/well-known-symbol.js
var require_well_known_symbol = __commonJS({
  "node_modules/core-js/internals/well-known-symbol.js"(exports, module) {
    var global2 = require_global();
    var shared = require_shared();
    var hasOwn = require_has_own_property();
    var uid = require_uid();
    var NATIVE_SYMBOL = require_symbol_constructor_detection();
    var USE_SYMBOL_AS_UID = require_use_symbol_as_uid();
    var WellKnownSymbolsStore = shared("wks");
    var Symbol2 = global2.Symbol;
    var symbolFor = Symbol2 && Symbol2["for"];
    var createWellKnownSymbol = USE_SYMBOL_AS_UID ? Symbol2 : Symbol2 && Symbol2.withoutSetter || uid;
    module.exports = function(name) {
      if (!hasOwn(WellKnownSymbolsStore, name) || !(NATIVE_SYMBOL || typeof WellKnownSymbolsStore[name] == "string")) {
        var description = "Symbol." + name;
        if (NATIVE_SYMBOL && hasOwn(Symbol2, name)) {
          WellKnownSymbolsStore[name] = Symbol2[name];
        } else if (USE_SYMBOL_AS_UID && symbolFor) {
          WellKnownSymbolsStore[name] = symbolFor(description);
        } else {
          WellKnownSymbolsStore[name] = createWellKnownSymbol(description);
        }
      }
      return WellKnownSymbolsStore[name];
    };
  }
});

// node_modules/core-js/internals/to-string-tag-support.js
var require_to_string_tag_support = __commonJS({
  "node_modules/core-js/internals/to-string-tag-support.js"(exports, module) {
    var wellKnownSymbol = require_well_known_symbol();
    var TO_STRING_TAG = wellKnownSymbol("toStringTag");
    var test = {};
    test[TO_STRING_TAG] = "z";
    module.exports = String(test) === "[object z]";
  }
});

// node_modules/core-js/internals/classof.js
var require_classof = __commonJS({
  "node_modules/core-js/internals/classof.js"(exports, module) {
    var TO_STRING_TAG_SUPPORT = require_to_string_tag_support();
    var isCallable = require_is_callable();
    var classofRaw = require_classof_raw();
    var wellKnownSymbol = require_well_known_symbol();
    var TO_STRING_TAG = wellKnownSymbol("toStringTag");
    var $Object = Object;
    var CORRECT_ARGUMENTS = classofRaw(function() {
      return arguments;
    }()) == "Arguments";
    var tryGet = function(it, key) {
      try {
        return it[key];
      } catch (error) {
      }
    };
    module.exports = TO_STRING_TAG_SUPPORT ? classofRaw : function(it) {
      var O, tag, result;
      return it === void 0 ? "Undefined" : it === null ? "Null" : typeof (tag = tryGet(O = $Object(it), TO_STRING_TAG)) == "string" ? tag : CORRECT_ARGUMENTS ? classofRaw(O) : (result = classofRaw(O)) == "Object" && isCallable(O.callee) ? "Arguments" : result;
    };
  }
});

// node_modules/core-js/internals/to-string.js
var require_to_string = __commonJS({
  "node_modules/core-js/internals/to-string.js"(exports, module) {
    var classof = require_classof();
    var $String = String;
    module.exports = function(argument) {
      if (classof(argument) === "Symbol")
        throw TypeError("Cannot convert a Symbol value to a string");
      return $String(argument);
    };
  }
});

// node_modules/core-js/internals/string-multibyte.js
var require_string_multibyte = __commonJS({
  "node_modules/core-js/internals/string-multibyte.js"(exports, module) {
    var uncurryThis = require_function_uncurry_this();
    var toIntegerOrInfinity = require_to_integer_or_infinity();
    var toString = require_to_string();
    var requireObjectCoercible = require_require_object_coercible();
    var charAt = uncurryThis("".charAt);
    var charCodeAt = uncurryThis("".charCodeAt);
    var stringSlice = uncurryThis("".slice);
    var createMethod = function(CONVERT_TO_STRING) {
      return function($this, pos) {
        var S = toString(requireObjectCoercible($this));
        var position = toIntegerOrInfinity(pos);
        var size = S.length;
        var first, second;
        if (position < 0 || position >= size)
          return CONVERT_TO_STRING ? "" : void 0;
        first = charCodeAt(S, position);
        return first < 55296 || first > 56319 || position + 1 === size || (second = charCodeAt(S, position + 1)) < 56320 || second > 57343 ? CONVERT_TO_STRING ? charAt(S, position) : first : CONVERT_TO_STRING ? stringSlice(S, position, position + 2) : (first - 55296 << 10) + (second - 56320) + 65536;
      };
    };
    module.exports = {
      codeAt: createMethod(false),
      charAt: createMethod(true)
    };
  }
});

// node_modules/core-js/internals/weak-map-basic-detection.js
var require_weak_map_basic_detection = __commonJS({
  "node_modules/core-js/internals/weak-map-basic-detection.js"(exports, module) {
    var global2 = require_global();
    var isCallable = require_is_callable();
    var WeakMap2 = global2.WeakMap;
    module.exports = isCallable(WeakMap2) && /native code/.test(String(WeakMap2));
  }
});

// node_modules/core-js/internals/is-object.js
var require_is_object = __commonJS({
  "node_modules/core-js/internals/is-object.js"(exports, module) {
    var isCallable = require_is_callable();
    var $documentAll = require_document_all();
    var documentAll = $documentAll.all;
    module.exports = $documentAll.IS_HTMLDDA ? function(it) {
      return typeof it == "object" ? it !== null : isCallable(it) || it === documentAll;
    } : function(it) {
      return typeof it == "object" ? it !== null : isCallable(it);
    };
  }
});

// node_modules/core-js/internals/descriptors.js
var require_descriptors = __commonJS({
  "node_modules/core-js/internals/descriptors.js"(exports, module) {
    var fails = require_fails();
    module.exports = !fails(function() {
      return Object.defineProperty({}, 1, { get: function() {
        return 7;
      } })[1] != 7;
    });
  }
});

// node_modules/core-js/internals/document-create-element.js
var require_document_create_element = __commonJS({
  "node_modules/core-js/internals/document-create-element.js"(exports, module) {
    var global2 = require_global();
    var isObject2 = require_is_object();
    var document2 = global2.document;
    var EXISTS = isObject2(document2) && isObject2(document2.createElement);
    module.exports = function(it) {
      return EXISTS ? document2.createElement(it) : {};
    };
  }
});

// node_modules/core-js/internals/ie8-dom-define.js
var require_ie8_dom_define = __commonJS({
  "node_modules/core-js/internals/ie8-dom-define.js"(exports, module) {
    var DESCRIPTORS = require_descriptors();
    var fails = require_fails();
    var createElement = require_document_create_element();
    module.exports = !DESCRIPTORS && !fails(function() {
      return Object.defineProperty(createElement("div"), "a", {
        get: function() {
          return 7;
        }
      }).a != 7;
    });
  }
});

// node_modules/core-js/internals/v8-prototype-define-bug.js
var require_v8_prototype_define_bug = __commonJS({
  "node_modules/core-js/internals/v8-prototype-define-bug.js"(exports, module) {
    var DESCRIPTORS = require_descriptors();
    var fails = require_fails();
    module.exports = DESCRIPTORS && fails(function() {
      return Object.defineProperty(function() {
      }, "prototype", {
        value: 42,
        writable: false
      }).prototype != 42;
    });
  }
});

// node_modules/core-js/internals/an-object.js
var require_an_object = __commonJS({
  "node_modules/core-js/internals/an-object.js"(exports, module) {
    var isObject2 = require_is_object();
    var $String = String;
    var $TypeError = TypeError;
    module.exports = function(argument) {
      if (isObject2(argument))
        return argument;
      throw $TypeError($String(argument) + " is not an object");
    };
  }
});

// node_modules/core-js/internals/function-call.js
var require_function_call = __commonJS({
  "node_modules/core-js/internals/function-call.js"(exports, module) {
    var NATIVE_BIND = require_function_bind_native();
    var call = Function.prototype.call;
    module.exports = NATIVE_BIND ? call.bind(call) : function() {
      return call.apply(call, arguments);
    };
  }
});

// node_modules/core-js/internals/object-is-prototype-of.js
var require_object_is_prototype_of = __commonJS({
  "node_modules/core-js/internals/object-is-prototype-of.js"(exports, module) {
    var uncurryThis = require_function_uncurry_this();
    module.exports = uncurryThis({}.isPrototypeOf);
  }
});

// node_modules/core-js/internals/is-symbol.js
var require_is_symbol = __commonJS({
  "node_modules/core-js/internals/is-symbol.js"(exports, module) {
    var getBuiltIn = require_get_built_in();
    var isCallable = require_is_callable();
    var isPrototypeOf = require_object_is_prototype_of();
    var USE_SYMBOL_AS_UID = require_use_symbol_as_uid();
    var $Object = Object;
    module.exports = USE_SYMBOL_AS_UID ? function(it) {
      return typeof it == "symbol";
    } : function(it) {
      var $Symbol = getBuiltIn("Symbol");
      return isCallable($Symbol) && isPrototypeOf($Symbol.prototype, $Object(it));
    };
  }
});

// node_modules/core-js/internals/try-to-string.js
var require_try_to_string = __commonJS({
  "node_modules/core-js/internals/try-to-string.js"(exports, module) {
    var $String = String;
    module.exports = function(argument) {
      try {
        return $String(argument);
      } catch (error) {
        return "Object";
      }
    };
  }
});

// node_modules/core-js/internals/a-callable.js
var require_a_callable = __commonJS({
  "node_modules/core-js/internals/a-callable.js"(exports, module) {
    var isCallable = require_is_callable();
    var tryToString = require_try_to_string();
    var $TypeError = TypeError;
    module.exports = function(argument) {
      if (isCallable(argument))
        return argument;
      throw $TypeError(tryToString(argument) + " is not a function");
    };
  }
});

// node_modules/core-js/internals/get-method.js
var require_get_method = __commonJS({
  "node_modules/core-js/internals/get-method.js"(exports, module) {
    var aCallable = require_a_callable();
    var isNullOrUndefined = require_is_null_or_undefined();
    module.exports = function(V, P) {
      var func = V[P];
      return isNullOrUndefined(func) ? void 0 : aCallable(func);
    };
  }
});

// node_modules/core-js/internals/ordinary-to-primitive.js
var require_ordinary_to_primitive = __commonJS({
  "node_modules/core-js/internals/ordinary-to-primitive.js"(exports, module) {
    var call = require_function_call();
    var isCallable = require_is_callable();
    var isObject2 = require_is_object();
    var $TypeError = TypeError;
    module.exports = function(input, pref) {
      var fn, val;
      if (pref === "string" && isCallable(fn = input.toString) && !isObject2(val = call(fn, input)))
        return val;
      if (isCallable(fn = input.valueOf) && !isObject2(val = call(fn, input)))
        return val;
      if (pref !== "string" && isCallable(fn = input.toString) && !isObject2(val = call(fn, input)))
        return val;
      throw $TypeError("Can't convert object to primitive value");
    };
  }
});

// node_modules/core-js/internals/to-primitive.js
var require_to_primitive = __commonJS({
  "node_modules/core-js/internals/to-primitive.js"(exports, module) {
    var call = require_function_call();
    var isObject2 = require_is_object();
    var isSymbol = require_is_symbol();
    var getMethod = require_get_method();
    var ordinaryToPrimitive = require_ordinary_to_primitive();
    var wellKnownSymbol = require_well_known_symbol();
    var $TypeError = TypeError;
    var TO_PRIMITIVE = wellKnownSymbol("toPrimitive");
    module.exports = function(input, pref) {
      if (!isObject2(input) || isSymbol(input))
        return input;
      var exoticToPrim = getMethod(input, TO_PRIMITIVE);
      var result;
      if (exoticToPrim) {
        if (pref === void 0)
          pref = "default";
        result = call(exoticToPrim, input, pref);
        if (!isObject2(result) || isSymbol(result))
          return result;
        throw $TypeError("Can't convert object to primitive value");
      }
      if (pref === void 0)
        pref = "number";
      return ordinaryToPrimitive(input, pref);
    };
  }
});

// node_modules/core-js/internals/to-property-key.js
var require_to_property_key = __commonJS({
  "node_modules/core-js/internals/to-property-key.js"(exports, module) {
    var toPrimitive = require_to_primitive();
    var isSymbol = require_is_symbol();
    module.exports = function(argument) {
      var key = toPrimitive(argument, "string");
      return isSymbol(key) ? key : key + "";
    };
  }
});

// node_modules/core-js/internals/object-define-property.js
var require_object_define_property = __commonJS({
  "node_modules/core-js/internals/object-define-property.js"(exports) {
    var DESCRIPTORS = require_descriptors();
    var IE8_DOM_DEFINE = require_ie8_dom_define();
    var V8_PROTOTYPE_DEFINE_BUG = require_v8_prototype_define_bug();
    var anObject = require_an_object();
    var toPropertyKey = require_to_property_key();
    var $TypeError = TypeError;
    var $defineProperty = Object.defineProperty;
    var $getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    var ENUMERABLE = "enumerable";
    var CONFIGURABLE = "configurable";
    var WRITABLE = "writable";
    exports.f = DESCRIPTORS ? V8_PROTOTYPE_DEFINE_BUG ? function defineProperty(O, P, Attributes) {
      anObject(O);
      P = toPropertyKey(P);
      anObject(Attributes);
      if (typeof O === "function" && P === "prototype" && "value" in Attributes && WRITABLE in Attributes && !Attributes[WRITABLE]) {
        var current = $getOwnPropertyDescriptor(O, P);
        if (current && current[WRITABLE]) {
          O[P] = Attributes.value;
          Attributes = {
            configurable: CONFIGURABLE in Attributes ? Attributes[CONFIGURABLE] : current[CONFIGURABLE],
            enumerable: ENUMERABLE in Attributes ? Attributes[ENUMERABLE] : current[ENUMERABLE],
            writable: false
          };
        }
      }
      return $defineProperty(O, P, Attributes);
    } : $defineProperty : function defineProperty(O, P, Attributes) {
      anObject(O);
      P = toPropertyKey(P);
      anObject(Attributes);
      if (IE8_DOM_DEFINE)
        try {
          return $defineProperty(O, P, Attributes);
        } catch (error) {
        }
      if ("get" in Attributes || "set" in Attributes)
        throw $TypeError("Accessors not supported");
      if ("value" in Attributes)
        O[P] = Attributes.value;
      return O;
    };
  }
});

// node_modules/core-js/internals/create-property-descriptor.js
var require_create_property_descriptor = __commonJS({
  "node_modules/core-js/internals/create-property-descriptor.js"(exports, module) {
    module.exports = function(bitmap, value) {
      return {
        enumerable: !(bitmap & 1),
        configurable: !(bitmap & 2),
        writable: !(bitmap & 4),
        value
      };
    };
  }
});

// node_modules/core-js/internals/create-non-enumerable-property.js
var require_create_non_enumerable_property = __commonJS({
  "node_modules/core-js/internals/create-non-enumerable-property.js"(exports, module) {
    var DESCRIPTORS = require_descriptors();
    var definePropertyModule = require_object_define_property();
    var createPropertyDescriptor = require_create_property_descriptor();
    module.exports = DESCRIPTORS ? function(object, key, value) {
      return definePropertyModule.f(object, key, createPropertyDescriptor(1, value));
    } : function(object, key, value) {
      object[key] = value;
      return object;
    };
  }
});

// node_modules/core-js/internals/shared-key.js
var require_shared_key = __commonJS({
  "node_modules/core-js/internals/shared-key.js"(exports, module) {
    var shared = require_shared();
    var uid = require_uid();
    var keys = shared("keys");
    module.exports = function(key) {
      return keys[key] || (keys[key] = uid(key));
    };
  }
});

// node_modules/core-js/internals/hidden-keys.js
var require_hidden_keys = __commonJS({
  "node_modules/core-js/internals/hidden-keys.js"(exports, module) {
    module.exports = {};
  }
});

// node_modules/core-js/internals/internal-state.js
var require_internal_state = __commonJS({
  "node_modules/core-js/internals/internal-state.js"(exports, module) {
    var NATIVE_WEAK_MAP = require_weak_map_basic_detection();
    var global2 = require_global();
    var isObject2 = require_is_object();
    var createNonEnumerableProperty = require_create_non_enumerable_property();
    var hasOwn = require_has_own_property();
    var shared = require_shared_store();
    var sharedKey = require_shared_key();
    var hiddenKeys = require_hidden_keys();
    var OBJECT_ALREADY_INITIALIZED = "Object already initialized";
    var TypeError2 = global2.TypeError;
    var WeakMap2 = global2.WeakMap;
    var set;
    var get;
    var has;
    var enforce = function(it) {
      return has(it) ? get(it) : set(it, {});
    };
    var getterFor = function(TYPE) {
      return function(it) {
        var state;
        if (!isObject2(it) || (state = get(it)).type !== TYPE) {
          throw TypeError2("Incompatible receiver, " + TYPE + " required");
        }
        return state;
      };
    };
    if (NATIVE_WEAK_MAP || shared.state) {
      store = shared.state || (shared.state = new WeakMap2());
      store.get = store.get;
      store.has = store.has;
      store.set = store.set;
      set = function(it, metadata) {
        if (store.has(it))
          throw TypeError2(OBJECT_ALREADY_INITIALIZED);
        metadata.facade = it;
        store.set(it, metadata);
        return metadata;
      };
      get = function(it) {
        return store.get(it) || {};
      };
      has = function(it) {
        return store.has(it);
      };
    } else {
      STATE = sharedKey("state");
      hiddenKeys[STATE] = true;
      set = function(it, metadata) {
        if (hasOwn(it, STATE))
          throw TypeError2(OBJECT_ALREADY_INITIALIZED);
        metadata.facade = it;
        createNonEnumerableProperty(it, STATE, metadata);
        return metadata;
      };
      get = function(it) {
        return hasOwn(it, STATE) ? it[STATE] : {};
      };
      has = function(it) {
        return hasOwn(it, STATE);
      };
    }
    var store;
    var STATE;
    module.exports = {
      set,
      get,
      has,
      enforce,
      getterFor
    };
  }
});

// node_modules/core-js/internals/object-property-is-enumerable.js
var require_object_property_is_enumerable = __commonJS({
  "node_modules/core-js/internals/object-property-is-enumerable.js"(exports) {
    "use strict";
    var $propertyIsEnumerable = {}.propertyIsEnumerable;
    var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    var NASHORN_BUG = getOwnPropertyDescriptor && !$propertyIsEnumerable.call({ 1: 2 }, 1);
    exports.f = NASHORN_BUG ? function propertyIsEnumerable(V) {
      var descriptor = getOwnPropertyDescriptor(this, V);
      return !!descriptor && descriptor.enumerable;
    } : $propertyIsEnumerable;
  }
});

// node_modules/core-js/internals/indexed-object.js
var require_indexed_object = __commonJS({
  "node_modules/core-js/internals/indexed-object.js"(exports, module) {
    var uncurryThis = require_function_uncurry_this();
    var fails = require_fails();
    var classof = require_classof_raw();
    var $Object = Object;
    var split = uncurryThis("".split);
    module.exports = fails(function() {
      return !$Object("z").propertyIsEnumerable(0);
    }) ? function(it) {
      return classof(it) == "String" ? split(it, "") : $Object(it);
    } : $Object;
  }
});

// node_modules/core-js/internals/to-indexed-object.js
var require_to_indexed_object = __commonJS({
  "node_modules/core-js/internals/to-indexed-object.js"(exports, module) {
    var IndexedObject = require_indexed_object();
    var requireObjectCoercible = require_require_object_coercible();
    module.exports = function(it) {
      return IndexedObject(requireObjectCoercible(it));
    };
  }
});

// node_modules/core-js/internals/object-get-own-property-descriptor.js
var require_object_get_own_property_descriptor = __commonJS({
  "node_modules/core-js/internals/object-get-own-property-descriptor.js"(exports) {
    var DESCRIPTORS = require_descriptors();
    var call = require_function_call();
    var propertyIsEnumerableModule = require_object_property_is_enumerable();
    var createPropertyDescriptor = require_create_property_descriptor();
    var toIndexedObject = require_to_indexed_object();
    var toPropertyKey = require_to_property_key();
    var hasOwn = require_has_own_property();
    var IE8_DOM_DEFINE = require_ie8_dom_define();
    var $getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    exports.f = DESCRIPTORS ? $getOwnPropertyDescriptor : function getOwnPropertyDescriptor(O, P) {
      O = toIndexedObject(O);
      P = toPropertyKey(P);
      if (IE8_DOM_DEFINE)
        try {
          return $getOwnPropertyDescriptor(O, P);
        } catch (error) {
        }
      if (hasOwn(O, P))
        return createPropertyDescriptor(!call(propertyIsEnumerableModule.f, O, P), O[P]);
    };
  }
});

// node_modules/core-js/internals/function-name.js
var require_function_name = __commonJS({
  "node_modules/core-js/internals/function-name.js"(exports, module) {
    var DESCRIPTORS = require_descriptors();
    var hasOwn = require_has_own_property();
    var FunctionPrototype = Function.prototype;
    var getDescriptor = DESCRIPTORS && Object.getOwnPropertyDescriptor;
    var EXISTS = hasOwn(FunctionPrototype, "name");
    var PROPER = EXISTS && function something() {
    }.name === "something";
    var CONFIGURABLE = EXISTS && (!DESCRIPTORS || DESCRIPTORS && getDescriptor(FunctionPrototype, "name").configurable);
    module.exports = {
      EXISTS,
      PROPER,
      CONFIGURABLE
    };
  }
});

// node_modules/core-js/internals/inspect-source.js
var require_inspect_source = __commonJS({
  "node_modules/core-js/internals/inspect-source.js"(exports, module) {
    var uncurryThis = require_function_uncurry_this();
    var isCallable = require_is_callable();
    var store = require_shared_store();
    var functionToString = uncurryThis(Function.toString);
    if (!isCallable(store.inspectSource)) {
      store.inspectSource = function(it) {
        return functionToString(it);
      };
    }
    module.exports = store.inspectSource;
  }
});

// node_modules/core-js/internals/make-built-in.js
var require_make_built_in = __commonJS({
  "node_modules/core-js/internals/make-built-in.js"(exports, module) {
    var fails = require_fails();
    var isCallable = require_is_callable();
    var hasOwn = require_has_own_property();
    var DESCRIPTORS = require_descriptors();
    var CONFIGURABLE_FUNCTION_NAME = require_function_name().CONFIGURABLE;
    var inspectSource = require_inspect_source();
    var InternalStateModule = require_internal_state();
    var enforceInternalState = InternalStateModule.enforce;
    var getInternalState = InternalStateModule.get;
    var defineProperty = Object.defineProperty;
    var CONFIGURABLE_LENGTH = DESCRIPTORS && !fails(function() {
      return defineProperty(function() {
      }, "length", { value: 8 }).length !== 8;
    });
    var TEMPLATE = String(String).split("String");
    var makeBuiltIn = module.exports = function(value, name, options) {
      if (String(name).slice(0, 7) === "Symbol(") {
        name = "[" + String(name).replace(/^Symbol\(([^)]*)\)/, "$1") + "]";
      }
      if (options && options.getter)
        name = "get " + name;
      if (options && options.setter)
        name = "set " + name;
      if (!hasOwn(value, "name") || CONFIGURABLE_FUNCTION_NAME && value.name !== name) {
        if (DESCRIPTORS)
          defineProperty(value, "name", { value: name, configurable: true });
        else
          value.name = name;
      }
      if (CONFIGURABLE_LENGTH && options && hasOwn(options, "arity") && value.length !== options.arity) {
        defineProperty(value, "length", { value: options.arity });
      }
      try {
        if (options && hasOwn(options, "constructor") && options.constructor) {
          if (DESCRIPTORS)
            defineProperty(value, "prototype", { writable: false });
        } else if (value.prototype)
          value.prototype = void 0;
      } catch (error) {
      }
      var state = enforceInternalState(value);
      if (!hasOwn(state, "source")) {
        state.source = TEMPLATE.join(typeof name == "string" ? name : "");
      }
      return value;
    };
    Function.prototype.toString = makeBuiltIn(function toString() {
      return isCallable(this) && getInternalState(this).source || inspectSource(this);
    }, "toString");
  }
});

// node_modules/core-js/internals/define-built-in.js
var require_define_built_in = __commonJS({
  "node_modules/core-js/internals/define-built-in.js"(exports, module) {
    var isCallable = require_is_callable();
    var definePropertyModule = require_object_define_property();
    var makeBuiltIn = require_make_built_in();
    var defineGlobalProperty = require_define_global_property();
    module.exports = function(O, key, value, options) {
      if (!options)
        options = {};
      var simple = options.enumerable;
      var name = options.name !== void 0 ? options.name : key;
      if (isCallable(value))
        makeBuiltIn(value, name, options);
      if (options.global) {
        if (simple)
          O[key] = value;
        else
          defineGlobalProperty(key, value);
      } else {
        try {
          if (!options.unsafe)
            delete O[key];
          else if (O[key])
            simple = true;
        } catch (error) {
        }
        if (simple)
          O[key] = value;
        else
          definePropertyModule.f(O, key, {
            value,
            enumerable: false,
            configurable: !options.nonConfigurable,
            writable: !options.nonWritable
          });
      }
      return O;
    };
  }
});

// node_modules/core-js/internals/to-absolute-index.js
var require_to_absolute_index = __commonJS({
  "node_modules/core-js/internals/to-absolute-index.js"(exports, module) {
    var toIntegerOrInfinity = require_to_integer_or_infinity();
    var max = Math.max;
    var min = Math.min;
    module.exports = function(index, length) {
      var integer = toIntegerOrInfinity(index);
      return integer < 0 ? max(integer + length, 0) : min(integer, length);
    };
  }
});

// node_modules/core-js/internals/to-length.js
var require_to_length = __commonJS({
  "node_modules/core-js/internals/to-length.js"(exports, module) {
    var toIntegerOrInfinity = require_to_integer_or_infinity();
    var min = Math.min;
    module.exports = function(argument) {
      return argument > 0 ? min(toIntegerOrInfinity(argument), 9007199254740991) : 0;
    };
  }
});

// node_modules/core-js/internals/length-of-array-like.js
var require_length_of_array_like = __commonJS({
  "node_modules/core-js/internals/length-of-array-like.js"(exports, module) {
    var toLength = require_to_length();
    module.exports = function(obj) {
      return toLength(obj.length);
    };
  }
});

// node_modules/core-js/internals/array-includes.js
var require_array_includes = __commonJS({
  "node_modules/core-js/internals/array-includes.js"(exports, module) {
    var toIndexedObject = require_to_indexed_object();
    var toAbsoluteIndex = require_to_absolute_index();
    var lengthOfArrayLike = require_length_of_array_like();
    var createMethod = function(IS_INCLUDES) {
      return function($this, el, fromIndex) {
        var O = toIndexedObject($this);
        var length = lengthOfArrayLike(O);
        var index = toAbsoluteIndex(fromIndex, length);
        var value;
        if (IS_INCLUDES && el != el)
          while (length > index) {
            value = O[index++];
            if (value != value)
              return true;
          }
        else
          for (; length > index; index++) {
            if ((IS_INCLUDES || index in O) && O[index] === el)
              return IS_INCLUDES || index || 0;
          }
        return !IS_INCLUDES && -1;
      };
    };
    module.exports = {
      includes: createMethod(true),
      indexOf: createMethod(false)
    };
  }
});

// node_modules/core-js/internals/object-keys-internal.js
var require_object_keys_internal = __commonJS({
  "node_modules/core-js/internals/object-keys-internal.js"(exports, module) {
    var uncurryThis = require_function_uncurry_this();
    var hasOwn = require_has_own_property();
    var toIndexedObject = require_to_indexed_object();
    var indexOf = require_array_includes().indexOf;
    var hiddenKeys = require_hidden_keys();
    var push = uncurryThis([].push);
    module.exports = function(object, names) {
      var O = toIndexedObject(object);
      var i = 0;
      var result = [];
      var key;
      for (key in O)
        !hasOwn(hiddenKeys, key) && hasOwn(O, key) && push(result, key);
      while (names.length > i)
        if (hasOwn(O, key = names[i++])) {
          ~indexOf(result, key) || push(result, key);
        }
      return result;
    };
  }
});

// node_modules/core-js/internals/enum-bug-keys.js
var require_enum_bug_keys = __commonJS({
  "node_modules/core-js/internals/enum-bug-keys.js"(exports, module) {
    module.exports = [
      "constructor",
      "hasOwnProperty",
      "isPrototypeOf",
      "propertyIsEnumerable",
      "toLocaleString",
      "toString",
      "valueOf"
    ];
  }
});

// node_modules/core-js/internals/object-get-own-property-names.js
var require_object_get_own_property_names = __commonJS({
  "node_modules/core-js/internals/object-get-own-property-names.js"(exports) {
    var internalObjectKeys = require_object_keys_internal();
    var enumBugKeys = require_enum_bug_keys();
    var hiddenKeys = enumBugKeys.concat("length", "prototype");
    exports.f = Object.getOwnPropertyNames || function getOwnPropertyNames(O) {
      return internalObjectKeys(O, hiddenKeys);
    };
  }
});

// node_modules/core-js/internals/object-get-own-property-symbols.js
var require_object_get_own_property_symbols = __commonJS({
  "node_modules/core-js/internals/object-get-own-property-symbols.js"(exports) {
    exports.f = Object.getOwnPropertySymbols;
  }
});

// node_modules/core-js/internals/own-keys.js
var require_own_keys = __commonJS({
  "node_modules/core-js/internals/own-keys.js"(exports, module) {
    var getBuiltIn = require_get_built_in();
    var uncurryThis = require_function_uncurry_this();
    var getOwnPropertyNamesModule = require_object_get_own_property_names();
    var getOwnPropertySymbolsModule = require_object_get_own_property_symbols();
    var anObject = require_an_object();
    var concat = uncurryThis([].concat);
    module.exports = getBuiltIn("Reflect", "ownKeys") || function ownKeys(it) {
      var keys = getOwnPropertyNamesModule.f(anObject(it));
      var getOwnPropertySymbols = getOwnPropertySymbolsModule.f;
      return getOwnPropertySymbols ? concat(keys, getOwnPropertySymbols(it)) : keys;
    };
  }
});

// node_modules/core-js/internals/copy-constructor-properties.js
var require_copy_constructor_properties = __commonJS({
  "node_modules/core-js/internals/copy-constructor-properties.js"(exports, module) {
    var hasOwn = require_has_own_property();
    var ownKeys = require_own_keys();
    var getOwnPropertyDescriptorModule = require_object_get_own_property_descriptor();
    var definePropertyModule = require_object_define_property();
    module.exports = function(target, source, exceptions) {
      var keys = ownKeys(source);
      var defineProperty = definePropertyModule.f;
      var getOwnPropertyDescriptor = getOwnPropertyDescriptorModule.f;
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (!hasOwn(target, key) && !(exceptions && hasOwn(exceptions, key))) {
          defineProperty(target, key, getOwnPropertyDescriptor(source, key));
        }
      }
    };
  }
});

// node_modules/core-js/internals/is-forced.js
var require_is_forced = __commonJS({
  "node_modules/core-js/internals/is-forced.js"(exports, module) {
    var fails = require_fails();
    var isCallable = require_is_callable();
    var replacement = /#|\.prototype\./;
    var isForced = function(feature, detection) {
      var value = data[normalize(feature)];
      return value == POLYFILL ? true : value == NATIVE ? false : isCallable(detection) ? fails(detection) : !!detection;
    };
    var normalize = isForced.normalize = function(string) {
      return String(string).replace(replacement, ".").toLowerCase();
    };
    var data = isForced.data = {};
    var NATIVE = isForced.NATIVE = "N";
    var POLYFILL = isForced.POLYFILL = "P";
    module.exports = isForced;
  }
});

// node_modules/core-js/internals/export.js
var require_export = __commonJS({
  "node_modules/core-js/internals/export.js"(exports, module) {
    var global2 = require_global();
    var getOwnPropertyDescriptor = require_object_get_own_property_descriptor().f;
    var createNonEnumerableProperty = require_create_non_enumerable_property();
    var defineBuiltIn = require_define_built_in();
    var defineGlobalProperty = require_define_global_property();
    var copyConstructorProperties = require_copy_constructor_properties();
    var isForced = require_is_forced();
    module.exports = function(options, source) {
      var TARGET = options.target;
      var GLOBAL = options.global;
      var STATIC = options.stat;
      var FORCED, target, key, targetProperty, sourceProperty, descriptor;
      if (GLOBAL) {
        target = global2;
      } else if (STATIC) {
        target = global2[TARGET] || defineGlobalProperty(TARGET, {});
      } else {
        target = (global2[TARGET] || {}).prototype;
      }
      if (target)
        for (key in source) {
          sourceProperty = source[key];
          if (options.dontCallGetSet) {
            descriptor = getOwnPropertyDescriptor(target, key);
            targetProperty = descriptor && descriptor.value;
          } else
            targetProperty = target[key];
          FORCED = isForced(GLOBAL ? key : TARGET + (STATIC ? "." : "#") + key, options.forced);
          if (!FORCED && targetProperty !== void 0) {
            if (typeof sourceProperty == typeof targetProperty)
              continue;
            copyConstructorProperties(sourceProperty, targetProperty);
          }
          if (options.sham || targetProperty && targetProperty.sham) {
            createNonEnumerableProperty(sourceProperty, "sham", true);
          }
          defineBuiltIn(target, key, sourceProperty, options);
        }
    };
  }
});

// node_modules/core-js/internals/object-keys.js
var require_object_keys = __commonJS({
  "node_modules/core-js/internals/object-keys.js"(exports, module) {
    var internalObjectKeys = require_object_keys_internal();
    var enumBugKeys = require_enum_bug_keys();
    module.exports = Object.keys || function keys(O) {
      return internalObjectKeys(O, enumBugKeys);
    };
  }
});

// node_modules/core-js/internals/object-define-properties.js
var require_object_define_properties = __commonJS({
  "node_modules/core-js/internals/object-define-properties.js"(exports) {
    var DESCRIPTORS = require_descriptors();
    var V8_PROTOTYPE_DEFINE_BUG = require_v8_prototype_define_bug();
    var definePropertyModule = require_object_define_property();
    var anObject = require_an_object();
    var toIndexedObject = require_to_indexed_object();
    var objectKeys = require_object_keys();
    exports.f = DESCRIPTORS && !V8_PROTOTYPE_DEFINE_BUG ? Object.defineProperties : function defineProperties(O, Properties) {
      anObject(O);
      var props = toIndexedObject(Properties);
      var keys = objectKeys(Properties);
      var length = keys.length;
      var index = 0;
      var key;
      while (length > index)
        definePropertyModule.f(O, key = keys[index++], props[key]);
      return O;
    };
  }
});

// node_modules/core-js/internals/html.js
var require_html = __commonJS({
  "node_modules/core-js/internals/html.js"(exports, module) {
    var getBuiltIn = require_get_built_in();
    module.exports = getBuiltIn("document", "documentElement");
  }
});

// node_modules/core-js/internals/object-create.js
var require_object_create = __commonJS({
  "node_modules/core-js/internals/object-create.js"(exports, module) {
    var anObject = require_an_object();
    var definePropertiesModule = require_object_define_properties();
    var enumBugKeys = require_enum_bug_keys();
    var hiddenKeys = require_hidden_keys();
    var html = require_html();
    var documentCreateElement = require_document_create_element();
    var sharedKey = require_shared_key();
    var GT = ">";
    var LT = "<";
    var PROTOTYPE = "prototype";
    var SCRIPT = "script";
    var IE_PROTO = sharedKey("IE_PROTO");
    var EmptyConstructor = function() {
    };
    var scriptTag = function(content) {
      return LT + SCRIPT + GT + content + LT + "/" + SCRIPT + GT;
    };
    var NullProtoObjectViaActiveX = function(activeXDocument2) {
      activeXDocument2.write(scriptTag(""));
      activeXDocument2.close();
      var temp = activeXDocument2.parentWindow.Object;
      activeXDocument2 = null;
      return temp;
    };
    var NullProtoObjectViaIFrame = function() {
      var iframe = documentCreateElement("iframe");
      var JS = "java" + SCRIPT + ":";
      var iframeDocument;
      iframe.style.display = "none";
      html.appendChild(iframe);
      iframe.src = String(JS);
      iframeDocument = iframe.contentWindow.document;
      iframeDocument.open();
      iframeDocument.write(scriptTag("document.F=Object"));
      iframeDocument.close();
      return iframeDocument.F;
    };
    var activeXDocument;
    var NullProtoObject = function() {
      try {
        activeXDocument = new ActiveXObject("htmlfile");
      } catch (error) {
      }
      NullProtoObject = typeof document != "undefined" ? document.domain && activeXDocument ? NullProtoObjectViaActiveX(activeXDocument) : NullProtoObjectViaIFrame() : NullProtoObjectViaActiveX(activeXDocument);
      var length = enumBugKeys.length;
      while (length--)
        delete NullProtoObject[PROTOTYPE][enumBugKeys[length]];
      return NullProtoObject();
    };
    hiddenKeys[IE_PROTO] = true;
    module.exports = Object.create || function create(O, Properties) {
      var result;
      if (O !== null) {
        EmptyConstructor[PROTOTYPE] = anObject(O);
        result = new EmptyConstructor();
        EmptyConstructor[PROTOTYPE] = null;
        result[IE_PROTO] = O;
      } else
        result = NullProtoObject();
      return Properties === void 0 ? result : definePropertiesModule.f(result, Properties);
    };
  }
});

// node_modules/core-js/internals/correct-prototype-getter.js
var require_correct_prototype_getter = __commonJS({
  "node_modules/core-js/internals/correct-prototype-getter.js"(exports, module) {
    var fails = require_fails();
    module.exports = !fails(function() {
      function F() {
      }
      F.prototype.constructor = null;
      return Object.getPrototypeOf(new F()) !== F.prototype;
    });
  }
});

// node_modules/core-js/internals/object-get-prototype-of.js
var require_object_get_prototype_of = __commonJS({
  "node_modules/core-js/internals/object-get-prototype-of.js"(exports, module) {
    var hasOwn = require_has_own_property();
    var isCallable = require_is_callable();
    var toObject = require_to_object();
    var sharedKey = require_shared_key();
    var CORRECT_PROTOTYPE_GETTER = require_correct_prototype_getter();
    var IE_PROTO = sharedKey("IE_PROTO");
    var $Object = Object;
    var ObjectPrototype = $Object.prototype;
    module.exports = CORRECT_PROTOTYPE_GETTER ? $Object.getPrototypeOf : function(O) {
      var object = toObject(O);
      if (hasOwn(object, IE_PROTO))
        return object[IE_PROTO];
      var constructor = object.constructor;
      if (isCallable(constructor) && object instanceof constructor) {
        return constructor.prototype;
      }
      return object instanceof $Object ? ObjectPrototype : null;
    };
  }
});

// node_modules/core-js/internals/iterators-core.js
var require_iterators_core = __commonJS({
  "node_modules/core-js/internals/iterators-core.js"(exports, module) {
    "use strict";
    var fails = require_fails();
    var isCallable = require_is_callable();
    var isObject2 = require_is_object();
    var create = require_object_create();
    var getPrototypeOf = require_object_get_prototype_of();
    var defineBuiltIn = require_define_built_in();
    var wellKnownSymbol = require_well_known_symbol();
    var IS_PURE = require_is_pure();
    var ITERATOR = wellKnownSymbol("iterator");
    var BUGGY_SAFARI_ITERATORS = false;
    var IteratorPrototype;
    var PrototypeOfArrayIteratorPrototype;
    var arrayIterator;
    if ([].keys) {
      arrayIterator = [].keys();
      if (!("next" in arrayIterator))
        BUGGY_SAFARI_ITERATORS = true;
      else {
        PrototypeOfArrayIteratorPrototype = getPrototypeOf(getPrototypeOf(arrayIterator));
        if (PrototypeOfArrayIteratorPrototype !== Object.prototype)
          IteratorPrototype = PrototypeOfArrayIteratorPrototype;
      }
    }
    var NEW_ITERATOR_PROTOTYPE = !isObject2(IteratorPrototype) || fails(function() {
      var test = {};
      return IteratorPrototype[ITERATOR].call(test) !== test;
    });
    if (NEW_ITERATOR_PROTOTYPE)
      IteratorPrototype = {};
    else if (IS_PURE)
      IteratorPrototype = create(IteratorPrototype);
    if (!isCallable(IteratorPrototype[ITERATOR])) {
      defineBuiltIn(IteratorPrototype, ITERATOR, function() {
        return this;
      });
    }
    module.exports = {
      IteratorPrototype,
      BUGGY_SAFARI_ITERATORS
    };
  }
});

// node_modules/core-js/internals/set-to-string-tag.js
var require_set_to_string_tag = __commonJS({
  "node_modules/core-js/internals/set-to-string-tag.js"(exports, module) {
    var defineProperty = require_object_define_property().f;
    var hasOwn = require_has_own_property();
    var wellKnownSymbol = require_well_known_symbol();
    var TO_STRING_TAG = wellKnownSymbol("toStringTag");
    module.exports = function(target, TAG, STATIC) {
      if (target && !STATIC)
        target = target.prototype;
      if (target && !hasOwn(target, TO_STRING_TAG)) {
        defineProperty(target, TO_STRING_TAG, { configurable: true, value: TAG });
      }
    };
  }
});

// node_modules/core-js/internals/iterators.js
var require_iterators = __commonJS({
  "node_modules/core-js/internals/iterators.js"(exports, module) {
    module.exports = {};
  }
});

// node_modules/core-js/internals/iterator-create-constructor.js
var require_iterator_create_constructor = __commonJS({
  "node_modules/core-js/internals/iterator-create-constructor.js"(exports, module) {
    "use strict";
    var IteratorPrototype = require_iterators_core().IteratorPrototype;
    var create = require_object_create();
    var createPropertyDescriptor = require_create_property_descriptor();
    var setToStringTag = require_set_to_string_tag();
    var Iterators = require_iterators();
    var returnThis = function() {
      return this;
    };
    module.exports = function(IteratorConstructor, NAME, next, ENUMERABLE_NEXT) {
      var TO_STRING_TAG = NAME + " Iterator";
      IteratorConstructor.prototype = create(IteratorPrototype, { next: createPropertyDescriptor(+!ENUMERABLE_NEXT, next) });
      setToStringTag(IteratorConstructor, TO_STRING_TAG, false, true);
      Iterators[TO_STRING_TAG] = returnThis;
      return IteratorConstructor;
    };
  }
});

// node_modules/core-js/internals/a-possible-prototype.js
var require_a_possible_prototype = __commonJS({
  "node_modules/core-js/internals/a-possible-prototype.js"(exports, module) {
    var isCallable = require_is_callable();
    var $String = String;
    var $TypeError = TypeError;
    module.exports = function(argument) {
      if (typeof argument == "object" || isCallable(argument))
        return argument;
      throw $TypeError("Can't set " + $String(argument) + " as a prototype");
    };
  }
});

// node_modules/core-js/internals/object-set-prototype-of.js
var require_object_set_prototype_of = __commonJS({
  "node_modules/core-js/internals/object-set-prototype-of.js"(exports, module) {
    var uncurryThis = require_function_uncurry_this();
    var anObject = require_an_object();
    var aPossiblePrototype = require_a_possible_prototype();
    module.exports = Object.setPrototypeOf || ("__proto__" in {} ? function() {
      var CORRECT_SETTER = false;
      var test = {};
      var setter;
      try {
        setter = uncurryThis(Object.getOwnPropertyDescriptor(Object.prototype, "__proto__").set);
        setter(test, []);
        CORRECT_SETTER = test instanceof Array;
      } catch (error) {
      }
      return function setPrototypeOf(O, proto) {
        anObject(O);
        aPossiblePrototype(proto);
        if (CORRECT_SETTER)
          setter(O, proto);
        else
          O.__proto__ = proto;
        return O;
      };
    }() : void 0);
  }
});

// node_modules/core-js/internals/iterator-define.js
var require_iterator_define = __commonJS({
  "node_modules/core-js/internals/iterator-define.js"(exports, module) {
    "use strict";
    var $ = require_export();
    var call = require_function_call();
    var IS_PURE = require_is_pure();
    var FunctionName = require_function_name();
    var isCallable = require_is_callable();
    var createIteratorConstructor = require_iterator_create_constructor();
    var getPrototypeOf = require_object_get_prototype_of();
    var setPrototypeOf = require_object_set_prototype_of();
    var setToStringTag = require_set_to_string_tag();
    var createNonEnumerableProperty = require_create_non_enumerable_property();
    var defineBuiltIn = require_define_built_in();
    var wellKnownSymbol = require_well_known_symbol();
    var Iterators = require_iterators();
    var IteratorsCore = require_iterators_core();
    var PROPER_FUNCTION_NAME = FunctionName.PROPER;
    var CONFIGURABLE_FUNCTION_NAME = FunctionName.CONFIGURABLE;
    var IteratorPrototype = IteratorsCore.IteratorPrototype;
    var BUGGY_SAFARI_ITERATORS = IteratorsCore.BUGGY_SAFARI_ITERATORS;
    var ITERATOR = wellKnownSymbol("iterator");
    var KEYS = "keys";
    var VALUES = "values";
    var ENTRIES = "entries";
    var returnThis = function() {
      return this;
    };
    module.exports = function(Iterable, NAME, IteratorConstructor, next, DEFAULT, IS_SET, FORCED) {
      createIteratorConstructor(IteratorConstructor, NAME, next);
      var getIterationMethod = function(KIND) {
        if (KIND === DEFAULT && defaultIterator)
          return defaultIterator;
        if (!BUGGY_SAFARI_ITERATORS && KIND in IterablePrototype)
          return IterablePrototype[KIND];
        switch (KIND) {
          case KEYS:
            return function keys() {
              return new IteratorConstructor(this, KIND);
            };
          case VALUES:
            return function values() {
              return new IteratorConstructor(this, KIND);
            };
          case ENTRIES:
            return function entries() {
              return new IteratorConstructor(this, KIND);
            };
        }
        return function() {
          return new IteratorConstructor(this);
        };
      };
      var TO_STRING_TAG = NAME + " Iterator";
      var INCORRECT_VALUES_NAME = false;
      var IterablePrototype = Iterable.prototype;
      var nativeIterator = IterablePrototype[ITERATOR] || IterablePrototype["@@iterator"] || DEFAULT && IterablePrototype[DEFAULT];
      var defaultIterator = !BUGGY_SAFARI_ITERATORS && nativeIterator || getIterationMethod(DEFAULT);
      var anyNativeIterator = NAME == "Array" ? IterablePrototype.entries || nativeIterator : nativeIterator;
      var CurrentIteratorPrototype, methods, KEY;
      if (anyNativeIterator) {
        CurrentIteratorPrototype = getPrototypeOf(anyNativeIterator.call(new Iterable()));
        if (CurrentIteratorPrototype !== Object.prototype && CurrentIteratorPrototype.next) {
          if (!IS_PURE && getPrototypeOf(CurrentIteratorPrototype) !== IteratorPrototype) {
            if (setPrototypeOf) {
              setPrototypeOf(CurrentIteratorPrototype, IteratorPrototype);
            } else if (!isCallable(CurrentIteratorPrototype[ITERATOR])) {
              defineBuiltIn(CurrentIteratorPrototype, ITERATOR, returnThis);
            }
          }
          setToStringTag(CurrentIteratorPrototype, TO_STRING_TAG, true, true);
          if (IS_PURE)
            Iterators[TO_STRING_TAG] = returnThis;
        }
      }
      if (PROPER_FUNCTION_NAME && DEFAULT == VALUES && nativeIterator && nativeIterator.name !== VALUES) {
        if (!IS_PURE && CONFIGURABLE_FUNCTION_NAME) {
          createNonEnumerableProperty(IterablePrototype, "name", VALUES);
        } else {
          INCORRECT_VALUES_NAME = true;
          defaultIterator = function values() {
            return call(nativeIterator, this);
          };
        }
      }
      if (DEFAULT) {
        methods = {
          values: getIterationMethod(VALUES),
          keys: IS_SET ? defaultIterator : getIterationMethod(KEYS),
          entries: getIterationMethod(ENTRIES)
        };
        if (FORCED)
          for (KEY in methods) {
            if (BUGGY_SAFARI_ITERATORS || INCORRECT_VALUES_NAME || !(KEY in IterablePrototype)) {
              defineBuiltIn(IterablePrototype, KEY, methods[KEY]);
            }
          }
        else
          $({ target: NAME, proto: true, forced: BUGGY_SAFARI_ITERATORS || INCORRECT_VALUES_NAME }, methods);
      }
      if ((!IS_PURE || FORCED) && IterablePrototype[ITERATOR] !== defaultIterator) {
        defineBuiltIn(IterablePrototype, ITERATOR, defaultIterator, { name: DEFAULT });
      }
      Iterators[NAME] = defaultIterator;
      return methods;
    };
  }
});

// node_modules/core-js/internals/create-iter-result-object.js
var require_create_iter_result_object = __commonJS({
  "node_modules/core-js/internals/create-iter-result-object.js"(exports, module) {
    module.exports = function(value, done) {
      return { value, done };
    };
  }
});

// node_modules/core-js/modules/es.string.iterator.js
var require_es_string_iterator = __commonJS({
  "node_modules/core-js/modules/es.string.iterator.js"() {
    "use strict";
    var charAt = require_string_multibyte().charAt;
    var toString = require_to_string();
    var InternalStateModule = require_internal_state();
    var defineIterator = require_iterator_define();
    var createIterResultObject = require_create_iter_result_object();
    var STRING_ITERATOR = "String Iterator";
    var setInternalState = InternalStateModule.set;
    var getInternalState = InternalStateModule.getterFor(STRING_ITERATOR);
    defineIterator(String, "String", function(iterated) {
      setInternalState(this, {
        type: STRING_ITERATOR,
        string: toString(iterated),
        index: 0
      });
    }, function next() {
      var state = getInternalState(this);
      var string = state.string;
      var index = state.index;
      var point;
      if (index >= string.length)
        return createIterResultObject(void 0, true);
      point = charAt(string, index);
      state.index += point.length;
      return createIterResultObject(point, false);
    });
  }
});

// node_modules/core-js/internals/url-constructor-detection.js
var require_url_constructor_detection = __commonJS({
  "node_modules/core-js/internals/url-constructor-detection.js"(exports, module) {
    var fails = require_fails();
    var wellKnownSymbol = require_well_known_symbol();
    var IS_PURE = require_is_pure();
    var ITERATOR = wellKnownSymbol("iterator");
    module.exports = !fails(function() {
      var url = new URL("b?a=1&b=2&c=3", "http://a");
      var searchParams = url.searchParams;
      var result = "";
      url.pathname = "c%20d";
      searchParams.forEach(function(value, key) {
        searchParams["delete"]("b");
        result += key + value;
      });
      return IS_PURE && !url.toJSON || !searchParams.sort || url.href !== "http://a/c%20d?a=1&c=3" || searchParams.get("c") !== "3" || String(new URLSearchParams("?a=1")) !== "a=1" || !searchParams[ITERATOR] || new URL("https://a@b").username !== "a" || new URLSearchParams(new URLSearchParams("a=b")).get("a") !== "b" || new URL("http://\u0442\u0435\u0441\u0442").host !== "xn--e1aybc" || new URL("http://a#\u0431").hash !== "#%D0%B1" || result !== "a1c3" || new URL("http://x", void 0).host !== "x";
    });
  }
});

// node_modules/core-js/internals/function-bind-context.js
var require_function_bind_context = __commonJS({
  "node_modules/core-js/internals/function-bind-context.js"(exports, module) {
    var uncurryThis = require_function_uncurry_this();
    var aCallable = require_a_callable();
    var NATIVE_BIND = require_function_bind_native();
    var bind = uncurryThis(uncurryThis.bind);
    module.exports = function(fn, that) {
      aCallable(fn);
      return that === void 0 ? fn : NATIVE_BIND ? bind(fn, that) : function() {
        return fn.apply(that, arguments);
      };
    };
  }
});

// node_modules/core-js/internals/define-built-in-accessor.js
var require_define_built_in_accessor = __commonJS({
  "node_modules/core-js/internals/define-built-in-accessor.js"(exports, module) {
    var makeBuiltIn = require_make_built_in();
    var defineProperty = require_object_define_property();
    module.exports = function(target, name, descriptor) {
      if (descriptor.get)
        makeBuiltIn(descriptor.get, name, { getter: true });
      if (descriptor.set)
        makeBuiltIn(descriptor.set, name, { setter: true });
      return defineProperty.f(target, name, descriptor);
    };
  }
});

// node_modules/core-js/internals/an-instance.js
var require_an_instance = __commonJS({
  "node_modules/core-js/internals/an-instance.js"(exports, module) {
    var isPrototypeOf = require_object_is_prototype_of();
    var $TypeError = TypeError;
    module.exports = function(it, Prototype) {
      if (isPrototypeOf(Prototype, it))
        return it;
      throw $TypeError("Incorrect invocation");
    };
  }
});

// node_modules/core-js/internals/object-assign.js
var require_object_assign = __commonJS({
  "node_modules/core-js/internals/object-assign.js"(exports, module) {
    "use strict";
    var DESCRIPTORS = require_descriptors();
    var uncurryThis = require_function_uncurry_this();
    var call = require_function_call();
    var fails = require_fails();
    var objectKeys = require_object_keys();
    var getOwnPropertySymbolsModule = require_object_get_own_property_symbols();
    var propertyIsEnumerableModule = require_object_property_is_enumerable();
    var toObject = require_to_object();
    var IndexedObject = require_indexed_object();
    var $assign = Object.assign;
    var defineProperty = Object.defineProperty;
    var concat = uncurryThis([].concat);
    module.exports = !$assign || fails(function() {
      if (DESCRIPTORS && $assign({ b: 1 }, $assign(defineProperty({}, "a", {
        enumerable: true,
        get: function() {
          defineProperty(this, "b", {
            value: 3,
            enumerable: false
          });
        }
      }), { b: 2 })).b !== 1)
        return true;
      var A = {};
      var B = {};
      var symbol = Symbol();
      var alphabet = "abcdefghijklmnopqrst";
      A[symbol] = 7;
      alphabet.split("").forEach(function(chr) {
        B[chr] = chr;
      });
      return $assign({}, A)[symbol] != 7 || objectKeys($assign({}, B)).join("") != alphabet;
    }) ? function assign(target, source) {
      var T = toObject(target);
      var argumentsLength = arguments.length;
      var index = 1;
      var getOwnPropertySymbols = getOwnPropertySymbolsModule.f;
      var propertyIsEnumerable = propertyIsEnumerableModule.f;
      while (argumentsLength > index) {
        var S = IndexedObject(arguments[index++]);
        var keys = getOwnPropertySymbols ? concat(objectKeys(S), getOwnPropertySymbols(S)) : objectKeys(S);
        var length = keys.length;
        var j = 0;
        var key;
        while (length > j) {
          key = keys[j++];
          if (!DESCRIPTORS || call(propertyIsEnumerable, S, key))
            T[key] = S[key];
        }
      }
      return T;
    } : $assign;
  }
});

// node_modules/core-js/internals/iterator-close.js
var require_iterator_close = __commonJS({
  "node_modules/core-js/internals/iterator-close.js"(exports, module) {
    var call = require_function_call();
    var anObject = require_an_object();
    var getMethod = require_get_method();
    module.exports = function(iterator, kind, value) {
      var innerResult, innerError;
      anObject(iterator);
      try {
        innerResult = getMethod(iterator, "return");
        if (!innerResult) {
          if (kind === "throw")
            throw value;
          return value;
        }
        innerResult = call(innerResult, iterator);
      } catch (error) {
        innerError = true;
        innerResult = error;
      }
      if (kind === "throw")
        throw value;
      if (innerError)
        throw innerResult;
      anObject(innerResult);
      return value;
    };
  }
});

// node_modules/core-js/internals/call-with-safe-iteration-closing.js
var require_call_with_safe_iteration_closing = __commonJS({
  "node_modules/core-js/internals/call-with-safe-iteration-closing.js"(exports, module) {
    var anObject = require_an_object();
    var iteratorClose = require_iterator_close();
    module.exports = function(iterator, fn, value, ENTRIES) {
      try {
        return ENTRIES ? fn(anObject(value)[0], value[1]) : fn(value);
      } catch (error) {
        iteratorClose(iterator, "throw", error);
      }
    };
  }
});

// node_modules/core-js/internals/is-array-iterator-method.js
var require_is_array_iterator_method = __commonJS({
  "node_modules/core-js/internals/is-array-iterator-method.js"(exports, module) {
    var wellKnownSymbol = require_well_known_symbol();
    var Iterators = require_iterators();
    var ITERATOR = wellKnownSymbol("iterator");
    var ArrayPrototype = Array.prototype;
    module.exports = function(it) {
      return it !== void 0 && (Iterators.Array === it || ArrayPrototype[ITERATOR] === it);
    };
  }
});

// node_modules/core-js/internals/is-constructor.js
var require_is_constructor = __commonJS({
  "node_modules/core-js/internals/is-constructor.js"(exports, module) {
    var uncurryThis = require_function_uncurry_this();
    var fails = require_fails();
    var isCallable = require_is_callable();
    var classof = require_classof();
    var getBuiltIn = require_get_built_in();
    var inspectSource = require_inspect_source();
    var noop = function() {
    };
    var empty = [];
    var construct = getBuiltIn("Reflect", "construct");
    var constructorRegExp = /^\s*(?:class|function)\b/;
    var exec = uncurryThis(constructorRegExp.exec);
    var INCORRECT_TO_STRING = !constructorRegExp.exec(noop);
    var isConstructorModern = function isConstructor(argument) {
      if (!isCallable(argument))
        return false;
      try {
        construct(noop, empty, argument);
        return true;
      } catch (error) {
        return false;
      }
    };
    var isConstructorLegacy = function isConstructor(argument) {
      if (!isCallable(argument))
        return false;
      switch (classof(argument)) {
        case "AsyncFunction":
        case "GeneratorFunction":
        case "AsyncGeneratorFunction":
          return false;
      }
      try {
        return INCORRECT_TO_STRING || !!exec(constructorRegExp, inspectSource(argument));
      } catch (error) {
        return true;
      }
    };
    isConstructorLegacy.sham = true;
    module.exports = !construct || fails(function() {
      var called;
      return isConstructorModern(isConstructorModern.call) || !isConstructorModern(Object) || !isConstructorModern(function() {
        called = true;
      }) || called;
    }) ? isConstructorLegacy : isConstructorModern;
  }
});

// node_modules/core-js/internals/create-property.js
var require_create_property = __commonJS({
  "node_modules/core-js/internals/create-property.js"(exports, module) {
    "use strict";
    var toPropertyKey = require_to_property_key();
    var definePropertyModule = require_object_define_property();
    var createPropertyDescriptor = require_create_property_descriptor();
    module.exports = function(object, key, value) {
      var propertyKey = toPropertyKey(key);
      if (propertyKey in object)
        definePropertyModule.f(object, propertyKey, createPropertyDescriptor(0, value));
      else
        object[propertyKey] = value;
    };
  }
});

// node_modules/core-js/internals/get-iterator-method.js
var require_get_iterator_method = __commonJS({
  "node_modules/core-js/internals/get-iterator-method.js"(exports, module) {
    var classof = require_classof();
    var getMethod = require_get_method();
    var isNullOrUndefined = require_is_null_or_undefined();
    var Iterators = require_iterators();
    var wellKnownSymbol = require_well_known_symbol();
    var ITERATOR = wellKnownSymbol("iterator");
    module.exports = function(it) {
      if (!isNullOrUndefined(it))
        return getMethod(it, ITERATOR) || getMethod(it, "@@iterator") || Iterators[classof(it)];
    };
  }
});

// node_modules/core-js/internals/get-iterator.js
var require_get_iterator = __commonJS({
  "node_modules/core-js/internals/get-iterator.js"(exports, module) {
    var call = require_function_call();
    var aCallable = require_a_callable();
    var anObject = require_an_object();
    var tryToString = require_try_to_string();
    var getIteratorMethod = require_get_iterator_method();
    var $TypeError = TypeError;
    module.exports = function(argument, usingIterator) {
      var iteratorMethod = arguments.length < 2 ? getIteratorMethod(argument) : usingIterator;
      if (aCallable(iteratorMethod))
        return anObject(call(iteratorMethod, argument));
      throw $TypeError(tryToString(argument) + " is not iterable");
    };
  }
});

// node_modules/core-js/internals/array-from.js
var require_array_from = __commonJS({
  "node_modules/core-js/internals/array-from.js"(exports, module) {
    "use strict";
    var bind = require_function_bind_context();
    var call = require_function_call();
    var toObject = require_to_object();
    var callWithSafeIterationClosing = require_call_with_safe_iteration_closing();
    var isArrayIteratorMethod = require_is_array_iterator_method();
    var isConstructor = require_is_constructor();
    var lengthOfArrayLike = require_length_of_array_like();
    var createProperty = require_create_property();
    var getIterator = require_get_iterator();
    var getIteratorMethod = require_get_iterator_method();
    var $Array = Array;
    module.exports = function from(arrayLike) {
      var O = toObject(arrayLike);
      var IS_CONSTRUCTOR = isConstructor(this);
      var argumentsLength = arguments.length;
      var mapfn = argumentsLength > 1 ? arguments[1] : void 0;
      var mapping = mapfn !== void 0;
      if (mapping)
        mapfn = bind(mapfn, argumentsLength > 2 ? arguments[2] : void 0);
      var iteratorMethod = getIteratorMethod(O);
      var index = 0;
      var length, result, step, iterator, next, value;
      if (iteratorMethod && !(this === $Array && isArrayIteratorMethod(iteratorMethod))) {
        iterator = getIterator(O, iteratorMethod);
        next = iterator.next;
        result = IS_CONSTRUCTOR ? new this() : [];
        for (; !(step = call(next, iterator)).done; index++) {
          value = mapping ? callWithSafeIterationClosing(iterator, mapfn, [step.value, index], true) : step.value;
          createProperty(result, index, value);
        }
      } else {
        length = lengthOfArrayLike(O);
        result = IS_CONSTRUCTOR ? new this(length) : $Array(length);
        for (; length > index; index++) {
          value = mapping ? mapfn(O[index], index) : O[index];
          createProperty(result, index, value);
        }
      }
      result.length = index;
      return result;
    };
  }
});

// node_modules/core-js/internals/array-slice-simple.js
var require_array_slice_simple = __commonJS({
  "node_modules/core-js/internals/array-slice-simple.js"(exports, module) {
    var toAbsoluteIndex = require_to_absolute_index();
    var lengthOfArrayLike = require_length_of_array_like();
    var createProperty = require_create_property();
    var $Array = Array;
    var max = Math.max;
    module.exports = function(O, start, end) {
      var length = lengthOfArrayLike(O);
      var k = toAbsoluteIndex(start, length);
      var fin = toAbsoluteIndex(end === void 0 ? length : end, length);
      var result = $Array(max(fin - k, 0));
      for (var n = 0; k < fin; k++, n++)
        createProperty(result, n, O[k]);
      result.length = n;
      return result;
    };
  }
});

// node_modules/core-js/internals/string-punycode-to-ascii.js
var require_string_punycode_to_ascii = __commonJS({
  "node_modules/core-js/internals/string-punycode-to-ascii.js"(exports, module) {
    "use strict";
    var uncurryThis = require_function_uncurry_this();
    var maxInt = 2147483647;
    var base = 36;
    var tMin = 1;
    var tMax = 26;
    var skew = 38;
    var damp = 700;
    var initialBias = 72;
    var initialN = 128;
    var delimiter = "-";
    var regexNonASCII = /[^\0-\u007E]/;
    var regexSeparators = /[.\u3002\uFF0E\uFF61]/g;
    var OVERFLOW_ERROR = "Overflow: input needs wider integers to process";
    var baseMinusTMin = base - tMin;
    var $RangeError = RangeError;
    var exec = uncurryThis(regexSeparators.exec);
    var floor = Math.floor;
    var fromCharCode = String.fromCharCode;
    var charCodeAt = uncurryThis("".charCodeAt);
    var join = uncurryThis([].join);
    var push = uncurryThis([].push);
    var replace = uncurryThis("".replace);
    var split = uncurryThis("".split);
    var toLowerCase = uncurryThis("".toLowerCase);
    var ucs2decode = function(string) {
      var output = [];
      var counter = 0;
      var length = string.length;
      while (counter < length) {
        var value = charCodeAt(string, counter++);
        if (value >= 55296 && value <= 56319 && counter < length) {
          var extra = charCodeAt(string, counter++);
          if ((extra & 64512) == 56320) {
            push(output, ((value & 1023) << 10) + (extra & 1023) + 65536);
          } else {
            push(output, value);
            counter--;
          }
        } else {
          push(output, value);
        }
      }
      return output;
    };
    var digitToBasic = function(digit) {
      return digit + 22 + 75 * (digit < 26);
    };
    var adapt = function(delta, numPoints, firstTime) {
      var k = 0;
      delta = firstTime ? floor(delta / damp) : delta >> 1;
      delta += floor(delta / numPoints);
      while (delta > baseMinusTMin * tMax >> 1) {
        delta = floor(delta / baseMinusTMin);
        k += base;
      }
      return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
    };
    var encode = function(input) {
      var output = [];
      input = ucs2decode(input);
      var inputLength = input.length;
      var n = initialN;
      var delta = 0;
      var bias = initialBias;
      var i, currentValue;
      for (i = 0; i < input.length; i++) {
        currentValue = input[i];
        if (currentValue < 128) {
          push(output, fromCharCode(currentValue));
        }
      }
      var basicLength = output.length;
      var handledCPCount = basicLength;
      if (basicLength) {
        push(output, delimiter);
      }
      while (handledCPCount < inputLength) {
        var m = maxInt;
        for (i = 0; i < input.length; i++) {
          currentValue = input[i];
          if (currentValue >= n && currentValue < m) {
            m = currentValue;
          }
        }
        var handledCPCountPlusOne = handledCPCount + 1;
        if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
          throw $RangeError(OVERFLOW_ERROR);
        }
        delta += (m - n) * handledCPCountPlusOne;
        n = m;
        for (i = 0; i < input.length; i++) {
          currentValue = input[i];
          if (currentValue < n && ++delta > maxInt) {
            throw $RangeError(OVERFLOW_ERROR);
          }
          if (currentValue == n) {
            var q = delta;
            var k = base;
            while (true) {
              var t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
              if (q < t)
                break;
              var qMinusT = q - t;
              var baseMinusT = base - t;
              push(output, fromCharCode(digitToBasic(t + qMinusT % baseMinusT)));
              q = floor(qMinusT / baseMinusT);
              k += base;
            }
            push(output, fromCharCode(digitToBasic(q)));
            bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
            delta = 0;
            handledCPCount++;
          }
        }
        delta++;
        n++;
      }
      return join(output, "");
    };
    module.exports = function(input) {
      var encoded = [];
      var labels = split(replace(toLowerCase(input), regexSeparators, "."), ".");
      var i, label;
      for (i = 0; i < labels.length; i++) {
        label = labels[i];
        push(encoded, exec(regexNonASCII, label) ? "xn--" + encode(label) : label);
      }
      return join(encoded, ".");
    };
  }
});

// node_modules/core-js/internals/validate-arguments-length.js
var require_validate_arguments_length = __commonJS({
  "node_modules/core-js/internals/validate-arguments-length.js"(exports, module) {
    var $TypeError = TypeError;
    module.exports = function(passed, required) {
      if (passed < required)
        throw $TypeError("Not enough arguments");
      return passed;
    };
  }
});

// node_modules/core-js/internals/add-to-unscopables.js
var require_add_to_unscopables = __commonJS({
  "node_modules/core-js/internals/add-to-unscopables.js"(exports, module) {
    var wellKnownSymbol = require_well_known_symbol();
    var create = require_object_create();
    var defineProperty = require_object_define_property().f;
    var UNSCOPABLES = wellKnownSymbol("unscopables");
    var ArrayPrototype = Array.prototype;
    if (ArrayPrototype[UNSCOPABLES] == void 0) {
      defineProperty(ArrayPrototype, UNSCOPABLES, {
        configurable: true,
        value: create(null)
      });
    }
    module.exports = function(key) {
      ArrayPrototype[UNSCOPABLES][key] = true;
    };
  }
});

// node_modules/core-js/modules/es.array.iterator.js
var require_es_array_iterator = __commonJS({
  "node_modules/core-js/modules/es.array.iterator.js"(exports, module) {
    "use strict";
    var toIndexedObject = require_to_indexed_object();
    var addToUnscopables = require_add_to_unscopables();
    var Iterators = require_iterators();
    var InternalStateModule = require_internal_state();
    var defineProperty = require_object_define_property().f;
    var defineIterator = require_iterator_define();
    var createIterResultObject = require_create_iter_result_object();
    var IS_PURE = require_is_pure();
    var DESCRIPTORS = require_descriptors();
    var ARRAY_ITERATOR = "Array Iterator";
    var setInternalState = InternalStateModule.set;
    var getInternalState = InternalStateModule.getterFor(ARRAY_ITERATOR);
    module.exports = defineIterator(Array, "Array", function(iterated, kind) {
      setInternalState(this, {
        type: ARRAY_ITERATOR,
        target: toIndexedObject(iterated),
        index: 0,
        kind
      });
    }, function() {
      var state = getInternalState(this);
      var target = state.target;
      var kind = state.kind;
      var index = state.index++;
      if (!target || index >= target.length) {
        state.target = void 0;
        return createIterResultObject(void 0, true);
      }
      if (kind == "keys")
        return createIterResultObject(index, false);
      if (kind == "values")
        return createIterResultObject(target[index], false);
      return createIterResultObject([index, target[index]], false);
    }, "values");
    var values = Iterators.Arguments = Iterators.Array;
    addToUnscopables("keys");
    addToUnscopables("values");
    addToUnscopables("entries");
    if (!IS_PURE && DESCRIPTORS && values.name !== "values")
      try {
        defineProperty(values, "name", { value: "values" });
      } catch (error) {
      }
  }
});

// node_modules/core-js/internals/define-built-ins.js
var require_define_built_ins = __commonJS({
  "node_modules/core-js/internals/define-built-ins.js"(exports, module) {
    var defineBuiltIn = require_define_built_in();
    module.exports = function(target, src, options) {
      for (var key in src)
        defineBuiltIn(target, key, src[key], options);
      return target;
    };
  }
});

// node_modules/core-js/internals/array-sort.js
var require_array_sort = __commonJS({
  "node_modules/core-js/internals/array-sort.js"(exports, module) {
    var arraySlice = require_array_slice_simple();
    var floor = Math.floor;
    var mergeSort = function(array, comparefn) {
      var length = array.length;
      var middle = floor(length / 2);
      return length < 8 ? insertionSort(array, comparefn) : merge(
        array,
        mergeSort(arraySlice(array, 0, middle), comparefn),
        mergeSort(arraySlice(array, middle), comparefn),
        comparefn
      );
    };
    var insertionSort = function(array, comparefn) {
      var length = array.length;
      var i = 1;
      var element, j;
      while (i < length) {
        j = i;
        element = array[i];
        while (j && comparefn(array[j - 1], element) > 0) {
          array[j] = array[--j];
        }
        if (j !== i++)
          array[j] = element;
      }
      return array;
    };
    var merge = function(array, left, right, comparefn) {
      var llength = left.length;
      var rlength = right.length;
      var lindex = 0;
      var rindex = 0;
      while (lindex < llength || rindex < rlength) {
        array[lindex + rindex] = lindex < llength && rindex < rlength ? comparefn(left[lindex], right[rindex]) <= 0 ? left[lindex++] : right[rindex++] : lindex < llength ? left[lindex++] : right[rindex++];
      }
      return array;
    };
    module.exports = mergeSort;
  }
});

// node_modules/core-js/modules/web.url-search-params.constructor.js
var require_web_url_search_params_constructor = __commonJS({
  "node_modules/core-js/modules/web.url-search-params.constructor.js"(exports, module) {
    "use strict";
    require_es_array_iterator();
    var $ = require_export();
    var global2 = require_global();
    var call = require_function_call();
    var uncurryThis = require_function_uncurry_this();
    var DESCRIPTORS = require_descriptors();
    var USE_NATIVE_URL = require_url_constructor_detection();
    var defineBuiltIn = require_define_built_in();
    var defineBuiltIns = require_define_built_ins();
    var setToStringTag = require_set_to_string_tag();
    var createIteratorConstructor = require_iterator_create_constructor();
    var InternalStateModule = require_internal_state();
    var anInstance = require_an_instance();
    var isCallable = require_is_callable();
    var hasOwn = require_has_own_property();
    var bind = require_function_bind_context();
    var classof = require_classof();
    var anObject = require_an_object();
    var isObject2 = require_is_object();
    var $toString = require_to_string();
    var create = require_object_create();
    var createPropertyDescriptor = require_create_property_descriptor();
    var getIterator = require_get_iterator();
    var getIteratorMethod = require_get_iterator_method();
    var validateArgumentsLength = require_validate_arguments_length();
    var wellKnownSymbol = require_well_known_symbol();
    var arraySort = require_array_sort();
    var ITERATOR = wellKnownSymbol("iterator");
    var URL_SEARCH_PARAMS = "URLSearchParams";
    var URL_SEARCH_PARAMS_ITERATOR = URL_SEARCH_PARAMS + "Iterator";
    var setInternalState = InternalStateModule.set;
    var getInternalParamsState = InternalStateModule.getterFor(URL_SEARCH_PARAMS);
    var getInternalIteratorState = InternalStateModule.getterFor(URL_SEARCH_PARAMS_ITERATOR);
    var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    var safeGetBuiltIn = function(name) {
      if (!DESCRIPTORS)
        return global2[name];
      var descriptor = getOwnPropertyDescriptor(global2, name);
      return descriptor && descriptor.value;
    };
    var nativeFetch = safeGetBuiltIn("fetch");
    var NativeRequest = safeGetBuiltIn("Request");
    var Headers = safeGetBuiltIn("Headers");
    var RequestPrototype = NativeRequest && NativeRequest.prototype;
    var HeadersPrototype = Headers && Headers.prototype;
    var RegExp2 = global2.RegExp;
    var TypeError2 = global2.TypeError;
    var decodeURIComponent2 = global2.decodeURIComponent;
    var encodeURIComponent2 = global2.encodeURIComponent;
    var charAt = uncurryThis("".charAt);
    var join = uncurryThis([].join);
    var push = uncurryThis([].push);
    var replace = uncurryThis("".replace);
    var shift = uncurryThis([].shift);
    var splice = uncurryThis([].splice);
    var split = uncurryThis("".split);
    var stringSlice = uncurryThis("".slice);
    var plus = /\+/g;
    var sequences = Array(4);
    var percentSequence = function(bytes) {
      return sequences[bytes - 1] || (sequences[bytes - 1] = RegExp2("((?:%[\\da-f]{2}){" + bytes + "})", "gi"));
    };
    var percentDecode = function(sequence) {
      try {
        return decodeURIComponent2(sequence);
      } catch (error) {
        return sequence;
      }
    };
    var deserialize = function(it) {
      var result = replace(it, plus, " ");
      var bytes = 4;
      try {
        return decodeURIComponent2(result);
      } catch (error) {
        while (bytes) {
          result = replace(result, percentSequence(bytes--), percentDecode);
        }
        return result;
      }
    };
    var find = /[!'()~]|%20/g;
    var replacements = {
      "!": "%21",
      "'": "%27",
      "(": "%28",
      ")": "%29",
      "~": "%7E",
      "%20": "+"
    };
    var replacer = function(match) {
      return replacements[match];
    };
    var serialize = function(it) {
      return replace(encodeURIComponent2(it), find, replacer);
    };
    var URLSearchParamsIterator = createIteratorConstructor(function Iterator(params, kind) {
      setInternalState(this, {
        type: URL_SEARCH_PARAMS_ITERATOR,
        iterator: getIterator(getInternalParamsState(params).entries),
        kind
      });
    }, "Iterator", function next() {
      var state = getInternalIteratorState(this);
      var kind = state.kind;
      var step = state.iterator.next();
      var entry = step.value;
      if (!step.done) {
        step.value = kind === "keys" ? entry.key : kind === "values" ? entry.value : [entry.key, entry.value];
      }
      return step;
    }, true);
    var URLSearchParamsState = function(init2) {
      this.entries = [];
      this.url = null;
      if (init2 !== void 0) {
        if (isObject2(init2))
          this.parseObject(init2);
        else
          this.parseQuery(typeof init2 == "string" ? charAt(init2, 0) === "?" ? stringSlice(init2, 1) : init2 : $toString(init2));
      }
    };
    URLSearchParamsState.prototype = {
      type: URL_SEARCH_PARAMS,
      bindURL: function(url) {
        this.url = url;
        this.update();
      },
      parseObject: function(object) {
        var iteratorMethod = getIteratorMethod(object);
        var iterator, next, step, entryIterator, entryNext, first, second;
        if (iteratorMethod) {
          iterator = getIterator(object, iteratorMethod);
          next = iterator.next;
          while (!(step = call(next, iterator)).done) {
            entryIterator = getIterator(anObject(step.value));
            entryNext = entryIterator.next;
            if ((first = call(entryNext, entryIterator)).done || (second = call(entryNext, entryIterator)).done || !call(entryNext, entryIterator).done)
              throw TypeError2("Expected sequence with length 2");
            push(this.entries, { key: $toString(first.value), value: $toString(second.value) });
          }
        } else
          for (var key in object)
            if (hasOwn(object, key)) {
              push(this.entries, { key, value: $toString(object[key]) });
            }
      },
      parseQuery: function(query) {
        if (query) {
          var attributes = split(query, "&");
          var index = 0;
          var attribute, entry;
          while (index < attributes.length) {
            attribute = attributes[index++];
            if (attribute.length) {
              entry = split(attribute, "=");
              push(this.entries, {
                key: deserialize(shift(entry)),
                value: deserialize(join(entry, "="))
              });
            }
          }
        }
      },
      serialize: function() {
        var entries = this.entries;
        var result = [];
        var index = 0;
        var entry;
        while (index < entries.length) {
          entry = entries[index++];
          push(result, serialize(entry.key) + "=" + serialize(entry.value));
        }
        return join(result, "&");
      },
      update: function() {
        this.entries.length = 0;
        this.parseQuery(this.url.query);
      },
      updateURL: function() {
        if (this.url)
          this.url.update();
      }
    };
    var URLSearchParamsConstructor = function URLSearchParams2() {
      anInstance(this, URLSearchParamsPrototype);
      var init2 = arguments.length > 0 ? arguments[0] : void 0;
      setInternalState(this, new URLSearchParamsState(init2));
    };
    var URLSearchParamsPrototype = URLSearchParamsConstructor.prototype;
    defineBuiltIns(URLSearchParamsPrototype, {
      append: function append(name, value) {
        validateArgumentsLength(arguments.length, 2);
        var state = getInternalParamsState(this);
        push(state.entries, { key: $toString(name), value: $toString(value) });
        state.updateURL();
      },
      "delete": function(name) {
        validateArgumentsLength(arguments.length, 1);
        var state = getInternalParamsState(this);
        var entries = state.entries;
        var key = $toString(name);
        var index = 0;
        while (index < entries.length) {
          if (entries[index].key === key)
            splice(entries, index, 1);
          else
            index++;
        }
        state.updateURL();
      },
      get: function get(name) {
        validateArgumentsLength(arguments.length, 1);
        var entries = getInternalParamsState(this).entries;
        var key = $toString(name);
        var index = 0;
        for (; index < entries.length; index++) {
          if (entries[index].key === key)
            return entries[index].value;
        }
        return null;
      },
      getAll: function getAll(name) {
        validateArgumentsLength(arguments.length, 1);
        var entries = getInternalParamsState(this).entries;
        var key = $toString(name);
        var result = [];
        var index = 0;
        for (; index < entries.length; index++) {
          if (entries[index].key === key)
            push(result, entries[index].value);
        }
        return result;
      },
      has: function has(name) {
        validateArgumentsLength(arguments.length, 1);
        var entries = getInternalParamsState(this).entries;
        var key = $toString(name);
        var index = 0;
        while (index < entries.length) {
          if (entries[index++].key === key)
            return true;
        }
        return false;
      },
      set: function set(name, value) {
        validateArgumentsLength(arguments.length, 1);
        var state = getInternalParamsState(this);
        var entries = state.entries;
        var found = false;
        var key = $toString(name);
        var val = $toString(value);
        var index = 0;
        var entry;
        for (; index < entries.length; index++) {
          entry = entries[index];
          if (entry.key === key) {
            if (found)
              splice(entries, index--, 1);
            else {
              found = true;
              entry.value = val;
            }
          }
        }
        if (!found)
          push(entries, { key, value: val });
        state.updateURL();
      },
      sort: function sort() {
        var state = getInternalParamsState(this);
        arraySort(state.entries, function(a, b) {
          return a.key > b.key ? 1 : -1;
        });
        state.updateURL();
      },
      forEach: function forEach(callback) {
        var entries = getInternalParamsState(this).entries;
        var boundFunction = bind(callback, arguments.length > 1 ? arguments[1] : void 0);
        var index = 0;
        var entry;
        while (index < entries.length) {
          entry = entries[index++];
          boundFunction(entry.value, entry.key, this);
        }
      },
      keys: function keys() {
        return new URLSearchParamsIterator(this, "keys");
      },
      values: function values() {
        return new URLSearchParamsIterator(this, "values");
      },
      entries: function entries() {
        return new URLSearchParamsIterator(this, "entries");
      }
    }, { enumerable: true });
    defineBuiltIn(URLSearchParamsPrototype, ITERATOR, URLSearchParamsPrototype.entries, { name: "entries" });
    defineBuiltIn(URLSearchParamsPrototype, "toString", function toString() {
      return getInternalParamsState(this).serialize();
    }, { enumerable: true });
    setToStringTag(URLSearchParamsConstructor, URL_SEARCH_PARAMS);
    $({ global: true, constructor: true, forced: !USE_NATIVE_URL }, {
      URLSearchParams: URLSearchParamsConstructor
    });
    if (!USE_NATIVE_URL && isCallable(Headers)) {
      headersHas = uncurryThis(HeadersPrototype.has);
      headersSet = uncurryThis(HeadersPrototype.set);
      wrapRequestOptions = function(init2) {
        if (isObject2(init2)) {
          var body = init2.body;
          var headers;
          if (classof(body) === URL_SEARCH_PARAMS) {
            headers = init2.headers ? new Headers(init2.headers) : new Headers();
            if (!headersHas(headers, "content-type")) {
              headersSet(headers, "content-type", "application/x-www-form-urlencoded;charset=UTF-8");
            }
            return create(init2, {
              body: createPropertyDescriptor(0, $toString(body)),
              headers: createPropertyDescriptor(0, headers)
            });
          }
        }
        return init2;
      };
      if (isCallable(nativeFetch)) {
        $({ global: true, enumerable: true, dontCallGetSet: true, forced: true }, {
          fetch: function fetch(input) {
            return nativeFetch(input, arguments.length > 1 ? wrapRequestOptions(arguments[1]) : {});
          }
        });
      }
      if (isCallable(NativeRequest)) {
        RequestConstructor = function Request(input) {
          anInstance(this, RequestPrototype);
          return new NativeRequest(input, arguments.length > 1 ? wrapRequestOptions(arguments[1]) : {});
        };
        RequestPrototype.constructor = RequestConstructor;
        RequestConstructor.prototype = RequestPrototype;
        $({ global: true, constructor: true, dontCallGetSet: true, forced: true }, {
          Request: RequestConstructor
        });
      }
    }
    var headersHas;
    var headersSet;
    var wrapRequestOptions;
    var RequestConstructor;
    module.exports = {
      URLSearchParams: URLSearchParamsConstructor,
      getState: getInternalParamsState
    };
  }
});

// node_modules/core-js/modules/web.url.constructor.js
var require_web_url_constructor = __commonJS({
  "node_modules/core-js/modules/web.url.constructor.js"() {
    "use strict";
    require_es_string_iterator();
    var $ = require_export();
    var DESCRIPTORS = require_descriptors();
    var USE_NATIVE_URL = require_url_constructor_detection();
    var global2 = require_global();
    var bind = require_function_bind_context();
    var uncurryThis = require_function_uncurry_this();
    var defineBuiltIn = require_define_built_in();
    var defineBuiltInAccessor = require_define_built_in_accessor();
    var anInstance = require_an_instance();
    var hasOwn = require_has_own_property();
    var assign = require_object_assign();
    var arrayFrom = require_array_from();
    var arraySlice = require_array_slice_simple();
    var codeAt = require_string_multibyte().codeAt;
    var toASCII = require_string_punycode_to_ascii();
    var $toString = require_to_string();
    var setToStringTag = require_set_to_string_tag();
    var validateArgumentsLength = require_validate_arguments_length();
    var URLSearchParamsModule = require_web_url_search_params_constructor();
    var InternalStateModule = require_internal_state();
    var setInternalState = InternalStateModule.set;
    var getInternalURLState = InternalStateModule.getterFor("URL");
    var URLSearchParams2 = URLSearchParamsModule.URLSearchParams;
    var getInternalSearchParamsState = URLSearchParamsModule.getState;
    var NativeURL = global2.URL;
    var TypeError2 = global2.TypeError;
    var parseInt2 = global2.parseInt;
    var floor = Math.floor;
    var pow = Math.pow;
    var charAt = uncurryThis("".charAt);
    var exec = uncurryThis(/./.exec);
    var join = uncurryThis([].join);
    var numberToString = uncurryThis(1 .toString);
    var pop = uncurryThis([].pop);
    var push = uncurryThis([].push);
    var replace = uncurryThis("".replace);
    var shift = uncurryThis([].shift);
    var split = uncurryThis("".split);
    var stringSlice = uncurryThis("".slice);
    var toLowerCase = uncurryThis("".toLowerCase);
    var unshift = uncurryThis([].unshift);
    var INVALID_AUTHORITY = "Invalid authority";
    var INVALID_SCHEME = "Invalid scheme";
    var INVALID_HOST = "Invalid host";
    var INVALID_PORT = "Invalid port";
    var ALPHA = /[a-z]/i;
    var ALPHANUMERIC = /[\d+-.a-z]/i;
    var DIGIT = /\d/;
    var HEX_START = /^0x/i;
    var OCT = /^[0-7]+$/;
    var DEC = /^\d+$/;
    var HEX = /^[\da-f]+$/i;
    var FORBIDDEN_HOST_CODE_POINT = /[\0\t\n\r #%/:<>?@[\\\]^|]/;
    var FORBIDDEN_HOST_CODE_POINT_EXCLUDING_PERCENT = /[\0\t\n\r #/:<>?@[\\\]^|]/;
    var LEADING_AND_TRAILING_C0_CONTROL_OR_SPACE = /^[\u0000-\u0020]+|[\u0000-\u0020]+$/g;
    var TAB_AND_NEW_LINE = /[\t\n\r]/g;
    var EOF;
    var parseIPv4 = function(input) {
      var parts = split(input, ".");
      var partsLength, numbers, index, part, radix, number, ipv4;
      if (parts.length && parts[parts.length - 1] == "") {
        parts.length--;
      }
      partsLength = parts.length;
      if (partsLength > 4)
        return input;
      numbers = [];
      for (index = 0; index < partsLength; index++) {
        part = parts[index];
        if (part == "")
          return input;
        radix = 10;
        if (part.length > 1 && charAt(part, 0) == "0") {
          radix = exec(HEX_START, part) ? 16 : 8;
          part = stringSlice(part, radix == 8 ? 1 : 2);
        }
        if (part === "") {
          number = 0;
        } else {
          if (!exec(radix == 10 ? DEC : radix == 8 ? OCT : HEX, part))
            return input;
          number = parseInt2(part, radix);
        }
        push(numbers, number);
      }
      for (index = 0; index < partsLength; index++) {
        number = numbers[index];
        if (index == partsLength - 1) {
          if (number >= pow(256, 5 - partsLength))
            return null;
        } else if (number > 255)
          return null;
      }
      ipv4 = pop(numbers);
      for (index = 0; index < numbers.length; index++) {
        ipv4 += numbers[index] * pow(256, 3 - index);
      }
      return ipv4;
    };
    var parseIPv6 = function(input) {
      var address = [0, 0, 0, 0, 0, 0, 0, 0];
      var pieceIndex = 0;
      var compress = null;
      var pointer = 0;
      var value, length, numbersSeen, ipv4Piece, number, swaps, swap;
      var chr = function() {
        return charAt(input, pointer);
      };
      if (chr() == ":") {
        if (charAt(input, 1) != ":")
          return;
        pointer += 2;
        pieceIndex++;
        compress = pieceIndex;
      }
      while (chr()) {
        if (pieceIndex == 8)
          return;
        if (chr() == ":") {
          if (compress !== null)
            return;
          pointer++;
          pieceIndex++;
          compress = pieceIndex;
          continue;
        }
        value = length = 0;
        while (length < 4 && exec(HEX, chr())) {
          value = value * 16 + parseInt2(chr(), 16);
          pointer++;
          length++;
        }
        if (chr() == ".") {
          if (length == 0)
            return;
          pointer -= length;
          if (pieceIndex > 6)
            return;
          numbersSeen = 0;
          while (chr()) {
            ipv4Piece = null;
            if (numbersSeen > 0) {
              if (chr() == "." && numbersSeen < 4)
                pointer++;
              else
                return;
            }
            if (!exec(DIGIT, chr()))
              return;
            while (exec(DIGIT, chr())) {
              number = parseInt2(chr(), 10);
              if (ipv4Piece === null)
                ipv4Piece = number;
              else if (ipv4Piece == 0)
                return;
              else
                ipv4Piece = ipv4Piece * 10 + number;
              if (ipv4Piece > 255)
                return;
              pointer++;
            }
            address[pieceIndex] = address[pieceIndex] * 256 + ipv4Piece;
            numbersSeen++;
            if (numbersSeen == 2 || numbersSeen == 4)
              pieceIndex++;
          }
          if (numbersSeen != 4)
            return;
          break;
        } else if (chr() == ":") {
          pointer++;
          if (!chr())
            return;
        } else if (chr())
          return;
        address[pieceIndex++] = value;
      }
      if (compress !== null) {
        swaps = pieceIndex - compress;
        pieceIndex = 7;
        while (pieceIndex != 0 && swaps > 0) {
          swap = address[pieceIndex];
          address[pieceIndex--] = address[compress + swaps - 1];
          address[compress + --swaps] = swap;
        }
      } else if (pieceIndex != 8)
        return;
      return address;
    };
    var findLongestZeroSequence = function(ipv6) {
      var maxIndex = null;
      var maxLength = 1;
      var currStart = null;
      var currLength = 0;
      var index = 0;
      for (; index < 8; index++) {
        if (ipv6[index] !== 0) {
          if (currLength > maxLength) {
            maxIndex = currStart;
            maxLength = currLength;
          }
          currStart = null;
          currLength = 0;
        } else {
          if (currStart === null)
            currStart = index;
          ++currLength;
        }
      }
      if (currLength > maxLength) {
        maxIndex = currStart;
        maxLength = currLength;
      }
      return maxIndex;
    };
    var serializeHost = function(host) {
      var result, index, compress, ignore0;
      if (typeof host == "number") {
        result = [];
        for (index = 0; index < 4; index++) {
          unshift(result, host % 256);
          host = floor(host / 256);
        }
        return join(result, ".");
      } else if (typeof host == "object") {
        result = "";
        compress = findLongestZeroSequence(host);
        for (index = 0; index < 8; index++) {
          if (ignore0 && host[index] === 0)
            continue;
          if (ignore0)
            ignore0 = false;
          if (compress === index) {
            result += index ? ":" : "::";
            ignore0 = true;
          } else {
            result += numberToString(host[index], 16);
            if (index < 7)
              result += ":";
          }
        }
        return "[" + result + "]";
      }
      return host;
    };
    var C0ControlPercentEncodeSet = {};
    var fragmentPercentEncodeSet = assign({}, C0ControlPercentEncodeSet, {
      " ": 1,
      '"': 1,
      "<": 1,
      ">": 1,
      "`": 1
    });
    var pathPercentEncodeSet = assign({}, fragmentPercentEncodeSet, {
      "#": 1,
      "?": 1,
      "{": 1,
      "}": 1
    });
    var userinfoPercentEncodeSet = assign({}, pathPercentEncodeSet, {
      "/": 1,
      ":": 1,
      ";": 1,
      "=": 1,
      "@": 1,
      "[": 1,
      "\\": 1,
      "]": 1,
      "^": 1,
      "|": 1
    });
    var percentEncode = function(chr, set) {
      var code = codeAt(chr, 0);
      return code > 32 && code < 127 && !hasOwn(set, chr) ? chr : encodeURIComponent(chr);
    };
    var specialSchemes = {
      ftp: 21,
      file: null,
      http: 80,
      https: 443,
      ws: 80,
      wss: 443
    };
    var isWindowsDriveLetter = function(string, normalized) {
      var second;
      return string.length == 2 && exec(ALPHA, charAt(string, 0)) && ((second = charAt(string, 1)) == ":" || !normalized && second == "|");
    };
    var startsWithWindowsDriveLetter = function(string) {
      var third;
      return string.length > 1 && isWindowsDriveLetter(stringSlice(string, 0, 2)) && (string.length == 2 || ((third = charAt(string, 2)) === "/" || third === "\\" || third === "?" || third === "#"));
    };
    var isSingleDot = function(segment) {
      return segment === "." || toLowerCase(segment) === "%2e";
    };
    var isDoubleDot = function(segment) {
      segment = toLowerCase(segment);
      return segment === ".." || segment === "%2e." || segment === ".%2e" || segment === "%2e%2e";
    };
    var SCHEME_START = {};
    var SCHEME = {};
    var NO_SCHEME = {};
    var SPECIAL_RELATIVE_OR_AUTHORITY = {};
    var PATH_OR_AUTHORITY = {};
    var RELATIVE = {};
    var RELATIVE_SLASH = {};
    var SPECIAL_AUTHORITY_SLASHES = {};
    var SPECIAL_AUTHORITY_IGNORE_SLASHES = {};
    var AUTHORITY = {};
    var HOST = {};
    var HOSTNAME = {};
    var PORT = {};
    var FILE = {};
    var FILE_SLASH = {};
    var FILE_HOST = {};
    var PATH_START = {};
    var PATH = {};
    var CANNOT_BE_A_BASE_URL_PATH = {};
    var QUERY = {};
    var FRAGMENT = {};
    var URLState = function(url, isBase, base) {
      var urlString = $toString(url);
      var baseState, failure, searchParams;
      if (isBase) {
        failure = this.parse(urlString);
        if (failure)
          throw TypeError2(failure);
        this.searchParams = null;
      } else {
        if (base !== void 0)
          baseState = new URLState(base, true);
        failure = this.parse(urlString, null, baseState);
        if (failure)
          throw TypeError2(failure);
        searchParams = getInternalSearchParamsState(new URLSearchParams2());
        searchParams.bindURL(this);
        this.searchParams = searchParams;
      }
    };
    URLState.prototype = {
      type: "URL",
      parse: function(input, stateOverride, base) {
        var url = this;
        var state = stateOverride || SCHEME_START;
        var pointer = 0;
        var buffer = "";
        var seenAt = false;
        var seenBracket = false;
        var seenPasswordToken = false;
        var codePoints, chr, bufferCodePoints, failure;
        input = $toString(input);
        if (!stateOverride) {
          url.scheme = "";
          url.username = "";
          url.password = "";
          url.host = null;
          url.port = null;
          url.path = [];
          url.query = null;
          url.fragment = null;
          url.cannotBeABaseURL = false;
          input = replace(input, LEADING_AND_TRAILING_C0_CONTROL_OR_SPACE, "");
        }
        input = replace(input, TAB_AND_NEW_LINE, "");
        codePoints = arrayFrom(input);
        while (pointer <= codePoints.length) {
          chr = codePoints[pointer];
          switch (state) {
            case SCHEME_START:
              if (chr && exec(ALPHA, chr)) {
                buffer += toLowerCase(chr);
                state = SCHEME;
              } else if (!stateOverride) {
                state = NO_SCHEME;
                continue;
              } else
                return INVALID_SCHEME;
              break;
            case SCHEME:
              if (chr && (exec(ALPHANUMERIC, chr) || chr == "+" || chr == "-" || chr == ".")) {
                buffer += toLowerCase(chr);
              } else if (chr == ":") {
                if (stateOverride && (url.isSpecial() != hasOwn(specialSchemes, buffer) || buffer == "file" && (url.includesCredentials() || url.port !== null) || url.scheme == "file" && !url.host))
                  return;
                url.scheme = buffer;
                if (stateOverride) {
                  if (url.isSpecial() && specialSchemes[url.scheme] == url.port)
                    url.port = null;
                  return;
                }
                buffer = "";
                if (url.scheme == "file") {
                  state = FILE;
                } else if (url.isSpecial() && base && base.scheme == url.scheme) {
                  state = SPECIAL_RELATIVE_OR_AUTHORITY;
                } else if (url.isSpecial()) {
                  state = SPECIAL_AUTHORITY_SLASHES;
                } else if (codePoints[pointer + 1] == "/") {
                  state = PATH_OR_AUTHORITY;
                  pointer++;
                } else {
                  url.cannotBeABaseURL = true;
                  push(url.path, "");
                  state = CANNOT_BE_A_BASE_URL_PATH;
                }
              } else if (!stateOverride) {
                buffer = "";
                state = NO_SCHEME;
                pointer = 0;
                continue;
              } else
                return INVALID_SCHEME;
              break;
            case NO_SCHEME:
              if (!base || base.cannotBeABaseURL && chr != "#")
                return INVALID_SCHEME;
              if (base.cannotBeABaseURL && chr == "#") {
                url.scheme = base.scheme;
                url.path = arraySlice(base.path);
                url.query = base.query;
                url.fragment = "";
                url.cannotBeABaseURL = true;
                state = FRAGMENT;
                break;
              }
              state = base.scheme == "file" ? FILE : RELATIVE;
              continue;
            case SPECIAL_RELATIVE_OR_AUTHORITY:
              if (chr == "/" && codePoints[pointer + 1] == "/") {
                state = SPECIAL_AUTHORITY_IGNORE_SLASHES;
                pointer++;
              } else {
                state = RELATIVE;
                continue;
              }
              break;
            case PATH_OR_AUTHORITY:
              if (chr == "/") {
                state = AUTHORITY;
                break;
              } else {
                state = PATH;
                continue;
              }
            case RELATIVE:
              url.scheme = base.scheme;
              if (chr == EOF) {
                url.username = base.username;
                url.password = base.password;
                url.host = base.host;
                url.port = base.port;
                url.path = arraySlice(base.path);
                url.query = base.query;
              } else if (chr == "/" || chr == "\\" && url.isSpecial()) {
                state = RELATIVE_SLASH;
              } else if (chr == "?") {
                url.username = base.username;
                url.password = base.password;
                url.host = base.host;
                url.port = base.port;
                url.path = arraySlice(base.path);
                url.query = "";
                state = QUERY;
              } else if (chr == "#") {
                url.username = base.username;
                url.password = base.password;
                url.host = base.host;
                url.port = base.port;
                url.path = arraySlice(base.path);
                url.query = base.query;
                url.fragment = "";
                state = FRAGMENT;
              } else {
                url.username = base.username;
                url.password = base.password;
                url.host = base.host;
                url.port = base.port;
                url.path = arraySlice(base.path);
                url.path.length--;
                state = PATH;
                continue;
              }
              break;
            case RELATIVE_SLASH:
              if (url.isSpecial() && (chr == "/" || chr == "\\")) {
                state = SPECIAL_AUTHORITY_IGNORE_SLASHES;
              } else if (chr == "/") {
                state = AUTHORITY;
              } else {
                url.username = base.username;
                url.password = base.password;
                url.host = base.host;
                url.port = base.port;
                state = PATH;
                continue;
              }
              break;
            case SPECIAL_AUTHORITY_SLASHES:
              state = SPECIAL_AUTHORITY_IGNORE_SLASHES;
              if (chr != "/" || charAt(buffer, pointer + 1) != "/")
                continue;
              pointer++;
              break;
            case SPECIAL_AUTHORITY_IGNORE_SLASHES:
              if (chr != "/" && chr != "\\") {
                state = AUTHORITY;
                continue;
              }
              break;
            case AUTHORITY:
              if (chr == "@") {
                if (seenAt)
                  buffer = "%40" + buffer;
                seenAt = true;
                bufferCodePoints = arrayFrom(buffer);
                for (var i = 0; i < bufferCodePoints.length; i++) {
                  var codePoint = bufferCodePoints[i];
                  if (codePoint == ":" && !seenPasswordToken) {
                    seenPasswordToken = true;
                    continue;
                  }
                  var encodedCodePoints = percentEncode(codePoint, userinfoPercentEncodeSet);
                  if (seenPasswordToken)
                    url.password += encodedCodePoints;
                  else
                    url.username += encodedCodePoints;
                }
                buffer = "";
              } else if (chr == EOF || chr == "/" || chr == "?" || chr == "#" || chr == "\\" && url.isSpecial()) {
                if (seenAt && buffer == "")
                  return INVALID_AUTHORITY;
                pointer -= arrayFrom(buffer).length + 1;
                buffer = "";
                state = HOST;
              } else
                buffer += chr;
              break;
            case HOST:
            case HOSTNAME:
              if (stateOverride && url.scheme == "file") {
                state = FILE_HOST;
                continue;
              } else if (chr == ":" && !seenBracket) {
                if (buffer == "")
                  return INVALID_HOST;
                failure = url.parseHost(buffer);
                if (failure)
                  return failure;
                buffer = "";
                state = PORT;
                if (stateOverride == HOSTNAME)
                  return;
              } else if (chr == EOF || chr == "/" || chr == "?" || chr == "#" || chr == "\\" && url.isSpecial()) {
                if (url.isSpecial() && buffer == "")
                  return INVALID_HOST;
                if (stateOverride && buffer == "" && (url.includesCredentials() || url.port !== null))
                  return;
                failure = url.parseHost(buffer);
                if (failure)
                  return failure;
                buffer = "";
                state = PATH_START;
                if (stateOverride)
                  return;
                continue;
              } else {
                if (chr == "[")
                  seenBracket = true;
                else if (chr == "]")
                  seenBracket = false;
                buffer += chr;
              }
              break;
            case PORT:
              if (exec(DIGIT, chr)) {
                buffer += chr;
              } else if (chr == EOF || chr == "/" || chr == "?" || chr == "#" || chr == "\\" && url.isSpecial() || stateOverride) {
                if (buffer != "") {
                  var port = parseInt2(buffer, 10);
                  if (port > 65535)
                    return INVALID_PORT;
                  url.port = url.isSpecial() && port === specialSchemes[url.scheme] ? null : port;
                  buffer = "";
                }
                if (stateOverride)
                  return;
                state = PATH_START;
                continue;
              } else
                return INVALID_PORT;
              break;
            case FILE:
              url.scheme = "file";
              if (chr == "/" || chr == "\\")
                state = FILE_SLASH;
              else if (base && base.scheme == "file") {
                if (chr == EOF) {
                  url.host = base.host;
                  url.path = arraySlice(base.path);
                  url.query = base.query;
                } else if (chr == "?") {
                  url.host = base.host;
                  url.path = arraySlice(base.path);
                  url.query = "";
                  state = QUERY;
                } else if (chr == "#") {
                  url.host = base.host;
                  url.path = arraySlice(base.path);
                  url.query = base.query;
                  url.fragment = "";
                  state = FRAGMENT;
                } else {
                  if (!startsWithWindowsDriveLetter(join(arraySlice(codePoints, pointer), ""))) {
                    url.host = base.host;
                    url.path = arraySlice(base.path);
                    url.shortenPath();
                  }
                  state = PATH;
                  continue;
                }
              } else {
                state = PATH;
                continue;
              }
              break;
            case FILE_SLASH:
              if (chr == "/" || chr == "\\") {
                state = FILE_HOST;
                break;
              }
              if (base && base.scheme == "file" && !startsWithWindowsDriveLetter(join(arraySlice(codePoints, pointer), ""))) {
                if (isWindowsDriveLetter(base.path[0], true))
                  push(url.path, base.path[0]);
                else
                  url.host = base.host;
              }
              state = PATH;
              continue;
            case FILE_HOST:
              if (chr == EOF || chr == "/" || chr == "\\" || chr == "?" || chr == "#") {
                if (!stateOverride && isWindowsDriveLetter(buffer)) {
                  state = PATH;
                } else if (buffer == "") {
                  url.host = "";
                  if (stateOverride)
                    return;
                  state = PATH_START;
                } else {
                  failure = url.parseHost(buffer);
                  if (failure)
                    return failure;
                  if (url.host == "localhost")
                    url.host = "";
                  if (stateOverride)
                    return;
                  buffer = "";
                  state = PATH_START;
                }
                continue;
              } else
                buffer += chr;
              break;
            case PATH_START:
              if (url.isSpecial()) {
                state = PATH;
                if (chr != "/" && chr != "\\")
                  continue;
              } else if (!stateOverride && chr == "?") {
                url.query = "";
                state = QUERY;
              } else if (!stateOverride && chr == "#") {
                url.fragment = "";
                state = FRAGMENT;
              } else if (chr != EOF) {
                state = PATH;
                if (chr != "/")
                  continue;
              }
              break;
            case PATH:
              if (chr == EOF || chr == "/" || chr == "\\" && url.isSpecial() || !stateOverride && (chr == "?" || chr == "#")) {
                if (isDoubleDot(buffer)) {
                  url.shortenPath();
                  if (chr != "/" && !(chr == "\\" && url.isSpecial())) {
                    push(url.path, "");
                  }
                } else if (isSingleDot(buffer)) {
                  if (chr != "/" && !(chr == "\\" && url.isSpecial())) {
                    push(url.path, "");
                  }
                } else {
                  if (url.scheme == "file" && !url.path.length && isWindowsDriveLetter(buffer)) {
                    if (url.host)
                      url.host = "";
                    buffer = charAt(buffer, 0) + ":";
                  }
                  push(url.path, buffer);
                }
                buffer = "";
                if (url.scheme == "file" && (chr == EOF || chr == "?" || chr == "#")) {
                  while (url.path.length > 1 && url.path[0] === "") {
                    shift(url.path);
                  }
                }
                if (chr == "?") {
                  url.query = "";
                  state = QUERY;
                } else if (chr == "#") {
                  url.fragment = "";
                  state = FRAGMENT;
                }
              } else {
                buffer += percentEncode(chr, pathPercentEncodeSet);
              }
              break;
            case CANNOT_BE_A_BASE_URL_PATH:
              if (chr == "?") {
                url.query = "";
                state = QUERY;
              } else if (chr == "#") {
                url.fragment = "";
                state = FRAGMENT;
              } else if (chr != EOF) {
                url.path[0] += percentEncode(chr, C0ControlPercentEncodeSet);
              }
              break;
            case QUERY:
              if (!stateOverride && chr == "#") {
                url.fragment = "";
                state = FRAGMENT;
              } else if (chr != EOF) {
                if (chr == "'" && url.isSpecial())
                  url.query += "%27";
                else if (chr == "#")
                  url.query += "%23";
                else
                  url.query += percentEncode(chr, C0ControlPercentEncodeSet);
              }
              break;
            case FRAGMENT:
              if (chr != EOF)
                url.fragment += percentEncode(chr, fragmentPercentEncodeSet);
              break;
          }
          pointer++;
        }
      },
      parseHost: function(input) {
        var result, codePoints, index;
        if (charAt(input, 0) == "[") {
          if (charAt(input, input.length - 1) != "]")
            return INVALID_HOST;
          result = parseIPv6(stringSlice(input, 1, -1));
          if (!result)
            return INVALID_HOST;
          this.host = result;
        } else if (!this.isSpecial()) {
          if (exec(FORBIDDEN_HOST_CODE_POINT_EXCLUDING_PERCENT, input))
            return INVALID_HOST;
          result = "";
          codePoints = arrayFrom(input);
          for (index = 0; index < codePoints.length; index++) {
            result += percentEncode(codePoints[index], C0ControlPercentEncodeSet);
          }
          this.host = result;
        } else {
          input = toASCII(input);
          if (exec(FORBIDDEN_HOST_CODE_POINT, input))
            return INVALID_HOST;
          result = parseIPv4(input);
          if (result === null)
            return INVALID_HOST;
          this.host = result;
        }
      },
      cannotHaveUsernamePasswordPort: function() {
        return !this.host || this.cannotBeABaseURL || this.scheme == "file";
      },
      includesCredentials: function() {
        return this.username != "" || this.password != "";
      },
      isSpecial: function() {
        return hasOwn(specialSchemes, this.scheme);
      },
      shortenPath: function() {
        var path = this.path;
        var pathSize = path.length;
        if (pathSize && (this.scheme != "file" || pathSize != 1 || !isWindowsDriveLetter(path[0], true))) {
          path.length--;
        }
      },
      serialize: function() {
        var url = this;
        var scheme = url.scheme;
        var username = url.username;
        var password = url.password;
        var host = url.host;
        var port = url.port;
        var path = url.path;
        var query = url.query;
        var fragment = url.fragment;
        var output = scheme + ":";
        if (host !== null) {
          output += "//";
          if (url.includesCredentials()) {
            output += username + (password ? ":" + password : "") + "@";
          }
          output += serializeHost(host);
          if (port !== null)
            output += ":" + port;
        } else if (scheme == "file")
          output += "//";
        output += url.cannotBeABaseURL ? path[0] : path.length ? "/" + join(path, "/") : "";
        if (query !== null)
          output += "?" + query;
        if (fragment !== null)
          output += "#" + fragment;
        return output;
      },
      setHref: function(href) {
        var failure = this.parse(href);
        if (failure)
          throw TypeError2(failure);
        this.searchParams.update();
      },
      getOrigin: function() {
        var scheme = this.scheme;
        var port = this.port;
        if (scheme == "blob")
          try {
            return new URLConstructor(scheme.path[0]).origin;
          } catch (error) {
            return "null";
          }
        if (scheme == "file" || !this.isSpecial())
          return "null";
        return scheme + "://" + serializeHost(this.host) + (port !== null ? ":" + port : "");
      },
      getProtocol: function() {
        return this.scheme + ":";
      },
      setProtocol: function(protocol) {
        this.parse($toString(protocol) + ":", SCHEME_START);
      },
      getUsername: function() {
        return this.username;
      },
      setUsername: function(username) {
        var codePoints = arrayFrom($toString(username));
        if (this.cannotHaveUsernamePasswordPort())
          return;
        this.username = "";
        for (var i = 0; i < codePoints.length; i++) {
          this.username += percentEncode(codePoints[i], userinfoPercentEncodeSet);
        }
      },
      getPassword: function() {
        return this.password;
      },
      setPassword: function(password) {
        var codePoints = arrayFrom($toString(password));
        if (this.cannotHaveUsernamePasswordPort())
          return;
        this.password = "";
        for (var i = 0; i < codePoints.length; i++) {
          this.password += percentEncode(codePoints[i], userinfoPercentEncodeSet);
        }
      },
      getHost: function() {
        var host = this.host;
        var port = this.port;
        return host === null ? "" : port === null ? serializeHost(host) : serializeHost(host) + ":" + port;
      },
      setHost: function(host) {
        if (this.cannotBeABaseURL)
          return;
        this.parse(host, HOST);
      },
      getHostname: function() {
        var host = this.host;
        return host === null ? "" : serializeHost(host);
      },
      setHostname: function(hostname) {
        if (this.cannotBeABaseURL)
          return;
        this.parse(hostname, HOSTNAME);
      },
      getPort: function() {
        var port = this.port;
        return port === null ? "" : $toString(port);
      },
      setPort: function(port) {
        if (this.cannotHaveUsernamePasswordPort())
          return;
        port = $toString(port);
        if (port == "")
          this.port = null;
        else
          this.parse(port, PORT);
      },
      getPathname: function() {
        var path = this.path;
        return this.cannotBeABaseURL ? path[0] : path.length ? "/" + join(path, "/") : "";
      },
      setPathname: function(pathname) {
        if (this.cannotBeABaseURL)
          return;
        this.path = [];
        this.parse(pathname, PATH_START);
      },
      getSearch: function() {
        var query = this.query;
        return query ? "?" + query : "";
      },
      setSearch: function(search) {
        search = $toString(search);
        if (search == "") {
          this.query = null;
        } else {
          if ("?" == charAt(search, 0))
            search = stringSlice(search, 1);
          this.query = "";
          this.parse(search, QUERY);
        }
        this.searchParams.update();
      },
      getSearchParams: function() {
        return this.searchParams.facade;
      },
      getHash: function() {
        var fragment = this.fragment;
        return fragment ? "#" + fragment : "";
      },
      setHash: function(hash) {
        hash = $toString(hash);
        if (hash == "") {
          this.fragment = null;
          return;
        }
        if ("#" == charAt(hash, 0))
          hash = stringSlice(hash, 1);
        this.fragment = "";
        this.parse(hash, FRAGMENT);
      },
      update: function() {
        this.query = this.searchParams.serialize() || null;
      }
    };
    var URLConstructor = function URL2(url) {
      var that = anInstance(this, URLPrototype);
      var base = validateArgumentsLength(arguments.length, 1) > 1 ? arguments[1] : void 0;
      var state = setInternalState(that, new URLState(url, false, base));
      if (!DESCRIPTORS) {
        that.href = state.serialize();
        that.origin = state.getOrigin();
        that.protocol = state.getProtocol();
        that.username = state.getUsername();
        that.password = state.getPassword();
        that.host = state.getHost();
        that.hostname = state.getHostname();
        that.port = state.getPort();
        that.pathname = state.getPathname();
        that.search = state.getSearch();
        that.searchParams = state.getSearchParams();
        that.hash = state.getHash();
      }
    };
    var URLPrototype = URLConstructor.prototype;
    var accessorDescriptor = function(getter, setter) {
      return {
        get: function() {
          return getInternalURLState(this)[getter]();
        },
        set: setter && function(value) {
          return getInternalURLState(this)[setter](value);
        },
        configurable: true,
        enumerable: true
      };
    };
    if (DESCRIPTORS) {
      defineBuiltInAccessor(URLPrototype, "href", accessorDescriptor("serialize", "setHref"));
      defineBuiltInAccessor(URLPrototype, "origin", accessorDescriptor("getOrigin"));
      defineBuiltInAccessor(URLPrototype, "protocol", accessorDescriptor("getProtocol", "setProtocol"));
      defineBuiltInAccessor(URLPrototype, "username", accessorDescriptor("getUsername", "setUsername"));
      defineBuiltInAccessor(URLPrototype, "password", accessorDescriptor("getPassword", "setPassword"));
      defineBuiltInAccessor(URLPrototype, "host", accessorDescriptor("getHost", "setHost"));
      defineBuiltInAccessor(URLPrototype, "hostname", accessorDescriptor("getHostname", "setHostname"));
      defineBuiltInAccessor(URLPrototype, "port", accessorDescriptor("getPort", "setPort"));
      defineBuiltInAccessor(URLPrototype, "pathname", accessorDescriptor("getPathname", "setPathname"));
      defineBuiltInAccessor(URLPrototype, "search", accessorDescriptor("getSearch", "setSearch"));
      defineBuiltInAccessor(URLPrototype, "searchParams", accessorDescriptor("getSearchParams"));
      defineBuiltInAccessor(URLPrototype, "hash", accessorDescriptor("getHash", "setHash"));
    }
    defineBuiltIn(URLPrototype, "toJSON", function toJSON() {
      return getInternalURLState(this).serialize();
    }, { enumerable: true });
    defineBuiltIn(URLPrototype, "toString", function toString() {
      return getInternalURLState(this).serialize();
    }, { enumerable: true });
    if (NativeURL) {
      nativeCreateObjectURL = NativeURL.createObjectURL;
      nativeRevokeObjectURL = NativeURL.revokeObjectURL;
      if (nativeCreateObjectURL)
        defineBuiltIn(URLConstructor, "createObjectURL", bind(nativeCreateObjectURL, NativeURL));
      if (nativeRevokeObjectURL)
        defineBuiltIn(URLConstructor, "revokeObjectURL", bind(nativeRevokeObjectURL, NativeURL));
    }
    var nativeCreateObjectURL;
    var nativeRevokeObjectURL;
    setToStringTag(URLConstructor, "URL");
    $({ global: true, constructor: true, forced: !USE_NATIVE_URL, sham: !DESCRIPTORS }, {
      URL: URLConstructor
    });
  }
});

// node_modules/core-js/modules/web.url.js
var require_web_url = __commonJS({
  "node_modules/core-js/modules/web.url.js"() {
    require_web_url_constructor();
  }
});

// node_modules/core-js/modules/web.url.to-json.js
var require_web_url_to_json = __commonJS({
  "node_modules/core-js/modules/web.url.to-json.js"() {
    "use strict";
    var $ = require_export();
    var call = require_function_call();
    $({ target: "URL", proto: true, enumerable: true }, {
      toJSON: function toJSON() {
        return call(URL.prototype.toString, this);
      }
    });
  }
});

// node_modules/core-js/modules/web.url-search-params.js
var require_web_url_search_params = __commonJS({
  "node_modules/core-js/modules/web.url-search-params.js"() {
    require_web_url_search_params_constructor();
  }
});

// node_modules/core-js/internals/path.js
var require_path = __commonJS({
  "node_modules/core-js/internals/path.js"(exports, module) {
    var global2 = require_global();
    module.exports = global2;
  }
});

// node_modules/core-js/web/url.js
var require_url = __commonJS({
  "node_modules/core-js/web/url.js"(exports, module) {
    require_web_url();
    require_web_url_to_json();
    require_web_url_search_params();
    var path = require_path();
    module.exports = path.URL;
  }
});

// node_modules/core-js/stable/url/index.js
var require_url2 = __commonJS({
  "node_modules/core-js/stable/url/index.js"(exports, module) {
    var parent = require_url();
    module.exports = parent;
  }
});

// node_modules/core-js/actual/url/index.js
var require_url3 = __commonJS({
  "node_modules/core-js/actual/url/index.js"(exports, module) {
    var parent = require_url2();
    module.exports = parent;
  }
});

// node_modules/core-js/stable/url/to-json.js
var require_to_json = __commonJS({
  "node_modules/core-js/stable/url/to-json.js"() {
    require_web_url_to_json();
  }
});

// node_modules/core-js/actual/url/to-json.js
var require_to_json2 = __commonJS({
  "node_modules/core-js/actual/url/to-json.js"(exports, module) {
    var parent = require_to_json();
    module.exports = parent;
  }
});

// node_modules/core-js/web/url-search-params.js
var require_url_search_params = __commonJS({
  "node_modules/core-js/web/url-search-params.js"(exports, module) {
    require_web_url_search_params();
    var path = require_path();
    module.exports = path.URLSearchParams;
  }
});

// node_modules/core-js/internals/dom-iterables.js
var require_dom_iterables = __commonJS({
  "node_modules/core-js/internals/dom-iterables.js"(exports, module) {
    module.exports = {
      CSSRuleList: 0,
      CSSStyleDeclaration: 0,
      CSSValueList: 0,
      ClientRectList: 0,
      DOMRectList: 0,
      DOMStringList: 0,
      DOMTokenList: 1,
      DataTransferItemList: 0,
      FileList: 0,
      HTMLAllCollection: 0,
      HTMLCollection: 0,
      HTMLFormElement: 0,
      HTMLSelectElement: 0,
      MediaList: 0,
      MimeTypeArray: 0,
      NamedNodeMap: 0,
      NodeList: 1,
      PaintRequestList: 0,
      Plugin: 0,
      PluginArray: 0,
      SVGLengthList: 0,
      SVGNumberList: 0,
      SVGPathSegList: 0,
      SVGPointList: 0,
      SVGStringList: 0,
      SVGTransformList: 0,
      SourceBufferList: 0,
      StyleSheetList: 0,
      TextTrackCueList: 0,
      TextTrackList: 0,
      TouchList: 0
    };
  }
});

// node_modules/core-js/internals/dom-token-list-prototype.js
var require_dom_token_list_prototype = __commonJS({
  "node_modules/core-js/internals/dom-token-list-prototype.js"(exports, module) {
    var documentCreateElement = require_document_create_element();
    var classList = documentCreateElement("span").classList;
    var DOMTokenListPrototype = classList && classList.constructor && classList.constructor.prototype;
    module.exports = DOMTokenListPrototype === Object.prototype ? void 0 : DOMTokenListPrototype;
  }
});

// node_modules/core-js/modules/web.dom-collections.iterator.js
var require_web_dom_collections_iterator = __commonJS({
  "node_modules/core-js/modules/web.dom-collections.iterator.js"() {
    var global2 = require_global();
    var DOMIterables = require_dom_iterables();
    var DOMTokenListPrototype = require_dom_token_list_prototype();
    var ArrayIteratorMethods = require_es_array_iterator();
    var createNonEnumerableProperty = require_create_non_enumerable_property();
    var wellKnownSymbol = require_well_known_symbol();
    var ITERATOR = wellKnownSymbol("iterator");
    var TO_STRING_TAG = wellKnownSymbol("toStringTag");
    var ArrayValues = ArrayIteratorMethods.values;
    var handlePrototype = function(CollectionPrototype, COLLECTION_NAME2) {
      if (CollectionPrototype) {
        if (CollectionPrototype[ITERATOR] !== ArrayValues)
          try {
            createNonEnumerableProperty(CollectionPrototype, ITERATOR, ArrayValues);
          } catch (error) {
            CollectionPrototype[ITERATOR] = ArrayValues;
          }
        if (!CollectionPrototype[TO_STRING_TAG]) {
          createNonEnumerableProperty(CollectionPrototype, TO_STRING_TAG, COLLECTION_NAME2);
        }
        if (DOMIterables[COLLECTION_NAME2])
          for (var METHOD_NAME in ArrayIteratorMethods) {
            if (CollectionPrototype[METHOD_NAME] !== ArrayIteratorMethods[METHOD_NAME])
              try {
                createNonEnumerableProperty(CollectionPrototype, METHOD_NAME, ArrayIteratorMethods[METHOD_NAME]);
              } catch (error) {
                CollectionPrototype[METHOD_NAME] = ArrayIteratorMethods[METHOD_NAME];
              }
          }
      }
    };
    for (COLLECTION_NAME in DOMIterables) {
      handlePrototype(global2[COLLECTION_NAME] && global2[COLLECTION_NAME].prototype, COLLECTION_NAME);
    }
    var COLLECTION_NAME;
    handlePrototype(DOMTokenListPrototype, "DOMTokenList");
  }
});

// node_modules/core-js/stable/url-search-params/index.js
var require_url_search_params2 = __commonJS({
  "node_modules/core-js/stable/url-search-params/index.js"(exports, module) {
    var parent = require_url_search_params();
    require_web_dom_collections_iterator();
    module.exports = parent;
  }
});

// node_modules/core-js/actual/url-search-params/index.js
var require_url_search_params3 = __commonJS({
  "node_modules/core-js/actual/url-search-params/index.js"(exports, module) {
    var parent = require_url_search_params2();
    module.exports = parent;
  }
});

// node_modules/whatwg-fetch/dist/fetch.umd.js
var require_fetch_umd = __commonJS({
  "node_modules/whatwg-fetch/dist/fetch.umd.js"(exports, module) {
    (function(global2, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : factory(global2.WHATWGFetch = {});
    })(exports, function(exports2) {
      "use strict";
      var global2 = typeof globalThis !== "undefined" && globalThis || typeof self !== "undefined" && self || typeof global2 !== "undefined" && global2;
      var support = {
        searchParams: "URLSearchParams" in global2,
        iterable: "Symbol" in global2 && "iterator" in Symbol,
        blob: "FileReader" in global2 && "Blob" in global2 && function() {
          try {
            new Blob();
            return true;
          } catch (e) {
            return false;
          }
        }(),
        formData: "FormData" in global2,
        arrayBuffer: "ArrayBuffer" in global2
      };
      function isDataView(obj) {
        return obj && DataView.prototype.isPrototypeOf(obj);
      }
      if (support.arrayBuffer) {
        var viewClasses = [
          "[object Int8Array]",
          "[object Uint8Array]",
          "[object Uint8ClampedArray]",
          "[object Int16Array]",
          "[object Uint16Array]",
          "[object Int32Array]",
          "[object Uint32Array]",
          "[object Float32Array]",
          "[object Float64Array]"
        ];
        var isArrayBufferView = ArrayBuffer.isView || function(obj) {
          return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1;
        };
      }
      function normalizeName(name) {
        if (typeof name !== "string") {
          name = String(name);
        }
        if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(name) || name === "") {
          throw new TypeError('Invalid character in header field name: "' + name + '"');
        }
        return name.toLowerCase();
      }
      function normalizeValue(value) {
        if (typeof value !== "string") {
          value = String(value);
        }
        return value;
      }
      function iteratorFor(items) {
        var iterator = {
          next: function() {
            var value = items.shift();
            return { done: value === void 0, value };
          }
        };
        if (support.iterable) {
          iterator[Symbol.iterator] = function() {
            return iterator;
          };
        }
        return iterator;
      }
      function Headers(headers) {
        this.map = {};
        if (headers instanceof Headers) {
          headers.forEach(function(value, name) {
            this.append(name, value);
          }, this);
        } else if (Array.isArray(headers)) {
          headers.forEach(function(header) {
            this.append(header[0], header[1]);
          }, this);
        } else if (headers) {
          Object.getOwnPropertyNames(headers).forEach(function(name) {
            this.append(name, headers[name]);
          }, this);
        }
      }
      Headers.prototype.append = function(name, value) {
        name = normalizeName(name);
        value = normalizeValue(value);
        var oldValue = this.map[name];
        this.map[name] = oldValue ? oldValue + ", " + value : value;
      };
      Headers.prototype["delete"] = function(name) {
        delete this.map[normalizeName(name)];
      };
      Headers.prototype.get = function(name) {
        name = normalizeName(name);
        return this.has(name) ? this.map[name] : null;
      };
      Headers.prototype.has = function(name) {
        return this.map.hasOwnProperty(normalizeName(name));
      };
      Headers.prototype.set = function(name, value) {
        this.map[normalizeName(name)] = normalizeValue(value);
      };
      Headers.prototype.forEach = function(callback, thisArg) {
        for (var name in this.map) {
          if (this.map.hasOwnProperty(name)) {
            callback.call(thisArg, this.map[name], name, this);
          }
        }
      };
      Headers.prototype.keys = function() {
        var items = [];
        this.forEach(function(value, name) {
          items.push(name);
        });
        return iteratorFor(items);
      };
      Headers.prototype.values = function() {
        var items = [];
        this.forEach(function(value) {
          items.push(value);
        });
        return iteratorFor(items);
      };
      Headers.prototype.entries = function() {
        var items = [];
        this.forEach(function(value, name) {
          items.push([name, value]);
        });
        return iteratorFor(items);
      };
      if (support.iterable) {
        Headers.prototype[Symbol.iterator] = Headers.prototype.entries;
      }
      function consumed(body) {
        if (body.bodyUsed) {
          return Promise.reject(new TypeError("Already read"));
        }
        body.bodyUsed = true;
      }
      function fileReaderReady(reader) {
        return new Promise(function(resolve, reject) {
          reader.onload = function() {
            resolve(reader.result);
          };
          reader.onerror = function() {
            reject(reader.error);
          };
        });
      }
      function readBlobAsArrayBuffer(blob) {
        var reader = new FileReader();
        var promise = fileReaderReady(reader);
        reader.readAsArrayBuffer(blob);
        return promise;
      }
      function readBlobAsText(blob) {
        var reader = new FileReader();
        var promise = fileReaderReady(reader);
        reader.readAsText(blob);
        return promise;
      }
      function readArrayBufferAsText(buf) {
        var view = new Uint8Array(buf);
        var chars = new Array(view.length);
        for (var i = 0; i < view.length; i++) {
          chars[i] = String.fromCharCode(view[i]);
        }
        return chars.join("");
      }
      function bufferClone(buf) {
        if (buf.slice) {
          return buf.slice(0);
        } else {
          var view = new Uint8Array(buf.byteLength);
          view.set(new Uint8Array(buf));
          return view.buffer;
        }
      }
      function Body() {
        this.bodyUsed = false;
        this._initBody = function(body) {
          this.bodyUsed = this.bodyUsed;
          this._bodyInit = body;
          if (!body) {
            this._bodyText = "";
          } else if (typeof body === "string") {
            this._bodyText = body;
          } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
            this._bodyBlob = body;
          } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
            this._bodyFormData = body;
          } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
            this._bodyText = body.toString();
          } else if (support.arrayBuffer && support.blob && isDataView(body)) {
            this._bodyArrayBuffer = bufferClone(body.buffer);
            this._bodyInit = new Blob([this._bodyArrayBuffer]);
          } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
            this._bodyArrayBuffer = bufferClone(body);
          } else {
            this._bodyText = body = Object.prototype.toString.call(body);
          }
          if (!this.headers.get("content-type")) {
            if (typeof body === "string") {
              this.headers.set("content-type", "text/plain;charset=UTF-8");
            } else if (this._bodyBlob && this._bodyBlob.type) {
              this.headers.set("content-type", this._bodyBlob.type);
            } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
              this.headers.set("content-type", "application/x-www-form-urlencoded;charset=UTF-8");
            }
          }
        };
        if (support.blob) {
          this.blob = function() {
            var rejected = consumed(this);
            if (rejected) {
              return rejected;
            }
            if (this._bodyBlob) {
              return Promise.resolve(this._bodyBlob);
            } else if (this._bodyArrayBuffer) {
              return Promise.resolve(new Blob([this._bodyArrayBuffer]));
            } else if (this._bodyFormData) {
              throw new Error("could not read FormData body as blob");
            } else {
              return Promise.resolve(new Blob([this._bodyText]));
            }
          };
          this.arrayBuffer = function() {
            if (this._bodyArrayBuffer) {
              var isConsumed = consumed(this);
              if (isConsumed) {
                return isConsumed;
              }
              if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
                return Promise.resolve(
                  this._bodyArrayBuffer.buffer.slice(
                    this._bodyArrayBuffer.byteOffset,
                    this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
                  )
                );
              } else {
                return Promise.resolve(this._bodyArrayBuffer);
              }
            } else {
              return this.blob().then(readBlobAsArrayBuffer);
            }
          };
        }
        this.text = function() {
          var rejected = consumed(this);
          if (rejected) {
            return rejected;
          }
          if (this._bodyBlob) {
            return readBlobAsText(this._bodyBlob);
          } else if (this._bodyArrayBuffer) {
            return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer));
          } else if (this._bodyFormData) {
            throw new Error("could not read FormData body as text");
          } else {
            return Promise.resolve(this._bodyText);
          }
        };
        if (support.formData) {
          this.formData = function() {
            return this.text().then(decode);
          };
        }
        this.json = function() {
          return this.text().then(JSON.parse);
        };
        return this;
      }
      var methods = ["DELETE", "GET", "HEAD", "OPTIONS", "POST", "PUT"];
      function normalizeMethod(method) {
        var upcased = method.toUpperCase();
        return methods.indexOf(upcased) > -1 ? upcased : method;
      }
      function Request(input, options) {
        if (!(this instanceof Request)) {
          throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.');
        }
        options = options || {};
        var body = options.body;
        if (input instanceof Request) {
          if (input.bodyUsed) {
            throw new TypeError("Already read");
          }
          this.url = input.url;
          this.credentials = input.credentials;
          if (!options.headers) {
            this.headers = new Headers(input.headers);
          }
          this.method = input.method;
          this.mode = input.mode;
          this.signal = input.signal;
          if (!body && input._bodyInit != null) {
            body = input._bodyInit;
            input.bodyUsed = true;
          }
        } else {
          this.url = String(input);
        }
        this.credentials = options.credentials || this.credentials || "same-origin";
        if (options.headers || !this.headers) {
          this.headers = new Headers(options.headers);
        }
        this.method = normalizeMethod(options.method || this.method || "GET");
        this.mode = options.mode || this.mode || null;
        this.signal = options.signal || this.signal;
        this.referrer = null;
        if ((this.method === "GET" || this.method === "HEAD") && body) {
          throw new TypeError("Body not allowed for GET or HEAD requests");
        }
        this._initBody(body);
        if (this.method === "GET" || this.method === "HEAD") {
          if (options.cache === "no-store" || options.cache === "no-cache") {
            var reParamSearch = /([?&])_=[^&]*/;
            if (reParamSearch.test(this.url)) {
              this.url = this.url.replace(reParamSearch, "$1_=" + new Date().getTime());
            } else {
              var reQueryString = /\?/;
              this.url += (reQueryString.test(this.url) ? "&" : "?") + "_=" + new Date().getTime();
            }
          }
        }
      }
      Request.prototype.clone = function() {
        return new Request(this, { body: this._bodyInit });
      };
      function decode(body) {
        var form = new FormData();
        body.trim().split("&").forEach(function(bytes) {
          if (bytes) {
            var split = bytes.split("=");
            var name = split.shift().replace(/\+/g, " ");
            var value = split.join("=").replace(/\+/g, " ");
            form.append(decodeURIComponent(name), decodeURIComponent(value));
          }
        });
        return form;
      }
      function parseHeaders(rawHeaders) {
        var headers = new Headers();
        var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, " ");
        preProcessedHeaders.split("\r").map(function(header) {
          return header.indexOf("\n") === 0 ? header.substr(1, header.length) : header;
        }).forEach(function(line) {
          var parts = line.split(":");
          var key = parts.shift().trim();
          if (key) {
            var value = parts.join(":").trim();
            headers.append(key, value);
          }
        });
        return headers;
      }
      Body.call(Request.prototype);
      function Response2(bodyInit, options) {
        if (!(this instanceof Response2)) {
          throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.');
        }
        if (!options) {
          options = {};
        }
        this.type = "default";
        this.status = options.status === void 0 ? 200 : options.status;
        this.ok = this.status >= 200 && this.status < 300;
        this.statusText = options.statusText === void 0 ? "" : "" + options.statusText;
        this.headers = new Headers(options.headers);
        this.url = options.url || "";
        this._initBody(bodyInit);
      }
      Body.call(Response2.prototype);
      Response2.prototype.clone = function() {
        return new Response2(this._bodyInit, {
          status: this.status,
          statusText: this.statusText,
          headers: new Headers(this.headers),
          url: this.url
        });
      };
      Response2.error = function() {
        var response = new Response2(null, { status: 0, statusText: "" });
        response.type = "error";
        return response;
      };
      var redirectStatuses = [301, 302, 303, 307, 308];
      Response2.redirect = function(url, status) {
        if (redirectStatuses.indexOf(status) === -1) {
          throw new RangeError("Invalid status code");
        }
        return new Response2(null, { status, headers: { location: url } });
      };
      exports2.DOMException = global2.DOMException;
      try {
        new exports2.DOMException();
      } catch (err) {
        exports2.DOMException = function(message, name) {
          this.message = message;
          this.name = name;
          var error = Error(message);
          this.stack = error.stack;
        };
        exports2.DOMException.prototype = Object.create(Error.prototype);
        exports2.DOMException.prototype.constructor = exports2.DOMException;
      }
      function fetch(input, init2) {
        return new Promise(function(resolve, reject) {
          var request = new Request(input, init2);
          if (request.signal && request.signal.aborted) {
            return reject(new exports2.DOMException("Aborted", "AbortError"));
          }
          var xhr = new XMLHttpRequest();
          function abortXhr() {
            xhr.abort();
          }
          xhr.onload = function() {
            var options = {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: parseHeaders(xhr.getAllResponseHeaders() || "")
            };
            options.url = "responseURL" in xhr ? xhr.responseURL : options.headers.get("X-Request-URL");
            var body = "response" in xhr ? xhr.response : xhr.responseText;
            setTimeout(function() {
              resolve(new Response2(body, options));
            }, 0);
          };
          xhr.onerror = function() {
            setTimeout(function() {
              reject(new TypeError("Network request failed"));
            }, 0);
          };
          xhr.ontimeout = function() {
            setTimeout(function() {
              reject(new TypeError("Network request failed"));
            }, 0);
          };
          xhr.onabort = function() {
            setTimeout(function() {
              reject(new exports2.DOMException("Aborted", "AbortError"));
            }, 0);
          };
          function fixUrl(url) {
            try {
              return url === "" && global2.location.href ? global2.location.href : url;
            } catch (e) {
              return url;
            }
          }
          xhr.open(request.method, fixUrl(request.url), true);
          if (request.credentials === "include") {
            xhr.withCredentials = true;
          } else if (request.credentials === "omit") {
            xhr.withCredentials = false;
          }
          if ("responseType" in xhr) {
            if (support.blob) {
              xhr.responseType = "blob";
            } else if (support.arrayBuffer && request.headers.get("Content-Type") && request.headers.get("Content-Type").indexOf("application/octet-stream") !== -1) {
              xhr.responseType = "arraybuffer";
            }
          }
          if (init2 && typeof init2.headers === "object" && !(init2.headers instanceof Headers)) {
            Object.getOwnPropertyNames(init2.headers).forEach(function(name) {
              xhr.setRequestHeader(name, normalizeValue(init2.headers[name]));
            });
          } else {
            request.headers.forEach(function(value, name) {
              xhr.setRequestHeader(name, value);
            });
          }
          if (request.signal) {
            request.signal.addEventListener("abort", abortXhr);
            xhr.onreadystatechange = function() {
              if (xhr.readyState === 4) {
                request.signal.removeEventListener("abort", abortXhr);
              }
            };
          }
          xhr.send(typeof request._bodyInit === "undefined" ? null : request._bodyInit);
        });
      }
      fetch.polyfill = true;
      if (!global2.fetch) {
        global2.fetch = fetch;
        global2.Headers = Headers;
        global2.Request = Request;
        global2.Response = Response2;
      }
      exports2.Headers = Headers;
      exports2.Request = Request;
      exports2.Response = Response2;
      exports2.fetch = fetch;
      Object.defineProperty(exports2, "__esModule", { value: true });
    });
  }
});

// node_modules/web-streams-polyfill/dist/polyfill.es2018.js
var require_polyfill_es2018 = __commonJS({
  "node_modules/web-streams-polyfill/dist/polyfill.es2018.js"(exports, module) {
    (function(global2, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global2 = typeof globalThis !== "undefined" ? globalThis : global2 || self, factory(global2.WebStreamsPolyfill = {}));
    })(exports, function(exports2) {
      "use strict";
      const SymbolPolyfill = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? Symbol : (description) => `Symbol(${description})`;
      function noop() {
        return void 0;
      }
      function getGlobals() {
        if (typeof self !== "undefined") {
          return self;
        } else if (typeof window !== "undefined") {
          return window;
        } else if (typeof global !== "undefined") {
          return global;
        }
        return void 0;
      }
      const globals = getGlobals();
      function typeIsObject(x) {
        return typeof x === "object" && x !== null || typeof x === "function";
      }
      const rethrowAssertionErrorRejection = noop;
      const originalPromise = Promise;
      const originalPromiseThen = Promise.prototype.then;
      const originalPromiseResolve = Promise.resolve.bind(originalPromise);
      const originalPromiseReject = Promise.reject.bind(originalPromise);
      function newPromise(executor) {
        return new originalPromise(executor);
      }
      function promiseResolvedWith(value) {
        return originalPromiseResolve(value);
      }
      function promiseRejectedWith(reason) {
        return originalPromiseReject(reason);
      }
      function PerformPromiseThen(promise, onFulfilled, onRejected) {
        return originalPromiseThen.call(promise, onFulfilled, onRejected);
      }
      function uponPromise(promise, onFulfilled, onRejected) {
        PerformPromiseThen(PerformPromiseThen(promise, onFulfilled, onRejected), void 0, rethrowAssertionErrorRejection);
      }
      function uponFulfillment(promise, onFulfilled) {
        uponPromise(promise, onFulfilled);
      }
      function uponRejection(promise, onRejected) {
        uponPromise(promise, void 0, onRejected);
      }
      function transformPromiseWith(promise, fulfillmentHandler, rejectionHandler) {
        return PerformPromiseThen(promise, fulfillmentHandler, rejectionHandler);
      }
      function setPromiseIsHandledToTrue(promise) {
        PerformPromiseThen(promise, void 0, rethrowAssertionErrorRejection);
      }
      const queueMicrotask3 = (() => {
        const globalQueueMicrotask = globals && globals.queueMicrotask;
        if (typeof globalQueueMicrotask === "function") {
          return globalQueueMicrotask;
        }
        const resolvedPromise = promiseResolvedWith(void 0);
        return (fn) => PerformPromiseThen(resolvedPromise, fn);
      })();
      function reflectCall(F, V, args) {
        if (typeof F !== "function") {
          throw new TypeError("Argument is not a function");
        }
        return Function.prototype.apply.call(F, V, args);
      }
      function promiseCall(F, V, args) {
        try {
          return promiseResolvedWith(reflectCall(F, V, args));
        } catch (value) {
          return promiseRejectedWith(value);
        }
      }
      const QUEUE_MAX_ARRAY_SIZE = 16384;
      class SimpleQueue {
        constructor() {
          this._cursor = 0;
          this._size = 0;
          this._front = {
            _elements: [],
            _next: void 0
          };
          this._back = this._front;
          this._cursor = 0;
          this._size = 0;
        }
        get length() {
          return this._size;
        }
        push(element) {
          const oldBack = this._back;
          let newBack = oldBack;
          if (oldBack._elements.length === QUEUE_MAX_ARRAY_SIZE - 1) {
            newBack = {
              _elements: [],
              _next: void 0
            };
          }
          oldBack._elements.push(element);
          if (newBack !== oldBack) {
            this._back = newBack;
            oldBack._next = newBack;
          }
          ++this._size;
        }
        shift() {
          const oldFront = this._front;
          let newFront = oldFront;
          const oldCursor = this._cursor;
          let newCursor = oldCursor + 1;
          const elements = oldFront._elements;
          const element = elements[oldCursor];
          if (newCursor === QUEUE_MAX_ARRAY_SIZE) {
            newFront = oldFront._next;
            newCursor = 0;
          }
          --this._size;
          this._cursor = newCursor;
          if (oldFront !== newFront) {
            this._front = newFront;
          }
          elements[oldCursor] = void 0;
          return element;
        }
        forEach(callback) {
          let i = this._cursor;
          let node = this._front;
          let elements = node._elements;
          while (i !== elements.length || node._next !== void 0) {
            if (i === elements.length) {
              node = node._next;
              elements = node._elements;
              i = 0;
              if (elements.length === 0) {
                break;
              }
            }
            callback(elements[i]);
            ++i;
          }
        }
        peek() {
          const front = this._front;
          const cursor = this._cursor;
          return front._elements[cursor];
        }
      }
      function ReadableStreamReaderGenericInitialize(reader, stream) {
        reader._ownerReadableStream = stream;
        stream._reader = reader;
        if (stream._state === "readable") {
          defaultReaderClosedPromiseInitialize(reader);
        } else if (stream._state === "closed") {
          defaultReaderClosedPromiseInitializeAsResolved(reader);
        } else {
          defaultReaderClosedPromiseInitializeAsRejected(reader, stream._storedError);
        }
      }
      function ReadableStreamReaderGenericCancel(reader, reason) {
        const stream = reader._ownerReadableStream;
        return ReadableStreamCancel(stream, reason);
      }
      function ReadableStreamReaderGenericRelease(reader) {
        if (reader._ownerReadableStream._state === "readable") {
          defaultReaderClosedPromiseReject(reader, new TypeError(`Reader was released and can no longer be used to monitor the stream's closedness`));
        } else {
          defaultReaderClosedPromiseResetToRejected(reader, new TypeError(`Reader was released and can no longer be used to monitor the stream's closedness`));
        }
        reader._ownerReadableStream._reader = void 0;
        reader._ownerReadableStream = void 0;
      }
      function readerLockException(name) {
        return new TypeError("Cannot " + name + " a stream using a released reader");
      }
      function defaultReaderClosedPromiseInitialize(reader) {
        reader._closedPromise = newPromise((resolve, reject) => {
          reader._closedPromise_resolve = resolve;
          reader._closedPromise_reject = reject;
        });
      }
      function defaultReaderClosedPromiseInitializeAsRejected(reader, reason) {
        defaultReaderClosedPromiseInitialize(reader);
        defaultReaderClosedPromiseReject(reader, reason);
      }
      function defaultReaderClosedPromiseInitializeAsResolved(reader) {
        defaultReaderClosedPromiseInitialize(reader);
        defaultReaderClosedPromiseResolve(reader);
      }
      function defaultReaderClosedPromiseReject(reader, reason) {
        if (reader._closedPromise_reject === void 0) {
          return;
        }
        setPromiseIsHandledToTrue(reader._closedPromise);
        reader._closedPromise_reject(reason);
        reader._closedPromise_resolve = void 0;
        reader._closedPromise_reject = void 0;
      }
      function defaultReaderClosedPromiseResetToRejected(reader, reason) {
        defaultReaderClosedPromiseInitializeAsRejected(reader, reason);
      }
      function defaultReaderClosedPromiseResolve(reader) {
        if (reader._closedPromise_resolve === void 0) {
          return;
        }
        reader._closedPromise_resolve(void 0);
        reader._closedPromise_resolve = void 0;
        reader._closedPromise_reject = void 0;
      }
      const AbortSteps = SymbolPolyfill("[[AbortSteps]]");
      const ErrorSteps = SymbolPolyfill("[[ErrorSteps]]");
      const CancelSteps = SymbolPolyfill("[[CancelSteps]]");
      const PullSteps = SymbolPolyfill("[[PullSteps]]");
      const NumberIsFinite = Number.isFinite || function(x) {
        return typeof x === "number" && isFinite(x);
      };
      const MathTrunc = Math.trunc || function(v) {
        return v < 0 ? Math.ceil(v) : Math.floor(v);
      };
      function isDictionary(x) {
        return typeof x === "object" || typeof x === "function";
      }
      function assertDictionary(obj, context) {
        if (obj !== void 0 && !isDictionary(obj)) {
          throw new TypeError(`${context} is not an object.`);
        }
      }
      function assertFunction(x, context) {
        if (typeof x !== "function") {
          throw new TypeError(`${context} is not a function.`);
        }
      }
      function isObject2(x) {
        return typeof x === "object" && x !== null || typeof x === "function";
      }
      function assertObject(x, context) {
        if (!isObject2(x)) {
          throw new TypeError(`${context} is not an object.`);
        }
      }
      function assertRequiredArgument(x, position, context) {
        if (x === void 0) {
          throw new TypeError(`Parameter ${position} is required in '${context}'.`);
        }
      }
      function assertRequiredField(x, field, context) {
        if (x === void 0) {
          throw new TypeError(`${field} is required in '${context}'.`);
        }
      }
      function convertUnrestrictedDouble(value) {
        return Number(value);
      }
      function censorNegativeZero(x) {
        return x === 0 ? 0 : x;
      }
      function integerPart(x) {
        return censorNegativeZero(MathTrunc(x));
      }
      function convertUnsignedLongLongWithEnforceRange(value, context) {
        const lowerBound = 0;
        const upperBound = Number.MAX_SAFE_INTEGER;
        let x = Number(value);
        x = censorNegativeZero(x);
        if (!NumberIsFinite(x)) {
          throw new TypeError(`${context} is not a finite number`);
        }
        x = integerPart(x);
        if (x < lowerBound || x > upperBound) {
          throw new TypeError(`${context} is outside the accepted range of ${lowerBound} to ${upperBound}, inclusive`);
        }
        if (!NumberIsFinite(x) || x === 0) {
          return 0;
        }
        return x;
      }
      function assertReadableStream(x, context) {
        if (!IsReadableStream(x)) {
          throw new TypeError(`${context} is not a ReadableStream.`);
        }
      }
      function AcquireReadableStreamDefaultReader(stream) {
        return new ReadableStreamDefaultReader(stream);
      }
      function ReadableStreamAddReadRequest(stream, readRequest) {
        stream._reader._readRequests.push(readRequest);
      }
      function ReadableStreamFulfillReadRequest(stream, chunk, done) {
        const reader = stream._reader;
        const readRequest = reader._readRequests.shift();
        if (done) {
          readRequest._closeSteps();
        } else {
          readRequest._chunkSteps(chunk);
        }
      }
      function ReadableStreamGetNumReadRequests(stream) {
        return stream._reader._readRequests.length;
      }
      function ReadableStreamHasDefaultReader(stream) {
        const reader = stream._reader;
        if (reader === void 0) {
          return false;
        }
        if (!IsReadableStreamDefaultReader(reader)) {
          return false;
        }
        return true;
      }
      class ReadableStreamDefaultReader {
        constructor(stream) {
          assertRequiredArgument(stream, 1, "ReadableStreamDefaultReader");
          assertReadableStream(stream, "First parameter");
          if (IsReadableStreamLocked(stream)) {
            throw new TypeError("This stream has already been locked for exclusive reading by another reader");
          }
          ReadableStreamReaderGenericInitialize(this, stream);
          this._readRequests = new SimpleQueue();
        }
        get closed() {
          if (!IsReadableStreamDefaultReader(this)) {
            return promiseRejectedWith(defaultReaderBrandCheckException("closed"));
          }
          return this._closedPromise;
        }
        cancel(reason = void 0) {
          if (!IsReadableStreamDefaultReader(this)) {
            return promiseRejectedWith(defaultReaderBrandCheckException("cancel"));
          }
          if (this._ownerReadableStream === void 0) {
            return promiseRejectedWith(readerLockException("cancel"));
          }
          return ReadableStreamReaderGenericCancel(this, reason);
        }
        read() {
          if (!IsReadableStreamDefaultReader(this)) {
            return promiseRejectedWith(defaultReaderBrandCheckException("read"));
          }
          if (this._ownerReadableStream === void 0) {
            return promiseRejectedWith(readerLockException("read from"));
          }
          let resolvePromise;
          let rejectPromise;
          const promise = newPromise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
          });
          const readRequest = {
            _chunkSteps: (chunk) => resolvePromise({ value: chunk, done: false }),
            _closeSteps: () => resolvePromise({ value: void 0, done: true }),
            _errorSteps: (e) => rejectPromise(e)
          };
          ReadableStreamDefaultReaderRead(this, readRequest);
          return promise;
        }
        releaseLock() {
          if (!IsReadableStreamDefaultReader(this)) {
            throw defaultReaderBrandCheckException("releaseLock");
          }
          if (this._ownerReadableStream === void 0) {
            return;
          }
          if (this._readRequests.length > 0) {
            throw new TypeError("Tried to release a reader lock when that reader has pending read() calls un-settled");
          }
          ReadableStreamReaderGenericRelease(this);
        }
      }
      Object.defineProperties(ReadableStreamDefaultReader.prototype, {
        cancel: { enumerable: true },
        read: { enumerable: true },
        releaseLock: { enumerable: true },
        closed: { enumerable: true }
      });
      if (typeof SymbolPolyfill.toStringTag === "symbol") {
        Object.defineProperty(ReadableStreamDefaultReader.prototype, SymbolPolyfill.toStringTag, {
          value: "ReadableStreamDefaultReader",
          configurable: true
        });
      }
      function IsReadableStreamDefaultReader(x) {
        if (!typeIsObject(x)) {
          return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, "_readRequests")) {
          return false;
        }
        return x instanceof ReadableStreamDefaultReader;
      }
      function ReadableStreamDefaultReaderRead(reader, readRequest) {
        const stream = reader._ownerReadableStream;
        stream._disturbed = true;
        if (stream._state === "closed") {
          readRequest._closeSteps();
        } else if (stream._state === "errored") {
          readRequest._errorSteps(stream._storedError);
        } else {
          stream._readableStreamController[PullSteps](readRequest);
        }
      }
      function defaultReaderBrandCheckException(name) {
        return new TypeError(`ReadableStreamDefaultReader.prototype.${name} can only be used on a ReadableStreamDefaultReader`);
      }
      const AsyncIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(async function* () {
      }).prototype);
      class ReadableStreamAsyncIteratorImpl {
        constructor(reader, preventCancel) {
          this._ongoingPromise = void 0;
          this._isFinished = false;
          this._reader = reader;
          this._preventCancel = preventCancel;
        }
        next() {
          const nextSteps = () => this._nextSteps();
          this._ongoingPromise = this._ongoingPromise ? transformPromiseWith(this._ongoingPromise, nextSteps, nextSteps) : nextSteps();
          return this._ongoingPromise;
        }
        return(value) {
          const returnSteps = () => this._returnSteps(value);
          return this._ongoingPromise ? transformPromiseWith(this._ongoingPromise, returnSteps, returnSteps) : returnSteps();
        }
        _nextSteps() {
          if (this._isFinished) {
            return Promise.resolve({ value: void 0, done: true });
          }
          const reader = this._reader;
          if (reader._ownerReadableStream === void 0) {
            return promiseRejectedWith(readerLockException("iterate"));
          }
          let resolvePromise;
          let rejectPromise;
          const promise = newPromise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
          });
          const readRequest = {
            _chunkSteps: (chunk) => {
              this._ongoingPromise = void 0;
              queueMicrotask3(() => resolvePromise({ value: chunk, done: false }));
            },
            _closeSteps: () => {
              this._ongoingPromise = void 0;
              this._isFinished = true;
              ReadableStreamReaderGenericRelease(reader);
              resolvePromise({ value: void 0, done: true });
            },
            _errorSteps: (reason) => {
              this._ongoingPromise = void 0;
              this._isFinished = true;
              ReadableStreamReaderGenericRelease(reader);
              rejectPromise(reason);
            }
          };
          ReadableStreamDefaultReaderRead(reader, readRequest);
          return promise;
        }
        _returnSteps(value) {
          if (this._isFinished) {
            return Promise.resolve({ value, done: true });
          }
          this._isFinished = true;
          const reader = this._reader;
          if (reader._ownerReadableStream === void 0) {
            return promiseRejectedWith(readerLockException("finish iterating"));
          }
          if (!this._preventCancel) {
            const result = ReadableStreamReaderGenericCancel(reader, value);
            ReadableStreamReaderGenericRelease(reader);
            return transformPromiseWith(result, () => ({ value, done: true }));
          }
          ReadableStreamReaderGenericRelease(reader);
          return promiseResolvedWith({ value, done: true });
        }
      }
      const ReadableStreamAsyncIteratorPrototype = {
        next() {
          if (!IsReadableStreamAsyncIterator(this)) {
            return promiseRejectedWith(streamAsyncIteratorBrandCheckException("next"));
          }
          return this._asyncIteratorImpl.next();
        },
        return(value) {
          if (!IsReadableStreamAsyncIterator(this)) {
            return promiseRejectedWith(streamAsyncIteratorBrandCheckException("return"));
          }
          return this._asyncIteratorImpl.return(value);
        }
      };
      if (AsyncIteratorPrototype !== void 0) {
        Object.setPrototypeOf(ReadableStreamAsyncIteratorPrototype, AsyncIteratorPrototype);
      }
      function AcquireReadableStreamAsyncIterator(stream, preventCancel) {
        const reader = AcquireReadableStreamDefaultReader(stream);
        const impl = new ReadableStreamAsyncIteratorImpl(reader, preventCancel);
        const iterator = Object.create(ReadableStreamAsyncIteratorPrototype);
        iterator._asyncIteratorImpl = impl;
        return iterator;
      }
      function IsReadableStreamAsyncIterator(x) {
        if (!typeIsObject(x)) {
          return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, "_asyncIteratorImpl")) {
          return false;
        }
        try {
          return x._asyncIteratorImpl instanceof ReadableStreamAsyncIteratorImpl;
        } catch (_a3) {
          return false;
        }
      }
      function streamAsyncIteratorBrandCheckException(name) {
        return new TypeError(`ReadableStreamAsyncIterator.${name} can only be used on a ReadableSteamAsyncIterator`);
      }
      const NumberIsNaN = Number.isNaN || function(x) {
        return x !== x;
      };
      function CreateArrayFromList(elements) {
        return elements.slice();
      }
      function CopyDataBlockBytes(dest, destOffset, src, srcOffset, n) {
        new Uint8Array(dest).set(new Uint8Array(src, srcOffset, n), destOffset);
      }
      function TransferArrayBuffer(O) {
        return O;
      }
      function IsDetachedBuffer(O) {
        return false;
      }
      function ArrayBufferSlice(buffer, begin, end) {
        if (buffer.slice) {
          return buffer.slice(begin, end);
        }
        const length = end - begin;
        const slice = new ArrayBuffer(length);
        CopyDataBlockBytes(slice, 0, buffer, begin, length);
        return slice;
      }
      function IsNonNegativeNumber(v) {
        if (typeof v !== "number") {
          return false;
        }
        if (NumberIsNaN(v)) {
          return false;
        }
        if (v < 0) {
          return false;
        }
        return true;
      }
      function CloneAsUint8Array(O) {
        const buffer = ArrayBufferSlice(O.buffer, O.byteOffset, O.byteOffset + O.byteLength);
        return new Uint8Array(buffer);
      }
      function DequeueValue(container) {
        const pair = container._queue.shift();
        container._queueTotalSize -= pair.size;
        if (container._queueTotalSize < 0) {
          container._queueTotalSize = 0;
        }
        return pair.value;
      }
      function EnqueueValueWithSize(container, value, size) {
        if (!IsNonNegativeNumber(size) || size === Infinity) {
          throw new RangeError("Size must be a finite, non-NaN, non-negative number.");
        }
        container._queue.push({ value, size });
        container._queueTotalSize += size;
      }
      function PeekQueueValue(container) {
        const pair = container._queue.peek();
        return pair.value;
      }
      function ResetQueue(container) {
        container._queue = new SimpleQueue();
        container._queueTotalSize = 0;
      }
      class ReadableStreamBYOBRequest {
        constructor() {
          throw new TypeError("Illegal constructor");
        }
        get view() {
          if (!IsReadableStreamBYOBRequest(this)) {
            throw byobRequestBrandCheckException("view");
          }
          return this._view;
        }
        respond(bytesWritten) {
          if (!IsReadableStreamBYOBRequest(this)) {
            throw byobRequestBrandCheckException("respond");
          }
          assertRequiredArgument(bytesWritten, 1, "respond");
          bytesWritten = convertUnsignedLongLongWithEnforceRange(bytesWritten, "First parameter");
          if (this._associatedReadableByteStreamController === void 0) {
            throw new TypeError("This BYOB request has been invalidated");
          }
          if (IsDetachedBuffer(this._view.buffer))
            ;
          ReadableByteStreamControllerRespond(this._associatedReadableByteStreamController, bytesWritten);
        }
        respondWithNewView(view) {
          if (!IsReadableStreamBYOBRequest(this)) {
            throw byobRequestBrandCheckException("respondWithNewView");
          }
          assertRequiredArgument(view, 1, "respondWithNewView");
          if (!ArrayBuffer.isView(view)) {
            throw new TypeError("You can only respond with array buffer views");
          }
          if (this._associatedReadableByteStreamController === void 0) {
            throw new TypeError("This BYOB request has been invalidated");
          }
          if (IsDetachedBuffer(view.buffer))
            ;
          ReadableByteStreamControllerRespondWithNewView(this._associatedReadableByteStreamController, view);
        }
      }
      Object.defineProperties(ReadableStreamBYOBRequest.prototype, {
        respond: { enumerable: true },
        respondWithNewView: { enumerable: true },
        view: { enumerable: true }
      });
      if (typeof SymbolPolyfill.toStringTag === "symbol") {
        Object.defineProperty(ReadableStreamBYOBRequest.prototype, SymbolPolyfill.toStringTag, {
          value: "ReadableStreamBYOBRequest",
          configurable: true
        });
      }
      class ReadableByteStreamController {
        constructor() {
          throw new TypeError("Illegal constructor");
        }
        get byobRequest() {
          if (!IsReadableByteStreamController(this)) {
            throw byteStreamControllerBrandCheckException("byobRequest");
          }
          return ReadableByteStreamControllerGetBYOBRequest(this);
        }
        get desiredSize() {
          if (!IsReadableByteStreamController(this)) {
            throw byteStreamControllerBrandCheckException("desiredSize");
          }
          return ReadableByteStreamControllerGetDesiredSize(this);
        }
        close() {
          if (!IsReadableByteStreamController(this)) {
            throw byteStreamControllerBrandCheckException("close");
          }
          if (this._closeRequested) {
            throw new TypeError("The stream has already been closed; do not close it again!");
          }
          const state = this._controlledReadableByteStream._state;
          if (state !== "readable") {
            throw new TypeError(`The stream (in ${state} state) is not in the readable state and cannot be closed`);
          }
          ReadableByteStreamControllerClose(this);
        }
        enqueue(chunk) {
          if (!IsReadableByteStreamController(this)) {
            throw byteStreamControllerBrandCheckException("enqueue");
          }
          assertRequiredArgument(chunk, 1, "enqueue");
          if (!ArrayBuffer.isView(chunk)) {
            throw new TypeError("chunk must be an array buffer view");
          }
          if (chunk.byteLength === 0) {
            throw new TypeError("chunk must have non-zero byteLength");
          }
          if (chunk.buffer.byteLength === 0) {
            throw new TypeError(`chunk's buffer must have non-zero byteLength`);
          }
          if (this._closeRequested) {
            throw new TypeError("stream is closed or draining");
          }
          const state = this._controlledReadableByteStream._state;
          if (state !== "readable") {
            throw new TypeError(`The stream (in ${state} state) is not in the readable state and cannot be enqueued to`);
          }
          ReadableByteStreamControllerEnqueue(this, chunk);
        }
        error(e = void 0) {
          if (!IsReadableByteStreamController(this)) {
            throw byteStreamControllerBrandCheckException("error");
          }
          ReadableByteStreamControllerError(this, e);
        }
        [CancelSteps](reason) {
          ReadableByteStreamControllerClearPendingPullIntos(this);
          ResetQueue(this);
          const result = this._cancelAlgorithm(reason);
          ReadableByteStreamControllerClearAlgorithms(this);
          return result;
        }
        [PullSteps](readRequest) {
          const stream = this._controlledReadableByteStream;
          if (this._queueTotalSize > 0) {
            const entry = this._queue.shift();
            this._queueTotalSize -= entry.byteLength;
            ReadableByteStreamControllerHandleQueueDrain(this);
            const view = new Uint8Array(entry.buffer, entry.byteOffset, entry.byteLength);
            readRequest._chunkSteps(view);
            return;
          }
          const autoAllocateChunkSize = this._autoAllocateChunkSize;
          if (autoAllocateChunkSize !== void 0) {
            let buffer;
            try {
              buffer = new ArrayBuffer(autoAllocateChunkSize);
            } catch (bufferE) {
              readRequest._errorSteps(bufferE);
              return;
            }
            const pullIntoDescriptor = {
              buffer,
              bufferByteLength: autoAllocateChunkSize,
              byteOffset: 0,
              byteLength: autoAllocateChunkSize,
              bytesFilled: 0,
              elementSize: 1,
              viewConstructor: Uint8Array,
              readerType: "default"
            };
            this._pendingPullIntos.push(pullIntoDescriptor);
          }
          ReadableStreamAddReadRequest(stream, readRequest);
          ReadableByteStreamControllerCallPullIfNeeded(this);
        }
      }
      Object.defineProperties(ReadableByteStreamController.prototype, {
        close: { enumerable: true },
        enqueue: { enumerable: true },
        error: { enumerable: true },
        byobRequest: { enumerable: true },
        desiredSize: { enumerable: true }
      });
      if (typeof SymbolPolyfill.toStringTag === "symbol") {
        Object.defineProperty(ReadableByteStreamController.prototype, SymbolPolyfill.toStringTag, {
          value: "ReadableByteStreamController",
          configurable: true
        });
      }
      function IsReadableByteStreamController(x) {
        if (!typeIsObject(x)) {
          return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, "_controlledReadableByteStream")) {
          return false;
        }
        return x instanceof ReadableByteStreamController;
      }
      function IsReadableStreamBYOBRequest(x) {
        if (!typeIsObject(x)) {
          return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, "_associatedReadableByteStreamController")) {
          return false;
        }
        return x instanceof ReadableStreamBYOBRequest;
      }
      function ReadableByteStreamControllerCallPullIfNeeded(controller) {
        const shouldPull = ReadableByteStreamControllerShouldCallPull(controller);
        if (!shouldPull) {
          return;
        }
        if (controller._pulling) {
          controller._pullAgain = true;
          return;
        }
        controller._pulling = true;
        const pullPromise = controller._pullAlgorithm();
        uponPromise(pullPromise, () => {
          controller._pulling = false;
          if (controller._pullAgain) {
            controller._pullAgain = false;
            ReadableByteStreamControllerCallPullIfNeeded(controller);
          }
        }, (e) => {
          ReadableByteStreamControllerError(controller, e);
        });
      }
      function ReadableByteStreamControllerClearPendingPullIntos(controller) {
        ReadableByteStreamControllerInvalidateBYOBRequest(controller);
        controller._pendingPullIntos = new SimpleQueue();
      }
      function ReadableByteStreamControllerCommitPullIntoDescriptor(stream, pullIntoDescriptor) {
        let done = false;
        if (stream._state === "closed") {
          done = true;
        }
        const filledView = ReadableByteStreamControllerConvertPullIntoDescriptor(pullIntoDescriptor);
        if (pullIntoDescriptor.readerType === "default") {
          ReadableStreamFulfillReadRequest(stream, filledView, done);
        } else {
          ReadableStreamFulfillReadIntoRequest(stream, filledView, done);
        }
      }
      function ReadableByteStreamControllerConvertPullIntoDescriptor(pullIntoDescriptor) {
        const bytesFilled = pullIntoDescriptor.bytesFilled;
        const elementSize = pullIntoDescriptor.elementSize;
        return new pullIntoDescriptor.viewConstructor(pullIntoDescriptor.buffer, pullIntoDescriptor.byteOffset, bytesFilled / elementSize);
      }
      function ReadableByteStreamControllerEnqueueChunkToQueue(controller, buffer, byteOffset, byteLength) {
        controller._queue.push({ buffer, byteOffset, byteLength });
        controller._queueTotalSize += byteLength;
      }
      function ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor) {
        const elementSize = pullIntoDescriptor.elementSize;
        const currentAlignedBytes = pullIntoDescriptor.bytesFilled - pullIntoDescriptor.bytesFilled % elementSize;
        const maxBytesToCopy = Math.min(controller._queueTotalSize, pullIntoDescriptor.byteLength - pullIntoDescriptor.bytesFilled);
        const maxBytesFilled = pullIntoDescriptor.bytesFilled + maxBytesToCopy;
        const maxAlignedBytes = maxBytesFilled - maxBytesFilled % elementSize;
        let totalBytesToCopyRemaining = maxBytesToCopy;
        let ready = false;
        if (maxAlignedBytes > currentAlignedBytes) {
          totalBytesToCopyRemaining = maxAlignedBytes - pullIntoDescriptor.bytesFilled;
          ready = true;
        }
        const queue = controller._queue;
        while (totalBytesToCopyRemaining > 0) {
          const headOfQueue = queue.peek();
          const bytesToCopy = Math.min(totalBytesToCopyRemaining, headOfQueue.byteLength);
          const destStart = pullIntoDescriptor.byteOffset + pullIntoDescriptor.bytesFilled;
          CopyDataBlockBytes(pullIntoDescriptor.buffer, destStart, headOfQueue.buffer, headOfQueue.byteOffset, bytesToCopy);
          if (headOfQueue.byteLength === bytesToCopy) {
            queue.shift();
          } else {
            headOfQueue.byteOffset += bytesToCopy;
            headOfQueue.byteLength -= bytesToCopy;
          }
          controller._queueTotalSize -= bytesToCopy;
          ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, bytesToCopy, pullIntoDescriptor);
          totalBytesToCopyRemaining -= bytesToCopy;
        }
        return ready;
      }
      function ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, size, pullIntoDescriptor) {
        pullIntoDescriptor.bytesFilled += size;
      }
      function ReadableByteStreamControllerHandleQueueDrain(controller) {
        if (controller._queueTotalSize === 0 && controller._closeRequested) {
          ReadableByteStreamControllerClearAlgorithms(controller);
          ReadableStreamClose(controller._controlledReadableByteStream);
        } else {
          ReadableByteStreamControllerCallPullIfNeeded(controller);
        }
      }
      function ReadableByteStreamControllerInvalidateBYOBRequest(controller) {
        if (controller._byobRequest === null) {
          return;
        }
        controller._byobRequest._associatedReadableByteStreamController = void 0;
        controller._byobRequest._view = null;
        controller._byobRequest = null;
      }
      function ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller) {
        while (controller._pendingPullIntos.length > 0) {
          if (controller._queueTotalSize === 0) {
            return;
          }
          const pullIntoDescriptor = controller._pendingPullIntos.peek();
          if (ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor)) {
            ReadableByteStreamControllerShiftPendingPullInto(controller);
            ReadableByteStreamControllerCommitPullIntoDescriptor(controller._controlledReadableByteStream, pullIntoDescriptor);
          }
        }
      }
      function ReadableByteStreamControllerPullInto(controller, view, readIntoRequest) {
        const stream = controller._controlledReadableByteStream;
        let elementSize = 1;
        if (view.constructor !== DataView) {
          elementSize = view.constructor.BYTES_PER_ELEMENT;
        }
        const ctor = view.constructor;
        const buffer = TransferArrayBuffer(view.buffer);
        const pullIntoDescriptor = {
          buffer,
          bufferByteLength: buffer.byteLength,
          byteOffset: view.byteOffset,
          byteLength: view.byteLength,
          bytesFilled: 0,
          elementSize,
          viewConstructor: ctor,
          readerType: "byob"
        };
        if (controller._pendingPullIntos.length > 0) {
          controller._pendingPullIntos.push(pullIntoDescriptor);
          ReadableStreamAddReadIntoRequest(stream, readIntoRequest);
          return;
        }
        if (stream._state === "closed") {
          const emptyView = new ctor(pullIntoDescriptor.buffer, pullIntoDescriptor.byteOffset, 0);
          readIntoRequest._closeSteps(emptyView);
          return;
        }
        if (controller._queueTotalSize > 0) {
          if (ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor)) {
            const filledView = ReadableByteStreamControllerConvertPullIntoDescriptor(pullIntoDescriptor);
            ReadableByteStreamControllerHandleQueueDrain(controller);
            readIntoRequest._chunkSteps(filledView);
            return;
          }
          if (controller._closeRequested) {
            const e = new TypeError("Insufficient bytes to fill elements in the given buffer");
            ReadableByteStreamControllerError(controller, e);
            readIntoRequest._errorSteps(e);
            return;
          }
        }
        controller._pendingPullIntos.push(pullIntoDescriptor);
        ReadableStreamAddReadIntoRequest(stream, readIntoRequest);
        ReadableByteStreamControllerCallPullIfNeeded(controller);
      }
      function ReadableByteStreamControllerRespondInClosedState(controller, firstDescriptor) {
        const stream = controller._controlledReadableByteStream;
        if (ReadableStreamHasBYOBReader(stream)) {
          while (ReadableStreamGetNumReadIntoRequests(stream) > 0) {
            const pullIntoDescriptor = ReadableByteStreamControllerShiftPendingPullInto(controller);
            ReadableByteStreamControllerCommitPullIntoDescriptor(stream, pullIntoDescriptor);
          }
        }
      }
      function ReadableByteStreamControllerRespondInReadableState(controller, bytesWritten, pullIntoDescriptor) {
        ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, bytesWritten, pullIntoDescriptor);
        if (pullIntoDescriptor.bytesFilled < pullIntoDescriptor.elementSize) {
          return;
        }
        ReadableByteStreamControllerShiftPendingPullInto(controller);
        const remainderSize = pullIntoDescriptor.bytesFilled % pullIntoDescriptor.elementSize;
        if (remainderSize > 0) {
          const end = pullIntoDescriptor.byteOffset + pullIntoDescriptor.bytesFilled;
          const remainder = ArrayBufferSlice(pullIntoDescriptor.buffer, end - remainderSize, end);
          ReadableByteStreamControllerEnqueueChunkToQueue(controller, remainder, 0, remainder.byteLength);
        }
        pullIntoDescriptor.bytesFilled -= remainderSize;
        ReadableByteStreamControllerCommitPullIntoDescriptor(controller._controlledReadableByteStream, pullIntoDescriptor);
        ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller);
      }
      function ReadableByteStreamControllerRespondInternal(controller, bytesWritten) {
        const firstDescriptor = controller._pendingPullIntos.peek();
        ReadableByteStreamControllerInvalidateBYOBRequest(controller);
        const state = controller._controlledReadableByteStream._state;
        if (state === "closed") {
          ReadableByteStreamControllerRespondInClosedState(controller);
        } else {
          ReadableByteStreamControllerRespondInReadableState(controller, bytesWritten, firstDescriptor);
        }
        ReadableByteStreamControllerCallPullIfNeeded(controller);
      }
      function ReadableByteStreamControllerShiftPendingPullInto(controller) {
        const descriptor = controller._pendingPullIntos.shift();
        return descriptor;
      }
      function ReadableByteStreamControllerShouldCallPull(controller) {
        const stream = controller._controlledReadableByteStream;
        if (stream._state !== "readable") {
          return false;
        }
        if (controller._closeRequested) {
          return false;
        }
        if (!controller._started) {
          return false;
        }
        if (ReadableStreamHasDefaultReader(stream) && ReadableStreamGetNumReadRequests(stream) > 0) {
          return true;
        }
        if (ReadableStreamHasBYOBReader(stream) && ReadableStreamGetNumReadIntoRequests(stream) > 0) {
          return true;
        }
        const desiredSize = ReadableByteStreamControllerGetDesiredSize(controller);
        if (desiredSize > 0) {
          return true;
        }
        return false;
      }
      function ReadableByteStreamControllerClearAlgorithms(controller) {
        controller._pullAlgorithm = void 0;
        controller._cancelAlgorithm = void 0;
      }
      function ReadableByteStreamControllerClose(controller) {
        const stream = controller._controlledReadableByteStream;
        if (controller._closeRequested || stream._state !== "readable") {
          return;
        }
        if (controller._queueTotalSize > 0) {
          controller._closeRequested = true;
          return;
        }
        if (controller._pendingPullIntos.length > 0) {
          const firstPendingPullInto = controller._pendingPullIntos.peek();
          if (firstPendingPullInto.bytesFilled > 0) {
            const e = new TypeError("Insufficient bytes to fill elements in the given buffer");
            ReadableByteStreamControllerError(controller, e);
            throw e;
          }
        }
        ReadableByteStreamControllerClearAlgorithms(controller);
        ReadableStreamClose(stream);
      }
      function ReadableByteStreamControllerEnqueue(controller, chunk) {
        const stream = controller._controlledReadableByteStream;
        if (controller._closeRequested || stream._state !== "readable") {
          return;
        }
        const buffer = chunk.buffer;
        const byteOffset = chunk.byteOffset;
        const byteLength = chunk.byteLength;
        const transferredBuffer = TransferArrayBuffer(buffer);
        if (controller._pendingPullIntos.length > 0) {
          const firstPendingPullInto = controller._pendingPullIntos.peek();
          if (IsDetachedBuffer(firstPendingPullInto.buffer))
            ;
          firstPendingPullInto.buffer = TransferArrayBuffer(firstPendingPullInto.buffer);
        }
        ReadableByteStreamControllerInvalidateBYOBRequest(controller);
        if (ReadableStreamHasDefaultReader(stream)) {
          if (ReadableStreamGetNumReadRequests(stream) === 0) {
            ReadableByteStreamControllerEnqueueChunkToQueue(controller, transferredBuffer, byteOffset, byteLength);
          } else {
            if (controller._pendingPullIntos.length > 0) {
              ReadableByteStreamControllerShiftPendingPullInto(controller);
            }
            const transferredView = new Uint8Array(transferredBuffer, byteOffset, byteLength);
            ReadableStreamFulfillReadRequest(stream, transferredView, false);
          }
        } else if (ReadableStreamHasBYOBReader(stream)) {
          ReadableByteStreamControllerEnqueueChunkToQueue(controller, transferredBuffer, byteOffset, byteLength);
          ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller);
        } else {
          ReadableByteStreamControllerEnqueueChunkToQueue(controller, transferredBuffer, byteOffset, byteLength);
        }
        ReadableByteStreamControllerCallPullIfNeeded(controller);
      }
      function ReadableByteStreamControllerError(controller, e) {
        const stream = controller._controlledReadableByteStream;
        if (stream._state !== "readable") {
          return;
        }
        ReadableByteStreamControllerClearPendingPullIntos(controller);
        ResetQueue(controller);
        ReadableByteStreamControllerClearAlgorithms(controller);
        ReadableStreamError(stream, e);
      }
      function ReadableByteStreamControllerGetBYOBRequest(controller) {
        if (controller._byobRequest === null && controller._pendingPullIntos.length > 0) {
          const firstDescriptor = controller._pendingPullIntos.peek();
          const view = new Uint8Array(firstDescriptor.buffer, firstDescriptor.byteOffset + firstDescriptor.bytesFilled, firstDescriptor.byteLength - firstDescriptor.bytesFilled);
          const byobRequest = Object.create(ReadableStreamBYOBRequest.prototype);
          SetUpReadableStreamBYOBRequest(byobRequest, controller, view);
          controller._byobRequest = byobRequest;
        }
        return controller._byobRequest;
      }
      function ReadableByteStreamControllerGetDesiredSize(controller) {
        const state = controller._controlledReadableByteStream._state;
        if (state === "errored") {
          return null;
        }
        if (state === "closed") {
          return 0;
        }
        return controller._strategyHWM - controller._queueTotalSize;
      }
      function ReadableByteStreamControllerRespond(controller, bytesWritten) {
        const firstDescriptor = controller._pendingPullIntos.peek();
        const state = controller._controlledReadableByteStream._state;
        if (state === "closed") {
          if (bytesWritten !== 0) {
            throw new TypeError("bytesWritten must be 0 when calling respond() on a closed stream");
          }
        } else {
          if (bytesWritten === 0) {
            throw new TypeError("bytesWritten must be greater than 0 when calling respond() on a readable stream");
          }
          if (firstDescriptor.bytesFilled + bytesWritten > firstDescriptor.byteLength) {
            throw new RangeError("bytesWritten out of range");
          }
        }
        firstDescriptor.buffer = TransferArrayBuffer(firstDescriptor.buffer);
        ReadableByteStreamControllerRespondInternal(controller, bytesWritten);
      }
      function ReadableByteStreamControllerRespondWithNewView(controller, view) {
        const firstDescriptor = controller._pendingPullIntos.peek();
        const state = controller._controlledReadableByteStream._state;
        if (state === "closed") {
          if (view.byteLength !== 0) {
            throw new TypeError("The view's length must be 0 when calling respondWithNewView() on a closed stream");
          }
        } else {
          if (view.byteLength === 0) {
            throw new TypeError("The view's length must be greater than 0 when calling respondWithNewView() on a readable stream");
          }
        }
        if (firstDescriptor.byteOffset + firstDescriptor.bytesFilled !== view.byteOffset) {
          throw new RangeError("The region specified by view does not match byobRequest");
        }
        if (firstDescriptor.bufferByteLength !== view.buffer.byteLength) {
          throw new RangeError("The buffer of view has different capacity than byobRequest");
        }
        if (firstDescriptor.bytesFilled + view.byteLength > firstDescriptor.byteLength) {
          throw new RangeError("The region specified by view is larger than byobRequest");
        }
        const viewByteLength = view.byteLength;
        firstDescriptor.buffer = TransferArrayBuffer(view.buffer);
        ReadableByteStreamControllerRespondInternal(controller, viewByteLength);
      }
      function SetUpReadableByteStreamController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, autoAllocateChunkSize) {
        controller._controlledReadableByteStream = stream;
        controller._pullAgain = false;
        controller._pulling = false;
        controller._byobRequest = null;
        controller._queue = controller._queueTotalSize = void 0;
        ResetQueue(controller);
        controller._closeRequested = false;
        controller._started = false;
        controller._strategyHWM = highWaterMark;
        controller._pullAlgorithm = pullAlgorithm;
        controller._cancelAlgorithm = cancelAlgorithm;
        controller._autoAllocateChunkSize = autoAllocateChunkSize;
        controller._pendingPullIntos = new SimpleQueue();
        stream._readableStreamController = controller;
        const startResult = startAlgorithm();
        uponPromise(promiseResolvedWith(startResult), () => {
          controller._started = true;
          ReadableByteStreamControllerCallPullIfNeeded(controller);
        }, (r) => {
          ReadableByteStreamControllerError(controller, r);
        });
      }
      function SetUpReadableByteStreamControllerFromUnderlyingSource(stream, underlyingByteSource, highWaterMark) {
        const controller = Object.create(ReadableByteStreamController.prototype);
        let startAlgorithm = () => void 0;
        let pullAlgorithm = () => promiseResolvedWith(void 0);
        let cancelAlgorithm = () => promiseResolvedWith(void 0);
        if (underlyingByteSource.start !== void 0) {
          startAlgorithm = () => underlyingByteSource.start(controller);
        }
        if (underlyingByteSource.pull !== void 0) {
          pullAlgorithm = () => underlyingByteSource.pull(controller);
        }
        if (underlyingByteSource.cancel !== void 0) {
          cancelAlgorithm = (reason) => underlyingByteSource.cancel(reason);
        }
        const autoAllocateChunkSize = underlyingByteSource.autoAllocateChunkSize;
        if (autoAllocateChunkSize === 0) {
          throw new TypeError("autoAllocateChunkSize must be greater than 0");
        }
        SetUpReadableByteStreamController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, autoAllocateChunkSize);
      }
      function SetUpReadableStreamBYOBRequest(request, controller, view) {
        request._associatedReadableByteStreamController = controller;
        request._view = view;
      }
      function byobRequestBrandCheckException(name) {
        return new TypeError(`ReadableStreamBYOBRequest.prototype.${name} can only be used on a ReadableStreamBYOBRequest`);
      }
      function byteStreamControllerBrandCheckException(name) {
        return new TypeError(`ReadableByteStreamController.prototype.${name} can only be used on a ReadableByteStreamController`);
      }
      function AcquireReadableStreamBYOBReader(stream) {
        return new ReadableStreamBYOBReader(stream);
      }
      function ReadableStreamAddReadIntoRequest(stream, readIntoRequest) {
        stream._reader._readIntoRequests.push(readIntoRequest);
      }
      function ReadableStreamFulfillReadIntoRequest(stream, chunk, done) {
        const reader = stream._reader;
        const readIntoRequest = reader._readIntoRequests.shift();
        if (done) {
          readIntoRequest._closeSteps(chunk);
        } else {
          readIntoRequest._chunkSteps(chunk);
        }
      }
      function ReadableStreamGetNumReadIntoRequests(stream) {
        return stream._reader._readIntoRequests.length;
      }
      function ReadableStreamHasBYOBReader(stream) {
        const reader = stream._reader;
        if (reader === void 0) {
          return false;
        }
        if (!IsReadableStreamBYOBReader(reader)) {
          return false;
        }
        return true;
      }
      class ReadableStreamBYOBReader {
        constructor(stream) {
          assertRequiredArgument(stream, 1, "ReadableStreamBYOBReader");
          assertReadableStream(stream, "First parameter");
          if (IsReadableStreamLocked(stream)) {
            throw new TypeError("This stream has already been locked for exclusive reading by another reader");
          }
          if (!IsReadableByteStreamController(stream._readableStreamController)) {
            throw new TypeError("Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte source");
          }
          ReadableStreamReaderGenericInitialize(this, stream);
          this._readIntoRequests = new SimpleQueue();
        }
        get closed() {
          if (!IsReadableStreamBYOBReader(this)) {
            return promiseRejectedWith(byobReaderBrandCheckException("closed"));
          }
          return this._closedPromise;
        }
        cancel(reason = void 0) {
          if (!IsReadableStreamBYOBReader(this)) {
            return promiseRejectedWith(byobReaderBrandCheckException("cancel"));
          }
          if (this._ownerReadableStream === void 0) {
            return promiseRejectedWith(readerLockException("cancel"));
          }
          return ReadableStreamReaderGenericCancel(this, reason);
        }
        read(view) {
          if (!IsReadableStreamBYOBReader(this)) {
            return promiseRejectedWith(byobReaderBrandCheckException("read"));
          }
          if (!ArrayBuffer.isView(view)) {
            return promiseRejectedWith(new TypeError("view must be an array buffer view"));
          }
          if (view.byteLength === 0) {
            return promiseRejectedWith(new TypeError("view must have non-zero byteLength"));
          }
          if (view.buffer.byteLength === 0) {
            return promiseRejectedWith(new TypeError(`view's buffer must have non-zero byteLength`));
          }
          if (IsDetachedBuffer(view.buffer))
            ;
          if (this._ownerReadableStream === void 0) {
            return promiseRejectedWith(readerLockException("read from"));
          }
          let resolvePromise;
          let rejectPromise;
          const promise = newPromise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
          });
          const readIntoRequest = {
            _chunkSteps: (chunk) => resolvePromise({ value: chunk, done: false }),
            _closeSteps: (chunk) => resolvePromise({ value: chunk, done: true }),
            _errorSteps: (e) => rejectPromise(e)
          };
          ReadableStreamBYOBReaderRead(this, view, readIntoRequest);
          return promise;
        }
        releaseLock() {
          if (!IsReadableStreamBYOBReader(this)) {
            throw byobReaderBrandCheckException("releaseLock");
          }
          if (this._ownerReadableStream === void 0) {
            return;
          }
          if (this._readIntoRequests.length > 0) {
            throw new TypeError("Tried to release a reader lock when that reader has pending read() calls un-settled");
          }
          ReadableStreamReaderGenericRelease(this);
        }
      }
      Object.defineProperties(ReadableStreamBYOBReader.prototype, {
        cancel: { enumerable: true },
        read: { enumerable: true },
        releaseLock: { enumerable: true },
        closed: { enumerable: true }
      });
      if (typeof SymbolPolyfill.toStringTag === "symbol") {
        Object.defineProperty(ReadableStreamBYOBReader.prototype, SymbolPolyfill.toStringTag, {
          value: "ReadableStreamBYOBReader",
          configurable: true
        });
      }
      function IsReadableStreamBYOBReader(x) {
        if (!typeIsObject(x)) {
          return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, "_readIntoRequests")) {
          return false;
        }
        return x instanceof ReadableStreamBYOBReader;
      }
      function ReadableStreamBYOBReaderRead(reader, view, readIntoRequest) {
        const stream = reader._ownerReadableStream;
        stream._disturbed = true;
        if (stream._state === "errored") {
          readIntoRequest._errorSteps(stream._storedError);
        } else {
          ReadableByteStreamControllerPullInto(stream._readableStreamController, view, readIntoRequest);
        }
      }
      function byobReaderBrandCheckException(name) {
        return new TypeError(`ReadableStreamBYOBReader.prototype.${name} can only be used on a ReadableStreamBYOBReader`);
      }
      function ExtractHighWaterMark(strategy, defaultHWM) {
        const { highWaterMark } = strategy;
        if (highWaterMark === void 0) {
          return defaultHWM;
        }
        if (NumberIsNaN(highWaterMark) || highWaterMark < 0) {
          throw new RangeError("Invalid highWaterMark");
        }
        return highWaterMark;
      }
      function ExtractSizeAlgorithm(strategy) {
        const { size } = strategy;
        if (!size) {
          return () => 1;
        }
        return size;
      }
      function convertQueuingStrategy(init2, context) {
        assertDictionary(init2, context);
        const highWaterMark = init2 === null || init2 === void 0 ? void 0 : init2.highWaterMark;
        const size = init2 === null || init2 === void 0 ? void 0 : init2.size;
        return {
          highWaterMark: highWaterMark === void 0 ? void 0 : convertUnrestrictedDouble(highWaterMark),
          size: size === void 0 ? void 0 : convertQueuingStrategySize(size, `${context} has member 'size' that`)
        };
      }
      function convertQueuingStrategySize(fn, context) {
        assertFunction(fn, context);
        return (chunk) => convertUnrestrictedDouble(fn(chunk));
      }
      function convertUnderlyingSink(original, context) {
        assertDictionary(original, context);
        const abort = original === null || original === void 0 ? void 0 : original.abort;
        const close = original === null || original === void 0 ? void 0 : original.close;
        const start = original === null || original === void 0 ? void 0 : original.start;
        const type = original === null || original === void 0 ? void 0 : original.type;
        const write = original === null || original === void 0 ? void 0 : original.write;
        return {
          abort: abort === void 0 ? void 0 : convertUnderlyingSinkAbortCallback(abort, original, `${context} has member 'abort' that`),
          close: close === void 0 ? void 0 : convertUnderlyingSinkCloseCallback(close, original, `${context} has member 'close' that`),
          start: start === void 0 ? void 0 : convertUnderlyingSinkStartCallback(start, original, `${context} has member 'start' that`),
          write: write === void 0 ? void 0 : convertUnderlyingSinkWriteCallback(write, original, `${context} has member 'write' that`),
          type
        };
      }
      function convertUnderlyingSinkAbortCallback(fn, original, context) {
        assertFunction(fn, context);
        return (reason) => promiseCall(fn, original, [reason]);
      }
      function convertUnderlyingSinkCloseCallback(fn, original, context) {
        assertFunction(fn, context);
        return () => promiseCall(fn, original, []);
      }
      function convertUnderlyingSinkStartCallback(fn, original, context) {
        assertFunction(fn, context);
        return (controller) => reflectCall(fn, original, [controller]);
      }
      function convertUnderlyingSinkWriteCallback(fn, original, context) {
        assertFunction(fn, context);
        return (chunk, controller) => promiseCall(fn, original, [chunk, controller]);
      }
      function assertWritableStream(x, context) {
        if (!IsWritableStream(x)) {
          throw new TypeError(`${context} is not a WritableStream.`);
        }
      }
      function isAbortSignal(value) {
        if (typeof value !== "object" || value === null) {
          return false;
        }
        try {
          return typeof value.aborted === "boolean";
        } catch (_a3) {
          return false;
        }
      }
      const supportsAbortController = typeof AbortController === "function";
      function createAbortController() {
        if (supportsAbortController) {
          return new AbortController();
        }
        return void 0;
      }
      class WritableStream2 {
        constructor(rawUnderlyingSink = {}, rawStrategy = {}) {
          if (rawUnderlyingSink === void 0) {
            rawUnderlyingSink = null;
          } else {
            assertObject(rawUnderlyingSink, "First parameter");
          }
          const strategy = convertQueuingStrategy(rawStrategy, "Second parameter");
          const underlyingSink = convertUnderlyingSink(rawUnderlyingSink, "First parameter");
          InitializeWritableStream(this);
          const type = underlyingSink.type;
          if (type !== void 0) {
            throw new RangeError("Invalid type is specified");
          }
          const sizeAlgorithm = ExtractSizeAlgorithm(strategy);
          const highWaterMark = ExtractHighWaterMark(strategy, 1);
          SetUpWritableStreamDefaultControllerFromUnderlyingSink(this, underlyingSink, highWaterMark, sizeAlgorithm);
        }
        get locked() {
          if (!IsWritableStream(this)) {
            throw streamBrandCheckException$2("locked");
          }
          return IsWritableStreamLocked(this);
        }
        abort(reason = void 0) {
          if (!IsWritableStream(this)) {
            return promiseRejectedWith(streamBrandCheckException$2("abort"));
          }
          if (IsWritableStreamLocked(this)) {
            return promiseRejectedWith(new TypeError("Cannot abort a stream that already has a writer"));
          }
          return WritableStreamAbort(this, reason);
        }
        close() {
          if (!IsWritableStream(this)) {
            return promiseRejectedWith(streamBrandCheckException$2("close"));
          }
          if (IsWritableStreamLocked(this)) {
            return promiseRejectedWith(new TypeError("Cannot close a stream that already has a writer"));
          }
          if (WritableStreamCloseQueuedOrInFlight(this)) {
            return promiseRejectedWith(new TypeError("Cannot close an already-closing stream"));
          }
          return WritableStreamClose(this);
        }
        getWriter() {
          if (!IsWritableStream(this)) {
            throw streamBrandCheckException$2("getWriter");
          }
          return AcquireWritableStreamDefaultWriter(this);
        }
      }
      Object.defineProperties(WritableStream2.prototype, {
        abort: { enumerable: true },
        close: { enumerable: true },
        getWriter: { enumerable: true },
        locked: { enumerable: true }
      });
      if (typeof SymbolPolyfill.toStringTag === "symbol") {
        Object.defineProperty(WritableStream2.prototype, SymbolPolyfill.toStringTag, {
          value: "WritableStream",
          configurable: true
        });
      }
      function AcquireWritableStreamDefaultWriter(stream) {
        return new WritableStreamDefaultWriter(stream);
      }
      function CreateWritableStream(startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark = 1, sizeAlgorithm = () => 1) {
        const stream = Object.create(WritableStream2.prototype);
        InitializeWritableStream(stream);
        const controller = Object.create(WritableStreamDefaultController.prototype);
        SetUpWritableStreamDefaultController(stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark, sizeAlgorithm);
        return stream;
      }
      function InitializeWritableStream(stream) {
        stream._state = "writable";
        stream._storedError = void 0;
        stream._writer = void 0;
        stream._writableStreamController = void 0;
        stream._writeRequests = new SimpleQueue();
        stream._inFlightWriteRequest = void 0;
        stream._closeRequest = void 0;
        stream._inFlightCloseRequest = void 0;
        stream._pendingAbortRequest = void 0;
        stream._backpressure = false;
      }
      function IsWritableStream(x) {
        if (!typeIsObject(x)) {
          return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, "_writableStreamController")) {
          return false;
        }
        return x instanceof WritableStream2;
      }
      function IsWritableStreamLocked(stream) {
        if (stream._writer === void 0) {
          return false;
        }
        return true;
      }
      function WritableStreamAbort(stream, reason) {
        var _a3;
        if (stream._state === "closed" || stream._state === "errored") {
          return promiseResolvedWith(void 0);
        }
        stream._writableStreamController._abortReason = reason;
        (_a3 = stream._writableStreamController._abortController) === null || _a3 === void 0 ? void 0 : _a3.abort();
        const state = stream._state;
        if (state === "closed" || state === "errored") {
          return promiseResolvedWith(void 0);
        }
        if (stream._pendingAbortRequest !== void 0) {
          return stream._pendingAbortRequest._promise;
        }
        let wasAlreadyErroring = false;
        if (state === "erroring") {
          wasAlreadyErroring = true;
          reason = void 0;
        }
        const promise = newPromise((resolve, reject) => {
          stream._pendingAbortRequest = {
            _promise: void 0,
            _resolve: resolve,
            _reject: reject,
            _reason: reason,
            _wasAlreadyErroring: wasAlreadyErroring
          };
        });
        stream._pendingAbortRequest._promise = promise;
        if (!wasAlreadyErroring) {
          WritableStreamStartErroring(stream, reason);
        }
        return promise;
      }
      function WritableStreamClose(stream) {
        const state = stream._state;
        if (state === "closed" || state === "errored") {
          return promiseRejectedWith(new TypeError(`The stream (in ${state} state) is not in the writable state and cannot be closed`));
        }
        const promise = newPromise((resolve, reject) => {
          const closeRequest = {
            _resolve: resolve,
            _reject: reject
          };
          stream._closeRequest = closeRequest;
        });
        const writer = stream._writer;
        if (writer !== void 0 && stream._backpressure && state === "writable") {
          defaultWriterReadyPromiseResolve(writer);
        }
        WritableStreamDefaultControllerClose(stream._writableStreamController);
        return promise;
      }
      function WritableStreamAddWriteRequest(stream) {
        const promise = newPromise((resolve, reject) => {
          const writeRequest = {
            _resolve: resolve,
            _reject: reject
          };
          stream._writeRequests.push(writeRequest);
        });
        return promise;
      }
      function WritableStreamDealWithRejection(stream, error) {
        const state = stream._state;
        if (state === "writable") {
          WritableStreamStartErroring(stream, error);
          return;
        }
        WritableStreamFinishErroring(stream);
      }
      function WritableStreamStartErroring(stream, reason) {
        const controller = stream._writableStreamController;
        stream._state = "erroring";
        stream._storedError = reason;
        const writer = stream._writer;
        if (writer !== void 0) {
          WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, reason);
        }
        if (!WritableStreamHasOperationMarkedInFlight(stream) && controller._started) {
          WritableStreamFinishErroring(stream);
        }
      }
      function WritableStreamFinishErroring(stream) {
        stream._state = "errored";
        stream._writableStreamController[ErrorSteps]();
        const storedError = stream._storedError;
        stream._writeRequests.forEach((writeRequest) => {
          writeRequest._reject(storedError);
        });
        stream._writeRequests = new SimpleQueue();
        if (stream._pendingAbortRequest === void 0) {
          WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
          return;
        }
        const abortRequest = stream._pendingAbortRequest;
        stream._pendingAbortRequest = void 0;
        if (abortRequest._wasAlreadyErroring) {
          abortRequest._reject(storedError);
          WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
          return;
        }
        const promise = stream._writableStreamController[AbortSteps](abortRequest._reason);
        uponPromise(promise, () => {
          abortRequest._resolve();
          WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
        }, (reason) => {
          abortRequest._reject(reason);
          WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
        });
      }
      function WritableStreamFinishInFlightWrite(stream) {
        stream._inFlightWriteRequest._resolve(void 0);
        stream._inFlightWriteRequest = void 0;
      }
      function WritableStreamFinishInFlightWriteWithError(stream, error) {
        stream._inFlightWriteRequest._reject(error);
        stream._inFlightWriteRequest = void 0;
        WritableStreamDealWithRejection(stream, error);
      }
      function WritableStreamFinishInFlightClose(stream) {
        stream._inFlightCloseRequest._resolve(void 0);
        stream._inFlightCloseRequest = void 0;
        const state = stream._state;
        if (state === "erroring") {
          stream._storedError = void 0;
          if (stream._pendingAbortRequest !== void 0) {
            stream._pendingAbortRequest._resolve();
            stream._pendingAbortRequest = void 0;
          }
        }
        stream._state = "closed";
        const writer = stream._writer;
        if (writer !== void 0) {
          defaultWriterClosedPromiseResolve(writer);
        }
      }
      function WritableStreamFinishInFlightCloseWithError(stream, error) {
        stream._inFlightCloseRequest._reject(error);
        stream._inFlightCloseRequest = void 0;
        if (stream._pendingAbortRequest !== void 0) {
          stream._pendingAbortRequest._reject(error);
          stream._pendingAbortRequest = void 0;
        }
        WritableStreamDealWithRejection(stream, error);
      }
      function WritableStreamCloseQueuedOrInFlight(stream) {
        if (stream._closeRequest === void 0 && stream._inFlightCloseRequest === void 0) {
          return false;
        }
        return true;
      }
      function WritableStreamHasOperationMarkedInFlight(stream) {
        if (stream._inFlightWriteRequest === void 0 && stream._inFlightCloseRequest === void 0) {
          return false;
        }
        return true;
      }
      function WritableStreamMarkCloseRequestInFlight(stream) {
        stream._inFlightCloseRequest = stream._closeRequest;
        stream._closeRequest = void 0;
      }
      function WritableStreamMarkFirstWriteRequestInFlight(stream) {
        stream._inFlightWriteRequest = stream._writeRequests.shift();
      }
      function WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream) {
        if (stream._closeRequest !== void 0) {
          stream._closeRequest._reject(stream._storedError);
          stream._closeRequest = void 0;
        }
        const writer = stream._writer;
        if (writer !== void 0) {
          defaultWriterClosedPromiseReject(writer, stream._storedError);
        }
      }
      function WritableStreamUpdateBackpressure(stream, backpressure) {
        const writer = stream._writer;
        if (writer !== void 0 && backpressure !== stream._backpressure) {
          if (backpressure) {
            defaultWriterReadyPromiseReset(writer);
          } else {
            defaultWriterReadyPromiseResolve(writer);
          }
        }
        stream._backpressure = backpressure;
      }
      class WritableStreamDefaultWriter {
        constructor(stream) {
          assertRequiredArgument(stream, 1, "WritableStreamDefaultWriter");
          assertWritableStream(stream, "First parameter");
          if (IsWritableStreamLocked(stream)) {
            throw new TypeError("This stream has already been locked for exclusive writing by another writer");
          }
          this._ownerWritableStream = stream;
          stream._writer = this;
          const state = stream._state;
          if (state === "writable") {
            if (!WritableStreamCloseQueuedOrInFlight(stream) && stream._backpressure) {
              defaultWriterReadyPromiseInitialize(this);
            } else {
              defaultWriterReadyPromiseInitializeAsResolved(this);
            }
            defaultWriterClosedPromiseInitialize(this);
          } else if (state === "erroring") {
            defaultWriterReadyPromiseInitializeAsRejected(this, stream._storedError);
            defaultWriterClosedPromiseInitialize(this);
          } else if (state === "closed") {
            defaultWriterReadyPromiseInitializeAsResolved(this);
            defaultWriterClosedPromiseInitializeAsResolved(this);
          } else {
            const storedError = stream._storedError;
            defaultWriterReadyPromiseInitializeAsRejected(this, storedError);
            defaultWriterClosedPromiseInitializeAsRejected(this, storedError);
          }
        }
        get closed() {
          if (!IsWritableStreamDefaultWriter(this)) {
            return promiseRejectedWith(defaultWriterBrandCheckException("closed"));
          }
          return this._closedPromise;
        }
        get desiredSize() {
          if (!IsWritableStreamDefaultWriter(this)) {
            throw defaultWriterBrandCheckException("desiredSize");
          }
          if (this._ownerWritableStream === void 0) {
            throw defaultWriterLockException("desiredSize");
          }
          return WritableStreamDefaultWriterGetDesiredSize(this);
        }
        get ready() {
          if (!IsWritableStreamDefaultWriter(this)) {
            return promiseRejectedWith(defaultWriterBrandCheckException("ready"));
          }
          return this._readyPromise;
        }
        abort(reason = void 0) {
          if (!IsWritableStreamDefaultWriter(this)) {
            return promiseRejectedWith(defaultWriterBrandCheckException("abort"));
          }
          if (this._ownerWritableStream === void 0) {
            return promiseRejectedWith(defaultWriterLockException("abort"));
          }
          return WritableStreamDefaultWriterAbort(this, reason);
        }
        close() {
          if (!IsWritableStreamDefaultWriter(this)) {
            return promiseRejectedWith(defaultWriterBrandCheckException("close"));
          }
          const stream = this._ownerWritableStream;
          if (stream === void 0) {
            return promiseRejectedWith(defaultWriterLockException("close"));
          }
          if (WritableStreamCloseQueuedOrInFlight(stream)) {
            return promiseRejectedWith(new TypeError("Cannot close an already-closing stream"));
          }
          return WritableStreamDefaultWriterClose(this);
        }
        releaseLock() {
          if (!IsWritableStreamDefaultWriter(this)) {
            throw defaultWriterBrandCheckException("releaseLock");
          }
          const stream = this._ownerWritableStream;
          if (stream === void 0) {
            return;
          }
          WritableStreamDefaultWriterRelease(this);
        }
        write(chunk = void 0) {
          if (!IsWritableStreamDefaultWriter(this)) {
            return promiseRejectedWith(defaultWriterBrandCheckException("write"));
          }
          if (this._ownerWritableStream === void 0) {
            return promiseRejectedWith(defaultWriterLockException("write to"));
          }
          return WritableStreamDefaultWriterWrite(this, chunk);
        }
      }
      Object.defineProperties(WritableStreamDefaultWriter.prototype, {
        abort: { enumerable: true },
        close: { enumerable: true },
        releaseLock: { enumerable: true },
        write: { enumerable: true },
        closed: { enumerable: true },
        desiredSize: { enumerable: true },
        ready: { enumerable: true }
      });
      if (typeof SymbolPolyfill.toStringTag === "symbol") {
        Object.defineProperty(WritableStreamDefaultWriter.prototype, SymbolPolyfill.toStringTag, {
          value: "WritableStreamDefaultWriter",
          configurable: true
        });
      }
      function IsWritableStreamDefaultWriter(x) {
        if (!typeIsObject(x)) {
          return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, "_ownerWritableStream")) {
          return false;
        }
        return x instanceof WritableStreamDefaultWriter;
      }
      function WritableStreamDefaultWriterAbort(writer, reason) {
        const stream = writer._ownerWritableStream;
        return WritableStreamAbort(stream, reason);
      }
      function WritableStreamDefaultWriterClose(writer) {
        const stream = writer._ownerWritableStream;
        return WritableStreamClose(stream);
      }
      function WritableStreamDefaultWriterCloseWithErrorPropagation(writer) {
        const stream = writer._ownerWritableStream;
        const state = stream._state;
        if (WritableStreamCloseQueuedOrInFlight(stream) || state === "closed") {
          return promiseResolvedWith(void 0);
        }
        if (state === "errored") {
          return promiseRejectedWith(stream._storedError);
        }
        return WritableStreamDefaultWriterClose(writer);
      }
      function WritableStreamDefaultWriterEnsureClosedPromiseRejected(writer, error) {
        if (writer._closedPromiseState === "pending") {
          defaultWriterClosedPromiseReject(writer, error);
        } else {
          defaultWriterClosedPromiseResetToRejected(writer, error);
        }
      }
      function WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, error) {
        if (writer._readyPromiseState === "pending") {
          defaultWriterReadyPromiseReject(writer, error);
        } else {
          defaultWriterReadyPromiseResetToRejected(writer, error);
        }
      }
      function WritableStreamDefaultWriterGetDesiredSize(writer) {
        const stream = writer._ownerWritableStream;
        const state = stream._state;
        if (state === "errored" || state === "erroring") {
          return null;
        }
        if (state === "closed") {
          return 0;
        }
        return WritableStreamDefaultControllerGetDesiredSize(stream._writableStreamController);
      }
      function WritableStreamDefaultWriterRelease(writer) {
        const stream = writer._ownerWritableStream;
        const releasedError = new TypeError(`Writer was released and can no longer be used to monitor the stream's closedness`);
        WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, releasedError);
        WritableStreamDefaultWriterEnsureClosedPromiseRejected(writer, releasedError);
        stream._writer = void 0;
        writer._ownerWritableStream = void 0;
      }
      function WritableStreamDefaultWriterWrite(writer, chunk) {
        const stream = writer._ownerWritableStream;
        const controller = stream._writableStreamController;
        const chunkSize = WritableStreamDefaultControllerGetChunkSize(controller, chunk);
        if (stream !== writer._ownerWritableStream) {
          return promiseRejectedWith(defaultWriterLockException("write to"));
        }
        const state = stream._state;
        if (state === "errored") {
          return promiseRejectedWith(stream._storedError);
        }
        if (WritableStreamCloseQueuedOrInFlight(stream) || state === "closed") {
          return promiseRejectedWith(new TypeError("The stream is closing or closed and cannot be written to"));
        }
        if (state === "erroring") {
          return promiseRejectedWith(stream._storedError);
        }
        const promise = WritableStreamAddWriteRequest(stream);
        WritableStreamDefaultControllerWrite(controller, chunk, chunkSize);
        return promise;
      }
      const closeSentinel = {};
      class WritableStreamDefaultController {
        constructor() {
          throw new TypeError("Illegal constructor");
        }
        get abortReason() {
          if (!IsWritableStreamDefaultController(this)) {
            throw defaultControllerBrandCheckException$2("abortReason");
          }
          return this._abortReason;
        }
        get signal() {
          if (!IsWritableStreamDefaultController(this)) {
            throw defaultControllerBrandCheckException$2("signal");
          }
          if (this._abortController === void 0) {
            throw new TypeError("WritableStreamDefaultController.prototype.signal is not supported");
          }
          return this._abortController.signal;
        }
        error(e = void 0) {
          if (!IsWritableStreamDefaultController(this)) {
            throw defaultControllerBrandCheckException$2("error");
          }
          const state = this._controlledWritableStream._state;
          if (state !== "writable") {
            return;
          }
          WritableStreamDefaultControllerError(this, e);
        }
        [AbortSteps](reason) {
          const result = this._abortAlgorithm(reason);
          WritableStreamDefaultControllerClearAlgorithms(this);
          return result;
        }
        [ErrorSteps]() {
          ResetQueue(this);
        }
      }
      Object.defineProperties(WritableStreamDefaultController.prototype, {
        abortReason: { enumerable: true },
        signal: { enumerable: true },
        error: { enumerable: true }
      });
      if (typeof SymbolPolyfill.toStringTag === "symbol") {
        Object.defineProperty(WritableStreamDefaultController.prototype, SymbolPolyfill.toStringTag, {
          value: "WritableStreamDefaultController",
          configurable: true
        });
      }
      function IsWritableStreamDefaultController(x) {
        if (!typeIsObject(x)) {
          return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, "_controlledWritableStream")) {
          return false;
        }
        return x instanceof WritableStreamDefaultController;
      }
      function SetUpWritableStreamDefaultController(stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark, sizeAlgorithm) {
        controller._controlledWritableStream = stream;
        stream._writableStreamController = controller;
        controller._queue = void 0;
        controller._queueTotalSize = void 0;
        ResetQueue(controller);
        controller._abortReason = void 0;
        controller._abortController = createAbortController();
        controller._started = false;
        controller._strategySizeAlgorithm = sizeAlgorithm;
        controller._strategyHWM = highWaterMark;
        controller._writeAlgorithm = writeAlgorithm;
        controller._closeAlgorithm = closeAlgorithm;
        controller._abortAlgorithm = abortAlgorithm;
        const backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
        WritableStreamUpdateBackpressure(stream, backpressure);
        const startResult = startAlgorithm();
        const startPromise = promiseResolvedWith(startResult);
        uponPromise(startPromise, () => {
          controller._started = true;
          WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
        }, (r) => {
          controller._started = true;
          WritableStreamDealWithRejection(stream, r);
        });
      }
      function SetUpWritableStreamDefaultControllerFromUnderlyingSink(stream, underlyingSink, highWaterMark, sizeAlgorithm) {
        const controller = Object.create(WritableStreamDefaultController.prototype);
        let startAlgorithm = () => void 0;
        let writeAlgorithm = () => promiseResolvedWith(void 0);
        let closeAlgorithm = () => promiseResolvedWith(void 0);
        let abortAlgorithm = () => promiseResolvedWith(void 0);
        if (underlyingSink.start !== void 0) {
          startAlgorithm = () => underlyingSink.start(controller);
        }
        if (underlyingSink.write !== void 0) {
          writeAlgorithm = (chunk) => underlyingSink.write(chunk, controller);
        }
        if (underlyingSink.close !== void 0) {
          closeAlgorithm = () => underlyingSink.close();
        }
        if (underlyingSink.abort !== void 0) {
          abortAlgorithm = (reason) => underlyingSink.abort(reason);
        }
        SetUpWritableStreamDefaultController(stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark, sizeAlgorithm);
      }
      function WritableStreamDefaultControllerClearAlgorithms(controller) {
        controller._writeAlgorithm = void 0;
        controller._closeAlgorithm = void 0;
        controller._abortAlgorithm = void 0;
        controller._strategySizeAlgorithm = void 0;
      }
      function WritableStreamDefaultControllerClose(controller) {
        EnqueueValueWithSize(controller, closeSentinel, 0);
        WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
      }
      function WritableStreamDefaultControllerGetChunkSize(controller, chunk) {
        try {
          return controller._strategySizeAlgorithm(chunk);
        } catch (chunkSizeE) {
          WritableStreamDefaultControllerErrorIfNeeded(controller, chunkSizeE);
          return 1;
        }
      }
      function WritableStreamDefaultControllerGetDesiredSize(controller) {
        return controller._strategyHWM - controller._queueTotalSize;
      }
      function WritableStreamDefaultControllerWrite(controller, chunk, chunkSize) {
        try {
          EnqueueValueWithSize(controller, chunk, chunkSize);
        } catch (enqueueE) {
          WritableStreamDefaultControllerErrorIfNeeded(controller, enqueueE);
          return;
        }
        const stream = controller._controlledWritableStream;
        if (!WritableStreamCloseQueuedOrInFlight(stream) && stream._state === "writable") {
          const backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
          WritableStreamUpdateBackpressure(stream, backpressure);
        }
        WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
      }
      function WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller) {
        const stream = controller._controlledWritableStream;
        if (!controller._started) {
          return;
        }
        if (stream._inFlightWriteRequest !== void 0) {
          return;
        }
        const state = stream._state;
        if (state === "erroring") {
          WritableStreamFinishErroring(stream);
          return;
        }
        if (controller._queue.length === 0) {
          return;
        }
        const value = PeekQueueValue(controller);
        if (value === closeSentinel) {
          WritableStreamDefaultControllerProcessClose(controller);
        } else {
          WritableStreamDefaultControllerProcessWrite(controller, value);
        }
      }
      function WritableStreamDefaultControllerErrorIfNeeded(controller, error) {
        if (controller._controlledWritableStream._state === "writable") {
          WritableStreamDefaultControllerError(controller, error);
        }
      }
      function WritableStreamDefaultControllerProcessClose(controller) {
        const stream = controller._controlledWritableStream;
        WritableStreamMarkCloseRequestInFlight(stream);
        DequeueValue(controller);
        const sinkClosePromise = controller._closeAlgorithm();
        WritableStreamDefaultControllerClearAlgorithms(controller);
        uponPromise(sinkClosePromise, () => {
          WritableStreamFinishInFlightClose(stream);
        }, (reason) => {
          WritableStreamFinishInFlightCloseWithError(stream, reason);
        });
      }
      function WritableStreamDefaultControllerProcessWrite(controller, chunk) {
        const stream = controller._controlledWritableStream;
        WritableStreamMarkFirstWriteRequestInFlight(stream);
        const sinkWritePromise = controller._writeAlgorithm(chunk);
        uponPromise(sinkWritePromise, () => {
          WritableStreamFinishInFlightWrite(stream);
          const state = stream._state;
          DequeueValue(controller);
          if (!WritableStreamCloseQueuedOrInFlight(stream) && state === "writable") {
            const backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
            WritableStreamUpdateBackpressure(stream, backpressure);
          }
          WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
        }, (reason) => {
          if (stream._state === "writable") {
            WritableStreamDefaultControllerClearAlgorithms(controller);
          }
          WritableStreamFinishInFlightWriteWithError(stream, reason);
        });
      }
      function WritableStreamDefaultControllerGetBackpressure(controller) {
        const desiredSize = WritableStreamDefaultControllerGetDesiredSize(controller);
        return desiredSize <= 0;
      }
      function WritableStreamDefaultControllerError(controller, error) {
        const stream = controller._controlledWritableStream;
        WritableStreamDefaultControllerClearAlgorithms(controller);
        WritableStreamStartErroring(stream, error);
      }
      function streamBrandCheckException$2(name) {
        return new TypeError(`WritableStream.prototype.${name} can only be used on a WritableStream`);
      }
      function defaultControllerBrandCheckException$2(name) {
        return new TypeError(`WritableStreamDefaultController.prototype.${name} can only be used on a WritableStreamDefaultController`);
      }
      function defaultWriterBrandCheckException(name) {
        return new TypeError(`WritableStreamDefaultWriter.prototype.${name} can only be used on a WritableStreamDefaultWriter`);
      }
      function defaultWriterLockException(name) {
        return new TypeError("Cannot " + name + " a stream using a released writer");
      }
      function defaultWriterClosedPromiseInitialize(writer) {
        writer._closedPromise = newPromise((resolve, reject) => {
          writer._closedPromise_resolve = resolve;
          writer._closedPromise_reject = reject;
          writer._closedPromiseState = "pending";
        });
      }
      function defaultWriterClosedPromiseInitializeAsRejected(writer, reason) {
        defaultWriterClosedPromiseInitialize(writer);
        defaultWriterClosedPromiseReject(writer, reason);
      }
      function defaultWriterClosedPromiseInitializeAsResolved(writer) {
        defaultWriterClosedPromiseInitialize(writer);
        defaultWriterClosedPromiseResolve(writer);
      }
      function defaultWriterClosedPromiseReject(writer, reason) {
        if (writer._closedPromise_reject === void 0) {
          return;
        }
        setPromiseIsHandledToTrue(writer._closedPromise);
        writer._closedPromise_reject(reason);
        writer._closedPromise_resolve = void 0;
        writer._closedPromise_reject = void 0;
        writer._closedPromiseState = "rejected";
      }
      function defaultWriterClosedPromiseResetToRejected(writer, reason) {
        defaultWriterClosedPromiseInitializeAsRejected(writer, reason);
      }
      function defaultWriterClosedPromiseResolve(writer) {
        if (writer._closedPromise_resolve === void 0) {
          return;
        }
        writer._closedPromise_resolve(void 0);
        writer._closedPromise_resolve = void 0;
        writer._closedPromise_reject = void 0;
        writer._closedPromiseState = "resolved";
      }
      function defaultWriterReadyPromiseInitialize(writer) {
        writer._readyPromise = newPromise((resolve, reject) => {
          writer._readyPromise_resolve = resolve;
          writer._readyPromise_reject = reject;
        });
        writer._readyPromiseState = "pending";
      }
      function defaultWriterReadyPromiseInitializeAsRejected(writer, reason) {
        defaultWriterReadyPromiseInitialize(writer);
        defaultWriterReadyPromiseReject(writer, reason);
      }
      function defaultWriterReadyPromiseInitializeAsResolved(writer) {
        defaultWriterReadyPromiseInitialize(writer);
        defaultWriterReadyPromiseResolve(writer);
      }
      function defaultWriterReadyPromiseReject(writer, reason) {
        if (writer._readyPromise_reject === void 0) {
          return;
        }
        setPromiseIsHandledToTrue(writer._readyPromise);
        writer._readyPromise_reject(reason);
        writer._readyPromise_resolve = void 0;
        writer._readyPromise_reject = void 0;
        writer._readyPromiseState = "rejected";
      }
      function defaultWriterReadyPromiseReset(writer) {
        defaultWriterReadyPromiseInitialize(writer);
      }
      function defaultWriterReadyPromiseResetToRejected(writer, reason) {
        defaultWriterReadyPromiseInitializeAsRejected(writer, reason);
      }
      function defaultWriterReadyPromiseResolve(writer) {
        if (writer._readyPromise_resolve === void 0) {
          return;
        }
        writer._readyPromise_resolve(void 0);
        writer._readyPromise_resolve = void 0;
        writer._readyPromise_reject = void 0;
        writer._readyPromiseState = "fulfilled";
      }
      const NativeDOMException = typeof DOMException !== "undefined" ? DOMException : void 0;
      function isDOMExceptionConstructor(ctor) {
        if (!(typeof ctor === "function" || typeof ctor === "object")) {
          return false;
        }
        try {
          new ctor();
          return true;
        } catch (_a3) {
          return false;
        }
      }
      function createDOMExceptionPolyfill() {
        const ctor = function DOMException2(message, name) {
          this.message = message || "";
          this.name = name || "Error";
          if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
          }
        };
        ctor.prototype = Object.create(Error.prototype);
        Object.defineProperty(ctor.prototype, "constructor", { value: ctor, writable: true, configurable: true });
        return ctor;
      }
      const DOMException$1 = isDOMExceptionConstructor(NativeDOMException) ? NativeDOMException : createDOMExceptionPolyfill();
      function ReadableStreamPipeTo(source, dest, preventClose, preventAbort, preventCancel, signal2) {
        const reader = AcquireReadableStreamDefaultReader(source);
        const writer = AcquireWritableStreamDefaultWriter(dest);
        source._disturbed = true;
        let shuttingDown = false;
        let currentWrite = promiseResolvedWith(void 0);
        return newPromise((resolve, reject) => {
          let abortAlgorithm;
          if (signal2 !== void 0) {
            abortAlgorithm = () => {
              const error = new DOMException$1("Aborted", "AbortError");
              const actions = [];
              if (!preventAbort) {
                actions.push(() => {
                  if (dest._state === "writable") {
                    return WritableStreamAbort(dest, error);
                  }
                  return promiseResolvedWith(void 0);
                });
              }
              if (!preventCancel) {
                actions.push(() => {
                  if (source._state === "readable") {
                    return ReadableStreamCancel(source, error);
                  }
                  return promiseResolvedWith(void 0);
                });
              }
              shutdownWithAction(() => Promise.all(actions.map((action) => action())), true, error);
            };
            if (signal2.aborted) {
              abortAlgorithm();
              return;
            }
            signal2.addEventListener("abort", abortAlgorithm);
          }
          function pipeLoop() {
            return newPromise((resolveLoop, rejectLoop) => {
              function next(done) {
                if (done) {
                  resolveLoop();
                } else {
                  PerformPromiseThen(pipeStep(), next, rejectLoop);
                }
              }
              next(false);
            });
          }
          function pipeStep() {
            if (shuttingDown) {
              return promiseResolvedWith(true);
            }
            return PerformPromiseThen(writer._readyPromise, () => {
              return newPromise((resolveRead, rejectRead) => {
                ReadableStreamDefaultReaderRead(reader, {
                  _chunkSteps: (chunk) => {
                    currentWrite = PerformPromiseThen(WritableStreamDefaultWriterWrite(writer, chunk), void 0, noop);
                    resolveRead(false);
                  },
                  _closeSteps: () => resolveRead(true),
                  _errorSteps: rejectRead
                });
              });
            });
          }
          isOrBecomesErrored(source, reader._closedPromise, (storedError) => {
            if (!preventAbort) {
              shutdownWithAction(() => WritableStreamAbort(dest, storedError), true, storedError);
            } else {
              shutdown(true, storedError);
            }
          });
          isOrBecomesErrored(dest, writer._closedPromise, (storedError) => {
            if (!preventCancel) {
              shutdownWithAction(() => ReadableStreamCancel(source, storedError), true, storedError);
            } else {
              shutdown(true, storedError);
            }
          });
          isOrBecomesClosed(source, reader._closedPromise, () => {
            if (!preventClose) {
              shutdownWithAction(() => WritableStreamDefaultWriterCloseWithErrorPropagation(writer));
            } else {
              shutdown();
            }
          });
          if (WritableStreamCloseQueuedOrInFlight(dest) || dest._state === "closed") {
            const destClosed = new TypeError("the destination writable stream closed before all data could be piped to it");
            if (!preventCancel) {
              shutdownWithAction(() => ReadableStreamCancel(source, destClosed), true, destClosed);
            } else {
              shutdown(true, destClosed);
            }
          }
          setPromiseIsHandledToTrue(pipeLoop());
          function waitForWritesToFinish() {
            const oldCurrentWrite = currentWrite;
            return PerformPromiseThen(currentWrite, () => oldCurrentWrite !== currentWrite ? waitForWritesToFinish() : void 0);
          }
          function isOrBecomesErrored(stream, promise, action) {
            if (stream._state === "errored") {
              action(stream._storedError);
            } else {
              uponRejection(promise, action);
            }
          }
          function isOrBecomesClosed(stream, promise, action) {
            if (stream._state === "closed") {
              action();
            } else {
              uponFulfillment(promise, action);
            }
          }
          function shutdownWithAction(action, originalIsError, originalError) {
            if (shuttingDown) {
              return;
            }
            shuttingDown = true;
            if (dest._state === "writable" && !WritableStreamCloseQueuedOrInFlight(dest)) {
              uponFulfillment(waitForWritesToFinish(), doTheRest);
            } else {
              doTheRest();
            }
            function doTheRest() {
              uponPromise(action(), () => finalize(originalIsError, originalError), (newError) => finalize(true, newError));
            }
          }
          function shutdown(isError, error) {
            if (shuttingDown) {
              return;
            }
            shuttingDown = true;
            if (dest._state === "writable" && !WritableStreamCloseQueuedOrInFlight(dest)) {
              uponFulfillment(waitForWritesToFinish(), () => finalize(isError, error));
            } else {
              finalize(isError, error);
            }
          }
          function finalize(isError, error) {
            WritableStreamDefaultWriterRelease(writer);
            ReadableStreamReaderGenericRelease(reader);
            if (signal2 !== void 0) {
              signal2.removeEventListener("abort", abortAlgorithm);
            }
            if (isError) {
              reject(error);
            } else {
              resolve(void 0);
            }
          }
        });
      }
      class ReadableStreamDefaultController {
        constructor() {
          throw new TypeError("Illegal constructor");
        }
        get desiredSize() {
          if (!IsReadableStreamDefaultController(this)) {
            throw defaultControllerBrandCheckException$1("desiredSize");
          }
          return ReadableStreamDefaultControllerGetDesiredSize(this);
        }
        close() {
          if (!IsReadableStreamDefaultController(this)) {
            throw defaultControllerBrandCheckException$1("close");
          }
          if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(this)) {
            throw new TypeError("The stream is not in a state that permits close");
          }
          ReadableStreamDefaultControllerClose(this);
        }
        enqueue(chunk = void 0) {
          if (!IsReadableStreamDefaultController(this)) {
            throw defaultControllerBrandCheckException$1("enqueue");
          }
          if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(this)) {
            throw new TypeError("The stream is not in a state that permits enqueue");
          }
          return ReadableStreamDefaultControllerEnqueue(this, chunk);
        }
        error(e = void 0) {
          if (!IsReadableStreamDefaultController(this)) {
            throw defaultControllerBrandCheckException$1("error");
          }
          ReadableStreamDefaultControllerError(this, e);
        }
        [CancelSteps](reason) {
          ResetQueue(this);
          const result = this._cancelAlgorithm(reason);
          ReadableStreamDefaultControllerClearAlgorithms(this);
          return result;
        }
        [PullSteps](readRequest) {
          const stream = this._controlledReadableStream;
          if (this._queue.length > 0) {
            const chunk = DequeueValue(this);
            if (this._closeRequested && this._queue.length === 0) {
              ReadableStreamDefaultControllerClearAlgorithms(this);
              ReadableStreamClose(stream);
            } else {
              ReadableStreamDefaultControllerCallPullIfNeeded(this);
            }
            readRequest._chunkSteps(chunk);
          } else {
            ReadableStreamAddReadRequest(stream, readRequest);
            ReadableStreamDefaultControllerCallPullIfNeeded(this);
          }
        }
      }
      Object.defineProperties(ReadableStreamDefaultController.prototype, {
        close: { enumerable: true },
        enqueue: { enumerable: true },
        error: { enumerable: true },
        desiredSize: { enumerable: true }
      });
      if (typeof SymbolPolyfill.toStringTag === "symbol") {
        Object.defineProperty(ReadableStreamDefaultController.prototype, SymbolPolyfill.toStringTag, {
          value: "ReadableStreamDefaultController",
          configurable: true
        });
      }
      function IsReadableStreamDefaultController(x) {
        if (!typeIsObject(x)) {
          return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, "_controlledReadableStream")) {
          return false;
        }
        return x instanceof ReadableStreamDefaultController;
      }
      function ReadableStreamDefaultControllerCallPullIfNeeded(controller) {
        const shouldPull = ReadableStreamDefaultControllerShouldCallPull(controller);
        if (!shouldPull) {
          return;
        }
        if (controller._pulling) {
          controller._pullAgain = true;
          return;
        }
        controller._pulling = true;
        const pullPromise = controller._pullAlgorithm();
        uponPromise(pullPromise, () => {
          controller._pulling = false;
          if (controller._pullAgain) {
            controller._pullAgain = false;
            ReadableStreamDefaultControllerCallPullIfNeeded(controller);
          }
        }, (e) => {
          ReadableStreamDefaultControllerError(controller, e);
        });
      }
      function ReadableStreamDefaultControllerShouldCallPull(controller) {
        const stream = controller._controlledReadableStream;
        if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller)) {
          return false;
        }
        if (!controller._started) {
          return false;
        }
        if (IsReadableStreamLocked(stream) && ReadableStreamGetNumReadRequests(stream) > 0) {
          return true;
        }
        const desiredSize = ReadableStreamDefaultControllerGetDesiredSize(controller);
        if (desiredSize > 0) {
          return true;
        }
        return false;
      }
      function ReadableStreamDefaultControllerClearAlgorithms(controller) {
        controller._pullAlgorithm = void 0;
        controller._cancelAlgorithm = void 0;
        controller._strategySizeAlgorithm = void 0;
      }
      function ReadableStreamDefaultControllerClose(controller) {
        if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller)) {
          return;
        }
        const stream = controller._controlledReadableStream;
        controller._closeRequested = true;
        if (controller._queue.length === 0) {
          ReadableStreamDefaultControllerClearAlgorithms(controller);
          ReadableStreamClose(stream);
        }
      }
      function ReadableStreamDefaultControllerEnqueue(controller, chunk) {
        if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller)) {
          return;
        }
        const stream = controller._controlledReadableStream;
        if (IsReadableStreamLocked(stream) && ReadableStreamGetNumReadRequests(stream) > 0) {
          ReadableStreamFulfillReadRequest(stream, chunk, false);
        } else {
          let chunkSize;
          try {
            chunkSize = controller._strategySizeAlgorithm(chunk);
          } catch (chunkSizeE) {
            ReadableStreamDefaultControllerError(controller, chunkSizeE);
            throw chunkSizeE;
          }
          try {
            EnqueueValueWithSize(controller, chunk, chunkSize);
          } catch (enqueueE) {
            ReadableStreamDefaultControllerError(controller, enqueueE);
            throw enqueueE;
          }
        }
        ReadableStreamDefaultControllerCallPullIfNeeded(controller);
      }
      function ReadableStreamDefaultControllerError(controller, e) {
        const stream = controller._controlledReadableStream;
        if (stream._state !== "readable") {
          return;
        }
        ResetQueue(controller);
        ReadableStreamDefaultControllerClearAlgorithms(controller);
        ReadableStreamError(stream, e);
      }
      function ReadableStreamDefaultControllerGetDesiredSize(controller) {
        const state = controller._controlledReadableStream._state;
        if (state === "errored") {
          return null;
        }
        if (state === "closed") {
          return 0;
        }
        return controller._strategyHWM - controller._queueTotalSize;
      }
      function ReadableStreamDefaultControllerHasBackpressure(controller) {
        if (ReadableStreamDefaultControllerShouldCallPull(controller)) {
          return false;
        }
        return true;
      }
      function ReadableStreamDefaultControllerCanCloseOrEnqueue(controller) {
        const state = controller._controlledReadableStream._state;
        if (!controller._closeRequested && state === "readable") {
          return true;
        }
        return false;
      }
      function SetUpReadableStreamDefaultController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm) {
        controller._controlledReadableStream = stream;
        controller._queue = void 0;
        controller._queueTotalSize = void 0;
        ResetQueue(controller);
        controller._started = false;
        controller._closeRequested = false;
        controller._pullAgain = false;
        controller._pulling = false;
        controller._strategySizeAlgorithm = sizeAlgorithm;
        controller._strategyHWM = highWaterMark;
        controller._pullAlgorithm = pullAlgorithm;
        controller._cancelAlgorithm = cancelAlgorithm;
        stream._readableStreamController = controller;
        const startResult = startAlgorithm();
        uponPromise(promiseResolvedWith(startResult), () => {
          controller._started = true;
          ReadableStreamDefaultControllerCallPullIfNeeded(controller);
        }, (r) => {
          ReadableStreamDefaultControllerError(controller, r);
        });
      }
      function SetUpReadableStreamDefaultControllerFromUnderlyingSource(stream, underlyingSource, highWaterMark, sizeAlgorithm) {
        const controller = Object.create(ReadableStreamDefaultController.prototype);
        let startAlgorithm = () => void 0;
        let pullAlgorithm = () => promiseResolvedWith(void 0);
        let cancelAlgorithm = () => promiseResolvedWith(void 0);
        if (underlyingSource.start !== void 0) {
          startAlgorithm = () => underlyingSource.start(controller);
        }
        if (underlyingSource.pull !== void 0) {
          pullAlgorithm = () => underlyingSource.pull(controller);
        }
        if (underlyingSource.cancel !== void 0) {
          cancelAlgorithm = (reason) => underlyingSource.cancel(reason);
        }
        SetUpReadableStreamDefaultController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm);
      }
      function defaultControllerBrandCheckException$1(name) {
        return new TypeError(`ReadableStreamDefaultController.prototype.${name} can only be used on a ReadableStreamDefaultController`);
      }
      function ReadableStreamTee(stream, cloneForBranch2) {
        if (IsReadableByteStreamController(stream._readableStreamController)) {
          return ReadableByteStreamTee(stream);
        }
        return ReadableStreamDefaultTee(stream);
      }
      function ReadableStreamDefaultTee(stream, cloneForBranch2) {
        const reader = AcquireReadableStreamDefaultReader(stream);
        let reading = false;
        let readAgain = false;
        let canceled1 = false;
        let canceled2 = false;
        let reason1;
        let reason2;
        let branch1;
        let branch2;
        let resolveCancelPromise;
        const cancelPromise = newPromise((resolve) => {
          resolveCancelPromise = resolve;
        });
        function pullAlgorithm() {
          if (reading) {
            readAgain = true;
            return promiseResolvedWith(void 0);
          }
          reading = true;
          const readRequest = {
            _chunkSteps: (chunk) => {
              queueMicrotask3(() => {
                readAgain = false;
                const chunk1 = chunk;
                const chunk2 = chunk;
                if (!canceled1) {
                  ReadableStreamDefaultControllerEnqueue(branch1._readableStreamController, chunk1);
                }
                if (!canceled2) {
                  ReadableStreamDefaultControllerEnqueue(branch2._readableStreamController, chunk2);
                }
                reading = false;
                if (readAgain) {
                  pullAlgorithm();
                }
              });
            },
            _closeSteps: () => {
              reading = false;
              if (!canceled1) {
                ReadableStreamDefaultControllerClose(branch1._readableStreamController);
              }
              if (!canceled2) {
                ReadableStreamDefaultControllerClose(branch2._readableStreamController);
              }
              if (!canceled1 || !canceled2) {
                resolveCancelPromise(void 0);
              }
            },
            _errorSteps: () => {
              reading = false;
            }
          };
          ReadableStreamDefaultReaderRead(reader, readRequest);
          return promiseResolvedWith(void 0);
        }
        function cancel1Algorithm(reason) {
          canceled1 = true;
          reason1 = reason;
          if (canceled2) {
            const compositeReason = CreateArrayFromList([reason1, reason2]);
            const cancelResult = ReadableStreamCancel(stream, compositeReason);
            resolveCancelPromise(cancelResult);
          }
          return cancelPromise;
        }
        function cancel2Algorithm(reason) {
          canceled2 = true;
          reason2 = reason;
          if (canceled1) {
            const compositeReason = CreateArrayFromList([reason1, reason2]);
            const cancelResult = ReadableStreamCancel(stream, compositeReason);
            resolveCancelPromise(cancelResult);
          }
          return cancelPromise;
        }
        function startAlgorithm() {
        }
        branch1 = CreateReadableStream(startAlgorithm, pullAlgorithm, cancel1Algorithm);
        branch2 = CreateReadableStream(startAlgorithm, pullAlgorithm, cancel2Algorithm);
        uponRejection(reader._closedPromise, (r) => {
          ReadableStreamDefaultControllerError(branch1._readableStreamController, r);
          ReadableStreamDefaultControllerError(branch2._readableStreamController, r);
          if (!canceled1 || !canceled2) {
            resolveCancelPromise(void 0);
          }
        });
        return [branch1, branch2];
      }
      function ReadableByteStreamTee(stream) {
        let reader = AcquireReadableStreamDefaultReader(stream);
        let reading = false;
        let readAgainForBranch1 = false;
        let readAgainForBranch2 = false;
        let canceled1 = false;
        let canceled2 = false;
        let reason1;
        let reason2;
        let branch1;
        let branch2;
        let resolveCancelPromise;
        const cancelPromise = newPromise((resolve) => {
          resolveCancelPromise = resolve;
        });
        function forwardReaderError(thisReader) {
          uponRejection(thisReader._closedPromise, (r) => {
            if (thisReader !== reader) {
              return;
            }
            ReadableByteStreamControllerError(branch1._readableStreamController, r);
            ReadableByteStreamControllerError(branch2._readableStreamController, r);
            if (!canceled1 || !canceled2) {
              resolveCancelPromise(void 0);
            }
          });
        }
        function pullWithDefaultReader() {
          if (IsReadableStreamBYOBReader(reader)) {
            ReadableStreamReaderGenericRelease(reader);
            reader = AcquireReadableStreamDefaultReader(stream);
            forwardReaderError(reader);
          }
          const readRequest = {
            _chunkSteps: (chunk) => {
              queueMicrotask3(() => {
                readAgainForBranch1 = false;
                readAgainForBranch2 = false;
                const chunk1 = chunk;
                let chunk2 = chunk;
                if (!canceled1 && !canceled2) {
                  try {
                    chunk2 = CloneAsUint8Array(chunk);
                  } catch (cloneE) {
                    ReadableByteStreamControllerError(branch1._readableStreamController, cloneE);
                    ReadableByteStreamControllerError(branch2._readableStreamController, cloneE);
                    resolveCancelPromise(ReadableStreamCancel(stream, cloneE));
                    return;
                  }
                }
                if (!canceled1) {
                  ReadableByteStreamControllerEnqueue(branch1._readableStreamController, chunk1);
                }
                if (!canceled2) {
                  ReadableByteStreamControllerEnqueue(branch2._readableStreamController, chunk2);
                }
                reading = false;
                if (readAgainForBranch1) {
                  pull1Algorithm();
                } else if (readAgainForBranch2) {
                  pull2Algorithm();
                }
              });
            },
            _closeSteps: () => {
              reading = false;
              if (!canceled1) {
                ReadableByteStreamControllerClose(branch1._readableStreamController);
              }
              if (!canceled2) {
                ReadableByteStreamControllerClose(branch2._readableStreamController);
              }
              if (branch1._readableStreamController._pendingPullIntos.length > 0) {
                ReadableByteStreamControllerRespond(branch1._readableStreamController, 0);
              }
              if (branch2._readableStreamController._pendingPullIntos.length > 0) {
                ReadableByteStreamControllerRespond(branch2._readableStreamController, 0);
              }
              if (!canceled1 || !canceled2) {
                resolveCancelPromise(void 0);
              }
            },
            _errorSteps: () => {
              reading = false;
            }
          };
          ReadableStreamDefaultReaderRead(reader, readRequest);
        }
        function pullWithBYOBReader(view, forBranch2) {
          if (IsReadableStreamDefaultReader(reader)) {
            ReadableStreamReaderGenericRelease(reader);
            reader = AcquireReadableStreamBYOBReader(stream);
            forwardReaderError(reader);
          }
          const byobBranch = forBranch2 ? branch2 : branch1;
          const otherBranch = forBranch2 ? branch1 : branch2;
          const readIntoRequest = {
            _chunkSteps: (chunk) => {
              queueMicrotask3(() => {
                readAgainForBranch1 = false;
                readAgainForBranch2 = false;
                const byobCanceled = forBranch2 ? canceled2 : canceled1;
                const otherCanceled = forBranch2 ? canceled1 : canceled2;
                if (!otherCanceled) {
                  let clonedChunk;
                  try {
                    clonedChunk = CloneAsUint8Array(chunk);
                  } catch (cloneE) {
                    ReadableByteStreamControllerError(byobBranch._readableStreamController, cloneE);
                    ReadableByteStreamControllerError(otherBranch._readableStreamController, cloneE);
                    resolveCancelPromise(ReadableStreamCancel(stream, cloneE));
                    return;
                  }
                  if (!byobCanceled) {
                    ReadableByteStreamControllerRespondWithNewView(byobBranch._readableStreamController, chunk);
                  }
                  ReadableByteStreamControllerEnqueue(otherBranch._readableStreamController, clonedChunk);
                } else if (!byobCanceled) {
                  ReadableByteStreamControllerRespondWithNewView(byobBranch._readableStreamController, chunk);
                }
                reading = false;
                if (readAgainForBranch1) {
                  pull1Algorithm();
                } else if (readAgainForBranch2) {
                  pull2Algorithm();
                }
              });
            },
            _closeSteps: (chunk) => {
              reading = false;
              const byobCanceled = forBranch2 ? canceled2 : canceled1;
              const otherCanceled = forBranch2 ? canceled1 : canceled2;
              if (!byobCanceled) {
                ReadableByteStreamControllerClose(byobBranch._readableStreamController);
              }
              if (!otherCanceled) {
                ReadableByteStreamControllerClose(otherBranch._readableStreamController);
              }
              if (chunk !== void 0) {
                if (!byobCanceled) {
                  ReadableByteStreamControllerRespondWithNewView(byobBranch._readableStreamController, chunk);
                }
                if (!otherCanceled && otherBranch._readableStreamController._pendingPullIntos.length > 0) {
                  ReadableByteStreamControllerRespond(otherBranch._readableStreamController, 0);
                }
              }
              if (!byobCanceled || !otherCanceled) {
                resolveCancelPromise(void 0);
              }
            },
            _errorSteps: () => {
              reading = false;
            }
          };
          ReadableStreamBYOBReaderRead(reader, view, readIntoRequest);
        }
        function pull1Algorithm() {
          if (reading) {
            readAgainForBranch1 = true;
            return promiseResolvedWith(void 0);
          }
          reading = true;
          const byobRequest = ReadableByteStreamControllerGetBYOBRequest(branch1._readableStreamController);
          if (byobRequest === null) {
            pullWithDefaultReader();
          } else {
            pullWithBYOBReader(byobRequest._view, false);
          }
          return promiseResolvedWith(void 0);
        }
        function pull2Algorithm() {
          if (reading) {
            readAgainForBranch2 = true;
            return promiseResolvedWith(void 0);
          }
          reading = true;
          const byobRequest = ReadableByteStreamControllerGetBYOBRequest(branch2._readableStreamController);
          if (byobRequest === null) {
            pullWithDefaultReader();
          } else {
            pullWithBYOBReader(byobRequest._view, true);
          }
          return promiseResolvedWith(void 0);
        }
        function cancel1Algorithm(reason) {
          canceled1 = true;
          reason1 = reason;
          if (canceled2) {
            const compositeReason = CreateArrayFromList([reason1, reason2]);
            const cancelResult = ReadableStreamCancel(stream, compositeReason);
            resolveCancelPromise(cancelResult);
          }
          return cancelPromise;
        }
        function cancel2Algorithm(reason) {
          canceled2 = true;
          reason2 = reason;
          if (canceled1) {
            const compositeReason = CreateArrayFromList([reason1, reason2]);
            const cancelResult = ReadableStreamCancel(stream, compositeReason);
            resolveCancelPromise(cancelResult);
          }
          return cancelPromise;
        }
        function startAlgorithm() {
          return;
        }
        branch1 = CreateReadableByteStream(startAlgorithm, pull1Algorithm, cancel1Algorithm);
        branch2 = CreateReadableByteStream(startAlgorithm, pull2Algorithm, cancel2Algorithm);
        forwardReaderError(reader);
        return [branch1, branch2];
      }
      function convertUnderlyingDefaultOrByteSource(source, context) {
        assertDictionary(source, context);
        const original = source;
        const autoAllocateChunkSize = original === null || original === void 0 ? void 0 : original.autoAllocateChunkSize;
        const cancel = original === null || original === void 0 ? void 0 : original.cancel;
        const pull = original === null || original === void 0 ? void 0 : original.pull;
        const start = original === null || original === void 0 ? void 0 : original.start;
        const type = original === null || original === void 0 ? void 0 : original.type;
        return {
          autoAllocateChunkSize: autoAllocateChunkSize === void 0 ? void 0 : convertUnsignedLongLongWithEnforceRange(autoAllocateChunkSize, `${context} has member 'autoAllocateChunkSize' that`),
          cancel: cancel === void 0 ? void 0 : convertUnderlyingSourceCancelCallback(cancel, original, `${context} has member 'cancel' that`),
          pull: pull === void 0 ? void 0 : convertUnderlyingSourcePullCallback(pull, original, `${context} has member 'pull' that`),
          start: start === void 0 ? void 0 : convertUnderlyingSourceStartCallback(start, original, `${context} has member 'start' that`),
          type: type === void 0 ? void 0 : convertReadableStreamType(type, `${context} has member 'type' that`)
        };
      }
      function convertUnderlyingSourceCancelCallback(fn, original, context) {
        assertFunction(fn, context);
        return (reason) => promiseCall(fn, original, [reason]);
      }
      function convertUnderlyingSourcePullCallback(fn, original, context) {
        assertFunction(fn, context);
        return (controller) => promiseCall(fn, original, [controller]);
      }
      function convertUnderlyingSourceStartCallback(fn, original, context) {
        assertFunction(fn, context);
        return (controller) => reflectCall(fn, original, [controller]);
      }
      function convertReadableStreamType(type, context) {
        type = `${type}`;
        if (type !== "bytes") {
          throw new TypeError(`${context} '${type}' is not a valid enumeration value for ReadableStreamType`);
        }
        return type;
      }
      function convertReaderOptions(options, context) {
        assertDictionary(options, context);
        const mode = options === null || options === void 0 ? void 0 : options.mode;
        return {
          mode: mode === void 0 ? void 0 : convertReadableStreamReaderMode(mode, `${context} has member 'mode' that`)
        };
      }
      function convertReadableStreamReaderMode(mode, context) {
        mode = `${mode}`;
        if (mode !== "byob") {
          throw new TypeError(`${context} '${mode}' is not a valid enumeration value for ReadableStreamReaderMode`);
        }
        return mode;
      }
      function convertIteratorOptions(options, context) {
        assertDictionary(options, context);
        const preventCancel = options === null || options === void 0 ? void 0 : options.preventCancel;
        return { preventCancel: Boolean(preventCancel) };
      }
      function convertPipeOptions(options, context) {
        assertDictionary(options, context);
        const preventAbort = options === null || options === void 0 ? void 0 : options.preventAbort;
        const preventCancel = options === null || options === void 0 ? void 0 : options.preventCancel;
        const preventClose = options === null || options === void 0 ? void 0 : options.preventClose;
        const signal2 = options === null || options === void 0 ? void 0 : options.signal;
        if (signal2 !== void 0) {
          assertAbortSignal(signal2, `${context} has member 'signal' that`);
        }
        return {
          preventAbort: Boolean(preventAbort),
          preventCancel: Boolean(preventCancel),
          preventClose: Boolean(preventClose),
          signal: signal2
        };
      }
      function assertAbortSignal(signal2, context) {
        if (!isAbortSignal(signal2)) {
          throw new TypeError(`${context} is not an AbortSignal.`);
        }
      }
      function convertReadableWritablePair(pair, context) {
        assertDictionary(pair, context);
        const readable = pair === null || pair === void 0 ? void 0 : pair.readable;
        assertRequiredField(readable, "readable", "ReadableWritablePair");
        assertReadableStream(readable, `${context} has member 'readable' that`);
        const writable = pair === null || pair === void 0 ? void 0 : pair.writable;
        assertRequiredField(writable, "writable", "ReadableWritablePair");
        assertWritableStream(writable, `${context} has member 'writable' that`);
        return { readable, writable };
      }
      class ReadableStream2 {
        constructor(rawUnderlyingSource = {}, rawStrategy = {}) {
          if (rawUnderlyingSource === void 0) {
            rawUnderlyingSource = null;
          } else {
            assertObject(rawUnderlyingSource, "First parameter");
          }
          const strategy = convertQueuingStrategy(rawStrategy, "Second parameter");
          const underlyingSource = convertUnderlyingDefaultOrByteSource(rawUnderlyingSource, "First parameter");
          InitializeReadableStream(this);
          if (underlyingSource.type === "bytes") {
            if (strategy.size !== void 0) {
              throw new RangeError("The strategy for a byte stream cannot have a size function");
            }
            const highWaterMark = ExtractHighWaterMark(strategy, 0);
            SetUpReadableByteStreamControllerFromUnderlyingSource(this, underlyingSource, highWaterMark);
          } else {
            const sizeAlgorithm = ExtractSizeAlgorithm(strategy);
            const highWaterMark = ExtractHighWaterMark(strategy, 1);
            SetUpReadableStreamDefaultControllerFromUnderlyingSource(this, underlyingSource, highWaterMark, sizeAlgorithm);
          }
        }
        get locked() {
          if (!IsReadableStream(this)) {
            throw streamBrandCheckException$1("locked");
          }
          return IsReadableStreamLocked(this);
        }
        cancel(reason = void 0) {
          if (!IsReadableStream(this)) {
            return promiseRejectedWith(streamBrandCheckException$1("cancel"));
          }
          if (IsReadableStreamLocked(this)) {
            return promiseRejectedWith(new TypeError("Cannot cancel a stream that already has a reader"));
          }
          return ReadableStreamCancel(this, reason);
        }
        getReader(rawOptions = void 0) {
          if (!IsReadableStream(this)) {
            throw streamBrandCheckException$1("getReader");
          }
          const options = convertReaderOptions(rawOptions, "First parameter");
          if (options.mode === void 0) {
            return AcquireReadableStreamDefaultReader(this);
          }
          return AcquireReadableStreamBYOBReader(this);
        }
        pipeThrough(rawTransform, rawOptions = {}) {
          if (!IsReadableStream(this)) {
            throw streamBrandCheckException$1("pipeThrough");
          }
          assertRequiredArgument(rawTransform, 1, "pipeThrough");
          const transform = convertReadableWritablePair(rawTransform, "First parameter");
          const options = convertPipeOptions(rawOptions, "Second parameter");
          if (IsReadableStreamLocked(this)) {
            throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked ReadableStream");
          }
          if (IsWritableStreamLocked(transform.writable)) {
            throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked WritableStream");
          }
          const promise = ReadableStreamPipeTo(this, transform.writable, options.preventClose, options.preventAbort, options.preventCancel, options.signal);
          setPromiseIsHandledToTrue(promise);
          return transform.readable;
        }
        pipeTo(destination, rawOptions = {}) {
          if (!IsReadableStream(this)) {
            return promiseRejectedWith(streamBrandCheckException$1("pipeTo"));
          }
          if (destination === void 0) {
            return promiseRejectedWith(`Parameter 1 is required in 'pipeTo'.`);
          }
          if (!IsWritableStream(destination)) {
            return promiseRejectedWith(new TypeError(`ReadableStream.prototype.pipeTo's first argument must be a WritableStream`));
          }
          let options;
          try {
            options = convertPipeOptions(rawOptions, "Second parameter");
          } catch (e) {
            return promiseRejectedWith(e);
          }
          if (IsReadableStreamLocked(this)) {
            return promiseRejectedWith(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream"));
          }
          if (IsWritableStreamLocked(destination)) {
            return promiseRejectedWith(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream"));
          }
          return ReadableStreamPipeTo(this, destination, options.preventClose, options.preventAbort, options.preventCancel, options.signal);
        }
        tee() {
          if (!IsReadableStream(this)) {
            throw streamBrandCheckException$1("tee");
          }
          const branches = ReadableStreamTee(this);
          return CreateArrayFromList(branches);
        }
        values(rawOptions = void 0) {
          if (!IsReadableStream(this)) {
            throw streamBrandCheckException$1("values");
          }
          const options = convertIteratorOptions(rawOptions, "First parameter");
          return AcquireReadableStreamAsyncIterator(this, options.preventCancel);
        }
      }
      Object.defineProperties(ReadableStream2.prototype, {
        cancel: { enumerable: true },
        getReader: { enumerable: true },
        pipeThrough: { enumerable: true },
        pipeTo: { enumerable: true },
        tee: { enumerable: true },
        values: { enumerable: true },
        locked: { enumerable: true }
      });
      if (typeof SymbolPolyfill.toStringTag === "symbol") {
        Object.defineProperty(ReadableStream2.prototype, SymbolPolyfill.toStringTag, {
          value: "ReadableStream",
          configurable: true
        });
      }
      if (typeof SymbolPolyfill.asyncIterator === "symbol") {
        Object.defineProperty(ReadableStream2.prototype, SymbolPolyfill.asyncIterator, {
          value: ReadableStream2.prototype.values,
          writable: true,
          configurable: true
        });
      }
      function CreateReadableStream(startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark = 1, sizeAlgorithm = () => 1) {
        const stream = Object.create(ReadableStream2.prototype);
        InitializeReadableStream(stream);
        const controller = Object.create(ReadableStreamDefaultController.prototype);
        SetUpReadableStreamDefaultController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm);
        return stream;
      }
      function CreateReadableByteStream(startAlgorithm, pullAlgorithm, cancelAlgorithm) {
        const stream = Object.create(ReadableStream2.prototype);
        InitializeReadableStream(stream);
        const controller = Object.create(ReadableByteStreamController.prototype);
        SetUpReadableByteStreamController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, 0, void 0);
        return stream;
      }
      function InitializeReadableStream(stream) {
        stream._state = "readable";
        stream._reader = void 0;
        stream._storedError = void 0;
        stream._disturbed = false;
      }
      function IsReadableStream(x) {
        if (!typeIsObject(x)) {
          return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, "_readableStreamController")) {
          return false;
        }
        return x instanceof ReadableStream2;
      }
      function IsReadableStreamLocked(stream) {
        if (stream._reader === void 0) {
          return false;
        }
        return true;
      }
      function ReadableStreamCancel(stream, reason) {
        stream._disturbed = true;
        if (stream._state === "closed") {
          return promiseResolvedWith(void 0);
        }
        if (stream._state === "errored") {
          return promiseRejectedWith(stream._storedError);
        }
        ReadableStreamClose(stream);
        const reader = stream._reader;
        if (reader !== void 0 && IsReadableStreamBYOBReader(reader)) {
          reader._readIntoRequests.forEach((readIntoRequest) => {
            readIntoRequest._closeSteps(void 0);
          });
          reader._readIntoRequests = new SimpleQueue();
        }
        const sourceCancelPromise = stream._readableStreamController[CancelSteps](reason);
        return transformPromiseWith(sourceCancelPromise, noop);
      }
      function ReadableStreamClose(stream) {
        stream._state = "closed";
        const reader = stream._reader;
        if (reader === void 0) {
          return;
        }
        defaultReaderClosedPromiseResolve(reader);
        if (IsReadableStreamDefaultReader(reader)) {
          reader._readRequests.forEach((readRequest) => {
            readRequest._closeSteps();
          });
          reader._readRequests = new SimpleQueue();
        }
      }
      function ReadableStreamError(stream, e) {
        stream._state = "errored";
        stream._storedError = e;
        const reader = stream._reader;
        if (reader === void 0) {
          return;
        }
        defaultReaderClosedPromiseReject(reader, e);
        if (IsReadableStreamDefaultReader(reader)) {
          reader._readRequests.forEach((readRequest) => {
            readRequest._errorSteps(e);
          });
          reader._readRequests = new SimpleQueue();
        } else {
          reader._readIntoRequests.forEach((readIntoRequest) => {
            readIntoRequest._errorSteps(e);
          });
          reader._readIntoRequests = new SimpleQueue();
        }
      }
      function streamBrandCheckException$1(name) {
        return new TypeError(`ReadableStream.prototype.${name} can only be used on a ReadableStream`);
      }
      function convertQueuingStrategyInit(init2, context) {
        assertDictionary(init2, context);
        const highWaterMark = init2 === null || init2 === void 0 ? void 0 : init2.highWaterMark;
        assertRequiredField(highWaterMark, "highWaterMark", "QueuingStrategyInit");
        return {
          highWaterMark: convertUnrestrictedDouble(highWaterMark)
        };
      }
      const byteLengthSizeFunction = (chunk) => {
        return chunk.byteLength;
      };
      try {
        Object.defineProperty(byteLengthSizeFunction, "name", {
          value: "size",
          configurable: true
        });
      } catch (_a3) {
      }
      class ByteLengthQueuingStrategy {
        constructor(options) {
          assertRequiredArgument(options, 1, "ByteLengthQueuingStrategy");
          options = convertQueuingStrategyInit(options, "First parameter");
          this._byteLengthQueuingStrategyHighWaterMark = options.highWaterMark;
        }
        get highWaterMark() {
          if (!IsByteLengthQueuingStrategy(this)) {
            throw byteLengthBrandCheckException("highWaterMark");
          }
          return this._byteLengthQueuingStrategyHighWaterMark;
        }
        get size() {
          if (!IsByteLengthQueuingStrategy(this)) {
            throw byteLengthBrandCheckException("size");
          }
          return byteLengthSizeFunction;
        }
      }
      Object.defineProperties(ByteLengthQueuingStrategy.prototype, {
        highWaterMark: { enumerable: true },
        size: { enumerable: true }
      });
      if (typeof SymbolPolyfill.toStringTag === "symbol") {
        Object.defineProperty(ByteLengthQueuingStrategy.prototype, SymbolPolyfill.toStringTag, {
          value: "ByteLengthQueuingStrategy",
          configurable: true
        });
      }
      function byteLengthBrandCheckException(name) {
        return new TypeError(`ByteLengthQueuingStrategy.prototype.${name} can only be used on a ByteLengthQueuingStrategy`);
      }
      function IsByteLengthQueuingStrategy(x) {
        if (!typeIsObject(x)) {
          return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, "_byteLengthQueuingStrategyHighWaterMark")) {
          return false;
        }
        return x instanceof ByteLengthQueuingStrategy;
      }
      const countSizeFunction = () => {
        return 1;
      };
      try {
        Object.defineProperty(countSizeFunction, "name", {
          value: "size",
          configurable: true
        });
      } catch (_a3) {
      }
      class CountQueuingStrategy {
        constructor(options) {
          assertRequiredArgument(options, 1, "CountQueuingStrategy");
          options = convertQueuingStrategyInit(options, "First parameter");
          this._countQueuingStrategyHighWaterMark = options.highWaterMark;
        }
        get highWaterMark() {
          if (!IsCountQueuingStrategy(this)) {
            throw countBrandCheckException("highWaterMark");
          }
          return this._countQueuingStrategyHighWaterMark;
        }
        get size() {
          if (!IsCountQueuingStrategy(this)) {
            throw countBrandCheckException("size");
          }
          return countSizeFunction;
        }
      }
      Object.defineProperties(CountQueuingStrategy.prototype, {
        highWaterMark: { enumerable: true },
        size: { enumerable: true }
      });
      if (typeof SymbolPolyfill.toStringTag === "symbol") {
        Object.defineProperty(CountQueuingStrategy.prototype, SymbolPolyfill.toStringTag, {
          value: "CountQueuingStrategy",
          configurable: true
        });
      }
      function countBrandCheckException(name) {
        return new TypeError(`CountQueuingStrategy.prototype.${name} can only be used on a CountQueuingStrategy`);
      }
      function IsCountQueuingStrategy(x) {
        if (!typeIsObject(x)) {
          return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, "_countQueuingStrategyHighWaterMark")) {
          return false;
        }
        return x instanceof CountQueuingStrategy;
      }
      function convertTransformer(original, context) {
        assertDictionary(original, context);
        const flush = original === null || original === void 0 ? void 0 : original.flush;
        const readableType = original === null || original === void 0 ? void 0 : original.readableType;
        const start = original === null || original === void 0 ? void 0 : original.start;
        const transform = original === null || original === void 0 ? void 0 : original.transform;
        const writableType = original === null || original === void 0 ? void 0 : original.writableType;
        return {
          flush: flush === void 0 ? void 0 : convertTransformerFlushCallback(flush, original, `${context} has member 'flush' that`),
          readableType,
          start: start === void 0 ? void 0 : convertTransformerStartCallback(start, original, `${context} has member 'start' that`),
          transform: transform === void 0 ? void 0 : convertTransformerTransformCallback(transform, original, `${context} has member 'transform' that`),
          writableType
        };
      }
      function convertTransformerFlushCallback(fn, original, context) {
        assertFunction(fn, context);
        return (controller) => promiseCall(fn, original, [controller]);
      }
      function convertTransformerStartCallback(fn, original, context) {
        assertFunction(fn, context);
        return (controller) => reflectCall(fn, original, [controller]);
      }
      function convertTransformerTransformCallback(fn, original, context) {
        assertFunction(fn, context);
        return (chunk, controller) => promiseCall(fn, original, [chunk, controller]);
      }
      class TransformStream {
        constructor(rawTransformer = {}, rawWritableStrategy = {}, rawReadableStrategy = {}) {
          if (rawTransformer === void 0) {
            rawTransformer = null;
          }
          const writableStrategy = convertQueuingStrategy(rawWritableStrategy, "Second parameter");
          const readableStrategy = convertQueuingStrategy(rawReadableStrategy, "Third parameter");
          const transformer = convertTransformer(rawTransformer, "First parameter");
          if (transformer.readableType !== void 0) {
            throw new RangeError("Invalid readableType specified");
          }
          if (transformer.writableType !== void 0) {
            throw new RangeError("Invalid writableType specified");
          }
          const readableHighWaterMark = ExtractHighWaterMark(readableStrategy, 0);
          const readableSizeAlgorithm = ExtractSizeAlgorithm(readableStrategy);
          const writableHighWaterMark = ExtractHighWaterMark(writableStrategy, 1);
          const writableSizeAlgorithm = ExtractSizeAlgorithm(writableStrategy);
          let startPromise_resolve;
          const startPromise = newPromise((resolve) => {
            startPromise_resolve = resolve;
          });
          InitializeTransformStream(this, startPromise, writableHighWaterMark, writableSizeAlgorithm, readableHighWaterMark, readableSizeAlgorithm);
          SetUpTransformStreamDefaultControllerFromTransformer(this, transformer);
          if (transformer.start !== void 0) {
            startPromise_resolve(transformer.start(this._transformStreamController));
          } else {
            startPromise_resolve(void 0);
          }
        }
        get readable() {
          if (!IsTransformStream(this)) {
            throw streamBrandCheckException("readable");
          }
          return this._readable;
        }
        get writable() {
          if (!IsTransformStream(this)) {
            throw streamBrandCheckException("writable");
          }
          return this._writable;
        }
      }
      Object.defineProperties(TransformStream.prototype, {
        readable: { enumerable: true },
        writable: { enumerable: true }
      });
      if (typeof SymbolPolyfill.toStringTag === "symbol") {
        Object.defineProperty(TransformStream.prototype, SymbolPolyfill.toStringTag, {
          value: "TransformStream",
          configurable: true
        });
      }
      function InitializeTransformStream(stream, startPromise, writableHighWaterMark, writableSizeAlgorithm, readableHighWaterMark, readableSizeAlgorithm) {
        function startAlgorithm() {
          return startPromise;
        }
        function writeAlgorithm(chunk) {
          return TransformStreamDefaultSinkWriteAlgorithm(stream, chunk);
        }
        function abortAlgorithm(reason) {
          return TransformStreamDefaultSinkAbortAlgorithm(stream, reason);
        }
        function closeAlgorithm() {
          return TransformStreamDefaultSinkCloseAlgorithm(stream);
        }
        stream._writable = CreateWritableStream(startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, writableHighWaterMark, writableSizeAlgorithm);
        function pullAlgorithm() {
          return TransformStreamDefaultSourcePullAlgorithm(stream);
        }
        function cancelAlgorithm(reason) {
          TransformStreamErrorWritableAndUnblockWrite(stream, reason);
          return promiseResolvedWith(void 0);
        }
        stream._readable = CreateReadableStream(startAlgorithm, pullAlgorithm, cancelAlgorithm, readableHighWaterMark, readableSizeAlgorithm);
        stream._backpressure = void 0;
        stream._backpressureChangePromise = void 0;
        stream._backpressureChangePromise_resolve = void 0;
        TransformStreamSetBackpressure(stream, true);
        stream._transformStreamController = void 0;
      }
      function IsTransformStream(x) {
        if (!typeIsObject(x)) {
          return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, "_transformStreamController")) {
          return false;
        }
        return x instanceof TransformStream;
      }
      function TransformStreamError(stream, e) {
        ReadableStreamDefaultControllerError(stream._readable._readableStreamController, e);
        TransformStreamErrorWritableAndUnblockWrite(stream, e);
      }
      function TransformStreamErrorWritableAndUnblockWrite(stream, e) {
        TransformStreamDefaultControllerClearAlgorithms(stream._transformStreamController);
        WritableStreamDefaultControllerErrorIfNeeded(stream._writable._writableStreamController, e);
        if (stream._backpressure) {
          TransformStreamSetBackpressure(stream, false);
        }
      }
      function TransformStreamSetBackpressure(stream, backpressure) {
        if (stream._backpressureChangePromise !== void 0) {
          stream._backpressureChangePromise_resolve();
        }
        stream._backpressureChangePromise = newPromise((resolve) => {
          stream._backpressureChangePromise_resolve = resolve;
        });
        stream._backpressure = backpressure;
      }
      class TransformStreamDefaultController {
        constructor() {
          throw new TypeError("Illegal constructor");
        }
        get desiredSize() {
          if (!IsTransformStreamDefaultController(this)) {
            throw defaultControllerBrandCheckException("desiredSize");
          }
          const readableController = this._controlledTransformStream._readable._readableStreamController;
          return ReadableStreamDefaultControllerGetDesiredSize(readableController);
        }
        enqueue(chunk = void 0) {
          if (!IsTransformStreamDefaultController(this)) {
            throw defaultControllerBrandCheckException("enqueue");
          }
          TransformStreamDefaultControllerEnqueue(this, chunk);
        }
        error(reason = void 0) {
          if (!IsTransformStreamDefaultController(this)) {
            throw defaultControllerBrandCheckException("error");
          }
          TransformStreamDefaultControllerError(this, reason);
        }
        terminate() {
          if (!IsTransformStreamDefaultController(this)) {
            throw defaultControllerBrandCheckException("terminate");
          }
          TransformStreamDefaultControllerTerminate(this);
        }
      }
      Object.defineProperties(TransformStreamDefaultController.prototype, {
        enqueue: { enumerable: true },
        error: { enumerable: true },
        terminate: { enumerable: true },
        desiredSize: { enumerable: true }
      });
      if (typeof SymbolPolyfill.toStringTag === "symbol") {
        Object.defineProperty(TransformStreamDefaultController.prototype, SymbolPolyfill.toStringTag, {
          value: "TransformStreamDefaultController",
          configurable: true
        });
      }
      function IsTransformStreamDefaultController(x) {
        if (!typeIsObject(x)) {
          return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, "_controlledTransformStream")) {
          return false;
        }
        return x instanceof TransformStreamDefaultController;
      }
      function SetUpTransformStreamDefaultController(stream, controller, transformAlgorithm, flushAlgorithm) {
        controller._controlledTransformStream = stream;
        stream._transformStreamController = controller;
        controller._transformAlgorithm = transformAlgorithm;
        controller._flushAlgorithm = flushAlgorithm;
      }
      function SetUpTransformStreamDefaultControllerFromTransformer(stream, transformer) {
        const controller = Object.create(TransformStreamDefaultController.prototype);
        let transformAlgorithm = (chunk) => {
          try {
            TransformStreamDefaultControllerEnqueue(controller, chunk);
            return promiseResolvedWith(void 0);
          } catch (transformResultE) {
            return promiseRejectedWith(transformResultE);
          }
        };
        let flushAlgorithm = () => promiseResolvedWith(void 0);
        if (transformer.transform !== void 0) {
          transformAlgorithm = (chunk) => transformer.transform(chunk, controller);
        }
        if (transformer.flush !== void 0) {
          flushAlgorithm = () => transformer.flush(controller);
        }
        SetUpTransformStreamDefaultController(stream, controller, transformAlgorithm, flushAlgorithm);
      }
      function TransformStreamDefaultControllerClearAlgorithms(controller) {
        controller._transformAlgorithm = void 0;
        controller._flushAlgorithm = void 0;
      }
      function TransformStreamDefaultControllerEnqueue(controller, chunk) {
        const stream = controller._controlledTransformStream;
        const readableController = stream._readable._readableStreamController;
        if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(readableController)) {
          throw new TypeError("Readable side is not in a state that permits enqueue");
        }
        try {
          ReadableStreamDefaultControllerEnqueue(readableController, chunk);
        } catch (e) {
          TransformStreamErrorWritableAndUnblockWrite(stream, e);
          throw stream._readable._storedError;
        }
        const backpressure = ReadableStreamDefaultControllerHasBackpressure(readableController);
        if (backpressure !== stream._backpressure) {
          TransformStreamSetBackpressure(stream, true);
        }
      }
      function TransformStreamDefaultControllerError(controller, e) {
        TransformStreamError(controller._controlledTransformStream, e);
      }
      function TransformStreamDefaultControllerPerformTransform(controller, chunk) {
        const transformPromise = controller._transformAlgorithm(chunk);
        return transformPromiseWith(transformPromise, void 0, (r) => {
          TransformStreamError(controller._controlledTransformStream, r);
          throw r;
        });
      }
      function TransformStreamDefaultControllerTerminate(controller) {
        const stream = controller._controlledTransformStream;
        const readableController = stream._readable._readableStreamController;
        ReadableStreamDefaultControllerClose(readableController);
        const error = new TypeError("TransformStream terminated");
        TransformStreamErrorWritableAndUnblockWrite(stream, error);
      }
      function TransformStreamDefaultSinkWriteAlgorithm(stream, chunk) {
        const controller = stream._transformStreamController;
        if (stream._backpressure) {
          const backpressureChangePromise = stream._backpressureChangePromise;
          return transformPromiseWith(backpressureChangePromise, () => {
            const writable = stream._writable;
            const state = writable._state;
            if (state === "erroring") {
              throw writable._storedError;
            }
            return TransformStreamDefaultControllerPerformTransform(controller, chunk);
          });
        }
        return TransformStreamDefaultControllerPerformTransform(controller, chunk);
      }
      function TransformStreamDefaultSinkAbortAlgorithm(stream, reason) {
        TransformStreamError(stream, reason);
        return promiseResolvedWith(void 0);
      }
      function TransformStreamDefaultSinkCloseAlgorithm(stream) {
        const readable = stream._readable;
        const controller = stream._transformStreamController;
        const flushPromise = controller._flushAlgorithm();
        TransformStreamDefaultControllerClearAlgorithms(controller);
        return transformPromiseWith(flushPromise, () => {
          if (readable._state === "errored") {
            throw readable._storedError;
          }
          ReadableStreamDefaultControllerClose(readable._readableStreamController);
        }, (r) => {
          TransformStreamError(stream, r);
          throw readable._storedError;
        });
      }
      function TransformStreamDefaultSourcePullAlgorithm(stream) {
        TransformStreamSetBackpressure(stream, false);
        return stream._backpressureChangePromise;
      }
      function defaultControllerBrandCheckException(name) {
        return new TypeError(`TransformStreamDefaultController.prototype.${name} can only be used on a TransformStreamDefaultController`);
      }
      function streamBrandCheckException(name) {
        return new TypeError(`TransformStream.prototype.${name} can only be used on a TransformStream`);
      }
      const exports$1 = {
        ReadableStream: ReadableStream2,
        ReadableStreamDefaultController,
        ReadableByteStreamController,
        ReadableStreamBYOBRequest,
        ReadableStreamDefaultReader,
        ReadableStreamBYOBReader,
        WritableStream: WritableStream2,
        WritableStreamDefaultController,
        WritableStreamDefaultWriter,
        ByteLengthQueuingStrategy,
        CountQueuingStrategy,
        TransformStream,
        TransformStreamDefaultController
      };
      if (typeof globals !== "undefined") {
        for (const prop in exports$1) {
          if (Object.prototype.hasOwnProperty.call(exports$1, prop)) {
            Object.defineProperty(globals, prop, {
              value: exports$1[prop],
              writable: true,
              configurable: true
            });
          }
        }
      }
      exports2.ByteLengthQueuingStrategy = ByteLengthQueuingStrategy;
      exports2.CountQueuingStrategy = CountQueuingStrategy;
      exports2.ReadableByteStreamController = ReadableByteStreamController;
      exports2.ReadableStream = ReadableStream2;
      exports2.ReadableStreamBYOBReader = ReadableStreamBYOBReader;
      exports2.ReadableStreamBYOBRequest = ReadableStreamBYOBRequest;
      exports2.ReadableStreamDefaultController = ReadableStreamDefaultController;
      exports2.ReadableStreamDefaultReader = ReadableStreamDefaultReader;
      exports2.TransformStream = TransformStream;
      exports2.TransformStreamDefaultController = TransformStreamDefaultController;
      exports2.WritableStream = WritableStream2;
      exports2.WritableStreamDefaultController = WritableStreamDefaultController;
      exports2.WritableStreamDefaultWriter = WritableStreamDefaultWriter;
      Object.defineProperty(exports2, "__esModule", { value: true });
    });
  }
});

// node_modules/text-encoding-utf-8/lib/encoding.lib.js
var require_encoding_lib = __commonJS({
  "node_modules/text-encoding-utf-8/lib/encoding.lib.js"(exports) {
    "use strict";
    function inRange(a, min, max) {
      return min <= a && a <= max;
    }
    function ToDictionary(o) {
      if (o === void 0)
        return {};
      if (o === Object(o))
        return o;
      throw TypeError("Could not convert argument to dictionary");
    }
    function stringToCodePoints(string) {
      var s = String(string);
      var n = s.length;
      var i = 0;
      var u = [];
      while (i < n) {
        var c = s.charCodeAt(i);
        if (c < 55296 || c > 57343) {
          u.push(c);
        } else if (56320 <= c && c <= 57343) {
          u.push(65533);
        } else if (55296 <= c && c <= 56319) {
          if (i === n - 1) {
            u.push(65533);
          } else {
            var d = string.charCodeAt(i + 1);
            if (56320 <= d && d <= 57343) {
              var a = c & 1023;
              var b = d & 1023;
              u.push(65536 + (a << 10) + b);
              i += 1;
            } else {
              u.push(65533);
            }
          }
        }
        i += 1;
      }
      return u;
    }
    function codePointsToString(code_points) {
      var s = "";
      for (var i = 0; i < code_points.length; ++i) {
        var cp = code_points[i];
        if (cp <= 65535) {
          s += String.fromCharCode(cp);
        } else {
          cp -= 65536;
          s += String.fromCharCode(
            (cp >> 10) + 55296,
            (cp & 1023) + 56320
          );
        }
      }
      return s;
    }
    var end_of_stream = -1;
    function Stream(tokens) {
      this.tokens = [].slice.call(tokens);
    }
    Stream.prototype = {
      endOfStream: function() {
        return !this.tokens.length;
      },
      read: function() {
        if (!this.tokens.length)
          return end_of_stream;
        return this.tokens.shift();
      },
      prepend: function(token) {
        if (Array.isArray(token)) {
          var tokens = token;
          while (tokens.length)
            this.tokens.unshift(tokens.pop());
        } else {
          this.tokens.unshift(token);
        }
      },
      push: function(token) {
        if (Array.isArray(token)) {
          var tokens = token;
          while (tokens.length)
            this.tokens.push(tokens.shift());
        } else {
          this.tokens.push(token);
        }
      }
    };
    var finished = -1;
    function decoderError(fatal, opt_code_point) {
      if (fatal)
        throw TypeError("Decoder error");
      return opt_code_point || 65533;
    }
    var DEFAULT_ENCODING = "utf-8";
    function TextDecoder3(encoding, options) {
      if (!(this instanceof TextDecoder3)) {
        return new TextDecoder3(encoding, options);
      }
      encoding = encoding !== void 0 ? String(encoding).toLowerCase() : DEFAULT_ENCODING;
      if (encoding !== DEFAULT_ENCODING) {
        throw new Error("Encoding not supported. Only utf-8 is supported");
      }
      options = ToDictionary(options);
      this._streaming = false;
      this._BOMseen = false;
      this._decoder = null;
      this._fatal = Boolean(options["fatal"]);
      this._ignoreBOM = Boolean(options["ignoreBOM"]);
      Object.defineProperty(this, "encoding", { value: "utf-8" });
      Object.defineProperty(this, "fatal", { value: this._fatal });
      Object.defineProperty(this, "ignoreBOM", { value: this._ignoreBOM });
    }
    TextDecoder3.prototype = {
      decode: function decode(input, options) {
        var bytes;
        if (typeof input === "object" && input instanceof ArrayBuffer) {
          bytes = new Uint8Array(input);
        } else if (typeof input === "object" && "buffer" in input && input.buffer instanceof ArrayBuffer) {
          bytes = new Uint8Array(
            input.buffer,
            input.byteOffset,
            input.byteLength
          );
        } else {
          bytes = new Uint8Array(0);
        }
        options = ToDictionary(options);
        if (!this._streaming) {
          this._decoder = new UTF8Decoder({ fatal: this._fatal });
          this._BOMseen = false;
        }
        this._streaming = Boolean(options["stream"]);
        var input_stream = new Stream(bytes);
        var code_points = [];
        var result;
        while (!input_stream.endOfStream()) {
          result = this._decoder.handler(input_stream, input_stream.read());
          if (result === finished)
            break;
          if (result === null)
            continue;
          if (Array.isArray(result))
            code_points.push.apply(code_points, result);
          else
            code_points.push(result);
        }
        if (!this._streaming) {
          do {
            result = this._decoder.handler(input_stream, input_stream.read());
            if (result === finished)
              break;
            if (result === null)
              continue;
            if (Array.isArray(result))
              code_points.push.apply(code_points, result);
            else
              code_points.push(result);
          } while (!input_stream.endOfStream());
          this._decoder = null;
        }
        if (code_points.length) {
          if (["utf-8"].indexOf(this.encoding) !== -1 && !this._ignoreBOM && !this._BOMseen) {
            if (code_points[0] === 65279) {
              this._BOMseen = true;
              code_points.shift();
            } else {
              this._BOMseen = true;
            }
          }
        }
        return codePointsToString(code_points);
      }
    };
    function TextEncoder3(encoding, options) {
      if (!(this instanceof TextEncoder3))
        return new TextEncoder3(encoding, options);
      encoding = encoding !== void 0 ? String(encoding).toLowerCase() : DEFAULT_ENCODING;
      if (encoding !== DEFAULT_ENCODING) {
        throw new Error("Encoding not supported. Only utf-8 is supported");
      }
      options = ToDictionary(options);
      this._streaming = false;
      this._encoder = null;
      this._options = { fatal: Boolean(options["fatal"]) };
      Object.defineProperty(this, "encoding", { value: "utf-8" });
    }
    TextEncoder3.prototype = {
      encode: function encode(opt_string, options) {
        opt_string = opt_string ? String(opt_string) : "";
        options = ToDictionary(options);
        if (!this._streaming)
          this._encoder = new UTF8Encoder(this._options);
        this._streaming = Boolean(options["stream"]);
        var bytes = [];
        var input_stream = new Stream(stringToCodePoints(opt_string));
        var result;
        while (!input_stream.endOfStream()) {
          result = this._encoder.handler(input_stream, input_stream.read());
          if (result === finished)
            break;
          if (Array.isArray(result))
            bytes.push.apply(bytes, result);
          else
            bytes.push(result);
        }
        if (!this._streaming) {
          while (true) {
            result = this._encoder.handler(input_stream, input_stream.read());
            if (result === finished)
              break;
            if (Array.isArray(result))
              bytes.push.apply(bytes, result);
            else
              bytes.push(result);
          }
          this._encoder = null;
        }
        return new Uint8Array(bytes);
      }
    };
    function UTF8Decoder(options) {
      var fatal = options.fatal;
      var utf8_code_point = 0, utf8_bytes_seen = 0, utf8_bytes_needed = 0, utf8_lower_boundary = 128, utf8_upper_boundary = 191;
      this.handler = function(stream, bite) {
        if (bite === end_of_stream && utf8_bytes_needed !== 0) {
          utf8_bytes_needed = 0;
          return decoderError(fatal);
        }
        if (bite === end_of_stream)
          return finished;
        if (utf8_bytes_needed === 0) {
          if (inRange(bite, 0, 127)) {
            return bite;
          }
          if (inRange(bite, 194, 223)) {
            utf8_bytes_needed = 1;
            utf8_code_point = bite - 192;
          } else if (inRange(bite, 224, 239)) {
            if (bite === 224)
              utf8_lower_boundary = 160;
            if (bite === 237)
              utf8_upper_boundary = 159;
            utf8_bytes_needed = 2;
            utf8_code_point = bite - 224;
          } else if (inRange(bite, 240, 244)) {
            if (bite === 240)
              utf8_lower_boundary = 144;
            if (bite === 244)
              utf8_upper_boundary = 143;
            utf8_bytes_needed = 3;
            utf8_code_point = bite - 240;
          } else {
            return decoderError(fatal);
          }
          utf8_code_point = utf8_code_point << 6 * utf8_bytes_needed;
          return null;
        }
        if (!inRange(bite, utf8_lower_boundary, utf8_upper_boundary)) {
          utf8_code_point = utf8_bytes_needed = utf8_bytes_seen = 0;
          utf8_lower_boundary = 128;
          utf8_upper_boundary = 191;
          stream.prepend(bite);
          return decoderError(fatal);
        }
        utf8_lower_boundary = 128;
        utf8_upper_boundary = 191;
        utf8_bytes_seen += 1;
        utf8_code_point += bite - 128 << 6 * (utf8_bytes_needed - utf8_bytes_seen);
        if (utf8_bytes_seen !== utf8_bytes_needed)
          return null;
        var code_point = utf8_code_point;
        utf8_code_point = utf8_bytes_needed = utf8_bytes_seen = 0;
        return code_point;
      };
    }
    function UTF8Encoder(options) {
      var fatal = options.fatal;
      this.handler = function(stream, code_point) {
        if (code_point === end_of_stream)
          return finished;
        if (inRange(code_point, 0, 127))
          return code_point;
        var count, offset;
        if (inRange(code_point, 128, 2047)) {
          count = 1;
          offset = 192;
        } else if (inRange(code_point, 2048, 65535)) {
          count = 2;
          offset = 224;
        } else if (inRange(code_point, 65536, 1114111)) {
          count = 3;
          offset = 240;
        }
        var bytes = [(code_point >> 6 * count) + offset];
        while (count > 0) {
          var temp = code_point >> 6 * (count - 1);
          bytes.push(128 | temp & 63);
          count -= 1;
        }
        return bytes;
      };
    }
    exports.TextEncoder = TextEncoder3;
    exports.TextDecoder = TextDecoder3;
  }
});

// node_modules/blob-polyfill/Blob.js
var require_Blob = __commonJS({
  "node_modules/blob-polyfill/Blob.js"(exports) {
    (function(global2) {
      (function(factory) {
        if (typeof define === "function" && define.amd) {
          define(["exports"], factory);
        } else if (typeof exports === "object" && typeof exports.nodeName !== "string") {
          factory(exports);
        } else {
          factory(global2);
        }
      })(function(exports2) {
        "use strict";
        var BlobBuilder = global2.BlobBuilder || global2.WebKitBlobBuilder || global2.MSBlobBuilder || global2.MozBlobBuilder;
        var URL2 = global2.URL || global2.webkitURL || function(href, a) {
          a = document.createElement("a");
          a.href = href;
          return a;
        };
        var origBlob = global2.Blob;
        var createObjectURL = URL2.createObjectURL;
        var revokeObjectURL = URL2.revokeObjectURL;
        var strTag = global2.Symbol && global2.Symbol.toStringTag;
        var blobSupported = false;
        var blobSupportsArrayBufferView = false;
        var blobBuilderSupported = BlobBuilder && BlobBuilder.prototype.append && BlobBuilder.prototype.getBlob;
        try {
          blobSupported = new Blob(["\xE4"]).size === 2;
          blobSupportsArrayBufferView = new Blob([new Uint8Array([1, 2])]).size === 2;
        } catch (e) {
        }
        function mapArrayBufferViews(ary) {
          return ary.map(function(chunk) {
            if (chunk.buffer instanceof ArrayBuffer) {
              var buf = chunk.buffer;
              if (chunk.byteLength !== buf.byteLength) {
                var copy = new Uint8Array(chunk.byteLength);
                copy.set(new Uint8Array(buf, chunk.byteOffset, chunk.byteLength));
                buf = copy.buffer;
              }
              return buf;
            }
            return chunk;
          });
        }
        function BlobBuilderConstructor(ary, options) {
          options = options || {};
          var bb = new BlobBuilder();
          mapArrayBufferViews(ary).forEach(function(part) {
            bb.append(part);
          });
          return options.type ? bb.getBlob(options.type) : bb.getBlob();
        }
        function BlobConstructor(ary, options) {
          return new origBlob(mapArrayBufferViews(ary), options || {});
        }
        if (global2.Blob) {
          BlobBuilderConstructor.prototype = Blob.prototype;
          BlobConstructor.prototype = Blob.prototype;
        }
        function stringEncode(string) {
          var pos = 0;
          var len = string.length;
          var Arr = global2.Uint8Array || Array;
          var at = 0;
          var tlen = Math.max(32, len + (len >> 1) + 7);
          var target = new Arr(tlen >> 3 << 3);
          while (pos < len) {
            var value = string.charCodeAt(pos++);
            if (value >= 55296 && value <= 56319) {
              if (pos < len) {
                var extra = string.charCodeAt(pos);
                if ((extra & 64512) === 56320) {
                  ++pos;
                  value = ((value & 1023) << 10) + (extra & 1023) + 65536;
                }
              }
              if (value >= 55296 && value <= 56319) {
                continue;
              }
            }
            if (at + 4 > target.length) {
              tlen += 8;
              tlen *= 1 + pos / string.length * 2;
              tlen = tlen >> 3 << 3;
              var update = new Uint8Array(tlen);
              update.set(target);
              target = update;
            }
            if ((value & 4294967168) === 0) {
              target[at++] = value;
              continue;
            } else if ((value & 4294965248) === 0) {
              target[at++] = value >> 6 & 31 | 192;
            } else if ((value & 4294901760) === 0) {
              target[at++] = value >> 12 & 15 | 224;
              target[at++] = value >> 6 & 63 | 128;
            } else if ((value & 4292870144) === 0) {
              target[at++] = value >> 18 & 7 | 240;
              target[at++] = value >> 12 & 63 | 128;
              target[at++] = value >> 6 & 63 | 128;
            } else {
              continue;
            }
            target[at++] = value & 63 | 128;
          }
          return target.slice(0, at);
        }
        function stringDecode(buf) {
          var end = buf.length;
          var res = [];
          var i = 0;
          while (i < end) {
            var firstByte = buf[i];
            var codePoint = null;
            var bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
            if (i + bytesPerSequence <= end) {
              var secondByte, thirdByte, fourthByte, tempCodePoint;
              switch (bytesPerSequence) {
                case 1:
                  if (firstByte < 128) {
                    codePoint = firstByte;
                  }
                  break;
                case 2:
                  secondByte = buf[i + 1];
                  if ((secondByte & 192) === 128) {
                    tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                    if (tempCodePoint > 127) {
                      codePoint = tempCodePoint;
                    }
                  }
                  break;
                case 3:
                  secondByte = buf[i + 1];
                  thirdByte = buf[i + 2];
                  if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                    tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                    if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
                      codePoint = tempCodePoint;
                    }
                  }
                  break;
                case 4:
                  secondByte = buf[i + 1];
                  thirdByte = buf[i + 2];
                  fourthByte = buf[i + 3];
                  if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                    tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                    if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
                      codePoint = tempCodePoint;
                    }
                  }
              }
            }
            if (codePoint === null) {
              codePoint = 65533;
              bytesPerSequence = 1;
            } else if (codePoint > 65535) {
              codePoint -= 65536;
              res.push(codePoint >>> 10 & 1023 | 55296);
              codePoint = 56320 | codePoint & 1023;
            }
            res.push(codePoint);
            i += bytesPerSequence;
          }
          var len = res.length;
          var str = "";
          var j = 0;
          while (j < len) {
            str += String.fromCharCode.apply(String, res.slice(j, j += 4096));
          }
          return str;
        }
        var textEncode = typeof TextEncoder === "function" ? TextEncoder.prototype.encode.bind(new TextEncoder()) : stringEncode;
        var textDecode = typeof TextDecoder === "function" ? TextDecoder.prototype.decode.bind(new TextDecoder()) : stringDecode;
        function FakeBlobBuilder() {
          function bufferClone(buf) {
            var view = new Array(buf.byteLength);
            var array = new Uint8Array(buf);
            var i = view.length;
            while (i--) {
              view[i] = array[i];
            }
            return view;
          }
          function array2base64(input) {
            var byteToCharMap = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
            var output = [];
            for (var i = 0; i < input.length; i += 3) {
              var byte1 = input[i];
              var haveByte2 = i + 1 < input.length;
              var byte2 = haveByte2 ? input[i + 1] : 0;
              var haveByte3 = i + 2 < input.length;
              var byte3 = haveByte3 ? input[i + 2] : 0;
              var outByte1 = byte1 >> 2;
              var outByte2 = (byte1 & 3) << 4 | byte2 >> 4;
              var outByte3 = (byte2 & 15) << 2 | byte3 >> 6;
              var outByte4 = byte3 & 63;
              if (!haveByte3) {
                outByte4 = 64;
                if (!haveByte2) {
                  outByte3 = 64;
                }
              }
              output.push(
                byteToCharMap[outByte1],
                byteToCharMap[outByte2],
                byteToCharMap[outByte3],
                byteToCharMap[outByte4]
              );
            }
            return output.join("");
          }
          var create = Object.create || function(a) {
            function c() {
            }
            c.prototype = a;
            return new c();
          };
          function getObjectTypeName(o) {
            return Object.prototype.toString.call(o).slice(8, -1);
          }
          function isPrototypeOf(c, o) {
            return typeof c === "object" && Object.prototype.isPrototypeOf.call(c.prototype, o);
          }
          function isDataView(o) {
            return getObjectTypeName(o) === "DataView" || isPrototypeOf(global2.DataView, o);
          }
          var arrayBufferClassNames = [
            "Int8Array",
            "Uint8Array",
            "Uint8ClampedArray",
            "Int16Array",
            "Uint16Array",
            "Int32Array",
            "Uint32Array",
            "Float32Array",
            "Float64Array",
            "ArrayBuffer"
          ];
          function includes(a, v) {
            return a.indexOf(v) !== -1;
          }
          function isArrayBuffer(o) {
            return includes(arrayBufferClassNames, getObjectTypeName(o)) || isPrototypeOf(global2.ArrayBuffer, o);
          }
          function concatTypedarrays(chunks) {
            var size = 0;
            var j = chunks.length;
            while (j--) {
              size += chunks[j].length;
            }
            var b = new Uint8Array(size);
            var offset = 0;
            for (var i = 0; i < chunks.length; i++) {
              var chunk = chunks[i];
              b.set(chunk, offset);
              offset += chunk.byteLength || chunk.length;
            }
            return b;
          }
          function Blob3(chunks, opts) {
            chunks = chunks ? chunks.slice() : [];
            opts = opts == null ? {} : opts;
            for (var i = 0, len = chunks.length; i < len; i++) {
              var chunk = chunks[i];
              if (chunk instanceof Blob3) {
                chunks[i] = chunk._buffer;
              } else if (typeof chunk === "string") {
                chunks[i] = textEncode(chunk);
              } else if (isDataView(chunk)) {
                chunks[i] = bufferClone(chunk.buffer);
              } else if (isArrayBuffer(chunk)) {
                chunks[i] = bufferClone(chunk);
              } else {
                chunks[i] = textEncode(String(chunk));
              }
            }
            this._buffer = global2.Uint8Array ? concatTypedarrays(chunks) : [].concat.apply([], chunks);
            this.size = this._buffer.length;
            this.type = opts.type || "";
            if (/[^\u0020-\u007E]/.test(this.type)) {
              this.type = "";
            } else {
              this.type = this.type.toLowerCase();
            }
          }
          Blob3.prototype.arrayBuffer = function() {
            return Promise.resolve(this._buffer.buffer || this._buffer);
          };
          Blob3.prototype.text = function() {
            return Promise.resolve(textDecode(this._buffer));
          };
          Blob3.prototype.slice = function(start, end, type) {
            var slice = this._buffer.slice(start || 0, end || this._buffer.length);
            return new Blob3([slice], { type });
          };
          Blob3.prototype.toString = function() {
            return "[object Blob]";
          };
          function File2(chunks, name, opts) {
            opts = opts || {};
            var a = Blob3.call(this, chunks, opts) || this;
            a.name = name.replace(/\//g, ":");
            a.lastModifiedDate = opts.lastModified ? new Date(opts.lastModified) : new Date();
            a.lastModified = +a.lastModifiedDate;
            return a;
          }
          File2.prototype = create(Blob3.prototype);
          File2.prototype.constructor = File2;
          if (Object.setPrototypeOf) {
            Object.setPrototypeOf(File2, Blob3);
          } else {
            try {
              File2.__proto__ = Blob3;
            } catch (e) {
            }
          }
          File2.prototype.toString = function() {
            return "[object File]";
          };
          function FileReader2() {
            if (!(this instanceof FileReader2)) {
              throw new TypeError("Failed to construct 'FileReader': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
            }
            var delegate = document.createDocumentFragment();
            this.addEventListener = delegate.addEventListener;
            this.dispatchEvent = function(evt) {
              var local = this["on" + evt.type];
              if (typeof local === "function")
                local(evt);
              delegate.dispatchEvent(evt);
            };
            this.removeEventListener = delegate.removeEventListener;
          }
          function _read(fr, blob2, kind) {
            if (!(blob2 instanceof Blob3)) {
              throw new TypeError("Failed to execute '" + kind + "' on 'FileReader': parameter 1 is not of type 'Blob'.");
            }
            fr.result = "";
            setTimeout(function() {
              this.readyState = FileReader2.LOADING;
              fr.dispatchEvent(new Event("load"));
              fr.dispatchEvent(new Event("loadend"));
            });
          }
          FileReader2.EMPTY = 0;
          FileReader2.LOADING = 1;
          FileReader2.DONE = 2;
          FileReader2.prototype.error = null;
          FileReader2.prototype.onabort = null;
          FileReader2.prototype.onerror = null;
          FileReader2.prototype.onload = null;
          FileReader2.prototype.onloadend = null;
          FileReader2.prototype.onloadstart = null;
          FileReader2.prototype.onprogress = null;
          FileReader2.prototype.readAsDataURL = function(blob2) {
            _read(this, blob2, "readAsDataURL");
            this.result = "data:" + blob2.type + ";base64," + array2base64(blob2._buffer);
          };
          FileReader2.prototype.readAsText = function(blob2) {
            _read(this, blob2, "readAsText");
            this.result = textDecode(blob2._buffer);
          };
          FileReader2.prototype.readAsArrayBuffer = function(blob2) {
            _read(this, blob2, "readAsText");
            this.result = (blob2._buffer.buffer || blob2._buffer).slice();
          };
          FileReader2.prototype.abort = function() {
          };
          URL2.createObjectURL = function(blob2) {
            return blob2 instanceof Blob3 ? "data:" + blob2.type + ";base64," + array2base64(blob2._buffer) : createObjectURL.call(URL2, blob2);
          };
          URL2.revokeObjectURL = function(url) {
            revokeObjectURL && revokeObjectURL.call(URL2, url);
          };
          var _send = global2.XMLHttpRequest && global2.XMLHttpRequest.prototype.send;
          if (_send) {
            XMLHttpRequest.prototype.send = function(data) {
              if (data instanceof Blob3) {
                this.setRequestHeader("Content-Type", data.type);
                _send.call(this, textDecode(data._buffer));
              } else {
                _send.call(this, data);
              }
            };
          }
          exports2.Blob = Blob3;
          exports2.File = File2;
          exports2.FileReader = FileReader2;
          exports2.URL = URL2;
        }
        function fixFileAndXHR() {
          var isIE = !!global2.ActiveXObject || "-ms-scroll-limit" in document.documentElement.style && "-ms-ime-align" in document.documentElement.style;
          var _send = global2.XMLHttpRequest && global2.XMLHttpRequest.prototype.send;
          if (isIE && _send) {
            XMLHttpRequest.prototype.send = function(data) {
              if (data instanceof Blob) {
                this.setRequestHeader("Content-Type", data.type);
                _send.call(this, data);
              } else {
                _send.call(this, data);
              }
            };
          }
          try {
            new File([], "");
            exports2.File = global2.File;
            exports2.FileReader = global2.FileReader;
          } catch (e) {
            try {
              exports2.File = new Function(
                'class File extends Blob {constructor(chunks, name, opts) {opts = opts || {};super(chunks, opts || {});this.name = name.replace(/\\//g, ":");this.lastModifiedDate = opts.lastModified ? new Date(opts.lastModified) : new Date();this.lastModified = +this.lastModifiedDate;}};return new File([], ""), File'
              )();
            } catch (e2) {
              exports2.File = function(b, d, c) {
                var blob2 = new Blob(b, c);
                var t = c && void 0 !== c.lastModified ? new Date(c.lastModified) : new Date();
                blob2.name = d.replace(/\//g, ":");
                blob2.lastModifiedDate = t;
                blob2.lastModified = +t;
                blob2.toString = function() {
                  return "[object File]";
                };
                if (strTag) {
                  blob2[strTag] = "File";
                }
                return blob2;
              };
            }
          }
        }
        if (blobSupported) {
          fixFileAndXHR();
          exports2.Blob = blobSupportsArrayBufferView ? global2.Blob : BlobConstructor;
        } else if (blobBuilderSupported) {
          fixFileAndXHR();
          exports2.Blob = BlobBuilderConstructor;
        } else {
          FakeBlobBuilder();
        }
        if (strTag) {
          if (!exports2.File.prototype[strTag])
            exports2.File.prototype[strTag] = "File";
          if (!exports2.Blob.prototype[strTag])
            exports2.Blob.prototype[strTag] = "Blob";
          if (!exports2.FileReader.prototype[strTag])
            exports2.FileReader.prototype[strTag] = "FileReader";
        }
        var blob = exports2.Blob.prototype;
        var stream;
        try {
          new ReadableStream({ type: "bytes" });
          stream = function stream2() {
            var position = 0;
            var blob2 = this;
            return new ReadableStream({
              type: "bytes",
              autoAllocateChunkSize: 524288,
              pull: function(controller) {
                var v = controller.byobRequest.view;
                var chunk = blob2.slice(position, position + v.byteLength);
                return chunk.arrayBuffer().then(function(buffer) {
                  var uint8array = new Uint8Array(buffer);
                  var bytesRead = uint8array.byteLength;
                  position += bytesRead;
                  v.set(uint8array);
                  controller.byobRequest.respond(bytesRead);
                  if (position >= blob2.size)
                    controller.close();
                });
              }
            });
          };
        } catch (e) {
          try {
            new ReadableStream({});
            stream = function stream2(blob2) {
              var position = 0;
              return new ReadableStream({
                pull: function(controller) {
                  var chunk = blob2.slice(position, position + 524288);
                  return chunk.arrayBuffer().then(function(buffer) {
                    position += buffer.byteLength;
                    var uint8array = new Uint8Array(buffer);
                    controller.enqueue(uint8array);
                    if (position == blob2.size)
                      controller.close();
                  });
                }
              });
            };
          } catch (e2) {
            try {
              new Response("").body.getReader().read();
              stream = function stream2() {
                return new Response(this).body;
              };
            } catch (e3) {
              stream = function stream2() {
                throw new Error("Include https://github.com/MattiasBuelens/web-streams-polyfill");
              };
            }
          }
        }
        function promisify(obj) {
          return new Promise(function(resolve, reject) {
            obj.onload = obj.onerror = function(evt) {
              obj.onload = obj.onerror = null;
              evt.type === "load" ? resolve(obj.result || obj) : reject(new Error("Failed to read the blob/file"));
            };
          });
        }
        if (!blob.arrayBuffer) {
          blob.arrayBuffer = function arrayBuffer() {
            var fr = new FileReader();
            fr.readAsArrayBuffer(this);
            return promisify(fr);
          };
        }
        if (!blob.text) {
          blob.text = function text() {
            var fr = new FileReader();
            fr.readAsText(this);
            return promisify(fr);
          };
        }
        if (!blob.stream) {
          blob.stream = stream;
        }
      });
    })(
      typeof self !== "undefined" && self || typeof window !== "undefined" && window || typeof global !== "undefined" && global || exports
    );
  }
});

// node_modules/has-symbols/shams.js
var require_shams = __commonJS({
  "node_modules/has-symbols/shams.js"(exports, module) {
    "use strict";
    module.exports = function hasSymbols() {
      if (typeof Symbol !== "function" || typeof Object.getOwnPropertySymbols !== "function") {
        return false;
      }
      if (typeof Symbol.iterator === "symbol") {
        return true;
      }
      var obj = {};
      var sym = Symbol("test");
      var symObj = Object(sym);
      if (typeof sym === "string") {
        return false;
      }
      if (Object.prototype.toString.call(sym) !== "[object Symbol]") {
        return false;
      }
      if (Object.prototype.toString.call(symObj) !== "[object Symbol]") {
        return false;
      }
      var symVal = 42;
      obj[sym] = symVal;
      for (sym in obj) {
        return false;
      }
      if (typeof Object.keys === "function" && Object.keys(obj).length !== 0) {
        return false;
      }
      if (typeof Object.getOwnPropertyNames === "function" && Object.getOwnPropertyNames(obj).length !== 0) {
        return false;
      }
      var syms = Object.getOwnPropertySymbols(obj);
      if (syms.length !== 1 || syms[0] !== sym) {
        return false;
      }
      if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) {
        return false;
      }
      if (typeof Object.getOwnPropertyDescriptor === "function") {
        var descriptor = Object.getOwnPropertyDescriptor(obj, sym);
        if (descriptor.value !== symVal || descriptor.enumerable !== true) {
          return false;
        }
      }
      return true;
    };
  }
});

// node_modules/has-tostringtag/shams.js
var require_shams2 = __commonJS({
  "node_modules/has-tostringtag/shams.js"(exports, module) {
    "use strict";
    var hasSymbols = require_shams();
    module.exports = function hasToStringTagShams() {
      return hasSymbols() && !!Symbol.toStringTag;
    };
  }
});

// node_modules/has-symbols/index.js
var require_has_symbols = __commonJS({
  "node_modules/has-symbols/index.js"(exports, module) {
    "use strict";
    var origSymbol = typeof Symbol !== "undefined" && Symbol;
    var hasSymbolSham = require_shams();
    module.exports = function hasNativeSymbols() {
      if (typeof origSymbol !== "function") {
        return false;
      }
      if (typeof Symbol !== "function") {
        return false;
      }
      if (typeof origSymbol("foo") !== "symbol") {
        return false;
      }
      if (typeof Symbol("bar") !== "symbol") {
        return false;
      }
      return hasSymbolSham();
    };
  }
});

// node_modules/function-bind/implementation.js
var require_implementation = __commonJS({
  "node_modules/function-bind/implementation.js"(exports, module) {
    "use strict";
    var ERROR_MESSAGE = "Function.prototype.bind called on incompatible ";
    var slice = Array.prototype.slice;
    var toStr = Object.prototype.toString;
    var funcType = "[object Function]";
    module.exports = function bind(that) {
      var target = this;
      if (typeof target !== "function" || toStr.call(target) !== funcType) {
        throw new TypeError(ERROR_MESSAGE + target);
      }
      var args = slice.call(arguments, 1);
      var bound;
      var binder = function() {
        if (this instanceof bound) {
          var result = target.apply(
            this,
            args.concat(slice.call(arguments))
          );
          if (Object(result) === result) {
            return result;
          }
          return this;
        } else {
          return target.apply(
            that,
            args.concat(slice.call(arguments))
          );
        }
      };
      var boundLength = Math.max(0, target.length - args.length);
      var boundArgs = [];
      for (var i = 0; i < boundLength; i++) {
        boundArgs.push("$" + i);
      }
      bound = Function("binder", "return function (" + boundArgs.join(",") + "){ return binder.apply(this,arguments); }")(binder);
      if (target.prototype) {
        var Empty = function Empty2() {
        };
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
      }
      return bound;
    };
  }
});

// node_modules/function-bind/index.js
var require_function_bind = __commonJS({
  "node_modules/function-bind/index.js"(exports, module) {
    "use strict";
    var implementation = require_implementation();
    module.exports = Function.prototype.bind || implementation;
  }
});

// node_modules/has/src/index.js
var require_src = __commonJS({
  "node_modules/has/src/index.js"(exports, module) {
    "use strict";
    var bind = require_function_bind();
    module.exports = bind.call(Function.call, Object.prototype.hasOwnProperty);
  }
});

// node_modules/get-intrinsic/index.js
var require_get_intrinsic = __commonJS({
  "node_modules/get-intrinsic/index.js"(exports, module) {
    "use strict";
    var undefined2;
    var $SyntaxError = SyntaxError;
    var $Function = Function;
    var $TypeError = TypeError;
    var getEvalledConstructor = function(expressionSyntax) {
      try {
        return $Function('"use strict"; return (' + expressionSyntax + ").constructor;")();
      } catch (e) {
      }
    };
    var $gOPD = Object.getOwnPropertyDescriptor;
    if ($gOPD) {
      try {
        $gOPD({}, "");
      } catch (e) {
        $gOPD = null;
      }
    }
    var throwTypeError = function() {
      throw new $TypeError();
    };
    var ThrowTypeError = $gOPD ? function() {
      try {
        arguments.callee;
        return throwTypeError;
      } catch (calleeThrows) {
        try {
          return $gOPD(arguments, "callee").get;
        } catch (gOPDthrows) {
          return throwTypeError;
        }
      }
    }() : throwTypeError;
    var hasSymbols = require_has_symbols()();
    var getProto = Object.getPrototypeOf || function(x) {
      return x.__proto__;
    };
    var needsEval = {};
    var TypedArray = typeof Uint8Array === "undefined" ? undefined2 : getProto(Uint8Array);
    var INTRINSICS = {
      "%AggregateError%": typeof AggregateError === "undefined" ? undefined2 : AggregateError,
      "%Array%": Array,
      "%ArrayBuffer%": typeof ArrayBuffer === "undefined" ? undefined2 : ArrayBuffer,
      "%ArrayIteratorPrototype%": hasSymbols ? getProto([][Symbol.iterator]()) : undefined2,
      "%AsyncFromSyncIteratorPrototype%": undefined2,
      "%AsyncFunction%": needsEval,
      "%AsyncGenerator%": needsEval,
      "%AsyncGeneratorFunction%": needsEval,
      "%AsyncIteratorPrototype%": needsEval,
      "%Atomics%": typeof Atomics === "undefined" ? undefined2 : Atomics,
      "%BigInt%": typeof BigInt === "undefined" ? undefined2 : BigInt,
      "%Boolean%": Boolean,
      "%DataView%": typeof DataView === "undefined" ? undefined2 : DataView,
      "%Date%": Date,
      "%decodeURI%": decodeURI,
      "%decodeURIComponent%": decodeURIComponent,
      "%encodeURI%": encodeURI,
      "%encodeURIComponent%": encodeURIComponent,
      "%Error%": Error,
      "%eval%": eval,
      "%EvalError%": EvalError,
      "%Float32Array%": typeof Float32Array === "undefined" ? undefined2 : Float32Array,
      "%Float64Array%": typeof Float64Array === "undefined" ? undefined2 : Float64Array,
      "%FinalizationRegistry%": typeof FinalizationRegistry === "undefined" ? undefined2 : FinalizationRegistry,
      "%Function%": $Function,
      "%GeneratorFunction%": needsEval,
      "%Int8Array%": typeof Int8Array === "undefined" ? undefined2 : Int8Array,
      "%Int16Array%": typeof Int16Array === "undefined" ? undefined2 : Int16Array,
      "%Int32Array%": typeof Int32Array === "undefined" ? undefined2 : Int32Array,
      "%isFinite%": isFinite,
      "%isNaN%": isNaN,
      "%IteratorPrototype%": hasSymbols ? getProto(getProto([][Symbol.iterator]())) : undefined2,
      "%JSON%": typeof JSON === "object" ? JSON : undefined2,
      "%Map%": typeof Map === "undefined" ? undefined2 : Map,
      "%MapIteratorPrototype%": typeof Map === "undefined" || !hasSymbols ? undefined2 : getProto((/* @__PURE__ */ new Map())[Symbol.iterator]()),
      "%Math%": Math,
      "%Number%": Number,
      "%Object%": Object,
      "%parseFloat%": parseFloat,
      "%parseInt%": parseInt,
      "%Promise%": typeof Promise === "undefined" ? undefined2 : Promise,
      "%Proxy%": typeof Proxy === "undefined" ? undefined2 : Proxy,
      "%RangeError%": RangeError,
      "%ReferenceError%": ReferenceError,
      "%Reflect%": typeof Reflect === "undefined" ? undefined2 : Reflect,
      "%RegExp%": RegExp,
      "%Set%": typeof Set === "undefined" ? undefined2 : Set,
      "%SetIteratorPrototype%": typeof Set === "undefined" || !hasSymbols ? undefined2 : getProto((/* @__PURE__ */ new Set())[Symbol.iterator]()),
      "%SharedArrayBuffer%": typeof SharedArrayBuffer === "undefined" ? undefined2 : SharedArrayBuffer,
      "%String%": String,
      "%StringIteratorPrototype%": hasSymbols ? getProto(""[Symbol.iterator]()) : undefined2,
      "%Symbol%": hasSymbols ? Symbol : undefined2,
      "%SyntaxError%": $SyntaxError,
      "%ThrowTypeError%": ThrowTypeError,
      "%TypedArray%": TypedArray,
      "%TypeError%": $TypeError,
      "%Uint8Array%": typeof Uint8Array === "undefined" ? undefined2 : Uint8Array,
      "%Uint8ClampedArray%": typeof Uint8ClampedArray === "undefined" ? undefined2 : Uint8ClampedArray,
      "%Uint16Array%": typeof Uint16Array === "undefined" ? undefined2 : Uint16Array,
      "%Uint32Array%": typeof Uint32Array === "undefined" ? undefined2 : Uint32Array,
      "%URIError%": URIError,
      "%WeakMap%": typeof WeakMap === "undefined" ? undefined2 : WeakMap,
      "%WeakRef%": typeof WeakRef === "undefined" ? undefined2 : WeakRef,
      "%WeakSet%": typeof WeakSet === "undefined" ? undefined2 : WeakSet
    };
    var doEval = function doEval2(name) {
      var value;
      if (name === "%AsyncFunction%") {
        value = getEvalledConstructor("async function () {}");
      } else if (name === "%GeneratorFunction%") {
        value = getEvalledConstructor("function* () {}");
      } else if (name === "%AsyncGeneratorFunction%") {
        value = getEvalledConstructor("async function* () {}");
      } else if (name === "%AsyncGenerator%") {
        var fn = doEval2("%AsyncGeneratorFunction%");
        if (fn) {
          value = fn.prototype;
        }
      } else if (name === "%AsyncIteratorPrototype%") {
        var gen = doEval2("%AsyncGenerator%");
        if (gen) {
          value = getProto(gen.prototype);
        }
      }
      INTRINSICS[name] = value;
      return value;
    };
    var LEGACY_ALIASES = {
      "%ArrayBufferPrototype%": ["ArrayBuffer", "prototype"],
      "%ArrayPrototype%": ["Array", "prototype"],
      "%ArrayProto_entries%": ["Array", "prototype", "entries"],
      "%ArrayProto_forEach%": ["Array", "prototype", "forEach"],
      "%ArrayProto_keys%": ["Array", "prototype", "keys"],
      "%ArrayProto_values%": ["Array", "prototype", "values"],
      "%AsyncFunctionPrototype%": ["AsyncFunction", "prototype"],
      "%AsyncGenerator%": ["AsyncGeneratorFunction", "prototype"],
      "%AsyncGeneratorPrototype%": ["AsyncGeneratorFunction", "prototype", "prototype"],
      "%BooleanPrototype%": ["Boolean", "prototype"],
      "%DataViewPrototype%": ["DataView", "prototype"],
      "%DatePrototype%": ["Date", "prototype"],
      "%ErrorPrototype%": ["Error", "prototype"],
      "%EvalErrorPrototype%": ["EvalError", "prototype"],
      "%Float32ArrayPrototype%": ["Float32Array", "prototype"],
      "%Float64ArrayPrototype%": ["Float64Array", "prototype"],
      "%FunctionPrototype%": ["Function", "prototype"],
      "%Generator%": ["GeneratorFunction", "prototype"],
      "%GeneratorPrototype%": ["GeneratorFunction", "prototype", "prototype"],
      "%Int8ArrayPrototype%": ["Int8Array", "prototype"],
      "%Int16ArrayPrototype%": ["Int16Array", "prototype"],
      "%Int32ArrayPrototype%": ["Int32Array", "prototype"],
      "%JSONParse%": ["JSON", "parse"],
      "%JSONStringify%": ["JSON", "stringify"],
      "%MapPrototype%": ["Map", "prototype"],
      "%NumberPrototype%": ["Number", "prototype"],
      "%ObjectPrototype%": ["Object", "prototype"],
      "%ObjProto_toString%": ["Object", "prototype", "toString"],
      "%ObjProto_valueOf%": ["Object", "prototype", "valueOf"],
      "%PromisePrototype%": ["Promise", "prototype"],
      "%PromiseProto_then%": ["Promise", "prototype", "then"],
      "%Promise_all%": ["Promise", "all"],
      "%Promise_reject%": ["Promise", "reject"],
      "%Promise_resolve%": ["Promise", "resolve"],
      "%RangeErrorPrototype%": ["RangeError", "prototype"],
      "%ReferenceErrorPrototype%": ["ReferenceError", "prototype"],
      "%RegExpPrototype%": ["RegExp", "prototype"],
      "%SetPrototype%": ["Set", "prototype"],
      "%SharedArrayBufferPrototype%": ["SharedArrayBuffer", "prototype"],
      "%StringPrototype%": ["String", "prototype"],
      "%SymbolPrototype%": ["Symbol", "prototype"],
      "%SyntaxErrorPrototype%": ["SyntaxError", "prototype"],
      "%TypedArrayPrototype%": ["TypedArray", "prototype"],
      "%TypeErrorPrototype%": ["TypeError", "prototype"],
      "%Uint8ArrayPrototype%": ["Uint8Array", "prototype"],
      "%Uint8ClampedArrayPrototype%": ["Uint8ClampedArray", "prototype"],
      "%Uint16ArrayPrototype%": ["Uint16Array", "prototype"],
      "%Uint32ArrayPrototype%": ["Uint32Array", "prototype"],
      "%URIErrorPrototype%": ["URIError", "prototype"],
      "%WeakMapPrototype%": ["WeakMap", "prototype"],
      "%WeakSetPrototype%": ["WeakSet", "prototype"]
    };
    var bind = require_function_bind();
    var hasOwn = require_src();
    var $concat = bind.call(Function.call, Array.prototype.concat);
    var $spliceApply = bind.call(Function.apply, Array.prototype.splice);
    var $replace = bind.call(Function.call, String.prototype.replace);
    var $strSlice = bind.call(Function.call, String.prototype.slice);
    var $exec = bind.call(Function.call, RegExp.prototype.exec);
    var rePropName = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
    var reEscapeChar = /\\(\\)?/g;
    var stringToPath = function stringToPath2(string) {
      var first = $strSlice(string, 0, 1);
      var last = $strSlice(string, -1);
      if (first === "%" && last !== "%") {
        throw new $SyntaxError("invalid intrinsic syntax, expected closing `%`");
      } else if (last === "%" && first !== "%") {
        throw new $SyntaxError("invalid intrinsic syntax, expected opening `%`");
      }
      var result = [];
      $replace(string, rePropName, function(match, number, quote, subString) {
        result[result.length] = quote ? $replace(subString, reEscapeChar, "$1") : number || match;
      });
      return result;
    };
    var getBaseIntrinsic = function getBaseIntrinsic2(name, allowMissing) {
      var intrinsicName = name;
      var alias;
      if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
        alias = LEGACY_ALIASES[intrinsicName];
        intrinsicName = "%" + alias[0] + "%";
      }
      if (hasOwn(INTRINSICS, intrinsicName)) {
        var value = INTRINSICS[intrinsicName];
        if (value === needsEval) {
          value = doEval(intrinsicName);
        }
        if (typeof value === "undefined" && !allowMissing) {
          throw new $TypeError("intrinsic " + name + " exists, but is not available. Please file an issue!");
        }
        return {
          alias,
          name: intrinsicName,
          value
        };
      }
      throw new $SyntaxError("intrinsic " + name + " does not exist!");
    };
    module.exports = function GetIntrinsic(name, allowMissing) {
      if (typeof name !== "string" || name.length === 0) {
        throw new $TypeError("intrinsic name must be a non-empty string");
      }
      if (arguments.length > 1 && typeof allowMissing !== "boolean") {
        throw new $TypeError('"allowMissing" argument must be a boolean');
      }
      if ($exec(/^%?[^%]*%?$/, name) === null) {
        throw new $SyntaxError("`%` may not be present anywhere but at the beginning and end of the intrinsic name");
      }
      var parts = stringToPath(name);
      var intrinsicBaseName = parts.length > 0 ? parts[0] : "";
      var intrinsic = getBaseIntrinsic("%" + intrinsicBaseName + "%", allowMissing);
      var intrinsicRealName = intrinsic.name;
      var value = intrinsic.value;
      var skipFurtherCaching = false;
      var alias = intrinsic.alias;
      if (alias) {
        intrinsicBaseName = alias[0];
        $spliceApply(parts, $concat([0, 1], alias));
      }
      for (var i = 1, isOwn = true; i < parts.length; i += 1) {
        var part = parts[i];
        var first = $strSlice(part, 0, 1);
        var last = $strSlice(part, -1);
        if ((first === '"' || first === "'" || first === "`" || (last === '"' || last === "'" || last === "`")) && first !== last) {
          throw new $SyntaxError("property names with quotes must have matching quotes");
        }
        if (part === "constructor" || !isOwn) {
          skipFurtherCaching = true;
        }
        intrinsicBaseName += "." + part;
        intrinsicRealName = "%" + intrinsicBaseName + "%";
        if (hasOwn(INTRINSICS, intrinsicRealName)) {
          value = INTRINSICS[intrinsicRealName];
        } else if (value != null) {
          if (!(part in value)) {
            if (!allowMissing) {
              throw new $TypeError("base intrinsic for " + name + " exists, but the property is not available.");
            }
            return void 0;
          }
          if ($gOPD && i + 1 >= parts.length) {
            var desc = $gOPD(value, part);
            isOwn = !!desc;
            if (isOwn && "get" in desc && !("originalValue" in desc.get)) {
              value = desc.get;
            } else {
              value = value[part];
            }
          } else {
            isOwn = hasOwn(value, part);
            value = value[part];
          }
          if (isOwn && !skipFurtherCaching) {
            INTRINSICS[intrinsicRealName] = value;
          }
        }
      }
      return value;
    };
  }
});

// node_modules/call-bind/index.js
var require_call_bind = __commonJS({
  "node_modules/call-bind/index.js"(exports, module) {
    "use strict";
    var bind = require_function_bind();
    var GetIntrinsic = require_get_intrinsic();
    var $apply = GetIntrinsic("%Function.prototype.apply%");
    var $call = GetIntrinsic("%Function.prototype.call%");
    var $reflectApply = GetIntrinsic("%Reflect.apply%", true) || bind.call($call, $apply);
    var $gOPD = GetIntrinsic("%Object.getOwnPropertyDescriptor%", true);
    var $defineProperty = GetIntrinsic("%Object.defineProperty%", true);
    var $max = GetIntrinsic("%Math.max%");
    if ($defineProperty) {
      try {
        $defineProperty({}, "a", { value: 1 });
      } catch (e) {
        $defineProperty = null;
      }
    }
    module.exports = function callBind(originalFunction) {
      var func = $reflectApply(bind, $call, arguments);
      if ($gOPD && $defineProperty) {
        var desc = $gOPD(func, "length");
        if (desc.configurable) {
          $defineProperty(
            func,
            "length",
            { value: 1 + $max(0, originalFunction.length - (arguments.length - 1)) }
          );
        }
      }
      return func;
    };
    var applyBind = function applyBind2() {
      return $reflectApply(bind, $apply, arguments);
    };
    if ($defineProperty) {
      $defineProperty(module.exports, "apply", { value: applyBind });
    } else {
      module.exports.apply = applyBind;
    }
  }
});

// node_modules/call-bind/callBound.js
var require_callBound = __commonJS({
  "node_modules/call-bind/callBound.js"(exports, module) {
    "use strict";
    var GetIntrinsic = require_get_intrinsic();
    var callBind = require_call_bind();
    var $indexOf = callBind(GetIntrinsic("String.prototype.indexOf"));
    module.exports = function callBoundIntrinsic(name, allowMissing) {
      var intrinsic = GetIntrinsic(name, !!allowMissing);
      if (typeof intrinsic === "function" && $indexOf(name, ".prototype.") > -1) {
        return callBind(intrinsic);
      }
      return intrinsic;
    };
  }
});

// node_modules/is-arguments/index.js
var require_is_arguments = __commonJS({
  "node_modules/is-arguments/index.js"(exports, module) {
    "use strict";
    var hasToStringTag = require_shams2()();
    var callBound = require_callBound();
    var $toString = callBound("Object.prototype.toString");
    var isStandardArguments = function isArguments(value) {
      if (hasToStringTag && value && typeof value === "object" && Symbol.toStringTag in value) {
        return false;
      }
      return $toString(value) === "[object Arguments]";
    };
    var isLegacyArguments = function isArguments(value) {
      if (isStandardArguments(value)) {
        return true;
      }
      return value !== null && typeof value === "object" && typeof value.length === "number" && value.length >= 0 && $toString(value) !== "[object Array]" && $toString(value.callee) === "[object Function]";
    };
    var supportsStandardArguments = function() {
      return isStandardArguments(arguments);
    }();
    isStandardArguments.isLegacyArguments = isLegacyArguments;
    module.exports = supportsStandardArguments ? isStandardArguments : isLegacyArguments;
  }
});

// node_modules/is-generator-function/index.js
var require_is_generator_function = __commonJS({
  "node_modules/is-generator-function/index.js"(exports, module) {
    "use strict";
    var toStr = Object.prototype.toString;
    var fnToStr = Function.prototype.toString;
    var isFnRegex = /^\s*(?:function)?\*/;
    var hasToStringTag = require_shams2()();
    var getProto = Object.getPrototypeOf;
    var getGeneratorFunc = function() {
      if (!hasToStringTag) {
        return false;
      }
      try {
        return Function("return function*() {}")();
      } catch (e) {
      }
    };
    var GeneratorFunction;
    module.exports = function isGeneratorFunction(fn) {
      if (typeof fn !== "function") {
        return false;
      }
      if (isFnRegex.test(fnToStr.call(fn))) {
        return true;
      }
      if (!hasToStringTag) {
        var str = toStr.call(fn);
        return str === "[object GeneratorFunction]";
      }
      if (!getProto) {
        return false;
      }
      if (typeof GeneratorFunction === "undefined") {
        var generatorFunc = getGeneratorFunc();
        GeneratorFunction = generatorFunc ? getProto(generatorFunc) : false;
      }
      return getProto(fn) === GeneratorFunction;
    };
  }
});

// node_modules/foreach/index.js
var require_foreach = __commonJS({
  "node_modules/foreach/index.js"(exports, module) {
    var hasOwn = Object.prototype.hasOwnProperty;
    var toString = Object.prototype.toString;
    module.exports = function forEach(obj, fn, ctx) {
      if (toString.call(fn) !== "[object Function]") {
        throw new TypeError("iterator must be a function");
      }
      var l = obj.length;
      if (l === +l) {
        for (var i = 0; i < l; i++) {
          fn.call(ctx, obj[i], i, obj);
        }
      } else {
        for (var k in obj) {
          if (hasOwn.call(obj, k)) {
            fn.call(ctx, obj[k], k, obj);
          }
        }
      }
    };
  }
});

// node_modules/available-typed-arrays/index.js
var require_available_typed_arrays = __commonJS({
  "node_modules/available-typed-arrays/index.js"(exports, module) {
    "use strict";
    var possibleNames = [
      "BigInt64Array",
      "BigUint64Array",
      "Float32Array",
      "Float64Array",
      "Int16Array",
      "Int32Array",
      "Int8Array",
      "Uint16Array",
      "Uint32Array",
      "Uint8Array",
      "Uint8ClampedArray"
    ];
    var g = typeof globalThis === "undefined" ? global : globalThis;
    module.exports = function availableTypedArrays() {
      var out = [];
      for (var i = 0; i < possibleNames.length; i++) {
        if (typeof g[possibleNames[i]] === "function") {
          out[out.length] = possibleNames[i];
        }
      }
      return out;
    };
  }
});

// node_modules/es-abstract/helpers/getOwnPropertyDescriptor.js
var require_getOwnPropertyDescriptor = __commonJS({
  "node_modules/es-abstract/helpers/getOwnPropertyDescriptor.js"(exports, module) {
    "use strict";
    var GetIntrinsic = require_get_intrinsic();
    var $gOPD = GetIntrinsic("%Object.getOwnPropertyDescriptor%", true);
    if ($gOPD) {
      try {
        $gOPD([], "length");
      } catch (e) {
        $gOPD = null;
      }
    }
    module.exports = $gOPD;
  }
});

// node_modules/is-typed-array/index.js
var require_is_typed_array = __commonJS({
  "node_modules/is-typed-array/index.js"(exports, module) {
    "use strict";
    var forEach = require_foreach();
    var availableTypedArrays = require_available_typed_arrays();
    var callBound = require_callBound();
    var $toString = callBound("Object.prototype.toString");
    var hasToStringTag = require_shams2()();
    var g = typeof globalThis === "undefined" ? global : globalThis;
    var typedArrays = availableTypedArrays();
    var $indexOf = callBound("Array.prototype.indexOf", true) || function indexOf(array, value) {
      for (var i = 0; i < array.length; i += 1) {
        if (array[i] === value) {
          return i;
        }
      }
      return -1;
    };
    var $slice = callBound("String.prototype.slice");
    var toStrTags = {};
    var gOPD = require_getOwnPropertyDescriptor();
    var getPrototypeOf = Object.getPrototypeOf;
    if (hasToStringTag && gOPD && getPrototypeOf) {
      forEach(typedArrays, function(typedArray) {
        var arr = new g[typedArray]();
        if (Symbol.toStringTag in arr) {
          var proto = getPrototypeOf(arr);
          var descriptor = gOPD(proto, Symbol.toStringTag);
          if (!descriptor) {
            var superProto = getPrototypeOf(proto);
            descriptor = gOPD(superProto, Symbol.toStringTag);
          }
          toStrTags[typedArray] = descriptor.get;
        }
      });
    }
    var tryTypedArrays = function tryAllTypedArrays(value) {
      var anyTrue = false;
      forEach(toStrTags, function(getter, typedArray) {
        if (!anyTrue) {
          try {
            anyTrue = getter.call(value) === typedArray;
          } catch (e) {
          }
        }
      });
      return anyTrue;
    };
    module.exports = function isTypedArray(value) {
      if (!value || typeof value !== "object") {
        return false;
      }
      if (!hasToStringTag || !(Symbol.toStringTag in value)) {
        var tag = $slice($toString(value), 8, -1);
        return $indexOf(typedArrays, tag) > -1;
      }
      if (!gOPD) {
        return false;
      }
      return tryTypedArrays(value);
    };
  }
});

// node_modules/which-typed-array/index.js
var require_which_typed_array = __commonJS({
  "node_modules/which-typed-array/index.js"(exports, module) {
    "use strict";
    var forEach = require_foreach();
    var availableTypedArrays = require_available_typed_arrays();
    var callBound = require_callBound();
    var $toString = callBound("Object.prototype.toString");
    var hasToStringTag = require_shams2()();
    var g = typeof globalThis === "undefined" ? global : globalThis;
    var typedArrays = availableTypedArrays();
    var $slice = callBound("String.prototype.slice");
    var toStrTags = {};
    var gOPD = require_getOwnPropertyDescriptor();
    var getPrototypeOf = Object.getPrototypeOf;
    if (hasToStringTag && gOPD && getPrototypeOf) {
      forEach(typedArrays, function(typedArray) {
        if (typeof g[typedArray] === "function") {
          var arr = new g[typedArray]();
          if (Symbol.toStringTag in arr) {
            var proto = getPrototypeOf(arr);
            var descriptor = gOPD(proto, Symbol.toStringTag);
            if (!descriptor) {
              var superProto = getPrototypeOf(proto);
              descriptor = gOPD(superProto, Symbol.toStringTag);
            }
            toStrTags[typedArray] = descriptor.get;
          }
        }
      });
    }
    var tryTypedArrays = function tryAllTypedArrays(value) {
      var foundName = false;
      forEach(toStrTags, function(getter, typedArray) {
        if (!foundName) {
          try {
            var name = getter.call(value);
            if (name === typedArray) {
              foundName = name;
            }
          } catch (e) {
          }
        }
      });
      return foundName;
    };
    var isTypedArray = require_is_typed_array();
    module.exports = function whichTypedArray(value) {
      if (!isTypedArray(value)) {
        return false;
      }
      if (!hasToStringTag || !(Symbol.toStringTag in value)) {
        return $slice($toString(value), 8, -1);
      }
      return tryTypedArrays(value);
    };
  }
});

// node_modules/util/support/types.js
var require_types = __commonJS({
  "node_modules/util/support/types.js"(exports) {
    "use strict";
    var isArgumentsObject = require_is_arguments();
    var isGeneratorFunction = require_is_generator_function();
    var whichTypedArray = require_which_typed_array();
    var isTypedArray = require_is_typed_array();
    function uncurryThis(f) {
      return f.call.bind(f);
    }
    var BigIntSupported = typeof BigInt !== "undefined";
    var SymbolSupported = typeof Symbol !== "undefined";
    var ObjectToString = uncurryThis(Object.prototype.toString);
    var numberValue = uncurryThis(Number.prototype.valueOf);
    var stringValue = uncurryThis(String.prototype.valueOf);
    var booleanValue = uncurryThis(Boolean.prototype.valueOf);
    if (BigIntSupported) {
      bigIntValue = uncurryThis(BigInt.prototype.valueOf);
    }
    var bigIntValue;
    if (SymbolSupported) {
      symbolValue = uncurryThis(Symbol.prototype.valueOf);
    }
    var symbolValue;
    function checkBoxedPrimitive(value, prototypeValueOf) {
      if (typeof value !== "object") {
        return false;
      }
      try {
        prototypeValueOf(value);
        return true;
      } catch (e) {
        return false;
      }
    }
    exports.isArgumentsObject = isArgumentsObject;
    exports.isGeneratorFunction = isGeneratorFunction;
    exports.isTypedArray = isTypedArray;
    function isPromise(input) {
      return typeof Promise !== "undefined" && input instanceof Promise || input !== null && typeof input === "object" && typeof input.then === "function" && typeof input.catch === "function";
    }
    exports.isPromise = isPromise;
    function isArrayBufferView(value) {
      if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView) {
        return ArrayBuffer.isView(value);
      }
      return isTypedArray(value) || isDataView(value);
    }
    exports.isArrayBufferView = isArrayBufferView;
    function isUint8Array(value) {
      return whichTypedArray(value) === "Uint8Array";
    }
    exports.isUint8Array = isUint8Array;
    function isUint8ClampedArray(value) {
      return whichTypedArray(value) === "Uint8ClampedArray";
    }
    exports.isUint8ClampedArray = isUint8ClampedArray;
    function isUint16Array(value) {
      return whichTypedArray(value) === "Uint16Array";
    }
    exports.isUint16Array = isUint16Array;
    function isUint32Array(value) {
      return whichTypedArray(value) === "Uint32Array";
    }
    exports.isUint32Array = isUint32Array;
    function isInt8Array(value) {
      return whichTypedArray(value) === "Int8Array";
    }
    exports.isInt8Array = isInt8Array;
    function isInt16Array(value) {
      return whichTypedArray(value) === "Int16Array";
    }
    exports.isInt16Array = isInt16Array;
    function isInt32Array(value) {
      return whichTypedArray(value) === "Int32Array";
    }
    exports.isInt32Array = isInt32Array;
    function isFloat32Array(value) {
      return whichTypedArray(value) === "Float32Array";
    }
    exports.isFloat32Array = isFloat32Array;
    function isFloat64Array(value) {
      return whichTypedArray(value) === "Float64Array";
    }
    exports.isFloat64Array = isFloat64Array;
    function isBigInt64Array(value) {
      return whichTypedArray(value) === "BigInt64Array";
    }
    exports.isBigInt64Array = isBigInt64Array;
    function isBigUint64Array(value) {
      return whichTypedArray(value) === "BigUint64Array";
    }
    exports.isBigUint64Array = isBigUint64Array;
    function isMapToString(value) {
      return ObjectToString(value) === "[object Map]";
    }
    isMapToString.working = typeof Map !== "undefined" && isMapToString(/* @__PURE__ */ new Map());
    function isMap(value) {
      if (typeof Map === "undefined") {
        return false;
      }
      return isMapToString.working ? isMapToString(value) : value instanceof Map;
    }
    exports.isMap = isMap;
    function isSetToString(value) {
      return ObjectToString(value) === "[object Set]";
    }
    isSetToString.working = typeof Set !== "undefined" && isSetToString(/* @__PURE__ */ new Set());
    function isSet(value) {
      if (typeof Set === "undefined") {
        return false;
      }
      return isSetToString.working ? isSetToString(value) : value instanceof Set;
    }
    exports.isSet = isSet;
    function isWeakMapToString(value) {
      return ObjectToString(value) === "[object WeakMap]";
    }
    isWeakMapToString.working = typeof WeakMap !== "undefined" && isWeakMapToString(/* @__PURE__ */ new WeakMap());
    function isWeakMap(value) {
      if (typeof WeakMap === "undefined") {
        return false;
      }
      return isWeakMapToString.working ? isWeakMapToString(value) : value instanceof WeakMap;
    }
    exports.isWeakMap = isWeakMap;
    function isWeakSetToString(value) {
      return ObjectToString(value) === "[object WeakSet]";
    }
    isWeakSetToString.working = typeof WeakSet !== "undefined" && isWeakSetToString(/* @__PURE__ */ new WeakSet());
    function isWeakSet(value) {
      return isWeakSetToString(value);
    }
    exports.isWeakSet = isWeakSet;
    function isArrayBufferToString(value) {
      return ObjectToString(value) === "[object ArrayBuffer]";
    }
    isArrayBufferToString.working = typeof ArrayBuffer !== "undefined" && isArrayBufferToString(new ArrayBuffer());
    function isArrayBuffer(value) {
      if (typeof ArrayBuffer === "undefined") {
        return false;
      }
      return isArrayBufferToString.working ? isArrayBufferToString(value) : value instanceof ArrayBuffer;
    }
    exports.isArrayBuffer = isArrayBuffer;
    function isDataViewToString(value) {
      return ObjectToString(value) === "[object DataView]";
    }
    isDataViewToString.working = typeof ArrayBuffer !== "undefined" && typeof DataView !== "undefined" && isDataViewToString(new DataView(new ArrayBuffer(1), 0, 1));
    function isDataView(value) {
      if (typeof DataView === "undefined") {
        return false;
      }
      return isDataViewToString.working ? isDataViewToString(value) : value instanceof DataView;
    }
    exports.isDataView = isDataView;
    var SharedArrayBufferCopy = typeof SharedArrayBuffer !== "undefined" ? SharedArrayBuffer : void 0;
    function isSharedArrayBufferToString(value) {
      return ObjectToString(value) === "[object SharedArrayBuffer]";
    }
    function isSharedArrayBuffer(value) {
      if (typeof SharedArrayBufferCopy === "undefined") {
        return false;
      }
      if (typeof isSharedArrayBufferToString.working === "undefined") {
        isSharedArrayBufferToString.working = isSharedArrayBufferToString(new SharedArrayBufferCopy());
      }
      return isSharedArrayBufferToString.working ? isSharedArrayBufferToString(value) : value instanceof SharedArrayBufferCopy;
    }
    exports.isSharedArrayBuffer = isSharedArrayBuffer;
    function isAsyncFunction(value) {
      return ObjectToString(value) === "[object AsyncFunction]";
    }
    exports.isAsyncFunction = isAsyncFunction;
    function isMapIterator(value) {
      return ObjectToString(value) === "[object Map Iterator]";
    }
    exports.isMapIterator = isMapIterator;
    function isSetIterator(value) {
      return ObjectToString(value) === "[object Set Iterator]";
    }
    exports.isSetIterator = isSetIterator;
    function isGeneratorObject(value) {
      return ObjectToString(value) === "[object Generator]";
    }
    exports.isGeneratorObject = isGeneratorObject;
    function isWebAssemblyCompiledModule(value) {
      return ObjectToString(value) === "[object WebAssembly.Module]";
    }
    exports.isWebAssemblyCompiledModule = isWebAssemblyCompiledModule;
    function isNumberObject(value) {
      return checkBoxedPrimitive(value, numberValue);
    }
    exports.isNumberObject = isNumberObject;
    function isStringObject(value) {
      return checkBoxedPrimitive(value, stringValue);
    }
    exports.isStringObject = isStringObject;
    function isBooleanObject(value) {
      return checkBoxedPrimitive(value, booleanValue);
    }
    exports.isBooleanObject = isBooleanObject;
    function isBigIntObject(value) {
      return BigIntSupported && checkBoxedPrimitive(value, bigIntValue);
    }
    exports.isBigIntObject = isBigIntObject;
    function isSymbolObject(value) {
      return SymbolSupported && checkBoxedPrimitive(value, symbolValue);
    }
    exports.isSymbolObject = isSymbolObject;
    function isBoxedPrimitive(value) {
      return isNumberObject(value) || isStringObject(value) || isBooleanObject(value) || isBigIntObject(value) || isSymbolObject(value);
    }
    exports.isBoxedPrimitive = isBoxedPrimitive;
    function isAnyArrayBuffer(value) {
      return typeof Uint8Array !== "undefined" && (isArrayBuffer(value) || isSharedArrayBuffer(value));
    }
    exports.isAnyArrayBuffer = isAnyArrayBuffer;
    ["isProxy", "isExternal", "isModuleNamespaceObject"].forEach(function(method) {
      Object.defineProperty(exports, method, {
        enumerable: false,
        value: function() {
          throw new Error(method + " is not supported in userland");
        }
      });
    });
  }
});

// node_modules/util/support/isBuffer.js
var require_isBuffer = __commonJS({
  "node_modules/util/support/isBuffer.js"(exports, module) {
    module.exports = function isBuffer(arg) {
      return arg instanceof Buffer;
    };
  }
});

// node_modules/inherits/inherits_browser.js
var require_inherits_browser = __commonJS({
  "node_modules/inherits/inherits_browser.js"(exports, module) {
    if (typeof Object.create === "function") {
      module.exports = function inherits(ctor, superCtor) {
        if (superCtor) {
          ctor.super_ = superCtor;
          ctor.prototype = Object.create(superCtor.prototype, {
            constructor: {
              value: ctor,
              enumerable: false,
              writable: true,
              configurable: true
            }
          });
        }
      };
    } else {
      module.exports = function inherits(ctor, superCtor) {
        if (superCtor) {
          ctor.super_ = superCtor;
          var TempCtor = function() {
          };
          TempCtor.prototype = superCtor.prototype;
          ctor.prototype = new TempCtor();
          ctor.prototype.constructor = ctor;
        }
      };
    }
  }
});

// node_modules/inherits/inherits.js
var require_inherits = __commonJS({
  "node_modules/inherits/inherits.js"(exports, module) {
    try {
      util2 = require_util();
      if (typeof util2.inherits !== "function")
        throw "";
      module.exports = util2.inherits;
    } catch (e) {
      module.exports = require_inherits_browser();
    }
    var util2;
  }
});

// node_modules/util/util.js
var require_util = __commonJS({
  "node_modules/util/util.js"(exports) {
    var getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors || function getOwnPropertyDescriptors2(obj) {
      var keys = Object.keys(obj);
      var descriptors = {};
      for (var i = 0; i < keys.length; i++) {
        descriptors[keys[i]] = Object.getOwnPropertyDescriptor(obj, keys[i]);
      }
      return descriptors;
    };
    var formatRegExp = /%[sdj%]/g;
    exports.format = function(f) {
      if (!isString(f)) {
        var objects = [];
        for (var i = 0; i < arguments.length; i++) {
          objects.push(inspect(arguments[i]));
        }
        return objects.join(" ");
      }
      var i = 1;
      var args = arguments;
      var len = args.length;
      var str = String(f).replace(formatRegExp, function(x2) {
        if (x2 === "%%")
          return "%";
        if (i >= len)
          return x2;
        switch (x2) {
          case "%s":
            return String(args[i++]);
          case "%d":
            return Number(args[i++]);
          case "%j":
            try {
              return JSON.stringify(args[i++]);
            } catch (_) {
              return "[Circular]";
            }
          default:
            return x2;
        }
      });
      for (var x = args[i]; i < len; x = args[++i]) {
        if (isNull(x) || !isObject2(x)) {
          str += " " + x;
        } else {
          str += " " + inspect(x);
        }
      }
      return str;
    };
    exports.deprecate = function(fn, msg) {
      if (typeof process !== "undefined" && process.noDeprecation === true) {
        return fn;
      }
      if (typeof process === "undefined") {
        return function() {
          return exports.deprecate(fn, msg).apply(this, arguments);
        };
      }
      var warned = false;
      function deprecated() {
        if (!warned) {
          if (process.throwDeprecation) {
            throw new Error(msg);
          } else if (process.traceDeprecation) {
            console.trace(msg);
          } else {
            console.error(msg);
          }
          warned = true;
        }
        return fn.apply(this, arguments);
      }
      return deprecated;
    };
    var debugs = {};
    var debugEnvRegex = /^$/;
    if (typeof process !== "undefined" && process.env.NODE_DEBUG) {
      debugEnv = process.env.NODE_DEBUG;
      debugEnv = debugEnv.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replace(/\*/g, ".*").replace(/,/g, "$|^").toUpperCase();
      debugEnvRegex = new RegExp("^" + debugEnv + "$", "i");
    }
    var debugEnv;
    exports.debuglog = function(set) {
      set = set.toUpperCase();
      if (!debugs[set]) {
        if (debugEnvRegex.test(set)) {
          var pid = process.pid;
          debugs[set] = function() {
            var msg = exports.format.apply(exports, arguments);
            console.error("%s %d: %s", set, pid, msg);
          };
        } else {
          debugs[set] = function() {
          };
        }
      }
      return debugs[set];
    };
    function inspect(obj, opts) {
      var ctx = {
        seen: [],
        stylize: stylizeNoColor
      };
      if (arguments.length >= 3)
        ctx.depth = arguments[2];
      if (arguments.length >= 4)
        ctx.colors = arguments[3];
      if (isBoolean(opts)) {
        ctx.showHidden = opts;
      } else if (opts) {
        exports._extend(ctx, opts);
      }
      if (isUndefined(ctx.showHidden))
        ctx.showHidden = false;
      if (isUndefined(ctx.depth))
        ctx.depth = 2;
      if (isUndefined(ctx.colors))
        ctx.colors = false;
      if (isUndefined(ctx.customInspect))
        ctx.customInspect = true;
      if (ctx.colors)
        ctx.stylize = stylizeWithColor;
      return formatValue(ctx, obj, ctx.depth);
    }
    exports.inspect = inspect;
    inspect.colors = {
      "bold": [1, 22],
      "italic": [3, 23],
      "underline": [4, 24],
      "inverse": [7, 27],
      "white": [37, 39],
      "grey": [90, 39],
      "black": [30, 39],
      "blue": [34, 39],
      "cyan": [36, 39],
      "green": [32, 39],
      "magenta": [35, 39],
      "red": [31, 39],
      "yellow": [33, 39]
    };
    inspect.styles = {
      "special": "cyan",
      "number": "yellow",
      "boolean": "yellow",
      "undefined": "grey",
      "null": "bold",
      "string": "green",
      "date": "magenta",
      "regexp": "red"
    };
    function stylizeWithColor(str, styleType) {
      var style = inspect.styles[styleType];
      if (style) {
        return "\x1B[" + inspect.colors[style][0] + "m" + str + "\x1B[" + inspect.colors[style][1] + "m";
      } else {
        return str;
      }
    }
    function stylizeNoColor(str, styleType) {
      return str;
    }
    function arrayToHash(array) {
      var hash = {};
      array.forEach(function(val, idx) {
        hash[val] = true;
      });
      return hash;
    }
    function formatValue(ctx, value, recurseTimes) {
      if (ctx.customInspect && value && isFunction(value.inspect) && value.inspect !== exports.inspect && !(value.constructor && value.constructor.prototype === value)) {
        var ret = value.inspect(recurseTimes, ctx);
        if (!isString(ret)) {
          ret = formatValue(ctx, ret, recurseTimes);
        }
        return ret;
      }
      var primitive = formatPrimitive(ctx, value);
      if (primitive) {
        return primitive;
      }
      var keys = Object.keys(value);
      var visibleKeys = arrayToHash(keys);
      if (ctx.showHidden) {
        keys = Object.getOwnPropertyNames(value);
      }
      if (isError(value) && (keys.indexOf("message") >= 0 || keys.indexOf("description") >= 0)) {
        return formatError(value);
      }
      if (keys.length === 0) {
        if (isFunction(value)) {
          var name = value.name ? ": " + value.name : "";
          return ctx.stylize("[Function" + name + "]", "special");
        }
        if (isRegExp(value)) {
          return ctx.stylize(RegExp.prototype.toString.call(value), "regexp");
        }
        if (isDate(value)) {
          return ctx.stylize(Date.prototype.toString.call(value), "date");
        }
        if (isError(value)) {
          return formatError(value);
        }
      }
      var base = "", array = false, braces = ["{", "}"];
      if (isArray(value)) {
        array = true;
        braces = ["[", "]"];
      }
      if (isFunction(value)) {
        var n = value.name ? ": " + value.name : "";
        base = " [Function" + n + "]";
      }
      if (isRegExp(value)) {
        base = " " + RegExp.prototype.toString.call(value);
      }
      if (isDate(value)) {
        base = " " + Date.prototype.toUTCString.call(value);
      }
      if (isError(value)) {
        base = " " + formatError(value);
      }
      if (keys.length === 0 && (!array || value.length == 0)) {
        return braces[0] + base + braces[1];
      }
      if (recurseTimes < 0) {
        if (isRegExp(value)) {
          return ctx.stylize(RegExp.prototype.toString.call(value), "regexp");
        } else {
          return ctx.stylize("[Object]", "special");
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
      if (isUndefined(value))
        return ctx.stylize("undefined", "undefined");
      if (isString(value)) {
        var simple = "'" + JSON.stringify(value).replace(/^"|"$/g, "").replace(/'/g, "\\'").replace(/\\"/g, '"') + "'";
        return ctx.stylize(simple, "string");
      }
      if (isNumber(value))
        return ctx.stylize("" + value, "number");
      if (isBoolean(value))
        return ctx.stylize("" + value, "boolean");
      if (isNull(value))
        return ctx.stylize("null", "null");
    }
    function formatError(value) {
      return "[" + Error.prototype.toString.call(value) + "]";
    }
    function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
      var output = [];
      for (var i = 0, l = value.length; i < l; ++i) {
        if (hasOwnProperty2(value, String(i))) {
          output.push(formatProperty(
            ctx,
            value,
            recurseTimes,
            visibleKeys,
            String(i),
            true
          ));
        } else {
          output.push("");
        }
      }
      keys.forEach(function(key) {
        if (!key.match(/^\d+$/)) {
          output.push(formatProperty(
            ctx,
            value,
            recurseTimes,
            visibleKeys,
            key,
            true
          ));
        }
      });
      return output;
    }
    function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
      var name, str, desc;
      desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
      if (desc.get) {
        if (desc.set) {
          str = ctx.stylize("[Getter/Setter]", "special");
        } else {
          str = ctx.stylize("[Getter]", "special");
        }
      } else {
        if (desc.set) {
          str = ctx.stylize("[Setter]", "special");
        }
      }
      if (!hasOwnProperty2(visibleKeys, key)) {
        name = "[" + key + "]";
      }
      if (!str) {
        if (ctx.seen.indexOf(desc.value) < 0) {
          if (isNull(recurseTimes)) {
            str = formatValue(ctx, desc.value, null);
          } else {
            str = formatValue(ctx, desc.value, recurseTimes - 1);
          }
          if (str.indexOf("\n") > -1) {
            if (array) {
              str = str.split("\n").map(function(line) {
                return "  " + line;
              }).join("\n").slice(2);
            } else {
              str = "\n" + str.split("\n").map(function(line) {
                return "   " + line;
              }).join("\n");
            }
          }
        } else {
          str = ctx.stylize("[Circular]", "special");
        }
      }
      if (isUndefined(name)) {
        if (array && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify("" + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.slice(1, -1);
          name = ctx.stylize(name, "name");
        } else {
          name = name.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
          name = ctx.stylize(name, "string");
        }
      }
      return name + ": " + str;
    }
    function reduceToSingleString(output, base, braces) {
      var numLinesEst = 0;
      var length = output.reduce(function(prev, cur) {
        numLinesEst++;
        if (cur.indexOf("\n") >= 0)
          numLinesEst++;
        return prev + cur.replace(/\u001b\[\d\d?m/g, "").length + 1;
      }, 0);
      if (length > 60) {
        return braces[0] + (base === "" ? "" : base + "\n ") + " " + output.join(",\n  ") + " " + braces[1];
      }
      return braces[0] + base + " " + output.join(", ") + " " + braces[1];
    }
    exports.types = require_types();
    function isArray(ar) {
      return Array.isArray(ar);
    }
    exports.isArray = isArray;
    function isBoolean(arg) {
      return typeof arg === "boolean";
    }
    exports.isBoolean = isBoolean;
    function isNull(arg) {
      return arg === null;
    }
    exports.isNull = isNull;
    function isNullOrUndefined(arg) {
      return arg == null;
    }
    exports.isNullOrUndefined = isNullOrUndefined;
    function isNumber(arg) {
      return typeof arg === "number";
    }
    exports.isNumber = isNumber;
    function isString(arg) {
      return typeof arg === "string";
    }
    exports.isString = isString;
    function isSymbol(arg) {
      return typeof arg === "symbol";
    }
    exports.isSymbol = isSymbol;
    function isUndefined(arg) {
      return arg === void 0;
    }
    exports.isUndefined = isUndefined;
    function isRegExp(re) {
      return isObject2(re) && objectToString(re) === "[object RegExp]";
    }
    exports.isRegExp = isRegExp;
    exports.types.isRegExp = isRegExp;
    function isObject2(arg) {
      return typeof arg === "object" && arg !== null;
    }
    exports.isObject = isObject2;
    function isDate(d) {
      return isObject2(d) && objectToString(d) === "[object Date]";
    }
    exports.isDate = isDate;
    exports.types.isDate = isDate;
    function isError(e) {
      return isObject2(e) && (objectToString(e) === "[object Error]" || e instanceof Error);
    }
    exports.isError = isError;
    exports.types.isNativeError = isError;
    function isFunction(arg) {
      return typeof arg === "function";
    }
    exports.isFunction = isFunction;
    function isPrimitive(arg) {
      return arg === null || typeof arg === "boolean" || typeof arg === "number" || typeof arg === "string" || typeof arg === "symbol" || typeof arg === "undefined";
    }
    exports.isPrimitive = isPrimitive;
    exports.isBuffer = require_isBuffer();
    function objectToString(o) {
      return Object.prototype.toString.call(o);
    }
    function pad(n) {
      return n < 10 ? "0" + n.toString(10) : n.toString(10);
    }
    var months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec"
    ];
    function timestamp() {
      var d = new Date();
      var time = [
        pad(d.getHours()),
        pad(d.getMinutes()),
        pad(d.getSeconds())
      ].join(":");
      return [d.getDate(), months[d.getMonth()], time].join(" ");
    }
    exports.log = function() {
      console.log("%s - %s", timestamp(), exports.format.apply(exports, arguments));
    };
    exports.inherits = require_inherits();
    exports._extend = function(origin, add) {
      if (!add || !isObject2(add))
        return origin;
      var keys = Object.keys(add);
      var i = keys.length;
      while (i--) {
        origin[keys[i]] = add[keys[i]];
      }
      return origin;
    };
    function hasOwnProperty2(obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    }
    var kCustomPromisifiedSymbol = typeof Symbol !== "undefined" ? Symbol("util.promisify.custom") : void 0;
    exports.promisify = function promisify(original) {
      if (typeof original !== "function")
        throw new TypeError('The "original" argument must be of type Function');
      if (kCustomPromisifiedSymbol && original[kCustomPromisifiedSymbol]) {
        var fn = original[kCustomPromisifiedSymbol];
        if (typeof fn !== "function") {
          throw new TypeError('The "util.promisify.custom" argument must be of type Function');
        }
        Object.defineProperty(fn, kCustomPromisifiedSymbol, {
          value: fn,
          enumerable: false,
          writable: false,
          configurable: true
        });
        return fn;
      }
      function fn() {
        var promiseResolve, promiseReject;
        var promise = new Promise(function(resolve, reject) {
          promiseResolve = resolve;
          promiseReject = reject;
        });
        var args = [];
        for (var i = 0; i < arguments.length; i++) {
          args.push(arguments[i]);
        }
        args.push(function(err, value) {
          if (err) {
            promiseReject(err);
          } else {
            promiseResolve(value);
          }
        });
        try {
          original.apply(this, args);
        } catch (err) {
          promiseReject(err);
        }
        return promise;
      }
      Object.setPrototypeOf(fn, Object.getPrototypeOf(original));
      if (kCustomPromisifiedSymbol)
        Object.defineProperty(fn, kCustomPromisifiedSymbol, {
          value: fn,
          enumerable: false,
          writable: false,
          configurable: true
        });
      return Object.defineProperties(
        fn,
        getOwnPropertyDescriptors(original)
      );
    };
    exports.promisify.custom = kCustomPromisifiedSymbol;
    function callbackifyOnRejected(reason, cb) {
      if (!reason) {
        var newReason = new Error("Promise was rejected with a falsy value");
        newReason.reason = reason;
        reason = newReason;
      }
      return cb(reason);
    }
    function callbackify(original) {
      if (typeof original !== "function") {
        throw new TypeError('The "original" argument must be of type Function');
      }
      function callbackified() {
        var args = [];
        for (var i = 0; i < arguments.length; i++) {
          args.push(arguments[i]);
        }
        var maybeCb = args.pop();
        if (typeof maybeCb !== "function") {
          throw new TypeError("The last argument must be of type Function");
        }
        var self2 = this;
        var cb = function() {
          return maybeCb.apply(self2, arguments);
        };
        original.apply(this, args).then(
          function(ret) {
            process.nextTick(cb.bind(null, null, ret));
          },
          function(rej) {
            process.nextTick(callbackifyOnRejected.bind(null, rej, cb));
          }
        );
      }
      Object.setPrototypeOf(callbackified, Object.getPrototypeOf(original));
      Object.defineProperties(
        callbackified,
        getOwnPropertyDescriptors(original)
      );
      return callbackified;
    }
    exports.callbackify = callbackify;
  }
});

// src/js/polyfills/base.js
var import_queue_microtask = __toESM(require_queue_microtask());
var core = globalThis.__bootstrap;
globalThis.setTimeout = core.setTimeout;
globalThis.clearTimeout = core.clearTimeout;
globalThis.setInterval = core.setInterval;
globalThis.clearInterval = core.clearInterval;
globalThis.queueMicrotask = import_queue_microtask.default;
Object.defineProperty(globalThis, "global", {
  enumerable: true,
  get() {
    return globalThis;
  },
  set() {
  }
});
Object.defineProperty(globalThis, "window", {
  enumerable: true,
  get() {
    return globalThis;
  },
  set() {
  }
});
Object.defineProperty(globalThis, "self", {
  enumerable: true,
  get() {
    return globalThis;
  },
  set() {
  }
});

// src/js/polyfills/event-target.js
var privateData = /* @__PURE__ */ new WeakMap();
function pd(event) {
  const retv = privateData.get(event);
  if (!retv) {
    throw new Error("'this' is expected an Event object, but got " + event);
  }
  return retv;
}
function setCancelFlag(data) {
  if (data.passiveListener !== null) {
    console.error(
      "Unable to preventDefault inside passive event listener invocation.",
      data.passiveListener
    );
    return;
  }
  if (!data.eventInit.cancelable) {
    return;
  }
  data.canceled = true;
}
var Event2 = class {
  constructor(eventType, eventInit = {}) {
    if (eventInit && typeof eventInit !== "object") {
      throw TypeError("Value must be an object.");
    }
    privateData.set(this, {
      eventInit,
      eventPhase: 2,
      eventType: String(eventType),
      currentTarget: null,
      canceled: false,
      stopped: false,
      immediateStopped: false,
      passiveListener: null,
      timeStamp: Date.now()
    });
    Object.defineProperty(this, "isTrusted", { value: false, enumerable: true });
  }
  get type() {
    return pd(this).eventType;
  }
  get target() {
    return null;
  }
  get currentTarget() {
    return pd(this).currentTarget;
  }
  composedPath() {
    const currentTarget = pd(this).currentTarget;
    if (!currentTarget) {
      return [];
    }
    return [currentTarget];
  }
  get NONE() {
    return 0;
  }
  get CAPTURING_PHASE() {
    return 1;
  }
  get AT_TARGET() {
    return 2;
  }
  get BUBBLING_PHASE() {
    return 3;
  }
  get eventPhase() {
    return pd(this).eventPhase;
  }
  stopPropagation() {
    pd(this).stopped = true;
  }
  stopImmediatePropagation() {
    const data = pd(this);
    data.stopped = true;
    data.immediateStopped = true;
  }
  get bubbles() {
    return Boolean(pd(this).eventInit.bubbles);
  }
  get cancelable() {
    return Boolean(pd(this).eventInit.cancelable);
  }
  preventDefault() {
    setCancelFlag(pd(this));
  }
  get defaultPrevented() {
    return pd(this).canceled;
  }
  get composed() {
    return Boolean(pd(this).eventInit.composed);
  }
  get timeStamp() {
    return pd(this).timeStamp;
  }
};
var CustomEvent = class extends Event2 {
  get detail() {
    return Boolean(pd(this).eventInit.detail);
  }
};
function isStopped(event) {
  return pd(event).immediateStopped;
}
function setEventPhase(event, eventPhase) {
  pd(event).eventPhase = eventPhase;
}
function setCurrentTarget(event, currentTarget) {
  pd(event).currentTarget = currentTarget;
}
function setPassiveListener(event, passiveListener) {
  pd(event).passiveListener = passiveListener;
}
var listenersMap = /* @__PURE__ */ new WeakMap();
var CAPTURE = 1;
var BUBBLE = 2;
var ATTRIBUTE = 3;
function isObject(x) {
  return x !== null && typeof x === "object";
}
function getListeners(eventTarget) {
  const listeners = listenersMap.get(eventTarget);
  if (!listeners) {
    throw new TypeError(
      "'this' is expected an EventTarget object, but got another value."
    );
  }
  return listeners;
}
function defineEventAttributeDescriptor(eventName) {
  return {
    get() {
      const listeners = getListeners(this);
      let node = listeners.get(eventName);
      while (node) {
        if (node.listenerType === ATTRIBUTE) {
          return node.listener;
        }
        node = node.next;
      }
      return null;
    },
    set(listener) {
      if (typeof listener !== "function" && !isObject(listener)) {
        listener = null;
      }
      const listeners = getListeners(this);
      let prev = null;
      let node = listeners.get(eventName);
      while (node) {
        if (node.listenerType === ATTRIBUTE) {
          if (prev !== null) {
            prev.next = node.next;
          } else if (node.next !== null) {
            listeners.set(eventName, node.next);
          } else {
            listeners.delete(eventName);
          }
        } else {
          prev = node;
        }
        node = node.next;
      }
      if (listener !== null) {
        const newNode = {
          listener,
          listenerType: ATTRIBUTE,
          passive: false,
          once: false,
          next: null
        };
        if (prev === null) {
          listeners.set(eventName, newNode);
        } else {
          prev.next = newNode;
        }
      }
    },
    configurable: true,
    enumerable: true
  };
}
function defineEventAttribute(eventTargetPrototype, eventName) {
  Object.defineProperty(
    eventTargetPrototype,
    `on${eventName}`,
    defineEventAttributeDescriptor(eventName)
  );
}
var EventTarget2 = class {
  constructor() {
    this.__init();
  }
  __init() {
    listenersMap.set(this, /* @__PURE__ */ new Map());
  }
  addEventListener(eventName, listener, options) {
    if (!listener) {
      return;
    }
    if (typeof listener !== "function" && !isObject(listener)) {
      throw new TypeError("'listener' should be a function or an object.");
    }
    const listeners = getListeners(this);
    const optionsIsObj = isObject(options);
    const capture = optionsIsObj ? Boolean(options.capture) : Boolean(options);
    const listenerType = capture ? CAPTURE : BUBBLE;
    const newNode = {
      listener,
      listenerType,
      passive: optionsIsObj && Boolean(options.passive),
      once: optionsIsObj && Boolean(options.once),
      next: null
    };
    let node = listeners.get(eventName);
    if (node === void 0) {
      listeners.set(eventName, newNode);
      return;
    }
    let prev = null;
    while (node) {
      if (node.listener === listener && node.listenerType === listenerType) {
        return;
      }
      prev = node;
      node = node.next;
    }
    prev.next = newNode;
  }
  removeEventListener(eventName, listener, options) {
    if (!listener) {
      return;
    }
    const listeners = getListeners(this);
    const capture = isObject(options) ? Boolean(options.capture) : Boolean(options);
    const listenerType = capture ? CAPTURE : BUBBLE;
    let prev = null;
    let node = listeners.get(eventName);
    while (node) {
      if (node.listener === listener && node.listenerType === listenerType) {
        if (prev !== null) {
          prev.next = node.next;
        } else if (node.next !== null) {
          listeners.set(eventName, node.next);
        } else {
          listeners.delete(eventName);
        }
        return;
      }
      prev = node;
      node = node.next;
    }
  }
  dispatchEvent(event) {
    if (typeof event !== "object") {
      throw new TypeError("Argument 1 of EventTarget.dispatchEvent is not an object.");
    }
    if (!(event instanceof Event2)) {
      throw new TypeError("Argument 1 of EventTarget.dispatchEvent does not implement interface Event.");
    }
    setCurrentTarget(event, this);
    const listeners = getListeners(this);
    const eventName = event.type;
    let node = listeners.get(eventName);
    if (!node) {
      return true;
    }
    let prev = null;
    while (node) {
      if (node.once) {
        if (prev !== null) {
          prev.next = node.next;
        } else if (node.next !== null) {
          listeners.set(eventName, node.next);
        } else {
          listeners.delete(eventName);
        }
      } else {
        prev = node;
      }
      setPassiveListener(event, node.passive ? node.listener : null);
      if (typeof node.listener === "function") {
        try {
          node.listener.call(this, event);
        } catch (err) {
          console.error(err);
        }
      } else if (node.listenerType !== ATTRIBUTE && typeof node.listener.handleEvent === "function") {
        node.listener.handleEvent(event);
      }
      if (isStopped(event)) {
        break;
      }
      node = node.next;
    }
    setPassiveListener(event, null);
    setEventPhase(event, 0);
    return !event.defaultPrevented;
  }
};

// src/js/polyfills/event-target-polyfill.js
var kCloseEventCode = Symbol("kCloseEventCode");
var kCloseEventReason = Symbol("kCloseEventReason");
var kCloseEventWasClean = Symbol("kCloseEventWasClean");
var CloseEvent2 = class extends Event2 {
  constructor(eventTye, init2) {
    super(eventTye, init2);
    this[kCloseEventCode] = init2?.code ?? 0;
    this[kCloseEventReason] = init2?.reason ?? "";
    this[kCloseEventWasClean] = init2?.wasClean ?? false;
  }
  get code() {
    return this[kCloseEventCode];
  }
  get reason() {
    return this[kCloseEventReason];
  }
  get wasClean() {
    return this[kCloseEventWasClean];
  }
};
var kErrorEventData = Symbol("kErrorEventData");
var ErrorEvent2 = class extends Event2 {
  constructor(error) {
    super("error");
    this[kErrorEventData] = error;
  }
  get message() {
    return String(this[kErrorEventData]);
  }
  get filename() {
    return void 0;
  }
  get lineno() {
    return void 0;
  }
  get colno() {
    return void 0;
  }
  get error() {
    return this[kErrorEventData];
  }
};
var kMessageEventData = Symbol("kMessageEventData");
var MessageEvent2 = class extends Event2 {
  constructor(eventTye, data) {
    super(eventTye);
    this[kMessageEventData] = data;
  }
  get data() {
    return this[kMessageEventData];
  }
};
var kPromise = Symbol("kPromise");
var kPromiseRejectionReason = Symbol("kPromiseRejectionReason");
var PromiseRejectionEvent = class extends Event2 {
  constructor(eventTye, promise, reason) {
    super(eventTye, { cancelable: true });
    this[kPromise] = promise;
    this[kPromiseRejectionReason] = reason;
  }
  get promise() {
    return this[kPromise];
  }
  get reason() {
    return this[kPromiseRejectionReason];
  }
};
var kProgressEventLengthComputable = Symbol("kProgressEventLengthComputable");
var kProgressEventLoaded = Symbol("kProgressEventLoaded");
var kProgressEventTotal = Symbol("kProgressEventTotal");
var ProgressEvent2 = class extends Event2 {
  constructor(eventTye, init2) {
    super(eventTye, init2);
    this[kProgressEventLengthComputable] = init2?.lengthComputable || false;
    this[kProgressEventLoaded] = init2?.loaded || 0;
    this[kProgressEventTotal] = init2?.total || 0;
  }
  get lengthComputable() {
    return this[kProgressEventLengthComputable];
  }
  get loaded() {
    return this[kProgressEventLoaded];
  }
  get total() {
    return this[kProgressEventTotal];
  }
};
Object.defineProperties(window, {
  CloseEvent: {
    enumerable: true,
    configurable: true,
    writable: true,
    value: CloseEvent2
  },
  EventTarget: {
    enumerable: true,
    configurable: true,
    writable: true,
    value: EventTarget2
  },
  Event: {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Event2
  },
  ErrorEvent: {
    enumerable: true,
    configurable: true,
    writable: true,
    value: ErrorEvent2
  },
  MessageEvent: {
    enumerable: true,
    configurable: true,
    writable: true,
    value: MessageEvent2
  },
  PromiseRejectionEvent: {
    enumerable: true,
    configurable: true,
    writable: true,
    value: PromiseRejectionEvent
  },
  ProgressEvent: {
    enumerable: true,
    configurable: true,
    writable: true,
    value: ProgressEvent2
  },
  CustomEvent: {
    enumerable: true,
    configurable: true,
    writable: true,
    value: CustomEvent
  }
});
Object.setPrototypeOf(window, EventTarget2.prototype);
EventTarget2.prototype.__init.call(window);
var windowProto = Object.getPrototypeOf(window);
defineEventAttribute(windowProto, "load");
defineEventAttribute(windowProto, "unhandledrejection");
EventTarget2.__defineEventAttribute = defineEventAttribute;

// src/js/polyfills/url-polyfill.js
var import_url = __toESM(require_url3());
var import_to_json = __toESM(require_to_json2());
var import_url_search_params = __toESM(require_url_search_params3());

// node_modules/urlpattern-polyfill/dist/urlpattern.js
var regexIdentifierStart = /[$_\p{ID_Start}]/u;
var regexIdentifierPart = /[$_\u200C\u200D\p{ID_Continue}]/u;
function isASCII(str, extended) {
  return (extended ? /^[\x00-\xFF]*$/ : /^[\x00-\x7F]*$/).test(str);
}
function lexer(str, lenient = false) {
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    const char = str[i];
    const ErrorOrInvalid = function(msg) {
      if (!lenient)
        throw new TypeError(msg);
      tokens.push({ type: "INVALID_CHAR", index: i, value: str[i++] });
    };
    if (char === "*") {
      tokens.push({ type: "ASTERISK", index: i, value: str[i++] });
      continue;
    }
    if (char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      let name = "";
      let j = i + 1;
      while (j < str.length) {
        const code = str.substr(j, 1);
        if (j === i + 1 && regexIdentifierStart.test(code) || j !== i + 1 && regexIdentifierPart.test(code)) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name) {
        ErrorOrInvalid(`Missing parameter name at ${i}`);
        continue;
      }
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      let count = 1;
      let pattern = "";
      let j = i + 1;
      let error = false;
      if (str[j] === "?") {
        ErrorOrInvalid(`Pattern cannot start with "?" at ${j}`);
        continue;
      }
      while (j < str.length) {
        if (!isASCII(str[j], false)) {
          ErrorOrInvalid(`Invalid character '${str[j]}' at ${j}.`);
          error = true;
          break;
        }
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            ErrorOrInvalid(`Capturing groups are not allowed at ${j}`);
            error = true;
            break;
          }
        }
        pattern += str[j++];
      }
      if (error) {
        continue;
      }
      if (count) {
        ErrorOrInvalid(`Unbalanced pattern at ${i}`);
        continue;
      }
      if (!pattern) {
        ErrorOrInvalid(`Missing pattern at ${i}`);
        continue;
      }
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
function parse(str, options = {}) {
  const tokens = lexer(str);
  const { prefixes = "./" } = options;
  const defaultPattern = `[^${escapeString(options.delimiter === void 0 ? "/#?" : options.delimiter)}]+?`;
  const result = [];
  let key = 0;
  let i = 0;
  let path = "";
  let nameSet = /* @__PURE__ */ new Set();
  const tryConsume = (type) => {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  };
  const tryConsumeModifier = () => {
    const r = tryConsume("MODIFIER");
    if (r) {
      return r;
    }
    return tryConsume("ASTERISK");
  };
  const mustConsume = (type) => {
    const value = tryConsume(type);
    if (value !== void 0)
      return value;
    const { type: nextType, index } = tokens[i];
    throw new TypeError(`Unexpected ${nextType} at ${index}, expected ${type}`);
  };
  const consumeText = () => {
    let result2 = "";
    let value;
    while (value = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value;
    }
    return result2;
  };
  const DefaultEncodePart = (value) => {
    return value;
  };
  const encodePart = options.encodePart || DefaultEncodePart;
  while (i < tokens.length) {
    const char = tryConsume("CHAR");
    const name = tryConsume("NAME");
    let pattern = tryConsume("PATTERN");
    if (!name && !pattern && tryConsume("ASTERISK")) {
      pattern = ".*";
    }
    if (name || pattern) {
      let prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(encodePart(path));
        path = "";
      }
      const finalName = name || key++;
      if (nameSet.has(finalName)) {
        throw new TypeError(`Duplicate name '${finalName}'.`);
      }
      nameSet.add(finalName);
      result.push({
        name: finalName,
        prefix: encodePart(prefix),
        suffix: "",
        pattern: pattern || defaultPattern,
        modifier: tryConsumeModifier() || ""
      });
      continue;
    }
    const value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    const open2 = tryConsume("OPEN");
    if (open2) {
      const prefix = consumeText();
      const name2 = tryConsume("NAME") || "";
      let pattern2 = tryConsume("PATTERN") || "";
      if (!name2 && !pattern2 && tryConsume("ASTERISK")) {
        pattern2 = ".*";
      }
      const suffix = consumeText();
      mustConsume("CLOSE");
      const modifier = tryConsumeModifier() || "";
      if (!name2 && !pattern2 && !modifier) {
        path += prefix;
        continue;
      }
      if (!name2 && !pattern2 && !prefix) {
        continue;
      }
      if (path) {
        result.push(encodePart(path));
        path = "";
      }
      result.push({
        name: name2 || (pattern2 ? key++ : ""),
        pattern: name2 && !pattern2 ? defaultPattern : pattern2,
        prefix: encodePart(prefix),
        suffix: encodePart(suffix),
        modifier
      });
      continue;
    }
    if (path) {
      result.push(encodePart(path));
      path = "";
    }
    mustConsume("END");
  }
  return result;
}
function escapeString(str) {
  return str.replace(/([.+*?^${}()[\]|/\\])/g, "\\$1");
}
function flags(options) {
  return options && options.ignoreCase ? "ui" : "u";
}
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  const groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  let index = 0;
  let execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
function arrayToRegexp(paths, keys, options) {
  const parts = paths.map((path) => pathToRegexp(path, keys, options).source);
  return new RegExp(`(?:${parts.join("|")})`, flags(options));
}
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
function tokensToRegexp(tokens, keys, options = {}) {
  const {
    strict = false,
    start = true,
    end = true,
    encode = (x) => x
  } = options;
  const endsWith = `[${escapeString(options.endsWith === void 0 ? "" : options.endsWith)}]|$`;
  const delimiter = `[${escapeString(options.delimiter === void 0 ? "/#?" : options.delimiter)}]`;
  let route = start ? "^" : "";
  for (const token of tokens) {
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      const prefix = escapeString(encode(token.prefix));
      const suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            const mod = token.modifier === "*" ? "?" : "";
            route += `(?:${prefix}((?:${token.pattern})(?:${suffix}${prefix}(?:${token.pattern}))*)${suffix})${mod}`;
          } else {
            route += `(?:${prefix}(${token.pattern})${suffix})${token.modifier}`;
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            route += `((?:${token.pattern})${token.modifier})`;
          } else {
            route += `(${token.pattern})${token.modifier}`;
          }
        }
      } else {
        route += `(?:${prefix}${suffix})${token.modifier}`;
      }
    }
  }
  if (end) {
    if (!strict)
      route += `${delimiter}?`;
    route += !options.endsWith ? "$" : `(?=${endsWith})`;
  } else {
    const endToken = tokens[tokens.length - 1];
    const isEndDelimited = typeof endToken === "string" ? delimiter.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += `(?:${delimiter}(?=${endsWith}))?`;
    }
    if (!isEndDelimited) {
      route += `(?=${delimiter}|${endsWith})`;
    }
  }
  return new RegExp(route, flags(options));
}
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
var DEFAULT_OPTIONS = {
  delimiter: "",
  prefixes: "",
  sensitive: true,
  strict: true
};
var HOSTNAME_OPTIONS = {
  delimiter: ".",
  prefixes: "",
  sensitive: true,
  strict: true
};
var PATHNAME_OPTIONS = {
  delimiter: "/",
  prefixes: "/",
  sensitive: true,
  strict: true
};
function isAbsolutePathname(pathname, isPattern) {
  if (!pathname.length) {
    return false;
  }
  if (pathname[0] === "/") {
    return true;
  }
  if (!isPattern) {
    return false;
  }
  if (pathname.length < 2) {
    return false;
  }
  if ((pathname[0] == "\\" || pathname[0] == "{") && pathname[1] == "/") {
    return true;
  }
  return false;
}
function maybeStripPrefix(value, prefix) {
  if (value.startsWith(prefix)) {
    return value.substring(prefix.length, value.length);
  }
  return value;
}
function maybeStripSuffix(value, suffix) {
  if (value.endsWith(suffix)) {
    return value.substr(0, value.length - suffix.length);
  }
  return value;
}
function treatAsIPv6Hostname(value) {
  if (!value || value.length < 2) {
    return false;
  }
  if (value[0] === "[") {
    return true;
  }
  if ((value[0] === "\\" || value[0] === "{") && value[1] === "[") {
    return true;
  }
  return false;
}
var SPECIAL_SCHEMES = [
  "ftp",
  "file",
  "http",
  "https",
  "ws",
  "wss"
];
function isSpecialScheme(protocol_regexp) {
  if (!protocol_regexp) {
    return true;
  }
  for (const scheme of SPECIAL_SCHEMES) {
    if (protocol_regexp.test(scheme)) {
      return true;
    }
  }
  return false;
}
function canonicalizeHash(hash, isPattern) {
  hash = maybeStripPrefix(hash, "#");
  if (isPattern || hash === "") {
    return hash;
  }
  const url = new URL("https://example.com");
  url.hash = hash;
  return url.hash ? url.hash.substring(1, url.hash.length) : "";
}
function canonicalizeSearch(search, isPattern) {
  search = maybeStripPrefix(search, "?");
  if (isPattern || search === "") {
    return search;
  }
  const url = new URL("https://example.com");
  url.search = search;
  return url.search ? url.search.substring(1, url.search.length) : "";
}
function canonicalizeHostname(hostname, isPattern) {
  if (isPattern || hostname === "") {
    return hostname;
  }
  if (treatAsIPv6Hostname(hostname)) {
    return ipv6HostnameEncodeCallback(hostname);
  } else {
    return hostnameEncodeCallback(hostname);
  }
}
function canonicalizePassword(password, isPattern) {
  if (isPattern || password === "") {
    return password;
  }
  const url = new URL("https://example.com");
  url.password = password;
  return url.password;
}
function canonicalizeUsername(username, isPattern) {
  if (isPattern || username === "") {
    return username;
  }
  const url = new URL("https://example.com");
  url.username = username;
  return url.username;
}
function canonicalizePathname(pathname, protocol, isPattern) {
  if (isPattern || pathname === "") {
    return pathname;
  }
  if (protocol && !SPECIAL_SCHEMES.includes(protocol)) {
    const url = new URL(`${protocol}:${pathname}`);
    return url.pathname;
  }
  const leadingSlash = pathname[0] == "/";
  pathname = new URL(!leadingSlash ? "/-" + pathname : pathname, "https://example.com").pathname;
  if (!leadingSlash) {
    pathname = pathname.substring(2, pathname.length);
  }
  return pathname;
}
function canonicalizePort(port, protocol, isPattern) {
  if (defaultPortForProtocol(protocol) === port) {
    port = "";
  }
  if (isPattern || port === "") {
    return port;
  }
  return portEncodeCallback(port);
}
function canonicalizeProtocol(protocol, isPattern) {
  protocol = maybeStripSuffix(protocol, ":");
  if (isPattern || protocol === "") {
    return protocol;
  }
  return protocolEncodeCallback(protocol);
}
function defaultPortForProtocol(protocol) {
  switch (protocol) {
    case "ws":
    case "http":
      return "80";
    case "wws":
    case "https":
      return "443";
    case "ftp":
      return "21";
    default:
      return "";
  }
}
function protocolEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  if (/^[-+.A-Za-z0-9]*$/.test(input))
    return input.toLowerCase();
  throw new TypeError(`Invalid protocol '${input}'.`);
}
function usernameEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  const url = new URL("https://example.com");
  url.username = input;
  return url.username;
}
function passwordEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  const url = new URL("https://example.com");
  url.password = input;
  return url.password;
}
function hostnameEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  if (/[\t\n\r #%/:<>?@[\]^\\|]/g.test(input)) {
    throw new TypeError(`Invalid hostname '${input}'`);
  }
  const url = new URL("https://example.com");
  url.hostname = input;
  return url.hostname;
}
function ipv6HostnameEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  if (/[^0-9a-fA-F[\]:]/g.test(input)) {
    throw new TypeError(`Invalid IPv6 hostname '${input}'`);
  }
  return input.toLowerCase();
}
function portEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  if (/^[0-9]*$/.test(input) && parseInt(input) <= 65535) {
    return input;
  }
  throw new TypeError(`Invalid port '${input}'.`);
}
function standardURLPathnameEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  const url = new URL("https://example.com");
  url.pathname = input[0] !== "/" ? "/-" + input : input;
  if (input[0] !== "/") {
    return url.pathname.substring(2, url.pathname.length);
  }
  return url.pathname;
}
function pathURLPathnameEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  const url = new URL(`data:${input}`);
  return url.pathname;
}
function searchEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  const url = new URL("https://example.com");
  url.search = input;
  return url.search.substring(1, url.search.length);
}
function hashEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  const url = new URL("https://example.com");
  url.hash = input;
  return url.hash.substring(1, url.hash.length);
}
var Parser = class {
  constructor(input) {
    this.tokenList = [];
    this.internalResult = {};
    this.tokenIndex = 0;
    this.tokenIncrement = 1;
    this.componentStart = 0;
    this.state = 0;
    this.groupDepth = 0;
    this.hostnameIPv6BracketDepth = 0;
    this.shouldTreatAsStandardURL = false;
    this.input = input;
  }
  get result() {
    return this.internalResult;
  }
  parse() {
    this.tokenList = lexer(this.input, true);
    for (; this.tokenIndex < this.tokenList.length; this.tokenIndex += this.tokenIncrement) {
      this.tokenIncrement = 1;
      if (this.tokenList[this.tokenIndex].type === "END") {
        if (this.state === 0) {
          this.rewind();
          if (this.isHashPrefix()) {
            this.changeState(9, 1);
          } else if (this.isSearchPrefix()) {
            this.changeState(8, 1);
            this.internalResult.hash = "";
          } else {
            this.changeState(7, 0);
            this.internalResult.search = "";
            this.internalResult.hash = "";
          }
          continue;
        } else if (this.state === 2) {
          this.rewindAndSetState(5);
          continue;
        }
        this.changeState(10, 0);
        break;
      }
      if (this.groupDepth > 0) {
        if (this.isGroupClose()) {
          this.groupDepth -= 1;
        } else {
          continue;
        }
      }
      if (this.isGroupOpen()) {
        this.groupDepth += 1;
        continue;
      }
      switch (this.state) {
        case 0:
          if (this.isProtocolSuffix()) {
            this.internalResult.username = "";
            this.internalResult.password = "";
            this.internalResult.hostname = "";
            this.internalResult.port = "";
            this.internalResult.pathname = "";
            this.internalResult.search = "";
            this.internalResult.hash = "";
            this.rewindAndSetState(1);
          }
          break;
        case 1:
          if (this.isProtocolSuffix()) {
            this.computeShouldTreatAsStandardURL();
            let nextState = 7;
            let skip = 1;
            if (this.shouldTreatAsStandardURL) {
              this.internalResult.pathname = "/";
            }
            if (this.nextIsAuthoritySlashes()) {
              nextState = 2;
              skip = 3;
            } else if (this.shouldTreatAsStandardURL) {
              nextState = 2;
            }
            this.changeState(nextState, skip);
          }
          break;
        case 2:
          if (this.isIdentityTerminator()) {
            this.rewindAndSetState(3);
          } else if (this.isPathnameStart() || this.isSearchPrefix() || this.isHashPrefix()) {
            this.rewindAndSetState(5);
          }
          break;
        case 3:
          if (this.isPasswordPrefix()) {
            this.changeState(4, 1);
          } else if (this.isIdentityTerminator()) {
            this.changeState(5, 1);
          }
          break;
        case 4:
          if (this.isIdentityTerminator()) {
            this.changeState(5, 1);
          }
          break;
        case 5:
          if (this.isIPv6Open()) {
            this.hostnameIPv6BracketDepth += 1;
          } else if (this.isIPv6Close()) {
            this.hostnameIPv6BracketDepth -= 1;
          }
          if (this.isPortPrefix() && !this.hostnameIPv6BracketDepth) {
            this.changeState(6, 1);
          } else if (this.isPathnameStart()) {
            this.changeState(7, 0);
          } else if (this.isSearchPrefix()) {
            this.changeState(8, 1);
          } else if (this.isHashPrefix()) {
            this.changeState(9, 1);
          }
          break;
        case 6:
          if (this.isPathnameStart()) {
            this.changeState(7, 0);
          } else if (this.isSearchPrefix()) {
            this.changeState(8, 1);
          } else if (this.isHashPrefix()) {
            this.changeState(9, 1);
          }
          break;
        case 7:
          if (this.isSearchPrefix()) {
            this.changeState(8, 1);
          } else if (this.isHashPrefix()) {
            this.changeState(9, 1);
          }
          break;
        case 8:
          if (this.isHashPrefix()) {
            this.changeState(9, 1);
          }
          break;
        case 9:
          break;
        case 10:
          break;
      }
    }
  }
  changeState(newState, skip) {
    switch (this.state) {
      case 0:
        break;
      case 1:
        this.internalResult.protocol = this.makeComponentString();
        break;
      case 2:
        break;
      case 3:
        this.internalResult.username = this.makeComponentString();
        break;
      case 4:
        this.internalResult.password = this.makeComponentString();
        break;
      case 5:
        this.internalResult.hostname = this.makeComponentString();
        break;
      case 6:
        this.internalResult.port = this.makeComponentString();
        break;
      case 7:
        this.internalResult.pathname = this.makeComponentString();
        break;
      case 8:
        this.internalResult.search = this.makeComponentString();
        break;
      case 9:
        this.internalResult.hash = this.makeComponentString();
        break;
      case 10:
        break;
    }
    this.changeStateWithoutSettingComponent(newState, skip);
  }
  changeStateWithoutSettingComponent(newState, skip) {
    this.state = newState;
    this.componentStart = this.tokenIndex + skip;
    this.tokenIndex += skip;
    this.tokenIncrement = 0;
  }
  rewind() {
    this.tokenIndex = this.componentStart;
    this.tokenIncrement = 0;
  }
  rewindAndSetState(newState) {
    this.rewind();
    this.state = newState;
  }
  safeToken(index) {
    if (index < 0) {
      index = this.tokenList.length - index;
    }
    if (index < this.tokenList.length) {
      return this.tokenList[index];
    }
    return this.tokenList[this.tokenList.length - 1];
  }
  isNonSpecialPatternChar(index, value) {
    const token = this.safeToken(index);
    return token.value === value && (token.type === "CHAR" || token.type === "ESCAPED_CHAR" || token.type === "INVALID_CHAR");
  }
  isProtocolSuffix() {
    return this.isNonSpecialPatternChar(this.tokenIndex, ":");
  }
  nextIsAuthoritySlashes() {
    return this.isNonSpecialPatternChar(this.tokenIndex + 1, "/") && this.isNonSpecialPatternChar(this.tokenIndex + 2, "/");
  }
  isIdentityTerminator() {
    return this.isNonSpecialPatternChar(this.tokenIndex, "@");
  }
  isPasswordPrefix() {
    return this.isNonSpecialPatternChar(this.tokenIndex, ":");
  }
  isPortPrefix() {
    return this.isNonSpecialPatternChar(this.tokenIndex, ":");
  }
  isPathnameStart() {
    return this.isNonSpecialPatternChar(this.tokenIndex, "/");
  }
  isSearchPrefix() {
    if (this.isNonSpecialPatternChar(this.tokenIndex, "?")) {
      return true;
    }
    if (this.tokenList[this.tokenIndex].value !== "?") {
      return false;
    }
    const previousToken = this.safeToken(this.tokenIndex - 1);
    return previousToken.type !== "NAME" && previousToken.type !== "PATTERN" && previousToken.type !== "CLOSE" && previousToken.type !== "ASTERISK";
  }
  isHashPrefix() {
    return this.isNonSpecialPatternChar(this.tokenIndex, "#");
  }
  isGroupOpen() {
    return this.tokenList[this.tokenIndex].type == "OPEN";
  }
  isGroupClose() {
    return this.tokenList[this.tokenIndex].type == "CLOSE";
  }
  isIPv6Open() {
    return this.isNonSpecialPatternChar(this.tokenIndex, "[");
  }
  isIPv6Close() {
    return this.isNonSpecialPatternChar(this.tokenIndex, "]");
  }
  makeComponentString() {
    const token = this.tokenList[this.tokenIndex];
    const componentCharStart = this.safeToken(this.componentStart).index;
    return this.input.substring(componentCharStart, token.index);
  }
  computeShouldTreatAsStandardURL() {
    const options = {};
    Object.assign(options, DEFAULT_OPTIONS);
    options.encodePart = protocolEncodeCallback;
    const regexp = pathToRegexp(this.makeComponentString(), void 0, options);
    this.shouldTreatAsStandardURL = isSpecialScheme(regexp);
  }
};
var COMPONENTS = [
  "protocol",
  "username",
  "password",
  "hostname",
  "port",
  "pathname",
  "search",
  "hash"
];
var DEFAULT_PATTERN = "*";
function extractValues(url, baseURL) {
  if (typeof url !== "string") {
    throw new TypeError(`parameter 1 is not of type 'string'.`);
  }
  const o = new URL(url, baseURL);
  return {
    protocol: o.protocol.substring(0, o.protocol.length - 1),
    username: o.username,
    password: o.password,
    hostname: o.hostname,
    port: o.port,
    pathname: o.pathname,
    search: o.search != "" ? o.search.substring(1, o.search.length) : void 0,
    hash: o.hash != "" ? o.hash.substring(1, o.hash.length) : void 0
  };
}
function applyInit(o, init2, isPattern) {
  let baseURL;
  if (typeof init2.baseURL === "string") {
    try {
      baseURL = new URL(init2.baseURL);
      o.protocol = baseURL.protocol ? baseURL.protocol.substring(0, baseURL.protocol.length - 1) : "";
      o.username = baseURL.username;
      o.password = baseURL.password;
      o.hostname = baseURL.hostname;
      o.port = baseURL.port;
      o.pathname = baseURL.pathname;
      o.search = baseURL.search ? baseURL.search.substring(1, baseURL.search.length) : "";
      o.hash = baseURL.hash ? baseURL.hash.substring(1, baseURL.hash.length) : "";
    } catch {
      throw new TypeError(`invalid baseURL '${init2.baseURL}'.`);
    }
  }
  if (typeof init2.protocol === "string") {
    o.protocol = canonicalizeProtocol(init2.protocol, isPattern);
  }
  if (typeof init2.username === "string") {
    o.username = canonicalizeUsername(init2.username, isPattern);
  }
  if (typeof init2.password === "string") {
    o.password = canonicalizePassword(init2.password, isPattern);
  }
  if (typeof init2.hostname === "string") {
    o.hostname = canonicalizeHostname(init2.hostname, isPattern);
  }
  if (typeof init2.port === "string") {
    o.port = canonicalizePort(init2.port, o.protocol, isPattern);
  }
  if (typeof init2.pathname === "string") {
    o.pathname = init2.pathname;
    if (baseURL && !isAbsolutePathname(o.pathname, isPattern)) {
      const slashIndex = baseURL.pathname.lastIndexOf("/");
      if (slashIndex >= 0) {
        o.pathname = baseURL.pathname.substring(0, slashIndex + 1) + o.pathname;
      }
    }
    o.pathname = canonicalizePathname(o.pathname, o.protocol, isPattern);
  }
  if (typeof init2.search === "string") {
    o.search = canonicalizeSearch(init2.search, isPattern);
  }
  if (typeof init2.hash === "string") {
    o.hash = canonicalizeHash(init2.hash, isPattern);
  }
  return o;
}
function escapePatternString(value) {
  return value.replace(/([+*?:{}()\\])/g, "\\$1");
}
function escapeRegexpString(value) {
  return value.replace(/([.+*?^${}()[\]|/\\])/g, "\\$1");
}
function tokensToPattern(tokens, options) {
  const wildcardPattern = ".*";
  const segmentWildcardPattern = `[^${escapeRegexpString(options.delimiter === void 0 ? "/#?" : options.delimiter)}]+?`;
  const regexIdentifierPart2 = /[$_\u200C\u200D\p{ID_Continue}]/u;
  let result = "";
  for (let i = 0; i < tokens.length; ++i) {
    const token = tokens[i];
    const lastToken = i > 0 ? tokens[i - 1] : null;
    const nextToken = i < tokens.length - 1 ? tokens[i + 1] : null;
    if (typeof token === "string") {
      result += escapePatternString(token);
      continue;
    }
    if (token.pattern === "") {
      if (token.modifier === "") {
        result += escapePatternString(token.prefix);
        continue;
      }
      result += `{${escapePatternString(token.prefix)}}${token.modifier}`;
      continue;
    }
    const customName = typeof token.name !== "number";
    const optionsPrefixes = options.prefixes !== void 0 ? options.prefixes : "./";
    let needsGrouping = token.suffix !== "" || token.prefix !== "" && (token.prefix.length !== 1 || !optionsPrefixes.includes(token.prefix));
    if (!needsGrouping && customName && token.pattern === segmentWildcardPattern && token.modifier === "" && nextToken && !nextToken.prefix && !nextToken.suffix) {
      if (typeof nextToken === "string") {
        const code = nextToken.length > 0 ? nextToken[0] : "";
        needsGrouping = regexIdentifierPart2.test(code);
      } else {
        needsGrouping = typeof nextToken.name === "number";
      }
    }
    if (!needsGrouping && token.prefix === "" && lastToken && typeof lastToken === "string" && lastToken.length > 0) {
      const code = lastToken[lastToken.length - 1];
      needsGrouping = optionsPrefixes.includes(code);
    }
    if (needsGrouping) {
      result += "{";
    }
    result += escapePatternString(token.prefix);
    if (customName) {
      result += `:${token.name}`;
    }
    if (token.pattern === wildcardPattern) {
      if (!customName && (!lastToken || typeof lastToken === "string" || lastToken.modifier || needsGrouping || token.prefix !== "")) {
        result += "*";
      } else {
        result += `(${wildcardPattern})`;
      }
    } else if (token.pattern === segmentWildcardPattern) {
      if (!customName) {
        result += `(${segmentWildcardPattern})`;
      }
    } else {
      result += `(${token.pattern})`;
    }
    if (token.pattern === segmentWildcardPattern && customName && token.suffix !== "") {
      if (regexIdentifierPart2.test(token.suffix[0])) {
        result += "\\";
      }
    }
    result += escapePatternString(token.suffix);
    if (needsGrouping) {
      result += "}";
    }
    result += token.modifier;
  }
  return result;
}
var URLPattern = class {
  constructor(init2 = {}, baseURLOrOptions, options) {
    this.regexp = {};
    this.keys = {};
    this.component_pattern = {};
    try {
      let baseURL = void 0;
      if (typeof baseURLOrOptions === "string") {
        baseURL = baseURLOrOptions;
      } else {
        options = baseURLOrOptions;
      }
      if (typeof init2 === "string") {
        const parser = new Parser(init2);
        parser.parse();
        init2 = parser.result;
        if (baseURL === void 0 && typeof init2.protocol !== "string") {
          throw new TypeError(`A base URL must be provided for a relative constructor string.`);
        }
        init2.baseURL = baseURL;
      } else {
        if (!init2 || typeof init2 !== "object") {
          throw new TypeError(`parameter 1 is not of type 'string' and cannot convert to dictionary.`);
        }
        if (baseURL) {
          throw new TypeError(`parameter 1 is not of type 'string'.`);
        }
      }
      if (typeof options === "undefined") {
        options = { ignoreCase: false };
      }
      const ignoreCaseOptions = { ignoreCase: options.ignoreCase === true };
      const defaults = {
        pathname: DEFAULT_PATTERN,
        protocol: DEFAULT_PATTERN,
        username: DEFAULT_PATTERN,
        password: DEFAULT_PATTERN,
        hostname: DEFAULT_PATTERN,
        port: DEFAULT_PATTERN,
        search: DEFAULT_PATTERN,
        hash: DEFAULT_PATTERN
      };
      this.pattern = applyInit(defaults, init2, true);
      if (defaultPortForProtocol(this.pattern.protocol) === this.pattern.port) {
        this.pattern.port = "";
      }
      let component;
      for (component of COMPONENTS) {
        if (!(component in this.pattern))
          continue;
        const options2 = {};
        const pattern = this.pattern[component];
        this.keys[component] = [];
        switch (component) {
          case "protocol":
            Object.assign(options2, DEFAULT_OPTIONS);
            options2.encodePart = protocolEncodeCallback;
            break;
          case "username":
            Object.assign(options2, DEFAULT_OPTIONS);
            options2.encodePart = usernameEncodeCallback;
            break;
          case "password":
            Object.assign(options2, DEFAULT_OPTIONS);
            options2.encodePart = passwordEncodeCallback;
            break;
          case "hostname":
            Object.assign(options2, HOSTNAME_OPTIONS);
            if (treatAsIPv6Hostname(pattern)) {
              options2.encodePart = ipv6HostnameEncodeCallback;
            } else {
              options2.encodePart = hostnameEncodeCallback;
            }
            break;
          case "port":
            Object.assign(options2, DEFAULT_OPTIONS);
            options2.encodePart = portEncodeCallback;
            break;
          case "pathname":
            if (isSpecialScheme(this.regexp.protocol)) {
              Object.assign(options2, PATHNAME_OPTIONS, ignoreCaseOptions);
              options2.encodePart = standardURLPathnameEncodeCallback;
            } else {
              Object.assign(options2, DEFAULT_OPTIONS, ignoreCaseOptions);
              options2.encodePart = pathURLPathnameEncodeCallback;
            }
            break;
          case "search":
            Object.assign(options2, DEFAULT_OPTIONS, ignoreCaseOptions);
            options2.encodePart = searchEncodeCallback;
            break;
          case "hash":
            Object.assign(options2, DEFAULT_OPTIONS, ignoreCaseOptions);
            options2.encodePart = hashEncodeCallback;
            break;
        }
        try {
          const tokens = parse(pattern, options2);
          this.regexp[component] = tokensToRegexp(tokens, this.keys[component], options2);
          this.component_pattern[component] = tokensToPattern(tokens, options2);
        } catch {
          throw new TypeError(`invalid ${component} pattern '${this.pattern[component]}'.`);
        }
      }
    } catch (err) {
      throw new TypeError(`Failed to construct 'URLPattern': ${err.message}`);
    }
  }
  test(input = {}, baseURL) {
    let values = {
      pathname: "",
      protocol: "",
      username: "",
      password: "",
      hostname: "",
      port: "",
      search: "",
      hash: ""
    };
    if (typeof input !== "string" && baseURL) {
      throw new TypeError(`parameter 1 is not of type 'string'.`);
    }
    if (typeof input === "undefined") {
      return false;
    }
    try {
      if (typeof input === "object") {
        values = applyInit(values, input, false);
      } else {
        values = applyInit(values, extractValues(input, baseURL), false);
      }
    } catch (err) {
      return false;
    }
    let component;
    for (component of COMPONENTS) {
      if (!this.regexp[component].exec(values[component])) {
        return false;
      }
    }
    return true;
  }
  exec(input = {}, baseURL) {
    let values = {
      pathname: "",
      protocol: "",
      username: "",
      password: "",
      hostname: "",
      port: "",
      search: "",
      hash: ""
    };
    if (typeof input !== "string" && baseURL) {
      throw new TypeError(`parameter 1 is not of type 'string'.`);
    }
    if (typeof input === "undefined") {
      return;
    }
    try {
      if (typeof input === "object") {
        values = applyInit(values, input, false);
      } else {
        values = applyInit(values, extractValues(input, baseURL), false);
      }
    } catch (err) {
      return null;
    }
    let result = {};
    if (baseURL) {
      result.inputs = [input, baseURL];
    } else {
      result.inputs = [input];
    }
    let component;
    for (component of COMPONENTS) {
      let match = this.regexp[component].exec(values[component]);
      if (!match) {
        return null;
      }
      let groups = {};
      for (let [i, key] of this.keys[component].entries()) {
        if (typeof key.name === "string" || typeof key.name === "number") {
          let value = match[i + 1];
          groups[key.name] = value;
        }
      }
      result[component] = {
        input: values[component] || "",
        groups
      };
    }
    return result;
  }
  get protocol() {
    return this.component_pattern.protocol;
  }
  get username() {
    return this.component_pattern.username;
  }
  get password() {
    return this.component_pattern.password;
  }
  get hostname() {
    return this.component_pattern.hostname;
  }
  get port() {
    return this.component_pattern.port;
  }
  get pathname() {
    return this.component_pattern.pathname;
  }
  get search() {
    return this.component_pattern.search;
  }
  get hash() {
    return this.component_pattern.hash;
  }
};

// node_modules/urlpattern-polyfill/index.js
if (!globalThis.URLPattern) {
  globalThis.URLPattern = URLPattern;
}

// src/js/polyfills/url-polyfill.js
window.URLPattern = URLPattern;

// src/js/polyfills/xhr.js
var { XMLHttpRequest: XHR } = globalThis.__bootstrap;
var kXHR = Symbol("kXHR");
var XMLHttpRequest2 = class extends EventTarget {
  constructor() {
    super();
    __publicField(this, "UNSENT", XHR.UNSENT);
    __publicField(this, "OPENED", XHR.OPENED);
    __publicField(this, "HEADERS_RECEIVED", XHR.HEADERS_RECEIVED);
    __publicField(this, "LOADING", XHR.LOADING);
    __publicField(this, "DONE", XHR.DONE);
    const xhr = new XHR();
    xhr.onabort = () => {
      this.dispatchEvent(new Event("abort"));
    };
    xhr.onerror = () => {
      this.dispatchEvent(new Event("error"));
    };
    xhr.onload = () => {
      this.dispatchEvent(new Event("load"));
    };
    xhr.onloadend = () => {
      this.dispatchEvent(new Event("loadend"));
    };
    xhr.onloadstart = () => {
      this.dispatchEvent(new Event("loadstart"));
    };
    xhr.onprogress = (p) => {
      this.dispatchEvent(new ProgressEvent("progress", p));
    };
    xhr.onreadystatechange = () => {
      this.dispatchEvent(new Event("readystatechange"));
    };
    xhr.ontimeout = () => {
      this.dispatchEvent(new Event("timeout"));
    };
    this[kXHR] = xhr;
  }
  get readyState() {
    return this[kXHR].readyState;
  }
  get response() {
    return this[kXHR].response;
  }
  get responseText() {
    return this[kXHR].responseText;
  }
  set responseType(value) {
    this[kXHR].responseType = value;
  }
  get responseType() {
    return this[kXHR].responseType;
  }
  get responseURL() {
    return this[kXHR].responseURL;
  }
  get status() {
    return this[kXHR].status;
  }
  get statusText() {
    return this[kXHR].statusText;
  }
  set timeout(value) {
    this[kXHR].timeout = value;
  }
  get timeout() {
    return this[kXHR].timeout;
  }
  get upload() {
    return this[kXHR].upload;
  }
  set withCcredentials(value) {
    this[kXHR].withCcredentials = value;
  }
  get withCcredentials() {
    return this[kXHR].withCcredentials;
  }
  abort() {
    return this[kXHR].abort();
  }
  getAllResponseHeaders() {
    return this[kXHR].getAllResponseHeaders();
  }
  getResponseHeader(name) {
    return this[kXHR].getResponseHeader(name);
  }
  open(...args) {
    return this[kXHR].open(...args);
  }
  overrideMimeType(mimeType) {
    return this[kXHR].overrideMimeType(mimeType);
  }
  send(body) {
    return this[kXHR].send(body);
  }
  setRequestHeader(name, value) {
    return this[kXHR].setRequestHeader(name, value);
  }
};
__publicField(XMLHttpRequest2, "UNSENT", XHR.UNSENT);
__publicField(XMLHttpRequest2, "OPENED", XHR.OPENED);
__publicField(XMLHttpRequest2, "HEADERS_RECEIVED", XHR.HEADERS_RECEIVED);
__publicField(XMLHttpRequest2, "LOADING", XHR.LOADING);
__publicField(XMLHttpRequest2, "DONE", XHR.DONE);
var xhrProto = XMLHttpRequest2.prototype;
defineEventAttribute(xhrProto, "abort");
defineEventAttribute(xhrProto, "error");
defineEventAttribute(xhrProto, "load");
defineEventAttribute(xhrProto, "loadend");
defineEventAttribute(xhrProto, "loadstart");
defineEventAttribute(xhrProto, "progress");
defineEventAttribute(xhrProto, "readystatechange");
defineEventAttribute(xhrProto, "timeout");
Object.defineProperty(window, "XMLHttpRequest", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: XMLHttpRequest2
});

// src/js/polyfills/index.js
var import_whatwg_fetch = __toESM(require_fetch_umd());

// node_modules/abortcontroller-polyfill/dist/polyfill-patch-fetch.js
(function(factory) {
  typeof define === "function" && define.amd ? define(factory) : factory();
})(function() {
  "use strict";
  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }
  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor)
        descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }
  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps)
      _defineProperties(Constructor.prototype, protoProps);
    if (staticProps)
      _defineProperties(Constructor, staticProps);
    Object.defineProperty(Constructor, "prototype", {
      writable: false
    });
    return Constructor;
  }
  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function");
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        writable: true,
        configurable: true
      }
    });
    Object.defineProperty(subClass, "prototype", {
      writable: false
    });
    if (superClass)
      _setPrototypeOf(subClass, superClass);
  }
  function _getPrototypeOf(o) {
    _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf2(o2) {
      return o2.__proto__ || Object.getPrototypeOf(o2);
    };
    return _getPrototypeOf(o);
  }
  function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
      o2.__proto__ = p2;
      return o2;
    };
    return _setPrototypeOf(o, p);
  }
  function _isNativeReflectConstruct() {
    if (typeof Reflect === "undefined" || !Reflect.construct)
      return false;
    if (Reflect.construct.sham)
      return false;
    if (typeof Proxy === "function")
      return true;
    try {
      Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
      }));
      return true;
    } catch (e) {
      return false;
    }
  }
  function _assertThisInitialized(self2) {
    if (self2 === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return self2;
  }
  function _possibleConstructorReturn(self2, call) {
    if (call && (typeof call === "object" || typeof call === "function")) {
      return call;
    } else if (call !== void 0) {
      throw new TypeError("Derived constructors may only return object or undefined");
    }
    return _assertThisInitialized(self2);
  }
  function _createSuper(Derived) {
    var hasNativeReflectConstruct = _isNativeReflectConstruct();
    return function _createSuperInternal() {
      var Super = _getPrototypeOf(Derived), result;
      if (hasNativeReflectConstruct) {
        var NewTarget = _getPrototypeOf(this).constructor;
        result = Reflect.construct(Super, arguments, NewTarget);
      } else {
        result = Super.apply(this, arguments);
      }
      return _possibleConstructorReturn(this, result);
    };
  }
  function _superPropBase(object, property) {
    while (!Object.prototype.hasOwnProperty.call(object, property)) {
      object = _getPrototypeOf(object);
      if (object === null)
        break;
    }
    return object;
  }
  function _get() {
    if (typeof Reflect !== "undefined" && Reflect.get) {
      _get = Reflect.get.bind();
    } else {
      _get = function _get2(target, property, receiver) {
        var base = _superPropBase(target, property);
        if (!base)
          return;
        var desc = Object.getOwnPropertyDescriptor(base, property);
        if (desc.get) {
          return desc.get.call(arguments.length < 3 ? target : receiver);
        }
        return desc.value;
      };
    }
    return _get.apply(this, arguments);
  }
  var Emitter = /* @__PURE__ */ function() {
    function Emitter2() {
      _classCallCheck(this, Emitter2);
      Object.defineProperty(this, "listeners", {
        value: {},
        writable: true,
        configurable: true
      });
    }
    _createClass(Emitter2, [{
      key: "addEventListener",
      value: function addEventListener(type, callback, options) {
        if (!(type in this.listeners)) {
          this.listeners[type] = [];
        }
        this.listeners[type].push({
          callback,
          options
        });
      }
    }, {
      key: "removeEventListener",
      value: function removeEventListener(type, callback) {
        if (!(type in this.listeners)) {
          return;
        }
        var stack = this.listeners[type];
        for (var i = 0, l = stack.length; i < l; i++) {
          if (stack[i].callback === callback) {
            stack.splice(i, 1);
            return;
          }
        }
      }
    }, {
      key: "dispatchEvent",
      value: function dispatchEvent(event) {
        if (!(event.type in this.listeners)) {
          return;
        }
        var stack = this.listeners[event.type];
        var stackToCall = stack.slice();
        for (var i = 0, l = stackToCall.length; i < l; i++) {
          var listener = stackToCall[i];
          try {
            listener.callback.call(this, event);
          } catch (e) {
            Promise.resolve().then(function() {
              throw e;
            });
          }
          if (listener.options && listener.options.once) {
            this.removeEventListener(event.type, listener.callback);
          }
        }
        return !event.defaultPrevented;
      }
    }]);
    return Emitter2;
  }();
  var AbortSignal = /* @__PURE__ */ function(_Emitter) {
    _inherits(AbortSignal2, _Emitter);
    var _super = _createSuper(AbortSignal2);
    function AbortSignal2() {
      var _this;
      _classCallCheck(this, AbortSignal2);
      _this = _super.call(this);
      if (!_this.listeners) {
        Emitter.call(_assertThisInitialized(_this));
      }
      Object.defineProperty(_assertThisInitialized(_this), "aborted", {
        value: false,
        writable: true,
        configurable: true
      });
      Object.defineProperty(_assertThisInitialized(_this), "onabort", {
        value: null,
        writable: true,
        configurable: true
      });
      Object.defineProperty(_assertThisInitialized(_this), "reason", {
        value: void 0,
        writable: true,
        configurable: true
      });
      return _this;
    }
    _createClass(AbortSignal2, [{
      key: "toString",
      value: function toString() {
        return "[object AbortSignal]";
      }
    }, {
      key: "dispatchEvent",
      value: function dispatchEvent(event) {
        if (event.type === "abort") {
          this.aborted = true;
          if (typeof this.onabort === "function") {
            this.onabort.call(this, event);
          }
        }
        _get(_getPrototypeOf(AbortSignal2.prototype), "dispatchEvent", this).call(this, event);
      }
    }]);
    return AbortSignal2;
  }(Emitter);
  var AbortController2 = /* @__PURE__ */ function() {
    function AbortController3() {
      _classCallCheck(this, AbortController3);
      Object.defineProperty(this, "signal", {
        value: new AbortSignal(),
        writable: true,
        configurable: true
      });
    }
    _createClass(AbortController3, [{
      key: "abort",
      value: function abort(reason) {
        var event;
        try {
          event = new Event("abort");
        } catch (e) {
          if (typeof document !== "undefined") {
            if (!document.createEvent) {
              event = document.createEventObject();
              event.type = "abort";
            } else {
              event = document.createEvent("Event");
              event.initEvent("abort", false, false);
            }
          } else {
            event = {
              type: "abort",
              bubbles: false,
              cancelable: false
            };
          }
        }
        var signalReason = reason;
        if (signalReason === void 0) {
          if (typeof document === "undefined") {
            signalReason = new Error("This operation was aborted");
            signalReason.name = "AbortError";
          } else {
            try {
              signalReason = new DOMException("signal is aborted without reason");
            } catch (err) {
              signalReason = new Error("This operation was aborted");
              signalReason.name = "AbortError";
            }
          }
        }
        this.signal.reason = signalReason;
        this.signal.dispatchEvent(event);
      }
    }, {
      key: "toString",
      value: function toString() {
        return "[object AbortController]";
      }
    }]);
    return AbortController3;
  }();
  if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
    AbortController2.prototype[Symbol.toStringTag] = "AbortController";
    AbortSignal.prototype[Symbol.toStringTag] = "AbortSignal";
  }
  function polyfillNeeded(self2) {
    if (self2.__FORCE_INSTALL_ABORTCONTROLLER_POLYFILL) {
      console.log("__FORCE_INSTALL_ABORTCONTROLLER_POLYFILL=true is set, will force install polyfill");
      return true;
    }
    return typeof self2.Request === "function" && !self2.Request.prototype.hasOwnProperty("signal") || !self2.AbortController;
  }
  function abortableFetchDecorator(patchTargets) {
    if ("function" === typeof patchTargets) {
      patchTargets = {
        fetch: patchTargets
      };
    }
    var _patchTargets = patchTargets, fetch = _patchTargets.fetch, _patchTargets$Request = _patchTargets.Request, NativeRequest = _patchTargets$Request === void 0 ? fetch.Request : _patchTargets$Request, NativeAbortController = _patchTargets.AbortController, _patchTargets$__FORCE = _patchTargets.__FORCE_INSTALL_ABORTCONTROLLER_POLYFILL, __FORCE_INSTALL_ABORTCONTROLLER_POLYFILL = _patchTargets$__FORCE === void 0 ? false : _patchTargets$__FORCE;
    if (!polyfillNeeded({
      fetch,
      Request: NativeRequest,
      AbortController: NativeAbortController,
      __FORCE_INSTALL_ABORTCONTROLLER_POLYFILL
    })) {
      return {
        fetch,
        Request
      };
    }
    var Request = NativeRequest;
    if (Request && !Request.prototype.hasOwnProperty("signal") || __FORCE_INSTALL_ABORTCONTROLLER_POLYFILL) {
      Request = function Request2(input, init2) {
        var signal2;
        if (init2 && init2.signal) {
          signal2 = init2.signal;
          delete init2.signal;
        }
        var request = new NativeRequest(input, init2);
        if (signal2) {
          Object.defineProperty(request, "signal", {
            writable: false,
            enumerable: false,
            configurable: true,
            value: signal2
          });
        }
        return request;
      };
      Request.prototype = NativeRequest.prototype;
    }
    var realFetch = fetch;
    var abortableFetch = function abortableFetch2(input, init2) {
      var signal2 = Request && Request.prototype.isPrototypeOf(input) ? input.signal : init2 ? init2.signal : void 0;
      if (signal2) {
        var abortError;
        try {
          abortError = new DOMException("Aborted", "AbortError");
        } catch (err) {
          abortError = new Error("Aborted");
          abortError.name = "AbortError";
        }
        if (signal2.aborted) {
          return Promise.reject(abortError);
        }
        var cancellation = new Promise(function(_, reject) {
          signal2.addEventListener("abort", function() {
            return reject(abortError);
          }, {
            once: true
          });
        });
        if (init2 && init2.signal) {
          delete init2.signal;
        }
        return Promise.race([cancellation, realFetch(input, init2)]);
      }
      return realFetch(input, init2);
    };
    return {
      fetch: abortableFetch,
      Request
    };
  }
  (function(self2) {
    if (!polyfillNeeded(self2)) {
      return;
    }
    if (!self2.fetch) {
      console.warn("fetch() is not available, cannot install abortcontroller-polyfill");
      return;
    }
    var _abortableFetch = abortableFetchDecorator(self2), fetch = _abortableFetch.fetch, Request = _abortableFetch.Request;
    self2.fetch = fetch;
    self2.Request = Request;
    Object.defineProperty(self2, "AbortController", {
      writable: true,
      enumerable: false,
      configurable: true,
      value: AbortController2
    });
    Object.defineProperty(self2, "AbortSignal", {
      writable: true,
      enumerable: false,
      configurable: true,
      value: AbortSignal
    });
  })(typeof self !== "undefined" ? self : global);
});

// src/js/polyfills/index.js
var import_es2018 = __toESM(require_polyfill_es2018());

// src/js/polyfills/text-encoding.js
var import_text_encoding_utf_8 = __toESM(require_encoding_lib());
window.TextEncoder = import_text_encoding_utf_8.TextEncoder;
window.TextDecoder = import_text_encoding_utf_8.TextDecoder;

// src/js/polyfills/blob.js
var import_blob_polyfill = __toESM(require_Blob());
Object.defineProperty(window, "Blob", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: import_blob_polyfill.Blob
});

// src/js/polyfills/console.js
var import_util = __toESM(require_util());
var encoder = new TextEncoder();
function print() {
  const text = import_util.default.format.apply(null, arguments) + "\n";
  tjs.stdout.write(encoder.encode(text));
}
function hasOwnProperty(obj, v) {
  if (obj === null || typeof obj === "undefined") {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(obj, v);
}
var tableChars = {
  middleMiddle: "\u2500",
  rowMiddle: "\u253C",
  topRight: "\u2510",
  topLeft: "\u250C",
  leftMiddle: "\u251C",
  topMiddle: "\u252C",
  bottomRight: "\u2518",
  bottomLeft: "\u2514",
  bottomMiddle: "\u2534",
  rightMiddle: "\u2524",
  left: "\u2502 ",
  right: " \u2502",
  middle: " \u2502 "
};
var colorRegExp = /\u001b\[\d\d?m/g;
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
      if (rows[j] === void 0) {
        rows[j] = [];
      }
      const value = rows[j][i] = hasOwnProperty(column, j) ? column[j] : "";
      const width = columnWidths[i] || 0;
      const counted = countBytes(value);
      columnWidths[i] = Math.max(width, counted);
    }
  }
  const divider = columnWidths.map((i) => tableChars.middleMiddle.repeat(i + 2));
  let result = `${tableChars.topLeft}${divider.join(tableChars.topMiddle)}${tableChars.topRight}
${renderRow(head, columnWidths)}
${tableChars.leftMiddle}${divider.join(tableChars.rowMiddle)}${tableChars.rightMiddle}
`;
  for (const row of rows) {
    result += `${renderRow(row, columnWidths)}
`;
  }
  result += `${tableChars.bottomLeft}${divider.join(tableChars.bottomMiddle)}` + tableChars.bottomRight;
  return result;
}
var Console = class {
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
    this.log(import_util.default.inspect(o));
  }
  dirxml(o) {
    this.dir(o);
  }
  table(data, properties) {
    if (properties !== void 0 && !Array.isArray(properties)) {
      throw new Error(
        "The 'properties' argument must be of type Array. Received type string"
      );
    }
    if (data === null || typeof data !== "object") {
      return this.log(data);
    }
    const objectValues = {};
    const indexKeys = [];
    const values = [];
    const stringifyValue = (value) => import_util.default.format(value);
    const toTable = (header2, body2) => this.log(cliTable(header2, body2));
    const createColumn = (value, shift) => [
      ...shift ? [...new Array(shift)].map(() => "") : [],
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
            ([k2, v]) => {
              if (properties && !properties.includes(k2)) {
                return;
              }
              if (objectValues[k2]) {
                objectValues[k2].push(stringifyValue(v));
              } else {
                objectValues[k2] = createColumn(v, idx);
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
      ...properties || [
        ...headerKeys,
        !isMap && values.length > 0 && valuesKey
      ]
    ].filter(Boolean);
    const body = [indexKeys, ...bodyValues, values];
    toTable(header, body);
  }
  trace(...args) {
    const err = new Error();
    err.name = "Trace";
    err.message = args.map(String).join(" ");
    const tmpStack = err.stack.split("\n");
    tmpStack.splice(0, 1);
    err.stack = tmpStack.join("\n");
    this.error(err);
  }
};
Object.defineProperty(window, "console", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: new Console()
});

// node_modules/uuid/dist/esm-browser/rng.js
var getRandomValues;
var rnds8 = new Uint8Array(16);
function rng() {
  if (!getRandomValues) {
    getRandomValues = typeof crypto !== "undefined" && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);
    if (!getRandomValues) {
      throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    }
  }
  return getRandomValues(rnds8);
}

// node_modules/uuid/dist/esm-browser/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// node_modules/uuid/dist/esm-browser/native.js
var randomUUID = typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID.bind(crypto);
var native_default = {
  randomUUID
};

// node_modules/uuid/dist/esm-browser/v4.js
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  options = options || {};
  const rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
var v4_default = v4;

// src/js/polyfills/crypto.js
var core2 = globalThis.__bootstrap;
var TypedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
var TypedArrayProto_toStringTag = Object.getOwnPropertyDescriptor(TypedArrayPrototype, Symbol.toStringTag).get;
function getRandomValues2(obj) {
  const type = TypedArrayProto_toStringTag.call(obj);
  switch (type) {
    case "Int8Array":
    case "Uint8Array":
    case "Int16Array":
    case "Uint16Array":
    case "Int32Array":
    case "Uint32Array":
      break;
    default:
      throw new TypeError("Argument 1 of Crypto.getRandomValues does not implement interface ArrayBufferView");
  }
  if (obj.byteLength > 65536) {
    const e = new Error();
    e.name = "QuotaExceededError";
    throw e;
  }
  core2.random(obj.buffer, obj.byteOffset, obj.byteLength);
  return obj;
}
function randomUUID2() {
  return v4_default();
}
var crypto2 = Object.freeze({
  getRandomValues: getRandomValues2,
  randomUUID: randomUUID2,
  subtle: void 0
});
Object.defineProperty(window, "crypto", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: crypto2
});

// src/js/polyfills/performance.js
var core3 = globalThis.__bootstrap;
var Performance = class {
  constructor() {
    this._startTime = core3.hrtimeMs();
    this._entries = [];
    this._marksIndex = /* @__PURE__ */ Object.create(null);
  }
  get timeOrigin() {
    return this._startTime;
  }
  now() {
    return core3.hrtimeMs() - this._startTime;
  }
  mark(name) {
    const mark = {
      name,
      entryType: "mark",
      startTime: this.now(),
      duration: 0
    };
    this._entries.push(mark);
    this._marksIndex[name] = mark;
  }
  measure(name, startMark, endMark) {
    let startTime;
    let endTime;
    if (endMark !== void 0 && this._marksIndex[endMark] === void 0) {
      throw new SyntaxError("Failed to execute 'measure' on 'Performance': The mark '" + endMark + "' does not exist.");
    }
    if (startMark !== void 0 && this._marksIndex[startMark] === void 0) {
      throw new SyntaxError("Failed to execute 'measure' on 'Performance': The mark '" + startMark + "' does not exist.");
    }
    if (this._marksIndex[startMark]) {
      startTime = this._marksIndex[startMark].startTime;
    } else {
      startTime = 0;
    }
    if (this._marksIndex[endMark]) {
      endTime = this._marksIndex[endMark].startTime;
    } else {
      endTime = this.now();
    }
    const mark = {
      name,
      entryType: "measure",
      startTime,
      duration: endTime - startTime
    };
    this._entries.push(mark);
  }
  getEntriesByType(type) {
    return this._entries.filter((entry) => entry.entryType === type);
  }
  getEntriesByName(name) {
    return this._entries.filter((entry) => entry.name === name);
  }
  clearMarks(name) {
    if (typeof name === "undefined") {
      this._entries = this._entries.filter((entry) => entry.entryType !== "mark");
    } else {
      const entry = this._entries.find((e) => e.entryType === "mark" && e.name === name);
      this._entries.splice(this._entries.indexOf(entry), 1);
      delete this._marksIndex[name];
    }
  }
  clearMeasures(name) {
    if (typeof name === "undefined") {
      this._entries = this._entries.filter((entry) => entry.entryType !== "measure");
    } else {
      const entry = this._entries.find((e) => e.entryType === "measure" && e.name === name);
      this._entries.splice(this._entries.indexOf(entry), 1);
    }
  }
};
Object.defineProperty(window, "performance", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: new Performance()
});

// src/js/polyfills/wasm.js
var { wasm } = globalThis.__bootstrap;
var kWasmModule = Symbol("kWasmModule");
var kWasmModuleRef = Symbol("kWasmModuleRef");
var kWasmExports = Symbol("kWasmExports");
var kWasmInstance = Symbol("kWasmInstance");
var kWasmInstances = Symbol("kWasmInstances");
var kWasiLinked = Symbol("kWasiLinked");
var kWasiStarted = Symbol("kWasiStarted");
var kWasiOptions = Symbol("kWasiOptions");
var CompileError = class extends Error {
  constructor(...args) {
    super(...args);
    this.name = "CompileError";
  }
};
var LinkError = class extends Error {
  constructor(...args) {
    super(...args);
    this.name = "LinkError";
  }
};
var RuntimeError = class extends Error {
  constructor(...args) {
    super(...args);
    this.name = "RuntimeError";
  }
};
function getWasmError(e) {
  switch (e.wasmError) {
    case "CompileError":
      return new CompileError(e.message);
    case "LinkError":
      return new LinkError(e.message);
    case "RuntimeError":
      return new RuntimeError(e.message);
    default:
      return new TypeError(`Invalid WASM error: ${e.wasmError}`);
  }
}
function callWasmFunction(name, ...args) {
  const instance = this;
  try {
    return instance.callFunction(name, ...args);
  } catch (e) {
    if (e.wasmError) {
      throw getWasmError(e);
    } else {
      throw e;
    }
  }
}
function buildInstance(mod) {
  try {
    return wasm.buildInstance(mod);
  } catch (e) {
    if (e.wasmError) {
      throw getWasmError(e);
    } else {
      throw e;
    }
  }
}
function linkWasi(instance) {
  try {
    instance.linkWasi();
  } catch (e) {
    if (e.wasmError) {
      throw getWasmError(e);
    } else {
      throw e;
    }
  }
}
function parseModule(buf) {
  try {
    return wasm.parseModule(buf);
  } catch (e) {
    if (e.wasmError) {
      throw getWasmError(e);
    } else {
      throw e;
    }
  }
}
var Module = class {
  constructor(buf) {
    this[kWasmModule] = parseModule(buf);
  }
  static exports(module) {
    return wasm.moduleExports(module[kWasmModule]);
  }
  static imports(module) {
    return {};
  }
};
var Instance = class {
  constructor(module, importObject = {}) {
    const instance = buildInstance(module[kWasmModule]);
    if (importObject.wasi_unstable) {
      linkWasi(instance);
      this[kWasiLinked] = true;
    }
    const _exports = Module.exports(module);
    const exports = /* @__PURE__ */ Object.create(null);
    for (const item of _exports) {
      if (item.kind === "function") {
        exports[item.name] = callWasmFunction.bind(instance, item.name);
      }
    }
    this[kWasmInstance] = instance;
    this[kWasmExports] = Object.freeze(exports);
    this[kWasmModuleRef] = module;
    globalThis.WebAssembly[kWasmInstances].push(this);
  }
  get exports() {
    return this[kWasmExports];
  }
};
var WASI = class {
  constructor(options = { args: [], env: {}, preopens: {} }) {
    __publicField(this, "wasiImport", "w4s1");
    this[kWasiStarted] = false;
    if (options === null || typeof options !== "object") {
      throw new TypeError("options must be an object");
    }
    this[kWasiOptions] = JSON.parse(JSON.stringify(options));
  }
  start(instance) {
    if (this[kWasiStarted]) {
      throw new Error("WASI instance has already started");
    }
    if (!instance[kWasiLinked]) {
      throw new Error("WASM instance doesn't have WASI linked");
    }
    if (!instance.exports._start) {
      throw new TypeError("WASI entrypoint not found");
    }
    this[kWasiStarted] = true;
    instance.exports._start(...this[kWasiOptions].args ?? []);
  }
};
var WebAssembly = class {
  constructor() {
    __publicField(this, "Module", Module);
    __publicField(this, "Instance", Instance);
    __publicField(this, "CompileError", CompileError);
    __publicField(this, "LinkError", LinkError);
    __publicField(this, "RuntimeError", RuntimeError);
    __publicField(this, "WASI", WASI);
    this[kWasmInstances] = [];
  }
  async compile(src) {
    return new Module(src);
  }
  async instantiate(src, importObject) {
    const module = await this.compile(src);
    const instance = new Instance(module, importObject);
    return { module, instance };
  }
};
Object.defineProperty(globalThis, "WebAssembly", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: new WebAssembly()
});

// src/js/polyfills/worker.js
var { Worker: _Worker } = globalThis.__bootstrap;
var kWorker = Symbol("kWorker");
var Worker = class extends EventTarget {
  constructor(path) {
    super();
    const worker = new _Worker(path);
    worker.onmessage = (msg) => {
      this.dispatchEvent(new MessageEvent("message", msg));
    };
    worker.onmessageerror = (msgerror) => {
      this.dispatchEvent(new MessageEvent("messageerror", msgerror));
    };
    worker.onerror = (error) => {
      this.dispatchEvent(new ErrorEvent(error));
    };
    this[kWorker] = worker;
  }
  postMessage(...args) {
    this[kWorker].postMessage(args);
  }
  terminate() {
    this[kWorker].terminate();
  }
};
var workerProto = Worker.prototype;
defineEventAttribute(workerProto, "message");
defineEventAttribute(workerProto, "messageerror");
defineEventAttribute(workerProto, "error");
Object.defineProperty(window, "Worker", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: Worker
});

// src/js/polyfills/ws.js
var { WebSocket: WS } = globalThis.__bootstrap;
var kWS = Symbol("kWS");
var kWsBinaryType = Symbol("kWsBinaryType");
var kWsProtocol = Symbol("kWsProtocol");
var kWsUrl = Symbol("kWsUrl");
var _a, _b;
var WebSocket = class extends EventTarget {
  constructor(url, protocols = []) {
    super();
    __publicField(this, "CONNECTING", WS.CONNECTING);
    __publicField(this, "OPEN", WS.OPEN);
    __publicField(this, "CLOSING", WS.CLOSING);
    __publicField(this, "CLOSED", WS.CLOSED);
    __publicField(this, _a, "blob");
    __publicField(this, _b, "");
    let urlStr;
    try {
      urlStr = new URL(url).toString();
    } catch (_) {
    }
    if (!urlStr) {
      throw new Error("Invalid URL");
    }
    this[kWsUrl] = urlStr;
    const protocolStr = protocols.join(",") || null;
    const ws = new WS(urlStr, protocolStr);
    ws.onclose = (ev) => {
      const { code, reason, wasClean } = ev;
      this.dispatchEvent(new CloseEvent("close", { code, reason, wasClean }));
    };
    ws.onerror = () => {
      this.dispatchEvent(new Event("error"));
    };
    ws.onmessage = (msg) => {
      let data = msg;
      if (typeof msg !== "string" && this[kWsBinaryType] === "blob") {
        data = new Blob(msg);
      }
      this.dispatchEvent(new MessageEvent("message", data));
    };
    ws.onopen = (p) => {
      this[kWsProtocol] = p;
      this.dispatchEvent(new Event("open"));
    };
    this[kWS] = ws;
  }
  get binaryType() {
    return this[kWsBinaryType];
  }
  set binaryType(value) {
    if (!["arraybuffer", "blob"].includes(value)) {
      throw new Error(`Unsupported binaryType: ${value}`);
    }
    this[kWsBinaryType] = value;
  }
  get bufferedAmount() {
    return 0;
  }
  get extensions() {
    return "";
  }
  get protocol() {
    return this[kWsProtocol];
  }
  get readyState() {
    return this[kWS].readyState;
  }
  get url() {
    return this[kWsUrl];
  }
  send(data) {
    if (typeof data === "string") {
      this[kWS].sendText(data);
    } else if (data instanceof Blob) {
      data.arrayBuffer().then((buf) => {
        this[kWS].sendBinary(buf, 0, buf.byteLength);
      });
    } else if (data instanceof ArrayBuffer) {
      this[kWS].sendBinary(data, 0, data.byteLength);
    } else if (ArrayBuffer.isView(data)) {
      this[kWS].sendBinary(data.buffer, data.byteOffset, data.byteLength);
    }
  }
  close(code = 1e3, reason = "") {
    if (code !== 1e3 && !(code >= 3e3 && code <= 4999)) {
      throw new RangeError("Invalid code value");
    }
    if (reason.length > 123) {
      throw new SyntaxError("Invalid reason value");
    }
    this[kWS].close(code, reason);
  }
};
_a = kWsBinaryType, _b = kWsProtocol;
__publicField(WebSocket, "CONNECTING", WS.CONNECTING);
__publicField(WebSocket, "OPEN", WS.OPEN);
__publicField(WebSocket, "CLOSING", WS.CLOSING);
__publicField(WebSocket, "CLOSED", WS.CLOSED);
var xhrProto2 = WebSocket.prototype;
defineEventAttribute(xhrProto2, "close");
defineEventAttribute(xhrProto2, "error");
defineEventAttribute(xhrProto2, "message");
defineEventAttribute(xhrProto2, "open");
Object.defineProperty(window, "WebSocket", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: WebSocket
});

// src/js/tjs/alert-confirm-prompt.js
var encoder2 = new TextEncoder();
var decoder = new TextDecoder();
var LF = "\n".charCodeAt();
var CR = "\r".charCodeAt();
async function readStdinLine() {
  const c = new Uint8Array(1);
  const buf = [];
  while (true) {
    const n = await tjs.stdin.read(c);
    if (n === 0) {
      break;
    }
    if (c[0] === CR) {
      const n2 = await tjs.stdin.read(c);
      if (c[0] === LF) {
        break;
      }
      buf.push(CR);
      if (n2 === 0) {
        break;
      }
    }
    if (c[0] === LF) {
      break;
    }
    buf.push(c[0]);
  }
  return decoder.decode(new Uint8Array(buf));
}
async function alert(msg) {
  if (!tjs.stdin.isTTY) {
    return;
  }
  await tjs.stdout.write(encoder2.encode(msg + " [Enter] "));
  await readStdinLine();
}
async function confirm(msg = "Confirm") {
  if (!tjs.stdin.isTTY) {
    return false;
  }
  await tjs.stdout.write(encoder2.encode(msg + " [y/N] "));
  const answer = await readStdinLine();
  return answer.toLowerCase()[0] === "y";
}
async function prompt(msg = "Prompt", def = null) {
  if (!tjs.stdin.isTTY) {
    return null;
  }
  await tjs.stdout.write(encoder2.encode(msg + " "));
  return await readStdinLine() || def;
}

// src/js/tjs/ffi.js
var ffi_exports = {};
__export(ffi_exports, {
  AdvancedType: () => AdvancedType,
  ArrayType: () => ArrayType,
  CFunction: () => CFunction,
  DlSymbol: () => DlSymbol,
  JSCallback: () => JSCallback,
  Lib: () => Lib,
  Pointer: () => Pointer,
  PointerType: () => PointerType,
  StaticStringType: () => StaticStringType,
  StructType: () => StructType,
  bufferToString: () => bufferToString,
  errno: () => errno,
  ffiInt: () => ffiInt,
  strerror: () => strerror,
  types: () => types
});

// src/js/tjs/ffiutils.js
function init({ StructType: StructType2, CFunction: CFunction2, PointerType: PointerType2 }) {
  function parseCProto2(header) {
    function tokenize(str) {
      const words = str.split(/\s+/);
      const tokens2 = [];
      const tokenRegex = /(\w+|[^\w])/g;
      for (const w of words) {
        if (w.length === 0) {
          continue;
        }
        let m;
        while (m = tokenRegex.exec(w)) {
          tokens2.push(m[1]);
        }
        tokenRegex.lastIndex = 0;
      }
      return tokens2;
    }
    function sepStatements(tokens2, offs = 0) {
      const statements2 = [];
      let index = offs;
      const firstToken = tokens2[index];
      if (firstToken === "[" || firstToken === "(" || firstToken === "{") {
        index++;
        statements2._block = firstToken;
      }
      let stTokens = [];
      while (index < tokens2.length) {
        const t = tokens2[index];
        switch (t) {
          case "{": {
            const [sst, newOffs] = sepStatements(tokens2, index);
            stTokens.push(sst);
            index = newOffs;
            break;
          }
          case "(":
          case "[": {
            const [sst, newOffs] = sepStatements(tokens2, index);
            stTokens.push(sst);
            index = newOffs;
            break;
          }
          case "}":
            if (firstToken !== "{") {
              throw new Error("Unexpected " + t);
            }
            if (stTokens.length > 0) {
              throw new Error("expected semicolon as last token of block");
            }
            return [statements2, index];
          case ")":
            if (firstToken !== "(") {
              throw new Error("Unexpected " + t);
            }
            if (stTokens.length) {
              statements2.push(stTokens);
            }
            return [statements2, index];
          case "]":
            if (firstToken !== "[") {
              throw new Error("Unexpected " + t);
            }
            if (stTokens.length) {
              statements2.push(stTokens);
            }
            return [statements2, index];
          case ",":
          case ";":
            if (stTokens.length) {
              statements2.push(stTokens);
            }
            stTokens = [];
            break;
          default:
            stTokens.push(t);
        }
        index++;
      }
      return [statements2, index];
    }
    function parseSimpleType(st) {
      let info = {
        kind: "type",
        typeModifiers: [],
        name: "",
        ptr: 0
      };
      for (let i = 0; i < st.length; i++) {
        if (st[i]._block === "[") {
          info.arr = st[i].length > 0 ? parseInt(st[i][0]) : true;
          continue;
        }
        switch (st[i]) {
          case "const":
            info.const = true;
            break;
          case "volatile":
            info.volatile = true;
            break;
          case "*":
            info.ptr++;
            break;
          case "long":
          case "short":
          case "unsigned":
          case "signed":
          case "struct":
          default:
            if (info.name.length > 0) {
              info.name += " ";
            }
            info.name += st[i];
        }
      }
      return info;
    }
    function parseType(st) {
      const curlyBlockInd = st.findIndex((e) => e._block === "{");
      const roundBlockInd = st.findIndex((e) => e._block === "(");
      const ptr = st.filter((e) => e === "*").length;
      if (st[0] === "struct" && curlyBlockInd > -1) {
        return {
          kind: "type",
          typeModifiers: [],
          name: "",
          ptr,
          struct: parseStruct(st)
        };
      } else if (roundBlockInd > -1) {
        return {
          kind: "type",
          typeModifiers: [],
          name: "",
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
      if (st.slice(-1)[0]._block === "[") {
        const arrBrack = st.slice(-1)[0];
        arr = arrBrack.length === 0 ? true : parseInt(arrBrack[0]);
        namePos--;
      }
      const info = {
        kind: "vardef",
        type: parseType(st.slice(0, namePos)),
        name: st[namePos]
      };
      if (arr) {
        info.arr = arr;
      }
      return info;
    }
    function parseTypedef(st) {
      if (st.slice(-1)[0]._block === "(") {
        const func = parseFunctionProto(st.slice(1));
        return {
          kind: "typedef",
          name: func.name,
          child: func
        };
      }
      return {
        kind: "typedef",
        name: st.slice(-1)[0],
        child: parseType(st.slice(1, -1))
      };
    }
    function parseStruct(st) {
      const info = {
        kind: "struct"
      };
      const curlyBlockInd = st.findIndex((e) => e._block === "{");
      if (curlyBlockInd >= 2) {
        if (curlyBlockInd > 2) {
          throw new Error("expected { after struct name");
        }
        info.name = st[1];
      }
      info.members = st[curlyBlockInd].map(parseVardef);
      return info;
    }
    function parseFunctionProto(st) {
      let firstBrackInd = st.findIndex((e) => e._block === "(");
      let secondBrackInd = st[firstBrackInd + 1]?._block === "(" ? firstBrackInd + 1 : -1;
      const argBlock = secondBrackInd > 0 ? st[secondBrackInd] : st[firstBrackInd];
      const name = secondBrackInd > 0 ? st[firstBrackInd][0].slice(-1)[0] : st[firstBrackInd - 1];
      const ptr = secondBrackInd > 0 ? st[firstBrackInd][0].filter((e) => e === "*").length : 0;
      const retTypeMaxInd = secondBrackInd > 0 ? firstBrackInd - 1 : firstBrackInd - 2;
      const info = {
        kind: "function",
        name,
        args: argBlock.map(parseVardef),
        modifiers: [],
        ptr
      };
      let offs = 0;
      loop:
        while (offs < retTypeMaxInd) {
          switch (st[offs]) {
            case "static":
            case "inline":
            case "extern":
              info.modifiers.push(st[offs]);
              break;
            default:
              break loop;
          }
          offs++;
        }
      info.return = parseType(st.slice(offs, retTypeMaxInd + 1));
      return info;
    }
    function parseStatement(st) {
      switch (st[0]) {
        case "typedef":
          return parseTypedef(st);
        case "struct":
          return parseStruct(st);
        default:
          return parseFunctionProto(st);
      }
    }
    const tokens = tokenize(header);
    const [statements] = sepStatements(tokens);
    const ast = statements.map(parseStatement);
    return ast;
  }
  function astToLib2(lib, ast) {
    let unnamedCnt = 0;
    function getType(name, ptr = 0) {
      let ffiType = lib.getType(name + "*".repeat(ptr));
      if (ffiType) {
        return ffiType;
      }
      ffiType = lib.getType(name);
      if (!ffiType) {
        throw new Error(`Unknown type ${name}`);
      }
      if (ptr > 0) {
        const t = new PointerType2(ffiType, ptr);
        lib.registerType(name + "*".repeat(ptr), t);
        return t;
      }
      return ffiType;
    }
    function registerStruct(regname, st) {
      const fields = [];
      for (const m of st.members) {
        if (m.type.kind === "type") {
          let t;
          if (m.type.struct) {
            registerStruct(m.type.struct.name, m.type.struct);
            t = getType("struct " + m.type.struct.name, m.type.ptr);
          } else {
            t = getType(m.type.name, m.type.ptr);
          }
          fields.push([m.name, t]);
        } else {
          throw new Error("unhandled member type: " + m.type.kind);
        }
      }
      const stt = new StructType2(
        fields,
        st.name ? st.name : `__unnamed_struct_${regname}_${unnamedCnt++}`,
        st.align
      );
      lib.registerType(regname, stt);
      return stt;
    }
    for (const e of ast) {
      switch (e.kind) {
        case "typedef":
          if (e.child.kind === "type") {
            if (e.child.struct) {
              registerStruct(e.name ?? "struct " + e.child.struct.name, e.child.struct);
              lib.registerType(e.name, getType(e.name ?? "struct " + e.child.struct.name, e.child.ptr));
            } else {
              lib.registerType(e.name, getType(e.child.name));
            }
          } else if (e.child.kind === "function") {
            lib.registerType(e.name || e.child.name, tjs.ffi.types.jscallback);
          } else {
            throw new Error("unsupported typedef: " + JSON.stringify(e));
          }
          break;
        case "struct":
          registerStruct("struct " + e.name, e);
          break;
        case "function": {
          const f = new CFunction2(
            lib.symbol(e.name),
            getType(e.return.name, e.return.ptr, true),
            e.args.map((p) => getType(p.type.name, p.type.ptr, true))
          );
          lib.registerFunction(e.name, f);
          break;
        }
      }
    }
  }
  return { parseCProto: parseCProto2, astToLib: astToLib2 };
}

// src/js/tjs/ffi.js
var core4 = globalThis.__bootstrap;
var ffiInt = core4.ffi;
var DlSymbol = class {
  constructor(name, uvlib, dlsym) {
    this._name = name;
    this._uvlib = uvlib;
    this._dlsym = dlsym;
  }
  get addr() {
    return this._dlsym.addr;
  }
};
function formatTypeName(name) {
  if (name.includes(" ")) {
    const mPtr = name.match(/\*+/g);
    name = name.replace(/\*+/g, "");
    let parts = name.split(/\s+/);
    let struct = false;
    if (parts.includes("struct")) {
      parts = parts.filter((e) => e !== "struct");
      struct = true;
    }
    name = parts.sort().join(" ");
    if (mPtr) {
      name += mPtr[0];
    }
    if (struct) {
      name = "struct " + name;
    }
  }
  return name;
}
var Lib = class {
  constructor(libname) {
    this._libname = libname;
    this._uvlib = new ffiInt.UvLib(libname);
    this._funcs = /* @__PURE__ */ new Map();
    this._types = /* @__PURE__ */ new Map();
    for (const [t, aliases] of typeMap) {
      for (const alias of aliases) {
        this.registerType(alias, t);
      }
    }
  }
  symbol(name) {
    const symbol = this._uvlib.symbol(name);
    return new DlSymbol(name, this._uvlib, symbol);
  }
  registerType(name, type) {
    name = formatTypeName(name);
    this._types.set(name, type);
  }
  getType(name) {
    name = formatTypeName(name);
    return this._types.get(name);
  }
  registerFunction(name, func) {
    this._funcs.set(name, func);
  }
  getFunc(name) {
    return this._funcs.get(name);
  }
  call(funcname, ...args) {
    const func = this.getFunc(funcname);
    if (!func) {
      throw new Error(`Function ${funcname} not found`);
    }
    return func.call(...args);
  }
  parseCProto(header) {
    const ast = parseCProto(header);
    astToLib(this, ast);
  }
};
__publicField(Lib, "LIBC_NAME", ffiInt.LIBC_NAME);
__publicField(Lib, "LIBM_NAME", ffiInt.LIBM_NAME);
var AdvancedType = class {
  constructor(type, conf) {
    this._ffiType = type;
    this._conf = conf;
  }
  toBuffer(data, ctx = {}) {
    if (this._conf.toBuffer) {
      return this._conf.toBuffer(data, ctx);
    } else {
      return this._type.toBuffer(data, ctx);
    }
  }
  fromBuffer(buf, ctx = {}) {
    if (this._conf.fromBuffer) {
      return this._conf.fromBuffer(buf, ctx);
    } else {
      return this._type.fromBuffer(buf, ctx);
    }
  }
  get ffiType() {
    return this._ffiType;
  }
  get ffiTypeStruct() {
    return this._conf.getFfiTypeStruct ? this._conf.getFfiTypeStruct() : this._ffiType;
  }
  get name() {
    return this._conf.name;
  }
  get size() {
    return this._ffiType.size;
  }
};
var CFunction = class {
  constructor(symbol, rtype, argtypes, fixed) {
    this._symbol = symbol;
    this._rtype = rtype;
    this._argtypes = argtypes;
    function getFfiType(t) {
      if (t.ffiType) {
        return t.ffiType;
      }
      return t;
    }
    this._cif = new ffiInt.FfiCif(getFfiType(rtype), ...argtypes.map(getFfiType), fixed);
    this._fixed = fixed;
  }
  call(...argsJs) {
    const ctx = {};
    const args = [];
    for (const i in argsJs) {
      ctx[i] = {};
      args[i] = this._argtypes[i].toBuffer(argsJs[i], ctx[i]);
    }
    const ret = this._cif.call(this._symbol._dlsym, ...args);
    ctx["ret"] = {};
    return this._rtype.fromBuffer(ret, ctx["ret"]);
  }
};
var types = {
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
    toBuffer: (str, ctx) => {
      ctx.buf = new TextEncoder().encode(str + "\0");
      return ffiInt.getArrayBufPtr(ctx.buf);
    },
    fromBuffer: (buf) => {
      const ptr = ffiInt.type_pointer.fromBuffer(buf);
      const str = ffiInt.getCString(ptr);
      return str;
    },
    name: "string"
  }),
  buffer: new AdvancedType(ffiInt.type_pointer, {
    toBuffer: (buf) => ffiInt.getArrayBufPtr(buf),
    fromBuffer: () => {
      throw new Error("type buffer cannot be used as a return type, since the size is not known!");
    },
    name: "string"
  }),
  jscallback: new AdvancedType(ffiInt.type_pointer, {
    toBuffer: (jsc) => {
      if (!(jsc instanceof JSCallback)) {
        throw new Error("not a JSCallback");
      }
      return jsc.addr;
    },
    fromBuffer: () => {
      throw new Error("JSCallback as a return is not supported!");
    },
    name: "jscallback"
  })
};
var typeMap = [
  [types.uint8, ["uint8_t"]],
  [types.uint16, ["uint16_t"]],
  [types.uint32, ["uint32_t", "signed long long", "signed long long int", "long long", "long long int"]],
  [types.uint64, ["uint64_t", "unsigned long long", "unsigned long long int"]],
  [types.sint8, ["int8_t"]],
  [types.sint16, ["int16_t"]],
  [types.sint32, ["int32_t"]],
  [types.sint64, ["int64_t"]],
  [types.float, ["float"]],
  [types.double, ["double"]],
  [types.pointer, ["void*"]],
  [types.longdouble, ["long double"]],
  [types.uchar, ["unsigned char"]],
  [types.schar, ["signed char", "char"]],
  [types.ushort, ["unsigned short", "unsigned short int"]],
  [types.sshort, ["signed short", "signed short int", "short int"]],
  [types.uint, ["unsigned int", "unsigned"]],
  [types.sint, ["signed int", "int"]],
  [types.ulong, ["unsigned long", "unsigned long int"]],
  [types.slong, ["signed long", "signed long int", "long", "long int"]],
  [types.size, ["size_t"]],
  [types.ssize, ["ssize_t"]],
  [types.string, ["char*"]]
];
function bufferToString(buf) {
  return ffiInt.getCString(ffiInt.getArrayBufPtr(buf), buf.length);
}
var Pointer = class {
  constructor(addr, level, type) {
    this._type = type;
    this._level = level;
    this._addr = addr;
  }
  get addr() {
    return this._addr;
  }
  get level() {
    return this._level;
  }
  get type() {
    return this._type;
  }
  get isNull() {
    return this._addr === 0n;
  }
  deref() {
    if (this.level === 1) {
      const addr = this._addr;
      const buf = ffiInt.ptrToBuffer(addr, this._type.size);
      return this._type.fromBuffer(buf, {});
    } else {
      const addr = ffiInt.derefPtr(this._addr, 1);
      return new Pointer(addr, this._level - 1, this._type);
    }
  }
  derefAll() {
    const addr = ffiInt.derefPtr(this._addr, this._level - 1);
    const buf = ffiInt.ptrToBuffer(addr, this._type.size);
    return this._type.fromBuffer(buf, {});
  }
  static createRef(type, data) {
    const buf = type.toBuffer(data, {});
    return Pointer.createRefFromBuf(type, buf);
  }
  static createRefFromBuf(type, buf) {
    const addr = ffiInt.getArrayBufPtr(buf);
    const ptr = new Pointer(addr, 1, type);
    ptr._data = buf;
    return ptr;
  }
};
var PointerType = class extends AdvancedType {
  constructor(type, level = 1) {
    super(types.pointer || type, {
      name: (type.name || "void") + "*".repeat(level)
    });
    this._level = level;
    this._type = type;
  }
  toBuffer(data, ctx = {}) {
    if (data instanceof Pointer) {
      return types.pointer.toBuffer(data.addr, ctx);
    } else {
      return types.pointer.toBuffer(data, ctx);
    }
  }
  fromBuffer(buf) {
    return new Pointer(types.pointer.fromBuffer(buf), this._level, this._type);
  }
  get type() {
    return this._type;
  }
  get level() {
    return this._level;
  }
};
var StructType = class extends AdvancedType {
  constructor(fields, name) {
    const ffitype = new ffiInt.FfiType(...fields.map(([_f, t]) => t.ffiTypeStruct || t.ffiType || t));
    super(ffitype, {
      toBuffer: (obj, ctx) => {
        const buf = new Uint8Array(this._ffiType.size);
        const offsets = this._ffiType.offsets;
        for (let i = 0; i < offsets.length; i++) {
          const [field, type] = this._fields[i];
          if (obj.hasOwnProperty(field)) {
            let sbuf = type.toBuffer(obj[field], ctx);
            buf.set(sbuf, offsets[i]);
          }
        }
        return buf;
      },
      fromBuffer: (buf, ctx) => {
        let obj = {};
        const offsets = this._ffiType.offsets;
        for (let i = 0; i < offsets.length; i++) {
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
  get fields() {
    return this._fields;
  }
};
var ArrayType = class extends AdvancedType {
  constructor(type, length, name) {
    const ffitype = type.ffiType ? type.ffiType : type;
    const ffisz = ffitype.size;
    super(ffitype, {
      toBuffer: (arr, ctx) => {
        if (arr.length > this._length) {
          throw new RangeError("Array length exceeds type length");
        }
        const buf = new Uint8Array(ffisz * length);
        for (let i = 0; i < arr.length; i++) {
          let sbuf = type.fromBuffer(arr[i], ctx);
          buf.set(sbuf, i * ffisz);
        }
        return buf;
      },
      fromBuffer: (buf, ctx) => {
        let arr = [];
        for (let i = 0; i < this._length; i++) {
          arr[i] = type.fromBuffer(buf.slice(i * ffisz, (i + 1) * ffisz), ctx);
        }
        return arr;
      },
      name
    });
    this._type = type;
    this._length = length;
  }
  get ffiTypeStruct() {
    if (!this._ffiStruct) {
      this._ffiStruct = new ffiInt.FfiType(this._length, this._ffiType);
    }
    return this._ffiStruct;
  }
  get length() {
    return this._length;
  }
  get size() {
    return this._ffiType.size * this._length;
  }
};
var StaticStringType = class extends ArrayType {
  constructor(length, name) {
    super(types.sint8, length, name);
  }
  toBuffer(str, ctx = {}) {
    const txtBuf = new TextEncoder().encode(str);
    return super.toBuffer(txtBuf, ctx);
  }
  fromBuffer(buf) {
    return ffiInt.getCString(ffiInt.getArrayBufPtr(buf), buf.length);
  }
};
function errno() {
  return ffiInt.errno();
}
function strerror(err = errno()) {
  return ffiInt.strerror(err);
}
var JSCallback = class {
  constructor(rtype, argtypes, func) {
    this._func = (...args) => {
      const arr = [];
      const ctx = {};
      for (let i = 0; i < argtypes.length; i++) {
        ctx[i] = {};
        arr.push(argtypes[i].fromBuffer(args[i], ctx[i]));
      }
      const ret = func(...arr);
      return rtype.toBuffer(ret);
    };
    this._rtype = rtype;
    this._argtypes = argtypes;
    this._cif = new ffiInt.FfiCif(rtype.ffiType ?? rtype, ...argtypes.map((t) => t.ffiType ?? t));
    this._closure = new ffiInt.FfiClosure(this._cif, this._func);
  }
  get addr() {
    return this._closure.addr;
  }
};
var { parseCProto, astToLib } = init({ StructType, CFunction, PointerType });

// src/js/tjs/stream-utils.js
function silentClose(handle) {
  try {
    handle.close();
  } catch {
  }
}
var CHUNK_SIZE = 16640;
function readableStreamForHandle(handle) {
  return new ReadableStream({
    autoAllocateChunkSize: CHUNK_SIZE,
    type: "bytes",
    async pull(controller) {
      const buf = controller.byobRequest.view;
      try {
        const nread = await handle.read(buf);
        if (!nread) {
          silentClose(handle);
          controller.close();
          controller.byobRequest.respond(0);
        } else {
          controller.byobRequest.respond(nread);
        }
      } catch (e) {
        controller.error(e);
        silentClose(handle);
      }
    },
    cancel() {
      silentClose(handle);
    }
  });
}
function writableStreamForHandle(handle) {
  return new WritableStream({
    async write(chunk, controller) {
      try {
        await handle.write(chunk);
      } catch (e) {
        controller.error(e);
        silentClose(handle);
      }
    },
    close() {
      silentClose(handle);
    },
    abort() {
      silentClose(handle);
    }
  });
}

// src/js/tjs/fs.js
var core5 = globalThis.__bootstrap;
var kReadable = Symbol("kReadable");
var kWritable = Symbol("kWritable");
var fhProxyHandler = {
  get(target, prop) {
    switch (prop) {
      case "readable": {
        if (!target[kReadable]) {
          target[kReadable] = readableStreamForHandle(target);
        }
        return target[kReadable];
      }
      case "writable": {
        if (!target[kWritable]) {
          target[kWritable] = writableStreamForHandle(target);
        }
        return target[kWritable];
      }
      default: {
        if (typeof target[prop] === "function") {
          return (...args) => target[prop].apply(target, args);
        }
        return target[prop];
      }
    }
  }
};
async function open(path, mode) {
  const handle = await core5.open(path, mode);
  return new Proxy(handle, fhProxyHandler);
}
async function mkstemp(template) {
  const handle = await core5.mkstemp(template);
  return new Proxy(handle, fhProxyHandler);
}

// src/js/tjs/posix-socket.js
var core6 = globalThis.__bootstrap;
var posixSocket = core6.posix_socket;
var PosixSocket;
var _a2;
if (posixSocket) {
  PosixSocket = (_a2 = class {
    constructor(domain, type, protocol) {
      this._psock = new posixSocket.PosixSocket(domain, type, protocol);
      this._info = {
        socket: { domain, type, protocol }
      };
    }
    get info() {
      return this._info;
    }
    get fileno() {
      return this._psock.fileno;
    }
    get polling() {
      return this._psock.polling;
    }
    static createFromFD(fd) {
      return posixSocket.posix_socket_from_fd(fd);
    }
    bind(...args) {
      return this._psock.bind(...args);
    }
    connect(...args) {
      return this._psock.connect(...args);
    }
    listen(...args) {
      return this._psock.listen(...args);
    }
    accept(...args) {
      return this._psock.accept(...args);
    }
    sendmsg(...args) {
      return this._psock.sendmsg(...args);
    }
    recv(...args) {
      return this._psock.recv(...args);
    }
    recvmsg(...args) {
      return this._psock.recvmsg(...args);
    }
    close(...args) {
      return this._psock.close(...args);
    }
    setopt(...args) {
      return this._psock.setopt(...args);
    }
    getopt(...args) {
      return this._psock.getopt(...args);
    }
    read(...args) {
      return this._psock.read(...args);
    }
    write(...args) {
      return this._psock.write(...args);
    }
    poll(cbs) {
      this._cbs = {
        read: void 0,
        write: void 0,
        disconnect: void 0,
        prioritized: void 0,
        error: void 0,
        all: void 0
      };
      for (const k in this._cbs) {
        if (cbs[k]) {
          this._cbs[k] = cbs[k];
        }
      }
      this._handleEvent = (status, events) => {
        if (status !== 0) {
          if (this._cbs.error) {
            this._cbs.error(status, events);
          } else {
            console.error("uv_poll unhandled error:", status);
          }
        } else {
          this._cbs.all?.(events);
          if (events & _a2.pollEvents.READABLE && this._cbs.read) {
            this._cbs.read(events);
          }
          if (events & _a2.pollEvents.WRITABLE && this._cbs.write) {
            this._cbs.write(events);
          }
          if (events & _a2.pollEvents.DISCONNECT && this._cbs.disconnect) {
            this._cbs.disconnect(events);
          }
          if (events & _a2.pollEvents.PRIORITIZED && this._cbs.prioritized) {
            this._cbs.prioritized(events);
          }
        }
      };
      let mask = 0;
      if (cbs.all) {
        mask = _a2.pollEvents.READABLE | _a2.pollEvents.WRITABLE | _a2.pollEvents.DISCONNECT | _a2.pollEvents.PRIORITIZED;
      } else {
        if (cbs.read) {
          mask |= _a2.pollEvents.READABLE;
        }
        if (cbs.write) {
          mask |= _a2.pollEvents.WRITABLE;
        }
        if (cbs.disconnect) {
          mask |= _a2.pollEvents.DISCONNECT;
        }
        if (cbs.prioritized) {
          mask |= _a2.pollEvents.PRIORITIZED;
        }
      }
      this._psock.poll(mask, this._handleEvent);
    }
    stopPoll() {
      this._psock.pollStop();
    }
    static get sockaddrInSize() {
      return posixSocket.sizeof_struct_sockaddr;
    }
    static createSockaddrIn(ip, port) {
      return posixSocket.create_sockaddr_inet({ ip, port });
    }
    static indextoname(index) {
      return posixSocket.if_indextoname(index);
    }
    static nametoindex(name) {
      return posixSocket.if_nametoindex(name);
    }
    static checksum(buf) {
      return posixSocket.checksum(buf);
    }
  }, __publicField(_a2, "defines", Object.freeze(posixSocket.defines)), __publicField(_a2, "pollEvents", Object.freeze(posixSocket.uv_poll_event_bits)), _a2);
}

// src/js/tjs/signal.js
var core7 = globalThis.__bootstrap;
function signal(sig, handler) {
  const signum = core7.signals[sig];
  if (typeof signum === "undefined") {
    throw new Error(`invalid signal: ${sig}`);
  }
  return core7.signal(signum, handler);
}

// src/js/tjs/sockets.js
var core8 = globalThis.__bootstrap;
async function connect(transport, host, port, options = {}) {
  const addr = await prepareAddress(transport, host, port);
  switch (transport) {
    case "tcp": {
      const handle = new core8.TCP();
      if (options.bindAddr) {
        let flags2 = 0;
        if (options.ipv6Only) {
          flags2 |= core8.TCP_IPV6ONLY;
        }
        handle.bind(options.bindAddr, flags2);
      }
      await handle.connect(addr);
      return new Connection(handle);
    }
    case "pipe": {
      const handle = new core8.Pipe();
      await handle.connect(addr);
      return new Connection(handle);
    }
    case "udp": {
      const handle = new core8.UDP();
      if (options.bindAddr) {
        let flags2 = 0;
        if (options.ipv6Only) {
          flags2 |= core8.UDP_IPV6ONLY;
        }
        handle.bind(options.bindAddr, flags2);
      }
      await handle.connect(addr);
      return new DatagramEndpoint(handle);
    }
  }
}
async function listen(transport, host, port, options = {}) {
  const addr = await prepareAddress(transport, host, port);
  switch (transport) {
    case "tcp": {
      const handle = new core8.TCP();
      let flags2 = 0;
      if (options.ipv6Only) {
        flags2 |= core8.TCP_IPV6ONLY;
      }
      handle.bind(addr, flags2);
      handle.listen(options.backlog);
      return new Listener(handle);
    }
    case "pipe": {
      const handle = new core8.Pipe();
      handle.bind(addr);
      handle.listen(options.backlog);
      return new Listener(handle);
    }
    case "udp": {
      const handle = new core8.UDP();
      let flags2 = 0;
      if (options.reuseAddr) {
        flags2 |= core8.UDP_REUSEADDR;
      }
      if (options.ipv6Only) {
        flags2 |= core8.UDP_IPV6ONLY;
      }
      handle.bind(addr, flags2);
      return new DatagramEndpoint(handle);
    }
  }
}
async function prepareAddress(transport, host, port) {
  switch (transport) {
    case "tcp": {
      const opts = {
        socktype: tjs.SOCK_STREAM,
        protocol: tjs.IPPROTO_TCP
      };
      const r = await tjs.getaddrinfo(host ?? "0.0.0.0", port ?? 0, opts);
      return r[0];
    }
    case "pipe":
      return host;
    case "udp": {
      const opts = {
        socktype: tjs.SOCK_DGRAM,
        protocol: tjs.IPPROTO_UDP
      };
      const r = await tjs.getaddrinfo(host ?? "0.0.0.0", port ?? 0, opts);
      return r[0];
    }
    default:
      throw new Error("invalid transport");
  }
}
var kHandle = Symbol("kHandle");
var kLocalAddress = Symbol("kLocalAddress");
var kRemoteAddress = Symbol("kRemoteAddress");
var kReadable2 = Symbol("kReadable");
var kWritable2 = Symbol("kWritable");
var Connection = class {
  constructor(handle) {
    this[kHandle] = handle;
  }
  get localAddress() {
    if (!this[kLocalAddress]) {
      this[kLocalAddress] = this[kHandle].getsockname();
    }
    return this[kLocalAddress];
  }
  get remoteAddress() {
    if (!this[kRemoteAddress]) {
      this[kRemoteAddress] = this[kHandle].getpeername();
    }
    return this[kRemoteAddress];
  }
  get readable() {
    if (!this[kReadable2]) {
      this[kReadable2] = readableStreamForHandle(this[kHandle]);
    }
    return this[kReadable2];
  }
  get writable() {
    if (!this[kWritable2]) {
      this[kWritable2] = writableStreamForHandle(this[kHandle]);
    }
    return this[kWritable2];
  }
  read(buf) {
    return this[kHandle].read(buf);
  }
  write(buf) {
    return this[kHandle].write(buf);
  }
  setKeepAlive(enable = true) {
    this[kHandle].setKeepAlive(enable);
  }
  setNoDelay(enable = true) {
    this[kHandle].setNoDelay(enable);
  }
  shutdown() {
    this[kHandle].shutdown();
  }
  close() {
    this[kHandle].close();
  }
};
var Listener = class {
  constructor(handle) {
    this[kHandle] = handle;
  }
  get localAddress() {
    if (!this[kLocalAddress]) {
      this[kLocalAddress] = this[kHandle].getsockname();
    }
    return this[kLocalAddress];
  }
  async accept() {
    const handle = await this[kHandle].accept();
    if (typeof handle === "undefined") {
      return;
    }
    return new Connection(handle);
  }
  close() {
    this[kHandle].close();
  }
  [Symbol.asyncIterator]() {
    return this;
  }
  async next() {
    const value = await this.accept();
    return {
      value,
      done: typeof value === "undefined"
    };
  }
};
var DatagramEndpoint = class {
  constructor(handle) {
    this[kHandle] = handle;
  }
  recv(buf) {
    return this[kHandle].recv(buf);
  }
  send(buf, taddr) {
    return this[kHandle].send(buf, taddr);
  }
  get localAddress() {
    if (!this[kLocalAddress]) {
      this[kLocalAddress] = this[kHandle].getsockname();
    }
    return this[kLocalAddress];
  }
  get remoteAddress() {
    return this[kHandle].getpeername();
  }
  close() {
    this[kHandle].close();
  }
};

// src/js/tjs/stdio.js
var core9 = globalThis.__bootstrap;
var kStdioHandle = Symbol("kStdioHandle");
var kStdioHandleType = Symbol("kStdioHandleType");
var BaseIOStream = class {
  constructor(handle, type) {
    this[kStdioHandle] = handle;
    this[kStdioHandleType] = type;
  }
  get isTTY() {
    return this[kStdioHandleType] === "tty";
  }
};
var InputStream = class extends BaseIOStream {
  async read(buf) {
    return this[kStdioHandle].read(buf);
  }
  setRawMode(rawMode) {
    if (!this.isTTY) {
      throw new Error("not a TTY");
    }
    const ttyMode = rawMode ? core9.TTY.TTY_MODE_RAW : core9.TTY.TTY_MODE_NORMAL;
    this[kStdioHandle].setMode(ttyMode);
  }
};
var OutputStream = class extends BaseIOStream {
  async write(buf) {
    return this[kStdioHandle].write(buf);
  }
  get height() {
    if (!this.isTTY) {
      throw new Error("not a TTY");
    }
    return this[kStdioHandle].getWinSize().height;
  }
  get width() {
    if (!this.isTTY) {
      throw new Error("not a TTY");
    }
    return this[kStdioHandle].getWinSize().width;
  }
};
function createStdioStream(fd) {
  const isStdin = fd === core9.STDIN_FILENO;
  const StreamType = isStdin ? InputStream : OutputStream;
  const type = core9.guessHandle(fd);
  switch (type) {
    case "tty": {
      const handle = new core9.TTY(fd, isStdin);
      return new StreamType(handle, type);
    }
    case "pipe": {
      const handle = new core9.Pipe();
      handle.open(fd);
      return new StreamType(handle, type);
    }
    case "file": {
      const handle = core9.newStdioFile(pathByFd(fd), fd);
      return new StreamType(handle, type);
    }
    default:
      return void 0;
  }
}
function pathByFd(fd) {
  switch (fd) {
    case core9.STDIN_FILENO:
      return "<stdin>";
    case core9.STDOUT_FILENO:
      return "<stdout>";
    case core9.STDERR_FILENO:
      return "<stderr>";
    default:
      return "";
  }
}
function createStdin() {
  return createStdioStream(core9.STDIN_FILENO);
}
function createStdout() {
  return createStdioStream(core9.STDOUT_FILENO);
}
function createStderr() {
  return createStdioStream(core9.STDERR_FILENO);
}

// src/js/tjs/index.js
var core10 = globalThis.__bootstrap;
var tjs2 = /* @__PURE__ */ Object.create(null);
var noExport = [
  "STDIN_FILENO",
  "STDOUT_FILENO",
  "STDERR_FILENO",
  "TCP_IPV6ONLY",
  "UDP_IPV6ONLY",
  "UDP_REUSEADDR",
  "Pipe",
  "TCP",
  "TTY",
  "UDP",
  "Worker",
  "XMLHttpRequest",
  "clearInterval",
  "clearTimeout",
  "evalScript",
  "guessHandle",
  "hrtimeMs",
  "mkstemp",
  "newStdioFile",
  "open",
  "random",
  "setInterval",
  "setTimeout",
  "signal",
  "signals",
  "wasm",
  "posix_socket",
  "ffi"
];
for (const [key, value] of Object.entries(core10)) {
  if (noExport.includes(key)) {
    continue;
  }
  tjs2[key] = value;
}
tjs2.args = Object.freeze(core10.args);
tjs2.versions = Object.freeze(core10.versions);
Object.defineProperty(tjs2, "alert", {
  enumerable: true,
  configurable: false,
  writable: false,
  value: alert
});
Object.defineProperty(tjs2, "confirm", {
  enumerable: true,
  configurable: false,
  writable: false,
  value: confirm
});
Object.defineProperty(tjs2, "prompt", {
  enumerable: true,
  configurable: false,
  writable: false,
  value: prompt
});
Object.defineProperty(tjs2, "_evalScript", {
  enumerable: false,
  configurable: false,
  writable: false,
  value: core10.evalScript
});
Object.defineProperty(tjs2, "open", {
  enumerable: true,
  configurable: false,
  writable: false,
  value: open
});
Object.defineProperty(tjs2, "mkstemp", {
  enumerable: true,
  configurable: false,
  writable: false,
  value: mkstemp
});
Object.defineProperty(tjs2, "signal", {
  enumerable: true,
  configurable: false,
  writable: false,
  value: signal
});
Object.defineProperty(tjs2, "connect", {
  enumerable: true,
  configurable: false,
  writable: false,
  value: connect
});
Object.defineProperty(tjs2, "listen", {
  enumerable: true,
  configurable: false,
  writable: false,
  value: listen
});
Object.defineProperty(tjs2, "stdin", {
  enumerable: true,
  configurable: false,
  writable: false,
  value: createStdin()
});
Object.defineProperty(tjs2, "stdout", {
  enumerable: true,
  configurable: false,
  writable: false,
  value: createStdout()
});
Object.defineProperty(tjs2, "stderr", {
  enumerable: true,
  configurable: false,
  writable: false,
  value: createStderr()
});
Object.defineProperty(tjs2, "ffi", {
  enumerable: true,
  configurable: false,
  writable: false,
  value: ffi_exports
});
if (core10.posix_socket) {
  Object.defineProperty(tjs2, "PosixSocket", {
    enumerable: true,
    configurable: false,
    writable: false,
    value: PosixSocket
  });
}
Object.defineProperty(globalThis, "tjs", {
  enumerable: true,
  configurable: false,
  writable: false,
  value: Object.freeze(tjs2)
});
/*! queue-microtask. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */

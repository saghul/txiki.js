;; funcref-typed globals: one initialised to a function reference, one to null.

(module
  (func $ret42 (result i32) (i32.const 42))
  (func $ret7 (result i32) (i32.const 7))

  (global $g_func (export "g_func") (mut funcref) (ref.func $ret42))
  (global $g_null (export "g_null") (mut funcref) (ref.null func))

  (export "ret42" (func $ret42))
  (export "ret7" (func $ret7))

  (elem declare func $ret42 $ret7))

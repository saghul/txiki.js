;; Module with function imports

(module
  (import "env" "add" (func $add (param i32 i32) (result i32)))
  (import "env" "log" (func $log (param i32)))
  (import "math" "mul" (func $mul (param f64 f64) (result f64)))

  (global $last_logged (mut i32) (i32.const 0))
  (export "last_logged" (global $last_logged))

  (func (export "call_add") (param $a i32) (param $b i32) (result i32)
    (call $add (local.get $a) (local.get $b))
  )

  (func (export "call_log") (param $v i32)
    (global.set $last_logged (local.get $v))
    (call $log (local.get $v))
  )

  (func (export "call_mul") (param $a f64) (param $b f64) (result f64)
    (call $mul (local.get $a) (local.get $b))
  )

  (func (export "add_and_log") (param $a i32) (param $b i32) (result i32)
    (local $result i32)
    (local.set $result (call $add (local.get $a) (local.get $b)))
    (call $log (local.get $result))
    (local.get $result)
  )
)

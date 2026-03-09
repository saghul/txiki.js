;; Global operations

(module
  (global $g_i32_mut (export "g_i32_mut") (mut i32) (i32.const 42))
  (global $g_i32_const (export "g_i32_const") i32 (i32.const 100))
  (global $g_i64_mut (export "g_i64_mut") (mut i64) (i64.const 9007199254740993))
  (global $g_f32_mut (export "g_f32_mut") (mut f32) (f32.const 1.5))
  (global $g_f64_mut (export "g_f64_mut") (mut f64) (f64.const 3.14))

  (func (export "get_i32_mut") (result i32)
    (global.get $g_i32_mut)
  )
  (func (export "set_i32_mut") (param $v i32)
    (global.set $g_i32_mut (local.get $v))
  )
  (func (export "get_i64_mut") (result i64)
    (global.get $g_i64_mut)
  )
  (func (export "set_i64_mut") (param $v i64)
    (global.set $g_i64_mut (local.get $v))
  )
)

;; Module with global and memory imports

(module
  (import "env" "base_offset" (global $base_offset i32))
  (import "env" "scale" (global $scale f64))
  (import "env" "memory" (memory 1))

  (func (export "get_base_offset") (result i32)
    (global.get $base_offset)
  )

  (func (export "get_scale") (result f64)
    (global.get $scale)
  )

  (func (export "scaled_offset") (result f64)
    (f64.mul
      (f64.convert_i32_s (global.get $base_offset))
      (global.get $scale))
  )

  (func (export "mem_store") (param $addr i32) (param $val i32)
    (i32.store (local.get $addr) (local.get $val))
  )

  (func (export "mem_load") (param $addr i32) (result i32)
    (i32.load (local.get $addr))
  )
)

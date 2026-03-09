;; Module with exported funcref table

(module
  (table (export "tbl") 4 funcref)

  (func $add (param i32 i32) (result i32)
    (i32.add (local.get 0) (local.get 1))
  )

  (func $sub (param i32 i32) (result i32)
    (i32.sub (local.get 0) (local.get 1))
  )

  (func $mul (param i32 i32) (result i32)
    (i32.mul (local.get 0) (local.get 1))
  )

  ;; Initialize table: tbl[0]=add, tbl[1]=sub, tbl[2]=mul, tbl[3]=null
  (elem (i32.const 0) func $add $sub $mul)

  ;; Indirect call through table
  (func (export "call_indirect") (param $idx i32) (param $a i32) (param $b i32) (result i32)
    (call_indirect (param i32 i32) (result i32)
      (local.get $a) (local.get $b) (local.get $idx))
  )

  (export "add" (func $add))
  (export "sub" (func $sub))
)

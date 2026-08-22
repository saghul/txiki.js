;; One function exported under two names, also referenced by a funcref global
;; and a table slot: all of these must share a single JS identity.

(module
  (func $f (result i32) (i32.const 77))

  (table (export "tbl") 1 funcref)
  (global $g (export "g") (mut funcref) (ref.func $f))

  (export "name1" (func $f))
  (export "name2" (func $f))

  (elem (i32.const 0) func $f))

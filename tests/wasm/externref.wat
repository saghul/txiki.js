;; Module with externref table and globals

(module
  (table (export "refs") 4 externref)

  (global (export "ref_val") (mut externref) (ref.null extern))

  ;; Store externref in table
  (func (export "table_set") (param $idx i32) (param $val externref)
    (table.set 0 (local.get $idx) (local.get $val))
  )

  ;; Load externref from table
  (func (export "table_get") (param $idx i32) (result externref)
    (table.get 0 (local.get $idx))
  )

  ;; Store externref in global
  (func (export "set_ref") (param $val externref)
    (global.set 0 (local.get $val))
  )

  ;; Load externref from global
  (func (export "get_ref") (result externref)
    (global.get 0)
  )

  ;; Pass externref through (identity)
  (func (export "passthrough") (param $val externref) (result externref)
    (local.get $val)
  )
)

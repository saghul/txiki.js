;; Test all the f64 operators on major boundary values and all special
;; values (except comparison and bitwise operators, which are tested in
;; f64_bitwise.wast and f64_cmp.wast).

(module
  (func (export "add") (param $x f64) (param $y f64) (result f64) (f64.add (local.get $x) (local.get $y)))
  (func (export "sub") (param $x f64) (param $y f64) (result f64) (f64.sub (local.get $x) (local.get $y)))
  (func (export "mul") (param $x f64) (param $y f64) (result f64) (f64.mul (local.get $x) (local.get $y)))
  (func (export "div") (param $x f64) (param $y f64) (result f64) (f64.div (local.get $x) (local.get $y)))
  (func (export "sqrt") (param $x f64) (result f64) (f64.sqrt (local.get $x)))
  (func (export "min") (param $x f64) (param $y f64) (result f64) (f64.min (local.get $x) (local.get $y)))
  (func (export "max") (param $x f64) (param $y f64) (result f64) (f64.max (local.get $x) (local.get $y)))
  (func (export "ceil") (param $x f64) (result f64) (f64.ceil (local.get $x)))
  (func (export "floor") (param $x f64) (result f64) (f64.floor (local.get $x)))
  (func (export "trunc") (param $x f64) (result f64) (f64.trunc (local.get $x)))
  (func (export "nearest") (param $x f64) (result f64) (f64.nearest (local.get $x)))
)

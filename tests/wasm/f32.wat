;; Test all the f32 operators on major boundary values and all special
;; values (except comparison and bitwise operators, which are tested in
;; f32_bitwise.wast and f32_cmp.wast).

(module
  (func (export "add") (param $x f32) (param $y f32) (result f32) (f32.add (local.get $x) (local.get $y)))
  (func (export "sub") (param $x f32) (param $y f32) (result f32) (f32.sub (local.get $x) (local.get $y)))
  (func (export "mul") (param $x f32) (param $y f32) (result f32) (f32.mul (local.get $x) (local.get $y)))
  (func (export "div") (param $x f32) (param $y f32) (result f32) (f32.div (local.get $x) (local.get $y)))
  (func (export "sqrt") (param $x f32) (result f32) (f32.sqrt (local.get $x)))
  (func (export "min") (param $x f32) (param $y f32) (result f32) (f32.min (local.get $x) (local.get $y)))
  (func (export "max") (param $x f32) (param $y f32) (result f32) (f32.max (local.get $x) (local.get $y)))
  (func (export "ceil") (param $x f32) (result f32) (f32.ceil (local.get $x)))
  (func (export "floor") (param $x f32) (result f32) (f32.floor (local.get $x)))
  (func (export "trunc") (param $x f32) (result f32) (f32.trunc (local.get $x)))
  (func (export "nearest") (param $x f32) (result f32) (f32.nearest (local.get $x)))
)

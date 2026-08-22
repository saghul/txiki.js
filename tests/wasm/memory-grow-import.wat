;; Grows linear memory with the `memory.grow` opcode and then re-enters JS via
;; an imported function within the same call. Used to exercise the cached
;; memory.buffer detach at the import trampoline (a mid-call grow relocates and
;; frees the old base before JS runs).

(module
  (import "env" "cb" (func $cb))
  (memory (export "memory") 1)
  (func (export "run")
    (drop (memory.grow (i32.const 16)))
    (call $cb)))

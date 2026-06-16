WASM_SRC=oxc-transpiler
WASM_TARGET=wasm32-wasip1
WASM_DIR=$(WASM_SRC)/target/$(WASM_TARGET)/release
WASM_OUT=$(WASM_DIR)/oxc_transpiler.wasm
EMBED_DIR=../src/bundles/typescript
EMBED_OUT=$(EMBED_DIR)/transpiler.c

.PHONY: all wasm embed clean

all: wasm

wasm:
	cd $(WASM_SRC) && cargo build --target $(WASM_TARGET) --release

embed: wasm $(EMBED_OUT)

$(EMBED_OUT): $(WASM_OUT)
	@mkdir -p $(EMBED_DIR)
	xxd -i $< > $@

clean:
	cd $(WASM_SRC) && cargo clean
	rm -rf $(EMBED_DIR)

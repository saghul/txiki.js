WASM_TARGET=wasm32-wasip1
WASM_DIR=target/$(WASM_TARGET)/release
WASM_OUT=$(WASM_DIR)/oxc_transpiler.wasm
EMBED_DIR=../../src/bundles/typescript
EMBED_OUT=$(EMBED_DIR)/transpiler.c
TJS_VERSION:=$(shell grep 'VERSION_MAJOR\|VERSION_MINOR\|VERSION_PATCH' ../../CMakeLists.txt | tr '\n' ' ' | sed 's/.*VERSION_MAJOR \([0-9]*\).*VERSION_MINOR \([0-9]*\).*VERSION_PATCH \([0-9]*\).*/\1.\2.\3/')
TJS_HOME:=$(HOME)/.tjs/typescript/$(TJS_VERSION)

.PHONY: all wasm embed install clean

all: wasm

wasm:
	cargo build --target $(WASM_TARGET) --release

embed: wasm $(EMBED_OUT)

$(EMBED_OUT): $(WASM_OUT)
	@mkdir -p $(EMBED_DIR)
	xxd -i $< > $@

install: wasm
	@mkdir -p $(TJS_HOME)
	cp $(WASM_OUT) $(TJS_HOME)/oxc_transpiler.wasm
	@echo "Installed oxc_transpiler.wasm to $(TJS_HOME)/"

clean:
	cargo clean
	rm -rf $(EMBED_DIR)

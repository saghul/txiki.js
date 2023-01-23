BUILD_DIR=build
BUILDTYPE?=Release

QJSC=$(BUILD_DIR)/qjsc
STDLIB_MODULES=$(wildcard src/js/stdlib/*.js)

all: build

build: $(BUILD_DIR)/Makefile
	cmake --build $(BUILD_DIR) -j $(shell nproc)

$(BUILD_DIR)/qjsc: $(BUILD_DIR)/Makefile
	cmake --build $(BUILD_DIR) --target qjsc -j $(shell nproc)

src/bundles/js/core/core.js: src/js/core/*.js src/js/core/polyfills/*.js src/js/core/tjs/*.js
	npx esbuild src/js/core/index.js \
		--bundle \
		--outfile=$@ \
		--target=es2020 \
		--platform=neutral \
		--format=esm \
		--main-fields=main,module \
		--external:tjs:*

src/bundles/c/core/core.c: $(QJSC) src/bundles/js/core/core.js
	@mkdir -p $(basename $(dir $@))
	$(BUILD_DIR)/qjsc -m \
		-o $@ \
		-n "core.js" \
		-p tjs__ \
		src/bundles/js/core/core.js

src/bundles/c/core/run-main.c: $(QJSC) src/js/run-main.js
	@mkdir -p $(basename $(dir $@))
	$(BUILD_DIR)/qjsc -m \
		-o $@ \
		-n "run-main.js" \
		-p tjs__ \
		src/js/run-main.js

core: src/bundles/c/core/core.c src/bundles/c/core/run-main.c

src/bundles/c/stdlib/%.c: $(QJSC) src/bundles/js/stdlib/%.js
	@mkdir -p $(basename $(dir $@))
	$(BUILD_DIR)/qjsc -m \
		-o $@ \
		-n "tjs:$(basename $(notdir $@))" \
		-p tjs__ \
		src/bundles/js/stdlib/$(basename $(notdir $@)).js

src/bundles/js/stdlib/%.js: src/js/stdlib/*.js src/js/stdlib/ffi/*.js
	npx esbuild src/js/stdlib/$(notdir $@) \
		--bundle \
		--outfile=$@ \
		--target=es2020 \
		--platform=neutral \
		--format=esm \
		--main-fields=main,module

src/bundles/c/stdlib/%.c: $(QJSC) src/bundles/js/stdlib/%.js
	@mkdir -p $(basename $(dir $@))
	$(BUILD_DIR)/qjsc -m \
		-o $@ \
		-n "tjs:$(basename $(notdir $@))" \
		-p tjs__ \
		src/bundles/js/stdlib/$(basename $(notdir $@)).js

stdlib: $(addprefix src/bundles/c/stdlib/, $(patsubst %.js, %.c, $(notdir $(STDLIB_MODULES))))

js: core stdlib

$(BUILD_DIR)/Makefile:
	@mkdir -p $(BUILD_DIR)
	cd $(BUILD_DIR); cmake ../ -DCMAKE_BUILD_TYPE=$(BUILDTYPE)

install:
	cmake --build $(BUILD_DIR) --target install

clean:
	cmake --build $(BUILD_DIR) --target clean

debug:
	BUILDTYPE=Debug $(MAKE)

distclean:
	@rm -rf $(BUILD_DIR)
	@rm -rf src/bundles/js/

format:
	clang-format -i src/*.{c,h}

test:
	./$(BUILD_DIR)/tjs test tests/

test-advanced:
	cd tests/advanced && npm install
	./$(BUILD_DIR)/tjs test tests/advanced/

.PRECIOUS: src/bundles/js/core/%.js src/bundles/js/stdlib/%.js
.PHONY: all build js debug install clean distclean format test test-advanced core stdlib

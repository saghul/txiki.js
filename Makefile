BUILD_DIR=build
BUILDTYPE?=Release
JOBS?=$(shell getconf _NPROCESSORS_ONLN)

TJS=$(BUILD_DIR)/tjs
QJSC=$(BUILD_DIR)/tjsc
STDLIB_MODULES=$(wildcard src/js/stdlib/*.js)
ESBUILD?=npx esbuild
ESBUILD_PARAMS_COMMON=--target=es2022 --platform=neutral --format=esm --main-fields=main,module

all: $(TJS)

$(BUILD_DIR):
	cmake -B $(BUILD_DIR) -DCMAKE_BUILD_TYPE=$(BUILDTYPE)

$(TJS): $(BUILD_DIR)
	cmake --build $(BUILD_DIR) -j $(JOBS)

$(QJSC): $(BUILD_DIR)
	cmake --build $(BUILD_DIR) --target tjsc -j $(JOBS)

src/bundles/js/core/polyfills.js: src/js/polyfills/*.js
	$(ESBUILD) src/js/polyfills/index.js \
		--bundle \
		--outfile=$@ \
		--minify \
		$(ESBUILD_PARAMS_COMMON)

src/bundles/c/core/polyfills.c: $(QJSC) src/bundles/js/core/polyfills.js
	@mkdir -p $(basename $(dir $@))
	$(QJSC) -m \
		-o $@ \
		-n "polyfills.js" \
		-p tjs__ \
		src/bundles/js/core/polyfills.js

src/bundles/js/core/core.js: src/js/core/*.js
	$(ESBUILD) src/js/core/index.js \
		--bundle \
		--outfile=$@ \
		--minify \
		--external:tjs:* \
		$(ESBUILD_PARAMS_COMMON)

src/bundles/c/core/core.c: $(QJSC) src/bundles/js/core/core.js
	@mkdir -p $(basename $(dir $@))
	$(QJSC) -m \
		-o $@ \
		-n "core.js" \
		-p tjs__ \
		src/bundles/js/core/core.js

src/bundles/js/core/run-main.js: src/js/run-main/*.js
	$(ESBUILD) src/js/run-main/index.js \
		--bundle \
		--outfile=$@ \
		--minify \
		--external:tjs:* \
		$(ESBUILD_PARAMS_COMMON)

src/bundles/c/core/run-main.c: $(QJSC) src/bundles/js/core/run-main.js
	@mkdir -p $(basename $(dir $@))
	$(QJSC) -m \
		-o $@ \
		-n "run-main.js" \
		-p tjs__ \
		src/bundles/js/core/run-main.js

core: src/bundles/c/core/polyfills.c src/bundles/c/core/core.c src/bundles/c/core/run-main.c

src/bundles/c/stdlib/%.c: $(QJSC) src/bundles/js/stdlib/%.js
	@mkdir -p $(basename $(dir $@))
	$(QJSC) -m \
		-o $@ \
		-n "tjs:$(basename $(notdir $@))" \
		-p tjs__ \
		src/bundles/js/stdlib/$(basename $(notdir $@)).js

src/bundles/js/stdlib/%.js: src/js/stdlib/*.js src/js/stdlib/ffi/*.js
	$(ESBUILD) src/js/stdlib/$(notdir $@) \
		--bundle \
		--outfile=$@ \
		$(ESBUILD_PARAMS_COMMON)

src/bundles/c/stdlib/%.c: $(QJSC) src/bundles/js/stdlib/%.js
	@mkdir -p $(basename $(dir $@))
	$(QJSC) -m \
		-o $@ \
		-n "tjs:$(basename $(notdir $@))" \
		-p tjs__ \
		src/bundles/js/stdlib/$(basename $(notdir $@)).js

stdlib: $(addprefix src/bundles/c/stdlib/, $(patsubst %.js, %.c, $(notdir $(STDLIB_MODULES))))

js: core stdlib

install: $(TJS)
	cmake --build $(BUILD_DIR) --target install

clean: $(BUILD_DIR)
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
.PHONY: all js debug install clean distclean format test test-advanced core stdlib $(TJS)

BUILD_DIR=build
BUILDTYPE?=Release
MINIFYJS=--minify
EXCLUDED_POLIFILLS=$(addprefix src/js/core/polyfills/, path-utils.c path-posix.c path-win32.c event-target-polyfill.c base.c)
EXCLUDED_CORE=$(addprefix src/js/core/tjs/, stdio.c index.c)
POLYFILL_SOURCES=$(filter-out $(EXCLUDED_POLIFILLS), $(patsubst %.js, %.c, $(wildcard src/js/core/polyfills/*.js)))
CORE_SOURCES=$(filter-out $(EXCLUDED_CORE), $(patsubst %.js, %.c, $(wildcard src/js/core/tjs/*.js)))
STD_SOURCES=$(filter-out src/js/stdlib/index.c, $(patsubst %.js, %.c, $(wildcard src/js/stdlib/*.js)))
ESBUILD_ARGS=$(MINIFYJS) --bundle --target=es2020 --platform=neutral --format=esm --main-fields=main,module

ifdef OS
   BUILD_PLATFORM=win32a
else
   BUILD_PLATFORM=posix
endif

all: js build

debug1: 
	echo $(POLYFILL_SOURCES)

build: $(BUILD_DIR)/Makefile
	cmake --build $(BUILD_DIR) -j $(shell nproc)

$(BUILD_DIR)/qjsc: $(BUILD_DIR)/Makefile
	cmake --build $(BUILD_DIR) --target qjsc -j $(shell nproc)

src/js/run-main.c: $(BUILD_DIR)/qjsc src/js/run-main.js
	$(BUILD_DIR)/qjsc -m -o src/js/run-main.c -n run-main.js -p tjs__ src/js/run-main.js

src/js/core.js:
	npm run esbuild -- src/js/core/tjs/index.js --outfile=$@ $(ESBUILD_ARGS) --external:@tjs/*

src/js/core.c: $(BUILD_DIR)/qjsc src/js/core.js
	$(BUILD_DIR)/qjsc -m -o src/js/core.c -n core.js -p tjs__ src/js/core.js

js: $(STD_SOURCES) $(CORE_SOURCES) $(POLYFILL_SOURCES) src/js/run-main.c src/js/precompiled.c src/js/core.c

jsclean:
	@rm -rf bundles src/js/core/tjs/*.c src/js/core/polyfills/*.c src/js/stdlib/*.c src/js/precompiled.c src/js/core.c src/js/core.js

bundles/stdlib/%.js:
	npm run esbuild -- src/js/stdlib/$(notdir $@) --outfile=$@ $(ESBUILD_ARGS) --alias:path=./src/js/core/polyfills/path-${BUILD_PLATFORM}.js

bundles/core/polyfills/%.js:
	npm run esbuild -- src/js/core/polyfills/$(notdir $@) --outfile=$@ $(ESBUILD_ARGS) --external:@tjs/*

bundles/core/tjs/%.js:
	npm run esbuild -- src/js/core/tjs/$(notdir $@) --outfile=$@ $(ESBUILD_ARGS) --external:@tjs/*

src/js/stdlib/%.c: $(BUILD_DIR)/qjsc bundles/stdlib/%.js
	$(BUILD_DIR)/qjsc -m -o $@ -n "@tjs/std/$(basename $(notdir $@))" -p tjs__std_ $(word 2,$^)

src/js/core/tjs/%.c: $(BUILD_DIR)/qjsc bundles/core/tjs/%.js
	$(BUILD_DIR)/qjsc -m -o $@ -n "@tjs/$(basename $(notdir $@))" -p tjs__core_ $(word 2,$^)

src/js/core/polyfills/%.c: $(BUILD_DIR)/qjsc bundles/core/polyfills/%.js
	$(BUILD_DIR)/qjsc -m -o $@ -n "@tjs/internal/polyfill/$(basename $(notdir $@))" -p tjs__internal_polyfill_ $(word 2,$^)


src/js/precompiled.c: gen-precompiled.sh $(STD_SOURCES) $(POLYFILL_SOURCES) $(CORE_SOURCES)
	./gen-precompiled.sh $@ $(STD_SOURCES) $(POLYFILL_SOURCES) $(CORE_SOURCES)

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

format:
	clang-format -i src/*.{c,h}

test-simple:
	make jsclean && make js -j8 && make && ./build/tjs test.js

test:
	./$(BUILD_DIR)/tjs test tests/

test-advanced:
	cd tests/advanced && npm install
	./$(BUILD_DIR)/tjs test tests/advanced/

.PRECIOUS: bundles/stdlib/%.js bundles/core/tjs/%.js bundles/core/polyfills/%.js

.PHONY: all build test-simple js debug install jsclean clean distclean format test test-advanced debug1

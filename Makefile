BUILD_DIR=build
BUILDTYPE?=Release

all: build

build: $(BUILD_DIR)/Makefile
	cmake --build $(BUILD_DIR) -j $(shell nproc)

$(BUILD_DIR)/qjsc: $(BUILD_DIR)/Makefile
	cmake --build $(BUILD_DIR) --target qjsc -j $(shell nproc)

src/js/core.js: src/js/core/*.js src/js/core/polyfills/*.js src/js/core/tjs/*.js
	npm run build-core

src/js/std.js: src/js/stdlib/*.js
	npm run build-stdlib

src/js/core.c: $(BUILD_DIR)/qjsc src/js/core.js
	$(BUILD_DIR)/qjsc -m -o src/js/core.c -n core.js -p tjs__ src/js/core.js

src/js/std.c: $(BUILD_DIR)/qjsc src/js/std.js
	$(BUILD_DIR)/qjsc -m -o src/js/std.c -n "@tjs/std" -p tjs__ src/js/std.js

src/js/run-main.c: $(BUILD_DIR)/qjsc src/js/run-main.js
	$(BUILD_DIR)/qjsc -m -o src/js/run-main.c -n run-main.js -p tjs__ src/js/run-main.js

js: src/js/core.c src/js/std.c src/js/run-main.c

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

test:
	./$(BUILD_DIR)/tjs test tests/

test-advanced:
	cd tests/advanced && npm install
	./$(BUILD_DIR)/tjs test tests/advanced/

.PHONY: all build js debug install clean distclean format test test-advanced

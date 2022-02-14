BUILD_DIR=build
BUILDTYPE?=Release

all: build

build:
	@mkdir -p $(BUILD_DIR)
	cd $(BUILD_DIR); cmake ../ -DCMAKE_BUILD_TYPE=$(BUILDTYPE)
	cmake --build $(BUILD_DIR)

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
	./$(BUILD_DIR)/tjs tests/run.js tests/

test-advanced:
	cd tests/advanced && npm install
	./$(BUILD_DIR)/tjs tests/run.js tests/advanced/

.PHONY: all build debug install clean distclean format test test-advanced

NINJA?=ninja

BUILD_DIR=build
CMAKE_MK=$(BUILD_DIR)/Makefile

BUILDTYPE?=Release

all: build

build: $(CMAKE_MK)
	$(NINJA) -C $(BUILD_DIR)

$(CMAKE_MK):
	@mkdir -p $(BUILD_DIR)
	cd $(BUILD_DIR); cmake ../ -DCMAKE_BUILD_TYPE=$(BUILDTYPE) -GNinja

install:
	@$(NINJA) -C $(BUILD_DIR) install

clean:
	@$(NINJA) -C $(BUILD_DIR) clean

distclean:
	@rm -rf $(BUILD_DIR)

format:
	clang-format -i src/*.{c,h}

test:
	./$(BUILD_DIR)/tjs tests/run.js

.PHONY: all build install clean distclean format test

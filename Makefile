MAKE?=make

CMAKE_MK=build/Makefile
BUILT=build/BUILT

BUILDTYPE?=Release
PREFIX?=/usr/local

all: build

build: $(CMAKE_MK)
	ninja -C build
	@touch $(BUILT)

$(CMAKE_MK):
	@mkdir -p build
	cd build; cmake ../ -DCMAKE_BUILD_TYPE=$(BUILDTYPE) -DCMAKE_INSTALL_PREFIX=$(PREFIX) -GNinja

install: $(BUILT)
	@$(MAKE) -C build install

clean:
	@$(MAKE) -C build clean

distclean:
	@rm -rf build

format:
	clang-format -i src/**/*.{c,h} src/*.{c,h}

test:
	./build/quv tests/run.js

.PHONY: all build install clean distclean format test

MAKE?=make

CMAKE_MK=build/Makefile
BUILT=build/BUILT

BUILDTYPE?=Release
PREFIX?=/usr/local
VERBOSE?=

all: build

build: $(CMAKE_MK)
	@$(MAKE) -C build VERBOSE=$(VERBOSE)
	touch $(BUILT)

$(CMAKE_MK):
	@mkdir -p build
	cd build; cmake ../ -DCMAKE_BUILD_TYPE=$(BUILDTYPE) -DCMAKE_INSTALL_PREFIX=$(PREFIX)

install: $(BUILT)
	@$(MAKE) -C build install

clean:
	@$(MAKE) -C build clean

distclean:
	@rm -rf build

.PHONY: all build install clean distclean

# Windows support

Windows support it's currently considered beta. Tests do pass, but building it is not
as easy as it should be.

## Building

Building has only been tested in 64bit Windows.

### Prerequisites

First make sure you have [MSYS2] installed. The `mingw64` and `clang64` environments are currently tested.

Then install the required dependencies:

```bash
pacman -S git make pactoys
pacboy -S curl-winssl:p toolchain:p cmake:p ninja:p
```

### Build

These commands must be run in a MinGW64 or clang64 shell.

```bash
make
```

This will build the executable just like on Unix. Note that at this point there are a number of dynamically linked libraries, so if you want to use the executable on a different system you'll need to copy those too. Check the list with `ldd build/tjs.exe`.

## Running the tests

Make sure these commands are run from Windows Terminal (mintty, what MSYS2 provides is not supported).

```bash
make test
```

[MSYS2]: https://www.msys2.org

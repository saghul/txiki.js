# Windows support

Windows support it's currently experimental. Tests do pass, but building is not
as easy as it should be.

## Building

Building has only been tested in 64bits.

### Prerequisites

- [MSYS2]
- MSYS2 packages: git make mingw-w64-x86_64-clang mingw-w64-x86_64-cmake mingw-w64-x86_64-ninja

### Build

These commands must be run in the "MSYS2 MinGW 64-bit" shell.

```bash
make
curl --remote-name --time-cond cacert.pem https://curl.haxx.se/ca/cacert.pem
cp cacert.pem build
ldd build/tjs.exe | grep mingw | awk '{ print $3 }' | xargs -I{} cp -u {} build/
```

This will build the executable and copy all the required filed (DLLs and CA bundle) into the build directory.

## Running the tests

Make sure these commands are run from PowerShell or Windows Terminal (mintty, what MSYS2 uses is not yet supported).

```
.\build\tjs.exe .\tests\run.js
```

[MSYS2]: https://www.msys2.org

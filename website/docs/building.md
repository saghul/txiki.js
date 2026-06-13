---
sidebar_position: 2
title: Building
---

# Building

[CMake](https://cmake.org/) is necessary.

:::note
The txiki.js build depends on a number of git submodules. If you didn't already clone the repository recursively, make sure you initialize these submodules with `git submodule update --init` before proceeding to the build.
:::

## GNU/Linux

Install dependencies (`build-essential`, `cmake`, `libffi-dev`):

```bash
# On Debian / Ubuntu
# version `>= 24.04` required
sudo apt install build-essential cmake libffi-dev
```

```bash
# Amazon Linux, al.2023
dnf install -y git gcc14 gcc14-c++ cmake libffi-devel libatomic
ln -s /usr/bin/gcc14-gcc /usr/bin/cc
ln -s /usr/bin/gcc14-c++ /usr/bin/c++
```

## macOS

Install dependencies (`cmake`):

```bash
brew install cmake
```

## Unix systems

```bash
# Get the code
git clone --recursive https://github.com/saghul/txiki.js --shallow-submodules && cd txiki.js
# Compile it!
make
# Run the REPL
./build/tjs
```

## Windows

Building requires Visual Studio 2022 (or the Build Tools) and [vcpkg](https://vcpkg.io/).

### Prerequisites

1. Install [Visual Studio 2022](https://visualstudio.microsoft.com/) with the "Desktop development with C++" workload,
   or install the [Build Tools for Visual Studio 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022).

2. Install and bootstrap [vcpkg](https://vcpkg.io/en/getting-started.html):

```powershell
git clone https://github.com/microsoft/vcpkg.git
cd vcpkg
.\bootstrap-vcpkg.bat
```

3. Install the required dependencies:

```powershell
.\vcpkg install libffi
```

### Build

Run these commands from a "Developer PowerShell for VS 2022" or "x64 Native Tools Command Prompt":

```powershell
cmake -B build -DCMAKE_TOOLCHAIN_FILE=path/to/vcpkg/scripts/buildsystems/vcpkg.cmake
cmake --build build --config Release
```

The executable will be at `build\Release\tjs.exe`.

### Running the tests

```powershell
.\build\Release\tjs.exe test tests/
```

## Optional features

WebAssembly support can be disabled at build time to produce a smaller binary.

| CMake option          | Default | Effect                    | Approx savings |
|-----------------------|---------|---------------------------|----------------|
| `BUILD_WITH_WASM=OFF` | ON      | Remove WebAssembly / WASI | ~0.4 MB        |

When disabled, the `WebAssembly` global is not installed and the `tjs:wasi` module is
not available. The active set of feature flags is exposed to JS via `tjs.engine.features`
(e.g. `tjs.engine.features.wasm`).

Unix/macOS example:

```bash
BUILD_WITH_WASM=OFF make
```

Direct CMake example:

```bash
cmake -B build-nowasm -DCMAKE_BUILD_TYPE=Release -DBUILD_WITH_WASM=OFF
cmake --build build-nowasm
```

## Size-optimized builds

These flags shrink the binary **without removing any feature** — they only change how the
code is compiled and linked. They are independent of one another and can be combined.

| CMake option                | Default | Effect                                              |
|-----------------------------|---------|-----------------------------------------------------|
| `BUILD_WITH_STRIP=ON`       | OFF     | Strip the symbol table from the binary after linking |
| `BUILD_WITH_LTO=ON`         | OFF     | Enable link-time optimization (smaller/faster code, slower link) |
| `BUILD_WITH_GC_SECTIONS=ON` | OFF     | Per-function/data sections plus linker dead-code stripping |
| `BUILDTYPE=MinSizeRel`      | —       | Standard CMake build type that optimizes for size (`-Os`) |

Notes:

- `BUILD_WITH_STRIP` runs the toolchain's `strip` as a post-build step. It is skipped where
  `CMAKE_STRIP` is unset (e.g. MSVC).
- `BUILD_WITH_LTO` falls back to a warning (not an error) if the toolchain cannot do
  interprocedural optimization.
- `BUILD_WITH_GC_SECTIONS` maps to `-Wl,--gc-sections` (GNU/lld), `-Wl,-dead_strip` (Apple), or
  `/OPT:REF /OPT:ICF` (MSVC).
- `BUILDTYPE=MinSizeRel` needs no extra flag; it is a standard CMake build type.

Unix/macOS example combining all four:

```bash
BUILD_WITH_STRIP=ON BUILD_WITH_LTO=ON BUILD_WITH_GC_SECTIONS=ON BUILDTYPE=MinSizeRel make
```

Direct CMake example:

```bash
cmake -B build-min -DCMAKE_BUILD_TYPE=MinSizeRel \
  -DBUILD_WITH_STRIP=ON -DBUILD_WITH_LTO=ON -DBUILD_WITH_GC_SECTIONS=ON
cmake --build build-min
```

## Customizing the build

If you are making a custom build and are modifying any of the JS files that are part of the runtime, you'll need to regenerate the C code for them, so your changes become part of the build.

```bash
# First install the JS dependencies
npm install
# Now bundle the code and compile it into C source files
make js
```

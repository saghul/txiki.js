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

Several subsystems can be disabled at build time to produce smaller binaries.
Flags are independent and composable.

| CMake option                | Default | Effect                               | Approx savings |
|-----------------------------|---------|--------------------------------------|----------------|
| `BUILD_WITH_WASM=OFF`       | ON      | Remove WebAssembly / WASI            | ~0.4 MB        |
| `BUILD_WITH_SQLITE=OFF`     | ON      | Remove SQLite and REPL history       | ~1.6 MB        |
| `BUILD_WITH_TLS=OFF`        | ON      | Remove HTTPS / WSS (WebCrypto stays) | ~0.7 MB        |
| `BUILD_WITH_STRIP=ON`       | OFF     | Strip debug symbols after linking    | ~0.3-0.5 MB    |
| `BUILD_WITH_LTO=ON`         | OFF     | Link-time optimisation               | ~0.3 MB        |
| `BUILD_WITH_GC_SECTIONS=ON` | OFF     | Dead-code elimination via section GC | ~0.3-0.9 MB    |
| `BUILDTYPE=MinSizeRel`      | —       | Optimise for size (`-Os`)            | ~0.2-0.4 MB    |

Unix/macOS example:

```bash
BUILD_WITH_WASM=OFF BUILD_WITH_SQLITE=OFF make
```

Direct CMake example:

```bash
cmake -B build-slim \
  -DCMAKE_BUILD_TYPE=MinSizeRel \
  -DBUILD_WITH_WASM=OFF \
  -DBUILD_WITH_SQLITE=OFF \
  -DBUILD_WITH_TLS=OFF \
  -DBUILD_WITH_STRIP=ON
cmake --build build-slim
```

Combining all flags reduces the default ~6.1 MB binary to ~2.1 MB (macOS arm64).

## Customizing the build

If you are making a custom build and are modifying any of the JS files that are part of the runtime, you'll need to regenerate the C code for them, so your changes become part of the build.

```bash
# First install the JS dependencies
npm install
# Now bundle the code and compile it into C source files
make js
```

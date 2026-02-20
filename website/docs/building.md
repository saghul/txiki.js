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
sudo apt install build-essential cmake libffi-dev
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

## Customizing the build

If you are making a custom build and are modifying any of the JS files that are part of the runtime, you'll need to regenerate the C code for them, so your changes become part of the build.

```bash
# First install the JS dependencies
npm install
# Now bundle the code and compile it into C source files
make js
```

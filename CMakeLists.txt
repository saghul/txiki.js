cmake_minimum_required(VERSION 3.14)

project(tjs LANGUAGES C)

include(ExternalProject)
include(GNUInstallDirs)

if (NOT CMAKE_BUILD_TYPE)
    message(STATUS "No build type selected, default to Release")
    set(CMAKE_BUILD_TYPE "Release")
endif()
message(STATUS "Building in ${CMAKE_BUILD_TYPE} mode")
message(STATUS "Building with ${CMAKE_C_COMPILER_ID} ${CMAKE_C_COMPILER_VERSION} on ${CMAKE_SYSTEM}")

set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS ON)
set(CMAKE_C_STANDARD 11)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

list(APPEND tjs_cflags -Wall -g)
if (CMAKE_BUILD_TYPE MATCHES "Debug")
    list(APPEND tjs_cflags -ggdb -O0 -fno-omit-frame-pointer)
endif()

set(TJS__VERSION_MAJOR 24)
set(TJS__VERSION_MINOR 6)
set(TJS__VERSION_PATCH 0)
set(TJS__VERSION_SUFFIX "")
configure_file(
    "${CMAKE_CURRENT_SOURCE_DIR}/src/version.h.in"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/version.h"
)

macro(cpr_option OPTION_NAME OPTION_TEXT OPTION_DEFAULT)
    option(${OPTION_NAME} ${OPTION_TEXT} ${OPTION_DEFAULT})
    if(DEFINED ENV{${OPTION_NAME}})
        # Allow setting the option through an environment variable
        set(${OPTION_NAME} $ENV{${OPTION_NAME}})
    endif()
    if(${OPTION_NAME})
        add_definitions(-D${OPTION_NAME})
    endif()
    message(STATUS "  ${OPTION_NAME}: ${${OPTION_NAME}}")
endmacro()

cpr_option(BUILD_WITH_MIMALLOC "If ON (default), build with mimalloc" ON)
cpr_option(USE_EXTERNAL_FFI "Specify to use external ffi dependency" OFF)

add_subdirectory(deps/quickjs EXCLUDE_FROM_ALL)

option(libuv_buildtests "" OFF)
add_subdirectory(deps/libuv EXCLUDE_FROM_ALL)

add_subdirectory(deps/sqlite3 EXCLUDE_FROM_ALL)

set(BUILD_WASI "simple" CACHE STRING "WASI implementation")
add_subdirectory(deps/wasm3 EXCLUDE_FROM_ALL)

if(BUILD_WITH_MIMALLOC)
    option(MI_OVERRIDE "" OFF)
    option(MI_BUILD_SHARED "" OFF)
    option(MI_BUILD_STATIC "" ON)
    option(MI_BUILD_OBJECT "" OFF)
    option(MI_BUILD_TESTS "" OFF)
    add_subdirectory(deps/mimalloc EXCLUDE_FROM_ALL)
endif()

find_package(CURL REQUIRED)

add_library(tjs STATIC
    src/builtins.c
    src/curl-utils.c
    src/curl-websocket.c
    src/dns.c
    src/error.c
    src/eval.c
    src/ffi.c
    src/fs.c
    src/fswatch.c
    src/mem.c
    src/modules.c
    src/os.c
    src/process.c
    src/sha1.c
    src/streams.c
    src/signals.c
    src/sys.c
    src/timers.c
    src/udp.c
    src/utils.c
    src/version.c
    src/vm.c
    src/wasm.c
    src/worker.c
    src/ws.c
    src/xhr.c
    src/_sqlite3.c
    src/bundles/c/core/core.c
    src/bundles/c/core/polyfills.c
    src/bundles/c/core/run-main.c
    src/bundles/c/core/run-repl.c
    src/bundles/c/core/worker-bootstrap.c
    deps/quickjs/cutils.c
)

if(NOT MINGW)
    target_sources(tjs PUBLIC src/posix-socket.c)
endif()

add_library(ffi-test SHARED
    tests/fixtures/ffi-test-lib.c
)

if(NOT USE_EXTERNAL_FFI AND NOT MINGW AND NOT APPLE)
    set(LIBFFI_SRC "${CMAKE_CURRENT_SOURCE_DIR}/deps/libffi")
    set(TMP_INSTALL_DIR "${CMAKE_CURRENT_BINARY_DIR}/ffi_root")
    if(MINGW)
        set(LIBFFI_STATIC_PATH ${TMP_INSTALL_DIR}/usr/local/lib/libffi.dll.a)
    else()
        set(LIBFFI_STATIC_PATH ${TMP_INSTALL_DIR}/usr/local/lib/libffi.a)
    endif()
    ExternalProject_Add(
        libffi
        BUILD_IN_SOURCE 1
        SOURCE_DIR "${LIBFFI_SRC}"
        CONFIGURE_COMMAND ./autogen.sh COMMAND ./configure --enable-static=yes --disable-shared --disable-multi-os-directory
        BUILD_COMMAND make
        INSTALL_DIR ${TMP_INSTALL_DIR}
        INSTALL_COMMAND make DESTDIR=${TMP_INSTALL_DIR} install
        EXCLUDE_FROM_ALL TRUE
        BUILD_BYPRODUCTS ${LIBFFI_STATIC_PATH}
    )
    add_dependencies(tjs libffi)
    add_library(libffi_a STATIC IMPORTED)
    set_target_properties(libffi_a PROPERTIES IMPORTED_LOCATION ${LIBFFI_STATIC_PATH})
    target_include_directories(tjs PRIVATE ${TMP_INSTALL_DIR}/usr/local/include)
    target_link_libraries(tjs libffi_a)
else()
    find_library(FFI_LIB NAMES libffi ffi REQUIRED)
    find_path(FFI_INCLUDE_DIR NAMES ffi.h PATH_SUFFIXES ffi REQUIRED)
    target_include_directories(tjs PRIVATE ${FFI_INCLUDE_DIR})
    target_link_libraries(tjs ${FFI_LIB})
endif()

set_target_properties(tjs PROPERTIES
    C_STANDARD 11
    C_STANDARD_REQUIRED ON
)

string(TOLOWER ${CMAKE_SYSTEM_NAME} TJS_PLATFORM)
target_compile_options(tjs PRIVATE ${tjs_cflags})
target_compile_definitions(tjs PRIVATE TJS__PLATFORM="${TJS_PLATFORM}")
target_include_directories(tjs PUBLIC src)
target_link_libraries(tjs qjs uv_a m3 sqlite3 m pthread CURL::libcurl)

if (BUILD_WITH_MIMALLOC)
    target_compile_definitions(tjs PRIVATE TJS__HAS_MIMALLOC)
    target_link_libraries(tjs mimalloc-static)
endif()

add_executable(tjs-cli
    src/cli.c
)
target_link_libraries(tjs-cli tjs)
set_target_properties(tjs-cli
    PROPERTIES OUTPUT_NAME tjs
)

add_executable(tjsc EXCLUDE_FROM_ALL
    src/qjsc.c
)
target_link_libraries(tjsc qjs m)

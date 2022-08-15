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

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

set(CMAKE_C_FLAGS_RELEASE "${CMAKE_C_FLAGS_RELEASE} -g")
set(CMAKE_C_FLAGS_DEBUG "${CMAKE_C_FLAGS_DEBUG} -ggdb -O0 -fno-omit-frame-pointer")

set(USE_EXTERNAL_FFI FALSE CACHE STRING "Specify to use external ffi dependency")

message(STATUS "C flags:         ${CMAKE_C_FLAGS}")
message(STATUS "C Debug flags:   ${CMAKE_C_FLAGS_DEBUG}")
message(STATUS "C Release flags: ${CMAKE_C_FLAGS_RELEASE}")

set(TJS__VERSION_MAJOR 22)
set(TJS__VERSION_MINOR 4)
set(TJS__VERSION_PATCH 1)
set(TJS__VERSION_SUFFIX "")
configure_file(
    "${CMAKE_SOURCE_DIR}/src/version.h.in"
    "${CMAKE_SOURCE_DIR}/src/version.h"
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

cpr_option(BUILD_WITH_ASAN "If ON, build with the address sanitizer enabled" OFF)

add_subdirectory(deps/quickjs EXCLUDE_FROM_ALL)

option(libuv_buildtests "" OFF)
add_subdirectory(deps/libuv EXCLUDE_FROM_ALL)

set(BUILD_WASI "simple" CACHE STRING "WASI implementation")
add_subdirectory(deps/wasm3 EXCLUDE_FROM_ALL)

find_package(CURL REQUIRED)

set(INCLUDED_JS_FILES "eval-stdin.js;repl.js;std.js;worker-bootstrap.js;bundle.js")
foreach(jsfile ${INCLUDED_JS_FILES})
    configure_file(
        ${CMAKE_SOURCE_DIR}/src/js/${jsfile}
        ${CMAKE_CURRENT_BINARY_DIR}/${jsfile}
        COPYONLY)
endforeach()

add_executable(tjs
    src/bootstrap.c
    src/cli.c
    src/curl-utils.c
    src/dns.c
    src/error.c
    src/ffi.c
    src/fs.c
    src/fswatch.c
    src/modules.c
    src/os.c
    src/process.c
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
    src/xhr.c
    ../deps/quickjs/src/cutils.c
)

add_library(ffi-test SHARED
    tests/fixtures/ffi-test-lib.c
)

if(NOT USE_EXTERNAL_FFI AND NOT MINGW)
    set(LIBFFI_SRC "${CMAKE_SOURCE_DIR}/deps/libffi")
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
        CONFIGURE_COMMAND ./autogen.sh COMMAND ./configure --enable-static=yes --disable-shared
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
    find_library(FFI_LIB NAMES libffi ffi)
    find_path(FFI_INCLUDE_DIR NAMES ffi.h)
    target_include_directories(tjs PRIVATE ${FFI_INCLUDE_DIR})
    target_link_libraries(tjs ${FFI_LIB})
endif()

set_target_properties(tjs PROPERTIES
    C_STANDARD 11
    C_STANDARD_REQUIRED ON
)

string(TOLOWER ${CMAKE_SYSTEM_NAME} TJS_PLATFORM)
target_compile_definitions(tjs PRIVATE TJS__PLATFORM="${TJS_PLATFORM}")
target_include_directories(tjs PRIVATE ${CURL_INCLUDE_DIRS})
target_link_libraries(tjs qjs uv_a m3 m ${CURL_LIBRARIES})
if(MINGW)
    target_link_libraries(tjs pthread)
endif()

if (BUILD_WITH_ASAN)
    target_compile_options(tjs PRIVATE -fsanitize=address)
    target_link_options(tjs PRIVATE -fsanitize=address)
endif()

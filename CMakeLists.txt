cmake_minimum_required(VERSION 3.14)

project(tjs LANGUAGES C)

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
find_library(FFI_LIB NAMES libffi ffi)
find_path(FFI_INCLUDE_DIR NAMES ffi.h)

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

set(INCLUDED_JS_FILES "bundle.js;eval-stdin.js;repl.js;std.js;ffi.js;worker-bootstrap.js")
foreach(jsfile ${INCLUDED_JS_FILES})
    configure_file(
        ${CMAKE_SOURCE_DIR}/src/js/${jsfile}
        ${CMAKE_CURRENT_BINARY_DIR}/${jsfile}
        COPYONLY)
endforeach()

set_target_properties(tjs PROPERTIES
    C_STANDARD 11
    C_STANDARD_REQUIRED ON
)

string(TOLOWER ${CMAKE_SYSTEM_NAME} TJS_PLATFORM)
target_compile_definitions(tjs PRIVATE TJS__PLATFORM="${TJS_PLATFORM}")
target_include_directories(tjs PRIVATE ${CURL_INCLUDE_DIRS} ${FFI_INCLUDE_DIR})
target_link_libraries(tjs qjs uv_a m3 m ${CURL_LIBRARIES} ${FFI_LIB})
if(MINGW)
    target_link_libraries(tjs pthread)
endif()

if (BUILD_WITH_ASAN)
    target_compile_options(tjs PRIVATE -fsanitize=address)
    target_link_options(tjs PRIVATE -fsanitize=address)
endif()

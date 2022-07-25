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
set(CMAKE_C_FLAGS_DEBUG "${CMAKE_C_FLAGS_DEBUG} -DDEBUG -ggdb -O0 -fno-omit-frame-pointer")


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

file(GLOB_RECURSE BUNDLE_SRC_FILES ${PROJECT_SOURCE_DIR}/src/js/*.js)

set(INCLUDED_JS_FILES "eval-stdin.js;repl.js;std.js;worker-bootstrap.js")
set(INCLUDED_JS_FILES_PATH "")
foreach(jsfile ${INCLUDED_JS_FILES})
    configure_file(
        ${CMAKE_SOURCE_DIR}/src/js/${jsfile}
        ${CMAKE_CURRENT_BINARY_DIR}/${jsfile}
        COPYONLY)
	list(APPEND INCLUDED_JS_FILES_PATH ${CMAKE_CURRENT_BINARY_DIR}/${jsfile})
endforeach()

add_custom_command(
	OUTPUT ${CMAKE_CURRENT_SOURCE_DIR}/node_modules/.bin/esbuild  ${CMAKE_CURRENT_SOURCE_DIR}/package-lock.json
	DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/package.json
	COMMAND npm install
  	WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
)

add_custom_command(
	OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/bundle.js
	DEPENDS ${BUNDLE_SRC_FILES} ${CMAKE_CURRENT_SOURCE_DIR}/node_modules/.bin/esbuild 
	COMMAND ${CMAKE_CURRENT_SOURCE_DIR}/node_modules/.bin/esbuild src/js/index.js --bundle --outfile=${CMAKE_CURRENT_BINARY_DIR}/bundle.js --target=es2020 --platform=neutral --format=esm --main-fields=main,module
  	WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
)

add_executable(tjs
    src/bootstrap.c
    src/cli.c
    src/curl-utils.c
    src/dns.c
    src/error.c
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

if(NOT FALSEMINGW)
    target_sources(tjs PUBLIC src/posix-socket.c)
endif()

set_property(SOURCE src/bootstrap.c APPEND PROPERTY OBJECT_DEPENDS ${INCLUDED_JS_FILES_PATH} ${CMAKE_CURRENT_BINARY_DIR}/bundle.js)



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

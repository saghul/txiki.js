cmake_minimum_required(VERSION 2.8.12)

project(qjs)

if (NOT CMAKE_BUILD_TYPE)
    message(STATUS "No build type selected, default to Release")
    set(CMAKE_BUILD_TYPE "Release")
endif()
message(STATUS "Building in ${CMAKE_BUILD_TYPE} mode")
message(STATUS "Building with ${CMAKE_C_COMPILER_ID} ${CMAKE_C_COMPILER_VERSION} on ${CMAKE_SYSTEM}")

set(CMAKE_C_FLAGS "$ENV{CFLAGS} -Wall -Wextra -Wno-sign-compare -Wno-missing-field-initializers -Wundef -Wuninitialized -Wunused -Wno-unused-parameter -Wwrite-strings -Wchar-subscripts -funsigned-char")
set(CMAKE_C_FLAGS_DEBUG "${CMAKE_C_FLAGS} -DDEBUG -O0 -g3")
set(CMAKE_C_FLAGS_RELEASE "${CMAKE_C_FLAGS} -DNDEBUG -O2 -g")


add_definitions(
    -D_GNU_SOURCE
    -DCONFIG_BIGNUM
    -DCONFIG_VERSION="2019-07-28"
)

add_library(qjs_obj OBJECT
    src/cutils.c
    src/libbf.c
    src/libregexp.c
    src/libunicode.c
    src/quickjs.c
)

add_executable(qjsc
    src/qjsc.c
    $<TARGET_OBJECTS:qjs_obj>
)

target_include_directories(qjsc PRIVATE
    src
)

target_link_libraries(qjsc PUBLIC
    m
)

add_custom_command(
    COMMAND
        ${CMAKE_CURRENT_BINARY_DIR}/qjsc
        -c
        -o ${CMAKE_CURRENT_BINARY_DIR}/repl.c
        -m ${CMAKE_SOURCE_DIR}/src/repl.js
    DEPENDS
        ${CMAKE_CURRENT_BINARY_DIR}/qjsc
        ${CMAKE_SOURCE_DIR}/src/repl.js
    OUTPUT
        ${CMAKE_CURRENT_BINARY_DIR}/repl.c
)

add_custom_command(
    COMMAND
        ${CMAKE_CURRENT_BINARY_DIR}/qjsc
        -c
        -o ${CMAKE_CURRENT_BINARY_DIR}/encoding.c
        -m ${CMAKE_SOURCE_DIR}/src/encoding.js
    DEPENDS
        ${CMAKE_CURRENT_BINARY_DIR}/qjsc
        ${CMAKE_SOURCE_DIR}/src/encoding.js
    OUTPUT
        ${CMAKE_CURRENT_BINARY_DIR}/encoding.c
)

add_executable(qjs
    src/qjs.c
    src/quickjs-libc.c
    src/quickjs-libuv.c
    ${CMAKE_CURRENT_BINARY_DIR}/repl.c
    ${CMAKE_CURRENT_BINARY_DIR}/encoding.c
    $<TARGET_OBJECTS:qjs_obj>
)

include_directories(deps/libuv/include)
option(libuv_buildtests "" OFF)
add_subdirectory(deps/libuv EXCLUDE_FROM_ALL)

target_link_libraries(qjs uv_a m)

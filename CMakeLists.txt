cmake_minimum_required(VERSION 3.0)

project(quv)

if (NOT CMAKE_BUILD_TYPE)
    message(STATUS "No build type selected, default to Release")
    set(CMAKE_BUILD_TYPE "Release")
endif()
message(STATUS "Building in ${CMAKE_BUILD_TYPE} mode")
message(STATUS "Building with ${CMAKE_C_COMPILER_ID} ${CMAKE_C_COMPILER_VERSION} on ${CMAKE_SYSTEM}")

set(CMAKE_C_FLAGS_DEBUG "${CMAKE_C_FLAGS} -DDEBUG -O0 -g3")
set(CMAKE_C_FLAGS_RELEASE "${CMAKE_C_FLAGS} -DNDEBUG -O2 -g")

option(libuv_buildtests "" OFF)
add_subdirectory(deps/libuv EXCLUDE_FROM_ALL)
add_subdirectory(deps/quickjs EXCLUDE_FROM_ALL)

add_executable(qjsc
    src/qjsc.c
)
target_link_libraries(qjsc qjs m)

add_custom_command(
    COMMAND
        ${CMAKE_CURRENT_BINARY_DIR}/qjsc
        -c
        -o ${CMAKE_CURRENT_BINARY_DIR}/bootstrap.c
        -m ${CMAKE_SOURCE_DIR}/src/bootstrap.js
    DEPENDS
        ${CMAKE_CURRENT_BINARY_DIR}/qjsc
        ${CMAKE_SOURCE_DIR}/src/bootstrap.js
    OUTPUT
        ${CMAKE_CURRENT_BINARY_DIR}/bootstrap.c
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

add_executable(quv
    src/cli.c
    src/quickjs-libc.c
    src/quv/dns.c
    src/quv/error.c
    src/quv/fs.c
    src/quv/misc.c
    src/quv/process.c
    src/quv/streams.c
    src/quv/signals.c
    src/quv/timers.c
    src/quv/udp.c
    src/quv/utils.c
    src/quv/vm.c
    src/quv/worker.c
    ${CMAKE_CURRENT_BINARY_DIR}/bootstrap.c
    ${CMAKE_CURRENT_BINARY_DIR}/repl.c
    ${CMAKE_CURRENT_BINARY_DIR}/encoding.c
    ../deps/quickjs/src/cutils.c
)
set_target_properties(quv PROPERTIES
    C_STANDARD 99
    C_STANDARD_REQUIRED ON
)
target_link_libraries(quv qjs uv_a m)

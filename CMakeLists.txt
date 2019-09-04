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

include(${CMAKE_SOURCE_DIR}/src/js/CMakeLists.txt)

option(libuv_buildtests "" OFF)
add_subdirectory(deps/libuv EXCLUDE_FROM_ALL)
add_subdirectory(deps/quickjs EXCLUDE_FROM_ALL)

find_package(CURL)

add_executable(quv
    src/cli.c
    src/quv/dns.c
    src/quv/error.c
    src/quv/fs.c
    src/quv/misc.c
    src/quv/modules.c
    src/quv/process.c
    src/quv/std.c
    src/quv/streams.c
    src/quv/signals.c
    src/quv/timers.c
    src/quv/udp.c
    src/quv/utils.c
    src/quv/vm.c
    src/quv/worker.c
    ${CMAKE_CURRENT_BINARY_DIR}/bootstrap.c
    ${CMAKE_CURRENT_BINARY_DIR}/bootstrap2.c
    ${CMAKE_CURRENT_BINARY_DIR}/encoding.c
    ${CMAKE_CURRENT_BINARY_DIR}/event-target.c
    ${CMAKE_CURRENT_BINARY_DIR}/path.c
    ${CMAKE_CURRENT_BINARY_DIR}/performance.c
    ${CMAKE_CURRENT_BINARY_DIR}/repl.c
    ${CMAKE_CURRENT_BINARY_DIR}/url.c
    ../deps/quickjs/src/cutils.c
)
set_target_properties(quv PROPERTIES
    C_STANDARD 99
    C_STANDARD_REQUIRED ON
)
if (CURL_FOUND)
    target_compile_definitions(quv PRIVATE
        QUV_HAVE_CURL
    )
    target_include_directories(quv PRIVATE ${CURL_INCLUDE_DIR})
    target_link_libraries(quv ${CURL_LIBRARIES})
endif()
target_link_libraries(quv qjs uv_a m)

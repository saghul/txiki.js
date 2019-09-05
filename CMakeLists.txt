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


set(QUV__VERSION_MAJOR 19)
set(QUV__VERSION_MINOR 0)
set(QUV__VERSION_PATCH 0)
set(QUV__VERSION_SUFFIX "-alpha")
configure_file(
    "${CMAKE_SOURCE_DIR}/src/version.h.in"
    "${CMAKE_SOURCE_DIR}/src/version.h"
)


include(${CMAKE_SOURCE_DIR}/src/js/CMakeLists.txt)

option(libuv_buildtests "" OFF)
add_subdirectory(deps/libuv EXCLUDE_FROM_ALL)
add_subdirectory(deps/quickjs EXCLUDE_FROM_ALL)


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

cpr_option(USE_SYSTEM_CURL "If ON, this project will look in the system paths for an installed curl library" ON)

if(USE_SYSTEM_CURL)
    find_package(CURL)
endif()
if(NOT USE_SYSTEM_CURL OR NOT CURL_FOUND)
    message(STATUS "Not using system Curl, using built-in curl project instead.")
    option(HTTP_ONLY "disables all protocols except HTTP" ON)
    option(BUILD_TESTING "Set to ON to build cURL tests." OFF)
    option(BUILD_CURL_EXE "Set to ON to build cURL executable." OFF)
    add_subdirectory(deps/curl)
    set(CURL_FOUND TRUE)
    set(CURL_LIBRARIES libcurl)
    set(CURL_INCLUDE_DIRS
        ${CURL_SOURCE_DIR}/include
        ${CURL_BINARY_DIR}/include/curl)
endif()


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
    src/quv/version.c
    src/quv/vm.c
    src/quv/worker.c
    ${CMAKE_CURRENT_BINARY_DIR}/bootstrap.c
    ${CMAKE_CURRENT_BINARY_DIR}/bootstrap2.c
    ${CMAKE_CURRENT_BINARY_DIR}/console.c
    ${CMAKE_CURRENT_BINARY_DIR}/encoding.c
    ${CMAKE_CURRENT_BINARY_DIR}/event-target.c
    ${CMAKE_CURRENT_BINARY_DIR}/getopts.c
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
    if (USE_SYSTEM_CURL)
        target_compile_definitions(quv PRIVATE
            QUV_HAVE_SYSTEM_CURL
        )
    endif()
    target_compile_definitions(quv PRIVATE
        QUV_HAVE_CURL
    )
    target_include_directories(quv PRIVATE ${CURL_INCLUDE_DIRS})
    target_link_libraries(quv ${CURL_LIBRARIES})
endif()
target_link_libraries(quv qjs uv_a m)

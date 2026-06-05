cmake_minimum_required(VERSION 3.14)

cmake_policy(SET CMP0091 NEW)

project(tjs LANGUAGES C CXX)

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

if(MSVC)
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
    list(APPEND tjs_cflags /experimental:c11atomics)
else()
    list(APPEND tjs_cflags -Wall -g)
    if (CMAKE_BUILD_TYPE MATCHES "Debug")
        list(APPEND tjs_cflags -ggdb -O0 -fno-omit-frame-pointer)
    endif()
endif()

set(TJS__VERSION_MAJOR 26)
set(TJS__VERSION_MINOR 5)
set(TJS__VERSION_PATCH 0)
set(TJS__VERSION_SUFFIX "")
configure_file(
    "${CMAKE_CURRENT_SOURCE_DIR}/src/version.h.in"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/version.h"
)

macro(xoption OPTION_NAME OPTION_TEXT OPTION_DEFAULT)
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

macro(apply_dep_patch)
    cmake_parse_arguments(_P "" "DEPDIR;PATCH" "" ${ARGN})
    set(_dep_dir "${CMAKE_CURRENT_SOURCE_DIR}/${_P_DEPDIR}")
    set(_patch   "${CMAKE_CURRENT_SOURCE_DIR}/${_P_PATCH}")
    get_filename_component(_patch_name "${_patch}" NAME)
    execute_process(
        COMMAND git apply --reverse --check "${_patch}"
        WORKING_DIRECTORY "${_dep_dir}"
        RESULT_VARIABLE _patch_already_applied
        OUTPUT_QUIET ERROR_QUIET
    )
    if(_patch_already_applied EQUAL 0)
        message(STATUS "Already applied ${_patch_name}")
    else()
        execute_process(
            COMMAND git apply "${_patch}"
            WORKING_DIRECTORY "${_dep_dir}"
            RESULT_VARIABLE _patch_result
        )
        if(_patch_result EQUAL 0)
            message(STATUS "Applied ${_patch_name}")
        else()
            message(FATAL_ERROR "Failed to apply ${_patch_name} to ${_P_DEPDIR}")
        endif()
    endif()
    unset(_dep_dir)
    unset(_patch)
    unset(_patch_name)
    unset(_patch_already_applied)
    unset(_patch_result)
endmacro()

xoption(BUILD_WITH_MIMALLOC "If ON (default), build with mimalloc" ON)
xoption(BUILD_WITH_ASAN "Build with AddressSanitizer" OFF)
xoption(BUILD_WITH_UBSAN "Build with UndefinedBehaviorSanitizer" OFF)
xoption(BUILD_WITH_STRIP "If ON, strip the tjs binary after linking" OFF)
xoption(BUILD_WITH_LTO "If ON, enable link-time optimization" OFF)
xoption(BUILD_WITH_WASM "If ON (default), build with WASM/WAMR support" ON)
if(NOT BUILD_WITH_WASM)
    add_compile_definitions(TJS_NO_WASM)
endif()
xoption(BUILD_WITH_SQLITE "If ON (default), build with SQLite support" ON)
if(NOT BUILD_WITH_SQLITE)
    add_compile_definitions(TJS_NO_SQLITE)
endif()
xoption(BUILD_WITH_TLS "If ON (default), build with TLS support (HTTPS/WSS/tjs:tls)" ON)
if(NOT BUILD_WITH_TLS)
    add_compile_definitions(TJS_NO_TLS)
endif()

if(BUILD_WITH_ASAN)
    message(STATUS "AddressSanitizer enabled")
    if(BUILD_WITH_MIMALLOC)
        message(FATAL_ERROR "BUILD_WITH_ASAN and BUILD_WITH_MIMALLOC cannot be used together")
    endif()
    add_compile_definitions(TJS__HAS_ASAN)
    if(MSVC)
        add_compile_options(/fsanitize=address)
    else()
        add_compile_options(-fsanitize=address -fno-omit-frame-pointer -fno-sanitize-recover=all)
        add_link_options(-fsanitize=address)
    endif()
endif()

if(BUILD_WITH_UBSAN)
    message(STATUS "UndefinedBehaviorSanitizer enabled")
    if(MSVC)
        message(FATAL_ERROR "BUILD_WITH_UBSAN is not supported with MSVC")
    endif()
    add_compile_options(-fsanitize=undefined -fno-omit-frame-pointer)
    add_link_options(-fsanitize=undefined)
endif()

if(BUILD_WITH_LTO)
    include(CheckIPOSupported)
    check_ipo_supported(RESULT _ipo_supported OUTPUT _ipo_output)
    if(_ipo_supported)
        message(STATUS "LTO enabled")
        set(CMAKE_INTERPROCEDURAL_OPTIMIZATION TRUE)
    else()
        message(WARNING "LTO requested but not supported: ${_ipo_output}")
    endif()
endif()

xoption(BUILD_WITH_GC_SECTIONS "If ON, compile with per-function/data sections and link with dead-code stripping" OFF)
if(BUILD_WITH_GC_SECTIONS)
    if(MSVC)
        add_compile_options(/Gy)
    else()
        add_compile_options(-ffunction-sections -fdata-sections)
    endif()
endif()

###
### Core library / executables
###

add_library(tjs STATIC
    src/builtins.c
    src/error.c
    src/lws-utils.c
    src/eval.c
    src/mem.c
    src/modules.c
    src/tbuf.c
    src/signals.c
    src/text-coding.c
    src/timers.c
    src/utils.c
    src/version.c
    src/vm.c
    src/worker.c
    src/ws.c
    src/httpclient.c
    src/httpserver.c
    src/mod_dns.c
    src/mod_engine.c
    src/mod_ffi.c
    src/mod_fs.c
    src/mod_fswatch.c
    src/mod_hashing.c
    src/mod_os.c
    src/mod_process.c
    src/mod_miniz.c
    src/mod_streams.c
    src/ed25519.c
)
if(BUILD_WITH_TLS)
    target_sources(tjs PRIVATE src/mod_tls.c)
endif()
target_sources(tjs PRIVATE
    src/webcrypto.c
    src/mod_sys.c
    src/mod_udp.c
    src/url.c
    src/bundles/c/core/core.c
    src/bundles/c/core/polyfills.c
    src/bundles/c/core/run-main.c
    src/bundles/c/core/run-repl.c
    src/bundles/c/core/worker-bootstrap.c
)

if(UNIX)
    target_sources(tjs PRIVATE src/mod_posix-socket.c)
endif()
if(BUILD_WITH_WASM)
    target_sources(tjs PRIVATE src/wasm.c)
endif()
if(BUILD_WITH_SQLITE)
    target_sources(tjs PRIVATE src/mod_sqlite3.c)
endif()

set_target_properties(tjs PROPERTIES
    C_STANDARD 11
    C_STANDARD_REQUIRED ON
    OUTPUT_NAME tjs_core
)

string(TOLOWER ${CMAKE_SYSTEM_NAME} TJS_PLATFORM)
target_compile_options(tjs PRIVATE ${tjs_cflags})
target_compile_definitions(tjs PRIVATE TJS__PLATFORM="${TJS_PLATFORM}")

if(WIN32)
    target_compile_definitions(tjs PRIVATE WIN32_LEAN_AND_MEAN)
endif()

target_include_directories(tjs PUBLIC src)

add_executable(tjs-cli
    src/cli.c
)
target_link_libraries(tjs-cli tjs)
set_target_properties(tjs-cli
    PROPERTIES OUTPUT_NAME tjs
)
# On Windows with MSVC the stack size if by default 1MB, same as our engine.
# Bump it up to 8MB.
if(WIN32)
    target_link_options(tjs-cli PRIVATE "/STACK:8388608")
endif()

if(BUILD_WITH_STRIP AND CMAKE_STRIP)
    add_custom_command(TARGET tjs-cli POST_BUILD
        COMMAND ${CMAKE_STRIP} $<TARGET_FILE:tjs-cli>
        COMMENT "Stripping tjs"
    )
endif()

if(BUILD_WITH_GC_SECTIONS)
    if(MSVC)
        target_link_options(tjs-cli PRIVATE /OPT:REF /OPT:ICF)
    elseif(APPLE)
        target_link_options(tjs-cli PRIVATE -Wl,-dead_strip)
    else()
        target_link_options(tjs-cli PRIVATE -Wl,--gc-sections)
    endif()
endif()

add_executable(tjsc EXCLUDE_FROM_ALL
    src/qjsc.c
)

###
### Dependencies
###

add_subdirectory(deps/quickjs EXCLUDE_FROM_ALL)
target_link_libraries(tjs PUBLIC qjs)
target_link_libraries(tjsc qjs)

if(BUILD_WITH_MIMALLOC)
    option(MI_OVERRIDE "" OFF)
    option(MI_BUILD_SHARED "" OFF)
    option(MI_BUILD_STATIC "" ON)
    option(MI_BUILD_OBJECT "" OFF)
    option(MI_BUILD_TESTS "" OFF)
    if(CMAKE_BUILD_TYPE MATCHES "Debug")
        option(MI_GUARDED "" ON)
    endif()
    add_subdirectory(deps/mimalloc EXCLUDE_FROM_ALL)
    target_compile_definitions(tjs PRIVATE TJS__HAS_MIMALLOC)
    target_link_libraries(tjs PUBLIC mimalloc-static)
endif()

option(libuv_buildtests "" OFF)
add_subdirectory(deps/libuv EXCLUDE_FROM_ALL)
target_link_libraries(tjs PUBLIC uv_a)

if(BUILD_WITH_SQLITE)
    add_subdirectory(deps/sqlite3 EXCLUDE_FROM_ALL)
    target_link_libraries(tjs PUBLIC sqlite3)
    add_library(sqlite-test SHARED
        tests/fixtures/sqlite-test-ext.c
    )
    target_link_libraries(sqlite-test sqlite3)
endif()

if (WIN32)
    find_package(unofficial-libffi CONFIG REQUIRED)
    target_link_libraries(tjs PUBLIC unofficial::libffi::libffi)
else()
    find_library(FFI_LIB NAMES libffi ffi REQUIRED)
    find_path(FFI_INCLUDE_DIR NAMES ffi.h PATH_SUFFIXES ffi REQUIRED)
    target_include_directories(tjs PRIVATE ${FFI_INCLUDE_DIR})
    target_link_libraries(tjs PUBLIC ${FFI_LIB})
endif()

add_library(ffi-test SHARED
    tests/fixtures/ffi-test-lib.c
)

# Set consistent output for test libraries across all platforms (including MSVC multi-config)
set_target_properties(ffi-test PROPERTIES
    PREFIX "lib"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}"
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}"
    # For multi-config generators (Visual Studio, Xcode)
    RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}"
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}"
    RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO "${CMAKE_BINARY_DIR}"
    RUNTIME_OUTPUT_DIRECTORY_MINSIZEREL "${CMAKE_BINARY_DIR}"
    LIBRARY_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}"
    LIBRARY_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}"
    LIBRARY_OUTPUT_DIRECTORY_RELWITHDEBINFO "${CMAKE_BINARY_DIR}"
    LIBRARY_OUTPUT_DIRECTORY_MINSIZEREL "${CMAKE_BINARY_DIR}"
)
if(BUILD_WITH_SQLITE)
    set_target_properties(sqlite-test PROPERTIES
        PREFIX "lib"
        RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}"
        LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}"
        # For multi-config generators (Visual Studio, Xcode)
        RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}"
        RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}"
        RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO "${CMAKE_BINARY_DIR}"
        RUNTIME_OUTPUT_DIRECTORY_MINSIZEREL "${CMAKE_BINARY_DIR}"
        LIBRARY_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}"
        LIBRARY_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}"
        LIBRARY_OUTPUT_DIRECTORY_RELWITHDEBINFO "${CMAKE_BINARY_DIR}"
        LIBRARY_OUTPUT_DIRECTORY_MINSIZEREL "${CMAKE_BINARY_DIR}"
    )
endif()

add_subdirectory(deps/ada EXCLUDE_FROM_ALL)
target_link_libraries(tjs PUBLIC ada)

if(BUILD_WITH_WASM)
    # WAMR Configuration (interpreter only for maximum portability)
    set(WAMR_ROOT_DIR ${CMAKE_CURRENT_SOURCE_DIR}/deps/wamr)

    # Detect platform for WAMR
    if(CMAKE_SYSTEM_NAME STREQUAL "Darwin")
        set(WAMR_BUILD_PLATFORM "darwin")
    elseif(CMAKE_SYSTEM_NAME STREQUAL "Windows")
        set(WAMR_BUILD_PLATFORM "windows")
    else()
        set(WAMR_BUILD_PLATFORM "linux")
    endif()

if(CMAKE_SYSTEM_NAME STREQUAL "Darwin" AND NOT DEFINED WAMR_BUILD_TARGET AND CMAKE_OSX_ARCHITECTURES)
    set(TJS_OSX_ARCHITECTURES ${CMAKE_OSX_ARCHITECTURES})
    list(LENGTH TJS_OSX_ARCHITECTURES TJS_OSX_ARCHITECTURE_COUNT)

    if(TJS_OSX_ARCHITECTURE_COUNT EQUAL 1)
        list(GET TJS_OSX_ARCHITECTURES 0 TJS_OSX_ARCHITECTURE)
        string(TOLOWER "${TJS_OSX_ARCHITECTURE}" TJS_OSX_ARCHITECTURE)

        if(TJS_OSX_ARCHITECTURE MATCHES "^(arm64|aarch64)$")
            set(WAMR_BUILD_TARGET "AARCH64")
        elseif(TJS_OSX_ARCHITECTURE STREQUAL "x86_64")
            set(WAMR_BUILD_TARGET "X86_64")
        endif()
    endif()
endif()

    # Configure WAMR build options
    set(WAMR_BUILD_INTERP 1)
    set(WAMR_BUILD_FAST_INTERP 1)
    set(WAMR_BUILD_AOT 0)
    set(WAMR_BUILD_JIT 0)
    set(WAMR_BUILD_LIBC_BUILTIN 1)
    set(WAMR_BUILD_LIBC_WASI 1)
    set(WAMR_BUILD_MULTI_MODULE 1)
    set(WAMR_BUILD_SIMD 1)
    set(WAMR_BUILD_REF_TYPES 1)
    set(WAMR_BUILD_BULK_MEMORY 1)
    set(WAMR_BUILD_LIB_PTHREAD 0)
    set(WAMR_BUILD_MINI_LOADER 0)
    set(WAMR_DISABLE_HW_BOUND_CHECK 1)
    set(WAMR_DISABLE_STACK_HW_BOUND_CHECK 1)

    # Include WAMR build scripts
    include(${WAMR_ROOT_DIR}/build-scripts/runtime_lib.cmake)

    add_library(vmlib STATIC ${WAMR_RUNTIME_LIB_SOURCE})
    target_include_directories(vmlib PUBLIC ${WAMR_ROOT_DIR}/core/iwasm/include)
    if(WIN32)
        target_link_libraries(vmlib PUBLIC ntdll)
    endif()
    target_include_directories(tjs PRIVATE ${WAMR_ROOT_DIR}/core/iwasm/include)
    target_link_libraries(tjs PUBLIC vmlib)
endif()

add_subdirectory(deps/miniz EXCLUDE_FROM_ALL)
target_link_libraries(tjs PUBLIC miniz)

option(ENABLE_TESTING "" OFF)
option(ENABLE_PROGRAMS "" OFF)
option(MBEDTLS_FATAL_WARNINGS "" OFF)
set(MBEDTLS_AS_SUBPROJECT ON)
set(MBEDTLS_USER_CONFIG_FILE "${CMAKE_CURRENT_SOURCE_DIR}/src/mbedtls_config.h" CACHE FILEPATH "" FORCE)
set(MSVC_STATIC_RUNTIME ON CACHE BOOL "" FORCE)
add_subdirectory(deps/mbedtls EXCLUDE_FROM_ALL)
if(BUILD_WITH_TLS)
    target_link_libraries(tjs PUBLIC mbedtls mbedx509 mbedcrypto)
else()
    target_link_libraries(tjs PUBLIC mbedcrypto)
endif()

if (NOT CMAKE_BUILD_TYPE MATCHES "Debug")
    set(LWS_WITH_NO_LOGS ON CACHE BOOL "" FORCE)
endif()
set(LWS_WITH_HTTP2 OFF CACHE BOOL "" FORCE)
set(LWS_ROLE_RAW_FILE OFF CACHE BOOL "" FORCE)
set(LWS_UNIX_SOCK OFF CACHE BOOL "" FORCE)
set(LWS_WITH_SYS_STATE OFF CACHE BOOL "" FORCE)
set(LWS_WITH_SYS_SMD OFF CACHE BOOL "" FORCE)
set(LWS_WITH_UPNG OFF CACHE BOOL "" FORCE)
set(LWS_WITH_DLO OFF CACHE BOOL "" FORCE)
set(LWS_WITH_SECURE_STREAMS OFF CACHE BOOL "" FORCE)
set(LWS_WITH_LEJP OFF CACHE BOOL "" FORCE)
set(LWS_WITH_LHP OFF CACHE BOOL "" FORCE)
set(LWS_WITH_JSONRPC OFF CACHE BOOL "" FORCE)
set(LWS_WITH_LWSAC OFF CACHE BOOL "" FORCE)
set(LWS_WITH_CONMON OFF CACHE BOOL "" FORCE)
set(LWS_WITH_WOL OFF CACHE BOOL "" FORCE)
set(LWS_WITH_LIBUV ON CACHE BOOL "" FORCE)
if(BUILD_WITH_TLS)
    set(LWS_WITH_MBEDTLS ON CACHE BOOL "" FORCE)
    set(LWS_WITH_SSL ON CACHE BOOL "" FORCE)
    # Tell lws about mbedtls capabilities (CHECK_FUNCTION_EXISTS fails for static libs)
    set(LWS_HAVE_mbedtls_md_setup 1 CACHE BOOL "" FORCE)
    set(LWS_HAVE_mbedtls_rsa_complete 1 CACHE BOOL "" FORCE)
    set(LWS_HAVE_mbedtls_net_init 1 CACHE BOOL "" FORCE)
    set(LWS_HAVE_mbedtls_ssl_conf_alpn_protocols 1 CACHE BOOL "" FORCE)
    set(LWS_HAVE_mbedtls_ssl_get_alpn_protocol 1 CACHE BOOL "" FORCE)
    set(LWS_HAVE_mbedtls_ssl_conf_sni 1 CACHE BOOL "" FORCE)
    set(LWS_HAVE_mbedtls_ssl_set_hs_ca_chain 1 CACHE BOOL "" FORCE)
    set(LWS_HAVE_mbedtls_ssl_set_hs_own_cert 1 CACHE BOOL "" FORCE)
    set(LWS_HAVE_mbedtls_ssl_set_hs_authmode 1 CACHE BOOL "" FORCE)
    set(LWS_HAVE_mbedtls_x509_crt_parse_file 1 CACHE BOOL "" FORCE)
    set(LWS_HAVE_mbedtls_internal_aes_encrypt 1 CACHE BOOL "" FORCE)
    set(LWS_HAVE_MBEDTLS_NET_SOCKETS 1 CACHE BOOL "" FORCE)
    set(LWS_HAVE_MBEDTLS_SSL_NEW_SESSION_TICKET 1 CACHE BOOL "" FORCE)
    set(LWS_MBEDTLS_LIBRARIES mbedtls mbedx509 mbedcrypto CACHE STRING "" FORCE)
    set(LWS_MBEDTLS_INCLUDE_DIRS "${CMAKE_CURRENT_SOURCE_DIR}/deps/mbedtls/include" CACHE STRING "" FORCE)
else()
    set(LWS_WITH_MBEDTLS OFF CACHE BOOL "" FORCE)
    set(LWS_WITH_SSL OFF CACHE BOOL "" FORCE)
endif()
set(LWS_WITHOUT_EXTENSIONS ON CACHE BOOL "" FORCE)
set(LWS_WITHOUT_TESTAPPS ON CACHE BOOL "" FORCE)
set(LWS_WITH_SHARED OFF CACHE BOOL "" FORCE)
set(LWS_WITH_STATIC ON CACHE BOOL "" FORCE)
set(LWS_MSVC_STATIC_RUNTIME ON CACHE BOOL "" FORCE)
set(LWS_WITH_MINIMAL_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LWS_WITH_TLS_SESSIONS OFF CACHE BOOL "" FORCE)
set(LWS_WITH_EXPORT_LWSTARGETS OFF CACHE BOOL "" FORCE)
set(LWS_WITH_NETLINK OFF CACHE BOOL "" FORCE)
set(LWS_WITH_SYS_ASYNC_DNS ON CACHE BOOL "" FORCE)
set(LWS_WITH_CACHE_NSCOOKIEJAR ON CACHE BOOL "" FORCE)
set(LWS_WITH_MINIZ ON CACHE BOOL "" FORCE)
# Pre-set ZLIB variables so lws skips find_package(Miniz)
set(ZLIB_FOUND TRUE)
set(ZLIB_INCLUDE_DIRS "${CMAKE_CURRENT_SOURCE_DIR}/deps/miniz" CACHE STRING "" FORCE)
set(ZLIB_LIBRARIES miniz CACHE STRING "" FORCE)
set(LWS_HAVE_ZLIB_H 1 CACHE BOOL "" FORCE)
set(LWS_LIBUV_LIBRARIES uv_a CACHE STRING "" FORCE)
set(LWS_LIBUV_INCLUDE_DIRS "${CMAKE_CURRENT_SOURCE_DIR}/deps/libuv/include" CACHE STRING "" FORCE)
apply_dep_patch(DEPDIR deps/libwebsockets PATCH patches/lws.patch)
add_subdirectory(deps/libwebsockets EXCLUDE_FROM_ALL)
# Work around mbedtls ssl.h using #if instead of #ifdef on
# MBEDTLS_SSL_DTLS_CONNECTION_ID_COMPAT (undefined when DTLS is disabled).
if(MSVC)
    target_compile_options(websockets PRIVATE /wd4005)
else()
    target_compile_options(websockets PRIVATE -Wno-undef)
endif()
if(CMAKE_C_COMPILER_ID MATCHES "GNU")
    target_compile_options(websockets PRIVATE -Wno-discarded-qualifiers)
endif()
target_link_libraries(tjs PUBLIC websockets)
target_include_directories(tjs PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/deps/libwebsockets/include)

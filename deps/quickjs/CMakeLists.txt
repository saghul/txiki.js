cmake_minimum_required(VERSION 3.4)

project(quickjs LANGUAGES C)

option(CONFIG_QUICKJS_DEBUGGER "Enable QuickJS Debugger Support" OFF)

set(qjs_cflags -Wall)
if(CMAKE_C_COMPILER_ID MATCHES "AppleClang|Clang")
    list(APPEND qjs_cflags
        -Wextra
        -Wno-sign-compare
        -Wno-missing-field-initializers
        -Wno-unused-parameter
        -Wno-unused-variable
        -funsigned-char)
else()
    list(APPEND qjs_cflags
        -Wno-sign-compare
        -Wno-unused-parameter
        -Wno-array-bounds
        -Wno-unused-variable
        -Wno-unused-but-set-variable)
endif()

file(STRINGS "VERSION" QJS_VERSION_STR)

if (CONFIG_QUICKJS_DEBUGGER)
    set(debugger_support src/quickjs-debugger.c)
if (WIN32) 
    set(debugger_support ${debugger_support} src/quickjs-debugger-transport-win.c)
else()
    set(debugger_support ${debugger_support} src/quickjs-debugger-transport-unix.c)
endif()
endif()

add_library(qjs STATIC
    src/cutils.c
    src/libbf.c
    src/libregexp.c
    src/libunicode.c
    src/quickjs.c
    ${debugger_support}
)
set_target_properties(qjs PROPERTIES
    C_STANDARD 11
    C_STANDARD_REQUIRED ON
)
target_compile_options(qjs PRIVATE ${qjs_cflags})
target_compile_definitions(qjs PUBLIC
    QJS_VERSION_STR="${QJS_VERSION_STR}"
)
target_compile_definitions(qjs PRIVATE
    CONFIG_BIGNUM
    CONFIG_VERSION="${QJS_VERSION_STR}"
)

if (CMAKE_BUILD_TYPE MATCHES Debug)
    target_compile_definitions(qjs PRIVATE
        DUMP_LEAKS
    )
endif()

if (CONFIG_QUICKJS_DEBUGGER)
    target_compile_definitions(qjs PUBLIC
        CONFIG_QUICKJS_DEBUGGER
    )
endif()

target_include_directories(qjs PUBLIC include)
target_include_directories(qjs PRIVATE src)
if ("${CMAKE_CXX_COMPILER_ID}" STREQUAL "GNU")
    target_link_libraries(qjs atomic)
endif()

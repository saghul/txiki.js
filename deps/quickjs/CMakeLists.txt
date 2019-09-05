cmake_minimum_required(VERSION 3.0)
project(quickjs)

list(APPEND qjs_cflags -Wall)
if(CMAKE_C_COMPILER_ID MATCHES "AppleClang|Clang")
    list(APPEND qjs_cflags -Wextra)
    list(APPEND qjs_cflags -Wno-sign-compare)
    list(APPEND qjs_cflags -Wno-missing-field-initializers)
    list(APPEND qjs_cflags -Wundef)
    list(APPEND qjs_cflags -Wuninitialized)
    list(APPEND qjs_cflags -Wunused)
    list(APPEND qjs_cflags -Wno-unused-parameter)
    list(APPEND qjs_cflags -Wwrite-strings)
    list(APPEND qjs_cflags -Wchar-subscripts)
    list(APPEND qjs_cflags -funsigned-char)
else()
    list(APPEND qjs_cflags -Wno-array-bounds)
endif()

file(STRINGS "VERSION" QJS_VERSION_STR)

add_library(qjs STATIC
    src/cutils.c
    src/libbf.c
    src/libregexp.c
    src/libunicode.c
    src/quickjs.c
)
target_compile_options(qjs PRIVATE ${qjs_cflags})
target_compile_definitions(qjs PUBLIC
    QJS_VERSION_STR="${QJS_VERSION_STR}"
)
target_compile_definitions(qjs PRIVATE
    CONFIG_BIGNUM
    CONFIG_VERSION="${QJS_VERSION_STR}"
)
target_include_directories(qjs PUBLIC include)
target_include_directories(qjs PRIVATE src)

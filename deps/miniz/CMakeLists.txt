add_library(miniz STATIC miniz.c)
target_include_directories(miniz PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_compile_definitions(miniz PUBLIC
    MINIZ_NO_STDIO
    MINIZ_NO_TIME
    MINIZ_NO_ARCHIVE_APIS
)

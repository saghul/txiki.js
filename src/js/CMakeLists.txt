
add_executable(qjsc
    src/qjsc.c
)
target_link_libraries(qjsc qjs m)

set(js_files
    bootstrap
    bootstrap2
    console
    encoding
    event-target
    getopts
    path
    performance
    repl
    url
)
foreach(x ${js_files})
    add_custom_command(
        COMMAND
            ${CMAKE_CURRENT_BINARY_DIR}/qjsc
            -c
            -N @quv/${x}
            -o ${CMAKE_CURRENT_BINARY_DIR}/${x}.c
            -m ${CMAKE_SOURCE_DIR}/src/js/${x}.js
        DEPENDS
            ${CMAKE_CURRENT_BINARY_DIR}/qjsc
            ${CMAKE_SOURCE_DIR}/src/js/${x}.js
        OUTPUT
            ${CMAKE_CURRENT_BINARY_DIR}/${x}.c
    )
endforeach()

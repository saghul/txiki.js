option(QJSC_HOST_CC "QJSC host C compiler" ${CMAKE_C_COMPILER})

get_target_property(QJS_SOURCES qjs SOURCES)
add_custom_command(
    COMMAND
        ${QJSC_HOST_CC}
        -o ${CMAKE_CURRENT_BINARY_DIR}/qjsc-host
        -lm
        src/qjsc.c ${QJS_SOURCES}
    DEPENDS
        src/qjsc.c ${QJS_SOURCES}
    OUTPUT
        ${CMAKE_CURRENT_BINARY_DIR}/qjsc-host
)

set(JS_PATH ${CMAKE_SOURCE_DIR}/src/js)
set(js_files
    ${JS_PATH}/abort-controller.js
    ${JS_PATH}/bootstrap.js
    ${JS_PATH}/bootstrap2.js
    ${JS_PATH}/console.js
    ${JS_PATH}/crypto.js
    ${JS_PATH}/encoding.js
    ${JS_PATH}/event-target.js
    ${JS_PATH}/fetch.js
    ${JS_PATH}/getopts.js
    ${JS_PATH}/hashlib.js
    ${JS_PATH}/path.js
    ${JS_PATH}/performance.js
    ${JS_PATH}/repl.js
    ${JS_PATH}/url.js
    ${JS_PATH}/uuid.js
    ${JS_PATH}/worker-bootstrap.js
)

add_custom_command(
    COMMAND
        ${CMAKE_CURRENT_BINARY_DIR}/qjsc-host
        -o ${CMAKE_CURRENT_BINARY_DIR}/js.c
        -m ${js_files}
    DEPENDS
        ${CMAKE_CURRENT_BINARY_DIR}/qjsc-host
        ${js_files}
    OUTPUT
        ${CMAKE_CURRENT_BINARY_DIR}/js.c
)

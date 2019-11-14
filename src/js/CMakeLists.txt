add_executable(qjsc
    src/qjsc.c
)
target_link_libraries(qjsc qjs m)

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

set(CUSTOM_QJSC "${CMAKE_CURRENT_BINARY_DIR}/qjsc" CACHE STRING "Custom path to QJSC")
add_custom_command(
    COMMAND
        ${CUSTOM_QJSC}
        -o ${CMAKE_CURRENT_BINARY_DIR}/js.c
        -m ${js_files}
    DEPENDS
        ${CUSTOM_QJSC}
        ${js_files}
    OUTPUT
        ${CMAKE_CURRENT_BINARY_DIR}/js.c
)

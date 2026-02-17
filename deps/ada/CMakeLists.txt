add_library(ada STATIC
    ada.cpp
)
target_include_directories(ada PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
if (NOT MSVC)
    target_compile_options(ada PRIVATE -fno-exceptions -fno-rtti)
endif()
set_target_properties(ada PROPERTIES
    CXX_STANDARD 20
    CXX_STANDARD_REQUIRED ON
)

cmake_minimum_required(VERSION 3.0)
project(PerformanceTest)

include(ExternalProject)

set(EXTERNAL_INSTALL_LOCATION ${CMAKE_BINARY_DIR}/external)

ExternalProject_Add(ApacheBench
    GIT_REPOSITORY https://github.com/51degrees/apachebench
    CMAKE_ARGS -DCMAKE_INSTALL_PREFIX=${EXTERNAL_INSTALL_LOCATION}
    GIT_TAG main
    STEP_TARGETS build
    EXCLUDE_FROM_ALL TRUE
)


# The User-Agents come from the data submodule, whose script downloads the
# file when it is missing.
set(DATA_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../cxx/data")
set(UA_FILE "20000 User Agents.csv")
execute_process(
    COMMAND sh "${DATA_DIR}/get-data-files.sh" "${UA_FILE}"
    RESULT_VARIABLE DATA_RESULT)
if(NOT DATA_RESULT EQUAL 0)
    message(FATAL_ERROR "${UA_FILE} could not be downloaded")
endif()
configure_file("${DATA_DIR}/device-detection/${UA_FILE}" uas.csv COPYONLY)

add_custom_target(perf ALL
    COMMAND cp ../runPerf.sh .
    DEPENDS ../runPerf.sh

    VERBATIM
)

add_dependencies(perf ApacheBench-build)

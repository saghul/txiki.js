#!/bin/bash

mkdir -p build
cd build
cmake ..
cd ..
make -C build


#!/bin/sh

set -e

if [ "$1" != "${1#-}" ]; then
    # if the first argument is an option like `--help` or `-h`
    exec tjs "$@"
fi

if [ "$1" = "repl" ]; then
    exec tjs
fi

case "$1" in
    run | eval | test )
    # if the first argument is a known command
    exec tjs "$@";;
esac

exec "$@"

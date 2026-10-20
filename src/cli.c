/*
 * txiki.js
 *
 * Copyright (c) 2019-present Saúl Ibarra Corretgé
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

#include "mem.h"
#include "tjs.h"

#ifdef _WIN32
#include <stdint.h>
#include <stdio.h>
#include <uv.h>
#include <windows.h>
/* Must come after windows.h. */
#include <shellapi.h>

/* The CRT hands main() its arguments in the ANSI code page, which mangles anything outside
 * it (e.g. CJK paths on a non-CJK locale, or anything at all on a GBK system). Rebuild argv
 * from the UTF-16 command line as WTF-8, which is what libuv expects for paths. */
static char **tjs__utf8_argv(int *argc_out) {
    int argc;
    wchar_t **wargv = CommandLineToArgvW(GetCommandLineW(), &argc);
    if (!wargv) {
        return NULL;
    }

    size_t total = (argc + 1) * sizeof(char *);
    for (int i = 0; i < argc; i++) {
        total += uv_utf16_length_as_wtf8((const uint16_t *) wargv[i], -1) + 1;
    }

    char **argv = tjs__malloc(total);
    if (!argv) {
        LocalFree(wargv);
        return NULL;
    }

    char *p = (char *) (argv + argc + 1);
    for (int i = 0; i < argc; i++) {
        size_t len = uv_utf16_length_as_wtf8((const uint16_t *) wargv[i], -1);
        argv[i] = p;
        uv_utf16_to_wtf8((const uint16_t *) wargv[i], -1, &p, &len);
        p += len + 1;
    }
    argv[argc] = NULL;

    LocalFree(wargv);
    *argc_out = argc;
    return argv;
}
#endif

int main(int argc, char **argv) {
#ifdef _WIN32
    argv = tjs__utf8_argv(&argc);
    if (!argv) {
        fprintf(stderr, "tjs: failed to read the command line\n");
        return 1;
    }
#endif

    TJS_Initialize(argc, argv);

#ifdef _WIN32
    tjs__free(argv);
#endif

    TJSRuntime *qrt = TJS_NewRuntime();
    if (!qrt) {
        return 1;
    }

    int exit_code = TJS_Run(qrt);

    TJS_FreeRuntime(qrt);

    return exit_code;
}

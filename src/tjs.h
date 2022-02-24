
/*
 * QuickJS libuv bindings
 *
 * Copyright (c) 2019-present Saúl Ibarra Corretgé <s@saghul.net>
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

#ifndef TJS_H
#define TJS_H

#include "utils.h"

#include <quickjs.h>
#include <stdbool.h>

typedef struct TJSRuntime TJSRuntime;

typedef struct TJSRunOptions {
    size_t mem_limit;
    size_t stack_size;
} TJSRunOptions;

void TJS_DefaultOptions(TJSRunOptions *options);
TJSRuntime *TJS_NewRuntime(void);
TJSRuntime *TJS_NewRuntimeOptions(TJSRunOptions *options);
void TJS_FreeRuntime(TJSRuntime *qrt);
void TJS_SetupArgs(int argc, char **argv);
JSContext *TJS_GetJSContext(TJSRuntime *qrt);
TJSRuntime *TJS_GetRuntime(JSContext *ctx);
int TJS_Run(TJSRuntime *qrt);
void TJS_Stop(TJSRuntime *qrt);
JSValue TJS_EvalModule(JSContext *ctx, const char *filename, bool is_main);
int TJS_RunMain(TJSRuntime *qrt, const char *filename);

#endif

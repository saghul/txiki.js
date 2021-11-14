/*
 * Copyright 2020 Koushik Dutta
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
 * 
 * Originally integrated from 
 * https://github.com/koush/vscode-quickjs-debug and
 * https://github.com/koush/quickjs
 * 
 */


#ifndef QUICKJS_DEBUGGER_H
#define QUICKJS_DEBUGGER_H

#include "config.h"
#include "quickjs.h"
#include <time.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct JSDebuggerFunctionInfo {
    // same length as byte_code_buf.
    uint8_t *breakpoints;
    uint32_t dirty;
    int last_line_num;
} JSDebuggerFunctionInfo;

typedef struct JSDebuggerLocation {
    JSAtom filename;
    int line;
    int column;
} JSDebuggerLocation;

#define JS_DEBUGGER_STEP 1
#define JS_DEBUGGER_STEP_IN 2
#define JS_DEBUGGER_STEP_OUT 3
#define JS_DEBUGGER_STEP_CONTINUE 4

typedef struct JSDebuggerInfo {
    // JSContext that is used to for the JSON transport and debugger state.
    JSContext *ctx;
    JSContext *debugging_ctx;
 
    int attempted_connect;
    int attempted_wait;
    int peek_ticks;
    int should_peek;
    char *message_buffer;
    int message_buffer_length;
    int is_debugging;
    int is_paused;

    size_t (*transport_read)(void *udata, char* buffer, size_t length);
    size_t (*transport_write)(void *udata, const char* buffer, size_t length);
    size_t (*transport_peek)(void *udata);
    void (*transport_close)(JSRuntime* rt, void *udata);
    void *transport_udata;

    JSValue breakpoints;
    int exception_breakpoint;
    uint32_t breakpoints_dirty_counter;
    int stepping;
    JSDebuggerLocation step_over;
    int step_depth;
} JSDebuggerInfo;

void js_debugger_new_context(JSContext *ctx);
void js_debugger_free_context(JSContext *ctx);
void js_debugger_check(JSContext *ctx, const uint8_t *pc);
void js_debugger_exception(JSContext* ctx);
void js_debugger_free(JSRuntime *rt, JSDebuggerInfo *info);

void js_debugger_attach(
    JSContext* ctx,
    size_t (*transport_read)(void *udata, char* buffer, size_t length),
    size_t (*transport_write)(void *udata, const char* buffer, size_t length),
    size_t (*transport_peek)(void *udata),
    void (*transport_close)(JSRuntime* rt, void *udata),
    void *udata
);
void js_debugger_connect(JSContext *ctx, const char *address);
void js_debugger_wait_connection(JSContext *ctx, const char* address);
int js_debugger_is_transport_connected(JSRuntime* rt);

JSValue js_debugger_file_breakpoints(JSContext *ctx, const char *path);
void js_debugger_cooperate(JSContext *ctx);

// begin internal api functions
// these functions all require access to quickjs internal structures.

JSDebuggerInfo *js_debugger_info(JSRuntime *rt);

// this may be able to be done with an Error backtrace,
// but would be clunky and require stack string parsing.
uint32_t js_debugger_stack_depth(JSContext *ctx);
JSValue js_debugger_build_backtrace(JSContext *ctx, const uint8_t *cur_pc);
JSDebuggerLocation js_debugger_current_location(JSContext *ctx, const uint8_t *cur_pc);

// checks to see if a breakpoint exists on the current pc.
// calls back into js_debugger_file_breakpoints.
int js_debugger_check_breakpoint(JSContext *ctx, uint32_t current_dirty, const uint8_t *cur_pc);

JSValue js_debugger_local_variables(JSContext *ctx, int stack_index);
JSValue js_debugger_closure_variables(JSContext *ctx, int stack_index);

// evaluates an expression at any stack frame. JS_Evaluate* only evaluates at the top frame.
JSValue js_debugger_evaluate(JSContext *ctx, int stack_index, JSValue expression);

// end internal api functions

#ifdef __cplusplus
}
#endif

#endif

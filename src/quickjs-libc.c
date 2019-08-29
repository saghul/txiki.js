/*
 * QuickJS C library
 *
 * Copyright (c) 2017-2019 Fabrice Bellard
 * Copyright (c) 2017-2019 Charlie Gordon
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

#include <string.h>
#include <uv.h>

#include "../deps/quickjs/src/cutils.h"
#include "quickjs-libc.h"
#include "quv.h"


static int eval_script_recurse;


/* load and evaluate a file */
static JSValue js_loadScript(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *filename;
    JSValue ret;

    filename = JS_ToCString(ctx, argv[0]);
    if (!filename)
        return JS_EXCEPTION;
    ret = QUV_EvalFile(ctx, filename, JS_EVAL_TYPE_GLOBAL);
    JS_FreeCString(ctx, filename);
    return ret;
}

typedef JSModuleDef *(JSInitModuleFunc)(JSContext *ctx, const char *module_name);

static JSValue js_std_exit(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    int status;
    if (JS_ToInt32(ctx, &status, argv[0]))
        status = -1;
    exit(status);
    return JS_UNDEFINED;
}

static JSValue js_std_gc(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    JS_RunGC(JS_GetRuntime(ctx));
    return JS_UNDEFINED;
}

static JSValue js_evalScript(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    const char *str;
    size_t len;
    JSValue ret;
    str = JS_ToCStringLen(ctx, &len, argv[0]);
    if (!str)
        return JS_EXCEPTION;
    if (++eval_script_recurse == 1) {
        /* TODO: install the interrupt handler */
    }
    ret = JS_Eval(ctx, str, len, "<evalScript>", JS_EVAL_TYPE_GLOBAL);
    JS_FreeCString(ctx, str);
    if (--eval_script_recurse == 0) {
        /* TODO: remove the interrupt handler */
        /* convert the uncatchable "interrupted" error into a normal error
           so that it can be caught by the REPL */
        if (JS_IsException(ret))
            JS_ResetUncatchableError(ctx);
    }
    return ret;
}

static const JSCFunctionListEntry js_std_funcs[] = {
    JS_CFUNC_DEF("exit", 1, js_std_exit),
    JS_CFUNC_DEF("gc", 0, js_std_gc),
    JS_CFUNC_DEF("evalScript", 1, js_evalScript),
    JS_CFUNC_DEF("loadScript", 1, js_loadScript),
};

static int js_std_init(JSContext *ctx, JSModuleDef *m) {
    JS_SetModuleExportList(ctx, m, js_std_funcs, countof(js_std_funcs));
    return 0;
}

JSModuleDef *js_init_module_std(JSContext *ctx, const char *module_name) {
    JSModuleDef *m;
    m = JS_NewCModule(ctx, module_name, js_std_init);
    if (!m)
        return NULL;
    JS_AddModuleExportList(ctx, m, js_std_funcs, countof(js_std_funcs));
    return m;
}

/**********************************************************/

static JSValue js_print(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    int i;
    const char *str;

    for (i = 0; i < argc; i++) {
        if (i != 0)
            putchar(' ');
        str = JS_ToCString(ctx, argv[i]);
        if (!str)
            return JS_EXCEPTION;
        fputs(str, stdout);
        JS_FreeCString(ctx, str);
    }
    putchar('\n');
    return JS_UNDEFINED;
}

void js_std_add_helpers(JSContext *ctx, int argc, char **argv) {
    JSValue global_obj, console, args;
    int i;

    /* XXX: should these global definitions be enumerable? */
    global_obj = JS_GetGlobalObject(ctx);

    JS_SetPropertyStr(ctx, global_obj, "global", JS_DupValue(ctx, global_obj));
    JS_SetPropertyStr(ctx, global_obj, "globalThis", JS_DupValue(ctx, global_obj));

    console = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, console, "log", JS_NewCFunction(ctx, js_print, "log", 1));
    JS_SetPropertyStr(ctx, global_obj, "console", console);

    /* same methods as the mozilla JS shell */
    args = JS_NewArray(ctx);
    for (i = 0; i < argc; i++) {
        JS_SetPropertyUint32(ctx, args, i, JS_NewString(ctx, argv[i]));
    }
    JS_SetPropertyStr(ctx, global_obj, "scriptArgs", args);

    JS_FreeValue(ctx, global_obj);
}

void js_std_dump_error(JSContext *ctx) {
    JSValue exception_val, val;
    const char *stack;
    BOOL is_error;

    exception_val = JS_GetException(ctx);
    is_error = JS_IsError(ctx, exception_val);
    if (!is_error)
        printf("Throw: ");
    js_print(ctx, JS_NULL, 1, (JSValueConst *) &exception_val);
    if (is_error) {
        val = JS_GetPropertyStr(ctx, exception_val, "stack");
        if (!JS_IsUndefined(val)) {
            stack = JS_ToCString(ctx, val);
            printf("%s\n", stack);
            JS_FreeCString(ctx, stack);
        }
        JS_FreeValue(ctx, val);
    }
    JS_FreeValue(ctx, exception_val);
}

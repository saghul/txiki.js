/*
 * txiki.js
 *
 * Copyright (c) 2019-present Saúl Ibarra Corretgé
 * Copyright (c) 2017-2018 Fabrice Bellard
 * Copyright (c) 2017-2018 Charlie Gordon
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

#include "private.h"
#include "tjs.h"
#include "version.h"

#include <stdarg.h>
#include <stdlib.h>
#include <string.h>

#define PROG_NAME "tjs"

#define EXIT_INVALID_ARG 2

#define OPT_PREFIX '-'
#define OPT_ASSIGN '='

#define is_longopt(opt, str) (opt.name && !strncmp(opt.name, str, opt.length))

typedef struct CLIOption {
    char key;
    char *name;
    size_t length;
} CLIOption;

typedef struct Flags {
    char *eval_expr;
} Flags;

static int eprintf(const char *format, ...) {
    va_list argp;
    va_start(argp, format);
    int ret = fprintf(stderr, "%s: ", PROG_NAME);
    ret += vfprintf(stderr, format, argp);
    va_end(argp);
    return ret;
}

static int eval_expr(JSContext *ctx, const char *buf) {
    int ret = 0;
    JSValue val = JS_Eval(ctx, buf, strlen(buf), "<cmdline>", JS_EVAL_TYPE_GLOBAL);

    if (JS_IsException(val)) {
        tjs_dump_error(ctx);
        ret = -1;
    }
    JS_FreeValue(ctx, val);
    return ret;
}

static void print_help(void) {
    printf("Usage: tjs [options] [file]\n"
           "\n"
           "Options:\n"
           "  -v, --version                   print tjs version\n"
           "  -h, --help                      list options\n"
           "  -e, --eval EXPR                 evaluate EXPR\n"
           "  --memory-limit LIMIT            set the memory limit\n"
           "  --stack-size STACKSIZE          set max stack size\n");
}

static void print_version() {
    printf("v%s\n", tjs_version());
}

static void report_bad_option(char *name) {
    eprintf("bad option -%s\n", name);
}

static void report_missing_argument(CLIOption *opt) {
    if (opt->key)
        eprintf("-%c requires an argument\n", opt->key);
    else
        eprintf("--%s requires an argument\n", opt->name);
}

static void report_unknown_option(CLIOption *opt) {
    if (opt->key)
        eprintf("unknown option -%c\n", opt->key);
    else
        eprintf("unknown option --%s\n", opt->name);
}

static size_t get_option_length(const char *arg) {
    const char *val_start = strchr(arg, OPT_ASSIGN);
    if (!val_start)
        val_start = arg + strlen(arg);
    return val_start - arg - 1;
}

static bool get_option(char **arg, CLIOption *opt) {
    /* a single `-` is not an option, it also stops argument scanning */
    if (!**arg)
        return false;
    opt->length = get_option_length(*arg);
    if (**arg == OPT_PREFIX) {
        opt->name = *arg + 1;
        /* `--` stops argument scanning */
        if (!*opt->name)
            return false;
        *arg += opt->length + 1;
    } else if (**arg) {
        opt->key = **arg;
        *arg += 1;
    }
    if (**arg == OPT_ASSIGN)
        *arg += 1;
    return true;
}

static char *get_option_value(char *arg, int argc, char **argv, int *optind) {
    if (*arg)
        return arg;
    if (*optind >= argc)
        return NULL;
    char *value = argv[*optind];
    if (*value == OPT_PREFIX)
        return NULL;
    *optind += 1;
    return value;
}

int main(int argc, char **argv) {
    TJSRuntime *qrt = NULL;
    JSContext *ctx = NULL;
    TJSRunOptions runOptions;
    int exit_code = EXIT_SUCCESS;

    TJS_DefaultOptions(&runOptions);

    Flags flags = { .eval_expr = NULL };

    TJS_SetupArgs(argc, argv);

    /* cannot use getopt because we want to pass the command line to the script */
    int optind = 1;
    while (optind < argc && *argv[optind] == OPT_PREFIX) {
        char *arg = argv[optind] + 1;
        CLIOption opt = { .key = 0, .name = NULL, .length = 0 };
        if (!get_option(&arg, &opt))
            break;
        optind += 1;
        /* combining short options is NOT supported */
        if (opt.key && opt.length > 0) {
            report_bad_option(arg - 1);
            exit_code = EXIT_INVALID_ARG;
            goto exit;
        }
        while (opt.key || *opt.name) {
            if (opt.key == 'v' || is_longopt(opt, "version")) {
                print_version();
                goto exit;
            }
            if (opt.key == 'h' || is_longopt(opt, "help")) {
                print_help();
                goto exit;
            }
            if (opt.key == 'e' || is_longopt(opt, "eval")) {
                flags.eval_expr = get_option_value(arg, argc, argv, &optind);
                if (flags.eval_expr)
                    break;
                report_missing_argument(&opt);
                exit_code = EXIT_INVALID_ARG;
                goto exit;
            }
            if (is_longopt(opt, "memory-limit")) {
                char *mem_limit = get_option_value(arg, argc, argv, &optind);
                if (mem_limit) {
                    long n = strtol(mem_limit, NULL, 10);
                    if (n > 0) {
                        runOptions.mem_limit = (size_t) n;
                        break;
                    }
                }
                report_missing_argument(&opt);
                exit_code = EXIT_INVALID_ARG;
                goto exit;
            }
            if (is_longopt(opt, "stack-size")) {
                char *stack_size = get_option_value(arg, argc, argv, &optind);
                if (stack_size) {
                    long n = strtol(stack_size, NULL, 10);
                    if (n > 0) {
                        runOptions.stack_size = (size_t) n;
                        break;
                    }
                }
                report_missing_argument(&opt);
                exit_code = EXIT_INVALID_ARG;
                goto exit;
            }
            report_unknown_option(&opt);
            exit_code = EXIT_INVALID_ARG;
            goto exit;
        }
    }

    qrt = TJS_NewRuntimeOptions(&runOptions);
    ctx = TJS_GetJSContext(qrt);

    if (flags.eval_expr) {
        if (eval_expr(ctx, flags.eval_expr)) {
            exit_code = EXIT_FAILURE;
            goto exit;
        }
    } else {
        const char *filepath = NULL;
        if (optind < argc) {
            filepath = argv[optind];
        }

        if (TJS_RunMain(qrt, filepath)) {
            exit_code = EXIT_FAILURE;
            goto exit;
        }
    }

    exit_code = TJS_Run(qrt);

exit:
    if (qrt && exit_code == 0) {
        // TODO: maybe mark the runtime as aborted and skip some steps?
        TJS_FreeRuntime(qrt);
    }
    return exit_code;
}

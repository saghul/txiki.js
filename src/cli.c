/*
 * QuickJS + libuv stand alone interpreter
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

#include <stdlib.h>
#include <string.h>

#define EXIT_INVALID_ARG 2

#define OPT_PREFIX '-'
#define OPT_ASSIGN '='

#define is_longopt(longopt, str, optlen) (longopt && !strncmp(longopt, str, optlen))

typedef struct CLIOptions {
    unsigned interactive, empty_run, strict_module_detection;
    char *eval_expr, *override_filename;
} CLIOptions;

static int eval_buf(JSContext *ctx, const char *buf, const char *filename, int eval_flags) {
    JSValue val;
    int ret = 0;

    val = JS_Eval(ctx, buf, strlen(buf), filename, eval_flags);
    if (JS_IsException(val)) {
        tjs_dump_error(ctx);
        ret = -1;
    }
    JS_FreeValue(ctx, val);
    return ret;
}

static int eval_module(JSContext *ctx, const char *filepath, char *override_filename, int eval_flags) {
    JSValue val;
    int ret = 0;

    val = TJS_EvalFile(ctx, filepath, eval_flags, true, override_filename);
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
           "  -v, --version                     print tjs version\n"
           "  -h, --help                        list options\n"
           "  -e, --eval EXPR                   evaluate EXPR\n"
           "  -i, --interactive                 go to interactive mode\n"
           "      --strict-module-detection     only run code as a module if its extension is \".mjs\"\n"
           "      --override-filename FILENAME  override filename in error messages\n"
           "  -q, --quit                        just instantiate the interpreter and quit\n");
}

static void print_version() {
    printf("v%s\n", tjs_version());
}

static void report_missing_argument(char opt, const char *longopt) {
    if (opt)
        fprintf(stderr, "tjs: -%c requires an argument\n", opt);
    else
        fprintf(stderr, "tjs: --%s requires an argument\n", longopt);
}

static void report_unknown_option(char opt, const char *longopt) {
    if (opt)
        fprintf(stderr, "tjs: unknown option -%c\n", opt);
    else
        fprintf(stderr, "tjs: unknown option --%s\n", longopt);
}

static int get_option_length(const char *arg) {
    const char *val_start = strchr(arg, OPT_ASSIGN);
    if (!val_start)
        val_start = arg + strlen(arg);
    return (int) (val_start - arg - 1);
}

static int get_option(char **arg, char *opt, char **longopt, int *optlen) {
    /* a single `-` is not an option, it also stops argument scanning */
    if (!**arg)
        return false;
    *optlen = get_option_length(*arg);
    if (**arg == OPT_PREFIX) {
        *longopt = *arg + 1;
        /* `--` stops argument scanning */
        if (!**longopt)
            return false;
        *arg += *optlen + 1;
    } else if (**arg) {
        *opt = **arg;
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
    *optind += 1;
    return value;
}

int main(int argc, char **argv) {
    TJSRuntime *qrt = NULL;
    JSContext *ctx = NULL;
    int exit_code = EXIT_SUCCESS;

    CLIOptions opts = { .interactive = false,
                        .empty_run = false,
                        .strict_module_detection = false,
                        .eval_expr = NULL,
                        .override_filename = NULL };

    TJS_SetupArgs(argc, argv);

    /* cannot use getopt because we want to pass the command line to the script */
    int optind = 1;
    while (optind < argc && *argv[optind] == OPT_PREFIX) {
        char *arg = argv[optind] + 1;
        char opt = 0;
        char *longopt = NULL;
        int optlen = 0;
        if (!get_option(&arg, &opt, &longopt, &optlen))
            break;
        optind += 1;
        while (opt || *longopt) {
            if (opt == 'v' || is_longopt(longopt, "version", optlen)) {
                print_version();
                goto exit;
            }
            if (opt == 'h' || is_longopt(longopt, "help", optlen)) {
                print_help();
                goto exit;
            }
            if (opt == 'e' || is_longopt(longopt, "eval", optlen)) {
                opts.eval_expr = get_option_value(arg, argc, argv, &optind);
                if (opts.eval_expr)
                    break;
                report_missing_argument(opt, longopt);
                exit_code = EXIT_INVALID_ARG;
                goto exit;
            }
            if (is_longopt(longopt, "override-filename", optlen) || is_longopt(longopt, "overrideFilename", optlen)) {
                opts.override_filename = get_option_value(arg, argc, argv, &optind);
                if (opts.override_filename)
                    break;
                report_missing_argument(opt, longopt);
                exit_code = EXIT_INVALID_ARG;
                goto exit;
            }
            if (opt == 'i' || is_longopt(longopt, "interactive", optlen)) {
                opts.interactive = true;
                break;
            }
            if (opt == 'q' || is_longopt(longopt, "quit", optlen)) {
                opts.empty_run = true;
                break;
            }
            if (is_longopt(longopt, "strict-module-detection", optlen) ||
                is_longopt(longopt, "strictModuleDetection", optlen)) {
                opts.strict_module_detection = true;
                break;
            }
            report_unknown_option(opt, longopt);
            exit_code = EXIT_INVALID_ARG;
            goto exit;
        }
    }

    qrt = TJS_NewRuntime();
    ctx = TJS_GetJSContext(qrt);

    if (opts.empty_run)
        goto exit;

    if (opts.eval_expr) {
        if (eval_buf(ctx, opts.eval_expr, "<cmdline>", JS_EVAL_TYPE_GLOBAL)) {
            exit_code = EXIT_FAILURE;
            goto exit;
        }
    } else if (optind >= argc) {
        /* interactive mode */
        opts.interactive = true;
    } else {
        const char *filepath = argv[optind];
        int eval_flags = JS_EVAL_TYPE_MODULE;
        if (opts.strict_module_detection && !has_suffix(filepath, ".mjs"))
            eval_flags = JS_EVAL_TYPE_GLOBAL;
        if (eval_module(ctx, filepath, opts.override_filename, eval_flags)) {
            exit_code = EXIT_FAILURE;
            goto exit;
        }
    }

    if (opts.interactive)
        TJS_RunRepl(ctx);
    TJS_Run(qrt);

exit:
    if (qrt)
        TJS_FreeRuntime(qrt);
    return exit_code;
}

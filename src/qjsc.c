/* clang-format off */

/*
 * QuickJS command line compiler
 *
 * Copyright (c) 2018-2019 Fabrice Bellard
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
#include "../deps/quickjs/cutils.h"
#include "quickjs.h"

#include <assert.h>
#include <errno.h>
#include <inttypes.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

/* BEGIN: copied over from quickjs-libc to avoid dependency. */

uint8_t *js_load_file(JSContext *ctx, size_t *pbuf_len, const char *filename) {
    FILE *f;
    uint8_t *buf;
    size_t buf_len;

    f = fopen(filename, "rb");
    if (!f)
        return NULL;
    fseek(f, 0, SEEK_END);
    buf_len = ftell(f);
    fseek(f, 0, SEEK_SET);
    buf = js_malloc(ctx, buf_len + 1);
    fread(buf, 1, buf_len, f);
    buf[buf_len] = '\0';
    fclose(f);
    *pbuf_len = buf_len;
    return buf;
}

void js_std_dump_error(JSContext *ctx) {
    JSValue exception_val, val;
    const char *exc, *stack;
    BOOL is_error;

    exception_val = JS_GetException(ctx);
    is_error = JS_IsError(ctx, exception_val);
    if (!is_error)
        printf("Throw: ");
    exc = JS_ToCString(ctx, exception_val);
    printf("%s\n", exc);
    JS_FreeCString(ctx, exc);
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

/* END: copied over from quickjs-libc to avoid dependency. */


typedef struct {
    char *name;
    char *short_name;
    int flags;
} namelist_entry_t;

typedef struct namelist_t {
    namelist_entry_t *array;
    int count;
    int size;
} namelist_t;

static namelist_t cname_list;
static namelist_t cmodule_list;
static namelist_t init_module_list;
static FILE *outfile;
static int strip;

void namelist_add(namelist_t *lp, const char *name, const char *short_name, int flags) {
    namelist_entry_t *e;
    if (lp->count == lp->size) {
        size_t newsize = lp->size + (lp->size >> 1) + 4;
        namelist_entry_t *a = realloc(lp->array, sizeof(lp->array[0]) * newsize);
        /* XXX: check for realloc failure */
        lp->array = a;
        lp->size = newsize;
    }
    e = &lp->array[lp->count++];
    e->name = strdup(name);
    if (short_name)
        e->short_name = strdup(short_name);
    else
        e->short_name = NULL;
    e->flags = flags;
}

void namelist_free(namelist_t *lp) {
    while (lp->count > 0) {
        namelist_entry_t *e = &lp->array[--lp->count];
        free(e->name);
        free(e->short_name);
    }
    free(lp->array);
    lp->array = NULL;
    lp->size = 0;
}

namelist_entry_t *namelist_find(namelist_t *lp, const char *name) {
    int i;
    for (i = 0; i < lp->count; i++) {
        namelist_entry_t *e = &lp->array[i];
        if (!strcmp(e->name, name))
            return e;
    }
    return NULL;
}

static void get_c_name(char *buf, size_t buf_size, const char *file) {
    const char *p, *r;
    size_t len, i;

    p = strrchr(file, '/');
    if (!p)
        p = file;
    else
        p++;
    r = strrchr(p, '.');
    if (!r)
        r = p + strlen(p);
    len = r - p;
    if (len > buf_size - 1)
        len = buf_size - 1;
    memcpy(buf, p, len);
    for (i = 0; i < len; i++) {
        if (buf[i] == '-')
            buf[i] = '_';
    }
    buf[len] = '\0';
    /* Note: could also try to avoid using C keywords */
}

static void dump_hex(FILE *f, const uint8_t *buf, size_t len) {
    size_t i, col;
    col = 0;
    for (i = 0; i < len; i++) {
        fprintf(f, " 0x%02x,", buf[i]);
        if (++col == 8) {
            fprintf(f, "\n");
            col = 0;
        }
    }
    if (col != 0)
        fprintf(f, "\n");
}

static void output_object_code(JSContext *ctx,
                               FILE *fo,
                               JSValue obj,
                               const char *c_name,
                               const char *prefix,
                               BOOL load_only) {
    uint8_t *out_buf;
    size_t out_buf_len;
    int flags;
    flags = JS_WRITE_OBJ_BYTECODE;
    if (strip) {
        flags |= JS_WRITE_OBJ_STRIP_SOURCE;
        if (strip > 1)
            flags |= JS_WRITE_OBJ_STRIP_DEBUG;
    }
    out_buf = JS_WriteObject(ctx, &out_buf_len, obj, flags);
    if (!out_buf) {
        js_std_dump_error(ctx);
        exit(1);
    }

    namelist_add(&cname_list, c_name, NULL, load_only);

    fprintf(fo, "const uint32_t %s%s_size = %u;\n\n", prefix, c_name, (unsigned int) out_buf_len);
    fprintf(fo, "const uint8_t %s%s[%u] = {\n", prefix, c_name, (unsigned int) out_buf_len);
    dump_hex(fo, out_buf, out_buf_len);
    fprintf(fo, "};\n\n");

    js_free(ctx, out_buf);
}

static int js_module_dummy_init(JSContext *ctx, JSModuleDef *m) {
    /* should never be called when compiling JS code */
    abort();
}

JSModuleDef *jsc_module_loader(JSContext *ctx, const char *module_name, void *opaque) {
    static const char prefix[] = "tjs:";

    JSModuleDef *m;
    namelist_entry_t *e;

    /* check if it's a builtin */
    if (strncmp(prefix, module_name, sizeof(prefix) - 1) == 0) {
        return JS_NewCModule(ctx, module_name, js_module_dummy_init);
    }

    /* check if it is a declared C or system module */
    e = namelist_find(&cmodule_list, module_name);
    if (e) {
        /* add in the static init module list */
        namelist_add(&init_module_list, e->name, e->short_name, 0);
        /* create a dummy module */
        m = JS_NewCModule(ctx, module_name, js_module_dummy_init);
    } else {
        JS_ThrowReferenceError(ctx, "could not load module filename '%s'", module_name);
        return NULL;
    }
    return m;
}

static void compile_file(JSContext *ctx, FILE *fo, const char *filename, int module, const char *prefix, const char *modname) {
    uint8_t *buf;
    char c_name[1024];
    int eval_flags;
    JSValue obj;
    size_t buf_len;

    buf = js_load_file(ctx, &buf_len, filename);
    if (!buf) {
        fprintf(stderr, "Could not load '%s'\n", filename);
        exit(1);
    }
    eval_flags = JS_EVAL_FLAG_COMPILE_ONLY;
    if (module < 0) {
        module = JS_DetectModule((const char *) buf, buf_len);
    }
    if (module)
        eval_flags |= JS_EVAL_TYPE_MODULE;
    else
        eval_flags |= JS_EVAL_TYPE_GLOBAL;

    get_c_name(c_name, sizeof(c_name), filename);

    obj = JS_Eval(ctx, (const char *) buf, buf_len, modname, eval_flags);
    if (JS_IsException(obj)) {
        js_std_dump_error(ctx);
        exit(1);
    }
    js_free(ctx, buf);
    output_object_code(ctx, fo, obj, c_name, prefix, FALSE);
    JS_FreeValue(ctx, obj);
}


void help(void) {
    printf("QuickJS Compiler version %s\n"
           "usage: qjsc [options] [files]\n"
           "\n"
           "options are:\n"
           "-o output   set the output filename\n"
           "-p prefix   set a prefix for the generated variables\n"
           "-n name     set the module name\n"
           "-m          compile as Javascript module (default=autodetect)\n"
           "-s          strip source code (if -ss is specified debugging info is also stripped)\n",
           JS_GetVersion());
    exit(1);
}


int main(int argc, char **argv) {
    int c, i;
    const char *out_filename;
    const char *out_var_prefix;
    const char *modname;
    char cfilename[1024];
    FILE *fo;
    JSRuntime *rt;
    JSContext *ctx;
    int module;

    out_filename = NULL;
    out_var_prefix = NULL;
    modname = NULL;
    module = -1;
    strip = 0;

    for (;;) {
        c = getopt(argc, argv, "ho:p:n:ms");
        if (c == -1)
            break;
        switch (c) {
            case 'h':
                help();
            case 'o':
                out_filename = optarg;
                break;
            case 'p':
                out_var_prefix = optarg;
                break;
            case 'n':
                modname = optarg;
                break;
            case 'm':
                module = 1;
                break;
            case 's':
                strip++;
                break;
            default:
                break;
        }
    }

    if (optind >= argc)
        help();

    if (!out_filename)
        out_filename = "out.c";

    pstrcpy(cfilename, sizeof(cfilename), out_filename);

    fo = fopen(cfilename, "w");
    if (!fo) {
        perror(cfilename);
        exit(1);
    }
    outfile = fo;

    rt = JS_NewRuntime();
    ctx = JS_NewContext(rt);

    /* loader for ES6 modules */
    JS_SetModuleLoaderFunc(rt, NULL, jsc_module_loader, NULL);

    fprintf(fo,
            "/* File generated automatically by the QuickJS compiler. */\n"
            "\n"
            "#include <inttypes.h>\n"
            "\n");

    for (i = optind; i < argc; i++) {
        const char *filename = argv[i];
        compile_file(ctx, fo, filename, module, out_var_prefix, modname);
    }

    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);

    fclose(fo);

    namelist_free(&cname_list);
    namelist_free(&cmodule_list);
    namelist_free(&init_module_list);
    return 0;
}

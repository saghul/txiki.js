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
 
#ifndef QUV_UTILS_H
#define QUV_UTILS_H

#include <uv.h>
#include "../quickjs-libuv.h"


struct AssertionInfo {
  const char* file_line;  // filename:line
  const char* message;
  const char* function;
};

#define ERROR_AND_ABORT(expr)                                                 \
  do {                                                                        \
    static const struct AssertionInfo args = {                                 \
      __FILE__ ":" STRINGIFY(__LINE__), #expr, PRETTY_FUNCTION_NAME           \
    };                                                                        \
    quv_assert(args);                                                       \
  } while (0)

#ifdef __GNUC__
#define LIKELY(expr) __builtin_expect(!!(expr), 1)
#define UNLIKELY(expr) __builtin_expect(!!(expr), 0)
#define PRETTY_FUNCTION_NAME __PRETTY_FUNCTION__
#else
#define LIKELY(expr) expr
#define UNLIKELY(expr) expr
#define PRETTY_FUNCTION_NAME ""
#endif

#define STRINGIFY_(x) #x
#define STRINGIFY(x) STRINGIFY_(x)

#define CHECK(expr)                                                           \
  do {                                                                        \
    if (UNLIKELY(!(expr))) {                                                  \
      ERROR_AND_ABORT(expr);                                                  \
    }                                                                         \
  } while (0)

#define CHECK_EQ(a, b) CHECK((a) == (b))
#define CHECK_GE(a, b) CHECK((a) >= (b))
#define CHECK_GT(a, b) CHECK((a) > (b))
#define CHECK_LE(a, b) CHECK((a) <= (b))
#define CHECK_LT(a, b) CHECK((a) < (b))
#define CHECK_NE(a, b) CHECK((a) != (b))
#define CHECK_NULL(val) CHECK((val) == NULL)
#define CHECK_NOT_NULL(val) CHECK((val) != NULL)

void quv_assert(const struct AssertionInfo info);

#define QUV_CONST(x) JS_PROP_INT32_DEF(#x, x, JS_PROP_CONFIGURABLE )

uv_loop_t *quv_get_loop(JSContext *ctx);
int quv_obj2addr(JSContext *ctx, JSValueConst obj, struct sockaddr_storage *ss);
JSValue quv_addr2obj(JSContext *ctx, const struct sockaddr *sa);
void quv_call_handler(JSContext *ctx, JSValueConst func);
void quv_dump_error(JSContext *ctx);
JSValue QUV_NewResolvedPromise(JSContext *ctx, JSValueConst arg);
JSValue QUV_NewRejectedPromise(JSContext *ctx, JSValueConst arg);
void JS_FreePropEnum(JSContext *ctx, JSPropertyEnum *tab, uint32_t len);

#endif
#include "objecturl.h"

#include <string.h>

JSValue tjs__get_objecturl_text(JSContext *ctx, const char *url_str) {
    JSValue text = JS_UNDEFINED;
    JSValue global_obj = JS_GetGlobalObject(ctx);
    JSValue urls = JS_GetPropertyStr(ctx, global_obj, "objectURLs");
    JSValue get_func = JS_GetPropertyStr(ctx, urls, "get");

    if (JS_IsFunction(ctx, get_func)) {
        JSValue url = JS_NewString(ctx, url_str);
        JSValue argv[1] = { url };
        JSValue text_promise = JS_Call(ctx, get_func, urls, 1, argv);
        int state;

        // wait for the promise to resolve (may be already resolved)
        for (;;) {
            state = JS_PromiseState(ctx, text_promise);
            if (state == JS_PROMISE_FULFILLED) {
                text = JS_PromiseResult(ctx, text_promise);
                break;
            } else if (state == JS_PROMISE_REJECTED) {
                text = JS_Throw(ctx, JS_PromiseResult(ctx, text_promise));
                break;
            } else if (state == JS_PROMISE_PENDING) {
                JSContext *ctx1;
                int err;
                err = JS_ExecutePendingJob(JS_GetRuntime(ctx), &ctx1);
                if (err < 0) {
                    tjs_dump_error(ctx1);
                }
            } else {
                /* not a promise */
                break;
            }
        }

        JS_FreeValue(ctx, url);
        JS_FreeValue(ctx, text_promise);
    }

    JS_FreeValue(ctx, get_func);
    JS_FreeValue(ctx, urls);
    JS_FreeValue(ctx, global_obj);

    return text;
}

BOOL tjs__is_objecturl_url(const char *url) {
    return strncmp(url, "blob:", 5) == 0;
}

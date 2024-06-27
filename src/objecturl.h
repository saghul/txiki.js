#ifndef TJS_OBJECTURL_H
#define TJS_OBJECTURL_H

#include "private.h"

BOOL tjs__is_objecturl_url(const char *url);

JSValue tjs__get_objecturl_text(JSContext *ctx, const char *url);

#endif
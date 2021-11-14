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

#include "quickjs-debugger.h"
#include <stdlib.h>
#include <string.h>
#include <assert.h>

typedef struct DebuggerSuspendedState {
    uint32_t variable_reference_count;
    JSValue variable_references;
    JSValue variable_pointers;
    const uint8_t *cur_pc;
} DebuggerSuspendedState;

static int js_transport_read_fully(JSDebuggerInfo *info, char *buffer, size_t length) {
    int offset = 0;
    while (offset < length) {
        int received = info->transport_read(info->transport_udata, buffer + offset, length - offset);
        if (received <= 0)
            return 0;
        offset += received;
    }

    return 1;
}

static int js_transport_write_fully(JSDebuggerInfo *info, const char *buffer, size_t length) {
    int offset = 0;
    while (offset < length) {
        int sent = info->transport_write(info->transport_udata, buffer + offset, length - offset);
        if (sent <= 0)
            return 0;
        offset += sent;
    }

    return 1;
}

static int js_transport_write_message_newline(JSDebuggerInfo *info, const char* value, size_t len) {
    // length prefix is 8 hex followed by newline = 012345678\n
    // not efficient, but protocol is then human readable.
    char message_length[10];
    message_length[9] = '\0';
    sprintf(message_length, "%08x\n", (int)len + 1);
    if (!js_transport_write_fully(info, message_length, 9))
        return 0;
    int ret = js_transport_write_fully(info, value, len);
    if (!ret)
        return ret;
    char newline[2] = { '\n', '\0' };
    return js_transport_write_fully(info, newline, 1);
}

static int js_transport_write_value(JSDebuggerInfo *info, JSValue value) {
    JSValue stringified = JS_JSONStringify(info->ctx, value, JS_UNDEFINED, JS_UNDEFINED);
    size_t len;
    const char* str = JS_ToCStringLen(info->ctx, &len, stringified);
    int ret = 0;
    if (len)
        ret = js_transport_write_message_newline(info, str, len);
    // else send error somewhere?
    JS_FreeCString(info->ctx, str);
    JS_FreeValue(info->ctx, stringified);
    JS_FreeValue(info->ctx, value);
    return ret;
}

static JSValue js_transport_new_envelope(JSDebuggerInfo *info, const char *type) {
    JSValue ret = JS_NewObject(info->ctx);
    JS_SetPropertyStr(info->ctx, ret, "type", JS_NewString(info->ctx, type));
    return ret;
}

static int js_transport_send_event(JSDebuggerInfo *info, JSValue event) {
    JSValue envelope = js_transport_new_envelope(info, "event");
    JS_SetPropertyStr(info->ctx, envelope, "event", event);
    return js_transport_write_value(info, envelope);
}

static int js_transport_send_response(JSDebuggerInfo *info, JSValue request, JSValue body) {
    JSContext *ctx = info->ctx;
    JSValue envelope = js_transport_new_envelope(info, "response");
    JS_SetPropertyStr(ctx, envelope, "body", body);
    JS_SetPropertyStr(ctx, envelope, "request_seq", JS_GetPropertyStr(ctx, request, "request_seq"));
    return js_transport_write_value(info, envelope);
}

static JSValue js_get_scopes(JSContext *ctx, int frame) {
    // for now this is always the same.
    // global, local, closure. may change in the future. can check if closure is empty.

    JSValue scopes = JS_NewArray(ctx);

    int scope_count = 0;

    JSValue local = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, local, "name", JS_NewString(ctx, "Local"));
    JS_SetPropertyStr(ctx, local, "reference", JS_NewInt32(ctx, (frame << 2) + 1));
    JS_SetPropertyStr(ctx, local, "expensive", JS_FALSE);
    JS_SetPropertyUint32(ctx, scopes, scope_count++, local);

    JSValue closure = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, closure, "name", JS_NewString(ctx, "Closure"));
    JS_SetPropertyStr(ctx, closure, "reference", JS_NewInt32(ctx, (frame << 2) + 2));
    JS_SetPropertyStr(ctx, closure, "expensive", JS_FALSE);
    JS_SetPropertyUint32(ctx, scopes, scope_count++, closure);

    JSValue global = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, global, "name", JS_NewString(ctx, "Global"));
    JS_SetPropertyStr(ctx, global, "reference", JS_NewInt32(ctx, (frame << 2) + 0));
    JS_SetPropertyStr(ctx, global, "expensive", JS_TRUE);
    JS_SetPropertyUint32(ctx, scopes, scope_count++, global);

    return scopes;
}

static inline JS_BOOL JS_IsInteger(JSValueConst v)
{
    int tag = JS_VALUE_GET_TAG(v);
    return tag == JS_TAG_INT || tag == JS_TAG_BIG_INT;
}

static void js_debugger_get_variable_type(JSContext *ctx,
        struct DebuggerSuspendedState *state,
        JSValue var, JSValue var_val) {

    // 0 means not expandible
    uint32_t reference = 0;
    if (JS_IsString(var_val))
        JS_SetPropertyStr(ctx, var, "type", JS_NewString(ctx, "string"));
    else if (JS_IsInteger(var_val))
        JS_SetPropertyStr(ctx, var, "type", JS_NewString(ctx, "integer"));
    else if (JS_IsNumber(var_val) || JS_IsBigFloat(var_val))
        JS_SetPropertyStr(ctx, var, "type", JS_NewString(ctx, "float"));
    else if (JS_IsBool(var_val))
        JS_SetPropertyStr(ctx, var, "type", JS_NewString(ctx, "boolean"));
    else if (JS_IsNull(var_val))
        JS_SetPropertyStr(ctx, var, "type", JS_NewString(ctx, "null"));
    else if (JS_IsUndefined(var_val))
        JS_SetPropertyStr(ctx, var, "type", JS_NewString(ctx, "undefined"));
    else if (JS_IsObject(var_val)) {
        JS_SetPropertyStr(ctx, var, "type", JS_NewString(ctx, "object"));

        JSObject *p = JS_VALUE_GET_OBJ(var_val);
        // todo: xor the the two dwords to get a better hash?
        uint32_t pl = (uint32_t)(uint64_t)p;
        JSValue found = JS_GetPropertyUint32(ctx, state->variable_pointers, pl);
        if (JS_IsUndefined(found)) {
            reference = state->variable_reference_count++;
            JS_SetPropertyUint32(ctx, state->variable_references, reference, JS_DupValue(ctx, var_val));
            JS_SetPropertyUint32(ctx, state->variable_pointers, pl, JS_NewInt32(ctx, reference));
        }
        else {
            JS_ToUint32(ctx, &reference, found);
        }
        JS_FreeValue(ctx, found);
    }
    JS_SetPropertyStr(ctx, var, "variablesReference", JS_NewInt32(ctx, reference));
}

static void js_debugger_get_value(JSContext *ctx, JSValue var_val, JSValue var, const char *value_property) {
    // do not toString on Arrays, since that makes a giant string of all the elements.
    // todo: typed arrays?
    if (JS_IsArray(ctx, var_val)) {
        JSValue length = JS_GetPropertyStr(ctx, var_val, "length");
        uint32_t len;
        JS_ToUint32(ctx, &len, length);
        JS_FreeValue(ctx, length);
        char lenBuf[64];
        sprintf(lenBuf, "Array (%d)", len);
        JS_SetPropertyStr(ctx, var, value_property, JS_NewString(ctx, lenBuf));
        JS_SetPropertyStr(ctx, var, "indexedVariables", JS_NewInt32(ctx, len));
    }
    else {
        JS_SetPropertyStr(ctx, var, value_property, JS_ToString(ctx, var_val));
    }
}

static JSValue js_debugger_get_variable(JSContext *ctx,
    struct DebuggerSuspendedState *state,
    JSValue var_name, JSValue var_val) {
    JSValue var = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, var, "name", var_name);
    js_debugger_get_value(ctx, var_val, var, "value");
    js_debugger_get_variable_type(ctx, state, var, var_val);
    return var;
}

static int js_debugger_get_frame(JSContext *ctx, JSValue args) {
    JSValue reference_property = JS_GetPropertyStr(ctx, args, "frameId");
    int frame;
    JS_ToInt32(ctx, &frame, reference_property);
    JS_FreeValue(ctx, reference_property);

    return frame;
}

static void js_send_stopped_event(JSDebuggerInfo *info, const char *reason) {
    JSContext *ctx = info->debugging_ctx;

    JSValue event = JS_NewObject(ctx);
    // better thread id?
    JS_SetPropertyStr(ctx, event, "type", JS_NewString(ctx, "StoppedEvent"));
    JS_SetPropertyStr(ctx, event, "reason", JS_NewString(ctx, reason));
    int64_t id = (int64_t)info->ctx;
    JS_SetPropertyStr(ctx, event, "thread", JS_NewInt64(ctx, id));
    js_transport_send_event(info, event);
}

static void js_free_prop_enum(JSContext *ctx, JSPropertyEnum *tab, uint32_t len)
{
    uint32_t i;
    if (tab) {
        for(i = 0; i < len; i++)
            JS_FreeAtom(ctx, tab[i].atom);
        js_free(ctx, tab);
    }
}

static uint32_t js_get_property_as_uint32(JSContext *ctx, JSValue obj, const char* property) {
    JSValue prop = JS_GetPropertyStr(ctx, obj, property);
    uint32_t ret;
    JS_ToUint32(ctx, &ret, prop);
    JS_FreeValue(ctx, prop);
    return ret;
}

static void js_process_request(JSDebuggerInfo *info, struct DebuggerSuspendedState *state, JSValue request) {
    JSContext *ctx = info->ctx;
    JSValue command_property = JS_GetPropertyStr(ctx, request, "command");
    const char *command = JS_ToCString(ctx, command_property);
    if (strcmp("continue", command) == 0) {
        info->stepping = JS_DEBUGGER_STEP_CONTINUE;
        info->step_over = js_debugger_current_location(ctx, state->cur_pc);
        info->step_depth = js_debugger_stack_depth(ctx);
        js_transport_send_response(info, request, JS_UNDEFINED);
        info->is_paused = 0;
    }
    if (strcmp("pause", command) == 0) {
        js_transport_send_response(info, request, JS_UNDEFINED);
        js_send_stopped_event(info, "pause");
        info->is_paused = 1;
    }
    else if (strcmp("next", command) == 0) {
        info->stepping = JS_DEBUGGER_STEP;
        info->step_over = js_debugger_current_location(ctx, state->cur_pc);
        info->step_depth = js_debugger_stack_depth(ctx);
        js_transport_send_response(info, request, JS_UNDEFINED);
        info->is_paused = 0;
    }
    else if (strcmp("stepIn", command) == 0) {
        info->stepping = JS_DEBUGGER_STEP_IN;
        info->step_over = js_debugger_current_location(ctx, state->cur_pc);
        info->step_depth = js_debugger_stack_depth(ctx);
        js_transport_send_response(info, request, JS_UNDEFINED);
        info->is_paused = 0;
    }
    else if (strcmp("stepOut", command) == 0) {
        info->stepping = JS_DEBUGGER_STEP_OUT;
        info->step_over = js_debugger_current_location(ctx, state->cur_pc);
        info->step_depth = js_debugger_stack_depth(ctx);
        js_transport_send_response(info, request, JS_UNDEFINED);
        info->is_paused = 0;
    }
    else if (strcmp("evaluate", command) == 0) {
        JSValue args = JS_GetPropertyStr(ctx, request, "args");
        int frame = js_debugger_get_frame(ctx, args);
        JSValue expression = JS_GetPropertyStr(ctx, args, "expression");
        JS_FreeValue(ctx, args);
        JSValue result = js_debugger_evaluate(ctx, frame, expression);
        if (JS_IsException(result)) {
            JS_FreeValue(ctx, result);
            result = JS_GetException(ctx);
        }
        JS_FreeValue(ctx, expression);

        JSValue body = JS_NewObject(ctx);
        js_debugger_get_value(ctx, result, body, "result");
        js_debugger_get_variable_type(ctx, state, body, result);
        JS_FreeValue(ctx, result);
        js_transport_send_response(info, request, body);
    }
    else if (strcmp("stackTrace", command) == 0) {
        JSValue stack_trace = js_debugger_build_backtrace(ctx, state->cur_pc);
        js_transport_send_response(info, request, stack_trace);
    }
    else if (strcmp("scopes", command) == 0) {
        JSValue args = JS_GetPropertyStr(ctx, request, "args");
        int frame = js_debugger_get_frame(ctx, args);
        JS_FreeValue(ctx, args);
        JSValue scopes = js_get_scopes(ctx, frame);
        js_transport_send_response(info, request, scopes);
    }
    else if (strcmp("variables", command) == 0) {
        JSValue args = JS_GetPropertyStr(ctx, request, "args");
        JSValue reference_property = JS_GetPropertyStr(ctx, args, "variablesReference");
        JS_FreeValue(ctx, args);
        uint32_t reference;
        JS_ToUint32(ctx, &reference, reference_property);
        JS_FreeValue(ctx, reference_property);

        JSValue properties = JS_NewArray(ctx);

        JSValue variable = JS_GetPropertyUint32(ctx, state->variable_references, reference);

        int skip_proto = 0;
        // if the variable reference was not found,
        // then it must be a frame locals, frame closures, or the global
        if (JS_IsUndefined(variable)) {
            skip_proto = 1;
            int frame = reference >> 2;
            int scope = reference % 4;

            assert(frame < js_debugger_stack_depth(ctx));

            if (scope == 0)
                variable = JS_GetGlobalObject(ctx);
            else if (scope == 1)
                variable = js_debugger_local_variables(ctx, frame);
            else if (scope == 2)
                variable = js_debugger_closure_variables(ctx, frame);
            else
                assert(0);

            // need to dupe the variable, as it's used below as well.
            JS_SetPropertyUint32(ctx, state->variable_references, reference, JS_DupValue(ctx, variable));
        }

        JSPropertyEnum *tab_atom;
        uint32_t tab_atom_count;

        JSValue filter = JS_GetPropertyStr(ctx, args, "filter");
        if (!JS_IsUndefined(filter)) {
            const char *filter_str = JS_ToCString(ctx, filter);
            JS_FreeValue(ctx, filter);
            // only index filtering is supported by this server.
            // name filtering exists in VS Code, but is not implemented here.
            int indexed = strcmp(filter_str, "indexed") == 0;
            JS_FreeCString(ctx, filter_str);
            if (!indexed)
                goto unfiltered;

            uint32_t start = js_get_property_as_uint32(ctx, args, "start");
            uint32_t count = js_get_property_as_uint32(ctx, args, "count");

            char name_buf[64];
            for (uint32_t i = 0; i < count; i++) {
                JSValue value = JS_GetPropertyUint32(ctx, variable, start + i);
                sprintf(name_buf, "%d", i);
                JSValue variable_json = js_debugger_get_variable(ctx, state, JS_NewString(ctx, name_buf), value);
                JS_FreeValue(ctx, value);
                JS_SetPropertyUint32(ctx, properties, i, variable_json);
            }
            goto done;
        }

    unfiltered:

        if (!JS_GetOwnPropertyNames(ctx, &tab_atom, &tab_atom_count, variable,
            JS_GPN_STRING_MASK | JS_GPN_SYMBOL_MASK)) {

            int offset = 0;

            if (!skip_proto) {
                const JSValue proto = JS_GetPrototype(ctx, variable);
                if (!JS_IsException(proto)) {
                    JSValue variable_json = js_debugger_get_variable(ctx, state, JS_NewString(ctx, "__proto__"), proto);
                    JS_FreeValue(ctx, proto);
                    JS_SetPropertyUint32(ctx, properties, offset++, variable_json);
                }
                else {
                    JS_FreeValue(ctx, proto);
                }
            }

            for(int i = 0; i < tab_atom_count; i++) {
                JSValue value = JS_GetProperty(ctx, variable, tab_atom[i].atom);
                JSValue variable_json = js_debugger_get_variable(ctx, state, JS_AtomToString(ctx, tab_atom[i].atom), value);
                JS_FreeValue(ctx, value);
                JS_SetPropertyUint32(ctx, properties, i + offset, variable_json);
            }

            js_free_prop_enum(ctx, tab_atom, tab_atom_count);
        }

    done:
        JS_FreeValue(ctx, variable);

        js_transport_send_response(info, request, properties);
    }
    JS_FreeCString(ctx, command);
    JS_FreeValue(ctx, command_property);
    JS_FreeValue(ctx, request);
}

static void js_process_breakpoints(JSDebuggerInfo *info, JSValue message) {
    JSContext *ctx = info->ctx;

    // force all functions to reprocess their breakpoints.
    info->breakpoints_dirty_counter++;

    JSValue path_property = JS_GetPropertyStr(ctx, message, "path");
    const char *path = JS_ToCString(ctx, path_property);
    JSValue path_data = JS_GetPropertyStr(ctx, info->breakpoints, path);

    if (!JS_IsUndefined(path_data))
        JS_FreeValue(ctx, path_data);
    // use an object to store the breakpoints as a sparse array, basically.
    // this will get resolved into a pc array mirror when its detected as dirty.
    path_data = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, info->breakpoints, path, path_data);
    JS_FreeCString(ctx, path);
    JS_FreeValue(ctx, path_property);

    JSValue breakpoints = JS_GetPropertyStr(ctx, message, "breakpoints");
    JS_SetPropertyStr(ctx, path_data, "breakpoints", breakpoints);
    JS_SetPropertyStr(ctx, path_data, "dirty", JS_NewInt32(ctx, info->breakpoints_dirty_counter));

    JS_FreeValue(ctx, message);
}

JSValue js_debugger_file_breakpoints(JSContext *ctx, const char* path) {
    JSDebuggerInfo *info = js_debugger_info(JS_GetRuntime(ctx));
    JSValue path_data = JS_GetPropertyStr(ctx, info->breakpoints, path);
    return path_data;    
}

static int js_process_debugger_messages(JSDebuggerInfo *info, const uint8_t *cur_pc) {
    // continue processing messages until the continue message is received.
    JSContext *ctx = info->ctx;
    struct DebuggerSuspendedState state;
    state.variable_reference_count = js_debugger_stack_depth(ctx) << 2;
    state.variable_pointers = JS_NewObject(ctx);
    state.variable_references = JS_NewObject(ctx);
    state.cur_pc = cur_pc;
    int ret = 0;
    char message_length_buf[10];

    do {
        fflush(stdout);
        fflush(stderr);

        // length prefix is 8 hex followed by newline = 012345678\n
		// not efficient, but protocol is then human readable.
        if (!js_transport_read_fully(info, message_length_buf, 9))
            goto done;

        message_length_buf[8] = '\0';
        int message_length = strtol(message_length_buf, NULL, 16);
        assert(message_length > 0);
        if (message_length > info->message_buffer_length) {
            if (info->message_buffer) {
                js_free(ctx, info->message_buffer);
                info->message_buffer = NULL;
                info->message_buffer_length = 0;
            }

            // extra for null termination (debugger inspect, etc)
            info->message_buffer = js_malloc_rt(JS_GetRuntime(ctx), message_length + 1);
            info->message_buffer_length = message_length;
        }

        if (!js_transport_read_fully(info, info->message_buffer, message_length))
            goto done;
        
        info->message_buffer[message_length] = '\0';

        JSValue message = JS_ParseJSON(ctx, info->message_buffer, message_length, "<debugger>");
        JSValue vtype = JS_GetPropertyStr(ctx, message, "type");
        const char *type = JS_ToCString(ctx, vtype);
        if (strcmp("request", type) == 0) {
            js_process_request(info, &state, JS_GetPropertyStr(ctx, message, "request"));
            // done_processing = 1;
        }
        else if (strcmp("continue", type) == 0) {
            info->is_paused = 0;
        }
        else if (strcmp("breakpoints", type) == 0) {
            js_process_breakpoints(info, JS_GetPropertyStr(ctx, message, "breakpoints"));
        }
        else if (strcmp("stopOnException", type) == 0) {
            JSValue stop = JS_GetPropertyStr(ctx, message, "stopOnException");
            info->exception_breakpoint = JS_ToBool(ctx, stop);
            JS_FreeValue(ctx, stop);
        }

        JS_FreeCString(ctx, type);
        JS_FreeValue(ctx, vtype);
        JS_FreeValue(ctx, message);
    }
    while (info->is_paused);

    ret = 1;

done:
    JS_FreeValue(ctx, state.variable_references);
    JS_FreeValue(ctx, state.variable_pointers);
    return ret;
}

void js_debugger_exception(JSContext *ctx) {
    JSDebuggerInfo *info = js_debugger_info(JS_GetRuntime(ctx));
    if (!info->exception_breakpoint)
        return;
    if (info->is_debugging)
        return;
    info->is_debugging = 1;
    info->ctx = ctx;
    js_send_stopped_event(info, "exception");
    info->is_paused = 1;
    js_process_debugger_messages(info, NULL);
    info->is_debugging = 0;
    info->ctx = NULL;
}

static void js_debugger_context_event(JSContext *caller_ctx, const char *reason) {
    if (!js_debugger_is_transport_connected(JS_GetRuntime(caller_ctx)))
        return;

    JSDebuggerInfo *info = js_debugger_info(JS_GetRuntime(caller_ctx));
    if (info->debugging_ctx == caller_ctx)
        return;

    JSContext *ctx = info->debugging_ctx;

    JSValue event = JS_NewObject(ctx);
    // better thread id?
    JS_SetPropertyStr(ctx, event, "type", JS_NewString(ctx, "ThreadEvent"));
    JS_SetPropertyStr(ctx, event, "reason", JS_NewString(ctx, reason));
    JS_SetPropertyStr(ctx, event, "thread", JS_NewInt64(ctx, (int64_t)caller_ctx));
    js_transport_send_event(info, event);
}

void js_debugger_new_context(JSContext *ctx) {
    js_debugger_context_event(ctx, "new");
}

void js_debugger_free_context(JSContext *ctx) {
    js_debugger_context_event(ctx, "exited");
}

// in thread check request/response of pending commands.
// todo: background thread that reads the socket.
void js_debugger_check(JSContext* ctx, const uint8_t *cur_pc) {
    JSDebuggerInfo *info = js_debugger_info(JS_GetRuntime(ctx));
    if (info->is_debugging)
        return;
    if (info->debugging_ctx == ctx)
        return;
    info->is_debugging = 1;
    info->ctx = ctx;

    if (!info->attempted_connect) {
        info->attempted_connect = 1;
        char *address = getenv("QUICKJS_DEBUG_ADDRESS");
        if (address != NULL && !info->transport_close)
            js_debugger_connect(ctx, address);
    }
    else if (!info->attempted_wait) {
        info->attempted_wait = 1;
        char *address = getenv("QUICKJS_DEBUG_LISTEN_ADDRESS");
        if (address != NULL && !info->transport_close)
            js_debugger_wait_connection(ctx, address);
    }

    if (info->transport_close == NULL)
        goto done;

    struct JSDebuggerLocation location;
    int depth;

    // perform stepping checks prior to the breakpoint check
    // as those need to preempt breakpoint behavior to skip their last
    // position, which may be a breakpoint.
    if (info->stepping) {
        // all step operations need to ignore their step location, as those
        // may be on a breakpoint.
        location = js_debugger_current_location(ctx, cur_pc);
        depth = js_debugger_stack_depth(ctx);
        if (info->step_depth == depth
            && location.filename == info->step_over.filename
            && location.line == info->step_over.line
            && location.column == info->step_over.column)
            goto done;
    }

    int at_breakpoint = js_debugger_check_breakpoint(ctx, info->breakpoints_dirty_counter, cur_pc);
    if (at_breakpoint) {
        // reaching a breakpoint resets any existing stepping.
        info->stepping = 0;
        info->is_paused = 1;
        js_send_stopped_event(info, "breakpoint");
    }
    else if (info->stepping) {
        if (info->stepping == JS_DEBUGGER_STEP_CONTINUE) {
            // continue needs to proceed over the existing statement (which may be multiple ops)
            // once any change in location is detecting, turn off stepping.
            // since reaching here after performing the check above, that is in fact the case.
            // turn off stepping.
            info->stepping = 0;
        }
        else if (info->stepping == JS_DEBUGGER_STEP_IN) {
            int depth = js_debugger_stack_depth(ctx);
            // break if the stack is deeper
            // or
            // break if the depth is the same, but the location has changed
            // or
            // break if the stack unwinds
            if (info->step_depth == depth) {
                struct JSDebuggerLocation location = js_debugger_current_location(ctx, cur_pc);
                if (location.filename == info->step_over.filename
                    && location.line == info->step_over.line
                    && location.column == info->step_over.column)
                    goto done;
            }
            info->stepping = 0;
            info->is_paused = 1;
            js_send_stopped_event(info, "stepIn");
        }
        else if (info->stepping == JS_DEBUGGER_STEP_OUT) {
            int depth = js_debugger_stack_depth(ctx);
            if (depth >= info->step_depth)
                goto done;
            info->stepping = 0;
            info->is_paused = 1;
            js_send_stopped_event(info, "stepOut");
        }
        else if (info->stepping == JS_DEBUGGER_STEP) {
            struct JSDebuggerLocation location = js_debugger_current_location(ctx, cur_pc);
            // to step over, need to make sure the location changes,
            // and that the location change isn't into a function call (deeper stack).
            if ((location.filename == info->step_over.filename
                && location.line == info->step_over.line
                && location.column == info->step_over.column)
                || js_debugger_stack_depth(ctx) > info->step_depth)
                goto done;
            info->stepping = 0;
            info->is_paused = 1;
            js_send_stopped_event(info, "step");
        }
        else {
            // ???
            info->stepping = 0;
        }
    }

    // if not paused, we ought to peek at the stream
    // and read it without blocking until all data is consumed.
    if (!info->is_paused) {
        // only peek at the stream every now and then.
        if (info->peek_ticks++ < 10000 && !info->should_peek)
            goto done;

        info->peek_ticks = 0;
        info->should_peek = 0;

        // continue peek/reading until there's nothing left.
        // breakpoints may arrive outside of a debugger pause.
        // once paused, fall through to handle the pause.
        while (!info->is_paused) {
            int peek = info->transport_peek(info->transport_udata);
            if (peek < 0)
                goto fail;
            if (peek == 0)
                goto done;
            if (!js_process_debugger_messages(info, cur_pc))
                goto fail;
        }
    }

    if (js_process_debugger_messages(info, cur_pc))
        goto done;

    fail: 
        js_debugger_free(JS_GetRuntime(ctx), info);
    done:
        info->is_debugging = 0;
        info->ctx = NULL;
}

void js_debugger_free(JSRuntime *rt, JSDebuggerInfo *info) {
    if (!info->transport_close)
        return;

    // don't use the JSContext because it might be in a funky state during teardown.
    const char* terminated = "{\"type\":\"event\",\"event\":{\"type\":\"terminated\"}}";
    js_transport_write_message_newline(info, terminated, strlen(terminated));

    info->transport_close(rt, info->transport_udata);

    info->transport_read = NULL;
    info->transport_write = NULL;
    info->transport_peek = NULL;
    info->transport_close = NULL;

    if (info->message_buffer) {
        js_free_rt(rt, info->message_buffer);
        info->message_buffer = NULL;
        info->message_buffer_length = 0;
    }

    JS_FreeValue(info->debugging_ctx, info->breakpoints);

    JS_FreeContext(info->debugging_ctx);
    info->debugging_ctx = NULL;
}

void js_debugger_attach(
    JSContext* ctx,
    size_t (*transport_read)(void *udata, char* buffer, size_t length),
    size_t (*transport_write)(void *udata, const char* buffer, size_t length),
    size_t (*transport_peek)(void *udata),
    void (*transport_close)(JSRuntime* rt, void *udata),
    void *udata
) {
    JSRuntime *rt = JS_GetRuntime(ctx);
    JSDebuggerInfo *info = js_debugger_info(rt);
    js_debugger_free(rt, info);

    info->debugging_ctx = JS_NewContext(rt);
    info->transport_read = transport_read;
    info->transport_write = transport_write;
    info->transport_peek = transport_peek;
    info->transport_close = transport_close;
    info->transport_udata = udata;

    JSContext *original_ctx = info->ctx;
    info->ctx = ctx;

    js_send_stopped_event(info, "entry");

    info->breakpoints = JS_NewObject(info->debugging_ctx);
    info->is_paused = 1;

    js_process_debugger_messages(info, NULL);

    info->ctx = original_ctx;
}

int js_debugger_is_transport_connected(JSRuntime *rt) {
    return js_debugger_info(rt)->transport_close != NULL;
}

void js_debugger_cooperate(JSContext *ctx) {
    js_debugger_info(JS_GetRuntime(ctx))->should_peek = 1;
}
/*
 * txiki.js
 *
 * Copyright (c) 2022-present Saúl Ibarra Corretgé <s@saghul.net>
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
#include "utils.h"
#include "version.h"
#include "wasm.h"


static JSValue tjs_network_interfaces(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    uv_interface_address_t *interfaces;
    int count;
    int r = uv_interface_addresses(&interfaces, &count);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    JSValue val = JS_NewArray(ctx);

    for (int i = 0; i < count; i++) {
        uv_interface_address_t iface = interfaces[i];
        char mac[18];
        char buf[INET6_ADDRSTRLEN + 1];

        JSValue addr = JS_NewObjectProto(ctx, JS_NULL);

        JS_DefinePropertyValueStr(ctx, addr, "name", JS_NewString(ctx, iface.name), JS_PROP_C_W_E);

        snprintf(mac,
                 sizeof(mac),
                 "%02x:%02x:%02x:%02x:%02x:%02x",
                 (unsigned char)iface.phys_addr[0],
                 (unsigned char)iface.phys_addr[1],
                 (unsigned char)iface.phys_addr[2],
                 (unsigned char)iface.phys_addr[3],
                 (unsigned char)iface.phys_addr[4],
                 (unsigned char)iface.phys_addr[5]);
        JS_DefinePropertyValueStr(ctx, addr, "mac", JS_NewString(ctx, mac), JS_PROP_C_W_E);

        if (iface.address.address4.sin_family == AF_INET) {
            uv_ip4_name(&iface.address.address4, buf, sizeof(buf));
        } else if (iface.address.address4.sin_family == AF_INET6) {
            uv_ip6_name(&iface.address.address6, buf, sizeof(buf));
            JS_DefinePropertyValueStr(ctx, addr, "scopeId", JS_NewUint32(ctx, iface.address.address6.sin6_scope_id), JS_PROP_C_W_E);
        }
        JS_DefinePropertyValueStr(ctx, addr, "address", JS_NewString(ctx, buf), JS_PROP_C_W_E);

        if (iface.netmask.netmask4.sin_family == AF_INET) {
            uv_ip4_name(&iface.netmask.netmask4, buf, sizeof(buf));
        } else if (iface.netmask.netmask4.sin_family == AF_INET6) {
            uv_ip6_name(&iface.netmask.netmask6, buf, sizeof(buf));
        }
        JS_DefinePropertyValueStr(ctx, addr, "netmask", JS_NewString(ctx, buf), JS_PROP_C_W_E);

        JS_DefinePropertyValueStr(ctx, addr, "internal", JS_NewBool(ctx, iface.is_internal), JS_PROP_C_W_E);

        JS_SetPropertyUint32(ctx, val, i, addr);
    }

    uv_free_interface_addresses(interfaces, count);

    return val;
}

static const JSCFunctionListEntry tjs_os_funcs[] = {
    JS_CFUNC_DEF("networkInterfaces", 0, tjs_network_interfaces),
};

void tjs_mod_os_init(JSContext *ctx, JSModuleDef *m) {
    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);
    JS_SetPropertyFunctionList(ctx, obj, tjs_os_funcs, countof(tjs_os_funcs));
    JS_SetModuleExport(ctx, m, "os", obj);
}

void tjs_mod_os_export(JSContext *ctx, JSModuleDef *m) {
    JS_AddModuleExport(ctx, m, "os");
}


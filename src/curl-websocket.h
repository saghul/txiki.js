/* clang-format off */

/*
 * Copyright (C) 2016 Gustavo Sverzut Barbieri
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use, copy,
 * modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
 * BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
 * ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
/* c-mode: linux-4 */

#ifndef _CURL_WEBSOCKET_H_
#define _CURL_WEBSOCKET_H_ 1

#include <curl/curl.h>
#include <string.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* see https://tools.ietf.org/html/rfc6455#section-7.4.1 */
enum cws_close_reason {
    CWS_CLOSE_REASON_NORMAL               = 1000,
    CWS_CLOSE_REASON_GOING_AWAY           = 1001,
    CWS_CLOSE_REASON_PROTOCOL_ERROR       = 1002,
    CWS_CLOSE_REASON_UNEXPECTED_DATA      = 1003,
    CWS_CLOSE_REASON_NO_REASON            = 1005,
    CWS_CLOSE_REASON_ABRUPTLY             = 1006,
    CWS_CLOSE_REASON_INCONSISTENT_DATA    = 1007,
    CWS_CLOSE_REASON_POLICY_VIOLATION     = 1008,
    CWS_CLOSE_REASON_TOO_BIG              = 1009,
    CWS_CLOSE_REASON_MISSING_EXTENSION    = 1010,
    CWS_CLOSE_REASON_SERVER_ERROR         = 1011,
    CWS_CLOSE_REASON_IANA_REGISTRY_START  = 3000,
    CWS_CLOSE_REASON_IANA_REGISTRY_END    = 3999,
    CWS_CLOSE_REASON_PRIVATE_START        = 4000,
    CWS_CLOSE_REASON_PRIVATE_END          = 4999
};

struct cws_callbacks {
    /**
     * called upon connection, websocket_protocols contains what
     * server reported as 'Sec-WebSocket-Protocol:'.
     *
     * @note It is not validated if matches the proposed protocols.
     */
    void (*on_connect)(void *data, CURL *easy, const char *websocket_protocols);
    /**
     * reports UTF-8 text messages.
     *
     * @note it's guaranteed to be NULL (\0) terminated, but the UTF-8 is
     * not validated. If it's invalid, consider closing the connection
     * with #CWS_CLOSE_REASON_INCONSISTENT_DATA.
     */
    void (*on_text)(void *data, CURL *easy, const char *text, size_t len);
    /**
     * reports binary data.
     */
    void (*on_binary)(void *data, CURL *easy, const void *mem, size_t len);
    /**
     * reports PING.
     *
     * @note if provided you should reply with cws_pong(). If not
     * provided, pong is sent with the same message payload.
     */
    void (*on_ping)(void *data, CURL *easy, const char *reason, size_t len);
    /**
     * reports PONG.
     */
    void (*on_pong)(void *data, CURL *easy, const char *reason, size_t len);
    /**
     * reports server closed the connection with the given reason.
     *
     * Clients should not transmit any more data after the server is
     * closed, just call cws_free().
     */
    void (*on_close)(void *data, CURL *easy, enum cws_close_reason reason, const char *reason_text, size_t reason_text_len);
    const void *data;
};

/**
 * Create a new CURL-based WebSocket handle.
 *
 * This is a regular CURL easy handle properly setup to do
 * WebSocket. You can add more headers and cookies, but do @b not mess
 * with the following headers:
 *  @li Content-Length
 *  @li Content-Type
 *  @li Transfer-Encoding
 *  @li Connection
 *  @li Upgrade
 *  @li Expect
 *  @li Sec-WebSocket-Version
 *  @li Sec-WebSocket-Key
 *
 * And do not change the HTTP method or version, callbacks (read,
 * write or header) or private data.
 *
 * @param url the URL to connect, such as ws://echo.websockets.org
 * @param websocket_protocols #NULL or something like "chat", "superchat"...
 * @param callbacks set of functions to call back when server report events.
 *
 * @return newly created CURL easy handle, free with cws_free()
 */
CURL *cws_new(const char *url, const char *websocket_protocols, const struct cws_callbacks *callbacks);

/**
 * Free a handle created with cws_new()
 */
void cws_free(CURL *easy);

/**
 * Send a text or binary message of given size.
 *
 * Text messages do not need to include the null terminator (\0), they
 * will be read up to @a msglen.
 *
 * @param easy the CURL easy handle created with cws_new()
 * @param text if #true, opcode will be 0x1 (text-frame), otherwise
 *        opcode will be 0x2 (binary-frame).
 * @param msg the pointer to memory (linear) to send.
 * @param msglen the length in bytes of @a msg.
 *
 * @return #true if sent, #false on errors.
 *
 * @see cws_send_binary()
 * @see cws_send_text()
 */
bool cws_send(CURL *easy, bool text, const void *msg, size_t msglen);

/**
 * Helper over cws_send() to send binary messages.
 */
static inline bool cws_send_binary(CURL *easy, const void *msg, size_t msglen) {
    return cws_send(easy, false, msg, msglen);
}

/**
 * Helper over cws_send() to send text (UTF-8) messages, will use
 * strlen() on string.
 */
static inline bool cws_send_text(CURL *easy, const char *string) {
    return cws_send(easy, true, string, strlen(string));
}

/**
 * Send a PING (opcode 0x9) frame with @a reason as payload.
 *
 * @param easy the CURL easy handle created with cws_new()
 * @param reason #NULL or some UTF-8 string null ('\0') terminated.
 * @param len the length of @a reason in bytes. If #SIZE_MAX, uses
 *        strlen() on @a reason if it's not #NULL.
 * @return #true if sent, #false on errors.
 */
bool cws_ping(CURL *easy, const char *reason, size_t len);

/**
 * Send a PONG (opcode 0xA) frame with @a reason as payload.
 *
 * Note that pong is sent automatically if no "on_ping" callback is
 * defined. If one is defined you must send pong manually.
 *
 * @param easy the CURL easy handle created with cws_new()
 * @param reason #NULL or some UTF-8 string null ('\0') terminated.
 * @param len the length of @a reason in bytes. If #SIZE_MAX, uses
 *        strlen() on @a reason if it's not #NULL.
 * @return #true if sent, #false on errors.
 */
bool cws_pong(CURL *easy, const char *reason, size_t len);

/**
 * Send a CLOSE (opcode 0x8) frame with @a reason as payload.
 *
 * @param easy the CURL easy handle created with cws_new()
 * @param reason the reason why it was closed, see the well-known numbers.
 * @param reason_text #NULL or some UTF-8 string null ('\0') terminated.
 * @param reason_text_len the length of @a reason_text in bytes. If
 *        #SIZE_MAX, uses strlen() on @a reason_text if it's not
 *        #NULL.
 * @return #true if sent, #false on errors.
 */
bool cws_close(CURL *easy, enum cws_close_reason reason, const char *reason_text, size_t reason_text_len);

/**
 * Add a header field/value pair
 *
 * @param easy the CURL easy handle created with cws_new()
 * @param field the header field
 * @param value the header value
 */
void cws_add_header(CURL *easy, const char field[],  const char value[]);

#ifdef __cplusplus
}
#endif

#endif

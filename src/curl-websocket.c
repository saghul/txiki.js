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
#include "curl-websocket.h"
#include <stdio.h>
#include <stdlib.h>
#include <strings.h>
#include <stdint.h>
#include <stdbool.h>
#include <unistd.h>
#include <fcntl.h>
#include <ctype.h>
#include <inttypes.h>
#include <errno.h>
#include <time.h>

#include "curl-websocket-utils.c"

#define STR_OR_EMPTY(p) (p != NULL ? p : "")

/* Temporary buffer size to use during WebSocket masking.
 * stack-allocated
 */
#define CWS_MASK_TMPBUF_SIZE 4096

enum cws_opcode {
    CWS_OPCODE_CONTINUATION = 0x0,
    CWS_OPCODE_TEXT = 0x1,
    CWS_OPCODE_BINARY = 0x2,
    CWS_OPCODE_CLOSE = 0x8,
    CWS_OPCODE_PING = 0x9,
    CWS_OPCODE_PONG = 0xa,
};

static bool
cws_opcode_is_control(enum cws_opcode opcode)
{
    switch (opcode) {
    case CWS_OPCODE_CONTINUATION:
    case CWS_OPCODE_TEXT:
    case CWS_OPCODE_BINARY:
        return false;
    case CWS_OPCODE_CLOSE:
    case CWS_OPCODE_PING:
    case CWS_OPCODE_PONG:
        return true;
    }

    return true;
}

static bool
cws_close_reason_is_valid(enum cws_close_reason r)
{
    switch (r) {
    case CWS_CLOSE_REASON_NORMAL:
    case CWS_CLOSE_REASON_GOING_AWAY:
    case CWS_CLOSE_REASON_PROTOCOL_ERROR:
    case CWS_CLOSE_REASON_UNEXPECTED_DATA:
    case CWS_CLOSE_REASON_INCONSISTENT_DATA:
    case CWS_CLOSE_REASON_POLICY_VIOLATION:
    case CWS_CLOSE_REASON_TOO_BIG:
    case CWS_CLOSE_REASON_MISSING_EXTENSION:
    case CWS_CLOSE_REASON_SERVER_ERROR:
    case CWS_CLOSE_REASON_IANA_REGISTRY_START:
    case CWS_CLOSE_REASON_IANA_REGISTRY_END:
    case CWS_CLOSE_REASON_PRIVATE_START:
    case CWS_CLOSE_REASON_PRIVATE_END:
        return true;
    case CWS_CLOSE_REASON_NO_REASON:
    case CWS_CLOSE_REASON_ABRUPTLY:
        return false;
    }

    if (r >= CWS_CLOSE_REASON_IANA_REGISTRY_START && r <= CWS_CLOSE_REASON_IANA_REGISTRY_END)
        return true;

    if (r >= CWS_CLOSE_REASON_PRIVATE_START && r <= CWS_CLOSE_REASON_PRIVATE_END)
        return true;

    return false;
}

/*
 * WebSocket is a framed protocol in the format:
 *
 *    0                   1                   2                   3
 *    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *   +-+-+-+-+-------+-+-------------+-------------------------------+
 *   |F|R|R|R| opcode|M| Payload len |    Extended payload length    |
 *   |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
 *   |N|V|V|V|       |S|             |   (if payload len==126/127)   |
 *   | |1|2|3|       |K|             |                               |
 *   +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
 *   |     Extended payload length continued, if payload len == 127  |
 *   + - - - - - - - - - - - - - - - +-------------------------------+
 *   |                               |Masking-key, if MASK set to 1  |
 *   +-------------------------------+-------------------------------+
 *   | Masking-key (continued)       |          Payload Data         |
 *   +-------------------------------- - - - - - - - - - - - - - - - +
 *   :                     Payload Data continued ...                :
 *   + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
 *   |                     Payload Data continued ...                |
 *   +---------------------------------------------------------------+
 *
 * See https://tools.ietf.org/html/rfc6455#section-5.2
 */
struct cws_frame_header {
    /* first byte: fin + opcode */
    uint8_t opcode : 4;
    uint8_t _reserved : 3;
    uint8_t fin : 1;

    /* second byte: mask + payload length */
    uint8_t payload_len : 7; /* if 126, uses extra 2 bytes (uint16_t)
                              * if 127, uses extra 8 bytes (uint64_t)
                              * if <=125 is self-contained
                              */
    uint8_t mask : 1; /* if 1, uses 4 extra bytes */
};

struct cws_data {
    CURL *easy;
    struct cws_callbacks cbs;
    struct {
        char *requested;
        char *received;
    } websocket_protocols;
    struct curl_slist *headers;
    char accept_key[29];
    struct {
        struct {
            uint8_t *payload;
            uint64_t used;
            uint64_t total;
            enum cws_opcode opcode;
            bool fin;
        } current;
        struct {
            uint8_t *payload;
            uint64_t used;
            uint64_t total;
            enum cws_opcode opcode;
        } fragmented;

        uint8_t tmpbuf[sizeof(struct cws_frame_header) + sizeof(uint64_t)];
        uint8_t done; /* of tmpbuf, for header */
        uint8_t needed; /* of tmpbuf, for header */
    } recv;
    struct {
        uint8_t *buffer;
        size_t len;
    } send;
    uint8_t dispatching;
    uint8_t pause_flags;
    bool accepted;
    bool upgraded;
    bool connection_websocket;
    bool closed;
    bool deleted;
    time_t start;
};

static bool
_cws_write(struct cws_data *priv, const void *buffer, size_t len)
{
    /* optimization note: we could grow by some rounded amount (ie:
     * next power-of-2, 4096/pagesize...) and if using
     * priv->send.position, do the memmove() here to free up some
     * extra space without realloc() (see _cws_send_data()).
     */
    //_cws_debug("WRITE", buffer, len);
    uint8_t *tmp = realloc(priv->send.buffer, priv->send.len + len);
    if (!tmp)
        return false;
    memcpy(tmp + priv->send.len, buffer, len);
    priv->send.buffer = tmp;
    priv->send.len += len;
    if (priv->pause_flags & CURLPAUSE_SEND) {
        priv->pause_flags &= ~CURLPAUSE_SEND;
        curl_easy_pause(priv->easy, priv->pause_flags);
    }
    return true;
}

/*
 * Mask is:
 *
 *     for i in len:
 *         output[i] = input[i] ^ mask[i % 4]
 *
 * Here a temporary buffer is used to reduce number of "write" calls
 * and pointer arithmetic to avoid counters.
 */
static bool
_cws_write_masked(struct cws_data *priv, const uint8_t mask[static 4], const void *buffer, size_t len)
{
    const uint8_t *itr_begin = buffer;
    const uint8_t *itr = itr_begin;
    const uint8_t *itr_end = itr + len;
    uint8_t tmpbuf[CWS_MASK_TMPBUF_SIZE];

    while (itr < itr_end) {
        uint8_t *o = tmpbuf, *o_end = tmpbuf + sizeof(tmpbuf);
        for (; o < o_end && itr < itr_end; o++, itr++) {
            *o = *itr ^ mask[(itr - itr_begin) & 0x3];
        }
        if (!_cws_write(priv, tmpbuf, o - tmpbuf))
            return false;
    }

    return true;
}

static bool
_cws_send(struct cws_data *priv, enum cws_opcode opcode, const void *msg, size_t msglen)
{
    struct cws_frame_header fh = {
        .fin = 1, /* TODO review if should fragment over some boundary */
        .opcode = opcode,
        .mask = 1,
        .payload_len = ((msglen > UINT16_MAX) ? 127 :
                        (msglen > 125) ? 126 : msglen),
    };
    uint8_t mask[4];

    if (priv->closed) {
        fprintf(stderr,"cannot send data to closed WebSocket connection %p", priv->easy);
        return false;
    }

    _cws_get_random(mask, sizeof(mask));

    if (!_cws_write(priv, &fh, sizeof(fh)))
        return false;

    if (fh.payload_len == 127) {
        uint64_t payload_len = msglen;
        _cws_hton(&payload_len, sizeof(payload_len));
        if (!_cws_write(priv, &payload_len, sizeof(payload_len)))
            return false;
    } else if (fh.payload_len == 126) {
        uint16_t payload_len = msglen;
        _cws_hton(&payload_len, sizeof(payload_len));
        if (!_cws_write(priv, &payload_len, sizeof(payload_len)))
            return false;
    }

    if (!_cws_write(priv, mask, sizeof(mask)))
        return false;

    return _cws_write_masked(priv, mask, msg, msglen);
}

bool
cws_send(CURL *easy, bool text, const void *msg, size_t msglen)
{
    struct cws_data *priv;
    char *p = NULL;

    curl_easy_getinfo(easy, CURLINFO_PRIVATE, &p); /* checks for char* */
    if (!p) {
        fprintf(stderr,"not CWS (no CURLINFO_PRIVATE): %p", easy);
        return false;
    }
    priv = (struct cws_data *)p;

    return _cws_send(priv, text ? CWS_OPCODE_TEXT : CWS_OPCODE_BINARY,
                     msg, msglen);
}

bool
cws_ping(CURL *easy, const char *reason, size_t len)
{
    struct cws_data *priv;
    char *p = NULL;

    curl_easy_getinfo(easy, CURLINFO_PRIVATE, &p); /* checks for char* */
    if (!p) {
        fprintf(stderr,"not CWS (no CURLINFO_PRIVATE): %p", easy);
        return false;
    }
    priv = (struct cws_data *)p;

    if (len == SIZE_MAX) {
        if (reason)
            len = strlen(reason);
        else
            len = 0;
    }

    return _cws_send(priv, CWS_OPCODE_PING, reason, len);
}

bool
cws_pong(CURL *easy, const char *reason, size_t len)
{
    struct cws_data *priv;
    char *p = NULL;

    curl_easy_getinfo(easy, CURLINFO_PRIVATE, &p); /* checks for char* */
    if (!p) {
        fprintf(stderr,"not CWS (no CURLINFO_PRIVATE): %p", easy);
        return false;
    }
    priv = (struct cws_data *)p;

    if (len == SIZE_MAX) {
        if (reason)
            len = strlen(reason);
        else
            len = 0;
    }

    return _cws_send(priv, CWS_OPCODE_PONG, reason, len);
}

static void
_cws_cleanup(struct cws_data *priv)
{
    CURL *easy;

    if (priv->dispatching > 0)
        return;

    if (!priv->deleted)
        return;

    easy = priv->easy;

    curl_slist_free_all(priv->headers);

    free(priv->websocket_protocols.requested);
    free(priv->websocket_protocols.received);
    free(priv->send.buffer);
    free(priv->recv.current.payload);
    free(priv->recv.fragmented.payload);
    free(priv);

    curl_easy_cleanup(easy);
}

bool
cws_close(CURL *easy, enum cws_close_reason reason, const char *reason_text, size_t reason_text_len)
{
    struct cws_data *priv;
    size_t len;
    uint16_t r;
    bool ret;
    char *p = NULL;

    curl_easy_getinfo(easy, CURLINFO_PRIVATE, &p); /* checks for char* */
    if (!p) {
        fprintf(stderr,"not CWS (no CURLINFO_PRIVATE): %p", easy);
        return false;
    }
    priv = (struct cws_data *)p;

    /* give 15 seconds to terminate connection @todo configurable */
    long runtime_sec = (long)(time(NULL) - priv->start);
    curl_easy_setopt(easy, CURLOPT_TIMEOUT, (long)(runtime_sec + 15L));

    if (reason == 0) {
        ret = _cws_send(priv, CWS_OPCODE_CLOSE, NULL, 0);
        priv->closed = true;
        return ret;
    }

    r = reason;
    if (!reason_text)
        reason_text = "";

    if (reason_text_len == SIZE_MAX)
        reason_text_len = strlen(reason_text);

    len = sizeof(uint16_t) + reason_text_len;
    p = malloc(len);
    memcpy(p, &r, sizeof(uint16_t));
    _cws_hton(p, sizeof(uint16_t));
    if (reason_text_len)
        memcpy(p + sizeof(uint16_t), reason_text, reason_text_len);

    ret = _cws_send(priv, CWS_OPCODE_CLOSE, p, len);
    free(p);
    priv->closed = true;
    return ret;
}

static void
_cws_check_accept(struct cws_data *priv, const char *buffer, size_t len)
{
    priv->accepted = false;

    if (len != sizeof(priv->accept_key) - 1) {
        fprintf(stderr,"expected %zd bytes, got %zd '%.*s'",
            sizeof(priv->accept_key) - 1, len, (int)len, buffer);
        return;
    }

    if (memcmp(priv->accept_key, buffer, len) != 0) {
        fprintf(stderr,"invalid accept key '%.*s', expected '%.*s'",
            (int)len, buffer, (int)len, priv->accept_key);
        return;
    }

    priv->accepted = true;
}

static void
_cws_check_protocol(struct cws_data *priv, const char *buffer, size_t len)
{
    if (priv->websocket_protocols.received)
        free(priv->websocket_protocols.received);

    priv->websocket_protocols.received = malloc(len + 1);
    memcpy(priv->websocket_protocols.received, buffer, len);
    priv->websocket_protocols.received[len] = '\0';
}

static void
_cws_check_upgrade(struct cws_data *priv, const char *buffer, size_t len)
{
    priv->connection_websocket = false;

    if (len == strlen("websocket") &&
        strncasecmp(buffer, "websocket", len) != 0) {
        fprintf(stderr,"unexpected 'Upgrade: %.*s'. Expected 'Upgrade: websocket'",
            (int)len, buffer);
        return;
    }

    priv->connection_websocket = true;
}

static void
_cws_check_connection(struct cws_data *priv, const char *buffer, size_t len)
{
    priv->upgraded = false;

    if (len == strlen("upgrade") &&
        strncasecmp(buffer, "upgrade", len) != 0) {
        fprintf(stderr,"unexpected 'Connection: %.*s'. Expected 'Connection: upgrade'",
            (int)len, buffer);
        return;
    }

    priv->upgraded = true;
}

static size_t
_cws_receive_header(const char *buffer, size_t count, size_t nitems, void *data)
{
    struct cws_data *priv = data;
    size_t len = count * nitems;
    const struct header_checker {
        const char *prefix;
        void (*check)(struct cws_data *priv, const char *suffix, size_t suffixlen);
    } *itr, header_checkers[] = {
        {"Sec-WebSocket-Accept:", _cws_check_accept},
        {"Sec-WebSocket-Protocol:", _cws_check_protocol},
        {"Connection:", _cws_check_connection},
        {"Upgrade:", _cws_check_upgrade},
        {NULL, NULL}
    };

    if (len == 2 && memcmp(buffer, "\r\n", 2) == 0) {
        long status;

        curl_easy_getinfo(priv->easy, CURLINFO_HTTP_CONNECTCODE, &status);
        if (!priv->accepted) {
            if (priv->cbs.on_close) {
                priv->dispatching++;
                priv->cbs.on_close((void *)priv->cbs.data,
                                   priv->easy,
                                   CWS_CLOSE_REASON_SERVER_ERROR,
                                   "server didn't accept the websocket upgrade",
                                   strlen("server didn't accept the websocket upgrade"));
                priv->dispatching--;
                _cws_cleanup(priv);
            }
            return 0;
        } else {
            priv->start = time(NULL);
            if (priv->cbs.on_connect) {
                priv->dispatching++;
                priv->cbs.on_connect((void *)priv->cbs.data,
                                     priv->easy,
                                     STR_OR_EMPTY(priv->websocket_protocols.received));
                priv->dispatching--;
                _cws_cleanup(priv);
            }
            return len;
        }
    }

    if (_cws_header_has_prefix(buffer, len, "HTTP/")) {
        priv->accepted = false;
        priv->upgraded = false;
        priv->connection_websocket = false;
        if (priv->websocket_protocols.received) {
            free(priv->websocket_protocols.received);
            priv->websocket_protocols.received = NULL;
        }
        return len;
    }

    for (itr = header_checkers; itr->prefix != NULL; itr++) {
        if (_cws_header_has_prefix(buffer, len, itr->prefix)) {
            size_t prefixlen = strlen(itr->prefix);
            size_t valuelen = len - prefixlen;
            const char *value = buffer + prefixlen;
            _cws_trim(&value, &valuelen);
            itr->check(priv, value, valuelen);
        }
    }

    return len;
}

static bool
_cws_dispatch_validate(struct cws_data *priv)
{
    if (priv->closed && priv->recv.current.opcode != CWS_OPCODE_CLOSE)
        return false;

    if (!priv->recv.current.fin && cws_opcode_is_control(priv->recv.current.opcode))
        fprintf(stderr,"server sent forbidden fragmented control frame opcode=%#x.",
            priv->recv.current.opcode);
    else if (priv->recv.current.opcode == CWS_OPCODE_CONTINUATION && priv->recv.fragmented.opcode == 0)
        fprintf(stderr,"%s", "server sent continuation frame after non-fragmentable frame");
    else
        return true;

    cws_close(priv->easy, CWS_CLOSE_REASON_PROTOCOL_ERROR, NULL, 0);
    return false;
}

static void
_cws_dispatch(struct cws_data *priv)
{
    if (!_cws_dispatch_validate(priv))
        return;

    switch (priv->recv.current.opcode) {
    case CWS_OPCODE_CONTINUATION:
        if (priv->recv.current.fin) {
            if (priv->recv.fragmented.opcode == CWS_OPCODE_TEXT) {
                const char *str = (const char *)priv->recv.current.payload;
                if (priv->recv.current.used == 0)
                    str = "";
                if (priv->cbs.on_text)
                    priv->cbs.on_text((void *)priv->cbs.data, priv->easy, str, priv->recv.current.used);
            } else if (priv->recv.fragmented.opcode == CWS_OPCODE_BINARY) {
                if (priv->cbs.on_binary)
                    priv->cbs.on_binary((void *)priv->cbs.data, priv->easy, priv->recv.current.payload, priv->recv.current.used);
            }
            memset(&priv->recv.fragmented, 0, sizeof(priv->recv.fragmented));
        } else {
            priv->recv.fragmented.payload = priv->recv.current.payload;
            priv->recv.fragmented.used = priv->recv.current.used;
            priv->recv.fragmented.total = priv->recv.current.total;
            priv->recv.current.payload = NULL;
            priv->recv.current.used = 0;
            priv->recv.current.total = 0;
        }
        break;

    case CWS_OPCODE_TEXT:
        if (priv->recv.current.fin) {
            const char *str = (const char *)priv->recv.current.payload;
            if (priv->recv.current.used == 0)
                str = "";
            if (priv->cbs.on_text)
                priv->cbs.on_text((void *)priv->cbs.data, priv->easy, str, priv->recv.current.used);
        } else {
            priv->recv.fragmented.payload = priv->recv.current.payload;
            priv->recv.fragmented.used = priv->recv.current.used;
            priv->recv.fragmented.total = priv->recv.current.total;
            priv->recv.fragmented.opcode = priv->recv.current.opcode;

            priv->recv.current.payload = NULL;
            priv->recv.current.used = 0;
            priv->recv.current.total = 0;
            priv->recv.current.opcode = 0;
            priv->recv.current.fin = 0;
        }
        break;

    case CWS_OPCODE_BINARY:
        if (priv->recv.current.fin) {
            if (priv->cbs.on_binary)
                priv->cbs.on_binary((void *)priv->cbs.data, priv->easy, priv->recv.current.payload, priv->recv.current.used);
        } else {
            priv->recv.fragmented.payload = priv->recv.current.payload;
            priv->recv.fragmented.used = priv->recv.current.used;
            priv->recv.fragmented.total = priv->recv.current.total;
            priv->recv.fragmented.opcode = priv->recv.current.opcode;

            priv->recv.current.payload = NULL;
            priv->recv.current.used = 0;
            priv->recv.current.total = 0;
            priv->recv.current.opcode = 0;
            priv->recv.current.fin = 0;
        }
        break;

    case CWS_OPCODE_CLOSE: {
        enum cws_close_reason reason = CWS_CLOSE_REASON_NO_REASON;
        const char *str = "";
        size_t len = priv->recv.current.used;

        if (priv->recv.current.used >= sizeof(uint16_t)) {
            uint16_t r;
            memcpy(&r, priv->recv.current.payload, sizeof(uint16_t));
            _cws_ntoh(&r, sizeof(r));
            if (!cws_close_reason_is_valid(r)) {
                cws_close(priv->easy, CWS_CLOSE_REASON_PROTOCOL_ERROR, "invalid close reason", SIZE_MAX);
                r = CWS_CLOSE_REASON_PROTOCOL_ERROR;
            }
            reason = r;
            str = (const char *)priv->recv.current.payload + sizeof(uint16_t);
            len = priv->recv.current.used - 2;
        } else if (priv->recv.current.used > 0 && priv->recv.current.used < sizeof(uint16_t)) {
            cws_close(priv->easy, CWS_CLOSE_REASON_PROTOCOL_ERROR, "invalid close payload length", SIZE_MAX);
        }

        if (priv->cbs.on_close)
            priv->cbs.on_close((void *)priv->cbs.data, priv->easy, reason, str, len);

        if (!priv->closed) {
            if (reason == CWS_CLOSE_REASON_NO_REASON)
                reason = 0;
            cws_close(priv->easy, reason, str, len);
        }
        break;
    }

    case CWS_OPCODE_PING: {
        const char *str = (const char *)priv->recv.current.payload;
        if (priv->recv.current.used == 0)
            str = "";
        if (priv->cbs.on_ping)
            priv->cbs.on_ping((void *)priv->cbs.data, priv->easy, str, priv->recv.current.used);
        else
            cws_pong(priv->easy, str, priv->recv.current.used);
        break;
    }

    case CWS_OPCODE_PONG: {
        const char *str = (const char *)priv->recv.current.payload;
        if (priv->recv.current.used == 0)
            str = "";
        if (priv->cbs.on_pong)
            priv->cbs.on_pong((void *)priv->cbs.data, priv->easy, str, priv->recv.current.used);
        break;
    }

    default:
        fprintf(stderr,"unexpected WebSocket opcode: %#x.", priv->recv.current.opcode);
        cws_close(priv->easy, CWS_CLOSE_REASON_PROTOCOL_ERROR, "unexpected opcode", SIZE_MAX);
    }
}

static size_t
_cws_process_frame(struct cws_data *priv, const char *buffer, size_t len)
{
    size_t used = 0;

    while (len > 0 && priv->recv.done < priv->recv.needed) {
        uint64_t frame_len;

        if (priv->recv.done < priv->recv.needed) {
            size_t todo = priv->recv.needed - priv->recv.done;
            if (todo > len)
                todo = len;
            memcpy(priv->recv.tmpbuf + priv->recv.done, buffer, todo);
            priv->recv.done += todo;
            used += todo;
            buffer += todo;
            len -= todo;
        }

        if (priv->recv.needed != priv->recv.done)
            continue;

        if (priv->recv.needed == sizeof(struct cws_frame_header)) {
            struct cws_frame_header fh;

            memcpy(&fh, priv->recv.tmpbuf, sizeof(struct cws_frame_header));
            priv->recv.current.opcode = fh.opcode;
            priv->recv.current.fin = fh.fin;

            if (fh._reserved || fh.mask)
                cws_close(priv->easy, CWS_CLOSE_REASON_PROTOCOL_ERROR, NULL, 0);

            if (fh.payload_len == 126) {
                if (cws_opcode_is_control(fh.opcode))
                    cws_close(priv->easy, CWS_CLOSE_REASON_PROTOCOL_ERROR, NULL, 0);
                priv->recv.needed += sizeof(uint16_t);
                continue;
            } else if (fh.payload_len == 127) {
                if (cws_opcode_is_control(fh.opcode))
                    cws_close(priv->easy, CWS_CLOSE_REASON_PROTOCOL_ERROR, NULL, 0);
                priv->recv.needed += sizeof(uint64_t);
                continue;
            } else
                frame_len = fh.payload_len;
        } else if (priv->recv.needed == sizeof(struct cws_frame_header) + sizeof(uint16_t)) {
            uint16_t plen;

            memcpy(&plen,
                   priv->recv.tmpbuf + sizeof(struct cws_frame_header),
                   sizeof(plen));
            _cws_ntoh(&plen, sizeof(plen));
            frame_len = plen;
        } else if (priv->recv.needed == sizeof(struct cws_frame_header) + sizeof(uint64_t)) {
            uint64_t plen;

            memcpy(&plen, priv->recv.tmpbuf + sizeof(struct cws_frame_header),
                   sizeof(plen));
            _cws_ntoh(&plen, sizeof(plen));
            frame_len = plen;
        } else {
            fprintf(stderr,"needed=%u, done=%u", priv->recv.needed, priv->recv.done);
            abort();
        }

        if (priv->recv.current.opcode == CWS_OPCODE_CONTINUATION) {
            if (priv->recv.fragmented.opcode == 0)
                cws_close(priv->easy, CWS_CLOSE_REASON_PROTOCOL_ERROR, "nothing to continue", SIZE_MAX);
            if (priv->recv.current.payload)
                free(priv->recv.current.payload);

            priv->recv.current.payload = priv->recv.fragmented.payload;
            priv->recv.current.used = priv->recv.fragmented.used;
            priv->recv.current.total = priv->recv.fragmented.total;
            priv->recv.fragmented.payload = NULL;
            priv->recv.fragmented.used = 0;
            priv->recv.fragmented.total = 0;
        } else if (!cws_opcode_is_control(priv->recv.current.opcode) && priv->recv.fragmented.opcode != 0) {
            cws_close(priv->easy, CWS_CLOSE_REASON_PROTOCOL_ERROR, "expected continuation or control frames", SIZE_MAX);
        }

        if (frame_len > 0) {
            void *tmp;

            tmp = realloc(priv->recv.current.payload,
                          priv->recv.current.total + frame_len + 1);
            if (!tmp) {
                cws_close(priv->easy, CWS_CLOSE_REASON_TOO_BIG, NULL, 0);
                fprintf(stderr,"%s", "could not allocate memory");
                return CURL_READFUNC_ABORT;
            }
            priv->recv.current.payload = tmp;
            priv->recv.current.total += frame_len;
        }
    }

    if (len == 0 && priv->recv.done < priv->recv.needed)
        return used;

    /* fill payload */
    while (len > 0 && priv->recv.current.used < priv->recv.current.total) {
        size_t todo = priv->recv.current.total - priv->recv.current.used;
        if (todo > len)
            todo = len;
        memcpy(priv->recv.current.payload + priv->recv.current.used, buffer, todo);
        priv->recv.current.used += todo;
        used += todo;
        buffer += todo;
        len -= todo;
    }

    if (priv->recv.current.payload)
        priv->recv.current.payload[priv->recv.current.used] = '\0';

    if (len == 0 && priv->recv.current.used < priv->recv.current.total)
        return used;

    priv->dispatching++;

    _cws_dispatch(priv);

    priv->recv.done = 0;
    priv->recv.needed = sizeof(struct cws_frame_header);
    priv->recv.current.used = 0;
    priv->recv.current.total = 0;

    priv->dispatching--;
    _cws_cleanup(priv);

    return used;
}

static size_t
_cws_receive_data(const char *buffer, size_t count, size_t nitems, void *data)
{
    struct cws_data *priv = data;
    size_t len = count * nitems;
    while (len > 0) {
        size_t used = _cws_process_frame(priv, buffer, len);
        len -= used;
        buffer += used;
    }

    return count * nitems;
}

static size_t
_cws_send_data(char *buffer, size_t count, size_t nitems, void *data)
{
    struct cws_data *priv = data;
    size_t len = count * nitems;
    size_t todo = priv->send.len;

    if (todo == 0) {
        priv->pause_flags |= CURLPAUSE_SEND;
        return CURL_READFUNC_PAUSE;
    }
    if (todo > len)
        todo = len;

    memcpy(buffer, priv->send.buffer, todo);
    if (todo < priv->send.len) {
        /* optimization note: we could avoid memmove() by keeping a
         * priv->send.position, then we just increment that offset.
         *
         * on next _cws_write(), check if priv->send.position > 0 and
         * memmove() to make some space without realloc().
         */
        memmove(priv->send.buffer,
                priv->send.buffer + todo,
                priv->send.len - todo);
    } else {
        free(priv->send.buffer);
        priv->send.buffer = NULL;
    }

    priv->send.len -= todo;
    return todo;
}

static const char*
_cws_fill_websocket_key(struct cws_data *priv, char key_header[static 44])
{
    uint8_t key[16];
    /* 24 bytes of base24 encoded key
     * + GUID 258EAFA5-E914-47DA-95CA-C5AB0DC85B11
     */
    char buf[60] = "01234567890123456789....258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    uint8_t sha1hash[20];

    _cws_get_random(key, sizeof(key));

    _cws_encode_base64(key, sizeof(key), buf);
    memcpy(key_header + strlen("Sec-WebSocket-Key: "), buf, 24);

    _cws_sha1(buf, sizeof(buf), sha1hash);
    _cws_encode_base64(sha1hash, sizeof(sha1hash), priv->accept_key);
    priv->accept_key[sizeof(priv->accept_key) - 1] = '\0';

    return key_header;
}

CURL*
cws_new(const char *url, const char *websocket_protocols, const struct cws_callbacks *callbacks)
{
    CURL *easy;
    struct cws_data *priv;
    char key_header[] = "Sec-WebSocket-Key: 01234567890123456789....";
    char *tmp = NULL;
    const curl_version_info_data *cver = curl_version_info(CURLVERSION_NOW);

    if (cver->version_num < 0x073202)
        fprintf(stderr,"CURL version '%s'. At least '7.50.2' is required for WebSocket to work reliably", cver->version);

    if (!url)
        return NULL;

    easy = curl_easy_init();
    if (!easy)
        return NULL;

    priv = calloc(1, sizeof(struct cws_data));
    priv->easy = easy;
    curl_easy_setopt(easy, CURLOPT_PRIVATE, priv);
    curl_easy_setopt(easy, CURLOPT_HEADERFUNCTION, _cws_receive_header);
    curl_easy_setopt(easy, CURLOPT_HEADERDATA, priv);
    curl_easy_setopt(easy, CURLOPT_WRITEFUNCTION, _cws_receive_data);
    curl_easy_setopt(easy, CURLOPT_WRITEDATA, priv);
    curl_easy_setopt(easy, CURLOPT_READFUNCTION, _cws_send_data);
    curl_easy_setopt(easy, CURLOPT_READDATA, priv);

    if (callbacks)
        priv->cbs = *callbacks;

    priv->recv.needed = sizeof(struct cws_frame_header);
    priv->recv.done = 0;

    /* curl doesn't support ws:// or wss:// scheme, rewrite to http/https */
    if (strncmp(url, "ws://", strlen("ws://")) == 0) {
        tmp = malloc(strlen(url) - strlen("ws://") + strlen("http://") + 1);
        memcpy(tmp, "http://", strlen("http://"));
        memcpy(tmp + strlen("http://"),
               url + strlen("ws://"),
               strlen(url) - strlen("ws://") + 1);
        url = tmp;
    } else if (strncmp(url, "wss://", strlen("wss://")) == 0) {
        tmp = malloc(strlen(url) - strlen("wss://") + strlen("https://") + 1);
        memcpy(tmp, "https://", strlen("https://"));
        memcpy(tmp + strlen("https://"),
               url + strlen("wss://"),
               strlen(url) - strlen("wss://") + 1);
        url = tmp;
    }
    curl_easy_setopt(easy, CURLOPT_URL, url);
    free(tmp);

    /*
     * BEGIN: work around CURL to get WebSocket:
     *
     * WebSocket must be HTTP/1.1 GET request where we must keep the
     * "send" part alive without any content-length and no chunked
     * encoding and the server answer is 101-upgrade.
     */
    curl_easy_setopt(easy, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
    /* Use CURLOPT_UPLOAD=1 to force "send" even with a GET request,
     * however it will set HTTP request to PUT
     */
    curl_easy_setopt(easy, CURLOPT_UPLOAD, 1L);
    /*
     * Then we manually override the string sent to be "GET".
     */
    curl_easy_setopt(easy, CURLOPT_CUSTOMREQUEST, "GET");
#if 0
    /*
     * CURLOPT_UPLOAD=1 with HTTP/1.1 implies:
     *     Expect: 100-continue
     * but we don't want that, rather 101. Then force: 101.
     */
    priv->headers = curl_slist_append(priv->headers, "Expect: 101");
#else
    /*
     * This disables a automatic CURL behaviour where we receive a
     * error if the server can't be bothered to send just a header
     * with a 100 response code (https://stackoverflow.com/questions/9120760/curl-simple-file-upload-417-expectation-failed/19250636")
     */
    priv->headers = curl_slist_append(priv->headers, "Expect:");
#endif
    /*
     * CURLOPT_UPLOAD=1 without a size implies in:
     *     Transfer-Encoding: chunked
     * but we don't want that, rather unmodified (raw) bites as we're
     * doing the websockets framing ourselves. Force nothing.
     */
    priv->headers = curl_slist_append(priv->headers, "Transfer-Encoding:");
    /* END: work around CURL to get WebSocket. */

    /* regular mandatory WebSockets headers */
    priv->headers = curl_slist_append(priv->headers, "Connection: Upgrade");
    priv->headers = curl_slist_append(priv->headers, "Upgrade: websocket");
    priv->headers = curl_slist_append(priv->headers, "Sec-WebSocket-Version: 13");
    /* Sec-WebSocket-Key: <24-bytes-base64-of-random-key> */
    priv->headers = curl_slist_append(priv->headers, _cws_fill_websocket_key(priv, key_header));

    if (websocket_protocols) {
        char *tmp = malloc(strlen("Sec-WebSocket-Protocol: ") +
                           strlen(websocket_protocols) + 1);
        memcpy(tmp,
               "Sec-WebSocket-Protocol: ",
               strlen("Sec-WebSocket-Protocol: "));
        memcpy(tmp + strlen("Sec-WebSocket-Protocol: "),
               websocket_protocols,
               strlen(websocket_protocols) + 1);

        priv->headers = curl_slist_append(priv->headers, tmp);
        free(tmp);
        priv->websocket_protocols.requested = strdup(websocket_protocols);
    }

    curl_easy_setopt(easy, CURLOPT_HTTPHEADER, priv->headers);

    return easy;
}

void
cws_free(CURL *easy)
{
    struct cws_data *priv;
    char *p = NULL;

    curl_easy_getinfo(easy, CURLINFO_PRIVATE, &p); /* checks for char* */
    if (!p)
        return;
    priv = (struct cws_data *)p;

    priv->deleted = true;
    _cws_cleanup(priv);
}

void
cws_add_header(CURL *easy, const char field[],  const char value[])
{
    struct cws_data *priv;
    char *p = NULL;
    char buf[4096];
    size_t bufret;
    size_t field_len;

    curl_easy_getinfo(easy, CURLINFO_PRIVATE, &p); /* checks for char* */
    if (!p)
        return;
    priv = (struct cws_data *)p;

    bufret = snprintf(buf, sizeof(buf), "%s: %s", field, value);
    if (bufret >= sizeof(buf)) {
        fprintf(stderr, "Out of bounds write attempt\n");
        abort();
    }

    /* check for match in existing fields */
    field_len = strlen(field);
    struct curl_slist *node = priv->headers;
    while (NULL != node) {
        if (!(p = strchr(node->data, ':'))) {
            fprintf(stderr, "Missing ':' in header:\n\t%s\n", node->data);
            abort();
        }
        if (field_len == p - node->data
            && 0 == strncasecmp(node->data, field, field_len)) 
        {
            if (strlen(node->data) < bufret) {
                free(node->data);
                node->data = strdup(buf);
            }
            else {
                memcpy(node->data, buf, bufret+1);
            }
            return; /* EARLY RETURN */
        }
        node = node->next;
    }

    curl_slist_append(priv->headers, buf);
}

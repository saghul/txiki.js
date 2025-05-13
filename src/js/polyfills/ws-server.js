class WebSocketConnection {
  readable;
  writable;
  writer;
  buffer = new ArrayBuffer(0, { maxByteLength: 1024 ** 2 });
  closed = !1;
  opcodes = { TEXT: 1, BINARY: 2, PING: 9, PONG: 10, CLOSE: 8 };
  constructor(readable, writable) {
    this.readable = readable;
    if (writable instanceof WritableStreamDefaultWriter) {
      this.writer = writable;
    } else if (writable instanceof WritableStream) {
      this.writable = writable;
      this.writer = this.writable.getWriter();
    }
  }
  async processWebSocketStream() {
    try {
      for await (const frame of this.readable) {
        const { byteLength } = this.buffer;
        console.log(byteLength + frame.length);
        this.buffer.resize(byteLength + frame.length);
        const view = new DataView(this.buffer);
        for (let i = 0, j = byteLength; i < frame.length; i++, j++) {
          view.setUint8(j, frame.at(i));
        }
        await this.processFrame();
      }
      console.log("WebSocket connection closed.");
    } catch (e) {
      console.log(e);
      console.trace();
      // this.writer.close().catch(console.log);
    }
  }
  async writeFrame(opcode, payload) {
    await this.writer.ready;
    return this.writer.write(this.encodeMessage(opcode, payload))
      .catch(console.log);
  }
  async send(obj) {
    console.log({ obj });
    let opcode, payload;
    if (obj instanceof Uint8Array) {
      opcode = this.opcodes.BINARY;
      payload = obj;
    } else if (typeof obj == "string") {
      opcode = this.opcodes.TEXT;
      payload = obj;
    } else {
      throw new Error("Cannot send object. Must be string or Uint8Array");
    }
    await this.writeFrame(opcode, payload);
  }
  async close(code, reason) {
    const opcode = this.opcodes.CLOSE;
    let buffer;
    if (code) {
      buffer = new Uint8Array(reason.length + 2);
      const view = new DataView(buffer.buffer);
      view.setUint16(0, code, !1);
      buffer.set(reason, 2);
    } else {
      buffer = new Uint8Array(0);
    }
    console.log({ opcode, reason, buffer });
    await this.writeFrame(opcode, buffer);
    await this.writer.close().catch((e) => {
      console.log(e);
      this.buffer.resize(0);
    });
    await this.writer.closed;
    this.buffer.resize(0);
    this.closed = !0;
  }
  async processFrame() {
    let length, maskBytes;
    const buf = new Uint8Array(this.buffer), view = new DataView(buf.buffer);
    if (buf.length < 2) {
      return !1;
    }
    let idx = 2,
      b1 = view.getUint8(0),
      fin = b1 & 128,
      opcode = b1 & 15,
      b2 = view.getUint8(1),
      mask = b2 & 128;
    length = b2 & 127;
    if (length > 125) {
      if (buf.length < 8) {
        return !1;
      }
      if (length == 126) {
        length = view.getUint16(2, !1);
        idx += 2;
      } else if (length == 127) {
        if (view.getUint32(2, !1) != 0) {
          this.close(1009, "");
        }
        length = view.getUint32(6, !1);
        idx += 8;
      }
    }
    if (buf.length < idx + 4 + length) {
      return !1;
    }
    maskBytes = buf.subarray(idx, idx + 4);
    idx += 4;
    let payload = buf.subarray(idx, idx + length);
    payload = this.unmask(maskBytes, payload);
    await this.handleFrame(opcode, payload);

    if (idx + length === 0) {
      console.log(`this.buffer.length: ${this.buffer.byteLength}.`);
      return !1;
    }
    for (let i = 0, j = idx + length; j < this.buffer.byteLength; i++, j++) {
      view.setUint8(i, view.getUint8(j));
    }
    this.buffer.resize(this.buffer.byteLength - (idx + length));
    return !0;
  }
  async handleFrame(opcode, buffer) {
    console.log({ opcode, length: buffer.length });
    const view = new DataView(buffer.buffer);
    let payload;
    switch (opcode) {
      case this.opcodes.TEXT:
        payload = buffer;
        await this.writeFrame(opcode, payload);
        break;
      case this.opcodes.BINARY:
        payload = buffer;
        await this.writeFrame(opcode, payload);
        break;
      case this.opcodes.PING:
        await this.writeFrame(this.opcodes.PONG, buffer);
        break;
      case this.opcodes.PONG:
        break;
      case this.opcodes.CLOSE:
        let code, reason;
        if (buffer.length >= 2) {
          code = view.getUint16(0, !1);
          reason = (new TextDecoder()).decode(buffer);
        }
        this.close(code, reason);
        console.log("Close opcode.");
        break;
      default:
        this.close(1002, "unknown opcode");
    }
  }
  unmask(maskBytes2, data) {
    let payload = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      payload[i] = maskBytes2[i % 4] ^ data[i];
    }
    return payload;
  }
  encodeMessage(opcode, payload) {
    let buf, b1 = 128 | opcode, b2 = 0, length = payload.length;
    if (length < 126) {
      buf = new Uint8Array(payload.length + 2 + 0);
      const view = new DataView(buf.buffer);
      b2 |= length;
      view.setUint8(0, b1);
      view.setUint8(1, b2);
      buf.set(payload, 2);
    } else if (length < 65536) {
      buf = new Uint8Array(payload.length + 2 + 2);
      const view = new DataView(buf.buffer);
      b2 |= 126;
      view.setUint8(0, b1);
      view.setUint8(1, b2);
      view.setUint16(2, length);
      buf.set(payload, 4);
    } else {
      buf = new Uint8Array(payload.length + 2 + 8);
      const view = new DataView(buf.buffer);
      b2 |= 127;
      view.setUint8(0, b1);
      view.setUint8(1, b2);
      view.setUint32(2, 0, !1);
      view.setUint32(6, length, !1);
      buf.set(payload, 10);
    }
    return buf;
  }
  static KEY_SUFFIX = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
  static async hashWebSocketKey(secKeyWebSocket, writable) {
    // Use Web Cryptography API crypto.subtle where defined
    if (globalThis.crypto.subtle) {
      const encoder = new TextEncoder(),
        key = btoa(
          [
            ...new Uint8Array(
              await crypto.subtle.digest(
                "SHA-1",
                encoder.encode(
                  `${secKeyWebSocket}${WebSocketConnection.KEY_SUFFIX}`,
                ),
              ),
            ),
          ].map((s) => String.fromCodePoint(s)).join(""),
        );
      const header = `HTTP/1.1 101 Web Socket Protocol Handshake\r
Upgrade: WebSocket\r
Connection: Upgrade\r
sec-websocket-accept: ` + key + `\r
\r
`;
      return writable instanceof WritableStream
        ? (new Response(header)).body.pipeTo(writable, { preventClose: !0 })
        : writable.write(encoder.encode(header));
    } else {
      // txiki.js does not support Web Cryptography API crypto.subtle
      // Use txiki.js specific tjs:hashing or 
      // https://raw.githubusercontent.com/kawanet/sha1-uint8array/main/lib/sha1-uint8array.ts
      const { createHash } = await import("tjs:hashing"); 
      const encoder = new TextEncoder();
      const hash = createHash("sha1").update(
        `${secKeyWebSocket}${WebSocketConnection.KEY_SUFFIX}`,
      ).bytes();
      const key = btoa(
        String.fromCodePoint(...hash),
      );
      const header = "HTTP/1.1 101 Web Socket Protocol Handshake\r\n" +
        "Upgrade: WebSocket\r\n" +
        "Connection: Upgrade\r\n" +
        "sec-websocket-accept: " + key + "\r\n\r\n";
      const encoded = encoder.encode(header);
      return writable instanceof WritableStream
        ? new Response(encode).body.pipeTo(writable, { preventClose: !0 })
        : writable.write(encoded);
    }
  }
}

export { WebSocketConnection };

import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

// A cloned request must transmit its (teed) body over the wire when fetched.
{
    const req = new Request(`${baseUrl}/post`, { method: 'POST', body: 'clone-me-over-the-wire' });
    const clone = req.clone();

    const res = await fetch(clone);
    const json = await res.json();

    assert.eq(json.data, 'clone-me-over-the-wire', 'echo server received the cloned request body');
}

// The original is still fetchable after the clone has been sent.
{
    const req = new Request(`${baseUrl}/post`, { method: 'POST', body: 'original-after-clone' });
    const clone = req.clone();

    await (await fetch(clone)).text();

    const json = await (await fetch(req)).json();

    assert.eq(json.data, 'original-after-clone', 'original request body transmits after clone was sent');
}

await server.close();

import assert from 'tjs:assert';


// Server negotiates a subprotocol via upgrade headers.
const server = tjs.serve({
    port: 0,
    fetch(req, { server }) {
        const requested = req.headers.get('sec-websocket-protocol');

        if (requested) {
            const protocols = requested.split(',').map(p => p.trim());
            const chosen = protocols.includes('chat') ? 'chat' : protocols[0];

            server.upgrade(req, {
                headers: {
                    'sec-websocket-protocol': chosen,
                },
            });
        } else {
            server.upgrade(req);
        }
    },
    websocket: {
        message(ws, data) {
            ws.sendText(data);
        },
    },
});

const url = `ws://127.0.0.1:${server.port}`;

// Test 1: single protocol negotiation.
{
    const ws = new WebSocket(url, 'chat');

    const protocol = await new Promise((resolve, reject) => {
        ws.onopen = () => {
            resolve(ws.protocol);
            ws.close();
        };
        ws.onerror = () => reject(new Error('ws error'));
    });

    assert.eq(protocol, 'chat', 'single protocol negotiated');
}

// Test 2: multiple protocols, server picks "chat".
{
    const ws = new WebSocket(url, [ 'json', 'chat', 'xml' ]);

    const protocol = await new Promise((resolve, reject) => {
        ws.onopen = () => {
            resolve(ws.protocol);
            ws.close();
        };
        ws.onerror = () => reject(new Error('ws error'));
    });

    assert.eq(protocol, 'chat', 'server picks preferred protocol from list');
}

// Test 3: protocol not in preferred list, server picks first.
{
    const ws = new WebSocket(url, [ 'json', 'xml' ]);

    const protocol = await new Promise((resolve, reject) => {
        ws.onopen = () => {
            resolve(ws.protocol);
            ws.close();
        };
        ws.onerror = () => reject(new Error('ws error'));
    });

    assert.eq(protocol, 'json', 'server picks first protocol when preferred not available');
}

// Test 4: no protocols requested, no negotiation.
{
    const ws = new WebSocket(url);

    const protocol = await new Promise((resolve, reject) => {
        ws.onopen = () => {
            resolve(ws.protocol);
            ws.close();
        };
        ws.onerror = () => reject(new Error('ws error'));
    });

    assert.eq(protocol, '', 'no protocol when none requested');
}

server.close();

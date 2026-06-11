// WS server that echoes back the request URL seen at upgrade time.
export default {
    fetch(request, { server }) {
        if (request.headers.get('upgrade') === 'websocket') {
            server.upgrade(request, { data: request.url });

            return;
        }

        return new Response('not a websocket request');
    },
    websocket: {
        message(ws) {
            ws.sendText(ws.data);
        },
    },
};

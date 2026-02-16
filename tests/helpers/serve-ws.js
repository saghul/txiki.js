export default {
    fetch(request, { server }) {
        if (request.headers.get('upgrade') === 'websocket') {
            server.upgrade(request);

            return;
        }

        return new Response('not a websocket request');
    },
    websocket: {
        message(ws, data) {
            ws.sendText('echo: ' + data);
        },
    },
};

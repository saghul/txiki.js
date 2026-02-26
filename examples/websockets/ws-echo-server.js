// Sample WebSocket echo server.
//
// Run with: tjs serve examples/ws-echo-server.js
//
// Connect with: websocat ws://localhost:8000
//

export default {
    fetch(request, { server }) {
        if (request.headers.get('upgrade') === 'websocket') {
            server.upgrade(request);

            return;
        }

        return new Response('This is a WebSocket server. Connect using a WebSocket client.\n');
    },
    websocket: {
        open(ws) {
            console.log('Client connected');
        },
        message(ws, data) {
            console.log(`Received: ${data}`);
            ws.sendText(`echo: ${data}`);
        },
        close(ws, code, reason) {
            console.log(`Client disconnected: ${code} ${reason}`);
        },
    },
};

/**
 * Hono adapter for txiki.js WebSocket server support.
 *
 * Usage:
 *   import { Hono } from './generated/hono.js';
 *   import { serveWithWebSocket, createWSHandler } from './hono-adapter.js';
 *
 *   const app = new Hono();
 *   app.get('/ws', createWSHandler((ws) => {
 *       ws.onmessage = (data) => ws.send('echo: ' + data);
 *   }));
 *
 *   const server = serveWithWebSocket(app, {
 *       port: 0,
 *       websocket: {
 *           open(ws) { if (ws.data.onOpen) ws.data.onOpen(ws); },
 *           message(ws, data) { if (ws.data.onMessage) ws.data.onMessage(ws, data); },
 *           close(ws, code, reason) { if (ws.data.onClose) ws.data.onClose(ws, code, reason); },
 *       },
 *   });
 */

const kUpgradeData = Symbol('kUpgradeData');

/**
 * Create a Hono route handler that marks a request for WebSocket upgrade.
 * The callback receives a context object with handlers the caller can set.
 *
 * @param {(handlers: {onOpen?, onMessage?, onClose?}) => void} setupFn
 *   Called synchronously to let the user attach WS event handlers.
 * @returns {(c: import('hono').Context) => Response|undefined}
 */
export function createWSHandler(setupFn) {
    return (c) => {
        const handlers = {};

        setupFn(handlers);

        // Store handlers so serveWithWebSocket can pass them as ws.data.
        c.req.raw[kUpgradeData] = handlers;

        // Return undefined — serveWithWebSocket's fetch wrapper intercepts this.
        return c.json({ error: 'WebSocket upgrade expected' }, 426);
    };
}

/**
 * Serve a Hono app with WebSocket support using the txiki.js Bun-style API.
 *
 * @param {import('hono').Hono} app
 * @param {object} options
 * @param {number} [options.port=0]
 * @param {object} [options.websocket] - WS lifecycle callbacks.
 * @returns {object} server instance with .port and .close()
 */
export function serveWithWebSocket(app, options = {}) {
    const { port = 0, websocket: userWs } = options;

    const websocket = {
        open(ws) {
            if (ws.data?.onOpen) {
                ws.data.onOpen(ws);
            }

            if (userWs?.open) {
                userWs.open(ws);
            }
        },
        message(ws, data) {
            if (ws.data?.onMessage) {
                ws.data.onMessage(ws, data);
            }

            if (userWs?.message) {
                userWs.message(ws, data);
            }
        },
        close(ws, code, reason) {
            if (ws.data?.onClose) {
                ws.data.onClose(ws, code, reason);
            }

            if (userWs?.close) {
                userWs.close(ws, code, reason);
            }
        },
    };

    const server = tjs.serve({
        port,
        fetch(req, { server }) {
            // Run Hono's router to find the handler.
            const resp = app.fetch(req);

            // Check if the handler marked this request for WS upgrade.
            if (req[kUpgradeData]) {
                const data = req[kUpgradeData];

                if (server.upgrade(req, { data })) {
                    return;
                }
            }

            return resp;
        },
        websocket,
    });

    return server;
}

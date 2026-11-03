import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };
import { rawH2Request } from './helpers/raw-h2-client.js';

// An h2 client that resets its stream mid-body has not sent the whole body:
// the handler's body stream must error, not end with what arrived so far.

const outcome = Promise.withResolvers();
const started = Promise.withResolvers();
const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    tls: { cert, key, alpn: [ 'h2' ] },
    fetch: async req => {
        started.resolve();

        try {
            outcome.resolve(`resolved ${JSON.stringify(await req.text())}`);
        } catch (e) {
            outcome.resolve(`rejected ${e.name}`);
        }

        return new Response('ok');
    },
});

try {
    await rawH2Request(server.port, 'PUT', '/up', [ 'hello', () => started.promise, 100, 'reset', () => outcome.promise ]);

    assert.eq(await outcome.promise, 'rejected TypeError', 'a reset body rejects');
} finally {
    await server.close();
}

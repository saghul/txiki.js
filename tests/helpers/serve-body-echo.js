// Echoes the raw request body bytes straight back, and mirrors the received
// Content-Type into the X-Echo-Content-Type response header. Used to verify
// that a request body is transmitted byte-for-byte over the wire.
export default {
    async fetch(request) {
        const body = await request.arrayBuffer();

        return new Response(body, {
            headers: {
                'x-echo-content-type': request.headers.get('content-type') ?? '',
            },
        });
    },
};

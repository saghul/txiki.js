// Sample HTTP server.
//
// Run with: tjs serve examples/http-server.js
//

export default {
    fetch(request) {
        const url = new URL(request.url);

        return new Response(`Hello World!\nYou requested: ${url.pathname}\n`);
    },
};

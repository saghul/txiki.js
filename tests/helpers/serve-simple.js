export default {
    fetch(request) {
        const url = new URL(request.url);

        if (url.pathname === '/echo' && request.method === 'POST') {
            return request.text().then(body => new Response(`echo: ${body}`));
        }

        return new Response('hello from serve');
    },
};

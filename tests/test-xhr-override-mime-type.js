import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();
const url = `${baseUrl}/get`;

function request(beforeSend) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open('GET', url);
        beforeSend?.(xhr);
        xhr.onload = () => resolve(xhr);
        xhr.onerror = () => reject(new Error('XHR error'));
        xhr.send();
    });
}

// overrideMimeType() with a charset must not throw and must still decode text.
{
    const xhr = await request(x => {
        assert.doesNotThrow(
            () => x.overrideMimeType('text/plain; charset=utf-8'),
            'overrideMimeType does not throw before send'
        );
    });

    const body = JSON.parse(xhr.responseText);

    assert.ok(body.url.endsWith('/get'), 'responseText decodes with overridden charset');
}

// An unknown charset falls back to UTF-8 rather than throwing.
{
    const xhr = await request(x => {
        x.overrideMimeType('text/plain; charset=x-bogus-encoding');
    });

    const body = JSON.parse(xhr.responseText);

    assert.ok(body.url.endsWith('/get'), 'unknown override charset falls back to UTF-8');
}

// Calling overrideMimeType once the request is DONE throws InvalidStateError.
{
    const xhr = await request();

    assert.eq(xhr.readyState, xhr.DONE, 'request is DONE');

    let caught;

    try {
        xhr.overrideMimeType('text/plain');
    } catch (e) {
        caught = e;
    }

    assert.ok(caught instanceof DOMException, 'throws a DOMException when DONE');
    assert.eq(caught.name, 'InvalidStateError', 'error name is InvalidStateError');
}

await server.close();

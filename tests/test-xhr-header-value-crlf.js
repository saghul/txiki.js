// XMLHttpRequest.setRequestHeader must throw a SyntaxError for an invalid
// header name or a value with CR, LF or NUL inside it, rather than put extra
// header lines on the wire.
import assert from 'tjs:assert';

const xhr = new XMLHttpRequest();

xhr.open('GET', 'http://127.0.0.1:1/');

for (const [ name, value ] of [
    [ 'x-a', 'v\r\nInjected: yes' ],
    [ 'x-a', 'v\nx' ],
    [ 'x-a', 'v\0x' ],
    [ 'x a', 'v' ],
    [ 'x-a:b', 'v' ],
    [ '', 'v' ],
]) {
    let error;

    try {
        xhr.setRequestHeader(name, value);
    } catch (e) {
        error = e;
    }

    assert.ok(error instanceof DOMException, `${JSON.stringify([ name, value ])} throws DOMException`);
    assert.eq(error.name, 'SyntaxError', `${JSON.stringify([ name, value ])} is a SyntaxError`);
}

xhr.setRequestHeader('x-ok', ' v ');

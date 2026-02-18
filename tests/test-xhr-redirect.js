import assert from 'tjs:assert';


const url = 'https://wikipedia.com/';

const xhr = new XMLHttpRequest();
xhr.open('GET', url);
xhr.onloadend = () => {
    assert.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
    assert.eq(xhr.status, 200, 'status is 200');
    assert.ok(xhr.responseURL.startsWith('https://www.wikipedia.org/'), 'url was redirected');
    assert.ok(xhr.responseText.length > 0, 'response body is not empty');
};
xhr.send();

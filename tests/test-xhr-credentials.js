import assert from 'tjs:assert';
import path from "tjs:path";

const TJS_HOME = tjs.env.TJS_HOME ?? path.join(tjs.homeDir, '.tjs');
const cookieJarPath = path.join(TJS_HOME, 'cookies.txt');

const cookieValue = Math.random().toString();
// Use an explicit Expires so the cookie jar stores it (session cookies are not persisted).
const cookieHeader = `key=${cookieValue}; Expires=Thu, 01 Jan 2099 00:00:00 GMT; Path=/cookies`;

function doXhr(reqUrl, withCredentials) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.withCredentials = withCredentials;
        xhr.open('GET', reqUrl);
        xhr.onload = () => resolve(xhr);
        xhr.onerror = () => reject(new Error('XHR error'));
        xhr.send();
    });
}

// Set cookie via response-headers endpoint (sends Set-Cookie in the response).
const setUrl = 'https://httpbin.org/response-headers?' + new URLSearchParams({ 'Set-Cookie': cookieHeader });
const xhr1 = await doXhr(setUrl, true);
assert.eq(xhr1.readyState, xhr1.DONE, 'readyState is DONE');
assert.eq(xhr1.status, 200, 'status is 200');

// Without credentials: cookie should not be sent.
const xhr2 = await doXhr('https://httpbin.org/cookies', false);
let result = JSON.parse(xhr2.responseText);
assert.eq(result.cookies.key, undefined, 'cookies is omitted');

// With credentials: cookie should be sent back.
const xhr3 = await doXhr('https://httpbin.org/cookies', true);
result = JSON.parse(xhr3.responseText);
assert.eq(result.cookies.key, cookieValue, 'cookies is same');

const cookies = new TextDecoder().decode(await tjs.readFile(cookieJarPath));
assert.ok(cookies.includes(cookieValue), 'cookies has wrote to disk');

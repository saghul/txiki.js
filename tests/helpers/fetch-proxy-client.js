// Helper for test-fetch-proxy.js
// Fetches TARGET_URL and prints JSON result to stdout.

const url = tjs.env.TARGET_URL;
const resp = await fetch(url);
const body = await resp.text();

console.log(JSON.stringify({ status: resp.status, body }));

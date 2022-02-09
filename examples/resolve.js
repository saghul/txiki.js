// getaddrinfo example.
//

(async function() {
    const res = await tjs.getaddrinfo(tjs.args[2], tjs.args[3], { socktype: tjs.SOCK_STREAM, protocol: tjs.IPPROTO_TCP });
    console.log(JSON.stringify(res, undefined, 2));
})().catch(e => {
    console.log(e);
    console.log(e.stack);
});

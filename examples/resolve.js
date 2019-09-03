// getaddrinfo example.
//

(async function() {
    const res = await quv.dns.getaddrinfo(quv.args[2]);
    console.log(JSON.stringify(res, undefined, 2));
})().catch(e => {
    console.log(e);
    console.log(e.stack);
});

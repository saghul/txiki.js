// getaddrinfo example.
//

const res = await tjs.getaddrinfo(tjs.args[3], tjs.args[4], { socktype: tjs.SOCK_STREAM, protocol: tjs.IPPROTO_TCP });
console.log(JSON.stringify(res, undefined, 2));

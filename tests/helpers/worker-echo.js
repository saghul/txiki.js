addEventListener('message', function(e) {
    postMessage(e.data);
});

addEventListener('messageerror', function(e) {
    throw new Error(`Opps! ${e}`);
});

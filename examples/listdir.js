// Streaming readdir using async iteraion.
//

(async function() {
    const dirIter = await tjs.readdir(tjs.args[2]);
    for await (const item of dirIter) {
        console.log(item.name);
    }
})().catch(e => {
    console.log(e);
    console.log(e.stack);
});

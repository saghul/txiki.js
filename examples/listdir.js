// Streaming readdir using async iteraion.
//

(async function() {
    const dirIter = await quv.fs.readdir(quv.args[2]);
    for await (const item of dirIter) {
        console.log(item.name);
    }
})().catch(e => {
    console.log(e);
    console.log(e.stack);
});

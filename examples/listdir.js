// Streaming readdir using async iteraion.
//

(async function() {
    const dirIter = await uv.fs.readdir(global.scriptArgs[2]);
    for await (const item of dirIter) {
        console.log(item.name);
    }
})().catch(e => {
    console.log(e);
    console.log(e.stack);
});

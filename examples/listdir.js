// Streaming readdir using async iteration.
//

const dirIter = await tjs.readdir(tjs.args[3]);
for await (const item of dirIter) {
    console.log(item.name);
}

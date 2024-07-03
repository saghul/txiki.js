// Streaming readdir using async iteration.
//

const dirIter = await tjs.readDir(tjs.args[3]);
for await (const item of dirIter) {
    console.log(item.name);
}

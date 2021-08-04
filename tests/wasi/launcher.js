import { dirname, join } from '@tjs/path';

const thisFile = import.meta.url.slice(7);   // strip "file://"

(async () => {
    const script = tjs.args[2];
    const args = tjs.args.slice(3);
    const bytes = await tjs.fs.readFile(join(dirname(thisFile),script));
    const module = new WebAssembly.Module(bytes);
    const wasi = new WebAssembly.WASI({ args });
    const importObject = { wasi_unstable: wasi.wasiImport };
    const instance = new WebAssembly.Instance(module, importObject);

    wasi.start(instance);
})();

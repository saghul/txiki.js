import { path } from '@tjs/std';


(async () => {
    const script = tjs.args[2];
    const args = tjs.args.slice(3);
    const bytes = await tjs.readFile(path.join(import.meta.dirname,script));
    const module = new WebAssembly.Module(bytes);
    const wasi = new WebAssembly.WASI({ args });
    const importObject = { wasi_unstable: wasi.wasiImport };
    const instance = new WebAssembly.Instance(module, importObject);

    wasi.start(instance);
})();

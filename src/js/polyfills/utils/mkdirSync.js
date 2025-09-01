const core = globalThis[Symbol.for('tjs.internal.core')];

export function mkdirSync(path, options = { mode: 0o777, recursive: false }) {
    const pathModule = globalThis[Symbol.for('tjs.internal.modules.path')];

    if (!options.recursive) {
        return core.mkdirSync(path, options.mode);
    }

    const parent = pathModule.dirname(path);

    if (parent === path) {
        return;
    }

    mkdirSync(parent, options);

    try {
        return core.mkdirSync(path, options.mode);
    } catch (e) {
        // Cannot rely on checking for EEXIST since the OS could throw other errors like EROFS.

        const st = core.statSync(path);

        if (!st.isDirectory) {
            throw e;
        }
    }
}

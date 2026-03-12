/* global tjs */

import path from 'tjs:path';

const core = globalThis[Symbol.for('tjs.internal.core')];
const APP_DIR = 'app';
const APP_MANIFEST = 'app.json';

/**
 * TPK trailer for bundled app packages.
 *
 * Binary layout (appended to the tjs executable):
 *   [Build UUID - 32 bytes, ASCII string without dashes]
 *   [SHA-256 of ZIP data - 32 bytes]
 *   [ZIP data - N bytes]
 *   [ZIP data size - 8 bytes, little-endian uint64]
 *   [Magic - 4 bytes: "TPK\0"]
 */
export const TpkTrailer = {
    Magic: 'TPK\0',
    MagicSize: 4,
    ZipSizeFieldSize: 8,
    HashSize: 32,
    UuidSize: 32,
    // Size of the fixed trailer (magic + zip size field)
    FixedSize: 12,
};

export async function runTpk(exef, exeSize) {
    // Read zip size (8 bytes before magic).
    const zipSizeBuf = new Uint8Array(TpkTrailer.ZipSizeFieldSize);

    await exef.read(zipSizeBuf, exeSize - TpkTrailer.FixedSize);

    const zipSizeDv = new DataView(zipSizeBuf.buffer);
    const zipSize = Number(zipSizeDv.getBigUint64(0, true));

    // Read the full payload: UUID + SHA-256 + ZIP data.
    const payloadOffset = exeSize - TpkTrailer.FixedSize - zipSize - TpkTrailer.HashSize - TpkTrailer.UuidSize;
    const uuidBuf = new Uint8Array(TpkTrailer.UuidSize);

    await exef.read(uuidBuf, payloadOffset);

    const hashBuf = new Uint8Array(TpkTrailer.HashSize);

    await exef.read(hashBuf, payloadOffset + TpkTrailer.UuidSize);

    const zipData = new Uint8Array(zipSize);

    await exef.read(zipData, payloadOffset + TpkTrailer.UuidSize + TpkTrailer.HashSize);
    await exef.close();

    // Verify SHA-256.
    const computedHash = new Uint8Array(await crypto.subtle.digest('SHA-256', zipData));

    for (let i = 0; i < TpkTrailer.HashSize; i++) {
        if (computedHash[i] !== hashBuf[i]) {
            throw new Error('TPK integrity check failed: binary is corrupted or tampered with');
        }
    }

    const buildId = new TextDecoder().decode(uuidBuf);
    const cacheDir = path.join(tjs.tmpDir, `tjs-${buildId}`);

    let needsExtract = true;

    try {
        const st = await tjs.stat(cacheDir);

        if (st.isDirectory) {
            needsExtract = false;
        }
    } catch (_) {
        // Doesn't exist, need to extract.
    }

    if (needsExtract) {
        const tmpDir = `${cacheDir}.tmp.${tjs.pid}`;

        try {
            await tjs.makeDir(tmpDir, { recursive: true });

            const entries = core.zipExtract(zipData);

            for (const entry of entries) {
                const filePath = path.join(tmpDir, entry.name);
                const dir = path.dirname(filePath);

                await tjs.makeDir(dir, { recursive: true });
                await tjs.writeFile(filePath, entry.data, { mode: 0o600 });
            }
        } catch (e) {
            // Clean up failed extraction.
            try {
                await tjs.remove(tmpDir, { recursive: true });
            } catch (_) {
                // Ignore cleanup error.
            }

            throw new Error(`TPK extraction failed: ${e.message}`);
        }

        // Atomic rename.
        try {
            await tjs.rename(tmpDir, cacheDir);
        } catch (_) {
            // Another process won the race, use theirs.
            try {
                await tjs.remove(tmpDir, { recursive: true });
            } catch (_) {
                // Ignore.
            }
        }
    }

    // Validate manifest.
    const manifestData = await tjs.readFile(path.join(cacheDir, 'app.json'));
    const manifest = JSON.parse(new TextDecoder().decode(manifestData));

    if (manifest.version !== 0) {
        throw new Error(`Unsupported tpk version: ${manifest.version}`);
    }

    const manifestBuildId = manifest.build?.id?.replace(/-/g, '');

    if (manifestBuildId !== buildId) {
        throw new Error('TPK build ID mismatch');
    }

    const entryPoint = manifest.main ?? 'src/main.js';
    const mainFile = path.join(cacheDir, entryPoint);

    tjs.env.TJS_HOME = cacheDir;

    await core.evalFile(mainFile);
}

export async function appInit() {
    let exists = false;

    try {
        const st = await tjs.stat(APP_DIR);

        exists = st.isDirectory;
    } catch (_) {
        // Doesn't exist, good.
    }

    if (exists) {
        throw new Error(`'${APP_DIR}/' directory already exists`);
    }

    await tjs.makeDir(path.join(APP_DIR, 'src'), { recursive: true });

    const manifest = {
        version: 0,
        build: {},
        main: 'src/main.js',
    };

    await tjs.writeFile(path.join(APP_DIR, APP_MANIFEST), JSON.stringify(manifest, null, 4) + '\n');
    await tjs.writeFile(path.join(APP_DIR, 'src', 'main.js'), 'console.log(\'Hello from tpk!\');\n');

    console.log(`App created in '${APP_DIR}/'`);
}

async function readAppDir() {
    const manifestPath = path.join(APP_DIR, APP_MANIFEST);

    let manifestData;

    try {
        manifestData = await tjs.readFile(manifestPath);
    } catch (_) {
        throw new Error(`'${manifestPath}' not found. Run 'tjs app init' first.`);
    }

    const manifest = JSON.parse(new TextDecoder().decode(manifestData));

    if (manifest.version !== 0) {
        throw new Error(`Unsupported manifest version: ${manifest.version}`);
    }

    return manifest;
}

async function collectFiles(dir, prefix = '') {
    const entries = [];
    const dirIter = await tjs.readDir(dir);

    for await (const item of dirIter) {
        const name = item.name;
        const fullPath = path.join(dir, name);
        const entryName = prefix ? `${prefix}/${name}` : name;

        if (item.isDirectory) {
            const subEntries = await collectFiles(fullPath, entryName);

            entries.push(...subEntries);
        } else {
            const data = await tjs.readFile(fullPath);

            entries.push({ name: entryName, data });
        }
    }

    return entries;
}

async function buildTpk() {
    const manifest = await readAppDir();

    // Generate fresh build ID and timestamp.
    // Remove dashes from UUID for compactness.
    manifest.build = {
        id: crypto.randomUUID().replace(/-/g, ''),
        timestamp: new Date().toISOString(),
    };

    // Collect all files, replacing app.json with the updated manifest.
    const files = await collectFiles(APP_DIR);
    const enc = new TextEncoder();
    const updatedManifest = enc.encode(JSON.stringify(manifest, null, 4) + '\n');
    const zipEntries = files.map(f => {
        if (f.name === APP_MANIFEST) {
            return { name: f.name, data: updatedManifest };
        }

        return f;
    });

    const zipData = core.zipCreate(zipEntries);

    return { manifest, zipData };
}

export async function appPack(outfile) {
    const { manifest, zipData } = await buildTpk();
    const outputPath = outfile ?? `${manifest.build.id}.tpk`;

    await tjs.writeFile(outputPath, zipData);

    console.log(`Packed ${outputPath} (build ${manifest.build.id})`);
}

export async function appCompile(outfile) {
    const { manifest, zipData } = await buildTpk();

    const enc = new TextEncoder();
    const uuidBytes = enc.encode(manifest.build.id);
    const hashBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', zipData));

    // Read the tjs executable as template.
    const exe = await tjs.readFile(tjs.exePath);
    const exeSize = exe.length;

    // Layout: [EXE][UUID 32][SHA-256 32][ZIP N][zip_size 8 LE][magic 4]
    const trailerSize = TpkTrailer.UuidSize + TpkTrailer.HashSize + zipData.length + TpkTrailer.FixedSize;
    const newBuffer = exe.buffer.transfer(exeSize + trailerSize);
    const newExe = new Uint8Array(newBuffer);
    let offset = exeSize;

    // UUID
    newExe.set(uuidBytes, offset);
    offset += TpkTrailer.UuidSize;

    // SHA-256
    newExe.set(hashBytes, offset);
    offset += TpkTrailer.HashSize;

    // ZIP data
    newExe.set(zipData, offset);
    offset += zipData.length;

    // ZIP size (8 bytes, little-endian)
    const sizeDv = new DataView(newBuffer, offset, TpkTrailer.ZipSizeFieldSize);

    sizeDv.setBigUint64(0, BigInt(zipData.length), true);
    offset += TpkTrailer.ZipSizeFieldSize;

    // Magic
    newExe.set(enc.encode(TpkTrailer.Magic), offset);

    let newFileName = outfile ?? 'app';

    if (navigator.userAgentData.platform === 'Windows' && !newFileName.endsWith('.exe')) {
        newFileName += '.exe';
    }

    await tjs.writeFile(newFileName, newExe, { mode: 0o755 });

    console.log(`Compiled ${newFileName} (build ${manifest.build.id})`);
}

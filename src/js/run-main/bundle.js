/* global tjs */

import { UntarStream } from '@jsr/std__tar/untar-stream';
import path from 'tjs:path';

const ESBUILD_VERSION = '0.27.3';


async function getPackageInfo() {
    const ua = navigator.userAgentData;
    const { architecture, bitness } = await ua.getHighEntropyValues([
        'architecture',
        'bitness',
    ]);

    const platformMap = { macOS: 'darwin', Linux: 'linux', Windows: 'win32' };
    const archMap = { 'arm-64': 'arm64', 'x86-64': 'x64', 'x86-32': 'ia32' };

    const esPlatform = platformMap[ua.platform];
    const esArch = archMap[`${architecture}-${bitness}`];

    if (!esPlatform || !esArch) {
        throw new Error(
            `Unsupported platform/arch: ${ua.platform} ${architecture} ${bitness}`,
        );
    }

    return {
        packageName: `@esbuild/${esPlatform}-${esArch}`,
        isWindows: ua.platform === 'Windows',
    };
}


async function downloadEsbuild(destDir) {
    const info = await getPackageInfo();
    const binaryName = info.isWindows ? 'esbuild.exe' : 'esbuild';
    const tarPath = info.isWindows ? 'esbuild.exe' : 'bin/esbuild';
    const destPath = path.join(destDir, binaryName);

    const scope = info.packageName.split('/');
    const tarballUrl =
        `https://registry.npmjs.org/${info.packageName}/-/${scope[1]}-${ESBUILD_VERSION}.tgz`;

    console.log(`Downloading esbuild v${ESBUILD_VERSION}...`);

    const res = await fetch(tarballUrl);

    if (!res.ok) {
        throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }

    const entries = res.body
        .pipeThrough(new DecompressionStream('gzip'))
        .pipeThrough(new UntarStream());

    let found = false;

    for await (const entry of entries) {
        if (entry.path.endsWith(tarPath) && entry.readable) {
            const fh = await tjs.open(destPath, 'w');

            await entry.readable.pipeTo(fh.writable);

            if (!info.isWindows) {
                await tjs.chmod(destPath, 0o755);
            }

            found = true;
            break;
        } else if (entry.readable) {
            await entry.readable.cancel();
        }
    }

    if (!found) {
        throw new Error('Could not find esbuild binary inside the tarball');
    }

    return destPath;
}


async function ensureEsbuild(tjsHome) {
    const info = await getPackageInfo();
    const binaryName = info.isWindows ? 'esbuild.exe' : 'esbuild';
    const esbuildDir = path.join(tjsHome, 'esbuild', ESBUILD_VERSION);
    const esbuildPath = path.join(esbuildDir, binaryName);

    try {
        const st = await tjs.stat(esbuildPath);

        if (st.isFile) {
            return esbuildPath;
        }
    } catch (_) {
        // Does not exist, download it.
    }

    await tjs.makeDir(esbuildDir, { recursive: true });

    return await downloadEsbuild(esbuildDir);
}


async function runEsbuild(esbuildPath, infile, outfile, minify) {
    const args = [
        esbuildPath,
        infile,
        '--bundle',
        `--outfile=${outfile}`,
        '--external:tjs:*',
        '--target=esnext',
        '--platform=neutral',
        '--format=esm',
        '--main-fields=main,module',
    ];

    if (minify) {
        args.push('--minify', '--keep-names');
    }

    const proc = tjs.spawn(args, {
        stdout: 'inherit',
        stderr: 'inherit',
    });
    const status = await proc.wait();

    if (status.exit_status !== 0) {
        throw new Error(`esbuild exited with code ${status.exit_status}`);
    }
}


export async function bundle(tjsHome, args) {
    const opts = {
        infile: undefined,
        outfile: undefined,
        minify: false,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--minify' || arg === '-m') {
            opts.minify = true;
        } else if (!opts.infile) {
            opts.infile = arg;
        } else if (!opts.outfile) {
            opts.outfile = arg;
        }
    }

    if (!opts.infile) {
        return false;
    }

    if (!opts.outfile) {
        const parsed = path.parse(opts.infile);

        opts.outfile = path.join(parsed.dir, `${parsed.name}.bundle.js`);
    }

    const esbuildPath = await ensureEsbuild(tjsHome);

    await runEsbuild(esbuildPath, opts.infile, opts.outfile, opts.minify);

    return true;
}

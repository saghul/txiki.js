#!/bin/env node
import { existsSync, write } from 'node:fs'
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises'

import { program } from 'commander';
import { randomUUID } from 'node:crypto';
import { exec as _exec } from 'node:child_process';
import { Readable } from 'node:stream'
import util from 'node:util';

const exec = util.promisify(_exec);

import fg from 'fast-glob'

async function copy_template(path, subdir) {
    const tests = await fg(`./extras/${path}/${subdir}/*.js`);
    const prefix = `./${subdir}/${path}/${subdir}/`.length
    const suffix = ".js".length
    for (const test of tests) {
        const name = test.substring(prefix, test.length - suffix).replaceAll("[module]", path)
        await writeFile(`./${subdir}/extras/${name}.js`, ((await readFile(test)).toString().replaceAll('__MODULE__', path)))

    }
}

async function install(path) {
    await writeFile(`./src/extras/${path}.c`, ((await readFile(`./extras/${path}/src/[module].c`)).toString().replaceAll('__MODULE__', path)))
    await writeFile(`./src/js/extras/${path}.js`, ((await readFile(`./extras/${path}/src/[module].js`)).toString().replaceAll('__MODULE__', path)))
    await writeFile(`./docs/types/extras/${path}.d.ts`, ((await readFile(`./extras/${path}/src/[module].d.ts`)).toString().replaceAll('__MODULE__', path)))

    await copy_template(path, 'examples')
    await copy_template(path, 'benchmarks')
    await copy_template(path, 'tests')
}

async function clear() {
    await rm('extras/', { recursive: true, force: true });
    await rm('src/extras/', { recursive: true, force: true });
    await rm('src/js/extras/', { recursive: true, force: true });
    await rm('tests/extras/', { recursive: true, force: true });
    await rm('examples/extras/', { recursive: true, force: true });
    await rm('deps/extras/', { recursive: true, force: true });
    await rm('benchmark/extras/', { recursive: true, force: true });
    await rm('docs/types/extras/', { recursive: true, force: true });
}

program
    .name('extras-helper.mjs')
    .description('A CLI to customize your txiki distribution');

program.command('clear')
    .description('Clear after your previous configuration')
    .action(async () => {
        await clear()
    })

program.command('clone')
    .description('Clear after your previous configuration')
    .argument("[filename]", 'filename for the configuration', './modules.json')
    .action(async (filename) => {
        //For now, since I am too lazy to handle merging
        await clear()

        await mkdir("extras/", { errorOnExist: false });
        await mkdir('src/extras/', { errorOnExist: false });
        await mkdir('src/js/extras/', { errorOnExist: false });
        await mkdir('tests/extras/', { errorOnExist: false });
        await mkdir('examples/extras/', { errorOnExist: false });
        await mkdir('deps/extras/', { errorOnExist: false });
        await mkdir('benchmark/extras/', { errorOnExist: false });
        await mkdir('docs/types/extras/', { errorOnExist: false });

        let config = undefined
        try {
            config = JSON.parse(await readFile(filename))
        }
        catch (e) {
            console.error("Unable to parse the config file.")
            process.exit(1)
        }

        for (const module of Object.entries(config)) {
            //From the internet
            if (module[1].startsWith('https://') || module[1].startsWith('http://')) {
                await writeFile(
                    `./extras/${module[0]}.tar.gz`,
                    Readable.fromWeb(
                        (await fetch(module[1])).body,
                    ),
                )
                await exec(`mkdir ./extras/${module[0]} &&  tar -xvzf ./extras/${module[0]}.tar.gz -C ./extras/${module[0]} --strip-components=1`);
                await rm(`./extras/${module[0]}.tar.gz`)
            }
            //Local folder
            else {
                //TODO: Copy from local fs
                await cp(module[1], `./extras/${module[0]}`, { recursive: true, dereference: true, errorOnExist: false })
            }
            await install(module[0])
        }

        //Placeholder for now
        await writeFile('deps/extras/CMakeLists.txt', '')
        await writeFile('./modules.json', JSON.stringify(config, null, 4))

        //Construct src/extras.bootstrap to initialize the extra modules
        await writeFile('./src/extras-bootstrap.c.frag', Object.keys(config).map(x => `tjs__mod_${x}_init(ctx, ns);`).join('\n'))
        await writeFile('./src/extras-proto.c.frag', Object.keys(config).map(x => `void tjs__mod_${x}_init(JSContext *ctx, JSValue ns);`).join('\n'))
        await writeFile('./src/extras-bundles.c.frag', Object.keys(config).map(x => `#include "bundles/c/extras/${x}.c"`).join('\n'))
        await writeFile('./src/extras-entries.c.frag', Object.keys(config).map(x => `{ "tjs:${x}", tjs__${x}, tjs__${x}_size},`).join('\n'))

        //Construct the ts header
        await writeFile('./docs/types/extras/index.d.ts', Object.keys(config).map(x => `import "./${x}.d.ts";`).join('\n'))
    })


program.parse();

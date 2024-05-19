#!/bin/env node
import { existsSync, write } from 'node:fs'
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises'

import { program } from 'commander';
import { randomUUID } from 'node:crypto';

async function install(path) {
    //TODO
    //replace [module] && __module__
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
                //TODO: Copy from the internet & unpack
                //Need to check for deps
            }
            //Local folder
            else {
                //TODO: Copy from local fs
                await cp(module[1], `./extras/${module[0]}`, { recursive: true, dereference: true, errorOnExist: false })
            }
            await install(`./extras/${module[0]}`)
        }

        //Placeholder for now
        await writeFile('deps/extras/CMakeLists.txt', '')
        await writeFile('./modules.json', JSON.stringify(config, null, 4))

        //Construct src/extras.bootstrap
        await writeFile('./src/extras.bootstrap', Object.keys(config).map(x => `tjs__mod_${x}_init(ctx, ns);`).join('\n'))
    })

program.command('extract')
    .description('Utility command to extract a module from this repo')
    .argument("<module>", "the module name to select from")
    .argument("[where]", 'the destination folder for the files to be copied over')
    .action(async (module, where) => {
        //TODO: If not found list the ones available

        let config = undefined
        try {
            config = JSON.parse(await readFile('./modules.json'))
        }
        catch (e) {
            console.error("Unable to parse the config file.")
            process.exit(1)
        }

        if (Object.keys(config).includes(module)) {
            const location = config[module]
            //Remote source
            if (location.startsWith('https://') || location.startsWith('http://')) {
                where ??= `/tmp/${randomUUID()}`
                console.error('Packing for remote modules not yet supported')
            }
            //Local folder
            else {
                where ??= location
                //TODO: Fold back
            }
            console.log(`Files copied over to ${where}`)
        }

        else {
            console.error('Name not matched, select from', Object.keys(config))
        }

    })

program.parse();

#!/bin/env node
import { existsSync } from 'node:fs'
import { readFile, rmdir, mkdir } from 'node:fs/promises'

import { program } from 'commander';
import { randomUUID } from 'node:crypto';


program
    .name('extras-helper.mjs')
    .description('A CLI to customize your txiki distribution');

program.command('clear')
    .description('Clear after your previous configuration')
    .action(async () => {
        await rmdir('extras/');
        await rmdir('src/extras/');
        await rmdir('src/bundles/c/extras/');
        await rmdir('tests/extras/');
        await rmdir('examples/extras/');
        await rmdir('deps/extras/');
        await rmdir('benchmark/extras/');
    })

program.command('clone')
    .description('Clear after your previous configuration')
    .argument("[filename]", 'filename for the configuration', './modules.json')
    .action(async (filename) => {
        await mkdir('extras/');
        await mkdir('src/extras/');
        await mkdir('src/bundles/c/extras/');
        await mkdir('tests/extras/');
        await mkdir('examples/extras/');
        await mkdir('deps/extras/');
        await mkdir('benchmark/extras/');

        try {
            const config = JSON.parse(await readFile(filename))
        }
        catch (e) {
            console.error("Unable to parse the config file.")
            process.exit(1)
        }

        for (const file of Object.entries(config)) {
            console.log(file)
        }

    })

program.command('extract')
    .description('Utility command to extract a module from this repo')
    .argument("<module>", "the module name to select from")
    .argument("[where]", 'the destination folder for the files to be copied over', `/tmp/${randomUUID()}`)
    .action(async (where) => {
        //TODO: If not found list the ones available

        //TODO: Fold back
        console.log(`Files copied over to ${where}`)
    })

program.parse();
//CLI Options:
//install (default)
//clear
//reinstall (clear+install)
//extract [name] Extract a module out of the current configuration and save it (useful for developers of custom modules)

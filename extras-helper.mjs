#!/bin/env node
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'

import { program } from 'commander';
import { randomUUID } from 'node:crypto';


program
    .name('extras-helper.mjs')
    .description('A CLI to customize your txiki distribution');

program.command('clear')
    .description('Clear after your previous configuration')
    .action(async () => {
        await rm('extras/', { recursive: true, force: true });
        await rm('src/extras/', { recursive: true, force: true });
        await rm('src/js/extras/', { recursive: true, force: true });
        await rm('tests/extras/', { recursive: true, force: true });
        await rm('examples/extras/', { recursive: true, force: true });
        await rm('deps/extras/', { recursive: true, force: true });
        await rm('benchmark/extras/', { recursive: true, force: true });
        await rm('docs/types/extras/', { recursive: true, force: true });

    })

program.command('clone')
    .description('Clear after your previous configuration')
    .argument("[filename]", 'filename for the configuration', './modules.json')
    .action(async (filename) => {
        if (!existsSync("extras/")) await mkdir("extras/");
        if (!existsSync("src/extras/")) await mkdir('src/extras/');
        if (!existsSync("src/js/extras/")) await mkdir('src/js/extras/');
        if (!existsSync("tests/extras/")) await mkdir('tests/extras/');
        if (!existsSync("examples/extras/")) await mkdir('examples/extras/');
        if (!existsSync("deps/extras/")) await mkdir('deps/extras/');
        if (!existsSync("benchmark/extras/")) await mkdir('benchmark/extras/');
        if (!existsSync("docs/types/extras/")) await mkdir('docs/types/extras/');

        //Placeholder for now
        await writeFile('deps/extras/CMakeLists.txt', '')

        let config = undefined
        try {
            config = JSON.parse(await readFile(filename))
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

#!/bin/env node
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

//CLI Options:
//install (default)
//clear
//reinstall (clear+install)
//extract [name] Extract a module out of the current configuration and save it (useful for developers of custom modules)

if(existsSync('./modules.json')){
    const config = await readFile('./modules.json')
    //If local dir, just copy directly from there
    //If internet name, get it, unzip it in ./extras, unpack it across all folder & you are done
}
else{
    process.exit(0)
}

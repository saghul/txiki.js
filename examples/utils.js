'use strict';

export function addr(obj) {
    return `${obj.ip}:${obj.port}`;
}

export function logError(e) {
    console.log(`Oops! ${e}`);
    console.log(e.stack);
}

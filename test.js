// import { createRequire } from 'module';
// const require = createRequire(import.meta.url);

import('./test2.js').then(a => {
    console.log('apa');
    console.log(a.runRepl);
});

// console.log(require('./test2'));

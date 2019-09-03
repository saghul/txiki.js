// quv internal bootstrap.
//

import * as quv from 'quv';

globalThis.quv = quv;
globalThis.setTimeout = quv.setTimeout;
globalThis.clearTimeout = quv.clearTimeout;
globalThis.setInterval = quv.setInterval;
globalThis.clearInterval = quv.clearInterval;

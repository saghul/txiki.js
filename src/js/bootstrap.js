// quv internal bootstrap.
//

import * as std from 'std';
import * as uv from 'uv';

global.std = std;
global.uv = uv;
global.setTimeout = uv.setTimeout;
global.clearTimeout = uv.clearTimeout;
global.setInterval = uv.setInterval;
global.clearInterval = uv.clearInterval;

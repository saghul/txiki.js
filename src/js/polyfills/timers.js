const core = globalThis[Symbol.for('tjs.internal.core')];

globalThis.setTimeout = core.setTimeout;
globalThis.clearTimeout = core.clearTimeout;

globalThis.setInterval = core.setInterval;
globalThis.clearInterval = core.clearInterval;

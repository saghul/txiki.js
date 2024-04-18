const core = import.meta.core;

globalThis.setTimeout = core.setTimeout;
globalThis.clearTimeout = core.clearTimeout;

globalThis.setInterval = core.setInterval;
globalThis.clearInterval = core.setInterval;

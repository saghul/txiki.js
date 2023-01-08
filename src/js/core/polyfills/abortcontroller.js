import {
    AbortController,
    abortableFetch,
} from 'abortcontroller-polyfill/dist/cjs-ponyfill';

globalThis.fetch = abortableFetch(fetch);

export { AbortController };

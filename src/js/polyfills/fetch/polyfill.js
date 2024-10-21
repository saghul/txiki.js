import { fetch } from './fetch.js';
import { Headers } from './headers.js';
import { Request } from './request.js';
import { Response } from './response.js';

globalThis.fetch = fetch;
globalThis.Headers = Headers;
globalThis.Request = Request;
globalThis.Response = Response;

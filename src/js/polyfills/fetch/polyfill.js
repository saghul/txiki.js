import { fetch } from './fetch.js';
import { Request } from './request.js';
import { Response } from './response.js';
import { Headers } from './headers.js';


globalThis.fetch = fetch;
globalThis.Request = Request;
globalThis.Response = Response;
globalThis.Headers = Headers;

import { fetch } from './fetch.js';
import { Request } from './request.js';
import { Response } from './response.js';


globalThis.fetch = fetch;
globalThis.Request = Request;
globalThis.Response = Response;

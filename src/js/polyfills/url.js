import { URLPattern } from 'urlpattern-polyfill';
import { URL, URLSearchParams } from 'whatwg-url';

globalThis.URL = URL;
globalThis.URLPattern = URLPattern;
globalThis.URLSearchParams = URLSearchParams;

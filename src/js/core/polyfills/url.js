import URL from 'core-js/actual/url';
import URLSearchParams from 'core-js/actual/url-search-params';

URL.prototype.toJSON = function toJSON() {
    return this.toString();
};

export { URL,URLSearchParams };



const core = globalThis[Symbol.for('tjs.internal.core')];
const NativeHttpClient = core.HttpClient;

const kMaxRedirects = 20;

class HttpClient {
    #redirectMode = 'follow';
    #redirectCount = 0;
    #method = '';
    #url = '';
    #body = null;
    #headers = [];
    #cookies = false;
    #client = null;

    get onstatus() {
        return this._onstatus ?? null;
    }

    set onstatus(v) {
        this._onstatus = v;
    }

    get onurl() {
        return this._onurl ?? null;
    }

    set onurl(v) {
        this._onurl = v;
    }

    get onheader() {
        return this._onheader ?? null;
    }

    set onheader(v) {
        this._onheader = v;
    }

    get onheadersend() {
        return this._onheadersend ?? null;
    }

    set onheadersend(v) {
        this._onheadersend = v;
    }

    get ondata() {
        return this._ondata ?? null;
    }

    set ondata(v) {
        this._ondata = v;
    }

    get oncomplete() {
        return this._oncomplete ?? null;
    }

    set oncomplete(v) {
        this._oncomplete = v;
    }

    get ondrain() {
        return this._ondrain ?? null;
    }

    set ondrain(v) {
        this._ondrain = v;
    }

    get timeout() {
        return this.#client ? this.#client.timeout : 0;
    }

    set timeout(v) {
        if (this.#client) {
            this.#client.timeout = v;
        }

        this._timeout = v;
    }

    get streaming() {
        return this.#client ? this.#client.streaming : false;
    }

    set streaming(v) {
        this._streaming = v;

        if (this.#client) {
            this.#client.streaming = v;
        }
    }

    get redirectMode() {
        return this.#redirectMode;
    }

    set redirectMode(v) {
        if (v === 'follow' || v === 'error' || v === 'manual') {
            this.#redirectMode = v;
        }
    }

    setRequestHeader(name, value) {
        this.#headers.push([ name, value ]);

        if (this.#client) {
            this.#client.setRequestHeader(name, value);
        }
    }

    setEnableCookies(enable) {
        this.#cookies = !!enable;

        if (this.#client) {
            this.#client.setEnableCookies(enable);
        }
    }

    sendData(data) {
        if (this.#client) {
            this.#client.sendData(data);
        }
    }

    abort() {
        if (this.#client) {
            this.#client.abort();
            this.#client = null;
        }
    }

    open(method, url, body) {
        this.#method = method;
        this.#url = url;
        this.#body = body !== undefined ? body : null;
        this.#redirectCount = 0;
        this.#connect();
    }

    #connect() {
        const client = new NativeHttpClient();

        this.#client = client;

        if (this._timeout > 0) {
            client.timeout = this._timeout;
        }

        if (this.#cookies) {
            client.setEnableCookies(true);
        }

        if (this._streaming) {
            client.streaming = true;
        }

        // Re-apply stored headers for redirect hops.
        for (const [ name, value ] of this.#headers) {
            client.setRequestHeader(name, value);
        }

        client.onstatus = status => {
            // Check for redirect.
            if (status >= 300 && status < 400) {
                if (this.#redirectMode === 'error') {
                    client.onstatus = null;
                    client.onheader = null;
                    client.onheadersend = null;
                    client.ondata = null;

                    client.oncomplete = () => {
                        this._oncomplete?.('REDIRECT_ERROR');
                    };

                    return;
                }

                if (this.#redirectMode === 'follow') {
                    this.#redirectCount++;

                    if (this.#redirectCount > kMaxRedirects) {
                        client.onstatus = null;
                        client.onheader = null;
                        client.onheadersend = null;
                        client.ondata = null;

                        client.oncomplete = () => {
                            this._oncomplete?.('TOO_MANY_REDIRECTS');
                        };

                        return;
                    }

                    // Collect the Location header from the redirect response.
                    let location = null;

                    client.onheader = (name, value) => {
                        if (name.toLowerCase() === 'location') {
                            location = value;
                        }
                    };

                    client.onheadersend = () => {
                        // Swallow the redirect response headers.
                    };

                    client.ondata = () => {
                        // Swallow redirect body.
                    };

                    client.oncomplete = error => {
                        if (error) {
                            this._oncomplete?.(error);

                            return;
                        }

                        if (!location) {
                            // No Location header, shouldn't happen but treat as error.
                            this._oncomplete?.('REDIRECT_FAILED');

                            return;
                        }

                        // Resolve relative URLs.
                        try {
                            location = new URL(location, this.#url).href;
                        } catch {
                            this._oncomplete?.('REDIRECT_FAILED');

                            return;
                        }

                        this.#url = location;

                        // 301/302/303: change method to GET, drop body.
                        if (status === 301 || status === 302 || status === 303) {
                            if (this.#method !== 'GET' && this.#method !== 'HEAD') {
                                this.#method = 'GET';
                            }

                            this.#body = null;
                        }

                        // Reconnect to the new URL.
                        this.#connect();
                    };

                    return;
                }

                // "manual" mode: fall through, deliver the 3xx response as-is.
            }

            this._onstatus?.(status);
        };

        client.onurl = url => {
            this._onurl?.(url);
        };

        client.onheader = (name, value) => {
            this._onheader?.(name, value);
        };

        client.onheadersend = () => {
            this._onheadersend?.();
        };

        client.ondata = chunk => {
            this._ondata?.(chunk);
        };

        client.oncomplete = (error, reason) => {
            this._oncomplete?.(error, reason);
        };

        client.ondrain = () => {
            this._ondrain?.();
        };

        client.open(this.#method, this.#url, this.#body);
    }
}

export { HttpClient };

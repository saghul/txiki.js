---
sidebar_position: 4
title: HTTP Proxy Support
---

# HTTP Proxy Support

txiki.js automatically reads standard proxy environment variables and routes HTTP requests through the appropriate proxy. This applies to `fetch()`, `XMLHttpRequest`, `WebSocket`, and HTTP module imports.

No opt-in flags or configuration is needed — just set the environment variables and requests are proxied automatically.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `http_proxy` / `HTTP_PROXY` | Proxy for `http://` and `ws://` requests |
| `https_proxy` / `HTTPS_PROXY` | Proxy for `https://` and `wss://` requests |
| `all_proxy` / `ALL_PROXY` | Fallback proxy when the scheme-specific variable is not set |
| `no_proxy` / `NO_PROXY` | Comma-separated list of hosts that should bypass the proxy |

Lowercase variants take precedence over uppercase when both are set.

### Per-scheme proxy selection

Proxy selection is based on the **target URL scheme**, not the proxy URL scheme:

```bash
# Only http:// requests go through the proxy
http_proxy=http://proxy:8080 tjs run app.js

# Only https:// requests go through the proxy
https_proxy=http://proxy:8080 tjs run app.js

# Both http:// and https:// requests go through the proxy
all_proxy=http://proxy:8080 tjs run app.js
```

If both a scheme-specific variable and `all_proxy` are set, the scheme-specific variable wins:

```bash
# http:// goes through proxy-a, https:// goes through proxy-b
http_proxy=http://proxy-a:8080 https_proxy=http://proxy-b:8080 tjs run app.js

# http:// goes through proxy-a, https:// falls back to all_proxy
http_proxy=http://proxy-a:8080 all_proxy=http://proxy-b:8080 tjs run app.js
```

## Proxy Authentication

Basic authentication is supported by embedding credentials in the proxy URL:

```bash
http_proxy=http://user:password@proxy:8080 tjs run app.js
```

The runtime extracts the credentials and sends them as a `Proxy-Authorization` header automatically.

## Bypassing the Proxy

Use `no_proxy` to skip the proxy for specific hosts:

```bash
no_proxy=localhost,127.0.0.1,.internal.corp tjs run app.js
```

### Supported patterns

| Pattern | Example | Behavior |
|---------|---------|----------|
| Exact hostname | `example.com` | Matches only `example.com` |
| Domain suffix | `.example.com` | Matches `foo.example.com` and `example.com` |
| Port-specific | `example.com:8080` | Matches only when the target port is 8080 |
| Wildcard | `*` | Bypasses the proxy for all requests |

Multiple entries are separated by commas. Whitespace around entries is trimmed.

```bash
# Bypass proxy for localhost, any *.corp host, and example.com on port 3000
no_proxy="localhost, .corp, example.com:3000" tjs run app.js
```

## Affected APIs

All outbound HTTP connections respect proxy settings:

- **`fetch()`** — both `http://` and `https://` targets
- **`XMLHttpRequest`** — all requests
- **`WebSocket` / `WebSocketStream`** — both `ws://` and `wss://` targets
- **HTTP module imports** — `import ... from 'https://example.com/mod.js'`

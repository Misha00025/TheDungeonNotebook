# Web proxy

`tdn-web-proxy` is a dedicated Nginx runtime image. Its `/docker-entrypoint.d/05-generate-web-config.sh` hook runs `generate.mjs` before the stock Nginx entrypoint starts the daemon; Node is used only by this startup generator, not as an HTTP server.

The generator reads the runtime environment and writes `/app/runtime/config.json` plus `/etc/nginx/conf.d/default.conf` from the adjacent `nginx.conf.template`. The exact `config.json` route serves the generated browser config with `Cache-Control: no-store`. Remote routes strip their public prefixes and proxy to configured internal origins; Hub requests strip `WEB_BASE_PATH`, while HTML `<base>` is replaced with the runtime prefix. Nginx resolves upstream names on requests using `WEB_DNS_RESOLVER`, so unavailable remote containers do not prevent startup. Missing remote responses are not replaced with a Hub SPA fallback.

Runtime variable defaults and user-facing operation are documented in [apps/web README](../README.md). The image is built as part of `make build-web` or individually with `make build-web-proxy`.

Generator unit tests can be run without starting Nginx or HTTP services:

```sh
node --test apps/web/proxy/generate.test.mjs
```

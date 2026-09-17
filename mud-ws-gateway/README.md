# mud-gateway

A small Python service that bridges [aiohttp](https://docs.aiohttp.dev/)
WebSocket connections to a raw TCP MUD server. One TCP socket per WS
client. No fan-out, no fan-in, no multiplexing, no shared state, no auth.

## What

A pure relay. Takes whatever bytes come in from the WebSocket and writes
them to the upstream TCP socket. Takes whatever bytes come in from the
upstream TCP socket and sends them back as WebSocket frames. Nothing
else.

## Why

Browsers can't open raw TCP sockets. The MUD server speaks raw TCP.
This gateway exists so the browser doesn't have to care about line
protocols, framing, or any of the MUD-internal stuff — it just opens a
WebSocket and gets bytes.

## Run locally

```bash
# from mud-ws-gateway/
uv sync
uv run mud-gateway
```

Defaults to listening on `0.0.0.0:8443`, dialing `127.0.0.1:27015`.

## Run in Docker

```bash
docker build -t mud-gateway .
docker run --rm -p 8443:8443 \
  -e MUD_HOST=modularmudserver \
  -e MUD_PORT=27015 \
  mud-gateway
```

## Run in compose

```yaml
services:
  modularmudserver:
    image: ghcr.io/you/modularmudserver:latest
    # ...

  mud-gateway:
    image: mud-gateway
    depends_on:
      - modularmudserver
    ports:
      - "8443:8443"
    environment:
      MUD_HOST: modularmudserver
      MUD_PORT: 27015
      WS_HOST: 0.0.0.0
      WS_PORT: 8443
      LOG_LEVEL: info
      IDLE_TIMEOUT_S: "1800"
    restart: unless-stopped
```

## Environment variables

- `MUD_HOST` — hostname of the MUD server (default `127.0.0.1`, works out-of-the-box for local testing; override to your MUD service alias in Docker Compose, e.g. `modularmudserver`)
- `MUD_PORT` — TCP port of the MUD server (default `27015`)
- `WS_HOST` — bind host for the WebSocket server (default `0.0.0.0`)
- `WS_PORT` — bind port for the WebSocket server (default `8443`)
- `LOG_LEVEL` — `debug`, `info`, `warning`, or `error` (default `info`)
- `IDLE_TIMEOUT_S` — idle timeout in seconds (default `1800`). Closes the TCP+WS connection after this many seconds of silence in either direction.

## Routes

- `GET /health` — `200 {"status":"ok"}` once startup has completed, `503 {"status":"starting"}` before that.
- `GET /ws` — WebSocket upgrade. Each connection opens a fresh TCP connection to the MUD server.

## Healthcheck

```bash
curl -fsS http://localhost:8443/health
# {"status":"ok"}
```

The container's `HEALTHCHECK` hits this endpoint every 30s.

## Tests

```bash
uv run pytest
```

The test suite spins up an in-memory TCP echo server on `127.0.0.1:0`
and exercises the real relay path through `aiohttp.test_utils.TestClient`
— no mocking of the bridge itself.

## Limitations

- **Raw TCP only.** The bridge does not interpret content. Whatever the
  MUD server expects (line-terminated commands, ANSI escapes, etc.) is
  the client's responsibility.
- **No TLS.** The service listens on plain HTTP/WS. Assume Caddy (or
  similar) terminates in front.
- **No auth.** Tailscale-private network. Adding authentication is the
  wrong scope for this iteration.
- **Image size ≈ 110–130 MB.** The `python:3.12-slim` base plus aiohttp
  exceed the aspirational 100 MB target. Switching to `python:3.12-alpine`
  is possible but aiohttp on musl has historical edge cases; not done
  here.

"""aiohttp application factory and route handlers."""

from __future__ import annotations

import asyncio
import logging
import time
from itertools import count

from aiohttp import web

from .bridge import relay
from .config import Config

LOG = logging.getLogger("mud_gateway.app")


_CONN_COUNTER = count()

CONFIG_KEY: web.AppKey[Config] = web.AppKey("config", Config)
BOOTED_KEY: web.AppKey[asyncio.Event] = web.AppKey("booted", asyncio.Event)


def make_app(config: Config) -> web.Application:
    app = web.Application()

    app[CONFIG_KEY] = config
    app[BOOTED_KEY] = asyncio.Event()

    app.on_startup.append(_on_startup)
    app.on_cleanup.append(_on_cleanup)

    app.router.add_get("/health", _health)
    app.router.add_get("/ws", _ws_handler)

    return app


async def _on_startup(app: web.Application) -> None:
    app[BOOTED_KEY].set()
    config = app[CONFIG_KEY]
    LOG.info(
        "mud-gateway ready",
        extra={
            "ws_host": config.ws_host,
            "ws_port": config.ws_port,
            "mud_host": config.mud_host,
            "mud_port": config.mud_port,
        },
    )


async def _on_cleanup(app: web.Application) -> None:
    LOG.info("mud-gateway shutting down")


async def _health(request: web.Request) -> web.Response:
    booted = request.app[BOOTED_KEY]
    if not booted.is_set():
        return web.json_response({"status": "starting"}, status=503)
    return web.json_response({"status": "ok"})


async def _ws_handler(request: web.Request) -> web.WebSocketResponse:
    config = request.app[CONFIG_KEY]

    ws = web.WebSocketResponse(heartbeat=None)
    await ws.prepare(request)

    conn_id = f"c{next(_CONN_COUNTER):04d}"
    client_ip = request.remote or "unknown"
    started = time.monotonic()

    LOG.info(
        "ws connected",
        extra={
            "conn_id": conn_id,
            "client_ip": client_ip,
            "target": f"{config.mud_host}:{config.mud_port}",
        },
    )

    bytes_in = 0
    bytes_out = 0
    fault: str | None = None
    try:
        reader, writer = await asyncio.open_connection(config.mud_host, config.mud_port)
    except OSError as exc:
        fault = f"tcp connect failed: {exc}"
        LOG.error("[%s] %s", conn_id, fault)
        await ws.close(code=1011, message=fault.encode("utf-8")[:120])
    else:
        try:
            bytes_in, bytes_out = await relay(
                ws,
                reader,
                writer,
                conn_id=conn_id,
                idle_timeout=config.idle_timeout_seconds,
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            fault = f"{type(exc).__name__}: {exc}"
            LOG.exception("[%s] handler error", conn_id)

    duration = time.monotonic() - started
    LOG.info(
        "ws disconnected",
        extra={
            "conn_id": conn_id,
            "client_ip": client_ip,
            "target": f"{config.mud_host}:{config.mud_port}",
            "duration_s": round(duration, 3),
            "bytes_in": bytes_in,
            "bytes_out": bytes_out,
            "fault": fault or "",
        },
    )

    if not ws.closed:
        await ws.close()
    return ws


__all__ = ["make_app"]

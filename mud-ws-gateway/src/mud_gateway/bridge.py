"""Telnet/GMCP-aware WebSocket <-> TCP bridge.

Each browser connection opens a TCP socket to the C++ server and runs a
GMCPSession that translates in both directions:

  Browser  --JSON envelopes-->  Gateway  --telnet bytes-->  C++ server
  Browser  <--JSON envelopes--  Gateway  <--telnet bytes--  C++ server

Plain text in both directions still round-trips correctly — the only difference
from the previous raw-byte relay is that the gateway now understands telnet
framing and produces structured envelopes instead of literal IAC bytes on the
WebSocket side.
"""

from __future__ import annotations

import asyncio
import json
import logging
from asyncio import IncompleteReadError, StreamReader, StreamWriter, Task

from aiohttp import WSCloseCode, WSMsgType
from aiohttp.web import WebSocketResponse

from .gmcp import error_envelope, parse_browser_envelope, text_envelope
from .session import GMCPSession

LOG = logging.getLogger("mud_gateway.bridge")


async def _ws_to_tcp(
    ws: WebSocketResponse,
    writer: StreamWriter,
    session: GMCPSession,
    *,
    conn_id: str,
    idle_timeout: float,
) -> int:
    bytes_in = 0
    while True:
        if idle_timeout > 0:
            msg = await asyncio.wait_for(ws.receive(), timeout=idle_timeout)
        else:
            msg = await ws.receive()
        t = msg.type
        if t is WSMsgType.CLOSE:
            LOG.debug("[%s] ws->tcp: close frame", conn_id)
            return bytes_in
        if t is WSMsgType.ERROR:
            LOG.warning("[%s] ws->tcp: error frame", conn_id)
            return bytes_in

        raw_text: str | None = None
        raw_bytes: bytes | None = None
        if t is WSMsgType.TEXT:
            raw_text = msg.data if isinstance(msg.data, str) else msg.data.decode("utf-8")
        elif t is WSMsgType.BINARY:
            raw_bytes = msg.data
        else:
            continue

        try:
            if raw_text is not None:
                envelope = parse_browser_envelope(raw_text)
                if envelope is None:
                    out = raw_text.encode("utf-8")
                else:
                    out = session.feed_from_browser(envelope)
            else:
                out = raw_bytes or b""
        except Exception:
            LOG.exception("[%s] ws->tcp: failed to encode envelope", conn_id)
            await ws.send_str(error_envelope("gateway encode failure"))
            continue

        if not out:
            continue

        writer.write(out)
        await writer.drain()
        bytes_in += len(out)
    return bytes_in


async def _tcp_to_ws(
    reader: StreamReader,
    ws: WebSocketResponse,
    session: GMCPSession,
    *,
    conn_id: str,
    idle_timeout: float,
) -> int:
    bytes_out = 0
    while True:
        if idle_timeout > 0:
            data = await asyncio.wait_for(reader.read(4096), timeout=idle_timeout)
        else:
            data = await reader.read(4096)
        if not data:
            LOG.debug("[%s] tcp->ws: EOF", conn_id)
            return bytes_out
        if ws.closed:
            return bytes_out

        envelopes = session.feed_from_server(data)
        for envelope in envelopes:
            if ws.closed:
                return bytes_out
            try:
                await ws.send_str(envelope)
                bytes_out += len(envelope.encode("utf-8"))
            except (ConnectionError, RuntimeError):
                LOG.warning("[%s] tcp->ws: send failed", conn_id)
                return bytes_out
    return bytes_out


async def relay(
    ws: WebSocketResponse,
    tcp_reader: StreamReader,
    tcp_writer: StreamWriter,
    *,
    conn_id: str,
    idle_timeout: float,
) -> tuple[int, int]:
    """Run bidirectional relay. Returns (bytes_in, bytes_out)."""
    session = GMCPSession(conn_id=conn_id)

    for greeting in session.server_greeting():
        tcp_writer.write(greeting)
    await tcp_writer.drain()
    LOG.info("[%s] gateway opened; sent GMCP greeting", conn_id)

    up_task: Task[int] = asyncio.create_task(
        _ws_to_tcp(ws, tcp_writer, session, conn_id=conn_id, idle_timeout=idle_timeout),
        name=f"{conn_id}-ws-to-tcp",
    )
    down_task: Task[int] = asyncio.create_task(
        _tcp_to_ws(tcp_reader, ws, session, conn_id=conn_id, idle_timeout=idle_timeout),
        name=f"{conn_id}-tcp-to-ws",
    )

    done, pending = await asyncio.wait(
        {up_task, down_task},
        return_when=asyncio.FIRST_COMPLETED,
    )

    bytes_in = 0
    bytes_out = 0
    fault: BaseException | None = None
    for t in done:
        try:
            value = t.result()
        except asyncio.CancelledError:
            raise
        except TimeoutError as exc:
            LOG.info("[%s] idle timeout", conn_id)
            fault = exc
            continue
        except (ConnectionError, IncompleteReadError) as exc:
            LOG.info("[%s] relay ended: %s", conn_id, exc)
            fault = exc
            continue
        except Exception as exc:
            LOG.exception("[%s] relay task %s failed", conn_id, t.get_name())
            fault = exc
            continue
        if t is up_task:
            bytes_in = value
        elif t is down_task:
            bytes_out = value

    for t in pending:
        t.cancel()
    for t in pending:
        try:
            await t
        except (asyncio.CancelledError, ConnectionError, TimeoutError):
            pass

    if not ws.closed and fault is not None:
        try:
            await ws.close(code=WSCloseCode.GOING_AWAY, message=b"upstream error")
        except (ConnectionError, TimeoutError):
            pass

    if not tcp_writer.is_closing():
        tcp_writer.close()

    return bytes_in, bytes_out

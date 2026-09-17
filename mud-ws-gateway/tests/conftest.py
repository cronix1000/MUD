"""Test fixtures: a TCP echo server bound to 127.0.0.1:0."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass

import pytest


@dataclass(frozen=True)
class EchoServer:
    host: str
    port: int
    server: asyncio.base_events.Server

    async def close(self) -> None:
        self.server.close()
        await self.server.wait_closed()


async def _handle_echo(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
) -> None:
    try:
        while True:
            data = await reader.read(4096)
            if not data:
                return
            writer.write(data)
            await writer.drain()
    except (ConnectionError, asyncio.IncompleteReadError):
        return
    finally:
        writer.close()


async def start_echo_server() -> EchoServer:
    server = await asyncio.start_server(_handle_echo, "127.0.0.1", 0)
    sock = server.sockets[0]
    host, port = sock.getsockname()[:2]
    return EchoServer(host=host, port=port, server=server)


@pytest.fixture
async def echo_server() -> AsyncIterator[EchoServer]:
    srv = await start_echo_server()
    try:
        yield srv
    finally:
        await srv.close()

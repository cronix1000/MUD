"""End-to-end tests for the WS <-> TCP bridge with telnet/GMCP translation."""

from __future__ import annotations

import json

import pytest
from aiohttp import WSCloseCode, WSMsgType
from aiohttp.test_utils import TestClient, TestServer

from mud_gateway.app import make_app
from mud_gateway.config import Config


def _config_for(mud_host: str, mud_port: int) -> Config:
    return Config(
        mud_host=mud_host,
        mud_port=mud_port,
        ws_host="127.0.0.1",
        ws_port=0,
        log_level=30,
        idle_timeout_seconds=0,
    )


async def _make_client(config: Config) -> TestClient:
    client = TestClient(TestServer(make_app(config)))
    await client.start_server()
    return client


async def test_text_round_trip(echo_server) -> None:
    """Plain text from the browser is shipped as text; plain text from the
    server is wrapped in a text envelope."""
    config = _config_for(echo_server.host, echo_server.port)
    client = await _make_client(config)
    try:
        async with client.ws_connect("/ws") as ws:
            await ws.send_str("hello\n")
            for _ in range(20):
                msg = await ws.receive(timeout=2)
                if msg.type is WSMsgType.TEXT:
                    env = json.loads(msg.data)
                    if env["channel"] == "text":
                        assert env["data"] == "hello"
                        return
            pytest.fail("expected a text envelope echoing hello")
    finally:
        await client.close()


async def test_gmcp_negotiation_emitted(echo_server) -> None:
    """The gateway offers GMCP to the server; once negotiated, the browser
    receives a negotiate envelope."""
    config = _config_for(echo_server.host, echo_server.port)
    client = await _make_client(config)
    try:
        async with client.ws_connect("/ws") as ws:
            seen_negotiate = False
            for _ in range(10):
                msg = await ws.receive(timeout=2)
                if msg.type is WSMsgType.TEXT:
                    env = json.loads(msg.data)
                    if env.get("channel") == "negotiate":
                        assert env["option"] == "gmcp"
                        assert env["state"] == "ready"
                        seen_negotiate = True
                        break
            assert seen_negotiate, "expected at least one negotiate envelope"
    finally:
        await client.close()


async def test_browser_sends_gmcp_subscription(echo_server) -> None:
    """Browser -> server GMCP packets round-trip as parsed GMCP envelopes."""
    config = _config_for(echo_server.host, echo_server.port)
    client = await _make_client(config)
    try:
        async with client.ws_connect("/ws") as ws:
            await ws.send_str(
                json.dumps(
                    {
                        "channel": "gmcp",
                        "module": "Client.Subscriptions.List",
                        "data": ["Char.Vitals", "Room.Info"],
                    }
                )
            )
            for _ in range(30):
                msg = await ws.receive(timeout=2)
                if msg.type is WSMsgType.TEXT:
                    env = json.loads(msg.data)
                    if (
                        env.get("channel") == "gmcp"
                        and env.get("module") == "Client.Subscriptions.List"
                    ):
                        assert isinstance(env["data"], list)
                        assert "Char.Vitals" in env["data"]
                        assert "Room.Info" in env["data"]
                        return
            pytest.fail("expected a gmcp envelope with Client.Subscriptions.List")
    finally:
        await client.close()


async def test_ws_close_propagates(echo_server) -> None:
    config = _config_for(echo_server.host, echo_server.port)
    client = await _make_client(config)
    try:
        async with client.ws_connect("/ws") as ws:
            await ws.send_str("ping\n")
            await ws.receive(timeout=2)
            await ws.close(code=WSCloseCode.GOING_AWAY)
    finally:
        await client.close()


async def test_health(echo_server) -> None:
    config = _config_for(echo_server.host, echo_server.port)
    client = await _make_client(config)
    try:
        resp = await client.get("/health")
        assert resp.status == 200
        body = await resp.json()
        assert body == {"status": "ok"}
    finally:
        await client.close()


async def test_gmcp_negotiation_emitted(echo_server) -> None:
    """The gateway offers GMCP to the server; once negotiated, the browser
    receives a negotiate envelope."""
    config = _config_for(echo_server.host, echo_server.port)
    client = await _make_client(config)
    try:
        async with client.ws_connect("/ws") as ws:
            seen_negotiate = False
            for _ in range(10):
                msg = await ws.receive(timeout=2)
                if msg.type is WSMsgType.TEXT:
                    env = json.loads(msg.data)
                    if env.get("channel") == "negotiate":
                        assert env["option"] == "gmcp"
                        assert env["state"] == "ready"
                        seen_negotiate = True
                        break
            assert seen_negotiate, "expected at least one negotiate envelope"
    finally:
        await client.close()


async def test_browser_sends_gmcp_subscription(echo_server) -> None:
    """Browser -> server GMCP packets round-trip as parsed GMCP envelopes."""
    config = _config_for(echo_server.host, echo_server.port)
    client = await _make_client(config)
    try:
        async with client.ws_connect("/ws") as ws:
            await ws.send_str(
                json.dumps(
                    {
                        "channel": "gmcp",
                        "module": "Client.Subscriptions.List",
                        "data": ["Char.Vitals", "Room.Info"],
                    }
                )
            )
            for _ in range(30):
                msg = await ws.receive(timeout=2)
                if msg.type is WSMsgType.TEXT:
                    env = json.loads(msg.data)
                    if (
                        env.get("channel") == "gmcp"
                        and env.get("module") == "Client.Subscriptions.List"
                    ):
                        assert isinstance(env["data"], list)
                        assert "Char.Vitals" in env["data"]
                        assert "Room.Info" in env["data"]
                        return
            pytest.fail("expected a gmcp envelope with Client.Subscriptions.List")
    finally:
        await client.close()


async def test_ws_close_propagates(echo_server) -> None:
    config = _config_for(echo_server.host, echo_server.port)
    client = await _make_client(config)
    try:
        async with client.ws_connect("/ws") as ws:
            await ws.send_str("ping\n")
            await ws.receive(timeout=2)
            await ws.close(code=WSCloseCode.GOING_AWAY)
    finally:
        await client.close()


async def test_health(echo_server) -> None:
    config = _config_for(echo_server.host, echo_server.port)
    client = await _make_client(config)
    try:
        resp = await client.get("/health")
        assert resp.status == 200
        body = await resp.json()
        assert body == {"status": "ok"}
    finally:
        await client.close()

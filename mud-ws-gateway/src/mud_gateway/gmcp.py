"""WebSocket-side GMCP envelope helpers.

The browser client speaks JSON only. The bridge speaks real telnet + GMCP to
the C++ server. These helpers shape/parse the JSON envelopes exchanged with the
browser.

Envelope shape (server -> browser):
  {"channel": "text", "data": "<colored terminal text>"}
  {"channel": "gmcp", "module": "Char.Vitals", "data": {...}, "text": "..."}
  {"channel": "negotiate", "option": "gmcp", "state": "ready"}
  {"channel": "error", "message": "..."}

Envelope shape (browser -> server):
  {"channel": "text", "data": "look\\n"}
  {"channel": "gmcp", "module": "Client.Subscriptions.List", "data": [...]}
"""

from __future__ import annotations

import json
from typing import Any


SUPPORTED_MODULES = {
    "Core.Hello",
    "Core.Supports.Set",
    "Core.Goodbye",
    "Client.Subscriptions.List",
    "Char.Login",
    "Char.Name",
    "Char.Vitals",
    "Char.Status",
    "Char.MaxStats",
    "Char.Affects",
    "Room.Info",
    "Room.Map",
    "Room.Exits",
    "Room.WrongDir",
    "Comm.Channel.Text",
    "Comm.Channel.Start",
    "Comm.Channel.End",
    "Inventory.Items",
    "Inventory.Item.Add",
    "Inventory.Item.Remove",
    "Command.List",
}


def text_envelope(data: str) -> str:
    return json.dumps({"channel": "text", "data": data}, separators=(",", ":"))


def gmcp_envelope(module: str, data: Any, text: str | None = None) -> str:
    payload: dict[str, Any] = {"channel": "gmcp", "module": module, "data": data}
    if text:
        payload["text"] = text
    return json.dumps(payload, separators=(",", ":"))


def negotiate_envelope(option: str, state: str) -> str:
    return json.dumps(
        {"channel": "negotiate", "option": option, "state": state},
        separators=(",", ":"),
    )


def error_envelope(message: str) -> str:
    return json.dumps({"channel": "error", "message": message}, separators=(",", ":"))


def serialize_outbound_gmcp(module: str, data: Any) -> str:
    """Encode an outbound browser->server GMCP envelope as JSON line."""
    return json.dumps({"channel": "gmcp", "module": module, "data": data}, separators=(",", ":"))


def parse_browser_envelope(raw: str) -> dict[str, Any] | None:
    """Parse a JSON envelope from the browser. Returns None on bad JSON."""
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(obj, dict):
        return None
    return obj

"""Per-connection telnet/GMCP session state.

Owns:
  - one telnet Decoder (server->browser direction)
  - one byte-buffer of "pure text" bytes awaiting newlines

Routes parsed server output to the WebSocket as JSON envelopes, and routes
parsed browser JSON envelopes back to the server as telnet/GMCP bytes.

Subscription filtering is intentionally NOT done here — that's the server's
job (per ClientComponent.subscribedModules). The gateway is a translator, not
a filter.
"""

from __future__ import annotations

import json
import logging

from . import gmcp as gmcp_envelopes
from .telnet import (
    DO,
    GMCP,
    IAC,
    WILL,
    Decoder,
    build_gmcp_subneg,
    build_negotiation,
    parse_gmcp_payload,
)

LOG = logging.getLogger("mud_gateway.session")


class GMCPSession:
    """Stateful translator for one WebSocket <-> TCP connection pair."""

    def __init__(self, conn_id: str = "?") -> None:
        self._decoder = Decoder()
        self._text_buf = bytearray()
        self._gmcp_ready: bool = False
        self._conn_id = conn_id

    @property
    def gmcp_ready(self) -> bool:
        return self._gmcp_ready

    def server_greeting(self) -> list[bytes]:
        """Bytes to write to the server immediately after the TCP socket opens."""
        greeting = [
            build_negotiation(WILL, GMCP),
            build_negotiation(DO, GMCP),
        ]
        LOG.debug("[%s] server_greeting: %d bytes", self._conn_id, sum(len(b) for b in greeting))
        return greeting

    def feed_from_server(self, chunk: bytes) -> list[str]:
        """Consume raw bytes from the server; return JSON envelopes to ship."""
        envelopes: list[str] = []
        for ev in self._decoder.feed(chunk):
            if ev.kind.value == "text_byte":
                self._text_buf.append(ev.data[0])
            elif ev.kind.value == "negotiation":
                LOG.info(
                    "[%s] <- server negotiation: option=%d, cmd=%d",
                    self._conn_id,
                    ev.option,
                    ev.data[0] if ev.data else -1,
                )
                if ev.option == GMCP:
                    self._gmcp_ready = True
                    envelopes.append(gmcp_envelopes.negotiate_envelope("gmcp", "ready"))
                    LOG.info("[%s] GMCP negotiation complete (server side)", self._conn_id)
            elif ev.kind.value == "subneg_start":
                LOG.debug("[%s] <- server subneg start: option=%d", self._conn_id, ev.option)
            elif ev.kind.value == "subneg_data":
                pass
            elif ev.kind.value == "subneg_end":
                if ev.option != GMCP:
                    LOG.debug(
                        "[%s] <- server subneg end: option=%d (non-GMCP, dropped)",
                        self._conn_id,
                        ev.option,
                    )
                    continue
                parsed = parse_gmcp_payload(ev.data)
                if parsed is None:
                    LOG.warning("[%s] malformed GMCP payload: %r", self._conn_id, ev.data)
                    envelopes.append(gmcp_envelopes.error_envelope("malformed GMCP payload"))
                    continue
                module, json_text = parsed
                try:
                    data = json.loads(json_text)
                except json.JSONDecodeError as exc:
                    LOG.warning(
                        "[%s] invalid JSON in GMCP module %s: %s", self._conn_id, module, exc
                    )
                    envelopes.append(
                        gmcp_envelopes.error_envelope(f"invalid JSON in GMCP module {module}")
                    )
                    continue
                LOG.info(
                    "[%s] <- server GMCP: module=%s data_keys=%s",
                    self._conn_id,
                    module,
                    list(data.keys()) if isinstance(data, dict) else type(data).__name__,
                )
                envelopes.append(gmcp_envelopes.gmcp_envelope(module, data))

        text_envelopes = self._drain_text_lines()
        if text_envelopes:
            LOG.debug("[%s] <- server text: %d line(s)", self._conn_id, len(text_envelopes))
            for env in text_envelopes:
                try:
                    obj = json.loads(env)
                    raw = obj.get("data", "")
                except Exception:
                    raw = env
                byte_dump = " ".join(f"{ord(c):02x}" for c in raw[:80])
                preview = raw[:80].replace("\n", "\\n").replace("\r", "\\r")
                LOG.debug("[%s]   text bytes=[%s] text=%r", self._conn_id, byte_dump, preview)
        envelopes.extend(text_envelopes)
        return envelopes

    def _drain_text_lines(self) -> list[str]:
        envelopes: list[str] = []
        while True:
            idx = self._text_buf.find(b"\n")
            if idx < 0:
                break
            line = bytes(self._text_buf[: idx + 1])
            raw_hex = " ".join(f"{b:02x}" for b in line[:80])
            LOG.debug("[%s]   raw_buf bytes=[%s]", self._conn_id, raw_hex)
            del self._text_buf[: idx + 1]
            if line.endswith(b"\r\n"):
                pass
            elif line.endswith(b"\n"):
                line = line[:-1]
            envelopes.append(gmcp_envelopes.text_envelope(line.decode("utf-8", errors="replace")))
        return envelopes

    def feed_from_browser(self, envelope: dict) -> bytes:
        """Convert one browser JSON envelope into bytes for the server."""
        channel = envelope.get("channel")

        if channel == "text":
            data = envelope.get("data", "")
            if not isinstance(data, str):
                return b""
            LOG.debug("[%s] -> server text: %r", self._conn_id, data[:80])
            return data.encode("utf-8")

        if channel == "gmcp":
            module = envelope.get("module", "")
            data = envelope.get("data", None)
            if not isinstance(module, str) or not module:
                LOG.warning("[%s] -> server GMCP: missing module", self._conn_id)
                return b""
            try:
                payload = json.dumps(data, separators=(",", ":"))
            except (TypeError, ValueError) as exc:
                LOG.warning(
                    "[%s] -> server GMCP: bad data for module=%s: %s", self._conn_id, module, exc
                )
                return b""
            LOG.info(
                "[%s] -> server GMCP: module=%s payload=%s", self._conn_id, module, payload[:120]
            )
            return build_gmcp_subneg(module, payload)

        LOG.warning("[%s] -> server: unknown channel=%r", self._conn_id, channel)
        return b""

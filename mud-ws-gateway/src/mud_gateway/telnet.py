"""Telnet + GMCP decoder/encoder.

Pure-data implementation that mirrors the C++ TelnetCodec. State is held per
instance; one Decoder per WebSocket connection.

Reference: RFC 854 (telnet), Aardwolf/IRE GMCP module catalog.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field
from enum import Enum


IAC = 255
DONT = 254
DO = 253
WONT = 252
WILL = 251
SB = 250
SE = 240
GMCP = 201


class EventKind(str, Enum):
    TEXT_BYTE = "text_byte"
    NEGOTIATION = "negotiation"
    SUBNEG_START = "subneg_start"
    SUBNEG_DATA = "subneg_data"
    SUBNEG_END = "subneg_end"


@dataclass
class Decoded:
    kind: EventKind
    option: int = 0
    data: bytes = b""
    text_byte_escaped: bool = False


class _State(str, Enum):
    NORMAL = "normal"
    GOT_IAC = "got_iac"
    GOT_IAC_CMD = "got_iac_cmd"
    GOT_SUBNEG_OPT = "got_subneg_opt"
    IN_SUBNEG = "in_subneg"
    IN_SUBNEG_GOT_IAC = "in_subneg_got_iac"


class Decoder:
    """Stream-oriented telnet byte decoder.

    Maintains state across calls to feed() so partial sequences spanning
    multiple recv() calls are handled correctly.
    """

    def __init__(self) -> None:
        self._state: _State = _State.NORMAL
        self._pending_cmd: int = 0
        self._pending_opt: int = 0
        self._subneg_buf: bytearray = bytearray()

    def feed(self, data: bytes) -> list[Decoded]:
        out: list[Decoded] = []
        if not data:
            return out

        for byte in data:
            if self._state is _State.NORMAL:
                if byte == IAC:
                    self._state = _State.GOT_IAC
                else:
                    out.append(Decoded(kind=EventKind.TEXT_BYTE, data=bytes([byte])))
            elif self._state is _State.GOT_IAC:
                if byte == IAC:
                    out.append(
                        Decoded(
                            kind=EventKind.TEXT_BYTE,
                            data=bytes([IAC]),
                            text_byte_escaped=True,
                        )
                    )
                    self._state = _State.NORMAL
                elif byte in (WILL, WONT, DO, DONT):
                    self._pending_cmd = byte
                    self._state = _State.GOT_IAC_CMD
                elif byte == SB:
                    self._subneg_buf = bytearray()
                    self._state = _State.GOT_SUBNEG_OPT
                else:
                    self._state = _State.NORMAL
            elif self._state is _State.GOT_IAC_CMD:
                out.append(
                    Decoded(
                        kind=EventKind.NEGOTIATION,
                        option=byte,
                        data=bytes([self._pending_cmd]),
                    )
                )
                self._state = _State.NORMAL
            elif self._state is _State.GOT_SUBNEG_OPT:
                self._pending_opt = byte
                out.append(Decoded(kind=EventKind.SUBNEG_START, option=byte))
                self._state = _State.IN_SUBNEG
            elif self._state is _State.IN_SUBNEG:
                if byte == IAC:
                    self._state = _State.IN_SUBNEG_GOT_IAC
                else:
                    self._subneg_buf.append(byte)
            elif self._state is _State.IN_SUBNEG_GOT_IAC:
                if byte == IAC:
                    self._subneg_buf.append(IAC)
                    self._state = _State.IN_SUBNEG
                elif byte == SE:
                    out.append(
                        Decoded(
                            kind=EventKind.SUBNEG_END,
                            option=self._pending_opt,
                            data=bytes(self._subneg_buf),
                        )
                    )
                    self._subneg_buf = bytearray()
                    self._state = _State.NORMAL
                else:
                    self._subneg_buf.append(IAC)
                    self._subneg_buf.append(byte)
                    self._state = _State.IN_SUBNEG

        return out

    def text_bytes(self, data: bytes) -> Iterator[Decoded]:
        return iter(self.feed(data))


def escape_text(text: bytes) -> bytes:
    """Escape literal 0xFF bytes inside ordinary text as 0xFF 0xFF."""
    out = bytearray()
    out.extend(text)
    i = 0
    while i < len(out):
        if out[i] == IAC:
            out.insert(i + 1, IAC)
            i += 2
        else:
            i += 1
    return bytes(out)


def build_negotiation(cmd: int, opt: int) -> bytes:
    """Build `IAC <cmd> <opt>`."""
    return bytes([IAC, cmd, opt])


def build_gmcp_subneg(module: str, json_payload: str) -> bytes:
    """Build `IAC SB GMCP "<module>" <json> IAC SE`."""
    return (
        bytes([IAC, SB, GMCP])
        + b'"'
        + module.encode("utf-8")
        + b'" '
        + json_payload.encode("utf-8")
        + bytes([IAC, SE])
    )


def parse_gmcp_payload(payload: bytes) -> tuple[str, str] | None:
    """Split a GMCP subneg payload into (module, json). Returns None on malformed."""
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError:
        return None
    if not text.startswith('"'):
        return None
    end_quote = text.find('"', 1)
    if end_quote < 0:
        return None
    module = text[1:end_quote]
    if end_quote + 1 >= len(text) or text[end_quote + 1] != " ":
        return None
    json_text = text[end_quote + 2 :]
    return module, json_text

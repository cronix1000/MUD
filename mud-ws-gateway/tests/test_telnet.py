"""Unit tests for the telnet/GMCP codec."""

from __future__ import annotations

from mud_gateway.telnet import (
    DO,
    GMCP,
    IAC,
    SE,
    SB,
    WILL,
    Decoder,
    EventKind,
    build_gmcp_subneg,
    build_negotiation,
    escape_text,
    parse_gmcp_payload,
)


def test_plain_text():
    dec = Decoder()
    events = dec.feed(b"look\r\n")
    assert len(events) == 6
    for ev in events:
        assert ev.kind is EventKind.TEXT_BYTE


def test_iac_iac_is_literal_0xff():
    dec = Decoder()
    events = dec.feed(bytes([IAC, IAC]))
    assert len(events) == 1
    assert events[0].kind is EventKind.TEXT_BYTE
    assert events[0].data == bytes([IAC])
    assert events[0].text_byte_escaped is True


def test_negotiation_will_gmcp():
    dec = Decoder()
    events = dec.feed(bytes([IAC, WILL, GMCP]))
    assert len(events) == 1
    assert events[0].kind is EventKind.NEGOTIATION
    assert events[0].option == GMCP
    assert events[0].data == bytes([WILL])


def test_negotiation_do_echo():
    dec = Decoder()
    events = dec.feed(bytes([IAC, DO, 1]))
    assert events[0].option == 1
    assert events[0].data == bytes([DO])


def test_gmcp_subneg_round_trip():
    payload = b'"Char.Vitals" {"hp":42}'
    dec = Decoder()
    events = dec.feed(bytes([IAC, SB, GMCP]) + payload + bytes([IAC, SE]))
    kinds = [ev.kind for ev in events]
    assert EventKind.SUBNEG_START in kinds
    assert EventKind.SUBNEG_END in kinds
    end = next(ev for ev in events if ev.kind is EventKind.SUBNEG_END)
    assert end.option == GMCP
    assert end.data == payload


def test_subneg_split_across_feeds():
    dec = Decoder()
    e1 = dec.feed(bytes([IAC, SB, GMCP, b'"'[0], b"M"[0]]))
    e2 = dec.feed(b'" {}')
    e3 = dec.feed(bytes([IAC, SE]))
    assert not any(ev.kind is EventKind.SUBNEG_END for ev in e1)
    assert not any(ev.kind is EventKind.SUBNEG_END for ev in e2)
    end = next(ev for ev in e3 if ev.kind is EventKind.SUBNEG_END)
    assert end.data == b'"M" {}'


def test_iac_iac_inside_subneg_preserves_byte():
    dec = Decoder()
    payload = bytes([IAC, SB, GMCP]) + b"foo" + bytes([IAC, IAC]) + b"bar" + bytes([IAC, SE])
    events = dec.feed(payload)
    end = next(ev for ev in events if ev.kind is EventKind.SUBNEG_END)
    assert end.data == b"foo" + bytes([IAC]) + b"bar"


def test_orphan_iac_se_dropped():
    dec = Decoder()
    events = dec.feed(bytes([IAC, SE]) + b"hi")
    assert all(ev.kind is EventKind.TEXT_BYTE for ev in events)
    assert b"".join(ev.data for ev in events) == b"hi"


def test_escape_text_doubles_0xff():
    assert escape_text(b"hello\xffworld") == b"hello\xff\xffworld"
    assert escape_text(b"no special bytes") == b"no special bytes"


def test_build_negotiation():
    s = build_negotiation(WILL, GMCP)
    assert s == bytes([IAC, WILL, GMCP])


def test_build_gmcp_subneg():
    s = build_gmcp_subneg("Room.Info", '{"num":3}')
    assert s.startswith(bytes([IAC, SB, GMCP]))
    assert s.endswith(bytes([IAC, SE]))
    assert b'"Room.Info" {"num":3}' in s


def test_parse_gmcp_payload():
    parsed = parse_gmcp_payload(b'"Char.Vitals" {"hp":42}')
    assert parsed == ("Char.Vitals", '{"hp":42}')


def test_parse_gmcp_payload_malformed():
    assert parse_gmcp_payload(b"no quotes here") is None
    assert parse_gmcp_payload(b'"unterminated {x}') is None
    assert parse_gmcp_payload(b'"mod"') is None

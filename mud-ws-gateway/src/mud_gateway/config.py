"""Environment-driven configuration for the mud-gateway service."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

_LOG_LEVELS = {
    "debug": logging.DEBUG,
    "info": logging.INFO,
    "warning": logging.WARNING,
    "error": logging.ERROR,
}


@dataclass(frozen=True)
class Config:
    mud_host: str
    mud_port: int
    ws_host: str
    ws_port: int
    log_level: int
    idle_timeout_seconds: float


def _int_env(name: str, default: str) -> int:
    raw = os.environ.get(name, default)
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer, got {raw!r}") from exc


def _float_env(name: str, default: str) -> float:
    raw = os.environ.get(name, default)
    try:
        return float(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be a float, got {raw!r}") from exc


def _log_level_env(name: str, default: str) -> int:
    raw = os.environ.get(name, default).lower()
    if raw not in _LOG_LEVELS:
        raise ValueError(f"{name} must be one of {sorted(_LOG_LEVELS)}, got {raw!r}")
    return _LOG_LEVELS[raw]


def load_config() -> Config:
    return Config(
        mud_host=os.environ.get("MUD_HOST", "127.0.0.1"),
        mud_port=_int_env("MUD_PORT", "27015"),
        ws_host=os.environ.get("WS_HOST", "0.0.0.0"),
        ws_port=_int_env("WS_PORT", "8443"),
        log_level=_log_level_env("LOG_LEVEL", "info"),
        idle_timeout_seconds=_float_env("IDLE_TIMEOUT_S", "1800"),
    )

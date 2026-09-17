"""mud-gateway entry point: configure logging, build app, run it."""

from __future__ import annotations

import json
import logging
import sys

from aiohttp import web

from .app import make_app
from .config import load_config


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        standard_keys = {
            "name",
            "msg",
            "args",
            "levelname",
            "levelno",
            "pathname",
            "filename",
            "module",
            "exc_info",
            "exc_text",
            "stack_info",
            "lineno",
            "funcName",
            "created",
            "msecs",
            "relativeCreated",
            "thread",
            "threadName",
            "processName",
            "process",
            "message",
            "asctime",
            "taskName",
        }
        for key, value in record.__dict__.items():
            if key in standard_keys or key.startswith("_"):
                continue
            payload[key] = value
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def _configure_logging(level: int) -> None:
    handler = logging.StreamHandler(stream=sys.stderr)
    handler.setFormatter(_JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
    logging.getLogger("aiohttp.access").setLevel(logging.WARNING)


def main() -> None:
    config = load_config()
    _configure_logging(config.log_level)
    logging.getLogger("mud_gateway").info(
        "starting mud-gateway",
        extra={
            "ws_host": config.ws_host,
            "ws_port": config.ws_port,
            "mud_host": config.mud_host,
            "mud_port": config.mud_port,
        },
    )
    app = make_app(config)
    web.run_app(app, host=config.ws_host, port=config.ws_port, access_log=None)


if __name__ == "__main__":
    main()

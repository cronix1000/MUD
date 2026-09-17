# AGENTS.md - mud-ws-gateway (Python WebSocket Gateway)

FastAPI-based WebSocket proxy between browser clients (`MudClient`/`MudAdmin`) and the C++ server (`ModularMudServer`).

## Workspace Identity

- Package name: `mud-ws-gateway`.
- Workspace root: `mud-ws-gateway/`.
- Python tooling: `uv` (see `pyproject.toml`).

## Common Commands

| Task | Command |
|------|---------|
| Install (uv) | `uv sync` |
| Dev server | `npm --workspace mud-ws-gateway run dev` (or `uv run uvicorn src.main:app --reload`) |
| Build | `npm --workspace mud-ws-gateway run build` |
| Tests | `pytest` (inside `mud-ws-gateway/`) |

(From repo root, the shortcut is `npm run dev:gateway`.)

## Conventions

- Python 3.11+.
- FastAPI + `websockets` library.
- One router per concern under `src/`.
- Async everywhere — do not block the event loop.

## Cross-Server Notes

- The WebSocket protocol here is the **authoritative client-facing contract**. Changes here cascade to `MudClient/composables/` and `MudAdmin/`.
- The C++ server connection is via raw TCP sockets — see how `ModularMudServer/NetworkSystem.*` frames messages before changing anything here.
- See root `AGENTS.md` for project-wide rules.

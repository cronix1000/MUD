# Modular MUD — Monorepo

A multi-process MUD (Multi-User Dungeon) project.

## Components

| Path | Stack | Purpose |
|------|-------|---------|
| `ModularMudServer/` | C++17 (CMake / MSBuild / vcpkg) | Authoritative game server. ECS architecture, Lua scripting, SQLite persistence, hybrid Telnet + WebSocket networking. |
| `mud-ws-gateway/` | Python (uv / FastAPI / websockets) | WebSocket proxy between browser clients and the C++ server. |
| `MudClient/` | Nuxt 3 + xterm.js | Browser-based player client. |
| `MudAdmin/` | Nuxt 4 | Admin UI. |

## Quick Start

```bash
# 1. Install JS workspaces (client, admin, gateway)
npm install

# 2. Build and run the C++ server
#    See ModularMudServer/AGENTS.md
cmake -S ModularMudServer -B ModularMudServer/build
cmake --build ModularMudServer/build

# 3. Run the gateway
npm run dev:gateway

# 4. Run the client
npm run dev:client

# 5. Run the admin UI
npm run dev:admin
```

## Layout

```
package.json          # npm workspaces root
AGENTS.md             # AI-agent project rules (read this)
ModularMudServer/     # C++ ECS server (excluded from npm workspaces)
mud-ws-gateway/       # Python WebSocket gateway
MudClient/            # Nuxt 3 client
MudAdmin/             # Nuxt 4 admin
```

## Per-Component Docs

- [`ModularMudServer/README.md`](ModularMudServer/README.md)
- [`ModularMudServer/AGENTS.md`](ModularMudServer/AGENTS.md)
- [`ModularMudServer/ARCHITECTURE.md`](ModularMudServer/ARCHITECTURE.md)
- [`mud-ws-gateway/README.md`](mud-ws-gateway/README.md)
- [`MudClient/`](MudClient/)
- [`MudAdmin/`](MudAdmin/)

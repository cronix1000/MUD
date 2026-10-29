# Admin console + server restart from MudAdmin

**Goal:** a "Console" page in MudAdmin that runs commands against the live C++ server with Admin privileges, plus a restart button that gracefully shuts the server down (with player saves) so Docker brings it back and the fresh world data loads.

**Decisions (questions went unanswered, so I took the recommended defaults):**
- **Restart = graceful in-process exit.** Docker's `restart: unless-stopped` then restarts the container, reloading world entities from Postgres — so admin content edits take effect. New binary code continues to arrive via the existing CI deploy (push to main already recreates mud-server). No docker socket.
- **Console scope:** every registered command runs at `PermissionLevel::Admin` (future C++/Lua commands become available automatically), plus built-in verbs: `help`, `status`, `players`, `save`, `broadcast <msg>`, `as <player> <cmd>`, `restart`, `shutdown`. No Lua eval.
- **Security:** `tower-admin` is public internet, and today MudAdmin has zero auth. Executing server commands must not be world-open, so all new endpoints require a shared token from `MUD_ADMIN_TOKEN` (sent as `x-admin-token` header from the browser; the same value doubles as the console port password admin→server). If the env var is unset, the whole feature is disabled.

## A. C++ server — new internal admin port (27016)

New `ModularMudServer/AdminConsole.h/.cpp` — a small newline-delimited-JSON TCP listener mirroring `Server`'s select-loop/jthread pattern (`Server.cpp:38-149`) but far simpler (no telnet):

- `Start(port, password)` — skipped silently when the token is empty. Auth handshake on connect (`{"auth":"..."}`; wrong token → close).
- Requests `{"id":N,"cmd":"..."}` cross to the game thread via a `ThreadSafeQueue<AdminRequest>` (same pattern as `consoleQueue`, `Main.cpp:21`); responses `{"id":N,"ok":...,"output":"..."}` are queued back to the admin thread, which flushes pending output before stopping.
- A pseudo `ClientConnection` (`tcpSocket = INVALID_SOCKET_VAL`, never registered in `Server::activeClients`, never flushed by NetworkSystem) receives command output; after execution its `outbound` queue is drained to build the response (`ClientConnection.cpp:48-65` in reverse).
- Permission: add `bool consoleAdmin` to `ClientConnection` (`ClientConnection.h`); `CommandRegistry::ExecuteSingle` consults it before the entity lookup (`CommandRegistry.cpp:138`) so the console is Admin regardless of `playerEntityID`.

`Main.cpp`:
- Read `MUD_ADMIN_PORT` (default 27016) and `MUD_ADMIN_TOKEN` via `std::getenv`; start AdminConsole next to `server.Start` (`Main.cpp:84-91`).
- Drain the admin queue each tick (beside the stdin-console drain, `Main.cpp:118-122`) into a new `ProcessAdminCommand`:
  - Built-ins: `help`; `status` (uptime, session count, queue depth); `players` (iterate `GameEngine::sessions`, `GameEngine.h:58` — name from `NameComponent::displayName`, permission, entity id); `save` (actually implement the stub via `engine.SaveAllPlayers()`); `broadcast <msg>` (reuse the player-messaging path used by say/emote in `SocialCommandHandler` so text + GMCP Comm reach everyone); `restart` (ack first, then `engine->Quit()`); `shutdown` (same, help text notes it also bounces the container under Docker).
  - `as <name> <cmd...>`: resolve the name case-insensitively across sessions' `NameComponent`, point the pseudo-session's `playerEntityID` at that entity, run `ctx.commandRegistry->Execute`, restore. Room/inventory commands then run in that player's context.
  - Anything else falls through to `CommandRegistry::Execute` with the console flag set.
- After the main loop, stop the AdminConsole alongside `server.Stop()` (`Main.cpp:133-139`).

Build files: add the new `.cpp/.h` to **both** `ModularMudServer/CMakeLists.txt` (what CI/Docker builds with) and `ModularMudServer.vcxproj` + `.vcxproj.filters` (Windows).

## B. MudAdmin server side

`server/utils/console.ts` (modeled on the env/child-process patterns in `server/utils/scripts.ts` and `migrate.ts`):
- Config from `process.env`: `MUD_CONSOLE_HOST` (default `127.0.0.1`; prod `mud-server`), `MUD_CONSOLE_PORT` (27016), `MUD_ADMIN_TOKEN`.
- `isEnabled()` and `requireToken(event)` — 401 on missing/wrong header, 503 when the token isn't configured.
- `runCommand(cmd)`: `node:net` connection, auth handshake, send request, await the JSON line with the matching id, 10 s timeout, resolve the output string.

Endpoints (thin `defineEventHandler` handlers, `createError` conventions):
- `server/api/console/status.get.ts` → `{ enabled }`
- `server/api/console/run.post.ts` → `{ command }` → `{ output }`
- `server/api/console/restart.post.ts` → runs the `restart` verb → `{ output }`

## C. Console page

`app/pages/console.vue` (`definePageMeta({ layout: 'admin' })`, UiPanel/UiButton/UiConfirmDialog/useToast per `MudAdmin/AGENTS.md`; sidebar entry "Server console" in the System section of `app/layouts/admin.vue:114-124`):
- Token prompt when enabled-but-unauthorized (validated with a `help` ping, stored in `localStorage`).
- Terminal panel: mono font, scrollback of command/output entries, ↑/↓ history, busy guard, auto-scroll; `$fetch` per command with the standard `err.data?.statusMessage` error extraction.
- Restart button (danger, confirm dialog: "saves all players and bounces the container, ~15–30 s"); after the ack, polls `status` every 5 s until the server answers again, then toasts success.

## D. Config & env

- `docker-compose.yml`: mud-server gains `MUD_ADMIN_TOKEN: ${MUD_ADMIN_TOKEN:-}` and `expose: "27016"`; mud-admin gains `MUD_ADMIN_TOKEN`, `MUD_CONSOLE_HOST: mud-server`, `MUD_CONSOLE_PORT: 27016`. Empty defaults keep existing deploys green until the token is added to `docker/.env` on the VPS.
- `ModularMudServer/.env.example` and `MudAdmin/.env.example`: document the vars (local dev: host `127.0.0.1`; token goes in `ModularMudServer.vcxproj.user` per its `.example`).

## Verification
1. Build the C++ server locally (vcxproj); CI's CMake build covers Linux.
2. `npm run build:admin` green (the canonical admin gate).
3. Smoke: run the server with `MUD_ADMIN_TOKEN=dev`, send auth + `status` JSON lines to 127.0.0.1:27016; from the console page run `players`, `as <name> look`, `broadcast hi` (visible in a MudClient session); `restart` exits cleanly after saving and the container/process comes back.

Out of scope: docker-socket pull/recreate (new-code deploys stay on CI), Lua eval, streamed/SSE output.
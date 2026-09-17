# AGENTS.md - MudClient (Nuxt 3 Player Client)

Browser-based player client using Nuxt 3 + xterm.js. Connects to the C++ server through `mud-ws-gateway`.

## Workspace Identity

- Package name: `mudclient` (lowercase — referenced as such in root scripts).
- Workspace root: `MudClient/`.

## Common Commands

| Task | Command |
|------|---------|
| Dev server | `npm --workspace mudclient run dev` |
| Build | `npm --workspace mudclient run build` |
| Typecheck | `npm --workspace mudclient run typecheck` |
| Generate static | `npm --workspace mudclient run generate` |

(From repo root, the shortcut is `npm run dev:client` / `npm run build:client` / `npm run typecheck:client`.)

## Conventions

- Vue 3 `<script setup>` SFCs.
- Composables live in `composables/`. Anything that talks to the WebSocket gateway goes here, not in components.
- Terminal rendering uses xterm.js (`@xterm/xterm`). Don't reimplement a terminal in plain DOM.
- Tailwind for styling. shadcn-vue primitives for UI components.

## Cross-Server Notes

- The WebSocket message protocol lives in `composables/` and **must** match the gateway in `mud-ws-gateway/src/` and the server in `ModularMudServer/NetworkSystem.*`.
- See root `AGENTS.md` for project-wide rules.

# GMCP (Generic MUD Communication Protocol)

A learner's guide to adding GMCP to the Modular MUD stack.

---

## What is GMCP?

GMCP — Generic MUD Communication Protocol — is a way for a MUD server to send **structured data** (not just text) to a MUD client. Instead of your client receiving only the line `"Your hitpoints: 42/100"`, it can also receive a structured event:

```json
{"hp": 42, "max_hp": 100, "mp": 17, "max_mp": 30}
```

…attached to a named channel called **`Char.Vitals`**.

The client uses that structured data to drive UI panels (vitals bar, map, inventory, etc.) without having to scrape the colored text. The terminal text still flows as normal — GMCP sits on top as a side channel.

### Origins and standards

- **Aardwolf / IRE standard**: the de-facto taxonomy used by most MUDs. Module names like `Char.Vitals`, `Room.Info`, `Comm.Channel.Text` are conventional, not formal RFCs.
- Spec: <http://www.gammon.com.au/gmcp> (Nick Gammon's reference is the most readable)
- Real-world adoption: Mudlet, TinTin++, Mudder, Potato, MUSHclient, Atlantis, BeipMU, plus browser clients like MudRammer and MudPortal.

GMCP runs **on top of telnet** as a subnegotiation. That's important: it is not a separate protocol — it's a way to embed JSON payloads inside a telnet control sequence.

---

## How GMCP works on the wire (telnet)

GMCP uses telnet's **subnegotiation** feature, which looks like this:

```
IAC SB GMCP "<module>" <json> IAC SE
```

Where:

| Token | Byte | Meaning                                  |
| ----- | ---- | ---------------------------------------- |
| IAC   | 255  | "Interpret As Command" — telnet escape   |
| SB    | 250  | "Start subnegotiation"                   |
| GMCP  | 201  | Option code for GMCP                     |
| SE    | 240  | "End subnegotiation"                     |

The module name is quoted with a leading `"` and terminated by a space. Everything after that space, up to `IAC SE`, is parsed as JSON.

Example: the server telling the client "you're now in room 3":

```
IAC SB GMCP "Room.Info" {"num":3,"name":"Town Square","exits":{"n":1,"e":2}} IAC SE
```

### Negotiation (the dance)

GMCP doesn't just appear — both sides have to agree to use it. The dance (slightly simplified):

1. **Server → Client:** `IAC WILL GMCP`  (server says "I'm willing to send GMCP")
2. **Client → Server:** `IAC DO GMCP`    (client says "yes, please do")
3. Either side now sends `IAC SB GMCP … IAC SE` packets.

If the client doesn't reply, the server assumes GMCP is off.

Other common negotiation verbs:
- `DO` / `DONT` — server asks the client to use (or stop using) an option
- `WILL` / `WONT` — server announces it will (or won't) use an option

### Why IAC is annoying

Telnet uses byte `0xFF` (255) as its escape character. If you ever want to send a literal `0xFF` inside text, you have to write `IAC IAC` (`0xFF 0xFF`). Same idea as escaping a backslash in a string.

This is critical for **outbound** messages: if your game prints "FF is a hex digit" and `FF` happens to land on byte 255, the receiving telnet parser thinks it's an IAC and breaks. Always escape literal `0xFF` to `IAC IAC` in outbound text.

---

## Why our setup is unusual

Our stack is split into three parts:

```
Browser ──WebSocket──► Gateway ──TCP/telnet──► C++ Server
```

GMCP was designed for direct telnet. Browser WebSockets don't speak telnet. So we need a translation layer:

- **C++ server** speaks **real telnet + real GMCP** on its TCP port. A telnet client (Mudlet) connecting directly gets authentic GMCP.
- **Gateway** sits in the middle. It speaks telnet to the server on the browser's behalf (negotiates GMCP, parses `IAC SB GMCP … IAC SE` packets) and repackages them as JSON for the browser.
- **Browser client** only sees JSON envelopes. No telnet parser needed.

This means the C++ server can stay "dumb" — it doesn't even know the browser exists. The gateway owns the protocol translation.

---

## The plan: gateway-mediated GMCP

### Three layers, three responsibilities

#### 1. C++ server (real telnet + real GMCP)

- After a client connects, send `IAC WILL GMCP` and `IAC DO GMCP` immediately.
- When the client accepts, start sending structured events:
  - Room change → `IAC SB GMCP "Room.Info" {...} IAC SE`
  - Damage taken → `IAC SB GMCP "Char.Vitals" {...} IAC SE`
- Send colored terminal text separately as normal output.
- Subscribe to the client's wish-list via `Client.Subscriptions.List` — only send GMCP modules the client asked for.

#### 2. Python gateway (telnet-aware)

- For each WebSocket connection, open a TCP socket to the C++ server.
- Maintain a per-connection telnet state machine.
- Outgoing (server → browser): parse bytes, pull out GMCP packets, ship as `{"channel":"gmcp","module":"Char.Vitals","data":{...}}`. Plain text becomes `{"channel":"text","data":"..."}`.
- Incoming (browser → server): serialize JSON envelopes back to text or telnet bytes.

#### 3. Browser client (JSON envelopes only)

- WebSocket frames are always JSON. No telnet parsing.
- A reactive `useGMCPStore` keeps the latest data per module.
- Components subscribe to modules (`Char.Vitals`, `Room.Map`, etc.) and re-render when they arrive.
- The terminal still shows the colored text from the `text` channel — unchanged.

### The wire format (gateway ↔ browser)

Every WebSocket frame is a single-line JSON envelope:

**Server → browser:**
```json
{"channel":"text","data":"<colored terminal text>"}
{"channel":"gmcp","module":"Char.Vitals","data":{"hp":42,"max_hp":100}}
{"channel":"negotiate","option":"gmcp","state":"will"}
```

**Browser → server:**
```json
{"channel":"text","data":"look\n"}
{"channel":"gmcp","module":"Client.Subscriptions.List","data":["Char.Vitals","Room.Info"]}
```

The `channel` field is explicit so we never have to guess what an envelope means.

---

## The GMCP module catalog (v1)

Standard IRE/Aardwolf names. We'll use these on the server, gateway, and client.

### Core (handshake)
- `Core.Hello` — sent by server on connect. `{"client":"ModularMudServer","version":"1.0"}`
- `Core.Supports.Set` — array of `"<module> <version>"` strings. Each side lists what it supports.
- `Core.Goodbye` — sent by server before disconnect.
- `Client.Subscriptions.List` — sent by client. Server filters outgoing GMCP to only these modules.

### Character
- `Char.Login` — fired when a character enters the world. Bundle of name, vitals, stats.
- `Char.Name` — name, race, class, guild, level.
- `Char.Vitals` — `{"hp":..,"max_hp":..,"mp":..,"max_mp":..,"sp":..,"max_sp":..,"ep":..,"max_ep":..}`
- `Char.Status` — hunger, thirst, drunk, blind, etc.
- `Char.MaxStats` — max HP / MP / SP / EP etc.
- `Char.Affects` — list of buffs/debuffs (`{"name":"haste","duration":120}`)

### Room
- `Room.Info` — `{"num":3,"name":"Town Square","zone":"Midgaard","desc":"...","terrain":"city","exits":{"n":1,"e":2}}`
- `Room.Map` — full ASCII map grid (the existing `NetworkSyncSystem::SendLook` output becomes this).
- `Room.Exits` — patch update for just the exits.
- `Room.WrongDir` — `{"dir":"north"}` when the player tries to move into a wall.

### Communication
- `Comm.Channel.Text` — `{"channel":"say","talker":"Bob","text":"hi"}`
- `Comm.Channel.Start` — channel opens.
- `Comm.Channel.End` — channel closes.

### Inventory
- `Inventory.Item.Add` — `{"item":{"id":...,"name":"sword","..."}}`
- `Inventory.Item.Remove` — `{"item":{...}}`
- `Inventory.Items` — full inventory snapshot.

### Combat
- `Char.Vitals` is reused for damage ticks. Some MUDs also have `Combat.Round` for detailed round info.

---

## What you need to build

This is the full list of new files + edits, organized by package.

### ModularMudServer (C++)

**New files:**
- `GMCPModules.h` — constants for every module name (`kCharVitals = "Char.Vitals"`, etc.) plus a `BuildGMCPEnvelope(module, data)` helper.
- `GMCPHandler.h` / `GMCPHandler.cpp` — dispatches incoming GMCP. Parses `Core.Hello`, `Core.Supports.Set`, `Client.Subscriptions.List`. Tracks per-client subscriptions.
- `tests/test_telnet_codec.cpp` — round-trip tests for the telnet parser and outbound escape.

**Edit `ClientConnection.h` / `ClientConnection.cpp`:**
- Add a `TelnetState` member (negotiated flags + subnegotiation buffer).
- Add a telnet byte parser that runs *before* the line-based command parser.
- Handle `IAC WILL/DO/WONT/DONT <opt>`, `IAC SB <opt> … IAC SE`.
- Escape literal `0xFF` → `IAC IAC` in outbound text inside `SendData`.

**Edit `Server.cpp` (wherever `accept()` happens):**
- After creating a new `ClientConnection`, enqueue `IAC WILL GMCP\r\n` and `IAC DO GMCP\r\n`.

**Edit `NetworkSystem.cpp` / `.h`:**
- Drop `GameMessages.` from `msg.type`. Replace with canonical module name (`Char.Vitals`, `Room.Info`, etc.).
- Add `module` field to the envelope for web clients.
- Replace existing ad-hoc message sites:
  - Room enter → `Room.Info`
  - Look/map → `Room.Map`
  - Combat damage → `Char.Vitals`
  - Social/chat → `Comm.Channel.Text`
  - Inventory changes → `Inventory.Item.Add/Remove`
  - Bad movement → `Room.WrongDir`

**Edit `NetworkSystem.cpp`:**
- Add `HandleIncomingGMCP(client, module, data)` to receive parsed GMCP from the gateway side (the gateway will deliver them as JSON envelopes over the WebSocket — the server still parses them the same way).

**Edit existing system files:**
- `NetworkSyncSystem.cpp::SendLook` — emit `Room.Map` GMCP envelope alongside the colored map.
- `CombatSystem.cpp` — emit `Char.Vitals` after damage ticks.
- `MessageSystem.cpp` — emit `Comm.Channel.Text`.
- `InventorySystem.cpp` — emit `Inventory.Item.Add/Remove`.

### mud-ws-gateway (Python)

**New files:**
- `src/mud_gateway/telnet.py` — pure-data telnet decoder and encoder. No I/O.
- `src/mud_gateway/gmcp.py` — GMCP codec + JSON envelope helpers.
- `src/mud_gateway/session.py` — `GMGPSession` per-connection class. Holds telnet state, GMCP subscription list, encode/decode methods.
- `tests/test_telnet.py` — unit tests for the decoder.

**Edit `src/mud_gateway/bridge.py`:**
- Replace the byte passthrough with `GMGPSession`.
- Server → WS: feed server bytes into `session.feed_from_server`, ship resulting JSON envelopes via `ws.send_json(...)`.
- WS → server: parse incoming envelope, hand to `session.feed_from_browser`, write bytes to TCP.

**Edit `src/mud_gateway/app.py`:**
- No structural changes. Pass `Config` to the bridge as before.

**Edit `tests/test_bridge.py`:**
- Add tests: IAC negotiation flow, GMCP packet → JSON envelope, text round-trip still works.

### MudClient (Vue / Nuxt / TypeScript)

**New files:**
- `composables/useGMCPStore.ts` — reactive store: `Map<module, lastData>`. Has `subscribe(module, cb)` and `latest(module)`.
- `composables/useRoomPanel.ts` — subscribes to `Room.Info`, `Room.Map`, `Room.Exits`. Returns reactive room state.
- `composables/useCharPanel.ts` — subscribes to `Char.Vitals`, `Char.Name`, `Char.Status`. Returns reactive character state.
- `composables/useInventory.ts` — subscribes to `Inventory.*`.
- `tests/gmcp-store.test.ts` — store unit tests.

**Edit `composables/useMudSocket.ts`:**
- Replace raw `onMessage(text)` API with typed envelopes.
- Add `onText(cb)`, `onGMCP(cb)`, `onEnvelope(cb)`.
- Add `sendText(line)`, `sendGMCP(module, data)`.
- On `open`: send `Core.Supports.Set` and `Client.Subscriptions.List` once the gateway confirms negotiation.

**Edit `components/MudTerminal.vue`:**
- Subscribe to `onText` only. Ignore GMCP envelopes.

### Docs (this file lives at `docs/GMCP.md`)

- `AGENTS.md` files in each package: link to this guide, document conventions.
- Add a "Module Catalog" section referencing `GMCPModules.h` / `gmcp.py` / `useGMCPStore.ts` as the single source of truth for module names per side.

---

## How to add a new GMCP module

Once the infrastructure is in place, adding a new event is a three-step process:

1. **Server side**: add the module constant to `GMCPModules.h`. From the system that produces the event, call:
   ```cpp
   client->QueueGameMessage(BuildGMCPEnvelope(kMyEvent, json{...}));
   ```
   That system then subscribes to `kMyEvent` automatically — server-side filtering means if the player didn't subscribe, the packet isn't sent.

2. **Gateway side**: nothing to change. The gateway forwards any `gmcp`-channel envelope verbatim. The subscription filter lives on the server.

3. **Browser side**: in a composable, subscribe:
   ```ts
   const state = useGMCPStore().subscribe<MyEvent>('MyEvent', (data) => { ... })
   ```
   Render the data in any Vue component.

That's it. Adding modules is cheap once the plumbing is built.

---

## Things to watch out for

1. **Byte-escape on output.** Any time the server sends literal `0xFF` in text, escape it to `IAC IAC`. Otherwise a telnet parser on the receiving side will eat it as a control byte.

2. **Module name quoting.** Inside `IAC SB GMCP "<module>" <json> IAC SE`, the module name is wrapped in literal double-quotes. Don't drop them — some clients rely on the quote to find the boundary.

3. **Subscription gating.** Server-side filtering means if you forget to update the server's `Core.Supports.Set` for a new module, clients can't subscribe to it. Keep the list in sync.

4. **Don't break localhost telnet.** Mudlet / TinTin++ users connect directly to the C++ TCP port. They expect real GMCP packets. Don't gate GMCP behind the gateway — the gateway is *for browsers only*.

5. **JSON in `IAC SB` is a UTF-8 byte stream, not a length-prefixed frame.** Just concatenate bytes until you see `IAC SE`. The JSON is whatever's between the closing quote and `IAC SE`.

6. **The gateway is a translator, not a parser.** It doesn't need to understand what `Char.Vitals` *means*. It just sees "this is a GMCP packet with module name X and JSON Y" and packages it.

---

## References

- Nick Gammon's GMCP spec: <http://www.gammon.com.au/gmcp>
- Aardwolf's GMCP catalog: in their codebase / help files
- telnet RFC 854 (for the negotiation state machine)
- Mudlet's GMCP docs: <https://wiki.mudlet.org/w/Manual:GMCP>

---

## Quick reference: the full data flow for "player takes damage"

1. `CombatSystem` (C++) reduces HP, computes damage.
2. `CombatSystem` calls `client->QueueGameMessage(BuildGMCPEnvelope("Char.Vitals", {...}))`.
3. `NetworkSystem::FlushQueues` picks it up. Checks `hasGMCP` (subscription) — only sends if subscribed.
4. For telnet clients: writes `IAC SB GMCP "Char.Vitals" {...} IAC SE` to TCP.
5. For gateway-routed (browser) clients: writes JSON envelope `{"channel":"gmcp","module":"Char.Vitals","data":{...}}` to WebSocket.
6. **Gateway** (only on browser path): receives bytes from server, parses telnet, packages JSON envelope, ships over WebSocket.
7. **Browser**: `useMudSocket` receives envelope, routes to `useGMCPStore`.
8. `useCharPanel` was subscribed to `Char.Vitals` — its callback fires, vitals bar re-renders.

All of that happens without touching the terminal text, which keeps flowing normally through the `text` channel.

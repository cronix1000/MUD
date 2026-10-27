# MudAdmin UI Remake — Plan (draft)

Status: proposal, not yet approved. This document starts the redesign effort for the admin
builder's look. Nothing here is implemented yet; phases land one at a time and each keeps
`npm run build:admin` green.

## 1. Where we are

The admin is a dark, terminal-flavored single-user tool built on Nuxt 4 + Tailwind with no
component layer. Every page hand-rolls the same primitives (`bg-neutral-900 border
border-neutral-800 rounded px-3 py-1 …`), so consistency depends on copy-paste.

What the current UI looks like:

- **Shell** — one 264px text-only sidebar with six stacked sections (Dashboard, World
  Building, Documents, World Tree, Player, World raw tables). The entity types hide inside a
  collapsed `<details>` labeled "Entities (world.entities)" showing raw type keys (`mob`,
  `loot_table`). The sidebar is longer than the viewport and scrolls.
- **Entity list pages** (`/entities/{type}`) — a boxed "New …" form permanently parked above
  a bare HTML table. Delete is a bare red link with a native `confirm()`. Search sits in the
  toolbar row and 500-ed until the `listEntities` fix.
- **Editors** — dedicated editors per type (room has 7 tabs; mob/item/zone/dialogue/loot/
  interactable have their own) plus a generic field-grid editor for the rest. Field labels are
  raw doc keys in mono, fields stack full-width, and wiki-link previews render inline below
  their textarea (reads like duplicated text).
- **Overview** — stat cards + region grid + quick links; numbers colored by type.

## 2. Pain points this remake targets

1. **Information architecture is redundant.** Quests/Loot/Recipes appear both as "World
   Building" links and as entity types under Documents; "World raw tables" duplicates what
   Documents already covers for migrated types.
2. **Naming leaks the schema.** Users see `mob`/`loot_table`/`entity_type: mob` while the
   overview says "NPCS". One human label per type, everywhere (labels already exist in
   `entitySchemas.ts`).
3. **No shared components.** Buttons, inputs, panels, tables, badges are re-styled per page;
   focus states, disabled states, and danger actions differ page to page.
4. **Create flows dominate the list page.** The full create form renders even when unused;
   six different create panels with six slightly different layouts.
5. **Weak feedback.** Native `confirm()`/`alert()`, no toasts, no dirty-state guard when
   leaving an editor with unsaved changes, save buttons don't reflect stale/saved state.
6. **Editors waste vertical space.** Full-width stacks of every field regardless of importance;
   related fields (stats, combat numbers) aren't grouped; no density option for tables.

## 3. Design direction

Keep the dark terminal identity (it fits the product) but give it a deliberate system:
"arcane console" — near-black surfaces, one restrained accent (emerald, kept from today),
type-tinted accents for entity identities, and real spacing/typography scales.

- **Surfaces**: page `neutral-950`, panels `neutral-900`, inputs `neutral-950` with
  `neutral-700` borders that brighten on focus; elevation via borders, not shadows.
- **Type**: sans for UI copy, mono reserved for ids, keys, JSON, room strings. Section
  headings small-caps with letter-spacing (already the sidebar's best trick).
- **Color**: one accent (emerald) for primary actions; each entity type keeps its existing
  hue from `wikiParser.ts` `ENTITY_COLORS` for badges/icons only — never for buttons.
- **Density**: comfortable by default, `compact` toggle for tables (game builders live in
  tables).

## 4. Component system (new `app/components/ui/`)

Build ~10 local primitives instead of adopting a UI kit (no runtime dep, keeps bundle tiny,
matches "reuse across MudClient" rule):

| Component | Replaces |
|---|---|
| `UiButton` (variant: primary/ghost/danger, size, loading) | every hand-classed `<button>` |
| `UiInput` / `UiTextarea` / `UiSelect` (label, mono flag, error slot) | labeled input stacks |
| `UiPanel` (title, actions slot, collapsible) | the `bg-neutral-900 border … p-4` boxes |
| `UiTable` (columns, compact mode, empty/loading states, row actions) | the raw `<table>`s |
| `UiBadge` (type-colored entity badges) | raw `entity_id` text |
| `UiModal` + `UiConfirmDialog` | native `confirm()` calls |
| `UiToast` (composable `useToast()`) | silent failures / ad-hoc `<p>` errors |
| `UiTabs` | editor tab strips (room's 7 tabs) |
| `UiField` (label + widget from `entitySchemas.ts` type) | the generic editor's field switch |
| `UiEmptyState` | "No entities. Create one above." paragraphs |

Design tokens live in `app/assets/css/theme.css` as CSS variables consumed by the Tailwind
config (colors, radius, spacing, focus ring) so a re-theme is a one-file change.

## 5. Information architecture (shell)

- **Sidebar stays** (this is a tool, not a marketing site) but becomes three groups only:
  1. **World** — Overview, Map, Regions, Terrain palette, Scripts.
  2. **Content** — the entity types with human labels and type-colored dots (Mobs, Items,
     Interactables, Loot Tables, Zones, Rooms, Dialogue, Quests, Recipes, Skills, …) generated
     from `ENTITY_SCHEMAS`, killing the "Documents" vs "World Building" split.
  3. **System** — Migrations, Snapshots, Player data, legacy raw tables (collapsed by default,
     labeled "Advanced").
- **Topbar inside pages**: breadcrumb (`World / Mobs / training_dumbmy`), global search
  (already exists as `/api/search/entities`) promoted to a `Ctrl+K` palette, and the entity
  type label instead of `entity_type: mob`.
- **World Tree** collapses into a single region section that expands in place (currently it
  pushes Player/raw tables down a full viewport).

## 6. Page-level changes

- **Entity list pages**: toolbar (search, count, compact toggle, "New" button opening a
  right-side slide-over or modal instead of the always-open form panel); table with type
  badges, relative "updated" times, row hover actions (edit/duplicate/delete with confirm
  dialog + toast). One generic `EntityCreatePanel` driven by per-type configs replaces the six
  near-identical `Admin*Create.vue` forms (mob/item/loot/interactable/zone/dialogue/room keep
  only their type-specific field configs; room's auto `region::id` + next-free-id logic stays).
- **Editors**: sticky header (breadcrumb, dirty indicator, Save/Revert); fields grouped into
  carded sections per `entitySchemas` groups (Identity / Stats / AI / Script / Advanced);
  two-column grid for short fields, full-width for JSON/wiki text; Raw JSON becomes a tab, not
  a popup; unsaved-changes guard on route leave.
- **Overview**: keep stat cards (renamed labels), region grid gets type badges + room counts,
  quick links fold into an empty-state-friendly "getting started" strip.
- **Region map / graph**: untouched functionally; restyle chrome only.

## 7. Phases

1. **Phase 0 — Foundations**: tokens (`theme.css`), `UiButton/Input/Panel/Badge`,
   `useToast`. No page moves. Build green, zero behavior change.
2. **Phase 1 — Shell**: sidebar IA from §5, breadcrumbs, `Ctrl+K` search palette. Old
   raw-table links preserved under "Advanced".
3. **Phase 2 — Entity lists**: `UiTable` + slide-over create for all `/entities/{type}`
   pages; fold `Admin*Create.vue` into config-driven create panels.
4. **Phase 3 — Editors**: sectioned layouts, sticky save bar, dirty guard, Raw JSON tab for
   every editor, starting with the generic editor then mob/item/room.
5. **Phase 4 — Overview & polish**: overview restyle, compact tables, empty states, a11y pass
   (focus rings, labels, keyboard nav), MudClient visual consistency check.

## 8. Non-goals / constraints

- No new runtime dependencies (no component library, no icon package unless inline SVG).
- No auth/multi-user work; stays a single-user local tool.
- Server APIs unchanged (except already-planned fixes); this is a front-end remake.
- Lua/DB-facing features (migrations, snapshots, generators) keep working unchanged.
- Keep `npm run build:admin` as the only gate per phase.

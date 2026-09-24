#!/usr/bin/env bash
#
# cutover-data.sh
# ----------------
# Loads SQLite source data into the Postgres `world.*` and `players.*` schemas
# created by scripts/cutover.sql.
#
# Run on the VPS (Ubuntu) AFTER cutover.sql has been applied to mud_prod (or mud_beta).
#
# Requires: bash, sqlite3, psql, awk, mktemp
# Reads:     ~/MUD/ModularMudServer/mud.world.db
#            ~/MUD/ModularMudServer/mud.players.db
# Env:       PGPASSWORD (mud_prod / mud_beta role password) -- or rely on ~/.pgpass
#
# Behavior:
#   * Atomic per-table: TRUNCATE each target table, then \copy fresh rows from a
#     fresh CSV dump of the SQLite source. Re-running the script is safe and
#     leaves the destination in the same state.
#   * Bounded: writes to a tmpdir that is removed on exit.
#   * Verifies: emits a row-count parity line per table.
#
# Usage:
#   MUD_DATABASE_URL=postgresql://mud_prod:super_mud_pass_1@127.0.0.1:5432/mud_prod \
#     bash scripts/cutover-data.sh
#
# To load mud_beta instead, change MUD_DATABASE_URL to point at mud_beta
# (and use the mud_beta role's password).

set -euo pipefail

WORLDSRC="${WORLDSRC:-$HOME/MUD/ModularMudServer/mud.world.db}"
PLAYERSRC="${PLAYERSRC:-$HOME/MUD/ModularMudServer/mud.players.db}"
URL="${MUD_DATABASE_URL:?MUD_DATABASE_URL is required (e.g. postgresql://mud_prod:password@127.0.0.1:5432/mud_prod)}"

if [[ ! -r "$WORLDSRC" ]]; then
  echo "FATAL: cannot read $WORLDSRC" >&2
  echo "       Set WORLDSRC env var if the SQLite file lives elsewhere." >&2
  exit 1
fi
if [[ ! -r "$PLAYERSRC" ]]; then
  echo "FATAL: cannot read $PLAYERSRC" >&2
  echo "       Set PLAYERSRC env var if the SQLite file lives elsewhere." >&2
  exit 1
fi

for tool in sqlite3 psql awk; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "FATAL: missing required tool: $tool" >&2
    exit 1
  fi
done

TMPDIR=$(mktemp -d -t cutover-data.XXXXXX)
trap 'rm -rf "$TMPDIR"' EXIT

PARITY_TMP="$TMPDIR/parity.tsv"
: > "$PARITY_TMP"

# dump <sqlite_db> <sqlite_table> <target_table>
dump_and_load() {
  local src_db="$1" src_table="$2" tgt_table="$3"
  local csv="${TMPDIR}/${tgt_table//./_}.csv"

  sqlite3 -separator ',' -header "$src_db" \
    "SELECT * FROM ${src_table};" > "$csv"

  # TRUNCATE then COPY. \copy is client-side (reads from $TMPDIR).
  psql "$URL" -v ON_ERROR_STOP=1 -q -c \
    "TRUNCATE TABLE ${tgt_table} RESTART IDENTITY CASCADE; \copy ${tgt_table} FROM '${csv}' WITH (FORMAT csv, HEADER true)"

  # Row counts.
  local src_n dst_n
  src_n=$(sqlite3 "$src_db" "SELECT count(*) FROM ${src_table};")
  dst_n=$(psql "$URL" -tAc "SELECT count(*) FROM ${tgt_table};")

  local status="OK"
  if [[ "$src_n" != "$dst_n" ]]; then
    status="MISMATCH"
  fi
  printf "%-35s src=%-7s dst=%-7s  %s\n" "$tgt_table" "$src_n" "$dst_n" "$status" \
    | tee -a "$PARITY_TMP"
}

echo "Loading world.* from $WORLDSRC"
# Dependency-respecting order: parents before children.
dump_and_load "$WORLDSRC" world_worlds              world.worlds
dump_and_load "$WORLDSRC" world_regions             world.regions
dump_and_load "$WORLDSRC" world_terrains            world.terrains
dump_and_load "$WORLDSRC" world_rooms               world.rooms
dump_and_load "$WORLDSRC" world_room_exits          world.room_exits
dump_and_load "$WORLDSRC" world_room_spawns         world.room_spawns
dump_and_load "$WORLDSRC" world_items               world.items
dump_and_load "$WORLDSRC" world_mobs                world.mobs
dump_and_load "$WORLDSRC" world_interactables       world.interactables
dump_and_load "$WORLDSRC" world_dialogues           world.dialogues
dump_and_load "$WORLDSRC" world_skill_categories    world.skill_categories
dump_and_load "$WORLDSRC" world_skills              world.skills
dump_and_load "$WORLDSRC" world_loot_tables         world.loot_tables
dump_and_load "$WORLDSRC" world_region_overrides    world.region_overrides
dump_and_load "$WORLDSRC" world_field_definitions   world.field_definitions
dump_and_load "$WORLDSRC" world_quests              world.quests
dump_and_load "$WORLDSRC" world_quest_objectives    world.quest_objectives
dump_and_load "$WORLDSRC" world_quest_rewards       world.quest_rewards
dump_and_load "$WORLDSRC" world_recipes             world.recipes

echo
echo "Loading players.* from $PLAYERSRC"
dump_and_load "$PLAYERSRC" player_players           players.player_players
dump_and_load "$PLAYERSRC" player_items             players.player_items
dump_and_load "$PLAYERSRC" player_known_recipes     players.player_known_recipes

echo
echo "--- parity summary ---"
awk '{ printf "%-35s %s\n", $1, ($2==$3 ? "OK" : "MISMATCH") }' "$PARITY_TMP"
echo "--- done ---"

if grep -q MISMATCH "$PARITY_TMP"; then
  echo "One or more tables have row-count mismatches. See output above." >&2
  exit 2
fi

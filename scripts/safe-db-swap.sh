#!/usr/bin/env bash
#
# safe-db-swap.sh
# ----------------
# Live-swap a freshly built world DB onto a running server without disturbing
# the players DB. Idempotent and safe to re-run.
#
# Usage:
#   ./scripts/safe-db-swap.sh [--src PATH] [--data-dir DIR]
#
# Defaults assume the docker-compose layout:
#   data/mud.world.db        (target)
#   data/mud.players.db      (never touched)
#   data/mud.world.db.new    (incoming)
#
# On success, ./data/mud.world.db.new replaces ./data/mud.world.db.

set -euo pipefail

SRC=""
DATA_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --src) SRC="$2"; shift 2;;
    --data-dir) DATA_DIR="$2"; shift 2;;
    -h|--help) sed -n '2,18p' "$0"; exit 0;;
    *) echo "unknown arg: $1" >&2; exit 64;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${DATA_DIR:-${REPO_ROOT}/data}"
SRC="${SRC:-${DATA_DIR}/mud.world.db.new}"
TARGET="${DATA_DIR}/mud.world.db"
PLAYERS="${DATA_DIR}/mud.players.db"
BACKUPS_DIR="${DATA_DIR}/backups"
TS="$(date -u +%FT%H-%M-%SZ)"

mkdir -p "$BACKUPS_DIR"

log() { echo "[safe-db-swap $*]"; }

if [[ ! -f "$SRC" ]]; then
  log "missing source world DB at: $SRC"
  exit 1
fi

log "snapshotting current world DB"
cp -p "$TARGET" "${BACKUPS_DIR}/mud.world.db.${TS}.bak"

if [[ -f "$PLAYERS" ]]; then
  log "extracting player_* rows from current world DB into players DB"
  sqlite3 "$TARGET" ".dump player_players player_items player_known_recipes" \
    | sqlite3 "$PLAYERS"
else
  log "no existing players DB at $PLAYERS; skipping row migration"
fi

if command -v docker >/dev/null 2>&1 \
   && [[ -f "${REPO_ROOT}/docker-compose.yml" || -f "${REPO_ROOT}/docker-compose.yaml" ]]; then
  if docker compose -f "${REPO_ROOT}/docker-compose.yml" ps --services 2>/dev/null | grep -q '^mud-server$'; then
    log "stopping mud-server container"
    docker compose -f "${REPO_ROOT}/docker-compose.yml" stop mud-server
  fi
fi

log "moving $SRC -> $TARGET"
mv "$SRC" "$TARGET"

if command -v docker >/dev/null 2>&1 \
   && [[ -f "${REPO_ROOT}/docker-compose.yml" || -f "${REPO_ROOT}/docker-compose.yaml" ]]; then
  if docker compose -f "${REPO_ROOT}/docker-compose.yml" ps --services 2>/dev/null | grep -q '^mud-server$'; then
    log "starting mud-server container"
    docker compose -f "${REPO_ROOT}/docker-compose.yml" start mud-server
  fi
fi

log "swap complete; backup at ${BACKUPS_DIR}/mud.world.db.${TS}.bak"

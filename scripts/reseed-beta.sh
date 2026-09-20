#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$PWD}"
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -h|--help)
      echo "usage: $0 [--force]"
      echo "  bootstrap beta data dir from checked-in ModularMudServer/{mud.world.db,mud.players.db}."
      echo "  refuses to delete data/beta/_snapshots/ unless --force is given."
      exit 0
      ;;
    *)
      echo "unknown arg: $arg" >&2
      exit 64
      ;;
  esac
done

SNAPSHOT_DIR="$REPO_DIR/data/beta/_snapshots"
WORLD_TARGET="$REPO_DIR/data/beta/mud.world.db"
PLAYERS_TARGET="$REPO_DIR/data/beta/mud.players.db"
SRC_WORLD="$REPO_DIR/ModularMudServer/mud.world.db"
SRC_PLAYERS="$REPO_DIR/ModularMudServer/mud.players.db"

if [ -d "$SNAPSHOT_DIR" ] && [ -n "$(ls -A "$SNAPSHOT_DIR" 2>/dev/null || true)" ]; then
  if [ "$FORCE" -ne 1 ]; then
    echo "refusing: $SNAPSHOT_DIR is non-empty." >&2
    echo "move snapshots aside or pass --force to delete them." >&2
    exit 1
  fi
  echo "[reseed] --force: removing $SNAPSHOT_DIR"
  rm -rf "$SNAPSHOT_DIR"
fi

if [ ! -f "$SRC_WORLD" ] || [ ! -f "$SRC_PLAYERS" ]; then
  echo "missing seed source:" >&2
  [ -f "$SRC_WORLD" ] || echo "  $SRC_WORLD" >&2
  [ -f "$SRC_PLAYERS" ] || echo "  $SRC_PLAYERS" >&2
  echo "expected: a fresh 'git clone' on a post-split host, or the split artifacts you started from." >&2
  exit 1
fi

mkdir -p "$(dirname "$WORLD_TARGET")"

echo "[reseed] stopping beta services"
docker compose --profile beta stop mud-server-beta mud-admin-beta mud-client-beta caddy-beta 2>/dev/null || true

echo "[reseed] removing $WORLD_TARGET and $PLAYERS_TARGET"
rm -f "$WORLD_TARGET" "$PLAYERS_TARGET"

echo "[reseed] copying seed DBs into data/beta/"
cp -a "$SRC_WORLD" "$WORLD_TARGET"
cp -a "$SRC_PLAYERS" "$PLAYERS_TARGET"

echo "[reseed] starting mud-server-beta"
docker compose --profile beta up -d mud-server-beta

echo "[reseed] done"

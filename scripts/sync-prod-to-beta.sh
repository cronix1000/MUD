#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$PWD}"
SYNC_HOST="${SYNC_HOST:?SYNC_HOST must be set (e.g. mud@prod.example.com)}"
SYNC_REMOTE_SRC="${SYNC_REMOTE_SRC:-/home/mud/data/prod/mud.world.db}"

PLAYERS_DB="$REPO_DIR/data/beta/mud.players.db"
TARGET_DB="$REPO_DIR/data/beta/mud.world.db"

if [ ! -f "$PLAYERS_DB" ]; then
  echo "refusing: $PLAYERS_DB is missing." >&2
  echo "run scripts/reseed-beta.sh first to bootstrap beta's players DB." >&2
  exit 1
fi

mkdir -p "$(dirname "$TARGET_DB")"

if [ -f "$TARGET_DB" ]; then
  echo "about to overwrite $TARGET_DB" >&2
  echo "current mtime/size:" >&2
  stat -c '  %y  %s bytes  %n' "$TARGET_DB" >&2 || true
  echo "incoming from $SYNC_HOST:$SYNC_REMOTE_SRC" >&2
  read -r -p "proceed? [y/N] " ans
  case "$ans" in
    y|Y|yes|YES) ;;
    *) echo "aborted." >&2; exit 1 ;;
  esac
fi

echo "[sync] scp $SYNC_HOST:$SYNC_REMOTE_SRC -> $TARGET_DB"
scp_args=()
if [ -n "${SYNC_SSH_ARGS:-}" ]; then
  # shellcheck disable=SC2206
  scp_args=($SYNC_SSH_ARGS)
fi
if ! scp "${scp_args[@]}" "$SYNC_HOST:$SYNC_REMOTE_SRC" "$TARGET_DB"; then
  echo "scp failed" >&2
  exit 1
fi

echo "[sync] wiping _migrations in $TARGET_DB"
scrubbed=0
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$TARGET_DB" "delete from _migrations; vacuum;"
  scrubbed=1
elif command -v node >/dev/null 2>&1 && [ -d "$REPO_DIR/MudAdmin/node_modules/better-sqlite3" ]; then
  (
    cd "$REPO_DIR/MudAdmin"
    TARGET_DB="$TARGET_DB" node --input-type=module -e '
      import Database from "better-sqlite3";
      const db = new Database(process.env.TARGET_DB);
      db.prepare("delete from _migrations").run();
      db.exec("vacuum");
      db.close();
    '
  )
  scrubbed=1
fi
if [ "$scrubbed" -ne 1 ]; then
  echo "refusing: cannot scrub _migrations." >&2
  echo "install the 'sqlite3' CLI (apt install sqlite3) or run" >&2
  echo "'npm install' once in MudAdmin/ so better-sqlite3 is available." >&2
  exit 1
fi

echo "[sync] restarting mud-server-beta"
docker compose --profile beta restart mud-server-beta

echo "[sync] done"

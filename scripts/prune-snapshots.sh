#!/usr/bin/env bash
set -euo pipefail
KEEP="${1:-10}"
DIR="${2:-${REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}/ModularMudServer}"
shopt -s nullglob
mapfile -t files < <(ls -1t "$DIR"/mud.world.db.bak.*.bak "$DIR"/mud.db.bak.*.bak "$DIR"/mud.db.presplit.*.bak "$DIR"/mud.db.singlefile.*.bak 2>/dev/null | grep -v "/singlefile\." || true)
total="${#files[@]}"
if (( total <= KEEP )); then
  echo "[prune-snapshots] $total backups present, keep=$KEEP — nothing to do."
  exit 0
fi
to_delete=( "${files[@]:KEEP}" )
for f in "${to_delete[@]}"; do
  echo "[prune-snapshots] delete $f"
  rm -f -- "$f"
done
echo "[prune-snapshots] deleted $((total - KEEP)) of $total"

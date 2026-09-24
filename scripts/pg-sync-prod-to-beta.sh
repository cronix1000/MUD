#!/usr/bin/env bash
#
# scripts/pg-sync-prod-to-beta.sh — mirror prod's world schema into beta.
#
# Usage:
#   MUD_PG_URL_PROD=postgresql://… ./scripts/pg-sync-prod-to-beta.sh
#
# Replaces the SQLite-era scripts/sync-prod-to-beta.sh. Players data is
# intentionally not copied — each profile keeps its own accounts, items, and
# known recipes. Only the world_* content (regions, rooms, items, mobs, etc.)
# and the _meta._migrations table travel across.
#
# Both connection URLs must be reachable from the host running this script.

set -euo pipefail

: "${MUD_PG_URL_PROD:?MUD_PG_URL_PROD must be set (e.g. postgresql://mud_prod:pw@host:5432/mud_prod)}"
: "${MUD_PG_URL_BETA:?MUD_PG_URL_BETA must be set (e.g. postgresql://mud_beta:pw@host:5432/mud_beta)}"

work="$(mktemp -d -t pg-sync.XXXXXX)"
trap 'rm -rf "$work"' EXIT

echo "[pg-sync] dumping world + _meta from prod"
pg_dump "$MUD_PG_URL_PROD" \
    --schema=world \
    --schema=_meta \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    > "$work/world.sql"

echo "[pg-sync] dropping beta world + _meta (idempotent)"
psql "$MUD_PG_URL_BETA" --variable ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS world CASCADE;
DROP SCHEMA IF EXISTS _meta CASCADE;
SQL

echo "[pg-sync] recreating world schema in beta"
psql "$MUD_PG_URL_BETA" --variable ON_ERROR_STOP=1 --command "CREATE SCHEMA world;"
psql "$MUD_PG_URL_BETA" --variable ON_ERROR_STOP=1 --command "CREATE SCHEMA _meta;"

echo "[pg-sync] restoring dump into beta"
psql "$MUD_PG_URL_BETA" \
    --single-transaction \
    --variable ON_ERROR_STOP=1 \
    --file "$work/world.sql"

echo "[pg-sync] restarting mud-server-beta"
docker compose --profile beta restart mud-server-beta

echo "[pg-sync] done"

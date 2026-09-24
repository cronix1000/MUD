#!/usr/bin/env bash
#
# scripts/pg-export.sh — dump a MUD Postgres database to a SQL file.
#
# Usage:
#   ./scripts/pg-export.sh <database> <out.sql>
#   ./scripts/pg-export.sh mud_prod data/prod/pg_snapshots/mud_prod.sql
#
# Reads connection details from $MUD_PG_URL_<DB_UPPER> or, failing that, from
# the standard libpq env vars (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE).
# The export is a plain-text pg_dump that psql can replay — safe to copy
# between hosts with scp and safe to inspect in a text editor.

set -euo pipefail

if [[ $# -lt 2 ]]; then
    echo "usage: $0 <database> <out.sql>" >&2
    exit 64
fi

db="$1"
out="$2"

case "$db" in
    mud_prod|mud_beta) ;;
    *) echo "refusing: database must be mud_prod or mud_beta (got '$db')" >&2; exit 2 ;;
esac

url_var="MUD_PG_URL_${db^^}"
url="${!url_var:-}"

mkdir -p "$(dirname "$out")"
ts="$(date -u +%FT%H-%M-%SZ)"
tmp="$(mktemp -t pg-export.XXXXXX.sql)"

trap 'rm -f "$tmp"' EXIT

if [[ -n "$url" ]]; then
    echo "[pg-export] $db -> $out (via $url_var)"
    pg_dump --dbname="$url" \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        > "$tmp"
else
    echo "[pg-export] $db -> $out (via PG* env)"
    pg_dump --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        "$db" > "$tmp"
fi

mv "$tmp" "$out"
echo "[pg-export] wrote $(wc -c < "$out") bytes (snapshot timestamp $ts)"

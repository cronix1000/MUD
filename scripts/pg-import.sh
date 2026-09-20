#!/usr/bin/env bash
#
# scripts/pg-import.sh — restore a MUD Postgres database from a SQL file.
#
# Usage:
#   ./scripts/pg-import.sh <database> <in.sql>
#   ./scripts/pg-import.sh mud_prod data/prod/pg_snapshots/mud_prod.sql
#
# Refuses to overwrite an existing database without the --force flag.
# Always wraps the import in a single transaction so a partial restore
# leaves the destination untouched.

set -euo pipefail

force=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --force) force=1; shift ;;
        -h|--help)
            sed -n '2,17p' "$0"; exit 0 ;;
        --) shift; break ;;
        -*) echo "unknown flag: $1" >&2; exit 64 ;;
        *) break ;;
    esac
done

if [[ $# -lt 2 ]]; then
    echo "usage: $0 [--force] <database> <in.sql>" >&2
    exit 64
fi

db="$1"
in="$2"

case "$db" in
    mud_prod|mud_beta) ;;
    *) echo "refusing: database must be mud_prod or mud_beta (got '$db')" >&2; exit 2 ;;
esac

if [[ ! -f "$in" ]]; then
    echo "missing input file: $in" >&2
    exit 1
fi

url_var="MUD_PG_URL_${db^^}"
url="${!url_var:-}"

echo "[pg-import] target=$db input=$in force=$force"

if [[ -z "$force" ]]; then
    if [[ -n "$url" ]]; then
        existing=$(psql --dbname="$url" --tuples-only --no-align --command "SELECT 1 FROM pg_database WHERE datname='$db'" | tr -d ' \n')
    else
        existing=$(psql --tuples-only --no-align --command "SELECT 1 FROM pg_database WHERE datname='$db'" | tr -d ' \n')
    fi
    if [[ "$existing" == "1" ]]; then
        echo "refusing: $db already exists and --force not given" >&2
        echo "  (this is by design — you almost always want to target a fresh DB)" >&2
        exit 3
    fi
fi

if [[ -n "$url" ]]; then
    psql --dbname="$url" \
        --single-transaction \
        --variable ON_ERROR_STOP=1 \
        --file "$in"
else
    psql --dbname="$db" \
        --single-transaction \
        --variable ON_ERROR_STOP=1 \
        --file "$in"
fi

echo "[pg-import] done"

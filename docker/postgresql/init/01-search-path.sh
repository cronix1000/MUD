#!/bin/bash
#
# docker/postgresql/init/01-search-path.sh
#
# Idempotent role-level search_path for the mud_prod / mud_beta roles.
# 00-bootstrap.sh already issues this for fresh volumes; this script is
# for existing volumes where the bootstrap already ran before this fix
# landed. Safe to re-run: ALTER ROLE ... SET is idempotent.
#
# Run from the VPS host once per existing DB:
#   docker exec mud-postgres psql -U postgres -d postgres -c \
#     "ALTER ROLE mud_prod SET search_path TO world, players, _meta, public;"
#   docker exec mud-postgres psql -U postgres -d postgres -c \
#     "ALTER ROLE mud_beta SET search_path TO world, players, _meta, public;"
#
# Existing connections keep their old search_path until they reconnect.
# Restart mud-server / mud-admin after running this so they pick up the
# new default.

set -euo pipefail

psql -v ON_ERROR_STOP=1 --username postgres --dbname postgres <<'EOSQL'
ALTER ROLE mud_prod SET search_path TO world, players, _meta, public;
ALTER ROLE mud_beta SET search_path TO world, players, _meta, public;
EOSQL

echo "[postgres-init] ensured search_path default on mud_prod and mud_beta"

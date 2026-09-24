#!/bin/bash
#
# docker/postgresql/init/00-bootstrap.sh
#
# Runs once on first `docker compose up` of the postgres service (when the
# pgdata volume is empty). Reads passwords from env vars supplied by the
# docker-compose service and provisions two roles and two databases:
#
#   role  mud_prod  -> database mud_prod
#   role  mud_beta  -> database mud_beta
#
# Both roles get full ownership of their database and the public schema; the
# C++ server and admin both connect as the role that matches their profile.

set -euo pipefail

: "${MUD_PROD_PASSWORD:?MUD_PROD_PASSWORD must be set by docker-compose}"
: "${MUD_BETA_PASSWORD:?MUD_BETA_PASSWORD must be set by docker-compose}"

psql -v ON_ERROR_STOP=1 \
    --username postgres \
    --dbname postgres \
    --variable MUD_PROD_PASSWORD="$MUD_PROD_PASSWORD" \
    --variable MUD_BETA_PASSWORD="$MUD_BETA_PASSWORD" \
    <<'EOSQL'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mud_prod') THEN
        EXECUTE format('CREATE ROLE mud_prod LOGIN PASSWORD %L', :'MUD_PROD_PASSWORD');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mud_beta') THEN
        EXECUTE format('CREATE ROLE mud_beta LOGIN PASSWORD %L', :'MUD_BETA_PASSWORD');
    END IF;
END
$$;

SELECT 'CREATE DATABASE mud_prod OWNER mud_prod'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'mud_prod')
\gexec

SELECT 'CREATE DATABASE mud_beta OWNER mud_beta'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'mud_beta')
\gexec

GRANT ALL PRIVILEGES ON DATABASE mud_prod TO mud_prod;
GRANT ALL PRIVILEGES ON DATABASE mud_beta TO mud_beta;
EOSQL

psql -v ON_ERROR_STOP=1 --username postgres --dbname mud_prod <<'EOSQL'
GRANT ALL ON SCHEMA public TO mud_prod;
ALTER SCHEMA public OWNER TO mud_prod;
EOSQL

psql -v ON_ERROR_STOP=1 --username postgres --dbname mud_beta <<'EOSQL'
GRANT ALL ON SCHEMA public TO mud_beta;
ALTER SCHEMA public OWNER TO mud_beta;
EOSQL

psql -v ON_ERROR_STOP=1 --username postgres --dbname postgres <<'EOSQL'
ALTER ROLE mud_prod SET search_path TO world, players, _meta, public;
ALTER ROLE mud_beta SET search_path TO world, players, _meta, public;
EOSQL

echo "[postgres-init] bootstrapped mud_prod and mud_beta"

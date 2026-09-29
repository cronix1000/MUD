#!/usr/bin/env bash
#
# deploy-remote.sh — run on the target host by GitHub Actions over SSH.
#
# Pre-requisites on the host:
#   * docker + docker compose plugin installed
#   * user is in the docker group (or use sudo)
#   * repo cloned at $REPO_DIR (default ~/MUD on the prod VPS)
#   * an .env file at $REPO_DIR/.env with MUD_DATABASE_URL set
#
set -euo pipefail

# Resolve REPO_DIR: honour env var if set; otherwise look for ~/MUD then ~/mud.
if [[ -z "${REPO_DIR:-}" ]]; then
  if [[ -d "$HOME/MUD" ]]; then
    REPO_DIR="$HOME/MUD"
  elif [[ -d "$HOME/mud" ]]; then
    REPO_DIR="$HOME/mud"
  else
    echo "[deploy] error: REPO_DIR not set and neither \$HOME/MUD nor \$HOME/mud exists" >&2
    exit 1
  fi
fi

cd "$REPO_DIR"

TAG="${TAG:-prod}"
REGISTRY="${REGISTRY:-ghcr.io/${REPO_OWNER:-cronix1000}}"
export TAG REGISTRY

echo "[deploy] tag=$TAG branch=${BRANCH:-main} repo=$REPO_DIR"

echo "[deploy] refresh repo"
git fetch --quiet origin
if ! git show-ref --verify --quiet "refs/heads/main"; then
  git branch --track main origin/main
fi
git reset --hard "origin/${BRANCH:-main}"

echo "[deploy] load .env (if present)"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# Backwards-compat: the simplified deploy (post-beta-removal) uses
# MUD_DATABASE_URL for everything. Older .env files carried
# MUD_DATABASE_URL_PROD / MUD_DATABASE_URL_BETA — fall back to PROD if so.
if [[ -z "${MUD_DATABASE_URL:-}" && -n "${MUD_DATABASE_URL_PROD:-}" ]]; then
  export MUD_DATABASE_URL="$MUD_DATABASE_URL_PROD"
  echo "[deploy] using MUD_DATABASE_URL_PROD for MUD_DATABASE_URL"
fi

echo "[deploy] pull images"
TAG="$TAG" REGISTRY="$REGISTRY" docker compose pull --ignore-pull-failures

echo "[deploy] bring stack up"
TAG="$TAG" REGISTRY="$REGISTRY" docker compose up -d --remove-orphans

echo "[deploy] force-recreate web containers (ensure newest :prod image is active)"
TAG="$TAG" REGISTRY="$REGISTRY" docker compose up -d --force-recreate --no-deps mud-admin mud-client

echo "[deploy] reload caddy (picks up Caddyfile changes; --no-deps avoids recreating the upstream network)"
TAG="$TAG" REGISTRY="$REGISTRY" docker compose restart --no-deps caddy

echo "[deploy] summary"
TAG="$TAG" REGISTRY="$REGISTRY" docker compose ps

echo "[deploy] prune old images"
docker image prune -f >/dev/null || true

echo "[deploy] done"

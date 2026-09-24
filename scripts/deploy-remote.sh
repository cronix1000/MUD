#!/usr/bin/env bash
#
# deploy-remote.sh — run on the target host by GitHub Actions over SSH.
#
# args:
#   $1 profile name: "prod" or "beta"
#   $2 image tag:   defaults to "latest"
#
# Pre-requisites on the host:
#   * docker + docker compose plugin installed
#   * user is in the docker group (or use sudo)
#   * repo cloned at $REPO_DIR (default ~/mud)
#   * an .env file at $REPO_DIR/.env that matches the profile
#
set -euo pipefail

PROFILE="${1:-prod}"
TAG="${2:-latest}"
REPO_DIR="${REPO_DIR:-$HOME/mud}"

case "$PROFILE" in
  prod) COMPOSE_FLAGS="--profile prod" ;;
  beta) COMPOSE_FLAGS="--profile beta" ;;
  *)
    echo "usage: $0 {prod|beta} [tag]" >&2
    exit 64
    ;;
esac

cd "$REPO_DIR"

echo "[deploy] profile=$PROFILE tag=$TAG repo=$REPO_DIR"

echo "[deploy] refresh repo"
git fetch --quiet origin
git reset --hard "origin/main"

echo "[deploy] load .env (if present)"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

REGISTRY="${REGISTRY:-ghcr.io/${REPO_OWNER:-cronix1000}}"
export TAG REGISTRY

echo "[deploy] pull images"
TAG="$TAG" REGISTRY="$REGISTRY" docker compose $COMPOSE_FLAGS pull --ignore-pull-failures

echo "[deploy] bring stack up"
TAG="$TAG" REGISTRY="$REGISTRY" docker compose $COMPOSE_FLAGS up -d --remove-orphans

echo "[deploy] summary"
TAG="$TAG" REGISTRY="$REGISTRY" docker compose $COMPOSE_FLAGS ps

echo "[deploy] prune old images"
docker image prune -f >/dev/null || true

echo "[deploy] done"

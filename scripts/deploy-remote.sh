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
#   * repo cloned at $REPO_DIR (default ~/MUD on the prod VPS)
#   * an .env file at $REPO_DIR/.env that matches the profile
#
set -euo pipefail

PROFILE="${1:-prod}"
TAG="${2:-latest}"

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

case "$PROFILE" in
  prod) BRANCH="${BRANCH:-main}";     COMPOSE_FLAGS="--profile prod" ;;
  beta) BRANCH="${BRANCH:-beta}";     COMPOSE_FLAGS="--profile beta" ;;
  *)
    echo "usage: $0 {prod|beta} [tag]" >&2
    exit 64
    ;;
esac

cd "$REPO_DIR"

echo "[deploy] profile=$PROFILE tag=$TAG branch=$BRANCH repo=$REPO_DIR"

echo "[deploy] refresh repo"
git fetch --quiet origin
# Make sure the branch exists locally; create it tracking origin if not.
if ! git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git branch --track "$BRANCH" "origin/$BRANCH"
fi
git reset --hard "origin/$BRANCH"

echo "[deploy] load .env (if present)"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

REGISTRY="${REGISTRY:-ghcr.io/${REPO_OWNER:-cronix1000}}"
export TAG REGISTRY

echo "[deploy] port sanity check (beta vs prod)"
# Both profiles run on the same VPS in this repo, so BETA_*_PORT must not
# collide with the corresponding prod host port.
declare -a CONFLICTS=()
check_port() {
  local name="$1" beta_var="$2" prod_var="$3"
  local beta_val="${!beta_var:-}" prod_val="${!prod_var:-}"
  if [[ -n "$beta_val" && -n "$prod_val" && "$beta_val" == "$prod_val" ]]; then
    CONFLICTS+=("$beta_var=$beta_val conflicts with $prod_var=$prod_val")
  fi
}
check_port "HTTPS"  "BETA_HTTPS_PORT"  "HTTPS_PORT"
check_port "HTTP"   "BETA_HTTP_PORT"   "HTTP_PORT"
check_port "Gateway" "BETA_GATEWAY_PORT" "GATEWAY_PORT"
if (( ${#CONFLICTS[@]} > 0 )); then
  echo "[deploy] ERROR: beta/prod port collision:" >&2
  for c in "${CONFLICTS[@]}"; do echo "  - $c" >&2; done
  echo "[deploy] Fix .env so BETA_*_PORT differs from the prod port." >&2
  exit 1
fi

echo "[deploy] pull images"
TAG="$TAG" REGISTRY="$REGISTRY" docker compose $COMPOSE_FLAGS pull --ignore-pull-failures

echo "[deploy] bring stack up"
TAG="$TAG" REGISTRY="$REGISTRY" docker compose $COMPOSE_FLAGS up -d --remove-orphans

echo "[deploy] summary"
TAG="$TAG" REGISTRY="$REGISTRY" docker compose $COMPOSE_FLAGS ps

echo "[deploy] prune old images"
docker image prune -f >/dev/null || true

echo "[deploy] done"

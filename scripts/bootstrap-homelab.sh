#!/usr/bin/env bash
#
# bootstrap-homelab.sh — first-time setup for a homelab running the MUD stack
# from prebuilt GHCR images.
#
# What it does:
#   1. Verifies docker + docker compose plugin are installed.
#   2. Clones the repo into ~/mud (or pulls if it already exists).
#   3. Writes a starter ~/mud/.env for the beta profile (you fill in real values).
#   4. Logs into ghcr.io with a PAT (read:packages scope).
#   5. Pulls the latest images and brings the beta stack up.
#
# Usage:
#   ./scripts/bootstrap-homelab.sh            # full run, interactive prompts
#   GHCR_PAT=ghp_xxx ./scripts/bootstrap-homelab.sh   # non-interactive login
#
# Re-runnable: existing repos/.envs are reused; docker compose up is idempotent.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/cronix1000/MUD.git}"
REPO_DIR="${REPO_DIR:-$HOME/mud}"
PROFILE="${PROFILE:-beta}"
REGISTRY="${REGISTRY:-ghcr.io/cronix1000}"

log() { printf '[bootstrap] %s\n' "$*"; }

require() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "missing required tool: $1" >&2
        exit 1
    fi
}

require docker
if ! docker compose version >/dev/null 2>&1; then
    echo "docker compose plugin not found; install 'docker-compose-plugin' or Docker Desktop" >&2
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo "docker daemon unreachable; start Docker or add your user to the docker group" >&2
    exit 1
fi

if [ ! -d "$REPO_DIR/.git" ]; then
    log "cloning $REPO_URL to $REPO_DIR"
    mkdir -p "$(dirname "$REPO_DIR")"
    git clone "$REPO_URL" "$REPO_DIR"
else
    log "repo already exists at $REPO_DIR; fetching latest"
    git -C "$REPO_DIR" fetch --quiet origin
    git -C "$REPO_DIR" reset --hard "origin/main"
fi

cd "$REPO_DIR"

if [ ! -f .env ]; then
    log "writing starter .env (edit values before relying on it)"
    cat > .env <<'EOF'
# ~/mud/.env — beta profile
# Replace CHANGE_ME entries with real values for your homelab.
BETA_DOMAIN=beta.example.com
BETA_HTTP_PORT=8080
BETA_HTTPS_PORT=8443
BETA_GATEWAY_PORT=9443
BETA_WS_URL=ws://beta.example.com:8443/ws
TZ=UTC
LOG_LEVEL=info
IDLE_TIMEOUT_S=1800
EOF
    chmod 600 .env
    echo
    echo ">>> wrote $REPO_DIR/.env with placeholder values" >&2
    echo ">>> edit it now if you want to override ports/domain" >&2
fi

if [ -n "${GHCR_PAT:-}" ]; then
    log "logging into ghcr.io"
    echo "$GHCR_PAT" | docker login ghcr.io -u cronix1000 --password-stdin
elif ! docker login ghcr.io --get-login >/dev/null 2>&1; then
    cat >&2 <<'EOF'

>>> not logged into ghcr.io.
>>> Either:
>>>   1. export GHCR_PAT=<token with read:packages> and rerun this script, or
>>>   2. mark the four packages public on github.com/orgs/cronix1000/packages
>>>      (Settings -> Danger zone -> Change visibility) and ignore this step.
EOF
    exit 1
fi

log "pulling $PROFILE images from $REGISTRY"
TAG="$PROFILE" REGISTRY="$REGISTRY" docker compose "--profile=$PROFILE" pull --ignore-pull-failures

log "starting $PROFILE stack"
TAG="$PROFILE" REGISTRY="$REGISTRY" docker compose "--profile=$PROFILE" up -d --remove-orphans

log "stack status"
TAG="$PROFILE" REGISTRY="$REGISTRY" docker compose "--profile=$PROFILE" ps

log "done. logs: docker compose --profile $PROFILE logs -f mud-server-beta"

cat <<'EOF'

>>> Subsequent deploys:
>>>   cd ~/mud && git pull && TAG=beta REGISTRY=ghcr.io/cronix1000 \
>>>     docker compose --profile beta pull && \
>>>     TAG=beta REGISTRY=ghcr.io/cronix1000 \
>>>     docker compose --profile beta up -d --force-recreate --remove-orphans
>>> or just rerun this script — it always fast-forwards to origin/main.
EOF

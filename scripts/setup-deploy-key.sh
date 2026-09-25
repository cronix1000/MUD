#!/bin/bash
# setup-deploy-key.sh
#
# One-shot helper to:
#   1. Generate a fresh ed25519 key on the VPS for GitHub Actions.
#   2. Append the public key to ~/.ssh/authorized_keys.
#   3. Print the private key so you can paste it into the
#      PROD_SSH_KEY GitHub Secret (Settings -> Secrets and variables ->
#      Actions -> PROD_SSH_KEY -> Update).
#
# Run on the VPS as the user that GitHub Actions will log in as.

set -euo pipefail

KEY_PATH="${HOME}/.ssh/gh_mud_prod"

mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"

if [ ! -f "${KEY_PATH}" ]; then
  ssh-keygen -t ed25519 -C "gha-deploy-prod" -f "${KEY_PATH}" -N ""
else
  echo "Key already exists at ${KEY_PATH}, reusing"
fi

if ! grep -q "gha-deploy-prod" "${HOME}/.ssh/authorized_keys" 2>/dev/null; then
  cat "${KEY_PATH}.pub" >> "${HOME}/.ssh/authorized_keys"
  echo "Public key added to authorized_keys"
else
  echo "Public key already in authorized_keys"
fi
chmod 600 "${HOME}/.ssh/authorized_keys"

echo
echo "================================================================"
echo "Private key for PROD_SSH_KEY GitHub Secret:"
echo "================================================================"
cat "${KEY_PATH}"
echo
echo "================================================================"
echo "Paste the lines above (including BEGIN/END markers) into:"
echo "  https://github.com/cronix1000/MUD/settings/secrets/actions/PROD_SSH_KEY"
echo "================================================================"

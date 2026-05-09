#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "==> git pull"
GIT_SSH_COMMAND="ssh -i /root/.ssh/teetimes_deploy -o IdentitiesOnly=yes" git pull --ff-only

echo "==> npm ci"
npm ci

echo "==> prisma migrate deploy"
npx prisma migrate deploy

echo "==> next build"
npm run build

echo "==> restart service"
systemctl restart teetimes

echo "==> done"
systemctl is-active teetimes

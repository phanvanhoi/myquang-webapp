#!/usr/bin/env bash
# Chạy trên máy DEV (mạng ổn) — đóng gói node_modules upload lên VPS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm ci --omit=dev
mkdir -p vendor
tar -czf vendor/node_modules.tar.gz node_modules
ls -lh vendor/node_modules.tar.gz

cat <<EOF

Upload lên VPS:
  scp vendor/node_modules.tar.gz root@IP_VPS:~/myquang-webapp/vendor/node_modules.tar.gz

Trên VPS:
  cd ~/myquang-webapp
  git pull origin master
  bash scripts/install-deps.sh
  docker compose build && docker compose up -d --force-recreate

EOF

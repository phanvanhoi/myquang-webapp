#!/usr/bin/env bash
# Chạy MyQuang trực tiếp trên VPS (không Docker) — dùng khi docker build vẫn kẹt.
# DB: copy từ container cũ hoặc dùng ./data/myquang.db
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "ERROR: Thiếu file .env"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${SECRET_KEY:-}" ]]; then
  echo "ERROR: SECRET_KEY trống trong .env"
  exit 1
fi

echo "==> git pull"
git pull origin master

mkdir -p data

if docker compose ps -q myquang 2>/dev/null | grep -q .; then
  echo "==> Copy DB từ container Docker sang ./data/"
  docker compose exec -T myquang cp /data/myquang.db /data/myquang.db.bak-host || true
  docker cp myquang-app:/data/myquang.db ./data/myquang.db 2>/dev/null || true
  echo "==> Dừng container Docker (giải phóng port 3001)"
  docker compose stop myquang || true
fi

echo "==> npm ci"
bash "$ROOT/scripts/install-deps.sh"

export NODE_ENV=production
export PORT=3001
export DB_PATH="$ROOT/data/myquang.db"
export TZ='<+07>-7'

echo "==> Khởi động app (Ctrl+C để dừng). Production nên dùng pm2:"
echo "    pm2 start src/server.js --name myquang --cwd $ROOT"
echo ""
exec node src/server.js

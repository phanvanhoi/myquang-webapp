#!/usr/bin/env bash
# Deploy an toàn trên VPS — không xóa volume DB.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "ERROR: Thiếu file .env (copy từ .env.example và set SECRET_KEY)."
  exit 1
fi

if ! grep -q '^SECRET_KEY=.\+' .env 2>/dev/null; then
  echo "ERROR: SECRET_KEY chưa được set trong .env"
  exit 1
fi

echo "==> Backup DB (nếu container đang chạy)"
if docker compose ps --status running --services 2>/dev/null | grep -q myquang; then
  docker compose exec -T myquang cp /data/myquang.db "/data/myquang.db.bak-$(date +%F-%H%M)" || true
fi

echo "==> git pull"
git pull origin master

echo "==> docker compose up -d --build"
docker compose up -d --build

echo "==> Logs (20 dòng cuối)"
docker compose logs --tail=20 myquang

echo "==> Audit payments (read-only)"
docker compose exec -T myquang node scripts/audit-payments.js || true

echo "Done. App: http://<host>:3001"

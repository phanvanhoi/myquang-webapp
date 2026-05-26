#!/usr/bin/env bash
# Deploy an toàn trên VPS — không xóa volume DB.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]] || ! grep -q '^SECRET_KEY=.\+' .env 2>/dev/null; then
  echo "ERROR: Thiếu .env hoặc SECRET_KEY chưa được set (xem .env.example)."
  exit 1
fi

echo "==> Backup DB (nếu container đang chạy)"
if docker compose ps -q myquang 2>/dev/null | grep -q .; then
  docker compose exec -T myquang cp /data/myquang.db "/data/myquang.db.bak-$(date +%F-%H%M)" || true
fi

echo "==> git pull"
git pull origin master

echo "==> docker compose up -d --build"
docker compose up -d --build

echo "==> Migrate DB (ban ao, read-only dry schema)"
docker compose exec -T myquang node src/migrate-virtual-tables.js || true

echo "==> Logs (20 dòng cuối)"
docker compose logs --tail=20 myquang

echo "==> Audit payments (read-only)"
docker compose exec -T myquang node scripts/audit-payments.js || true

echo "Done. App: http://<host>:3001"

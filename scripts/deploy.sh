#!/usr/bin/env bash
# Deploy an toàn trên VPS — không xóa volume DB.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

if [[ ! -f .env ]] || ! grep -q '^SECRET_KEY=.\+' .env 2>/dev/null; then
  echo "ERROR: Thiếu .env hoặc SECRET_KEY chưa được set (xem .env.example)."
  exit 1
fi

npm_ci_on_host() {
  bash "$ROOT/scripts/install-deps.sh"
}

echo "==> Backup DB (nếu container đang chạy)"
if docker compose ps -q myquang 2>/dev/null | grep -q .; then
  docker compose exec -T myquang cp /data/myquang.db "/data/myquang.db.bak-$(date +%F-%H%M)" || true
fi

echo "==> git pull"
git pull origin master

if ! grep -q "gioi-thieu" src/server.js 2>/dev/null; then
  echo "ERROR: src/server.js chưa có route /gioi-thieu — git pull thất bại hoặc sai branch."
  exit 1
fi

npm_ci_on_host

if [[ ! -f node_modules/express/package.json ]]; then
  echo "ERROR: npm ci không tạo được node_modules."
  exit 1
fi

echo "==> docker compose build + force recreate"
docker compose build
docker compose up -d --force-recreate

echo "==> Kiểm tra code trong container"
if ! docker compose exec -T myquang test -f src/routes/intro.js; then
  echo "ERROR: Container thiếu src/routes/intro.js — image chưa chứa code mới."
  exit 1
fi
if ! docker compose exec -T myquang grep -q "gioi-thieu" src/server.js; then
  echo "ERROR: Container thiếu route /gioi-thieu trong src/server.js."
  exit 1
fi

echo "==> Kiểm tra HTTP /gioi-thieu"
sleep 2
HTTP_CODE="$(curl -sf -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/gioi-thieu || echo 000)"
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "WARN: /gioi-thieu trả ${HTTP_CODE} (kỳ vọng 200) — xem logs bên dưới."
fi

echo "==> Migrate DB (ban ao, read-only dry schema)"
docker compose exec -T myquang node src/migrate-virtual-tables.js || true

echo "==> Migrate DB (QR gọi món tại bàn)"
docker compose exec -T myquang node src/migrate-table-qr.js || true

echo "==> Logs (20 dòng cuối)"
docker compose logs --tail=20 myquang

echo "==> Audit payments (read-only)"
docker compose exec -T myquang node scripts/audit-payments.js || true

echo "Done. App: http://<host>:3001/gioi-thieu"

#!/usr/bin/env bash
# Cài node_modules trên VPS — thử nhiều cách khi npm registry/DNS Docker bị chậm.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

try_host_npm() {
  command -v npm >/dev/null 2>&1 || return 1
  echo "==> npm ci trên host (DNS trực tiếp, không qua Docker bridge)"
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=512}"
  npm ci --omit=dev --loglevel=info
}

try_docker_npm() {
  local registry="${1:-}"
  local label="${2:-npmjs.org}"
  echo "==> npm ci qua Docker --network=host (registry: ${label})"
  local reg_env=()
  if [[ -n "$registry" ]]; then
    reg_env=(-e "NPM_CONFIG_REGISTRY=${registry}")
  fi
  docker run --rm --network=host \
    -v "$ROOT:/app" -w /app \
    -e NODE_OPTIONS=--max-old-space-size=384 \
    "${reg_env[@]}" \
    node:24-alpine \
    sh -c 'set -eux
      for attempt in 1 2 3; do
        echo "==> npm ci attempt ${attempt}/3"
        npm ci --omit=dev --loglevel=info && exit 0
        echo "==> thất bại, chờ 25s..."
        sleep 25
      done
      npm install --omit=dev --loglevel=info'
}

extract_vendor() {
  if [[ -f vendor/node_modules.tar.gz ]]; then
    echo "==> Giải nén vendor/node_modules.tar.gz (upload từ máy dev)"
    rm -rf node_modules
    tar -xzf vendor/node_modules.tar.gz -C .
    return 0
  fi
  return 1
}

preflight_network() {
  echo "==> Kiểm tra mạng tới npm registry..."
  if curl -sf --max-time 15 -o /dev/null https://registry.npmjs.org/; then
    echo "    OK: registry.npmjs.org"
    return 0
  fi
  echo "    WARN: registry.npmjs.org chậm/timeout — sẽ thử mirror"
  return 1
}

if [[ -f node_modules/express/package.json ]] && [[ "${FORCE_NPM_CI:-}" != "1" ]]; then
  echo "==> node_modules đã có — bỏ qua npm ci (FORCE_NPM_CI=1 để cài lại)"
  exit 0
fi

if extract_vendor; then
  exit 0
fi

preflight_network || true

if try_host_npm; then exit 0; fi

if try_docker_npm "" "npmjs.org"; then exit 0; fi

if try_docker_npm "https://registry.npmmirror.com" "npmmirror.com"; then exit 0; fi

cat <<'EOF'

ERROR: Không cài được node_modules trên VPS (mạng/DNS npm bị chặm).

Cách B — upload từ máy có mạng tốt (máy dev / PC):

  # Trên máy dev (trong thư mục myquang-webapp):
  npm ci --omit=dev
  tar -czf node_modules.tar.gz node_modules
  scp node_modules.tar.gz root@IP_VPS:~/myquang-webapp/vendor/node_modules.tar.gz

  # Trên VPS:
  mkdir -p vendor
  bash scripts/install-deps.sh
  bash scripts/deploy.sh

Cách C — chạy không Docker:
  bash scripts/deploy-host.sh

EOF
exit 1

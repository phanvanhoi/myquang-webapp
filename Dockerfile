FROM node:24-alpine

WORKDIR /app

# Giờ VN cố định UTC+7 (không DST). Offset POSIX để musl/SQLite localtime đúng
# mà không cần `apk add tzdata` — tránh build fail khi DNS/mirror Alpine lỗi tạm thời.
ENV TZ=<+07>-7
ENV NODE_ENV=production
# VPS RAM thấp: giới hạn heap npm install để tránh OOM → "Exit handler never called!"
ENV NODE_OPTIONS=--max-old-space-size=384

# Copy package files and install dependencies
COPY package*.json .npmrc ./
RUN set -eux; \
    for attempt in 1 2 3 4 5; do \
      echo "==> npm ci attempt ${attempt}/5"; \
      npm ci --omit=dev && exit 0; \
      echo "==> npm ci failed, retry in 20s..."; \
      sleep 20; \
    done; \
    echo "==> npm ci exhausted, fallback npm install"; \
    npm install --omit=dev

# Copy application source
COPY src/ ./src/
COPY app/ ./app/
COPY scripts/ ./scripts/

# Create data directory for SQLite database
RUN mkdir -p /data

EXPOSE 8000

ENV PORT=8000
ENV DB_PATH=/data/myquang.db

CMD ["node", "src/server.js"]

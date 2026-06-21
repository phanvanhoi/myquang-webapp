FROM node:24-alpine

WORKDIR /app

# Giờ VN cố định UTC+7 (không DST). Offset POSIX để musl/SQLite localtime đúng
# mà không cần `apk add tzdata` — tránh build fail khi DNS/mirror Alpine lỗi tạm thời.
ENV TZ=<+07>-7

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY src/ ./src/
COPY app/ ./app/
COPY scripts/ ./scripts/

# Create data directory for SQLite database
RUN mkdir -p /data

EXPOSE 8000

ENV NODE_ENV=production
ENV PORT=8000
ENV DB_PATH=/data/myquang.db

CMD ["node", "src/server.js"]

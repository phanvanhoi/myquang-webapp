FROM node:24-alpine

WORKDIR /app

ENV TZ=<+07>-7
ENV NODE_ENV=production

# node_modules do deploy.sh cài sẵn trên host (Alpine container tạm) — không chạy npm
# trong docker build để tránh kẹt/OOM trên VPS RAM thấp.
COPY package*.json .npmrc ./
COPY node_modules ./node_modules
RUN test -f node_modules/express/package.json \
    || (echo "ERROR: Thiếu node_modules — chạy bash scripts/deploy.sh" && exit 1)

COPY src/ ./src/
COPY app/ ./app/
COPY scripts/ ./scripts/

RUN mkdir -p /data

EXPOSE 8000

ENV PORT=8000
ENV DB_PATH=/data/myquang.db

CMD ["node", "src/server.js"]

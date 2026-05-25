FROM node:24-alpine

WORKDIR /app

# tzdata: cần cho SQLite datetime('now','localtime') và Node Date trả đúng giờ VN.
# Alpine không bao gồm tz database mặc định.
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime && \
    echo "Asia/Ho_Chi_Minh" > /etc/timezone

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
ENV TZ=Asia/Ho_Chi_Minh

CMD ["node", "src/server.js"]

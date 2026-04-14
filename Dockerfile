FROM node:24-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY src/ ./src/
COPY app/ ./app/

# Create data directory for SQLite database
RUN mkdir -p /data

EXPOSE 8000

ENV NODE_ENV=production
ENV PORT=8000
ENV DB_PATH=/data/myquang.db

CMD ["node", "src/server.js"]

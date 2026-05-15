FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/

RUN npx prisma generate

EXPOSE 3001

ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3001/api/v1/health || exit 1

CMD ["sh", "-c", "npx prisma db push --accept-data-loss 2>&1 | tail -3; echo '---'; node_modules/.bin/tsx src/index.ts"]

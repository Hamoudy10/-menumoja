FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY backend/package*.json ./
# Copy the Prisma schema BEFORE npm ci — the postinstall hook runs
# `prisma generate` and needs prisma/schema.prisma present.
COPY backend/prisma/ ./prisma/
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src/ ./src/

RUN npx prisma generate

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/v1/health || exit 1

CMD ["node_modules/.bin/tsx", "src/index.ts"]

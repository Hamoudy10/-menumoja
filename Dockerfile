FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src/ ./src/
COPY backend/prisma/ ./prisma/

RUN npx prisma generate
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]

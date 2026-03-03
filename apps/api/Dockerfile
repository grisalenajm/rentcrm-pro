FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

RUN npm ci --omit=dev

COPY apps/api/prisma ./apps/api/prisma/
COPY apps/api/prisma.config.ts ./apps/api/
COPY apps/api/dist ./apps/api/dist/

WORKDIR /app/apps/api

RUN ../node_modules/.bin/prisma generate

EXPOSE 3001

CMD ["node", "dist/main.js"]

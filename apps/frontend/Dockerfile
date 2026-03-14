FROM node:20-alpine

WORKDIR /app

COPY node_modules ./node_modules/
COPY apps/frontend/node_modules ./node_modules/
COPY apps/frontend/src ./src/
COPY apps/frontend/public ./public/
COPY apps/frontend/index.html ./
COPY apps/frontend/package.json ./
COPY apps/frontend/vite.config.ts ./
COPY apps/frontend/tsconfig*.json ./
COPY apps/frontend/.env ./.env

EXPOSE 3000

CMD ["node", "node_modules/.bin/vite", "--host", "0.0.0.0"]

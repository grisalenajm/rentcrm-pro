FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY dist ./dist/

RUN npx prisma generate

EXPOSE 3001

CMD ["node", "dist/main.js"]

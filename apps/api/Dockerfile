FROM node:20-alpine

WORKDIR /app

COPY apps/api/dist ./dist/
COPY apps/api/node_modules ./node_modules/
COPY apps/api/package.json ./

EXPOSE 3001

CMD ["node", "dist/src/main.js"]

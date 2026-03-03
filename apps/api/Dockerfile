FROM node:20-alpine

WORKDIR /app

# Solo copiamos el dist compilado y las dependencias ya instaladas
COPY apps/api/dist ./dist/
COPY apps/api/node_modules ./node_modules/
COPY apps/api/package.json ./

EXPOSE 3001

CMD ["node", "dist/main.js"]

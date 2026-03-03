FROM node:20-alpine

WORKDIR /app

# Copiar solo los package files primero (cache layer)
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --only=production

# Instalar prisma separado (necesario para generate)
RUN npm install prisma @prisma/client @prisma/adapter-pg --no-save

# Copiar el resto
COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY dist ./dist/

# Generar cliente Prisma
RUN npx prisma generate

EXPOSE 3001

CMD ["node", "dist/main.js"]

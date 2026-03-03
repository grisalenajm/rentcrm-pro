FROM node:20-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

# Generar cliente Prisma
RUN npx prisma generate

# Compilar
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/main.js"]

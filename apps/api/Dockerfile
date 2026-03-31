# ---- Stage 1: Builder ----
FROM node:22-alpine AS builder
WORKDIR /app/apps/api

# Copy only API package manifests (no frontend deps)
COPY apps/api/package.json ./
COPY package-lock.json ./

# Install only API dependencies
RUN npm install
RUN ls node_modules/.bin/ | grep prisma || echo "prisma not found"

# Copy API source
COPY apps/api/ ./

# Generate Prisma client
RUN ./node_modules/.bin/prisma generate --schema=prisma/schema.prisma

# Compile TypeScript via NestJS CLI
RUN npm run build


# ---- Stage 2: Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

# Copy node_modules and compiled output from builder
COPY --from=builder /app/apps/api/node_modules ./node_modules/
COPY --from=builder /app/apps/api/dist ./dist/

# Copy Prisma schema and migrations (needed by prisma migrate deploy at startup)
COPY --from=builder /app/apps/api/prisma ./prisma/

EXPOSE 3001

# Run migrations before starting the server.
# DATABASE_URL must be provided at runtime via docker-compose environment.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/main"]

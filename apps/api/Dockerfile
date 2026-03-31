# ---- Stage 1: Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

# Install all dependencies (devDeps required for nest build and prisma generate)
RUN npm install --ignore-scripts=false

# Copy API source
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN ./node_modules/.bin/prisma generate --schema=apps/api/prisma/schema.prisma

# Compile TypeScript via NestJS CLI
RUN npm run build --workspace=apps/api


# ---- Stage 2: Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

# Copy node_modules from builder:
#   - hoisted monorepo deps (includes prisma CLI and generated @prisma/client)
#   - workspace-level non-hoisted deps
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules/

# Copy compiled output (dist/main.js is the entrypoint)
COPY --from=builder /app/apps/api/dist ./dist/

# Copy Prisma schema and migrations (needed by prisma migrate deploy at startup)
COPY --from=builder /app/apps/api/prisma ./prisma/

EXPOSE 3001

# Run migrations before starting the server.
# DATABASE_URL must be provided at runtime via docker-compose environment.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/main"]

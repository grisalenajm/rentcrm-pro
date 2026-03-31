# ---- Stage 1: Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Copy manifests
COPY apps/frontend/package.json ./
COPY package-lock.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source
COPY apps/frontend/ ./

# Build static output
RUN npm run build


# ---- Stage 2: Runner ----
FROM nginx:alpine AS runner

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing: fallback to index.html for all routes
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location /api {\n\
        proxy_pass http://api:3001;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
    }\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

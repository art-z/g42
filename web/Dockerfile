# --- build ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY app/package.json app/package-lock.json* ./app/
RUN cd app && npm ci

COPY app ./app
RUN cd app && npm run build

# --- nginx ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/nginx.conf

COPY --from=builder /app/app/dist /usr/share/nginx/html

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Vite bakes these into the bundle at build time, so they must be ARGs here.
# Pass them with --build-arg or set them as Railway build variables.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_BASE_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: serve ───────────────────────────────────────────────────────────
FROM nginx:alpine

# Copy the production bundle
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config template — $PORT is substituted at container start by envsubst
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

# Railway injects $PORT; envsubst replaces only $PORT so nginx variables like
# $uri are left untouched. Falls back to 80 for local testing.
CMD ["/bin/sh", "-c", \
  "export PORT=${PORT:-80} && \
   envsubst '$PORT' < /etc/nginx/templates/default.conf.template \
     > /etc/nginx/conf.d/default.conf && \
   nginx -g 'daemon off;'"]

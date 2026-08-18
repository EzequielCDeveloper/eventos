# Multi-stage production Dockerfile for the FiestaExpert SPA (UR-006.7, D-010).
#
# Stage 1 ("build")  — install deps and compile with Vite. VITE_* values are
#                      injected as build args so import.meta.env sees them at
#                      build time (UR-005.2). Leave them empty to build a
#                      same-origin bundle that talks to /api via Nginx.
# Stage 2 ("production") — nginx:alpine serving the static dist.
#
# In the compose stack the Nginx *service* mounts ./frontend/dist, so this
# image is primarily used to (a) verify the build in CI and (b) export the
# dist to the host in scripts/deploy.sh.

# ---- build ------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_API_URL=
ARG VITE_CONEKTA_PUBLIC_KEY=
ARG VITE_AGORA_APP_ID=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_CONEKTA_PUBLIC_KEY=$VITE_CONEKTA_PUBLIC_KEY \
    VITE_AGORA_APP_ID=$VITE_AGORA_APP_ID

# tsc --noEmit && vite build → dist/ (package.json "build").
RUN npm run build

# ---- production --------------------------------------------------------------
FROM nginx:alpine AS production
# Static bundle only; the real Nginx config lives at the repo root and is
# mounted by docker-compose.yml (SPA fallback, proxies, security headers).
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

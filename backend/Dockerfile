# Multi-stage production Dockerfile (UR-006.7, D-010).
#
# Stage 1 ("build")  — install all deps, generate the Prisma client and
#                      compile TypeScript to dist/.
# Stage 2 ("production") — lean runtime with the compiled output, the Prisma
#                      client (generated in stage 1) and a non-root user.
#
# The runtime keeps devDependencies because `prisma migrate deploy` is run
# from inside the container by scripts/deploy.sh (D-010). Optimization
# (npm prune --omit=dev) is a documented follow-up.

# ---- build ------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
# Native-module toolchain (bcrypt) in case a musl prebuild is unavailable.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
# Generate @prisma/client into node_modules/.prisma (D-001).
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
# tsc -p tsconfig.json → dist/ (outDir dist, rootDir src).
RUN npm run build

# ---- production --------------------------------------------------------------
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# Tini as PID 1 so SIGTERM (graceful shutdown, BR-014.5) is delivered to node.
RUN apk add --no-cache tini
# Non-root user (UR-006.7).
RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --chown=app:app package.json ./

USER app
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]

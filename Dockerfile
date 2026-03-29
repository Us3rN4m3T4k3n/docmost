FROM node:22-alpine AS base
LABEL org.opencontainers.image.source="https://github.com/docmost/docmost"

FROM base AS builder

WORKDIR /app

COPY . .

RUN npm install -g pnpm@10.4.0
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM base AS installer

RUN apk add --no-cache curl bash su-exec

WORKDIR /app

# Copy apps
COPY --from=builder /app/apps/server/dist /app/apps/server/dist
COPY --from=builder /app/apps/client/dist /app/apps/client/dist
COPY --from=builder /app/apps/server/package.json /app/apps/server/package.json
COPY --from=builder /app/apps/server/src/database /app/apps/server/src/database

# Copy packages
COPY --from=builder /app/packages/editor-ext/dist /app/packages/editor-ext/dist
COPY --from=builder /app/packages/editor-ext/package.json /app/packages/editor-ext/package.json

# Copy root package files
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm*.yaml /app/

# Copy patches
COPY --from=builder /app/patches /app/patches

RUN npm install -g pnpm@10.4.0

RUN chown -R node:node /app

USER node

RUN pnpm install --frozen-lockfile

# Pre-create the storage directory as node so local dev works out of the box.
# On Railway the volume is mounted here at container start; the CMD below
# runs chmod to ensure the node process can always write to it.
RUN mkdir -p /app/data/storage

# Switch back to root so CMD can fix volume permissions at startup
USER root

EXPOSE 8080

# Make the storage directory world-writable (handles Railway volume mounts owned
# by root), then drop back to the node user to run the server.
CMD ["sh", "-c", "chmod -R 777 /app/data/storage 2>/dev/null || true && su-exec node pnpm --filter server start:prod"]

#!/bin/sh
set -e

# Railway mounts the volume at container start, which may be owned by root.
# Fix ownership before switching to the node user so uploads can succeed.
mkdir -p /app/data/storage
chown -R node:node /app/data/storage

exec su-exec node pnpm --filter server start:prod

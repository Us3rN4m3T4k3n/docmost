#!/bin/sh
set -e

# Railway mounts the volume at container start time (after image build), so the
# node user may not have write access. Fix ownership before dropping privileges.
mkdir -p /app/data/storage
chown -R node:node /app/data/storage 2>/dev/null || chmod -R 777 /app/data/storage

# If Railway (or another caller) passes arguments (e.g. preDeployCommand), forward them.
# Otherwise fall back to the default server start command.
if [ $# -gt 0 ]; then
  exec /sbin/su-exec node "$@"
fi

exec /sbin/su-exec node pnpm --filter server start:prod

---
phase: 05-railway-production-deployment
plan: 01
subsystem: infra
tags: [railway, docker, migrations, kysely, s3, cloudflare-r2, stripe, webhooks]

# Dependency graph
requires:
  - phase: 04-stripe-billing-and-account-provisioning
    provides: Stripe webhook endpoint and billing provisioning logic that must be deployed
provides:
  - railway.json with migration-first start command (runs Kysely migrations on every deploy)
  - Main service deployed at https://client-production-dba5.up.railway.app
affects:
  - 05-02-collab-service

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration-first start command: pnpm migration:latest && pnpm start:prod ensures schema is always up to date before traffic"

key-files:
  created: []
  modified:
    - railway.json

key-decisions:
  - "Migration-first start command: chain migration:latest before start:prod so Railway deploys always run pending Kysely migrations automatically"

patterns-established:
  - "Railway startCommand pattern: always run migrations before server start for zero-downtime schema evolution"

requirements-completed: [DEPLOY-01, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06]

# Metrics
duration: 1min
completed: 2026-03-21
---

# Phase 05 Plan 01: Railway Main Service Deployment Summary

**railway.json updated with migration-first start command; Railway env vars configured and main service deployed at https://client-production-dba5.up.railway.app**

## Performance

- **Duration:** ~1 min (automated) + human setup time
- **Started:** 2026-03-21T15:26:17Z
- **Completed:** 2026-03-21T15:26:49Z
- **Tasks:** 1 automated + 1 human-action checkpoint
- **Files modified:** 1

## Accomplishments
- Updated railway.json startCommand to include `pnpm --filter server migration:latest` before `start:prod`
- Kysely DB migrations now run automatically on every Railway deploy (zero-downtime schema evolution)
- All Railway environment variables (PostgreSQL, Redis, R2 S3, Stripe, Kiwify, App) configured by human operator
- Main service deployed, health checks passing, SPA routing confirmed, Stripe webhook delivering

## Task Commits

Each task was committed atomically:

1. **Task 1: Update railway.json start command to include migrations** - `44e8e91e` (chore)
2. **Task 2: Configure Railway environment variables and trigger deploy** - human-action checkpoint (no commit — Railway Dashboard operations)

**Plan metadata:** (docs commit — see final commit)

## Files Created/Modified
- `railway.json` - startCommand updated to run migrations before server start

## Decisions Made
- Migration-first start command: `pnpm --filter server migration:latest && pnpm --filter server start:prod` — ensures every Railway deploy runs pending Kysely migrations before accepting traffic. If no pending migrations exist, completes as no-op instantly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

Task 2 required manual Railway Dashboard configuration:

**Environment variables configured on main service:**
- APP_URL, APP_SECRET, JWT_TOKEN_EXPIRES_IN, NODE_ENV
- DATABASE_URL (Railway PostgreSQL addon reference)
- REDIS_URL (Railway Redis addon reference)
- STORAGE_DRIVER=s3, AWS_S3_ACCESS_KEY_ID, AWS_S3_SECRET_ACCESS_KEY, AWS_S3_BUCKET, AWS_S3_ENDPOINT, AWS_S3_REGION=auto, AWS_S3_FORCE_PATH_STYLE=true
- MAIL_DRIVER, MAIL_FROM_ADDRESS, MAIL_FROM_NAME
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- CLIENT_SPACE_ID, KIWIFY_WEBHOOK_TOKEN, KIWIFY_CLIENT_SPACE_ID

**Verification commands run by operator:**
- `curl -f https://client-production-dba5.up.railway.app/api/health/live` — returned "ok"
- `curl -f https://client-production-dba5.up.railway.app/api/health` — returned HTTP 200 JSON
- `curl -I https://client-production-dba5.up.railway.app/settings/account/profile` — returned HTTP 200 text/html
- Stripe Dashboard test webhook checkout.session.completed — returned 200

## Next Phase Readiness
- Main service live at https://client-production-dba5.up.railway.app
- S3 storage configured (full R2 upload/download verification in Plan 02)
- Ready for Plan 02: Collab service deployment (COLLAB_URL env var will be set after collab service created)

---
*Phase: 05-railway-production-deployment*
*Completed: 2026-03-21*

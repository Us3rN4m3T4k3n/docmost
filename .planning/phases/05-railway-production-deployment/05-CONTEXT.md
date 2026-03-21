# Phase 5: Railway Production Deployment - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the application (as-built through Phase 4) to Railway production. The existing Railway project at `client-production-dba5.up.railway.app` runs an old broken version — we need to commit and rebuild to deploy the current codebase. No new features. No code changes beyond deployment wiring.

</domain>

<decisions>
## Implementation Decisions

### Deployment trigger
- The repo is already connected to Railway. A `git push` to `main` triggers a rebuild.
- All deployment config is in `railway.json` (already present) + env vars set in Railway dashboard.

### Health check
- Railway's healthcheck is already configured in `railway.json` at `/api/health/live` (returns `'ok'` — no DB/Redis dependency).
- DEPLOY-05 requirement (`/api/health`) is satisfied by the existing `/api/health` full health check endpoint — both exist. Railway uses `/api/health/live`.
- No changes needed to health check endpoints.

### Static file serving + SPA routing
- Already fully implemented in `StaticModule` — NestJS serves `client/dist` via `@fastify/static`, catch-all returns `index.html` for all non-API routes.
- SPA routing on refresh works out of the box. No changes needed.

### Two Railway services (collab server)
- Add a **second service** in the same Railway project pointing to the same GitHub repo.
- Start command for the collab service: `pnpm --filter server collab:prod`
- Port: `COLLAB_PORT` env var (default 3001 — Railway will inject its own `PORT` env var for the second service, so set `COLLAB_PORT=$PORT` on the collab service).
- Railway gives the collab service its own public URL → set `COLLAB_URL=https://<collab-service-url>` on the **main service**.
- The main service does NOT need `COLLAB_PORT`.

### S3 file storage — Cloudflare R2
- Use Cloudflare R2 (S3-compatible).
- `STORAGE_DRIVER=s3`
- Required env vars on Railway:
  - `AWS_S3_ACCESS_KEY_ID` — R2 Access Key ID
  - `AWS_S3_SECRET_ACCESS_KEY` — R2 Secret Access Key
  - `AWS_S3_BUCKET` — R2 bucket name
  - `AWS_S3_ENDPOINT` — R2 endpoint URL (format: `https://<account-id>.r2.cloudflarestorage.com`)
  - `AWS_S3_REGION` — set to `auto` for R2
  - `AWS_S3_FORCE_PATH_STYLE` — set to `true` for R2

### Custom domain
- Use Railway's provided URL `https://client-production-dba5.up.railway.app` for now.
- Custom domain to be added post-launch without any code changes.

### All Railway env vars (main service)
Set these in the Railway dashboard for the main service:
```
APP_URL=https://client-production-dba5.up.railway.app
APP_SECRET=<existing value from .env>
JWT_TOKEN_EXPIRES_IN=30d
NODE_ENV=production
DATABASE_URL=<provided by Railway PostgreSQL addon>
REDIS_URL=<provided by Railway Redis addon>
STORAGE_DRIVER=s3
AWS_S3_ACCESS_KEY_ID=<R2 key>
AWS_S3_SECRET_ACCESS_KEY=<R2 secret>
AWS_S3_BUCKET=<bucket name>
AWS_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
AWS_S3_REGION=auto
AWS_S3_FORCE_PATH_STYLE=true
MAIL_DRIVER=<smtp or postmark>
MAIL_FROM_ADDRESS=<email>
MAIL_FROM_NAME=<name>
STRIPE_SECRET_KEY=<from .env>
STRIPE_WEBHOOK_SECRET=<from .env>
CLIENT_SPACE_ID=<from .env>
KIWIFY_WEBHOOK_TOKEN=<from .env>
KIWIFY_CLIENT_SPACE_ID=<from .env>
COLLAB_URL=https://<collab-service-railway-url>
```

### All Railway env vars (collab service)
```
NODE_ENV=production
COLLAB_PORT=$PORT
DATABASE_URL=<same as main service>
REDIS_URL=<same as main service>
APP_SECRET=<same as main service>
```

### Stripe webhook
- Webhook endpoint already registered in Stripe Dashboard: `https://client-production-dba5.up.railway.app/api/billing/stripe/webhook`
- `STRIPE_WEBHOOK_SECRET` already configured. No further action needed.

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Relevant source files
- `railway.json` — existing Railway build/deploy config (healthcheck, start command, Dockerfile builder)
- `Dockerfile` — multi-stage build producing server + client dist in one image
- `apps/server/src/main.ts` — app bootstrap, port binding (`0.0.0.0`), CORS, rawBody, excluded webhook paths
- `apps/server/src/collaboration/server/collab-main.ts` — collab server entrypoint, `COLLAB_PORT`
- `apps/server/src/integrations/static/static.module.ts` — static file serving + SPA catch-all (already implemented)
- `apps/server/src/integrations/health/health.controller.ts` — `/health` (full check) and `/health/live` (simple ok)
- `.planning/REQUIREMENTS.md` §Deployment — DEPLOY-01 through DEPLOY-06

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StaticModule`: fully implemented SPA serving with `@fastify/static` + catch-all index.html fallback — no changes needed
- `HealthController`: both `/api/health` (DB+Redis) and `/api/health/live` (simple `'ok'`) exist
- `collab-main.ts`: standalone collab server, reads `COLLAB_PORT`, binds to `0.0.0.0`

### Established Patterns
- Railway health check already points to `/api/health/live` in `railway.json`
- `STORAGE_DRIVER=s3` switches to S3; all S3 env vars are already read by `EnvironmentService`
- `COLLAB_URL` is injected into `window.CONFIG` by `StaticModule` at serve time — set it to the collab service Railway URL

### Integration Points
- `railway.json` controls Railway build/deploy for the main service — add a second service via Railway dashboard (no second `railway.json` needed; Railway service settings override)
- `.env` holds all local values; Railway dashboard holds production values — no `.env` is shipped to Railway

</code_context>

<specifics>
## Specific Ideas

- The old Railway deployment is broken/misconfigured — the goal is to trigger a fresh rebuild with the current codebase, not to troubleshoot the old one.
- Custom domain will be configured post-launch as a follow-up step.
- R2 is preferred over AWS S3 (no egress fees).

</specifics>

<deferred>
## Deferred Ideas

- Custom domain setup — explicitly deferred by user to post-launch
- Phase 1 (Client Isolation) — not yet executed; not a blocker for deployment but needs execution before launch for full feature completeness

</deferred>

---

*Phase: 05-railway-production-deployment*
*Context gathered: 2026-03-21*

# Phase 5: Railway Production Deployment - Research

**Researched:** 2026-03-21
**Domain:** Railway deployment, Docker multi-stage builds, Cloudflare R2 S3 config, Hocuspocus collab service, Stripe webhook wiring
**Confidence:** HIGH

## Summary

This phase is a deployment-only phase — no new features, no code changes beyond environment wiring. The infrastructure is already almost entirely in place: `railway.json` configures a Dockerfile build with health check at `/api/health/live`, the NestJS main server listens on `process.env.PORT || 8080` and binds to `0.0.0.0`, the collab server reads `COLLAB_PORT` and binds to `0.0.0.0`, `StaticModule` implements a full SPA catch-all, and the S3 driver reads all six `AWS_S3_*` env vars through `EnvironmentService`.

The deployment work is almost entirely Railway dashboard operations (set env vars, add second service, trigger rebuild) rather than code edits. The primary risk is the order of operations: database migrations must run before the server serves traffic, and S3 must be configured before any file uploads reach Railway (ephemeral container filesystem loses data on redeploy).

The one genuine code gap to verify: the collab service's `collab-app.module.ts` imports `DatabaseModule` and `QueueModule` (which requires Redis). The collab service env vars in CONTEXT.md include `DATABASE_URL` and `REDIS_URL`, which aligns with what those modules need. No code changes are required — only Railway dashboard configuration.

**Primary recommendation:** Execute deployment as a sequence of dashboard operations with verification checkpoints. Do not change any code. Commit current codebase to trigger rebuild, then verify each DEPLOY requirement with curl/browser checks.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Deployment trigger:** Repo already connected to Railway. `git push` to `main` triggers rebuild. All config in `railway.json` + Railway dashboard env vars.
- **Health check:** Already configured at `/api/health/live` in `railway.json`. Returns `'ok'` with no DB/Redis dependency. No changes needed.
- **Static file serving + SPA routing:** Fully implemented in `StaticModule`. No changes needed.
- **Two Railway services (collab server):** Add a second service in the same Railway project pointing to the same GitHub repo. Start command: `pnpm --filter server collab:prod`. Port: set `COLLAB_PORT=$PORT` on the collab service.
- **S3 file storage:** Cloudflare R2. `STORAGE_DRIVER=s3`. Six env vars: `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_S3_ENDPOINT`, `AWS_S3_REGION=auto`, `AWS_S3_FORCE_PATH_STYLE=true`.
- **Custom domain:** Use Railway-provided URL for now (`https://client-production-dba5.up.railway.app`). Custom domain deferred to post-launch.
- **Stripe webhook:** Already registered in Stripe Dashboard at `https://client-production-dba5.up.railway.app/api/billing/stripe/webhook`. `STRIPE_WEBHOOK_SECRET` already set. No action needed.
- **App URL:** `https://client-production-dba5.up.railway.app`

### Claude's Discretion
None — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)
- Custom domain setup — explicitly deferred to post-launch
- Phase 1 (Client Isolation) — not a blocker for deployment
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPLOY-01 | Application is live and fully accessible on Railway URL (no 404, no timeout) | railway.json builder=DOCKERFILE, healthcheck at /api/health/live, main.ts binds to 0.0.0.0:$PORT — all correct |
| DEPLOY-02 | Main NestJS server and Hocuspocus collaboration server run as two separate Railway services | collab-main.ts reads COLLAB_PORT, binds 0.0.0.0 — ready for second Railway service with COLLAB_PORT=$PORT |
| DEPLOY-03 | File storage configured to use S3 (not local ephemeral filesystem) | StorageProvider reads STORAGE_DRIVER=s3 and all AWS_S3_* vars via EnvironmentService — set in Railway dashboard |
| DEPLOY-04 | SPA routing works correctly — all client-side routes resolve to React app (no 404 on refresh) | StaticModule catch-all returns index.html for all non-API, non-socket routes — already implemented |
| DEPLOY-05 | Health check endpoint at /api/health returns 200 for Railway deployment verification | HealthController has both /api/health (DB+Redis) and /api/health/live (simple ok) — railway.json uses /live |
| DEPLOY-06 | Stripe webhook URL registered in Stripe Dashboard pointing to production Railway URL | Webhook already registered at correct URL; STRIPE_WEBHOOK_SECRET set in .env — copy to Railway dashboard |
</phase_requirements>

---

## Standard Stack

### Core — Already In Place
| Component | Version/Tool | Purpose | Status |
|-----------|-------------|---------|--------|
| Railway | Platform | Hosting, CI/CD via GitHub integration | Existing project at client-production-dba5.up.railway.app |
| Dockerfile | node:22-alpine multi-stage | Build server dist + client dist in one image | Already correct in repo root |
| railway.json | Schema v1 | Build/deploy config for main service | Already correct: DOCKERFILE builder, /api/health/live healthcheck |
| NestJS main server | `pnpm --filter server start:prod` | Main app, static serving, API | CMD in Dockerfile, start command in railway.json |
| Hocuspocus collab server | `pnpm --filter server collab:prod` | Real-time collaboration WebSocket | Separate Railway service, same repo |
| Cloudflare R2 | S3-compatible | Persistent file storage | @aws-sdk/client-s3 3.701.0 already in package.json |
| PostgreSQL | Railway addon | Primary database | Provided by Railway |
| Redis | Railway addon | BullMQ queues + Socket.io adapter | Provided by Railway |

### Nothing to Install
All dependencies are already in `package.json`. No new packages are required for this phase.

## Architecture Patterns

### Railway Two-Service Pattern
The same GitHub repo feeds two Railway services. Each service has its own:
- Start command (overrides Dockerfile CMD)
- Environment variables
- Public URL
- Health check (optional for collab service)

The main service's `railway.json` controls the main service. The collab service is configured entirely through the Railway dashboard service settings (no second `railway.json` needed — Railway service-level settings take precedence).

```
GitHub repo (main branch)
    │
    ├─── Railway Service: main
    │    Start command: pnpm --filter server start:prod
    │    PORT: injected by Railway (e.g., 8080)
    │    railway.json healthcheck: /api/health/live
    │    Public URL: client-production-dba5.up.railway.app
    │
    └─── Railway Service: collab
         Start command: pnpm --filter server collab:prod
         PORT: injected by Railway
         COLLAB_PORT=$PORT  ← maps Railway's PORT to app's COLLAB_PORT
         Public URL: <collab-service>.up.railway.app
```

### Environment Variable Flow

**Main service reads:** `PORT` (Railway-injected), all listed env vars in CONTEXT.md
**Collab service reads:** `PORT` (Railway-injected as COLLAB_PORT), `DATABASE_URL`, `REDIS_URL`, `APP_SECRET`

The collab service's `collab-app.module.ts` imports `DatabaseModule` and `QueueModule` — both need `DATABASE_URL` and `REDIS_URL` respectively. These must be set on the collab service.

### Database Migration Pattern
Migrations run via `pnpm --filter server migration:latest`. This must execute against the Railway PostgreSQL database BEFORE the server handles traffic. Railway's healthcheck timeout (100s in railway.json) provides a window, but migrations should be run explicitly as a pre-deploy step or as part of startup.

**Verified:** The `start:prod` script is `node dist/main` — it does NOT automatically run migrations. Migrations must be triggered manually via Railway's one-off commands or as a startup hook.

### Static File Serving (Verified from Source)
`StaticModule` resolves the client dist path relative to `__dirname`:
```
__dirname = /app/apps/server/dist/integrations/static
path resolves to: /app/apps/client/dist
```
Dockerfile copies `apps/client/dist` to `/app/apps/client/dist` — path is correct.

The catch-all excludes: `/api`, `/socket.io`, `/collab`, `/robots.txt`, `/share/`. All other paths return `index.html` — DEPLOY-04 is satisfied.

### S3/R2 Configuration (Verified from Source)
`StorageProvider` reads `STORAGE_DRIVER` and constructs S3 config:
```typescript
// storage.provider.ts — relevant section
const s3Config = {
  driver: 's3',
  config: {
    region: environmentService.getAwsS3Region(),        // AWS_S3_REGION=auto
    endpoint: environmentService.getAwsS3Endpoint(),    // AWS_S3_ENDPOINT=https://<id>.r2.cloudflarestorage.com
    bucket: environmentService.getAwsS3Bucket(),        // AWS_S3_BUCKET=<bucket>
    baseUrl: environmentService.getAwsS3Url(),          // AWS_S3_URL (optional, for public URLs)
    forcePathStyle: environmentService.getAwsS3ForcePathStyle(), // AWS_S3_FORCE_PATH_STYLE=true
    credentials: {
      accessKeyId: environmentService.getAwsS3AccessKeyId(),     // AWS_S3_ACCESS_KEY_ID
      secretAccessKey: environmentService.getAwsS3SecretAccessKey(), // AWS_S3_SECRET_ACCESS_KEY
    },
  },
};
```
R2 requires `forcePathStyle=true` and `region=auto`. Both are set in CONTEXT.md env vars. No code changes needed.

### Anti-Patterns to Avoid
- **Setting COLLAB_PORT to a hardcoded value on Railway collab service:** Railway injects `PORT` dynamically. If `COLLAB_PORT` is set to `3001` it may conflict. Use `COLLAB_PORT=$PORT` (Railway supports variable references in env vars).
- **Shipping .env file to Railway:** Railway does not read `.env` from the repo. All production values must be set via the Railway dashboard.
- **Running migrations after the server starts:** Server startup may fail mid-way through migration if DB schema is stale. Run migrations first.
- **Uploading files before S3 is configured:** If the server runs with `STORAGE_DRIVER=local` even briefly, uploaded files go to the ephemeral container filesystem and are lost on redeploy.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Database migrations on deploy | Custom migration runner in startup | `pnpm --filter server migration:latest` via Railway one-off command |
| Health check endpoint | Custom ping endpoint | Existing `/api/health/live` — already wired in railway.json |
| SPA catch-all | Nginx rewrite rules | Existing `StaticModule` Fastify catch-all — already deployed |
| S3 client with R2 | Custom HTTP client | Existing `@aws-sdk/client-s3` S3Driver with forcePathStyle — just set env vars |
| Secret management | Custom encryption | Railway dashboard env vars (encrypted at rest) |

## Common Pitfalls

### Pitfall 1: Railway injects PORT but collab reads COLLAB_PORT
**What goes wrong:** Collab service starts but can't bind to the expected port; Railway sees no service on the injected PORT and marks the deployment unhealthy.
**Why it happens:** `collab-main.ts` reads `process.env.COLLAB_PORT || 3001` — it never reads `PORT` directly. Railway always injects `PORT` for the service.
**How to avoid:** Set `COLLAB_PORT=$PORT` as an env var on the collab service in Railway dashboard. Railway resolves `$PORT` variable references.
**Warning signs:** Collab service deployment fails health check; Railway logs show server started on port 3001 but PORT was something different.

### Pitfall 2: Database migrations not run before first deploy
**What goes wrong:** Server starts against a fresh Railway PostgreSQL instance that has no tables. First API request fails with relation does not exist errors.
**Why it happens:** `start:prod` runs `node dist/main` only — no migration in startup sequence.
**How to avoid:** Run `pnpm --filter server migration:latest` as a Railway one-off command against the Railway PostgreSQL DATABASE_URL before the first deploy, OR add it as a pre-start step.
**Warning signs:** Server starts (health check passes), but API requests return 500 with database errors.

### Pitfall 3: COLLAB_URL not set on main service
**What goes wrong:** Real-time collaboration does not work; client connects to wrong URL or falls back to localhost.
**Why it happens:** `StaticModule` injects `COLLAB_URL` into `window.CONFIG` at serve time. If it's missing, the client has no collab server URL.
**How to avoid:** After the collab service is deployed and has a Railway URL, copy that URL into `COLLAB_URL` on the main service's env vars.
**Warning signs:** Pages load but real-time collaboration cursor/presence/sync does not function.

### Pitfall 4: Old broken Railway deployment not rebuilt
**What goes wrong:** The existing Railway project runs old code; a push to main triggers a rebuild but if Railway's builder is misconfigured the old state persists.
**Why it happens:** Previous deployment was broken/misconfigured. Railway may have cached build artifacts or a failed state.
**How to avoid:** After pushing to main, watch the Railway build logs to confirm a full Docker build completes successfully. If the build fails, check logs for the exact error.
**Warning signs:** Railway shows "deployment failed" or the URL still serves old content.

### Pitfall 5: Stripe webhook secret mismatch
**What goes wrong:** Stripe sends webhook events to the production URL but the server returns 400/401, causing Stripe to retry and eventually disable the endpoint.
**Why it happens:** `STRIPE_WEBHOOK_SECRET` in Railway must match the secret for the production endpoint registered in the Stripe Dashboard (not the local CLI webhook secret from `stripe listen`).
**How to avoid:** Use the webhook signing secret from the Stripe Dashboard webhook endpoint configuration (Webhooks > [endpoint] > Signing secret), not the CLI listener secret.
**Warning signs:** `/api/billing/stripe/webhook` returns 400; Stripe Dashboard shows delivery failures.

### Pitfall 6: R2 bucket CORS and public access
**What goes wrong:** File attachments upload successfully but cannot be served/displayed because R2 bucket blocks public reads.
**Why it happens:** R2 buckets default to private. The app uses presigned URLs (`getSignedUrl`) for reading — this should work with private buckets, but if `AWS_S3_URL` (baseUrl) is set to a public URL it may conflict.
**How to avoid:** Do NOT set `AWS_S3_URL` env var unless a custom public domain is configured on the R2 bucket. Leave it unset — the S3Driver falls back to `endpoint/bucket/filepath` which works with presigned URLs.
**Warning signs:** File uploads succeed (no error) but attachments display as broken images.

## Code Examples

### Railway environment variable with variable reference
Railway supports referencing other env vars. For the collab service:
```
COLLAB_PORT=$PORT
```
Railway resolves `$PORT` to the dynamically assigned port at deploy time. This is how the collab service binds to the correct port without knowing it in advance.

### Running migrations as a Railway one-off command
In Railway dashboard: Service > Settings > "Deploy" > "Deploy on push" — or use the Railway CLI:
```bash
# Via Railway CLI (run locally against production DB)
railway run --service server pnpm --filter server migration:latest

# Or set as a Railway "start command" that runs migrations then starts server:
# pnpm --filter server migration:latest && pnpm --filter server start:prod
```

The combined start command approach (migrations + start) is simpler than managing one-off commands and ensures migrations always run before the server accepts traffic.

### Verifying health check manually
```bash
# Verify main service health check
curl https://client-production-dba5.up.railway.app/api/health/live
# Expected: "ok"

# Verify full health (DB + Redis)
curl https://client-production-dba5.up.railway.app/api/health
# Expected: JSON with status "ok" and database/redis checks

# Verify SPA routing (non-API route)
curl -I https://client-production-dba5.up.railway.app/some/spa/route
# Expected: HTTP 200 with Content-Type: text/html

# Verify collab service is reachable (once deployed)
curl https://<collab-url>.up.railway.app/api/health/live
# Expected: "ok"
```

### Stripe webhook end-to-end test
```bash
# After deploy, use Stripe CLI to replay a test event to production
stripe events resend <event_id> --webhook-endpoint <endpoint_id>

# Or trigger a test checkout completion in Stripe Dashboard
# Webhooks > [endpoint] > Send test webhook > checkout.session.completed
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Nixpacks (auto-detect) | Dockerfile (explicit multi-stage) | Reproducible builds; no Nixpacks guessing |
| Single service for everything | Two Railway services (main + collab) | Collab WebSocket can scale independently; Railway assigns separate URL |
| Local filesystem storage | S3/R2 | Files persist across redeploys; Railway containers are ephemeral |

## Open Questions

1. **Migration strategy on first deploy**
   - What we know: `start:prod` does NOT run migrations; migrations exist and are up to date in the codebase
   - What's unclear: Whether the Railway PostgreSQL addon is a fresh instance or has schema from the old broken deployment
   - Recommendation: Plan migration step explicitly — either combine with start command (`migration:latest && start:prod`) or run as Railway one-off. Combining is safer.

2. **SMTP/mail configuration**
   - What we know: Welcome emails are fire-and-forget with `.catch()` — mail failure won't block provisioning
   - What's unclear: Which mail driver (smtp vs postmark) and credentials are available for production
   - Recommendation: Set `MAIL_DRIVER=log` initially if mail credentials are not ready — provisioning still works, emails just get logged. Switch to real driver when credentials are available.

3. **R2 bucket creation and CORS**
   - What we know: Env vars are defined; S3Driver is implemented correctly
   - What's unclear: Whether the R2 bucket has been created and whether CORS rules are needed for direct browser uploads
   - Recommendation: Verify R2 bucket exists with correct name before configuring env vars. If the app does server-side uploads (not browser-direct), CORS is not needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29 (server) + Vitest (client) |
| Config file | `apps/server/package.json` (jest section) |
| Quick run command | `cd apps/server && pnpm test -- --testPathPattern=health` |
| Full suite command | `cd apps/server && pnpm test` |

### Phase Requirements → Test Map

Deployment verification is primarily operational (curl/browser), not unit-testable. Tests are manual smoke checks post-deploy.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPLOY-01 | Railway URL returns 200 | smoke | `curl -f https://client-production-dba5.up.railway.app/api/health/live` | manual |
| DEPLOY-02 | Collab service is reachable | smoke | `curl -f https://<collab-url>/api/health/live` | manual |
| DEPLOY-03 | S3 driver active (no local fallback) | smoke | `curl -X POST .../upload` then redeploy and verify file persists | manual |
| DEPLOY-04 | SPA route returns 200 with text/html | smoke | `curl -I https://client-production-dba5.up.railway.app/some/spa/route` | manual |
| DEPLOY-05 | /api/health returns 200 | smoke | `curl -f https://client-production-dba5.up.railway.app/api/health` | manual |
| DEPLOY-06 | Stripe webhook delivers successfully | smoke | Stripe Dashboard webhook logs show 200 response | manual |

### Sampling Rate
- **Per task commit:** No automated tests — this phase is pure deployment ops
- **Per wave merge:** Curl checks against production URL
- **Phase gate:** All six DEPLOY requirements verified by curl/browser/Stripe Dashboard before `/gsd:verify-work`

### Wave 0 Gaps
None — test infrastructure exists for unit tests (Jest). No new test files needed for this deployment phase. All verification is operational smoke testing against the live Railway URL.

---

## Sources

### Primary (HIGH confidence)
- Source code: `railway.json` — verified builder, healthcheck path, start command
- Source code: `Dockerfile` — verified multi-stage build copies both server and client dist
- Source code: `apps/server/src/main.ts` — verified `process.env.PORT`, binds `0.0.0.0`
- Source code: `apps/server/src/collaboration/server/collab-main.ts` — verified `COLLAB_PORT`, binds `0.0.0.0`
- Source code: `apps/server/src/integrations/static/static.module.ts` — verified SPA catch-all, clientDistPath resolution
- Source code: `apps/server/src/integrations/storage/providers/storage.provider.ts` — verified S3 driver construction
- Source code: `apps/server/src/integrations/environment/environment.service.ts` — verified all env var getters
- Source code: `apps/server/src/integrations/health/health.controller.ts` — verified both `/health` and `/health/live`
- Source code: `apps/server/src/collaboration/server/collab-app.module.ts` — verified DatabaseModule + QueueModule imports (needs DATABASE_URL + REDIS_URL)
- Source code: `apps/server/src/database/migrations/20260321T120100-create-webhook-event-tables.ts` — stripe_webhook_events table migration exists

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions — env var lists, service configuration locked by user
- STATE.md blockers — notes that Railway Nixpacks/Dockerfile behavior is MEDIUM confidence (resolved: Dockerfile is already in use, not Nixpacks)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified directly from source code
- Architecture: HIGH — verified from railway.json, Dockerfile, and collab-main.ts
- Pitfalls: HIGH (port binding, migrations) / MEDIUM (R2 CORS details)
- Environment vars: HIGH — verified against EnvironmentService getters

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (Railway dashboard UI may change; core patterns are stable)

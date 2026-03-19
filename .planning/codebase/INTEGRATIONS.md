# External Integrations

**Analysis Date:** 2026-03-19

## APIs & External Services

**Search:**
- Typesense - Full-text search engine (optional)
  - SDK/Client: `typesense` 2.1.0
  - Config: `TYPESENSE_URL`, `TYPESENSE_API_KEY`
  - Alternative: PostgreSQL native full-text search (using `pg-tsquery`)

**Collaboration:**
- Hocuspocus - Real-time document collaboration server
  - SDK/Client: `@hocuspocus/server` 2.15.2, `@hocuspocus/provider` 2.15.2
  - Extensions: Redis adapter (`@hocuspocus/extension-redis` 2.15.2), persistence, authentication
  - Config: `COLLAB_URL` environment variable
  - Location: `apps/server/src/collaboration/`

**Diagramming:**
- Draw.io - External diagram editor (optional)
  - Config: `DRAWIO_URL` environment variable
  - Client integration: `react-drawio` 1.0.1

## Data Storage

**Databases:**
- PostgreSQL 16
  - Connection: `DATABASE_URL` environment variable
  - Client: `pg` 8.16.0
  - Query builder: `kysely` 0.28.2 with type codegen
  - Migrations: `kysely-migration-cli` 0.4.2
  - Full-text search: `pg-tsquery` 8.4.2
  - Location: `apps/server/src/database/`

**File Storage:**
- Local filesystem (default)
  - Driver location: `apps/server/src/integrations/storage/drivers/local.driver.ts`
  - Storage path: `/app/data/storage` in Docker
- AWS S3 (optional)
  - Driver location: `apps/server/src/integrations/storage/drivers/s3.driver.ts`
  - SDK: `@aws-sdk/client-s3` 3.701.0, `@aws-sdk/lib-storage` 3.701.0, `@aws-sdk/s3-request-presigner` 3.701.0
  - Config env vars: `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY`, `AWS_S3_REGION`, `AWS_S3_BUCKET`, `AWS_S3_ENDPOINT`, `AWS_S3_FORCE_PATH_STYLE`
  - Storage service: `apps/server/src/integrations/storage/storage.service.ts`

**Caching & Sessions:**
- Redis 7.2+
  - Connection: `REDIS_URL` environment variable
  - Client: `ioredis` 5.4.1
  - NestJS module: `@nestjs-labs/nestjs-ioredis` 11.0.4
  - Config: `apps/server/src/integrations/redis/redis-config.service.ts`
  - WebSocket adapter: `@socket.io/redis-adapter` 8.3.0

## Authentication & Identity

**Auth Provider:**
Custom JWT with multiple SSO options
- JWT tokens via `@nestjs/jwt` 11.0.0
- Passport.js strategies: `@nestjs/passport` 11.0.5
- Supported providers (configurable):
  - Google OAuth 2.0: `passport-google-oauth20` 2.0.0
  - SAML 2.0: `@node-saml/passport-saml` 5.1.0
  - OpenID Connect: `openid-client` 5.7.1
  - JWT standard: `passport-jwt` 4.0.1
- Password hashing: `bcrypt` 5.1.1
- Auth location: `apps/server/src/core/auth/`
- Env config: `JWT_TOKEN_EXPIRES_IN` (default: 30d)

**SSO Configuration:**
- Database schema: `auth_providers` and `auth_accounts` tables
- Migration: `apps/server/src/database/migrations/20250118T194658-sso-auth.ts`
- Supported types: SAML, OIDC, Google
- Workspace-level SSO enforcement: `enforce_sso` flag

## Monitoring & Observability

**Error Tracking:**
- Not detected - No dedicated error tracking service configured

**Logs:**
- Console logging via NestJS Logger
- Debug mode configurable via `DEBUG_MODE` environment variable
- Custom health checks: `apps/server/src/integrations/health/`
  - PostgreSQL health: `apps/server/src/integrations/health/postgres.health.ts`
  - Redis health: `apps/server/src/integrations/health/redis.health.ts`
  - Endpoint: `/health` (NestJS Terminus integration)

**Analytics:**
- PostHog.js (optional)
  - Client library: `posthog-js` 1.255.1
  - Config env vars: `POSTHOG_HOST`, `POSTHOG_KEY`
  - Client-side tracking

## CI/CD & Deployment

**Hosting:**
- Docker container deployment (Node.js 22 Alpine)
- Base image: `node:22-alpine`
- Multi-stage build: builder → installer
- Service port: 8080 (configurable via `PORT` env var, default 3000)
- Volumes: `/app/data/storage` for file uploads
- Dockerfile: `/Users/rafaelandresberti/docmost/Dockerfile`

**CI Pipeline:**
- Not detected in codebase (likely external GitHub Actions or similar)

## Environment Configuration

**Required env vars:**
- `APP_URL` - Application base URL
- `APP_SECRET` - Encryption secret (minimum 32 characters)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `PORT` - Server port (default 3000)
- `MAIL_DRIVER` - smtp or postmark
- `STORAGE_DRIVER` - local or s3

**Optional env vars:**
- `JWT_TOKEN_EXPIRES_IN` - Token expiry (default: 30d)
- `COLLAB_URL` - Collaboration server URL
- `DRAWIO_URL` - Custom Draw.io server
- `SEARCH_DRIVER` - database or typesense
- `TYPESENSE_URL` / `TYPESENSE_API_KEY` - For Typesense search
- `AWS_S3_*` - For S3 storage
- `SMTP_*` - For SMTP email
- `POSTMARK_TOKEN` - For Postmark email
- `CLOUD` - Enable cloud mode
- `SUBDOMAIN_HOST` - For multi-tenant cloud deployments
- `BILLING_TRIAL_DAYS` - Trial period for billing
- `DISABLE_TELEMETRY` - Disable usage telemetry
- `DEBUG_MODE` - Enable debug logging

**Secrets location:**
- Environment file: `.env` (must not be committed)
- Sensitive vars: `APP_SECRET`, `AWS_S3_SECRET_ACCESS_KEY`, `POSTMARK_TOKEN`, `SMTP_PASSWORD`, `TYPESENSE_API_KEY`, `DATABASE_URL`

## Email Integration

**Mail Service:**
- Location: `apps/server/src/integrations/mail/`
- Drivers:
  - SMTP: `apps/server/src/integrations/mail/drivers/smtp.driver.ts`
  - Postmark: `apps/server/src/integrations/mail/drivers/postmark.driver.ts`
  - Log (development): `apps/server/src/integrations/mail/drivers/log.driver.ts`
- Queue processing: BullMQ with `@react-email` templates
- Service: `apps/server/src/integrations/mail/mail.service.ts`
- Processor: `apps/server/src/integrations/mail/processors/email.processor.ts`
- Env config: `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`

## Task Queue & Background Jobs

**Job Queue:**
- Framework: BullMQ 5.61.0 with Redis backend
- NestJS integration: `@nestjs/bullmq` 11.0.2
- Queue module: `apps/server/src/integrations/queue/`
- Job types:
  - Email sending: `SEND_EMAIL`
  - Backlinks indexing: `BACKLINKS`
  - Typesense flush: `TYPESENSE_FLUSH`
  - Attachment processing: `PROCESS_ATTACHMENT`
  - File import tasks: `FILE_TASK`
- Processor locations:
  - `apps/server/src/integrations/mail/processors/email.processor.ts`
  - `apps/server/src/integrations/queue/processors/backlinks.processor.ts`
  - `apps/server/src/core/attachment/processors/attachment.processor.ts`
  - `apps/server/src/integrations/import/processors/file-task.processor.ts`

## Import & Export

**Document Import:**
- Location: `apps/server/src/integrations/import/`
- Supported formats:
  - HTML (via Turndown)
  - DOCX (via Mammoth)
  - Markdown
- File processing: Async queue jobs with BullMQ

**Document Export:**
- Location: `apps/server/src/integrations/export/`
- Export formats configurable
- Uses Marked for markdown parsing

## Data Transformation

**Markdown & HTML:**
- Turndown (HTML to Markdown): `@joplin/turndown` 4.0.74, `@joplin/turndown-plugin-gfm` 1.0.56
- Marked (Markdown parsing): `marked` 13.0.3
- Tiptap Transformer: `@hocuspocus/transformer` 2.15.2

**Media Processing:**
- Image processing: `sharp` 0.34.3
- PDF handling: `pdfjs-dist` 5.4.54
- ZIP files: `jszip` 3.10.1, `yauzl` 3.2.0

## Security & Content Protection

**Security Module:**
- Location: `apps/server/src/integrations/security/`
- Features:
  - Screenshot detection: `screenshot-detection.service.ts`
  - Content protection: `content-protection.service.ts`
  - Version management: `version.service.ts`
  - Robots.txt handler: `robots.txt.controller.ts`

**Validation & Sanitization:**
- HTML sanitization: `dompurify` 3.2.6
- URL sanitization: `@braintree/sanitize-url` 7.1.0
- DTO validation: `class-validator` 0.14.1
- Schema validation: `zod` 3.25.56

## Webhooks & Callbacks

**Incoming:**
- Not detected - No explicit webhook endpoints configured

**Outgoing:**
- Not detected - No explicit webhook implementations found

---

*Integration audit: 2026-03-19*

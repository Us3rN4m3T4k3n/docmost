---
phase: 04-stripe-billing-and-account-provisioning
plan: 01
subsystem: database
tags: [postgres, kysely, nestjs, stripe, kiwify, migrations, billing]

# Dependency graph
requires: []
provides:
  - billingLockedAt column on users table (migration + type definition)
  - stripe_webhook_events dedup table (migration + type definition)
  - kiwify_webhook_events dedup table (migration + type definition)
  - gateway, kiwify_subscription_id, kiwify_customer_email columns on billing table
  - user_id FK column on billing table
  - BillingModule with stub webhook endpoints registered in AppModule
  - BillingGateway, StripeEventType, KiwifyEventType enums in billing.constants.ts
  - billingLockedAt check in SuspendedUserMiddleware and SuspendedUserGuard
  - Kiwify webhook path excluded from DomainMiddleware, SuspendedUserMiddleware, and preHandler
affects:
  - 04-02-stripe-webhook-service
  - 04-03-kiwify-webhook-service
  - 04-04-billing-portal
  - 04-05-billing-ui

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Webhook dedup tables use unique constraint on event_id/order_id to prevent double-processing
    - Billing lock checked before suspension check (billing is the primary payment gate)
    - Webhook paths excluded at 3 levels: DomainMiddleware, SuspendedUserMiddleware, preHandler hook
    - BillingModule registered at AppModule level (not CoreModule) — billing is top-level concern

key-files:
  created:
    - apps/server/src/database/migrations/20260321T120000-add-billing-locked-at.ts
    - apps/server/src/database/migrations/20260321T120100-create-webhook-event-tables.ts
    - apps/server/src/database/migrations/20260321T120200-add-kiwify-billing-columns.ts
    - apps/server/src/database/migrations/20260321T120300-add-user-id-to-billing.ts
    - apps/server/src/core/billing/billing.module.ts
    - apps/server/src/core/billing/billing.controller.ts
    - apps/server/src/core/billing/billing.constants.ts
  modified:
    - apps/server/src/database/types/db.d.ts
    - apps/server/src/app.module.ts
    - apps/server/src/core/core.module.ts
    - apps/server/src/main.ts
    - apps/server/src/common/middlewares/suspended-user.middleware.ts
    - apps/server/src/common/guards/suspended-user.guard.ts

key-decisions:
  - "BillingModule registered at AppModule level (not CoreModule) since billing operates independently of domain middleware pipeline"
  - "billingLockedAt check placed BEFORE suspendedAt check in middleware/guard — billing lock is the primary payment enforcement mechanism"
  - "gateway column defaults to 'stripe' so existing billing rows are not affected"
  - "Webhook dedup tables use unique constraint approach (not application-level check) for atomicity"

patterns-established:
  - "BillingLocked ForbiddenException: { message: 'Billing Payment Failed', error: 'BillingLocked', statusCode: 403 }"
  - "Webhook path exclusions must be added in 3 places: DomainMiddleware exclude, SuspendedUserMiddleware exclude, main.ts preHandler excludedPaths"

requirements-completed:
  - BILL-05
  - BILL-08

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 4 Plan 1: Database Foundation and BillingModule Scaffold Summary

**4 Kysely migrations, Kysely type definitions, NestJS BillingModule with stub webhook endpoints, and billingLockedAt enforcement in suspended-user middleware/guard**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T09:35:12Z
- **Completed:** 2026-03-21T09:37:46Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Created 4 database migrations covering all billing system schema requirements: billingLockedAt on users, dedup tables for both gateways, Kiwify columns on billing, user_id FK on billing
- Scaffolded BillingModule with stub webhook endpoints and registered it in AppModule; all three webhook path exclusion points updated
- Extended SuspendedUserMiddleware and SuspendedUserGuard to check billingLockedAt, returning BillingLocked 403 error before account suspension checks

## Task Commits

Each task was committed atomically:

1. **Task 1: Create database migrations and update type definitions** - `203d2d03` (feat)
2. **Task 2: Create BillingModule scaffold, extend middleware/guard, add path exclusions** - `0ce8ab24` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/server/src/database/migrations/20260321T120000-add-billing-locked-at.ts` - Adds billing_locked_at timestamptz to users table
- `apps/server/src/database/migrations/20260321T120100-create-webhook-event-tables.ts` - Creates stripe_webhook_events and kiwify_webhook_events dedup tables
- `apps/server/src/database/migrations/20260321T120200-add-kiwify-billing-columns.ts` - Adds gateway (default 'stripe'), kiwify_subscription_id, kiwify_customer_email to billing table
- `apps/server/src/database/migrations/20260321T120300-add-user-id-to-billing.ts` - Adds user_id FK with index to billing table
- `apps/server/src/database/types/db.d.ts` - Added billingLockedAt to Users; gateway/kiwify*/userId to Billing; StripeWebhookEvents/KiwifyWebhookEvents interfaces; DB entries
- `apps/server/src/core/billing/billing.constants.ts` - BillingGateway, StripeEventType, KiwifyEventType enums
- `apps/server/src/core/billing/billing.controller.ts` - Stub POST endpoints at billing/stripe/webhook and billing/kiwify/webhook
- `apps/server/src/core/billing/billing.module.ts` - NestJS module with BillingController
- `apps/server/src/app.module.ts` - Added BillingModule import
- `apps/server/src/core/core.module.ts` - Added kiwify webhook to DomainMiddleware exclude; added both webhook paths to SuspendedUserMiddleware exclude
- `apps/server/src/main.ts` - Added /api/billing/kiwify/webhook to preHandler excludedPaths
- `apps/server/src/common/middlewares/suspended-user.middleware.ts` - Extended to select and check billingLockedAt
- `apps/server/src/common/guards/suspended-user.guard.ts` - Extended to select and check billingLockedAt

## Decisions Made

- BillingModule registered at AppModule level (not CoreModule) since billing operates independently of the domain middleware pipeline used by core workspace features
- billingLockedAt check placed before suspendedAt check — billing lock is the primary payment enforcement mechanism for this system
- gateway column defaults to 'stripe' ensuring all existing billing rows remain valid without data migration
- Webhook dedup tables use unique constraint approach for atomicity (vs application-level dedup check)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in token.service.ts and security controllers were present before this plan and are unrelated.

## User Setup Required

External services require manual configuration. Credentials needed for plans 04-02 through 04-04:
- `STRIPE_SECRET_KEY` — Stripe Dashboard -> Developers -> API keys -> Secret key
- `STRIPE_WEBHOOK_SECRET` — Stripe Dashboard -> Developers -> Webhooks -> Signing secret
- `STRIPE_PRICE_ID` — Stripe Dashboard -> Products -> Price ID
- `CLIENT_SPACE_ID` — UUID of EN client space in Docmost workspace
- `KIWIFY_WEBHOOK_TOKEN` — Kiwify product settings -> Webhook configuration -> Token
- `KIWIFY_CLIENT_SPACE_ID` — UUID of PT-BR client space in Docmost workspace

## Next Phase Readiness

- Database schema is fully prepared for webhook service implementation (plans 04-02 and 04-03)
- BillingModule scaffold is wired and ready for service injection
- billingLockedAt enforcement is live; users with billing failures will be blocked from all protected routes
- No blockers for subsequent plans

---
*Phase: 04-stripe-billing-and-account-provisioning*
*Completed: 2026-03-21*

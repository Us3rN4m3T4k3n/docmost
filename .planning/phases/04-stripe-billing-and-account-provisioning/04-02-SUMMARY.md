---
phase: 04-stripe-billing-and-account-provisioning
plan: 02
subsystem: billing
tags: [nestjs, kysely, billing, provisioning, email, stripe, kiwify]

# Dependency graph
requires:
  - 04-01 (BillingModule scaffold, billingLockedAt on users, billing table schema)
provides:
  - UserProvisioningService with provision/revoke/lock/unlock
  - BillingService with createOrUpdateBillingRecord, getSubscribers, findBillingBy* methods
  - WelcomeEmail React Email template
affects:
  - 04-03-stripe-webhook-service
  - 04-04-kiwify-webhook-service
  - 04-05-billing-portal

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Direct Kysely insert into users table with password null (avoids hashPassword(null) bug in userRepo.insertUser)
    - provision() uses a single Kysely transaction then creates billing record after commit
    - Welcome email dispatched fire-and-forget with .catch() error logging (does not block provision)
    - Token inserted into userTokens table with type 'forgot-password' and 24h expiry
    - revoke() uses deletedAt soft-delete pattern on spaceMembers (consistent with Docmost conventions)

key-files:
  created:
    - apps/server/src/core/billing/services/user-provisioning.service.ts
    - apps/server/src/core/billing/services/billing.service.ts
    - apps/server/src/integrations/transactional/emails/welcome-email.tsx
  modified:
    - apps/server/src/core/billing/billing.module.ts

key-decisions:
  - "Direct Kysely insert used for user creation — avoids hashPassword(null) in userRepo.insertUser()"
  - "Billing record created after transaction commits (not inside) to avoid nested transaction issues"
  - "revoke() soft-deletes spaceMembers via deletedAt (consistent with existing Docmost pattern)"
  - "Welcome email is fire-and-forget — .catch() swallows errors so provision never blocks on email delivery"

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 4 Plan 2: UserProvisioningService and BillingService Summary

**Provision/revoke/lock/unlock service using direct Kysely inserts (password null, no hashPassword bug), plus BillingService for record management and WelcomeEmail template**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T09:40:54Z
- **Completed:** 2026-03-21T09:42:40Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created UserProvisioningService with all four lifecycle methods (provision, revoke, lock, unlock)
- provision() creates users via direct Kysely insert with password: null, avoiding the userRepo.insertUser() hashPassword(null) bug
- provision() handles both new user creation and re-activation (existing user) paths
- Space membership managed as READER throughout; soft-deleted on revoke (deletedAt), re-added on unlock
- Set-password token (type 'forgot-password', 24h expiry) generated inside the transaction; welcome email queued fire-and-forget
- Created BillingService with createOrUpdateBillingRecord, getSubscribers, findBillingByCustomerId, findBillingByEmail, findBillingByUserId
- WelcomeEmail React Email component following forgot-password-email.tsx pattern exactly
- Updated BillingModule to import EnvironmentModule and export both services

## Task Commits

Each task was committed atomically:

1. **Task 1: UserProvisioningService, BillingService, BillingModule update** - `15c36aa0` (feat)
2. **Task 2: WelcomeEmail React Email template** - `0c1235fc` (feat)

## Files Created/Modified

- `apps/server/src/core/billing/services/user-provisioning.service.ts` - provision/revoke/lock/unlock with Kysely transactions
- `apps/server/src/core/billing/services/billing.service.ts` - createOrUpdateBillingRecord, getSubscribers, findBillingBy* methods
- `apps/server/src/integrations/transactional/emails/welcome-email.tsx` - WelcomeEmail React Email template
- `apps/server/src/core/billing/billing.module.ts` - Added EnvironmentModule import, BillingService + UserProvisioningService providers + exports

## Decisions Made

- Direct Kysely insert used for user creation with `password: null` — the existing `userRepo.insertUser()` unconditionally calls `hashPassword()` which would crash on null
- Billing record created after the transaction commits (not inside the transaction) to avoid issues with BillingService using its own db reference in a nested context
- `revoke()` uses soft-delete (`deletedAt`) on spaceMembers to remain consistent with Docmost's existing patterns
- Welcome email dispatched fire-and-forget (`.catch()` swallows errors) so provision response is never blocked by mail queue latency

## Deviations from Plan

None — plan executed exactly as written. The billing record creation was placed after the transaction (not inside) as a safe architectural choice, consistent with how BillingService operates on the main db connection.

## Issues Encountered

Four pre-existing TypeScript errors were present before this plan and are unrelated to billing:
- `token.service.ts` JwtSignOptions type mismatch
- `token.module.ts` JwtModuleOptions async factory type
- `content-protection.controller.ts` missing `@/common/decorators/auth-user.decorator`
- `screenshot-detection.controller.ts` missing `@/common/decorators/auth-user.decorator`

No new TypeScript errors were introduced.

## Next Phase Readiness

- UserProvisioningService is ready for use by Stripe webhook service (plan 04-03) and Kiwify webhook service (plan 04-04)
- BillingService exports are available from BillingModule for billing portal and admin endpoints (plan 04-05)
- WelcomeEmail template is wired to the existing mail queue infrastructure

---
*Phase: 04-stripe-billing-and-account-provisioning*
*Completed: 2026-03-21*

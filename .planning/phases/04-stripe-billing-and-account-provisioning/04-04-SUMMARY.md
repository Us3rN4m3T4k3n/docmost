---
phase: 04-stripe-billing-and-account-provisioning
plan: 04
subsystem: ui
tags: [react, mantine, stripe, billing, nestjs, api]

# Dependency graph
requires:
  - phase: 04-01
    provides: billingLockedAt enforcement, BillingModule scaffold, BillingService with findBillingByUserId
  - phase: 04-02
    provides: BillingService, UserProvisioningService, billing records populated via webhooks
affects: []

provides:
  - /welcome public confirmation page at apps/client/src/pages/billing-success.tsx
  - /billing-locked error page at apps/client/src/features/billing/components/billing-locked.tsx
  - ManageSubscription component at apps/client/src/features/billing/components/manage-subscription.tsx
  - GET /api/billing/portal endpoint for Stripe customer portal redirect
  - api-client.ts 403 BillingLocked interceptor redirecting to /billing-locked

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Public billing routes registered outside Layout component (no auth required)
    - BillingLocked 403 interceptor in api-client.ts catches global API error and redirects
    - Portal endpoint instantiates Stripe SDK per-request using EnvironmentService.getStripeSecretKey()
    - ManageSubscription and BillingLocked both fetch /billing/portal and redirect via window.location.href

key-files:
  created:
    - apps/client/src/pages/billing-success.tsx
    - apps/client/src/features/billing/components/billing-locked.tsx
    - apps/client/src/features/billing/components/manage-subscription.tsx
  modified:
    - apps/client/src/lib/api-client.ts
    - apps/client/src/App.tsx
    - apps/server/src/core/billing/billing.controller.ts

key-decisions:
  - "BillingLocked page shows both Stripe portal button and Kiwify contact support text — portal endpoint returns 400 for Kiwify users, so button is present but gracefully fails"
  - "Portal endpoint instantiates Stripe per-request — simpler than injecting via module, sufficient for low-frequency portal access"
  - "BillingLocked page does not receive props — self-contained page component rendered at /billing-locked route"

patterns-established:
  - "Billing UI components at apps/client/src/features/billing/components/"
  - "Portal redirect: api.get('/billing/portal') then window.location.href = response.url"
  - "Public billing routes added alongside /forgot-password and /password-reset in App.tsx outside <Layout/>"

requirements-completed:
  - BILL-06
  - BILL-08

# Metrics
duration: 15min
completed: 2026-03-21
---

# Phase 4 Plan 4: Billing UI Components Summary

**Three React billing components (/welcome, /billing-locked, ManageSubscription) + GET /api/billing/portal endpoint + BillingLocked 403 interceptor wired in api-client.ts**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-21T10:00:00Z
- **Completed:** 2026-03-21T10:15:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created BillingSuccess page at /welcome with static "Payment Confirmed" confirmation message using auth container pattern
- Created BillingLocked page at /billing-locked showing "Subscription Payment Failed" with Stripe portal redirect button and Kiwify support text
- Wired 403 BillingLocked interceptor in api-client.ts to globally catch billing-locked API responses and redirect users
- Added GET /api/billing/portal endpoint that creates Stripe billing portal session for authenticated users
- Created ManageSubscription reusable component following manage-billing.tsx pattern with loading state and error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /welcome page, billing-locked page, and wire api-client interceptor** - `ecdeb188` (feat)
2. **Task 2: Create customer portal API endpoint and manage-subscription button** - `6b2afca1` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/client/src/pages/billing-success.tsx` - Static /welcome page with "Payment Confirmed" heading and email check instruction
- `apps/client/src/features/billing/components/billing-locked.tsx` - /billing-locked page with Stripe portal button, Kiwify support text, loading state
- `apps/client/src/features/billing/components/manage-subscription.tsx` - Reusable subscription management button for account settings
- `apps/client/src/lib/api-client.ts` - Added BillingLocked detection in 403 interceptor redirecting to /billing-locked
- `apps/client/src/App.tsx` - Registered /welcome and /billing-locked as public routes outside Layout component
- `apps/server/src/core/billing/billing.controller.ts` - Added GET /portal endpoint with JwtAuthGuard, Stripe portal session creation

## Decisions Made

- BillingLocked page shows both Stripe portal button and Kiwify contact support text because the portal endpoint will return 400 for Kiwify users — the button gracefully handles that failure via the catch block
- Portal endpoint instantiates Stripe SDK per-request rather than injecting as a provider — simpler for a low-frequency endpoint that depends on a runtime env var
- BillingLocked component is a self-contained page (not a props-based component) since it's always rendered as a full-screen error state by the interceptor redirect

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used existing BillingService.findBillingByUserId instead of creating a new one**
- **Found during:** Task 2 (portal endpoint implementation)
- **Issue:** Plans 04-02/04-03 had already created BillingService in `services/billing.service.ts` with `findBillingByUserId` — creating a duplicate would conflict
- **Fix:** Updated controller to import from `./services/billing.service` instead of creating a new service
- **Files modified:** apps/server/src/core/billing/billing.controller.ts
- **Verification:** No TS errors in billing files after compilation check
- **Committed in:** 6b2afca1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug/conflict avoidance)
**Impact on plan:** No scope creep. The plan assumed BillingService didn't exist yet; plans 04-02/04-03 had already built it. Used existing service correctly.

## Issues Encountered

Pre-existing TypeScript errors in `token.service.ts`, `token.module.ts`, and security controllers (unrelated to billing) were present before this plan and are out of scope.

## User Setup Required

None — no new external service configuration required for this plan. Existing Stripe configuration (`STRIPE_SECRET_KEY`) required for the portal endpoint to function.

## Next Phase Readiness

- All billing UI surfaces are implemented and wired
- /welcome and /billing-locked routes are public and accessible without authentication
- ManageSubscription component is ready to be integrated into account settings page
- Portal endpoint is live and requires only `STRIPE_SECRET_KEY` env var to function in production
- Phase 04 billing system is feature-complete

---
*Phase: 04-stripe-billing-and-account-provisioning*
*Completed: 2026-03-21*

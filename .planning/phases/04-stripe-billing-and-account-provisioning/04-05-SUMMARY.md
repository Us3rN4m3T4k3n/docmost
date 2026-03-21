---
phase: 04-stripe-billing-and-account-provisioning
plan: 05
subsystem: ui
tags: [nestjs, react, mantine, billing, admin, subscribers, stripe, kiwify]

# Dependency graph
requires:
  - 04-02 (UserProvisioningService.revoke/unlock, BillingService.getSubscribers/findBillingByUserId)
provides:
  - Admin subscribers table page at /settings/subscribers
  - GET /api/billing/admin/subscribers with status derivation
  - POST /api/billing/admin/revoke locks user and removes from spaces
  - POST /api/billing/admin/restore unlocks user and re-adds to space
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Admin role check inline in controller (user.role !== 'admin' && user.role !== 'owner') per project pattern
    - Status derivation in controller layer (active/locked/cancelled from billingLockedAt + billing.status)
    - React hooks (useState, useEffect) called before early return guard to comply with hooks rules
    - useEffect guards fetchSubscribers on isAdmin to avoid unauthorized fetch for non-admins

key-files:
  created:
    - apps/client/src/pages/settings/subscribers.tsx
  modified:
    - apps/server/src/core/billing/billing.controller.ts
    - apps/server/src/integrations/environment/environment.service.ts
    - apps/client/src/components/settings/settings-sidebar.tsx
    - apps/client/src/App.tsx

key-decisions:
  - "Status derivation done in controller map() not BillingService — keeps service generic, controller handles UI-specific mapping"
  - "useEffect gates fetchSubscribers on isAdmin — avoids 403 fetch for non-admin users even if they navigate to the URL"
  - "getClientSpaceId() and getKiwifyClientSpaceId() added to EnvironmentService — consistent with existing getter pattern"
  - "Subscribers sidebar entry has no isCloud gate — visible on self-hosted per CONTEXT.md Pattern 9"

patterns-established:
  - "Admin endpoints: inline role check with ForbiddenException before any data access"
  - "Restore endpoint: gateway-aware spaceId selection (kiwify vs stripe) using EnvironmentService getters"

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03]

# Metrics
duration: 10min
completed: 2026-03-21
---

# Phase 4 Plan 5: Admin Subscriber Management Summary

**Admin subscribers table with revoke/restore actions via three NestJS endpoints — status-derived badges, Stripe dashboard links, gateway-aware restore logic**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-21T10:20:00Z
- **Completed:** 2026-03-21T10:30:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created three admin-only billing endpoints: GET subscribers (with active/locked/cancelled status derivation), POST revoke (locks user + removes from spaces), POST restore (unlocks + re-adds to gateway-specific space)
- Created Subscribers page with 6-column Mantine table, colored status badges, Stripe dashboard anchor links, confirm modal for revoke, and direct POST for restore
- Added Subscribers entry to settings sidebar after Content Security with `isAdmin: true` and no `isCloud` gate — visible on self-hosted
- Registered `/settings/subscribers` route in App.tsx settings block without `isCloud` conditional

## Task Commits

Each task was committed atomically:

1. **Task 1: Admin billing API endpoints** - `6e3ba0be` (feat)
2. **Task 2: Subscribers page, sidebar entry, and route** - `61842329` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `apps/server/src/core/billing/billing.controller.ts` - Added GET /admin/subscribers, POST /admin/revoke, POST /admin/restore; injected KyselyDB and UserProvisioningService
- `apps/server/src/integrations/environment/environment.service.ts` - Added getClientSpaceId() and getKiwifyClientSpaceId() methods
- `apps/client/src/pages/settings/subscribers.tsx` - Admin-only subscribers table page (created)
- `apps/client/src/components/settings/settings-sidebar.tsx` - Added Subscribers entry after Content Security
- `apps/client/src/App.tsx` - Added /settings/subscribers route and Subscribers import

## Decisions Made

- Status derivation (`active`/`locked`/`cancelled`) done in the controller's `.map()` layer rather than in BillingService — keeps the service generic and the UI-specific mapping in the controller
- `useEffect` guards `fetchSubscribers()` call on `isAdmin` — prevents a 403 fetch for non-admin users who may briefly render the component before the early return fires
- Added `getClientSpaceId()` and `getKiwifyClientSpaceId()` to EnvironmentService following the existing `getStripeSecretKey()` getter pattern — consistent with the rest of the service
- `Subscribers` sidebar entry has `isAdmin: true` only, no `isCloud: true` — per CONTEXT.md Pattern 9, subscriber management must be available on self-hosted

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Two new environment variables are needed for the restore endpoint:

- `CLIENT_SPACE_ID` — The Docmost Space ID for Stripe-subscribed clients
- `KIWIFY_CLIENT_SPACE_ID` — The Docmost Space ID for Kiwify-subscribed clients

These must be set in the deployment environment (Railway/`.env`). The restore endpoint will return an error if these are not configured and an admin attempts to restore a user.

## Next Phase Readiness

- Phase 4 complete — all billing and account provisioning features implemented
- Phase 5 (deployment) can proceed: Stripe webhooks, Kiwify webhooks, billing portal, billing-locked UI, and admin subscriber management are all in place
- No blockers from this plan

---
*Phase: 04-stripe-billing-and-account-provisioning*
*Completed: 2026-03-21*

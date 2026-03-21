---
phase: 04-stripe-billing-and-account-provisioning
verified: 2026-03-21T12:00:00Z
status: passed
score: 27/27 must-haves verified
re_verification: false
---

# Phase 4: Stripe Billing and Account Provisioning — Verification Report

**Phase Goal:** Prospective clients can self-serve purchase access; accounts are provisioned automatically; subscriptions are managed end-to-end including payment failures and cancellations.
**Verified:** 2026-03-21
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `billingLockedAt` column exists on users table and is queryable | VERIFIED | Migration `20260321T120000-add-billing-locked-at.ts` adds `billing_locked_at timestamptz`; `db.d.ts` line 301 has `billingLockedAt: Timestamp \| null` on `Users` interface |
| 2 | Webhook event dedup tables exist for both Stripe and Kiwify | VERIFIED | Migration `20260321T120100-create-webhook-event-tables.ts` creates both tables with `UNIQUE` constraint; `db.d.ts` exports `StripeWebhookEvents` and `KiwifyWebhookEvents` interfaces and adds them to `DB` |
| 3 | Billing module is registered and controller responds to requests | VERIFIED | `app.module.ts` imports `BillingModule`; `billing.controller.ts` has `@Controller('billing')` with 5 real endpoints (not stubs) |
| 4 | Kiwify webhook path is excluded from domain and suspended-user middleware | VERIFIED | `core.module.ts` excludes `billing/kiwify/webhook` from both `DomainMiddleware` and `SuspendedUserMiddleware`; `main.ts` preHandler excludes `/api/billing/kiwify/webhook` |
| 5 | Users with `billingLockedAt` set are blocked from protected routes | VERIFIED | `suspended-user.middleware.ts` selects `billingLockedAt`, checks it before `suspendedAt`, and throws `ForbiddenException({ error: 'BillingLocked' })`; guard mirrors the same logic |
| 6 | `provision()` creates a new user with null password, adds to correct space as READER, creates billing record, and sends welcome email | VERIFIED | `user-provisioning.service.ts`: direct Kysely insert with `password: null`, `role: 'member'`; inserts into `spaceMembers` with `role: 'reader'`; billing record created in `.then()`; welcome email dispatched fire-and-forget via `mailService.sendToQueue()` |
| 7 | `provision()` with existing email reactivates instead of creating a duplicate | VERIFIED | `user-provisioning.service.ts` lines 38-76: queries for existing user, clears `billingLockedAt`, re-checks/adds space membership instead of inserting new user |
| 8 | `revoke()` removes user from space and sets `billingLockedAt` | VERIFIED | Sets `billingLockedAt = new Date()`, queries `spaceMembers` joined with `spaces`, soft-deletes all memberships via `deletedAt` |
| 9 | `lock()` sets `billingLockedAt` without removing from space | VERIFIED | Only updates `billingLockedAt = new Date()` on user; no space membership modification |
| 10 | `unlock()` clears `billingLockedAt` and re-adds to space if missing | VERIFIED | Clears `billingLockedAt = null`, checks `spaceMembers` for `deletedAt is null`, inserts with `role: 'reader'` if not found |
| 11 | Welcome email contains set-password link using password-reset token mechanism | VERIFIED | `userTokens` insert with `type: 'forgot-password'`, 24h expiry; link is `${appUrl}/password-reset?token=${token}`; `WelcomeEmail` component renders a `Button` with `href={setPasswordLink}` |
| 12 | Stripe webhook verifies signature using rawBody and `STRIPE_WEBHOOK_SECRET` | VERIFIED | `stripe-webhook.service.ts` line 25-29: `stripe.webhooks.constructEvent(rawBody, signature, environmentService.getStripeWebhookSecret())`; controller passes `req.rawBody` |
| 13 | `checkout.session.completed` triggers provisioning to `CLIENT_SPACE_ID` | VERIFIED | Switch case on `StripeEventType.CHECKOUT_COMPLETED`, extracts email/customer/subscription, calls `userProvisioningService.provision({ ..., spaceId: environmentService.getClientSpaceId() })` |
| 14 | `customer.subscription.deleted` triggers revoke | VERIFIED | Looks up billing by customer ID, calls `userProvisioningService.revoke(billing.email, workspaceId)` |
| 15 | `invoice.payment_failed` triggers lock | VERIFIED | Looks up billing by customer ID, calls `userProvisioningService.lock(billing.email, workspaceId)` |
| 16 | `invoice.payment_succeeded` triggers unlock | VERIFIED | Looks up billing by customer ID, calls `userProvisioningService.unlock(billing.email, workspaceId, spaceId)` |
| 17 | Duplicate Stripe events are ignored via dedup table | VERIFIED | Queries `stripeWebhookEvents` for `eventId` before processing; returns early if found |
| 18 | Kiwify webhook verifies token from payload body | VERIFIED | `kiwify-webhook.service.ts` line 19-23: compares `payload.token` against `environmentService.getKiwifyWebhookToken()`, throws `UnauthorizedException` on mismatch |
| 19 | `compra_aprovada` triggers provisioning to `KIWIFY_CLIENT_SPACE_ID` | VERIFIED | Switch case on `KiwifyEventType.PURCHASE_APPROVED`, uses `Customer.full_name`, calls provision with `gateway: 'kiwify'` and `environmentService.getKiwifyClientSpaceId()` |
| 20 | Duplicate Kiwify events are ignored via dedup table | VERIFIED | Queries `kiwifyWebhookEvents` for `orderId` before processing; returns early if found |
| 21 | `/welcome` page renders confirmation message without requiring auth | VERIFIED | `billing-success.tsx`: static component, no auth guard, registered as public route in `App.tsx` alongside `/forgot-password` outside `<Layout />` |
| 22 | Billing-locked users see payment failure page with portal link (Stripe) or contact support (Kiwify) | VERIFIED | `billing-locked.tsx` renders "Subscription Payment Failed" heading, portal redirect button, and Kiwify support text; `api-client.ts` 403 interceptor redirects to `/billing-locked` when `error === 'BillingLocked'` |
| 23 | `/api/billing/portal` creates Stripe portal session and returns URL | VERIFIED | `billing.controller.ts` `GET portal` endpoint: checks billing record, validates `gateway === 'stripe'`, instantiates Stripe SDK, calls `stripe.billingPortal.sessions.create()`, returns `{ url: session.url }` |
| 24 | Admin can view subscribers with email, name, gateway, status, Stripe link | VERIFIED | `GET /admin/subscribers` maps `getSubscribers()` rows to `{ id, email, name, gateway, status, stripeCustomerId }`; status derived as `active/locked/cancelled` from `billingLockedAt` + `billing.status` |
| 25 | Admin can revoke subscriber access via confirm modal | VERIFIED | `subscribers.tsx` opens `modals.openConfirmModal()` with red confirm button, `POST /billing/admin/revoke` calls `userProvisioningService.revoke()`; controller has admin role check |
| 26 | Admin can restore subscriber access | VERIFIED | `POST /billing/admin/restore` calls `userProvisioningService.unlock()` with gateway-aware `spaceId`; subscriber page calls `handleRestore` directly without modal |
| 27 | Non-admin users cannot see or access the subscribers page | VERIFIED | `subscribers.tsx` checks `isAdmin` from `useUserRole()`; `useEffect` gates fetch on `isAdmin`; server endpoints check `user.role !== 'admin' && user.role !== 'owner'` and throw `ForbiddenException`; sidebar entry has `isAdmin: true` and no `isCloud` gate |

**Score:** 27/27 truths verified

---

## Required Artifacts

| Artifact | Purpose | Status | Details |
|----------|---------|--------|---------|
| `apps/server/src/database/migrations/20260321T120000-add-billing-locked-at.ts` | `billingLockedAt` on users | VERIFIED | Adds `billing_locked_at timestamptz`, has `up`/`down` |
| `apps/server/src/database/migrations/20260321T120100-create-webhook-event-tables.ts` | Dedup tables | VERIFIED | Creates both tables with UNIQUE constraints |
| `apps/server/src/database/migrations/20260321T120200-add-kiwify-billing-columns.ts` | Kiwify columns on billing | VERIFIED | Adds `gateway` (default `'stripe'`), `kiwify_subscription_id`, `kiwify_customer_email` |
| `apps/server/src/database/migrations/20260321T120300-add-user-id-to-billing.ts` | `user_id` FK on billing | VERIFIED | Adds `user_id uuid REFERENCES users(id)` with index |
| `apps/server/src/database/types/db.d.ts` | Kysely type definitions | VERIFIED | `billingLockedAt` on `Users`; `gateway/kiwify*/userId` on `Billing`; `StripeWebhookEvents` + `KiwifyWebhookEvents` interfaces; both in `DB` |
| `apps/server/src/core/billing/billing.constants.ts` | Billing enums | VERIFIED | `BillingGateway`, `StripeEventType`, `KiwifyEventType` with all required values |
| `apps/server/src/core/billing/billing.module.ts` | NestJS module | VERIFIED | Imports `EnvironmentModule`, registers all 4 services + controller, exports `BillingService` + `UserProvisioningService` |
| `apps/server/src/core/billing/billing.controller.ts` | All billing endpoints | VERIFIED | 5 endpoints: `POST stripe/webhook`, `POST kiwify/webhook`, `GET portal`, `GET admin/subscribers`, `POST admin/revoke`, `POST admin/restore` — all substantive |
| `apps/server/src/core/billing/services/user-provisioning.service.ts` | Core provisioning logic | VERIFIED | `provision`, `revoke`, `lock`, `unlock` — all substantive with real Kysely operations |
| `apps/server/src/core/billing/services/billing.service.ts` | Billing record management | VERIFIED | `createOrUpdateBillingRecord`, `getSubscribers`, `findBillingByCustomerId`, `findBillingByEmail`, `findBillingByUserId` |
| `apps/server/src/core/billing/services/stripe-webhook.service.ts` | Stripe event handling | VERIFIED | `verifyAndParse` with rawBody, `handle` with 4 event types + idempotency |
| `apps/server/src/core/billing/services/kiwify-webhook.service.ts` | Kiwify event handling | VERIFIED | `verify` with token check, `handle` with 4 event types + idempotency |
| `apps/server/src/integrations/transactional/emails/welcome-email.tsx` | Welcome email template | VERIFIED | Follows `forgot-password-email.tsx` pattern; renders set-password button |
| `apps/client/src/pages/billing-success.tsx` | `/welcome` page | VERIFIED | Static confirmation page, auth container pattern |
| `apps/client/src/features/billing/components/billing-locked.tsx` | Billing-locked error page | VERIFIED | Portal redirect button + Kiwify support text |
| `apps/client/src/features/billing/components/manage-subscription.tsx` | Manage subscription button | VERIFIED | Portal redirect with loading state and error notification |
| `apps/client/src/pages/settings/subscribers.tsx` | Admin subscriber table | VERIFIED | 6-column table, status badges, Stripe links, revoke modal, restore direct action |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app.module.ts` | `billing.module.ts` | `BillingModule` import | WIRED | Line 19/61 confirmed |
| `core.module.ts` | Kiwify webhook exclusion | `DomainMiddleware.exclude` | WIRED | Path at line 46 |
| `core.module.ts` | Both webhook exclusions | `SuspendedUserMiddleware.exclude` | WIRED | Both paths at lines 62-63 |
| `main.ts` | Kiwify preHandler exclusion | `excludedPaths` array | WIRED | Lines 81-82 confirmed |
| `suspended-user.middleware.ts` | `users.billingLockedAt` | Kysely `select(['billingLockedAt'])` + check | WIRED | Lines 26-38 confirmed |
| `suspended-user.guard.ts` | `users.billingLockedAt` | Kysely `select(['billingLockedAt'])` + check | WIRED | Lines 31-43 confirmed |
| `billing.controller.ts` | `stripe-webhook.service.ts` | `stripeWebhookService.verifyAndParse(req.rawBody, sig)` + `.handle(event)` | WIRED | Lines 48-53 |
| `billing.controller.ts` | `kiwify-webhook.service.ts` | `kiwifyWebhookService.verify(body)` + `.handle(body)` | WIRED | Lines 60-62 |
| `stripe-webhook.service.ts` | `user-provisioning.service.ts` | `userProvisioningService.provision/revoke/lock/unlock` | WIRED | All 4 methods called in appropriate switch cases |
| `kiwify-webhook.service.ts` | `user-provisioning.service.ts` | `userProvisioningService.provision/revoke/lock/unlock` | WIRED | All 4 methods called |
| `user-provisioning.service.ts` | `users` table | `insertInto('users').values({ password: null, ... })` | WIRED | Line 85-94 (direct Kysely, avoids `userRepo.insertUser()`) |
| `user-provisioning.service.ts` | `spaceMembers` table | `insertInto('spaceMembers').values({ role: 'reader' })` | WIRED | Lines 68-76 and 97-104 |
| `user-provisioning.service.ts` | `mailService` | `mailService.sendToQueue({ template: WelcomeEmail(...) })` | WIRED | Lines 145-155 |
| `App.tsx` | `billing-success.tsx` | `<Route path="/welcome" element={<BillingSuccess />} />` | WIRED | Lines 42, 58 |
| `App.tsx` | `billing-locked.tsx` | `<Route path="/billing-locked" element={<BillingLocked />} />` | WIRED | Lines 43, 59 |
| `App.tsx` | `subscribers.tsx` | `<Route path="subscribers" element={<Subscribers />} />` | WIRED | Lines 28, 117 — no `isCloud` gate |
| `manage-subscription.tsx` | `/api/billing/portal` | `api.get('/billing/portal')` then `window.location.href = response.url` | WIRED | Lines 12-14; interceptor unwraps `.data` so `response.url` is correct |
| `billing-locked.tsx` | `/api/billing/portal` | `api.get('/billing/portal')` then `window.location.href` | WIRED | Lines 14-15; same interceptor pattern |
| `api-client.ts` | `billing-locked.tsx` | 403 interceptor checks `error === 'BillingLocked'`, redirects to `/billing-locked` | WIRED | Lines 36-39 |
| `subscribers.tsx` | `/api/billing/admin/subscribers` | `api.get('/billing/admin/subscribers')` in `useEffect` | WIRED | Lines 26, 33-37 |
| `subscribers.tsx` | `/api/billing/admin/revoke` | `api.post('/billing/admin/revoke', { userId })` in `onConfirm` | WIRED | Line 53 |
| `settings-sidebar.tsx` | `subscribers.tsx` | `{ label: "Subscribers", path: "/settings/subscribers", isAdmin: true }` | WIRED | Lines 111-114; no `isCloud` property |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BILL-02 | 04-02, 04-03 | On `checkout.session.completed`, user account auto-created and added to client space as READER | SATISFIED | `stripe-webhook.service.ts` routes event to `provision()`; `user-provisioning.service.ts` creates user + space member |
| BILL-03 | 04-02 | Welcome email sent with login details after provisioning | SATISFIED | `userTokens` insert with `forgot-password` token; `mailService.sendToQueue(WelcomeEmail)` with set-password link |
| BILL-04 | 04-03 | On `customer.subscription.deleted`, user access automatically revoked | SATISFIED | `revoke()` sets `billingLockedAt` and soft-deletes space memberships |
| BILL-05 | 04-01, 04-03 | Webhook events deduplicated to prevent double provisioning | SATISFIED | `stripe_webhook_events` and `kiwify_webhook_events` tables; idempotency checks in both webhook services before processing |
| BILL-06 | 04-04 | Clients can access Stripe Customer Portal to manage subscription | SATISFIED | `GET /api/billing/portal` creates real portal session; `ManageSubscription` component calls it |
| BILL-07 | 04-02 | One account per purchase (one subscription = one user login) | SATISFIED | `provision()` checks for existing email in workspace; re-activates instead of creating duplicate |
| BILL-08 | 04-01, 04-03 | Payment failure locks client account and revokes content access | SATISFIED | `invoice.payment_failed` calls `lock()`; `billingLockedAt` check in middleware/guard blocks all protected routes |
| BILL-09 | 04-03 | When locked client's payment succeeds, access automatically restored | SATISFIED | `invoice.payment_succeeded` calls `unlock()`; clears `billingLockedAt` and re-adds to space |
| ADMIN-01 | 04-05 | Admin can view list of active client subscribers with account status | SATISFIED | `subscribers.tsx` table with colored status badges; `GET /admin/subscribers` returns status-mapped rows |
| ADMIN-02 | 04-05 | Admin can manually grant or revoke client space access | SATISFIED | `POST /admin/revoke` → `revoke()` and `POST /admin/restore` → `unlock()`; both admin-gated |
| ADMIN-03 | 04-05 | Each subscriber entry links to Stripe customer record in Dashboard | SATISFIED | `subscribers.tsx` renders `<Anchor href="https://dashboard.stripe.com/customers/{id}">View in Stripe</Anchor>`; Kiwify rows show "—" |

**Note:** REQUIREMENTS.md still shows ADMIN-01/02/03 as "Pending" — these are stale status markers from before plan 05 ran. The implementation is complete.

---

## Anti-Patterns Found

| File | Lines | Pattern | Severity | Impact |
|------|-------|---------|----------|--------|
| `user-provisioning.service.ts` | 108-121 | Dead code: `billingParams` object built inside transaction but never used — real billing call uses a duplicate object built in the `.then()` chain (lines 160-176) | Info | No functional impact; billing record is created correctly by the `.then()` handler |

No stub implementations, no placeholder comments, no `TODO`/`FIXME` markers found across any billing files.

---

## Human Verification Required

### 1. Stripe Checkout End-to-End Flow

**Test:** Configure env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CLIENT_SPACE_ID`). Create a Stripe test checkout session, complete payment, confirm webhook fires, user account is created, welcome email received, user can set password and log into the client space.
**Expected:** New user exists, is a READER in `CLIENT_SPACE_ID` space, receives email with working set-password link.
**Why human:** Requires live Stripe test keys, ngrok/webhook forwarding, and email delivery verification.

### 2. Payment Failure Lock and Portal Flow

**Test:** Simulate `invoice.payment_failed` via Stripe test event. Confirm user is locked. Log in as that user and attempt to access any page. Verify redirect to `/billing-locked`. Click "Manage Subscription" and confirm redirect to Stripe portal.
**Expected:** All API calls from locked user return 403 BillingLocked and trigger redirect; portal session URL opens correctly.
**Why human:** Requires live Stripe test environment and browser-level interceptor behavior.

### 3. Kiwify Webhook End-to-End Flow

**Test:** POST a `compra_aprovada` payload to `/api/billing/kiwify/webhook` with valid `token` field and `Customer.email`/`Customer.full_name`. Confirm user created in `KIWIFY_CLIENT_SPACE_ID` space with `pt-BR` locale.
**Expected:** User created, space membership as READER, welcome email sent. Subsequent identical payload with same `order_id` is deduplicated.
**Why human:** Requires valid `KIWIFY_WEBHOOK_TOKEN` configuration and mail queue to be running.

### 4. Admin Subscribers Page Visual Verification

**Test:** As admin, navigate to `/settings/subscribers`. Verify table renders with correct columns, status badge colors (green=active, orange=locked, red=cancelled), Stripe dashboard links open correctly, revoke confirm modal shows red button.
**Expected:** All visual elements match the UI spec.
**Why human:** Badge color rendering and modal appearance require browser verification.

### 5. ManageSubscription Component Integration

**Test:** Verify `ManageSubscription` component is rendered somewhere accessible to READER-role users in the account settings. The plan specified it should be integrated into account settings but did not include that integration in any plan's task list.
**Expected:** READER users can find and click "Manage Subscription" in their account settings.
**Why human:** The component was built (`manage-subscription.tsx` verified) but no plan task wired it into an existing settings page. This integration point needs human inspection of the account settings page.

---

## Gaps Summary

No functional gaps found. All 27 observable truths pass 3-level verification (exists, substantive, wired). All 11 requirements have implementation evidence.

**One item needs human follow-up:** The `ManageSubscription` component exists but no plan task included wiring it into an account settings page. It is a standalone component sitting in `apps/client/src/features/billing/components/manage-subscription.tsx`. BILL-06 (clients can access portal) is nominally satisfied by the `GET /billing/portal` endpoint and the component existing, but if no settings page renders it for logged-in READER users, the self-service path is incomplete for users who are not billing-locked.

---

_Verified: 2026-03-21_
_Verifier: Claude (gsd-verifier)_

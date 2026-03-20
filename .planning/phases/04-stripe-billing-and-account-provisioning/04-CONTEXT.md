# Phase 4 Context: Stripe Billing and Account Provisioning

## Phase Goal
Prospective clients can self-serve purchase access via Stripe (EN market) or Kiwify (BR market); accounts are provisioned automatically; subscriptions are managed end-to-end including payment failures and cancellations.

## Requirements Covered
BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06, BILL-07, BILL-08, BILL-09, ADMIN-01, ADMIN-02, ADMIN-03

---

## 1. Checkout Entry Point

**Decision: External landing page → Stripe Checkout link (no pricing page inside the app)**
- Purchase starts from an external site (not built in this phase)
- Stripe handles the checkout UI entirely — we only handle the post-payment webhook and redirect
- Brazilian clients purchase via Kiwify (separate flow, same backend provisioning logic)

**Post-payment redirect: `/welcome` page in the React app**
- Simple confirmation page: "Payment received. Check your email for your login link."
- No action required on this page — purely informational
- Route: `/welcome` — public (no auth required)

**Customer Portal entry point: in client's account settings**
- Once logged in, READER-role users see a "Manage Subscription" button in Account Settings
- Button calls `/api/billing/portal` → redirects to Stripe Customer Portal
- Kiwify subscriptions: no portal link (Kiwify manages cancellation on their side)

---

## 2. Account Provisioning Flow

**Decision: Magic link (set-password) on account creation**
- Webhook creates user with no password set
- Sends a welcome email containing a one-time set-password link
- Client clicks link, sets their password, then logs in
- Use Docmost's existing password-reset token mechanism for the set-password link

**Account name: email prefix**
- Display name = part before `@` in their email (e.g., `john.smith` from `john.smith@agency.com`)
- Client can update from account settings after login

**Duplicate email handling: reactivate existing account**
- If a user with that email already exists (previously cancelled/re-subscribing):
  - Clear `billingLockedAt` if set
  - Re-add them to the client space with READER role
  - Link new Stripe/Kiwify subscription to their existing account
  - Send welcome-back email (same set-password template is fine)
- Do NOT create a duplicate account

**Welcome email content:**
- Set-password magic link
- Portal URL (the app URL after they've logged in)
- Keep it minimal and actionable

---

## 3. Space + Subscription Mapping

**Gateway → Market → Space separation:**

| Gateway | Market | Space env var |
|---------|--------|---------------|
| Stripe | EN (non-BR) | `CLIENT_SPACE_ID` |
| Kiwify | BR (pt-BR) | `KIWIFY_CLIENT_SPACE_ID` |

- All Stripe webhook provisioning → EN client space (`CLIENT_SPACE_ID`)
- All Kiwify webhook provisioning → PT-BR client space (`KIWIFY_CLIENT_SPACE_ID`)
- No locale detection needed at webhook time — gateway identity determines language
- Both env vars are UUIDs of the respective client spaces

**Space role: READER** — same as manually-added client users

---

## 4. Payment Failure & Account Locking

**Decision: Separate `billingLockedAt` field (not reuse `suspendedAt`)**
- Add `billingLockedAt timestamptz` column to users table (nullable)
- JWT strategy checks both `suspendedAt` (3-strike ban) AND `billingLockedAt` (billing failure)
- Either field set → access denied
- Admin reinstating a strike ban does NOT clear a billing lock (separate concerns)

**Payment failure UX (BILL-08):**
- After login attempt: redirect to a dedicated page explaining payment failure
- Page shows: "Your subscription payment failed. Update your payment method to restore access." + Stripe Customer Portal button
- Kiwify users: same message but no portal button (contact support)

**Cancellation (BILL-04): remove from space + disable account**
- On `customer.subscription.deleted` (Stripe) or `subscription_canceled` (Kiwify):
  - Remove user from client space (SpaceMember record deleted)
  - Set `billingLockedAt = now()`
  - User can't log in; they see a "Your subscription has ended" message if they try

**Payment restored (BILL-09): automatic unlock**
- On `invoice.payment_succeeded` after failure (Stripe) or `subscription_renewed` (Kiwify):
  - Clear `billingLockedAt = null`
  - Re-add to client space if they were removed
  - No email needed (access silently restored)

**Subscription data storage: billing table only**
- All Stripe subscription data stays in the existing `billing` table
- Link user to billing record via `stripe_customer_id` stored on billing table
- Do NOT add billing columns to the users table
- For Kiwify: add a `kiwify_subscription_id` and `kiwify_customer_email` to billing table (or a separate `kiwify_billing` table — planner decides)

---

## 5. Webhook Architecture

### Stripe Webhook
- **Endpoint**: `POST /api/billing/stripe/webhook` (already wired in main.ts — raw body required)
- **Verification**: Stripe signature via `stripe.webhooks.constructEvent()` + `STRIPE_WEBHOOK_SECRET` env var
- **Events handled**:
  - `checkout.session.completed` → provision user
  - `customer.subscription.deleted` → revoke access + lock
  - `invoice.payment_failed` → set `billingLockedAt`
  - `invoice.payment_succeeded` → clear `billingLockedAt` + restore space membership

### Kiwify Webhook
- **Endpoint**: `POST /api/billing/kiwify/webhook`
- **Verification**: Compare `payload.token` against `KIWIFY_WEBHOOK_TOKEN` env var — reject 401 if mismatch
- **Events handled**:
  - `compra_aprovada` → provision user
  - `subscription_canceled` → revoke access + lock
  - `subscription_late` → set `billingLockedAt`
  - `subscription_renewed` → clear `billingLockedAt` + restore space membership
- **Customer data from payload**: `customer.name` and `customer.email` (full name available — use directly, no email-prefix needed)

### Shared UserProvisioningService
Both webhook handlers call one shared service:
```
UserProvisioningService.provision({ email, name, spaceId, gatewayCustomerId, gateway })
UserProvisioningService.revoke({ email })
UserProvisioningService.lock({ email })
UserProvisioningService.unlock({ email })
```
- Handles create-or-reactivate logic
- Sends welcome email
- Assigns READER role to target space

---

## 6. Webhook Idempotency (BILL-05)

**Decision: `stripe_webhook_events` dedup table**
- New migration: `stripe_webhook_events` table with `event_id` (unique), `processed_at`
- Before processing any Stripe event: check if `event_id` already in table → skip if yes
- Insert `event_id` after successful processing
- For Kiwify: use `kiwify_webhook_events` table with `order_id` as dedup key (Kiwify doesn't have a global event ID, but `id` in the sale payload is unique per order)

---

## 7. Admin Subscriber View (ADMIN-01, ADMIN-02, ADMIN-03)

**Location: existing admin panel — new "Subscribers" tab (or section)**
- Pattern: follow the "Security" tab added in Phase 3
- Route: `/settings/subscribers` or `/settings/billing` in admin settings

**Columns in subscriber list:**
- Email, Name, Gateway (Stripe/Kiwify), Status (active/locked/cancelled), Stripe Customer link
- "Revoke Access" button → calls `UserProvisioningService.revoke()` (ADMIN-02)
- "Restore Access" button → calls `UserProvisioningService.unlock()` + re-adds to space (ADMIN-02)
- Stripe Customer link opens `https://dashboard.stripe.com/customers/{stripe_customer_id}` (ADMIN-03)

---

## 8. Required New Env Vars

```
# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...            # The price ID for the EN subscription
CLIENT_SPACE_ID=<uuid>               # UUID of the EN client space

# Kiwify
KIWIFY_WEBHOOK_TOKEN=<token>         # Token to verify Kiwify webhook authenticity
KIWIFY_CLIENT_SPACE_ID=<uuid>        # UUID of the PT-BR client space

# App
APP_URL=https://your-app.railway.app  # Used for set-password links in welcome emails
```

---

## 9. Pre-existing Infrastructure to Reuse

- `billing` table already exists (migration `20250106T195516`) with Stripe fields
- `BILLING_QUEUE`, `WELCOME_EMAIL`, `FIRST_PAYMENT_EMAIL` jobs already defined in queue constants
- Stripe webhook path already configured in `main.ts` (raw body parser exclusion)
- `ee/billing/` client components exist (billing-plans, billing-portal, manage-billing) — may need adaptation
- `suspendedAt` pattern from Phase 3 is the template for `billingLockedAt`

---

## 10. Out of Scope for This Phase

- Kiwify Customer Portal (not available via Kiwify API for external redirect)
- Trial periods (BILL-V2-02 — deferred)
- Per-seat pricing (BILL-V2-01 — deferred)
- Automated refunds (BILL-V2-03 — deferred)
- Zapier/ActiveCampaign integrations with Kiwify

---

*Context captured: 2026-03-20*
*Gray areas discussed: Checkout entry, Account provisioning, Space mapping, Payment locking, Kiwify integration*

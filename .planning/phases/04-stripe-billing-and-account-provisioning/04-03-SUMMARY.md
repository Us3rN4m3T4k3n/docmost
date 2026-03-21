---
plan: 04-03
phase: 04
status: complete
completed_at: 2026-03-21
---

# Plan 04-03 Summary: Stripe + Kiwify Webhook Handlers

## What Was Built

- `apps/server/src/core/billing/services/stripe-webhook.service.ts` — Stripe webhook handler with signature verification (rawBody + STRIPE_WEBHOOK_SECRET), idempotency via `stripe_webhook_events` table, and routing for 4 event types: `checkout.session.completed` → provision, `customer.subscription.deleted` → revoke, `invoice.payment_failed` → lock, `invoice.payment_succeeded` → unlock
- `apps/server/src/core/billing/services/kiwify-webhook.service.ts` — Kiwify webhook handler with token verification (payload.token vs KIWIFY_WEBHOOK_TOKEN), idempotency via `kiwify_webhook_events` table, and routing for 4 event types: `compra_aprovada` → provision (using Customer.full_name), `subscription_canceled` → revoke, `subscription_late` → lock, `subscription_renewed` → unlock
- `apps/server/src/core/billing/billing.controller.ts` — Both webhook stubs replaced with real service delegation
- `apps/server/src/core/billing/billing.module.ts` — Registered both new services as providers
- `apps/server/src/integrations/environment/environment.service.ts` — Added `getKiwifyWebhookToken()` getter

## Commits

- `ca8ae460`: feat(04-03): StripeWebhookService and KiwifyWebhookService with idempotency

## Key Decisions

- Workspace ID resolved at runtime via `SELECT id FROM workspaces LIMIT 1` (single-tenant app)
- Kiwify event type extracted from `payload.webhook_event_type ?? payload.order_status ?? payload.event_type`
- Pre-existing TS errors in `token.service.ts` and security module (not from this plan) excluded from scope

## Requirements Covered

- BILL-02: checkout.session.completed provisions user account
- BILL-04: customer.subscription.deleted / subscription_canceled revokes access
- BILL-05: Idempotency via dedup tables for both gateways
- BILL-08: invoice.payment_failed / subscription_late sets billingLockedAt
- BILL-09: invoice.payment_succeeded / subscription_renewed clears billingLockedAt

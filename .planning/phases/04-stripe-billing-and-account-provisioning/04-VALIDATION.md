---
phase: 4
slug: stripe-billing-and-account-provisioning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (server) + Vitest (client) |
| **Config file** | `apps/server/jest.config.ts` / `apps/client/vite.config.ts` |
| **Quick run command** | `cd apps/server && npx jest --testPathPattern=billing --passWithNoTests` |
| **Full suite command** | `cd apps/server && npx jest --passWithNoTests && cd ../client && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/server && npx jest --testPathPattern=billing --passWithNoTests`
- **After every plan wave:** Run full suite (server jest + client vitest)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-W0-01 | Wave 0 | 0 | BILL-02, BILL-04, BILL-09 | unit | `npx jest apps/server/src/core/billing/services/user-provisioning.service.spec.ts` | ❌ W0 | ⬜ pending |
| 4-W0-02 | Wave 0 | 0 | BILL-05 | unit | `npx jest apps/server/src/core/billing/services/stripe-webhook.service.spec.ts` | ❌ W0 | ⬜ pending |
| 4-W0-03 | Wave 0 | 0 | BILL-08 | unit | `npx jest apps/server/src/common/middlewares/suspended-user.middleware.spec.ts` | ❌ W0 | ⬜ pending |
| 4-W0-04 | Wave 0 | 0 | ADMIN-01, ADMIN-02 | unit (vitest) | `cd apps/client && npx vitest run src/pages/settings/subscribers.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/server/src/core/billing/services/user-provisioning.service.spec.ts` — stubs for BILL-02, BILL-04, BILL-09 (provision, revoke, unlock)
- [ ] `apps/server/src/core/billing/services/stripe-webhook.service.spec.ts` — stubs for BILL-05 (idempotency dedup)
- [ ] `apps/server/src/common/middlewares/suspended-user.middleware.spec.ts` — stubs for BILL-08 (billingLockedAt check)
- [ ] `apps/client/src/pages/settings/subscribers.test.tsx` — stubs for ADMIN-01, ADMIN-02; follow `content-security.test.tsx` Mantine mock patterns

*Wave 0 plan creates these stub files so all subsequent plans execute TDD (RED → GREEN).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Welcome email sends set-password link | BILL-03 | Email delivery requires live SMTP or Ethereal | Trigger provisioning in dev, check mail logs for `UserTokenType.FORGOT_PASSWORD` token in email body |
| Stripe Customer Portal redirect | BILL-06 | Requires Stripe test mode dashboard | Call `/api/billing/portal` with a test stripe_customer_id, verify redirect URL contains `billing.stripe.com` |
| Kiwify token verification rejects invalid token | BILL-02 (Kiwify) | HTTP integration test | POST to `/api/billing/kiwify/webhook` with wrong token, verify 401 response |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

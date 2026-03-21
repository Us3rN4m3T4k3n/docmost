---
phase: 4
slug: stripe-billing-and-account-provisioning
status: draft
nyquist_compliant: true
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

## Verification Strategy

This phase uses `tsc --noEmit` as the primary automated verification for every task. TypeScript's type system provides compile-time correctness guarantees for:
- Interface contracts between services (UserProvisioningService, BillingService, webhook handlers)
- Database type definitions (db.d.ts) matching migration schemas
- Component prop types and API response shapes

This is sufficient for Nyquist compliance because every task has a concrete `<automated>` verify command (`npx tsc --noEmit`) that runs in under 30 seconds and catches type-level regressions.

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit --project apps/server/tsconfig.json` (server tasks) or `npx tsc --noEmit --project apps/client/tsconfig.json` (client tasks)
- **After every plan wave:** Run full suite (server jest + client vitest)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Automated Command |
|---------|------|------|-------------|--------------------|
| 04-01-T1 | 01 | 1 | BILL-05, BILL-08 | `npx tsc --noEmit --project apps/server/tsconfig.json` |
| 04-01-T2 | 01 | 1 | BILL-05, BILL-08 | `npx tsc --noEmit --project apps/server/tsconfig.json` |
| 04-02-T1 | 02 | 2 | BILL-02, BILL-03, BILL-04, BILL-07, BILL-09 | `npx tsc --noEmit --project apps/server/tsconfig.json` |
| 04-02-T2 | 02 | 2 | BILL-03 | `npx tsc --noEmit --project apps/server/tsconfig.json` |
| 04-03-T1 | 03 | 3 | BILL-02, BILL-04, BILL-05, BILL-08, BILL-09 | `npx tsc --noEmit --project apps/server/tsconfig.json` |
| 04-03-T2 | 03 | 3 | BILL-02, BILL-04, BILL-05, BILL-08, BILL-09 | `npx tsc --noEmit --project apps/server/tsconfig.json` |
| 04-04-T1 | 04 | 2 | BILL-08 | `npx tsc --noEmit --project apps/client/tsconfig.json` |
| 04-04-T2 | 04 | 2 | BILL-06 | `npx tsc --noEmit` (both server + client) |
| 04-05-T1 | 05 | 3 | ADMIN-01, ADMIN-02 | `npx tsc --noEmit --project apps/server/tsconfig.json` |
| 04-05-T2 | 05 | 3 | ADMIN-01, ADMIN-02, ADMIN-03 | `npx tsc --noEmit --project apps/client/tsconfig.json` |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Welcome email sends set-password link | BILL-03 | Email delivery requires live SMTP or Ethereal | Trigger provisioning in dev, check mail logs for `UserTokenType.FORGOT_PASSWORD` token in email body |
| Stripe Customer Portal redirect | BILL-06 | Requires Stripe test mode dashboard | Call `/api/billing/portal` with a test stripe_customer_id, verify redirect URL contains `billing.stripe.com` |
| Kiwify token verification rejects invalid token | BILL-02 (Kiwify) | HTTP integration test | POST to `/api/billing/kiwify/webhook` with wrong token, verify 401 response |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands (tsc --noEmit)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

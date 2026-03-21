---
phase: 5
slug: railway-production-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual smoke checks (curl + browser + Stripe Dashboard) — no automated tests for deployment ops |
| **Config file** | none — this phase is pure deployment operations |
| **Quick run command** | `curl -f https://client-production-dba5.up.railway.app/api/health/live` |
| **Full suite command** | All 6 curl/browser checks listed in Per-Task Verification Map |
| **Estimated runtime** | ~2 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Curl check against production URL where applicable
- **After every plan wave:** Run full smoke check suite (all 6 DEPLOY-* requirements)
- **Before `/gsd:verify-work`:** All 6 smoke checks must pass
- **Max feedback latency:** Manual — check after each deploy step

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | DEPLOY-01 | smoke | `curl -f https://client-production-dba5.up.railway.app/api/health/live` | manual | ⬜ pending |
| 5-01-02 | 01 | 1 | DEPLOY-05 | smoke | `curl -f https://client-production-dba5.up.railway.app/api/health` | manual | ⬜ pending |
| 5-01-03 | 01 | 1 | DEPLOY-04 | smoke | `curl -I https://client-production-dba5.up.railway.app/settings/account/profile` | manual | ⬜ pending |
| 5-01-04 | 01 | 1 | DEPLOY-03 | smoke | Upload file, redeploy, verify file still accessible | manual | ⬜ pending |
| 5-01-05 | 01 | 1 | DEPLOY-06 | smoke | Stripe Dashboard: Webhooks > endpoint > Send test webhook > checkout.session.completed | manual | ⬜ pending |
| 5-02-01 | 02 | 2 | DEPLOY-02 | smoke | `curl -f https://<collab-url>.up.railway.app/api/health/live` | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — this is a deployment-only phase. No new test files or test infrastructure are needed. All verification is operational smoke testing against the live Railway URL.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Railway URL loads without error | DEPLOY-01 | Live network check — not unit-testable | `curl -f https://client-production-dba5.up.railway.app/api/health/live` → expect `ok` |
| Two Railway services running | DEPLOY-02 | Railway dashboard state | Railway dashboard shows both main + collab services as "Active" |
| Files persist across redeploy | DEPLOY-03 | Requires actual redeploy cycle | Upload attachment, trigger redeploy, verify file URL still returns 200 |
| SPA refresh works | DEPLOY-04 | Browser behavior | Navigate to `/settings/account/profile`, refresh browser → expect app to load (not 404) |
| Health endpoint returns 200 | DEPLOY-05 | Live network check | `curl -f https://client-production-dba5.up.railway.app/api/health` → expect JSON with `status: "ok"` |
| Stripe webhook delivers | DEPLOY-06 | Stripe platform verification | Stripe Dashboard > Webhooks > [endpoint] > "Send test webhook" → expect 200 in response log |

---

## Validation Sign-Off

- [ ] All tasks have manual smoke check or Wave 0 dependencies
- [ ] Sampling continuity: checks after each wave
- [ ] Wave 0 covers all MISSING references (N/A — no Wave 0 needed)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5 minutes per wave
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

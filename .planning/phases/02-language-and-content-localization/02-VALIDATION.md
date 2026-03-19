---
phase: 2
slug: language-and-content-localization
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (NestJS) + Vitest (client) |
| **Config file** | `apps/server/jest.config.js` / `apps/client/vite.config.ts` |
| **Quick run command** | `cd apps/server && npx jest --testPathPattern="space\|locale\|auth" --no-coverage` |
| **Full suite command** | `cd apps/server && npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/server && npx jest --testPathPattern="space\|locale\|auth" --no-coverage`
- **After every plan wave:** Run `cd apps/server && npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 2-01-01 | 01 | 1 | LANG-01, LANG-05 | unit | `cd apps/server && npx jest space.service.spec --no-coverage` | pending |
| 2-01-02 | 01 | 1 | LANG-01, LANG-05 | compile | `npx tsc --noEmit --project apps/client/tsconfig.json` | pending |
| 2-02-01 | 02 | 1 | LANG-02 | unit | `cd apps/server && npx jest locale-detection.service.spec --no-coverage` | pending |
| 2-02-02 | 02 | 1 | LANG-02 | compile | `npx tsc --noEmit --project apps/server/tsconfig.json` | pending |

*Status: pending / green / red / flaky*

**Note:** LANG-03 (account language preference) is already implemented -- no new code or tests needed. LANG-04 (filtered visibility by language) is a Phase 4 deliverable that consumes the tagging infrastructure built here.

---

## Wave 0 Requirements

Wave 0 is resolved inline: Plan 02-01 Task 1 writes language-specific unit tests directly in `space.service.spec.ts` (tdd="true"), and Plan 02-02 Task 1 creates `locale-detection.service.spec.ts` as part of its TDD flow. No separate Wave 0 plan is needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Account language dropdown saves and immediately filters spaces | LANG-03 | Browser state + UI interaction | 1. Log in as PT-BR client. 2. Go to Settings > Language. 3. Change to EN. 4. Observe sidebar spaces update. |
| IP-based locale is set silently on first login | LANG-02 | Requires real IP or mock IP header | 1. Create user with null locale. 2. POST to `/auth/login` with `X-Forwarded-For: 189.28.0.0` (Brazil). 3. Verify `user.locale = 'pt-BR'` in DB. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or inline TDD
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 resolved inline (no separate plan needed)
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

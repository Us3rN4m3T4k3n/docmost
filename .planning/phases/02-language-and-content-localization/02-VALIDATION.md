---
phase: 2
slug: language-and-content-localization
status: draft
nyquist_compliant: false
wave_0_complete: false
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-00-01 | 00 | 0 | LANG-01 | unit | `cd apps/server && npx jest space.service.spec --no-coverage` | ❌ W0 | ⬜ pending |
| 2-00-02 | 00 | 0 | LANG-02 | unit | `cd apps/server && npx jest locale-detection.service.spec --no-coverage` | ❌ W0 | ⬜ pending |
| 2-01-01 | 01 | 1 | LANG-01 | unit | `cd apps/server && npx jest space.service.spec --no-coverage` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | LANG-05 | unit | `cd apps/server && npx jest space.service.spec --no-coverage` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | LANG-02 | unit | `cd apps/server && npx jest locale-detection.service.spec --no-coverage` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | LANG-03 | manual | N/A — browser account settings | N/A | ⬜ pending |
| 2-03-01 | 03 | 2 | LANG-04 | unit | `cd apps/server && npx jest space-member.repo.spec --no-coverage` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/server/src/core/space/space.service.spec.ts` — stub tests for `language` field on space create/update (LANG-01, LANG-05)
- [ ] `apps/server/src/integrations/locale/locale-detection.service.spec.ts` — stub tests for geo-IP detection, fallback to English, first-login-only behavior (LANG-02)
- [ ] `apps/server/src/database/repos/space/space-member.repo.spec.ts` — stub test confirming spaces filtered by language tag for client users (LANG-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Account language dropdown saves and immediately filters spaces | LANG-03 | Browser state + UI interaction | 1. Log in as PT-BR client. 2. Go to Settings > Language. 3. Change to EN. 4. Observe sidebar spaces update. |
| IP-based locale is set silently on first login | LANG-02 | Requires real IP or mock IP header | 1. Create user with null locale. 2. POST to `/auth/login` with `X-Forwarded-For: 189.28.0.0` (Brazil). 3. Verify `user.locale = 'pt-BR'` in DB. |
| PT-BR client cannot see EN-tagged spaces | LANG-04 | Browser rendering of space sidebar | 1. Log in as PT-BR client. 2. Verify only PT-BR spaces appear in sidebar. 3. Attempt to navigate to EN space URL directly — should get 403. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

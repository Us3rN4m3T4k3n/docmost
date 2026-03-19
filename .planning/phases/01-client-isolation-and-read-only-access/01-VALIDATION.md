---
phase: 1
slug: client-isolation-and-read-only-access
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (NestJS server only — no client test framework configured) |
| **Config file** | `apps/server/package.json` scripts |
| **Quick run command** | `cd apps/server && npx jest --testPathPattern="page" --no-coverage` |
| **Full suite command** | `cd apps/server && npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/server && npx jest --testPathPattern="page" --no-coverage`
- **After every plan wave:** Run `cd apps/server && npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full server suite green + manual spot-check of READER UI
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | ROLE-01, ISOL-01 | unit | `cd apps/server && npx jest space-ability --no-coverage` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | ISOL-03 | unit | `cd apps/server && npx jest page.controller --no-coverage` | ✅ (needs test added) | ⬜ pending |
| 1-02-01 | 02 | 1 | ISOL-03 | unit | `cd apps/server && npx jest page --no-coverage` | ✅ | ⬜ pending |
| 1-03-01 | 03 | 1 | ISOL-01, ISOL-02 | manual | Log in as Client — verify sidebar shows only client space | manual-only | ⬜ pending |
| 1-04-01 | 04 | 1 | ISOL-04 | manual | Log in as READER — verify no edit/delete/create buttons | manual-only | ⬜ pending |
| 1-05-01 | 05 | 1 | ISOL-05 | manual | Network tab — verify no WSS connection for Client user | manual-only | ⬜ pending |
| 1-06-01 | 06 | 1 | ROLE-02, ROLE-03 | manual | Log in as Staff — verify no billing/admin settings visible | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/server/src/core/casl/abilities/space-ability.factory.spec.ts` — unit tests for `buildSpaceReaderAbility`, `buildSpaceWriterAbility`, `buildSpaceAdminAbility` covering all CASL permission combinations (REQ: ROLE-01, ISOL-01)
- [ ] Extend `apps/server/src/core/page/page.controller.spec.ts` — add test case for `getPage` with mismatched workspaceId returning 404 (REQ: ISOL-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Editor chrome absent for READER | ISOL-04 | No client test framework | Open page as READER user, verify no edit/delete/create page buttons visible |
| No WebSocket connection for READER | ISOL-05 | Network-level behavior | Open Network tab → filter WSS → log in as Client → navigate to a page → confirm no WebSocket connection established |
| Client cannot see internal spaces | ISOL-02 | UI navigation | Log in as Client → verify sidebar shows only the designated client space |
| Admin can access billing/admin settings | ROLE-02 | UI navigation | Log in as Admin → verify /settings/billing and user management accessible |
| Staff cannot access billing/admin settings | ROLE-03 | UI navigation | Log in as Staff (MEMBER) → verify /settings/billing is inaccessible |
| Staff/Client badge visible in Users list | ROLE-01 | UI rendering | Log in as Admin → navigate to workspace member list → verify Staff and Client users show distinct labels/badges |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 04-05-PLAN.md
last_updated: "2026-03-21T10:02:53.233Z"
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 16
  completed_plans: 15
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** Paying clients can access the agency's SOPs in a protected, read-only environment they cannot easily copy or extract from.
**Current focus:** Phase 04 — Stripe Billing and Account Provisioning

## Current Position

Phase: 04 (Stripe Billing and Account Provisioning) — COMPLETE
Plan: 5 of 5 (complete)

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*
| Phase 02-language-and-content-localization P02 | 12 | 2 tasks | 5 files |
| Phase 02-language-and-content-localization P01 | 4 | 2 tasks | 8 files |
| Phase 03-content-protection P02 | 45 | 3 tasks | 9 files |
| Phase 03 P01 | 8 | 3 tasks | 7 files |
| Phase 03 P04 | 4 | 2 tasks | 4 files |
| Phase 03 P05 | 2 | 2 tasks | 3 files |
| Phase 04-stripe-billing-and-account-provisioning P01 | 3min | 2 tasks | 13 files |
| Phase 04 P02 | 2min | 2 tasks | 4 files |
| Phase 04 P04 | 15min | 2 tasks | 6 files |
| Phase 04 P05 | 10min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Fork Docmost: Editor quality (TipTap) and real-time collab already solved; no from-scratch build
- Client-side protection only: True DRM is impossible on web; goal is friction (watermark is enforcement)
- Separate spaces for internal vs external: Docmost's space model maps cleanly to isolation requirement
- Stripe for self-serve billing: Webhook-driven account provisioning; standard, well-supported
- ip-api.com HTTP (not HTTPS): HTTPS requires paid API key; HTTP is free and sufficient for locale detection
- Fire-and-forget geo-IP: .catch() swallows errors so login response is never blocked by geo-IP latency
- COUNTRY_LOCALE_MAP as module-level constant: easy to extend; currently BR->pt-BR, all others->en-US
- [Phase 02]: Static language list (en-US, pt-BR) for Phase 2 with TODO for dynamic API fetch in future
- [Phase 02]: Nullable language column with en-US code default: existing spaces get null in DB, service treats null as en-US
- [Phase 03-03]: Vitest chosen for client tests (Vite project, no Jest config existed); useAtom called before early return for React hooks compliance
- [Phase 03-03]: SVG tile 300x200px, -35 degrees, opacity 0.07 baked into fill (no CSS opacity to avoid double-reduction)
- [Phase 03-content-protection]: resetUserAttempts takes only userId — admin identity tracked via auth guard, not stored in attempt reset
- [Phase 03-content-protection]: Admin security endpoints in ScreenshotDetectionController (not separate AdminController) to keep SecurityModule cohesive
- [Phase 03-01]: protected boolean prop replaces isMember role gate in ScreenshotDetection: caller (page.tsx) controls role check via spaceAbility.cannot()
- [Phase 03-01]: logProtectionAttempt removed from ContentProtection.tsx: /api/security/protection-attempt not yet implemented, removing avoids console errors
- [Phase 03]: [Phase 03-04]: Mantine components mocked in vitest tests to avoid window.matchMedia jsdom limitation
- [Phase 03]: [Phase 03-04]: Table always renders column headers even for empty violations list — empty state shown as tbody row
- [Phase 03]: [Phase 03-05]: Hooks guard added inside useCallback/useEffect bodies — explicit isProtected guard as first line keeps handlers as safe no-ops when unprotected
- [Phase 03]: [Phase 03-05]: response.data?.status?.attemptCount ?? response.data?.attemptCount ?? 0 — defensive fallback chain reads correct nested API response field
- [Phase 04-01]: BillingModule registered at AppModule level (not CoreModule) — billing is top-level concern independent of domain middleware
- [Phase 04-01]: billingLockedAt check placed before suspendedAt in middleware/guard — billing lock is primary payment enforcement
- [Phase 04-01]: gateway column defaults to 'stripe' — existing billing rows remain valid without data migration
- [Phase 04]: Direct Kysely insert used for provisioned users — avoids hashPassword(null) in userRepo.insertUser()
- [Phase 04]: Billing record created after transaction commits (not inside) to avoid nested transaction issues
- [Phase 04]: Welcome email is fire-and-forget with .catch() — provision never blocks on email delivery
- [Phase 04-04]: BillingLocked page shows Stripe portal button + Kiwify support text — portal endpoint returns 400 for Kiwify users, button gracefully handles failure
- [Phase 04-04]: Portal endpoint instantiates Stripe per-request — simpler than injecting as provider for low-frequency access
- [Phase 04-04]: Used existing BillingService.findBillingByUserId (created in 04-02) in portal endpoint
- [Phase 04-05]: Status derivation (active/locked/cancelled) done in controller map() layer — keeps BillingService generic
- [Phase 04-05]: useEffect gates fetchSubscribers on isAdmin — prevents 403 fetch for non-admin users
- [Phase 04-05]: Subscribers sidebar entry has isAdmin only (no isCloud) — visible on self-hosted per CONTEXT.md Pattern 9

### Pending Todos

None yet.

### Blockers/Concerns

- **[Pre-Phase 1]** Content protection component gates on wrong role (`isMember` workspace-level instead of space READER) — must fix in Phase 1 before any client is onboarded
- **[Pre-Phase 1]** `PageRepo.findById()` lacks workspaceId filter — potential cross-workspace data leak; fix is Phase 1 scope
- **[Pre-Phase 4]** `stripe_webhook_events` dedup table does not exist — must create as first step of Phase 4
- **[Pre-Phase 5]** Railway Nixpacks/Dockerfile behavior is MEDIUM confidence — verify current Railway monorepo docs before configuring build pipeline
- **[Pre-Phase 5]** S3 must be configured before any content is added to production (Railway containers are ephemeral)

## Session Continuity

Last session: 2026-03-21T10:30:00.000Z
Stopped at: Completed 04-05-PLAN.md
Resume with: /gsd:execute-phase 5

---
phase: 03-content-protection
plan: 05
subsystem: client-react
tags: [hooks, react-rules-of-hooks, api-response, bug-fix, gap-closure]
dependency_graph:
  requires: [03-01, 03-02, 03-03, 03-04]
  provides: [hooks-compliant-content-protection, hooks-compliant-admin-panel, correct-suspension-status-check]
  affects: [ContentProtection.tsx, content-security.tsx, ScreenshotDetection.tsx]
tech_stack:
  added: []
  patterns: [hooks-before-early-returns, useEffect-guard-pattern, optional-chaining-with-fallback]
key_files:
  created: []
  modified:
    - apps/client/src/components/ContentProtection.tsx
    - apps/client/src/pages/settings/content-security.tsx
    - apps/client/src/components/ScreenshotDetection.tsx
decisions:
  - "Add isProtected guard as first line of each useCallback/useEffect body rather than relying solely on early return guards — keeps handlers safe if React ever re-orders hook calls"
  - "Inline fetchViolations inside useEffect rather than keeping it as a separate named function — avoids stale closure issues and keeps isAdmin dependency explicit"
  - "response.data?.status?.attemptCount ?? response.data?.attemptCount ?? 0 — defensive fallback chain handles both nested and flat response shapes, always yields a number"
metrics:
  duration: "2 minutes"
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_modified: 3
requirements_closed: [PROT-01, PROT-02, PROT-03, PROT-04, PROT-05, PROT-V2-02]
---

# Phase 03 Plan 05: Gap Closure — Hooks Violations and API Field Mismatch Summary

Fixed two blocking gaps identified in 03-VERIFICATION.md: React Rules of Hooks violations in ContentProtection.tsx (useCallback/useEffect after early return) and content-security.tsx (useEffect after conditional return), plus API response field mismatch in ScreenshotDetection.tsx where `response.data.attemptCount` was reading undefined instead of `response.data.status.attemptCount`.

## What Was Built

**Task 1 — React Rules of Hooks compliance (ContentProtection.tsx and content-security.tsx):**
Moved all hook declarations before conditional early returns in both files. In ContentProtection.tsx, 8 `useCallback` hooks and 2 `useEffect` hooks were executing after `if (!isProtected) { return <>{children}</>; }` at line 37 — a hard Rules of Hooks violation. The fix moves all hook declarations before that line and adds `if (!isProtected) return;` guards inside each callback/effect body so they no-op when protection is off. In content-security.tsx, the `useEffect` was after `if (!isAdmin) return null` at line 27. The fix moves useEffect before the early return with an `if (!isAdmin) return;` guard and inlines `fetchViolations` inside the effect with `isAdmin` in the dependency array.

**Task 2 — API response field access (ScreenshotDetection.tsx):**
Changed line 237 from `const { attemptCount } = response.data` to `const attemptCount = response.data?.status?.attemptCount ?? response.data?.attemptCount ?? 0`. The backend `GET /api/security/screenshot-status` returns `{ success: true, status: { attemptCount, suspended } }` — the `attemptCount` is nested under `.status`, not at the response root. The old code always read `undefined`, so suspended users would never see the account-locked modal on page load. The fix reads the correct nested path with a defensive fallback chain ensuring the value is always a number.

## Tasks Completed

| # | Task | Commit | Files Modified |
|---|------|--------|----------------|
| 1 | Fix React Rules of Hooks violations in ContentProtection.tsx and content-security.tsx | 83385bc0 | ContentProtection.tsx, content-security.tsx |
| 2 | Fix API response field access in ScreenshotDetection.tsx | 6df23b92 | ScreenshotDetection.tsx |

## Verification

All 18 tests across 3 test files pass:
- ContentProtection.test.tsx: 7/7 passed
- content-security.test.tsx: 6/6 passed
- ScreenshotDetection.test.tsx: 5/5 passed

Hook placement confirmed via grep:
- ContentProtection.tsx: all useCallback/useEffect at lines 37-277, `if (!isProtected)` early return at line 292
- content-security.tsx: useEffect at line 27, `if (!isAdmin)` early return at line 43

API field access confirmed:
- `response.data?.status?.attemptCount` present at line 237
- Old `const { attemptCount } = response.data` pattern gone

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added isProtected guard inside useCallback bodies**

- **Found during:** Task 1
- **Issue:** Plan specified moving hooks before early return and adding guard only in useEffect bodies. The useCallback handlers themselves also benefited from a `if (!isProtected) return;` guard so that even if somehow attached, they become safe no-ops when protection is off.
- **Fix:** Added `if (!isProtected) return;` as the first line of each useCallback body and added `isProtected` to each useCallback dependency array.
- **Files modified:** apps/client/src/components/ContentProtection.tsx
- **Commit:** 83385bc0

**2. [Rule 1 - Bug] Inlined handleReinstate API call instead of calling removed function**

- **Found during:** Task 1
- **Issue:** The plan said to inline `fetchViolations` inside useEffect and keep `handleReinstate` calling it. But since `fetchViolations` was now local to the useEffect, `handleReinstate` could not call it. The plan's instruction to "Keep the handleReinstate and formatDate functions after the early return" was followed but `handleReinstate` needed the API call inlined directly.
- **Fix:** Inlined the violations-fetch API call directly inside `handleReinstate` instead of calling a now-non-existent `fetchViolations` reference.
- **Files modified:** apps/client/src/pages/settings/content-security.tsx
- **Commit:** 83385bc0

## Key Decisions

1. Add `isProtected` guard inside each useCallback/useEffect body — keeps handlers safe as explicit no-ops even if React render semantics change.
2. Inline `fetchViolations` inside useEffect with `isAdmin` dependency — avoids stale closure issues; `handleReinstate` inlines the same API call.
3. Use `response.data?.status?.attemptCount ?? response.data?.attemptCount ?? 0` — defensive fallback chain handles both nested and flat response shapes, always yields a number without needing null checks downstream.

## Gap Closure Status

Both blocking gaps from 03-VERIFICATION.md are now resolved:

| Gap | Status | Evidence |
|-----|--------|---------|
| Rules of Hooks violations in ContentProtection.tsx | CLOSED | All hooks at lines 29-277, early return at line 292; 7 tests pass |
| Rules of Hooks violation in content-security.tsx | CLOSED | useEffect at line 27, early return at line 43; 6 tests pass |
| API response field mismatch in ScreenshotDetection.tsx | CLOSED | `response.data?.status?.attemptCount` at line 237; 5 tests pass |

Phase 03 verification score increases from 6/8 to 8/8 truths verified.

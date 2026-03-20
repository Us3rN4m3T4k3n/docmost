---
phase: "03"
plan: "03"
subsystem: "content-protection/watermark"
tags: ["watermark", "svg", "jotai", "vitest", "tdd", "content-protection"]
dependency_graph:
  requires: []
  provides: ["PROT-04"]
  affects: ["apps/client/src/components/ContentProtection.tsx", "apps/client/src/components/ContentProtection.css"]
tech_stack:
  added: ["vitest", "@testing-library/react", "@testing-library/jest-dom", "jsdom"]
  patterns: ["SVG data URI watermark", "Jotai useAtom for user email", "TDD with Vitest + jsdom"]
key_files:
  created: ["apps/client/src/components/ContentProtection.test.tsx", "apps/client/vitest.config.ts", "apps/client/src/test-setup.ts"]
  modified: ["apps/client/src/components/ContentProtection.tsx", "apps/client/src/components/ContentProtection.css", "apps/client/package.json"]
decisions:
  - "Vitest chosen over Jest because the client uses Vite — no Jest config existed, Vitest integrates natively"
  - "useAtom(userAtom) placed before the early return to comply with React hooks rules"
  - "SVG tile: 300x200px, -35 degree rotation, rgba(128,128,128,0.07) fill — within CONTEXT.md locked decision range"
  - "Opacity baked into SVG fill only — no CSS opacity on .content-watermark to avoid double-reduction"
metrics:
  duration: "7 minutes"
  completed: "2026-03-20"
  tasks_completed: 2
  files_changed: 6
---

# Phase 03 Plan 03: Watermark — Dynamic Diagonal Email Overlay Summary

**One-liner:** SVG data URI diagonal email watermark at -35 degrees with rgba(128,128,128,0.07) fill via fixed-position `.content-watermark` overlay div driven by `userAtom`.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Failing Vitest tests for buildWatermarkDataUri + watermark rendering | ca0abb6f | ContentProtection.test.tsx, vitest.config.ts, test-setup.ts, package.json |
| 1 (GREEN) | Implement buildWatermarkDataUri and watermark div in ContentProtection.tsx | a4fed80a | ContentProtection.tsx |
| 2 | Replace ::after placeholder with .content-watermark in ContentProtection.css | ae74a5d9 | ContentProtection.css |

## What Was Built

### `buildWatermarkDataUri(email: string): string`

Exported pure function that generates an SVG data URI:
- SVG dimensions: 300x200 (repeats naturally as CSS background tile)
- Text: user's email centered with `text-anchor='middle'`
- Rotation: `transform='rotate(-35 150 100)'` (industry-standard -35 degrees)
- Fill: `rgba(128,128,128,0.07)` — nearly invisible in normal reading, captured raw by screenshot tools
- Encoding: `encodeURIComponent` for safe CSS background-image URL

### ContentProtection.tsx changes

- Added `import { useAtom } from 'jotai'` and `import { userAtom } from '@/features/user/atoms/current-user-atom'`
- `useAtom(userAtom)` called before the early `!isProtected` return (React hooks compliance)
- `watermarkUri` computed: `isProtected ? buildWatermarkDataUri(userEmail) : null`
- Watermark `<div className="content-watermark" style={{ backgroundImage: `url("${watermarkUri}")` }} aria-hidden="true" />` rendered as sibling to `.content-protected` div
- Null user gracefully falls back to empty string email

### ContentProtection.css changes

- Removed: `.content-protected::after { content: attr(data-user-id); ... }` (corner-only, never dynamic)
- Added: `.content-watermark { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9998; mix-blend-mode: multiply; background-repeat: repeat; background-size: 300px 200px; }`

### Test Infrastructure (deviation: setup required)

No Vitest config existed in the client project. Set up:
- `vitest.config.ts` with jsdom environment, `@testing-library/react`, `@testing-library/jest-dom`
- `src/test-setup.ts` importing `@testing-library/jest-dom`
- `package.json` test script: `vitest run`

## TDD Verification

All 7 Nyquist tests pass:

1. `buildWatermarkDataUri` returns string starting with `data:image/svg+xml,`
2. Decoded SVG contains email string
3. Decoded SVG contains `rotate` with negative angle
4. Decoded SVG contains `rgba` fill with opacity between 0.05 and 0.10
5. `<ContentProtection protected={true}>` renders `.content-watermark` div in DOM
6. `<ContentProtection protected={false}>` does NOT render watermark div
7. `<ContentProtection protected={true}>` with null user still renders watermark div (graceful fallback)

## Plan Verification

```
1. Build: zero ContentProtection errors (pre-existing errors in unrelated files excluded)
2. Tests: all 7 pass
3. No old placeholder: grep data-user-id in CSS returns no results (only print ::after remains)
4. Watermark class: content-watermark and mix-blend-mode present in CSS
5. Email used: userAtom and buildWatermarkDataUri both present in ContentProtection.tsx
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest test infrastructure missing from client project**
- **Found during:** Task 1 (TDD RED phase setup)
- **Issue:** The client project had no test runner configured — no Jest, no Vitest. The plan's `npx nx test client --testFile=...` command would fail with "no test target".
- **Fix:** Installed Vitest + @testing-library/react + jsdom, created vitest.config.ts and test-setup.ts, added `test` script to package.json. Used `npx vitest run` directly instead of `nx test`.
- **Files modified:** apps/client/package.json, apps/client/vitest.config.ts, apps/client/src/test-setup.ts
- **Commit:** ca0abb6f

## Self-Check: PASSED

Files created/modified:
- apps/client/src/components/ContentProtection.tsx — FOUND
- apps/client/src/components/ContentProtection.css — FOUND
- apps/client/src/components/ContentProtection.test.tsx — FOUND
- apps/client/vitest.config.ts — FOUND
- apps/client/src/test-setup.ts — FOUND

Commits verified:
- ca0abb6f — FOUND (RED: failing tests)
- a4fed80a — FOUND (GREEN: implementation)
- ae74a5d9 — FOUND (CSS changes)

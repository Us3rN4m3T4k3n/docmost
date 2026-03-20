---
phase: 03-content-protection
plan: "02"
subsystem: database
tags: [kysely, nestjs, jwt, postgresql, tdd, jest, migrations]

# Dependency graph
requires:
  - phase: 03-content-protection
    provides: SecurityModule with ScreenshotDetectionController and in-memory service
provides:
  - screenshot_attempts Kysely migration and db.d.ts type registration
  - ScreenshotDetectionService fully backed by Kysely (no in-memory Map)
  - resetUserAttempts and getUsersWithViolations service methods
  - suspendedAt enforced in jwt.strategy.ts and token.service.ts
  - suspendedAt and suspensionReason in UserRepo.baseFields
  - Admin endpoints GET /api/security/violations and POST /api/security/reinstate/:userId
affects: [03-04-admin-panel, any phase that calls jwt.strategy, any phase that calls token.service]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Kysely queries using camelCase fields (CamelCasePlugin active)
    - KYSELY_TOKEN = 'KyselyModuleConnectionToken' in unit tests
    - @AuthUser() decorator replaces req.user?.userId extraction
    - suspendedAt checked alongside deactivatedAt everywhere user is validated

key-files:
  created:
    - apps/server/src/database/migrations/20260320T120000-create-screenshot-attempts.ts
    - apps/server/src/integrations/security/screenshot-detection.service.spec.ts
  modified:
    - apps/server/src/database/types/db.d.ts
    - apps/server/src/integrations/security/screenshot-detection.service.ts
    - apps/server/src/integrations/security/screenshot-detection.controller.ts
    - apps/server/src/integrations/security/content-protection.controller.ts
    - apps/server/src/core/auth/strategies/jwt.strategy.ts
    - apps/server/src/core/auth/services/token.service.ts
    - apps/server/src/database/repos/user/user.repo.ts

key-decisions:
  - "resetUserAttempts takes only userId (no adminId param) — admin identity tracked via auth guard, not logged in the attempt reset"
  - "getUserStatus returns { attemptCount, suspended } not the full UserScreenshotStatus interface — simpler shape for controller consumption"
  - "Admin endpoints placed in ScreenshotDetectionController (not a separate AdminController) to keep SecurityModule cohesive"
  - "getUsersWithViolations uses raw sql() for aggregate expressions (count, max) due to Kysely typed selectFrom limitations with group by"

patterns-established:
  - "Pattern: Unit test Kysely services using KYSELY_TOKEN = 'KyselyModuleConnectionToken' constant"
  - "Pattern: Build chainable Kysely mock with explicit chain objects (whereChain, setChain, etc.) and shared executeMock/executeTakeFirstMock"

requirements-completed: [PROT-V2-01]

# Metrics
duration: 45min
completed: 2026-03-20
---

# Phase 03 Plan 02: Backend DB Persistence Screenshot Attempts, Auth Fixes, Admin Endpoints Summary

**screenshot_attempts Kysely migration + DB-backed ScreenshotDetectionService with suspendedAt enforcement in jwt.strategy.ts, token.service.ts, and admin reinstatement endpoints**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-20T20:00:00Z
- **Completed:** 2026-03-20T20:45:00Z
- **Tasks:** 3 (Tasks 1 and 3 combined into one atomic commit; Task 2 TDD with full RED-GREEN cycle)
- **Files modified:** 9

## Accomplishments
- Replaced in-memory Map strike tracking with Kysely-backed screenshot_attempts table
- Fixed auth extraction bug in both security controllers (@AuthUser decorator)
- Added suspendedAt enforcement in jwt.strategy.ts and all 4 token generation methods
- Added suspendedAt and suspensionReason to UserRepo.baseFields so JWT lookups return them
- Created migration file and ScreenshotAttempts interface in db.d.ts
- Added admin endpoints GET /api/security/violations and POST /api/security/reinstate/:userId
- 6 unit tests covering all 5 Nyquist behaviors; all pass

## Task Commits

Each task was committed atomically:

1. **Task 1 + 3: Auth bugs + admin endpoints** - `2ba39d63` (fix)
2. **Task 2: Migration, db.d.ts, Kysely service, tests** - `81dde38d` (feat/TDD)

## Files Created/Modified
- `apps/server/src/database/migrations/20260320T120000-create-screenshot-attempts.ts` - New table migration with up/down
- `apps/server/src/database/types/db.d.ts` - Added ScreenshotAttempts interface + DB.screenshotAttempts
- `apps/server/src/integrations/security/screenshot-detection.service.ts` - Rewritten: Kysely queries, resetUserAttempts, getUsersWithViolations
- `apps/server/src/integrations/security/screenshot-detection.service.spec.ts` - 6 unit tests covering all 5 Nyquist behaviors
- `apps/server/src/integrations/security/screenshot-detection.controller.ts` - @AuthUser fix + admin violation/reinstate endpoints
- `apps/server/src/integrations/security/content-protection.controller.ts` - @AuthUser fix
- `apps/server/src/core/auth/strategies/jwt.strategy.ts` - Added user.suspendedAt to UnauthorizedException check
- `apps/server/src/core/auth/services/token.service.ts` - Added user.suspendedAt to all 4 token generation guards
- `apps/server/src/database/repos/user/user.repo.ts` - Added suspendedAt and suspensionReason to baseFields

## Decisions Made
- `resetUserAttempts` takes only `userId` — no `adminId` parameter needed since the admin identity is validated via the JwtAuthGuard + role check in the controller
- `getUserStatus` returns `{ attemptCount, suspended }` directly instead of the full legacy `UserScreenshotStatus` shape — simpler for controller and frontend to consume
- Admin endpoints placed in `ScreenshotDetectionController` (not a separate AdminController) to keep SecurityModule cohesive and avoid a new module registration
- `getUsersWithViolations` uses raw `sql()` expressions for aggregate GROUP BY queries because Kysely's typed selectFrom does not natively support complex aggregates with aliases without type widening

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Admin endpoints added during Task 1 (controller rewrite)**
- **Found during:** Task 1 (controller auth fix)
- **Issue:** Task 3 planned to add admin endpoints separately, but since the controller was being fully rewritten for Task 1 anyway, adding the endpoints in the same pass avoided a second full-file rewrite
- **Fix:** Included GET /violations and POST /reinstate/:userId in the Task 1 controller rewrite
- **Files modified:** apps/server/src/integrations/security/screenshot-detection.controller.ts
- **Verification:** TypeScript build passes; endpoints visible in controller
- **Committed in:** 2ba39d63 (Task 1 commit)

---

**Total deviations:** 1 (Tasks 1+3 merged into single atomic commit — no scope change)
**Impact on plan:** Efficient; no correctness or security impact. Admin endpoints shipped correctly.

## Issues Encountered
- `getKyselyToken()` does not exist in nestjs-kysely — the correct injection token is the string constant `'KyselyModuleConnectionToken'` (discovered from existing space.service.spec.ts pattern)
- The nx `--testFile` flag does not correctly filter to a single spec file; used `cd apps/server && npx jest --testPathPattern` for isolated runs
- db.d.ts was temporarily reverted by linter tool notification; re-applied immediately

## User Setup Required
None — the migration runs automatically via the Kysely migration runner. No environment variables or external services needed.

## Next Phase Readiness
- Admin endpoints are live and admin-gated: ready for 03-04 admin UI panel to consume
- suspendedAt enforcement is complete: suspended users will be blocked on every authenticated request and every token generation
- screenshot_attempts table schema exists; migration just needs to run on the actual DB
- 03-03 (watermark) and 03-04 (admin panel) can proceed in parallel now

---
*Phase: 03-content-protection*
*Completed: 2026-03-20*

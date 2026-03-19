---
phase: 02-language-and-content-localization
plan: 01
subsystem: database, api, ui
tags: [kysely, migration, nestjs, dto, mantine, react, typescript, space, language]

# Dependency graph
requires: []
provides:
  - Kysely migration adding nullable language varchar column to spaces table
  - Updated Spaces db.d.ts interface with language: string | null
  - CreateSpaceDto with required language field validated by @IsNotEmpty
  - SpaceService create() and updateSpace() passing language through to SpaceRepo
  - Language Select dropdown in both CreateSpaceForm and EditSpaceForm (en-US, pt-BR)
  - ISpace client type extended with optional language field
affects:
  - 04-client-access-control
  - any phase consuming space creation or space settings UI

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nullable DB column with code-level default: nullable varchar in migration, en-US default in service layer"
    - "DTO inheritance via PartialType: language optional on UpdateSpaceDto without modifying it"
    - "Dirty-check pattern on edit forms: only include changed fields in PATCH payload"

key-files:
  created:
    - apps/server/src/database/migrations/20260319T120000-add-language-to-spaces.ts
  modified:
    - apps/server/src/database/types/db.d.ts
    - apps/server/src/core/space/dto/create-space.dto.ts
    - apps/server/src/core/space/services/space.service.ts
    - apps/server/src/core/space/services/space.service.spec.ts
    - apps/server/src/core/workspace/services/workspace.service.ts
    - apps/client/src/features/space/types/space.types.ts
    - apps/client/src/features/space/components/create-space-form.tsx
    - apps/client/src/features/space/components/edit-space-form.tsx

key-decisions:
  - "Static language list for Phase 2: en-US and pt-BR only, with TODO comment for dynamic API fetch in future phases"
  - "Nullable language column with en-US code default: existing spaces get null in DB, service treats null as en-US"
  - "language required on CreateSpaceDto (not optional): enforces tagging at creation time for new spaces"

patterns-established:
  - "Migration pattern: alterTable addColumn for nullable columns"
  - "TDD approach: write failing tests before implementation for service-layer behavior"

requirements-completed: [LANG-01, LANG-03, LANG-05]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 02 Plan 01: Add Language Column to Spaces Summary

**Kysely migration + DTO/service wiring for space language tagging, with required Language Select dropdown in create/edit UI forms (en-US, pt-BR)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T22:35:14Z
- **Completed:** 2026-03-19T22:39:14Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Migration file creates nullable `language` varchar column on spaces table (existing rows get null, code treats as en-US)
- Server DTO, service, and type layer fully wired: CreateSpaceDto requires language, UpdateSpaceDto inherits it as optional, SpaceService passes language through on both create (defaults en-US) and update
- 5 unit tests cover all language create/update behaviors using proper NestJS testing module with mocked deps
- Both space creation and edit forms on client have Language Select with en-US and pt-BR options

## Task Commits

Each task was committed atomically:

1. **Task 1: Server data layer (migration, db.d.ts, DTO, service, tests)** - `4d35345b` (feat)
2. **Task 2: Client language dropdown (types, create form, edit form)** - `b69cc301` (feat)

**Plan metadata:** TBD (docs commit)

_Note: Task 1 used TDD (RED: tests written first, GREEN: implementation passed all tests)_

## Files Created/Modified
- `apps/server/src/database/migrations/20260319T120000-add-language-to-spaces.ts` - Kysely up/down migration for language varchar column
- `apps/server/src/database/types/db.d.ts` - Added language: string | null to Spaces interface
- `apps/server/src/core/space/dto/create-space.dto.ts` - Added required language field with @IsNotEmpty() @IsString()
- `apps/server/src/core/space/services/space.service.ts` - Pass language in insertSpace (default en-US) and updateSpace calls
- `apps/server/src/core/space/services/space.service.spec.ts` - Rewrote with 5 unit tests for language create/update behavior
- `apps/server/src/core/workspace/services/workspace.service.ts` - Fixed default space creation to include language: en-US
- `apps/client/src/features/space/types/space.types.ts` - Added language?: string to ISpace interface
- `apps/client/src/features/space/components/create-space-form.tsx` - Added Language Select with zod validation, en-US/pt-BR options
- `apps/client/src/features/space/components/edit-space-form.tsx` - Added Language Select with readOnly/disabled support, defaults to space.language or en-US

## Decisions Made
- Static language list (en-US, pt-BR) per Phase 2 scope; TODO comment added for future dynamic API fetch
- Language column intentionally nullable in DB (existing rows get null); service defaults to en-US at runtime
- `language` is required on CreateSpaceDto to enforce tagging for all new spaces

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed workspace.service.ts CreateSpaceDto missing required language field**
- **Found during:** Task 1 (TypeScript compilation verification)
- **Issue:** `workspace.service.ts` line 169 constructs `CreateSpaceDto` with only `{ name, slug }` - TypeScript error since `language` is now required
- **Fix:** Added `language: 'en-US'` to the default space creation object in workspace setup flow
- **Files modified:** `apps/server/src/core/workspace/services/workspace.service.ts`
- **Verification:** `npx tsc --noEmit --project apps/server/tsconfig.json` no longer reports error for this file
- **Committed in:** `4d35345b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug/type error)
**Impact on plan:** Necessary fix for TypeScript correctness. Default workspace creation space now explicitly tagged en-US. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `apps/server/src/core/auth/services/token.service.ts` and `token.module.ts` related to jwt `expiresIn` type incompatibility - these predate this plan and are out of scope
- Pre-existing TypeScript error in `apps/client/src/features/workspace/components/members/components/workspace-members-table.tsx` for missing `userType` property on `IUser` - out of scope

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Language tagging infrastructure is complete: spaces now store locale codes in the DB
- Phase 4 (client access control / LANG-04 filtered visibility) can consume `space.language` for group membership assignment logic
- Migration needs to be run on database before language field is populated for existing spaces

## Self-Check: PASSED

All files verified present. Both task commits confirmed in git history.

---
*Phase: 02-language-and-content-localization*
*Completed: 2026-03-19*

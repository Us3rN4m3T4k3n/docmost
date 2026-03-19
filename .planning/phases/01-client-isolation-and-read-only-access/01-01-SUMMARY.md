---
phase: 01-client-isolation-and-read-only-access
plan: "01"
subsystem: server/page-repo
tags: [security, data-boundary, kysely, nestjs, workspace-isolation]
dependency_graph:
  requires: ["01-00"]
  provides: ["workspaceId-scoped-page-fetch"]
  affects: ["apps/server/src/database/repos/page/page.repo.ts", "apps/server/src/core/page/page.controller.ts"]
tech_stack:
  added: []
  patterns: ["Kysely .where clause for workspace scoping", "@AuthWorkspace decorator on NestJS controller handler"]
key_files:
  created: []
  modified:
    - apps/server/src/database/repos/page/page.repo.ts
    - apps/server/src/core/page/page.controller.ts
    - apps/server/src/core/page/page.controller.spec.ts
decisions:
  - "Added workspaceId filter directly in findById opts (not at service layer) — minimal change surface, consistent with Kysely query builder pattern already used elsewhere"
  - "Unskipped and updated the workspace isolation test from plan 01-00 to be active and passing"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-19"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 3
---

# Phase 1 Plan 01: WorkspaceId Filter for PageRepo.findById Summary

Close the cross-workspace data boundary gap by adding optional workspaceId filter to PageRepo.findById and wiring it through the getPage controller endpoint via the @AuthWorkspace decorator.

## What Was Built

**Security fix:** A page UUID from workspace A can no longer be fetched by a user authenticated to workspace B. The `POST /pages/info` endpoint now scopes the database query to the authenticated user's workspace.

### Changes Made

**`apps/server/src/database/repos/page/page.repo.ts`**
- Added `workspaceId?: string` to the `findById` opts type
- Added Kysely `.where('workspaceId', '=', opts.workspaceId)` clause applied after the id/slugId filter when `workspaceId` is provided

**`apps/server/src/core/page/page.controller.ts`**
- Added `@AuthWorkspace() workspace: Workspace` parameter to the `getPage` method signature
- Passes `workspaceId: workspace.id` in the `findById` opts call

**`apps/server/src/core/page/page.controller.spec.ts`**
- Activated the previously skipped cross-workspace isolation test (was `it.skip`)
- Updated both `getPage` test cases to pass `mockWorkspace` as the third argument (matching the updated signature)

## Test Results

```
PASS src/core/page/page.controller.spec.ts
  PageController
    ✓ should be defined
    getPage
      ✓ should return NotFoundException when pageId belongs to a different workspace
      ✓ should throw NotFoundException when page is not found

Tests: 3 passed, 3 total
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Exist
- apps/server/src/database/repos/page/page.repo.ts — FOUND (workspaceId on line 50, filter on lines 101-103)
- apps/server/src/core/page/page.controller.ts — FOUND (@AuthWorkspace on line 51, workspaceId on line 53)
- apps/server/src/core/page/page.controller.spec.ts — FOUND (test active, 3 passing)

### Acceptance Criteria
- [x] `workspaceId?: string` present in findById opts type
- [x] `query.where('workspaceId', '=', opts.workspaceId)` applied in findById
- [x] `@AuthWorkspace() workspace: Workspace` on getPage method signature
- [x] `workspaceId: workspace.id` passed in findById call
- [x] Previously skipped cross-workspace test now active and passing

## Self-Check: PASSED

---
phase: 01-client-isolation-and-read-only-access
plan: "03"
subsystem: workspace-members-ui + user-repo + space-visibility
tags: [userType, badge, staff, client, space-visibility, workspace-members]
dependency_graph:
  requires: ["01-00"]
  provides: ["userType field in workspace members API", "Staff/Client badge in admin UI", "ISOL-02 visibility verification"]
  affects: ["apps/server/src/database/repos/user/user.repo.ts", "apps/client/src/features/workspace/components/members/components/workspace-members-table.tsx"]
tech_stack:
  added: []
  patterns: ["Kysely sql tagged template for derived CASE subquery", "Mantine Badge component for user type labeling"]
key_files:
  created: []
  modified:
    - apps/server/src/database/repos/user/user.repo.ts
    - apps/client/src/features/workspace/components/members/components/workspace-members-table.tsx
decisions:
  - "userType computed via a SQL CASE/EXISTS subquery on space_members in getUsersPaginated — no N+1, single query"
  - "Badges placed inside the User column Group element, inline with name/email, for compact display"
  - "SpaceVisibility.PRIVATE is NOT yet enforced in getSpacesInWorkspace (admin endpoint) — but the user-facing listing already enforces membership-based isolation via getUserSpaces → getUserSpaceIds"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-03-19"
  tasks_completed: 3
  files_modified: 2
---

# Phase 01 Plan 03: Staff/Client Badge and Space Visibility Verification Summary

**One-liner:** SQL CASE subquery derives userType (staff/client/null) in workspace members API; Mantine Badge renders green Staff and blue Client labels in admin UI; getUserSpaces already enforces membership-based space isolation.

## What Was Built

### Task 1: userType computed field in workspace members API

**File:** `apps/server/src/database/repos/user/user.repo.ts`

Extended `getUsersPaginated` with a SQL CASE/EXISTS subquery that computes `userType` for each user in a single database round-trip:

- `owner` or `admin` workspace role → `userType = NULL` (role label is sufficient)
- `member` with any `space_members` row where `role IN ('writer', 'admin')` → `userType = 'staff'`
- `member` with only `reader` space memberships (or no space memberships) → `userType = 'client'`

The subquery is an EXISTS check against the `space_members` table, scoped to the user's ID. This avoids N+1 queries — the derived field is computed inline as part of the pagination query.

The `sql` import was already present in the file (`import { ExpressionBuilder, sql } from 'kysely'`), so no new dependencies were needed.

### Task 2: Staff/Client badge in workspace members table

**File:** `apps/client/src/features/workspace/components/members/components/workspace-members-table.tsx`

Added two conditional Badge renderings inside the `<Group>` element of the User column, after the name/email `<div>`:

- `user.role === UserRole.MEMBER && user.userType === 'staff'` → `<Badge color="green" variant="light" size="sm">Staff</Badge>`
- `user.role === UserRole.MEMBER && user.userType === 'client'` → `<Badge color="blue" variant="light" size="sm">Client</Badge>`

`Badge` was already imported from `@mantine/core` on line 1. `UserRole` was already imported from `@/lib/types.ts`. No new imports needed. TypeScript strict mode is disabled in the client, so `user.userType` access compiles without a type annotation update.

### Task 3: Verify client space PRIVATE visibility enforcement (verification only — no code changes)

**Files inspected:** `apps/server/src/core/space/space.controller.ts`, `apps/server/src/database/repos/space/space-member.repo.ts`, `apps/server/src/core/space/services/space.service.ts`, `apps/server/src/database/repos/space/space.repo.ts`

**Finding: User-facing space listing is already membership-gated (ISOL-02 is satisfied)**

The space listing endpoint (`POST /spaces/`) calls `spaceMemberService.getUserSpaces(user.id, pagination)`. This method:
1. Calls `getUserSpaceIds(userId)` — queries `space_members` for direct membership + group membership, returns only space IDs the user belongs to
2. Queries `WHERE id IN (userSpaceIds)` — client users only see spaces they are explicitly added to

A client user added only to the "Client" space will see only that space in the sidebar. They cannot discover or navigate to internal spaces by browsing. This satisfies ISOL-02 through membership enforcement, which is stronger than visibility flags.

**Finding: SpaceVisibility.PRIVATE is not yet consulted in getSpacesInWorkspace (admin endpoint)**

The `getSpacesInWorkspace` method in `space.repo.ts` (line 99-127) has a TODO comment: `// todo: show spaces user have access based on visibility and memberships`. This admin-facing endpoint returns ALL spaces in the workspace. However, this endpoint is used by the admin UI (space settings list), not the user-facing space sidebar.

**Admin setup required:** When creating the client space, the Admin should set it to `SpaceVisibility.PRIVATE` via Space Settings. While the user-facing listing already enforces membership isolation, PRIVATE visibility signals intent and will be respected once the TODO filter is implemented in a future phase.

**Conclusion:** ISOL-02 is satisfied by Docmost's existing membership-based `getUserSpaces` filter. No code changes were needed for this task.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e4cba310 | feat(01-03): add userType computed field to workspace members API |
| 2 | 994f5fd6 | feat(01-03): render Staff/Client badge in workspace members table |

## Verification Results

**Task 1 verification:**
```
grep -rn 'userType' apps/server/src/database/repos/user/user.repo.ts
→ Shows CASE/EXISTS subquery with 'staff', 'client', NULL values
```

**Task 2 verification:**
```
grep -n 'userType\|Staff\|Client' apps/client/.../workspace-members-table.tsx
→ Line 85: user.role === UserRole.MEMBER && user.userType === 'staff'
→ Line 86: <Badge color="green" variant="light" size="sm">Staff</Badge>
→ Line 88: user.role === UserRole.MEMBER && user.userType === 'client'
→ Line 89: <Badge color="blue" variant="light" size="sm">Client</Badge>
```

**Task 3 verification:**
```
grep -rn 'PRIVATE\|private' apps/server/src/core/space/space.service.ts apps/server/src/database/repos/space/space.repo.ts
→ getSpacesInWorkspace has TODO comment; SpaceVisibility.PRIVATE enum exists in permission.ts
→ getUserSpaces (user-facing) filters by membership IDs — no visibility check needed
```

**Server tests:** `space-ability` suite: 14/14 passing. Pre-existing `workspace.service.spec.ts` stub failure is unrelated to this plan (missing DI mocks in test setup, not caused by userType changes).

## Deviations from Plan

None — plan executed exactly as written. The pre-existing `workspace.service.spec.ts` test failure was investigated and confirmed to be a pre-existing stub with no mock providers, unrelated to changes in this plan.

## Admin Setup Documentation (ISOL-02)

**Required before onboarding any client user:**

1. Log in as Admin to the workspace
2. Navigate to the client space → Settings → General
3. Set **Visibility** to **Private**
4. Save changes

This ensures that even if the membership filter were bypassed (e.g., via a direct URL), the space signals PRIVATE intent. The current `getUserSpaces` filter already prevents clients from seeing non-member spaces in the sidebar.

## Self-Check: PASSED

- `apps/server/src/database/repos/user/user.repo.ts` — modified, contains `userType` CASE subquery
- `apps/client/src/features/workspace/components/members/components/workspace-members-table.tsx` — modified, contains `user.userType === 'staff'` and `user.userType === 'client'` badge rendering
- Commit e4cba310 — verified (Task 1)
- Commit 994f5fd6 — verified (Task 2)

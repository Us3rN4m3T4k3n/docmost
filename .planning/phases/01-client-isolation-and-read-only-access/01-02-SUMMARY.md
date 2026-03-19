---
phase: 01-client-isolation-and-read-only-access
plan: 02
subsystem: client
tags: [role-gate, content-protection, hocuspocus, sidebar, casl, reader-isolation]
dependency_graph:
  requires: [01-00]
  provides: [ISOL-01, ISOL-04, ISOL-05]
  affects: [ContentProtection, page.tsx, page-editor.tsx, space-sidebar.tsx]
tech_stack:
  added: []
  patterns: [spaceAbility CASL gate, conditional provider creation, role-based UI gating]
key_files:
  created: []
  modified:
    - apps/client/src/components/ContentProtection.tsx
    - apps/client/src/pages/page/page.tsx
    - apps/client/src/features/editor/page-editor.tsx
    - apps/client/src/features/space/components/sidebar/space-sidebar.tsx
decisions:
  - ContentProtection now receives a boolean `protected` prop from page.tsx instead of calling useUserRole internally — keeps the component pure and testable
  - SpaceMenu in space-sidebar now fetches its own spaceAbility (same pattern as SpaceSidebar parent) rather than receiving it as a prop — avoids interface churn
  - DevTools false-positive detection (size threshold + debugger timing) removed from ContentProtection — was firing for legitimate browser zoom/window resize per CONTEXT.md Phase 3 scope
metrics:
  duration: ~25 minutes
  completed: 2026-03-19
  tasks_completed: 2
  files_modified: 4
---

# Phase 01 Plan 02: Fix ContentProtection Role Gate, Suppress Hocuspocus for READERs, Fix Staff Sidebar

**One-liner:** ContentProtection switched from workspace `isMember` to space-ability `protected` prop; Hocuspocus WebSocket skipped for READER users; sidebar `!isMember` replaced with `spaceAbility.can` so Staff with WRITER role see New Page and Space Settings.

## What Was Done

### Task 1: ContentProtection role gate fix + page.tsx wiring

**Problem:** `ContentProtection.tsx` called `useUserRole()` and guarded with `if (!isMember) return children`. Since both Staff (WRITER) and Clients (READER) are `UserRole.MEMBER`, the check was always `true` for both — Staff were incorrectly subjected to content protection (copy/paste blocked, context menu disabled).

**Fix:**
- Changed `ContentProtectionProps` to accept `protected: boolean`
- Component destructures `protected: isProtected` (avoids reserved word collision)
- Guard is now `if (!isProtected) return children`
- Removed `useUserRole` import — component no longer has workspace-level role knowledge
- Removed devtools false-positive detection (window size threshold checks, `debugger` timing loop) — these cause false positives on normal browser use
- In `page.tsx`: `<ContentProtection protected={spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)}>` — READER gets `true`, WRITER/ADMIN gets `false`

### Task 2: Hocuspocus suppression + sidebar !isMember bug fix

**Hocuspocus suppression (`page-editor.tsx`):**

**Problem:** The `useEffect([pageId])` that creates `IndexeddbPersistence` and `HocuspocusProvider` ran unconditionally — READER users opened a live WebSocket connection to the Hocuspocus server even though the editor was read-only.

**Fix:** Added `if (!editable) { return; }` early return at the top of the provider-creation `useEffect`. When `editable` is `false`, both providers are skipped. The component's existing `showStatic` state (starts `true`, only transitions to `false` on first WebSocket connect) stays `true` permanently for READER users, rendering `<EditorProvider editable={false} content={content} />`. Added `editable` to the dependency array `[pageId, editable]`.

**Sidebar bug (`space-sidebar.tsx`):**

**Problem:** Three `!isMember` checks in `SpaceSidebar` and one in `SpaceMenu` gated editor-only UI. Since all `UserRole.MEMBER` users (both Staff and Client) have `isMember = true`, these conditions were `false` for everyone — Staff with WRITER role could not see "New page", "Space settings", or the space import/export menu.

**Fix:**
- "Space settings" button: `{!isMember && (` → `{spaceAbility.can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings) && (`
- "New page" button: `{!isMember && spaceAbility.can(Manage, Page) && (` → `{spaceAbility.can(Manage, Page) && (`
- Pages header create ActionIcon + SpaceMenu: same change as above
- `SpaceMenu` component: replaced `{!isMember && (` with `{spaceAbility.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page) && (`, added own `useGetSpaceBySlugQuery` + `useSpaceAbility` setup (same pattern as parent)
- Removed `useUserRole` import from `SpaceSidebar` and `SpaceMenu` — no longer needed

## Deviations from Plan

### Auto-fixed Issues

None required — all changes matched the plan specification exactly.

### Additional Cleanup

**[Rule 2 - Missing Critical Functionality] Removed SpaceMenu `useUserRole` import**
- **Found during:** Task 2, while updating SpaceMenu
- **Issue:** After replacing `!isMember` with `spaceAbility.can(...)` in SpaceMenu, the `useUserRole` import in SpaceMenu became unused
- **Fix:** Removed import from SpaceMenu; SpaceMenu now uses its own `useSpaceAbility` instance
- **Files modified:** `space-sidebar.tsx`

## Verification Results

All plan verification commands pass:

- `isMember` — zero occurrences in `ContentProtection.tsx` and `space-sidebar.tsx`
- `protected={spaceAbility.cannot(...)}` — present in `page.tsx` line 66
- `if (!editable)` — present in `page-editor.tsx` line 121 (early return before provider creation)
- `devToolsOpen`, `checkDevTools`, `Firebug`, `debugger` — zero occurrences in `ContentProtection.tsx`
- `spaceAbility.can(SpaceCaslAction.Manage` — present in `space-sidebar.tsx` for both New Page and Space Settings gates

## Self-Check: PASSED

Files confirmed present and modified:
- `/Users/rafaelandresberti/docmost/apps/client/src/components/ContentProtection.tsx` — FOUND
- `/Users/rafaelandresberti/docmost/apps/client/src/pages/page/page.tsx` — FOUND
- `/Users/rafaelandresberti/docmost/apps/client/src/features/editor/page-editor.tsx` — FOUND
- `/Users/rafaelandresberti/docmost/apps/client/src/features/space/components/sidebar/space-sidebar.tsx` — FOUND

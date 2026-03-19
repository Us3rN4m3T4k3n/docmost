# Phase 1: Client Isolation and Read-Only Access - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Enforce that external clients are locked to a private space as READER — server-side enforced, no editor UI, no real-time collaboration WebSocket, and a clear three-tier role hierarchy (Admin / Staff / Client) reflected in both functionality and admin UI. Does NOT include content protection CSS/JS (Phase 3) or billing/provisioning (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Role Hierarchy

- **Admin** = `UserRole.ADMIN` in Docmost — full platform control including billing settings; multiple admins allowed (OWNER stays with the account creator only, Admins do everything else)
- **Staff** = `UserRole.MEMBER` at workspace level + assigned as `SpaceRole.WRITER` to specific spaces by an Admin — Staff can edit only what they are given permission to (e.g., SOPs space only, or HR Playbook + SOPs, etc.)
- **External Client (User)** = `UserRole.MEMBER` at workspace level + `SpaceRole.READER` on the client space only — cannot edit anything
- No new database role types needed — the existing `UserRole` + `SpaceRole` combination covers all three tiers

### Staff vs Client Visual Distinction

- The admin Users list must show a visible tag/badge distinguishing Staff from paying Clients
- A Staff member = workspace MEMBER with WRITER access on at least one internal space
- A Client = workspace MEMBER with READER-only access, restricted to the client space
- Implementation approach for badge is Claude's discretion (a `userType` field, a derived indicator from space memberships, or a display-only label)

### Content Protection Role Gate (Bug Fix — Non-Negotiable)

- The existing `ContentProtection.tsx` incorrectly gates on `isMember` (workspace-level role)
- **Must be fixed to gate on `spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)`** — the correct trigger is READER space role, not workspace MEMBER role
- `spaceAbility` is already available in `page.tsx` — pass a `protected` boolean prop down to `ContentProtection` (or equivalent pattern)
- Internal staff with WRITER space role must see zero protection restrictions

### Workspace Data Boundary (Bug Fix — Non-Negotiable)

- `PageRepo.findById()` currently fetches pages by UUID with no workspaceId filter — potential cross-workspace data access
- Must add `workspaceId` filter to the query so a UUID guess from another workspace returns no data
- Implementation detail is Claude's discretion

### Space Isolation

- The client space is set to `SpaceVisibility.PRIVATE` — clients added to it cannot browse or discover any other space
- Clients receive `SpaceRole.READER` on the client space — server-side CASL enforces read-only at the API level
- Staff are NOT added to the client space (or are added with WRITER role only if they need to manage client content)

### Real-Time Collaboration (Hocuspocus)

- For Phase 1: client-side suppression only — do not initialize the Hocuspocus/Yjs provider in `FullEditor` when `editable` is false (i.e., user is READER)
- Server-side auth gate for READER connections is deferred — not required for Phase 1 since the client-side check prevents connection initiation
- `FullEditor` already receives `editable={spaceAbility.can(Manage, Page)}` — use this to conditionally omit WebSocket provider initialization

### Editor Chrome Removal

- `FullEditor` already accepts `readOnly` via the `editable` prop — TipTap will suppress the editor toolbar and cursor
- Additionally hide: "New Page" / "Add child page" buttons in sidebar for READER users, page-level edit/delete action menu, comment creation (viewing existing comments is acceptable)
- Implementation approach for hiding sidebar actions is Claude's discretion (CASL check at component level)

### Claude's Discretion

- Exact implementation approach for Staff vs Client badge in Users list (derived vs stored)
- Whether `workspaceId` filter is added to `findById` directly or enforced at the service layer via CASL
- Exact approach for suppressing Hocuspocus provider in FullEditor (conditional import, prop, or hook)
- Hiding sidebar "new page" and action menu items — use existing `spaceAbility` checks at the component level

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs or ADRs exist in this project. Requirements are fully captured in the decisions above and the files below.

### Project Requirements
- `.planning/REQUIREMENTS.md` — Full requirement list; Phase 1 covers ROLE-01, ROLE-02, ROLE-03, ISOL-01, ISOL-02, ISOL-03, ISOL-04, ISOL-05
- `.planning/PROJECT.md` — Project context, constraints, and key decisions

### Key Source Files (must read before modifying)
- `apps/client/src/components/ContentProtection.tsx` — Contains the inverted `isMember` role gate bug to fix
- `apps/client/src/hooks/use-user-role.tsx` — Workspace-level role hook (currently used incorrectly in ContentProtection)
- `apps/client/src/pages/page/page.tsx` — Page component with existing `spaceAbility` — correct role source for ContentProtection
- `apps/server/src/core/casl/abilities/space-ability.factory.ts` — Server-side CASL space role enforcement
- `apps/server/src/common/helpers/types/permission.ts` — `UserRole`, `SpaceRole`, `SpaceVisibility` enums
- `apps/server/src/database/repos/page/page.repo.ts` — `findById()` — missing `workspaceId` filter to add

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSpaceAbility(spaceRules)` hook in `page.tsx` — already returns CASL ability for current space; use this as the source of truth for READER detection
- `SpaceRole.READER` / `SpaceCaslAction` — already defined in `apps/server/src/common/helpers/types/permission.ts` and mirrored on frontend
- `buildSpaceReaderAbility()` in `space-ability.factory.ts` — server enforces read-only via CASL; no new server logic needed for basic isolation

### Established Patterns
- CASL space ability pattern: `spaceAbility.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page)` → true for WRITER/ADMIN, false for READER
- `FullEditor` `editable` prop already wired to `spaceAbility.can(Manage, Page)` in `page.tsx` — read-only editor mode is half-done
- `SpaceVisibility.PRIVATE` already exists — setting it on the client space is a data/config operation, not a code change

### Integration Points
- `ContentProtection.tsx` wraps page content in `page.tsx` — fix the role check here, not in the component itself (pass a prop)
- `FullEditor` in `page.tsx` — add WebSocket suppression alongside the existing `editable` prop
- Space member management (admin UI) — add Staff/Client badge here

</code_context>

<specifics>
## Specific Ideas

- Staff permissions are granular per space: an Admin explicitly assigns which spaces a Staff member can edit (SOPs only, HR Playbook only, or a combination) — this is the standard Docmost space membership model, not a new feature
- The Users list in admin needs a visual badge so Admins can tell Staff from Clients at a glance — especially important as the paying client list grows

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-client-isolation-and-read-only-access*
*Context gathered: 2026-03-19*

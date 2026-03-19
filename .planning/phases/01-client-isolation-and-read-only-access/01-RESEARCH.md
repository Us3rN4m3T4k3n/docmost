# Phase 1: Client Isolation and Read-Only Access - Research

**Researched:** 2026-03-19
**Domain:** Docmost fork — CASL role enforcement, React component gating, Hocuspocus WebSocket suppression, NestJS/Kysely data boundary
**Confidence:** HIGH (all findings verified directly from codebase source files)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Role Hierarchy**
- Admin = `UserRole.ADMIN` — full platform control including billing settings; multiple admins allowed
- Staff = `UserRole.MEMBER` at workspace level + `SpaceRole.WRITER` on specific spaces by Admin
- External Client (User) = `UserRole.MEMBER` at workspace level + `SpaceRole.READER` on client space only
- No new database role types needed — existing `UserRole` + `SpaceRole` combination covers all three tiers

**Staff vs Client Visual Distinction**
- Admin Users list must show a visible tag/badge distinguishing Staff from paying Clients
- A Staff member = workspace MEMBER with WRITER access on at least one internal space
- A Client = workspace MEMBER with READER-only access, restricted to the client space

**Content Protection Role Gate (Bug Fix — Non-Negotiable)**
- `ContentProtection.tsx` incorrectly gates on `isMember` (workspace-level role)
- Must be fixed to gate on `spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)`
- `spaceAbility` is already available in `page.tsx` — pass a `protected` boolean prop down to `ContentProtection`
- Internal staff with WRITER space role must see zero protection restrictions

**Workspace Data Boundary (Bug Fix — Non-Negotiable)**
- `PageRepo.findById()` currently fetches pages by UUID with no workspaceId filter
- Must add `workspaceId` filter to the query so a UUID guess from another workspace returns no data

**Space Isolation**
- Client space is set to `SpaceVisibility.PRIVATE` — clients cannot browse or discover any other space
- Clients receive `SpaceRole.READER` on the client space — server-side CASL enforces read-only at the API level
- Staff are NOT added to the client space (or added with WRITER only if they need to manage client content)

**Real-Time Collaboration (Hocuspocus)**
- For Phase 1: client-side suppression only — do not initialize the Hocuspocus/Yjs provider in `PageEditor` when `editable` is false
- Server-side auth gate for READER connections is deferred
- `FullEditor` already receives `editable={spaceAbility.can(Manage, Page)}` — use this to conditionally omit WebSocket provider initialization

**Editor Chrome Removal**
- `FullEditor` already accepts `readOnly` via the `editable` prop — TipTap will suppress editor toolbar and cursor
- Additionally hide: "New Page" / "Add child page" buttons in sidebar for READER users, page-level edit/delete action menu, comment creation
- Viewing existing comments is acceptable

### Claude's Discretion

- Exact implementation approach for Staff vs Client badge in Users list (derived vs stored)
- Whether `workspaceId` filter is added to `findById` directly or enforced at the service layer via CASL
- Exact approach for suppressing Hocuspocus provider in PageEditor (conditional initialization, flag, or hook)
- Hiding sidebar "new page" and action menu items — use existing `spaceAbility` checks at the component level

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROLE-01 | Three permission levels: Admin (full control), Staff (create/edit), User/Client (read-only) | Existing `UserRole` + `SpaceRole` enum combination covers this without schema changes |
| ROLE-02 | Admin can manage all content, users, billing settings, and platform configuration | `UserRole.ADMIN` already has full CASL abilities; no code change needed for capability — only for badge display |
| ROLE-03 | Staff can create/edit pages and spaces but cannot access billing/admin settings | `UserRole.MEMBER` + `SpaceRole.WRITER` already restricts billing UI via existing admin route guards |
| ISOL-01 | Client users restricted to READER role in client space — server-side CASL enforced | `buildSpaceReaderAbility()` already exists in `space-ability.factory.ts`; `SpaceCaslAction.Read` only on Page |
| ISOL-02 | Client space set to PRIVATE visibility — clients cannot browse other spaces | `SpaceVisibility.PRIVATE` enum value already exists; this is a data/config operation on the client space record |
| ISOL-03 | Page fetch API filters by workspaceId to close data boundary gap | `findById()` in `page.repo.ts` has no `workspaceId` filter; add `.where('workspaceId', '=', workspaceId)` |
| ISOL-04 | Editor chrome (create, edit, delete, comment) hidden for READER space role | `spaceAbility.cannot(Manage, Page)` is the correct gate; `readOnly` prop already flows to `PageHeader` and tree |
| ISOL-05 | Real-time WebSocket connection not established for READER users | `HocuspocusProvider` is initialized unconditionally in `PageEditor` regardless of `editable` prop; must gate on `editable` |
</phase_requirements>

---

## Summary

Phase 1 is almost entirely a bug-fix and wiring phase. The Docmost fork already has all the underlying infrastructure: CASL space roles (`ADMIN/WRITER/READER`), `SpaceVisibility.PRIVATE`, TipTap's `editable` prop, and Hocuspocus for real-time collab. The gaps are (1) two non-negotiable bugs — the wrong role hook in `ContentProtection.tsx` and the missing `workspaceId` filter in `PageRepo.findById()` — and (2) two hardening items — preventing Hocuspocus from connecting for READER sessions, and adding a Staff vs Client badge in the admin Users list.

The existing `spaceAbility` pipeline is sound. `page.tsx` already computes `spaceAbility` from space membership permissions and passes `editable={spaceAbility.can(Manage, Page)}` to `FullEditor`. The fix to `ContentProtection` is a one-liner prop change at the call site in `page.tsx`. The `PageEditor` (not `FullEditor`) is where the Hocuspocus provider is created; the `editable` prop is available there but not yet used to skip WebSocket initialization.

The sidebar (`SpaceSidebar`) already uses `spaceAbility.can(Manage, Page)` to gate the "New page" and settings buttons, but it additionally checks `!isMember` in several places — a redundancy that works in practice but mixes the two role systems. `PageHeaderMenu` similarly mixes `isMember` with `readOnly`. These do not need to be fully refactored in Phase 1 — only the `ContentProtection` gate must switch to the space-ability check; the rest already produce the correct behavior for a READER.

**Primary recommendation:** Implement as five discrete, independently verifiable changes: (1) ContentProtection prop fix, (2) PageRepo workspaceId filter, (3) Hocuspocus suppression in PageEditor, (4) Staff/Client badge in WorkspaceMembersTable, (5) Client space PRIVATE visibility documentation/setup guide.

---

## Standard Stack

### Core (already in use — no additions needed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@casl/ability` | present in codebase | Server + client permission model | `createMongoAbility`, `AbilityBuilder` |
| `@hocuspocus/provider` | present | Real-time WebSocket collab | `HocuspocusProvider` in `page-editor.tsx` |
| `yjs` + `y-indexeddb` | present | CRDT document sync | Local persistence layer alongside Hocuspocus |
| `@tiptap/react` | present | Rich text editor | `editable` prop suppresses toolbar for READER |
| `kysely` | present | Query builder (server) | Used for all DB queries including `findById` |
| `@mantine/core` | present | UI component library | `Badge` component available for Staff/Client label |

### No New Dependencies

All requirements for Phase 1 are achievable with the existing dependency tree. Zero new packages.

---

## Architecture Patterns

### Existing CASL Space Ability Pipeline

```
Server: SpaceAbilityFactory.createForUser(user, spaceId)
  → queries space_members for user's highest role
  → returns buildSpaceReaderAbility() | buildSpaceWriterAbility() | buildSpaceAdminAbility()
  → READER ability: can(Read, Page) only — cannot(Manage, Page) === true

Client: useSpaceAbility(space?.membership?.permissions)
  → createMongoAbility(rules) — rules serialized from server JWT/membership response
  → spaceAbility.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page) === false for READER
```

### How `readOnly` Flows Today

```
page.tsx
  spaceAbility = useSpaceAbility(space?.membership?.permissions)
  ↓
  PageHeader(readOnly={spaceAbility.cannot(Manage, Page)})
    → PageHeaderMenu(readOnly)
      → !readOnly gates: PageStateSegmentedControl, Move, Trash items
      → !isMember gates: Share, Page history, Export, Print (WRONG CHECK — uses workspace role)
  ↓
  ContentProtection  ← BUG: reads isMember (workspace role) not space READER role
  ↓
  FullEditor(editable={spaceAbility.can(Manage, Page)})
    → TitleEditor(editable)
    → PageEditor(editable)
      → HocuspocusProvider ALWAYS initialized ← BUG: should skip when !editable
      → editor = useEditor({ editable }) ← correct, TipTap respects this
```

### Pattern 1: ContentProtection Fix

**What:** Replace the `isMember` workspace-role check with a `protected` prop driven by space ability.
**Current (broken):** `ContentProtection` imports `useUserRole()` and calls `if (!isMember) return children` — this means ADMIN and OWNER users get no protection (correct) but Staff (also `MEMBER`) get protection (wrong).
**Fix:** Pass `protected={spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)}` from `page.tsx` to `ContentProtection`. Add `protected: boolean` to `ContentProtectionProps`. Replace the `isMember` early-return guard with `if (!protected) return children`.

```typescript
// In page.tsx — at the ContentProtection call site
<ContentProtection protected={spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)}>
```

```typescript
// In ContentProtection.tsx — updated interface and guard
interface ContentProtectionProps {
  children: React.ReactNode;
  protected: boolean;
}
export const ContentProtection: React.FC<ContentProtectionProps> = ({ children, protected: isProtected }) => {
  if (!isProtected) {
    return <>{children}</>;
  }
  // ... rest of protection logic unchanged
```

### Pattern 2: workspaceId Filter in PageRepo.findById()

**What:** Add a `workspaceId` parameter to `findById()` and apply a Kysely `.where('workspaceId', '=', workspaceId)` clause.
**Current:** `findById(pageId, opts?)` — queries by `id` or `slugId` with no workspace scope.
**Fix approach (service layer — Claude's discretion):** The controller already has `@AuthWorkspace() workspace: Workspace` available for some endpoints but not `getPage`. Add `@AuthWorkspace()` to `getPage` and pass `workspace.id` to a new optional `workspaceId` filter in `findById`.

```typescript
// page.repo.ts — add optional workspaceId to opts
async findById(pageId: string, opts?: { workspaceId?: string; ... }): Promise<Page> {
  // ...
  if (opts?.workspaceId) {
    query = query.where('workspaceId', '=', opts.workspaceId);
  }
  // ...
}
```

```typescript
// page.controller.ts — getPage endpoint
async getPage(@Body() dto: PageInfoDto, @AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
  const page = await this.pageRepo.findById(dto.pageId, {
    workspaceId: workspace.id,
    // ... existing opts
  });
```

Note: The controller comment on line 208 (`// TODO: scope to workspaces`) confirms the team already identified this gap.

### Pattern 3: Hocuspocus Suppression in PageEditor

**What:** Conditionally skip WebSocket provider initialization when `editable` is false.
**Current:** `PageEditor` always creates `new HocuspocusProvider(...)` in a `useEffect` tied to `pageId`. The `editable` prop is used only for `useEditor({ editable })` and toolbar rendering — not for provider creation.
**Fix:** Gate the HocuspocusProvider creation block on `editable`. When `!editable`, use only `IndexeddbPersistence` (local cache) or skip entirely and render using `content` prop directly via the static `EditorProvider` path that already exists in the component.

The component already has a `showStatic` state that renders `<EditorProvider ... content={content} />` before WebSocket connects. For READER users, staying in this static path indefinitely is the correct behavior.

```typescript
// In the useEffect([pageId]) provider initialization block
useEffect(() => {
  if (!editable) {
    // Skip provider creation entirely for READER — static content is sufficient
    setProvidersReady(false);
    return;
  }
  // ... existing HocuspocusProvider initialization
}, [pageId, editable]);
```

### Pattern 4: Staff vs Client Badge in WorkspaceMembersTable

**What:** Add a badge column distinguishing Staff from Client in the admin members table.
**Current:** Table has User, Status (always "Active"), Role columns. `user.role` is either `ADMIN`, `OWNER`, or `MEMBER` — all three tiers of Staff, Client, and Admin use these three values.
**Approach (derived, Claude's discretion):** Since both Staff and Client are `UserRole.MEMBER`, the badge must be derived from space memberships. Options:
  - **Option A (backend):** Add a `userType` computed field to the workspace members API response — the server queries whether the user has any WRITER space role to distinguish Staff vs Client.
  - **Option B (frontend-only):** Make a separate space-members API call per user (expensive, not recommended).
  - **Recommended: Option A** — extend `WorkspaceMembersQuery` response to include a `userType: 'staff' | 'client' | null` field computed server-side.

```typescript
// WorkspaceMembersTable — badge rendering
{user.role === UserRole.MEMBER && user.userType === 'client' && (
  <Badge color="blue" variant="light" size="sm">Client</Badge>
)}
{user.role === UserRole.MEMBER && user.userType === 'staff' && (
  <Badge color="green" variant="light" size="sm">Staff</Badge>
)}
```

### Recommended Project Structure (no changes needed)

The existing monorepo structure is well-organized. Phase 1 touches:

```
apps/
├── client/src/
│   ├── components/ContentProtection.tsx       # Fix: protected prop
│   ├── features/editor/page-editor.tsx        # Fix: editable-gated Hocuspocus
│   └── features/workspace/components/members/
│       └── workspace-members-table.tsx        # Add: Staff/Client badge
└── server/src/
    ├── database/repos/page/page.repo.ts       # Fix: workspaceId filter
    └── core/page/page.controller.ts           # Fix: pass workspaceId to findById
```

### Anti-Patterns to Avoid

- **Do not mix `isMember` and `spaceAbility` for the same gate.** `isMember` checks workspace-level `UserRole.MEMBER` — since both Staff and Client are `UserRole.MEMBER`, this check is always true for both. `spaceAbility.cannot(Manage, Page)` is the correct check for READER detection.
- **Do not add a new UserRole enum value.** The three-tier system is built on `UserRole` + `SpaceRole` combinations, not a third role type. A new enum value would require schema migration and break existing CASL setup.
- **Do not add server-side Hocuspocus auth gate in Phase 1.** The CONTEXT.md explicitly defers this — client-side suppression is sufficient for Phase 1 since the connection is never initiated.
- **Do not use `SpaceRole.READER` directly as a React prop.** The correct client-side check is `spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)` — this uses the serialized CASL rules that come from the server, which is the canonical source of truth.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Permission checks | Custom role enum or flag props | `spaceAbility.can/cannot()` from `useSpaceAbility` | Already wired end-to-end; server serializes rules, client deserializes with CASL |
| Read-only editor | Custom view renderer | TipTap `editable={false}` | Already respected by the editor; toolbar disappears automatically |
| WebSocket auth | Server-side READER block on Hocuspocus | Client-side `editable` flag to skip provider init | Phase 1 scope; server gate is Phase 1 deferred |
| Badge styling | Custom CSS badge | Mantine `<Badge>` component | Already imported in `workspace-members-table.tsx` |

---

## Common Pitfalls

### Pitfall 1: ContentProtection Inverted Logic
**What goes wrong:** The current guard is `if (!isMember) return children` — since ADMIN and OWNER are not `isMember`, they bypass protection (correct). But MEMBER includes both Staff (WRITER) and Client (READER), so Staff gets incorrectly protected.
**Why it happens:** The component was written with `isMember` as a proxy for "external user" but that assumption is wrong — both internal Staff and external Clients share `UserRole.MEMBER`.
**How to avoid:** The fix is `if (!protected) return children` where `protected` is derived from `spaceAbility.cannot(Manage, Page)` at the `page.tsx` call site.
**Warning signs:** A Staff user with WRITER access on the SOPs space sees the "content protection" overlay or has copy/paste blocked.

### Pitfall 2: Hocuspocus Connects for READER Users
**What goes wrong:** Even though `editable={false}` disables TipTap editing, the `useEffect([pageId])` in `PageEditor` always creates `new HocuspocusProvider(...)` unconditionally. READER users still open a WebSocket connection to the Hocuspocus server, consume resources, and get a session.
**Why it happens:** The `editable` prop is used downstream (for `useEditor`) but not at provider-creation time.
**How to avoid:** Early-return the provider init `useEffect` when `!editable`. The static `EditorProvider` render path (already present for the initial load) is sufficient for READER display.
**Warning signs:** Network tab shows an active WSS connection to the Hocuspocus server for a Client user.

### Pitfall 3: Cross-Workspace UUID Fetch
**What goes wrong:** A Client who knows a page UUID from workspace A can call `POST /pages/info` with that UUID while authenticated to workspace B and receive the page content, because `findById` queries globally.
**Why it happens:** `findById` builds `WHERE id = $pageId` with no workspace scope. The CASL check runs *after* the fetch (`spaceAbility.createForUser(user, page.spaceId)`) — but if the page belongs to a different workspace, the user might have no space membership, causing a `NotFoundException` from CASL rather than a clean scoped miss.
**How to avoid:** Add `workspaceId` filter to `findById` so the query returns null for out-of-workspace UUIDs before the CASL check.
**Warning signs:** A user can retrieve page metadata from a different workspace by UUID guessing.

### Pitfall 4: Badge Requires Backend Support
**What goes wrong:** The workspace members API response only returns `{ id, name, email, role, avatarUrl }` — `role` is `UserRole.MEMBER` for both Staff and Clients. A pure frontend badge cannot distinguish them without an additional data fetch.
**Why it happens:** The distinction is encoded in space memberships (which space, which space role), not in the workspace-level user record.
**How to avoid:** The workspace members endpoint must be extended to include a derived `userType` field or equivalent. Do not try to infer this from the workspace members list alone.

### Pitfall 5: SpaceSidebar Uses Both `isMember` and `spaceAbility`
**What goes wrong:** `SpaceSidebar` has conditions like `{!isMember && spaceAbility.can(Manage, Page)}` — the `!isMember` check is redundant (a non-Member can't be in the space at all) and creates confusion.
**Why it happens:** The sidebar was written before the three-tier model was finalized.
**How to avoid in Phase 1:** Leave these as-is — they produce the correct behavior (both Staff WRITER and ADMIN are non-MEMBER at workspace level? No — they're also MEMBER). Re-check: Staff are `UserRole.MEMBER` at workspace level, so `!isMember` is `false` for Staff. This means the "New page" button is already hidden for Staff when it should be visible! This is a **pre-existing sidebar bug** for Staff users.
**Resolution:** The sidebar's `!isMember` check should be replaced by `spaceAbility.can(Manage, Page)` alone (which is already the second condition). Phase 1 should fix this inconsistency — otherwise Staff won't see the "New page" button even with WRITER access.

---

## Code Examples

Verified from source files:

### CASL READER ability (server — confirmed)
```typescript
// Source: apps/server/src/core/casl/abilities/space-ability.factory.ts
function buildSpaceReaderAbility() {
  const { can, build } = new AbilityBuilder<MongoAbility<ISpaceAbility>>(createMongoAbility);
  can(SpaceCaslAction.Read, SpaceCaslSubject.Settings);
  can(SpaceCaslAction.Read, SpaceCaslSubject.Member);
  can(SpaceCaslAction.Read, SpaceCaslSubject.Page);
  can(SpaceCaslAction.Read, SpaceCaslSubject.Share);
  return build();
}
```

### Space ability check (client — confirmed)
```typescript
// Source: apps/client/src/pages/page/page.tsx
const spaceRules = space?.membership?.permissions;
const spaceAbility = useSpaceAbility(spaceRules);

// Correct gate for READER detection:
spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page) // true for READER
spaceAbility.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page)    // true for WRITER/ADMIN
```

### Kysely workspaceId filter pattern (server — existing pattern in codebase)
```typescript
// Source: apps/server/src/core/page/page.repo.ts — getRecentPages already uses workspace scope via space IDs
// Pattern for findById workspaceId filter:
if (opts?.workspaceId) {
  query = query.where('workspaceId', '=', opts.workspaceId);
}
```

### Hocuspocus initialization location (client — confirmed)
```typescript
// Source: apps/client/src/features/editor/page-editor.tsx (lines 120-168)
// The provider is always created in useEffect([pageId])
// editable prop is NOT consulted here — this is the fix location
const remote = new HocuspocusProvider({ name: documentName, url: collaborationURL, ... });
```

### Static read-only render path (already exists)
```typescript
// Source: apps/client/src/features/editor/page-editor.tsx (lines 384-393)
// This path renders content without WebSocket — correct for READER users
if (showStatic) {
  return (
    <EditorProvider
      editable={false}
      immediatelyRender={true}
      extensions={mainExtensions}
      content={content}
    />
  );
}
```

---

## State of the Art

| Old Approach | Current Approach in Codebase | Impact for Phase 1 |
|--------------|-----------------------------|--------------------|
| `isMember` check in ContentProtection | Must switch to `spaceAbility.cannot(Manage, Page)` | Bug fix required |
| Unconditional Hocuspocus init | Must gate on `editable` | Hardening required |
| Unconstrained `findById` | Must add workspaceId filter | Security fix required |
| No Staff/Client distinction in UI | Must add derived badge | UX addition required |

---

## Open Questions

1. **WorkspaceId in `getPage` controller endpoint**
   - What we know: `getPage` does not currently use `@AuthWorkspace()` decorator; other endpoints do.
   - What's unclear: Is `@AuthWorkspace()` automatically available on all `@UseGuards(JwtAuthGuard)` routes, or must it be explicitly added per handler?
   - Recommendation: Check `auth-workspace.decorator.ts` before planning — if it extracts from the JWT/session automatically, it's a one-line addition to the handler signature.

2. **WorkspaceMembersQuery API shape for userType badge**
   - What we know: The frontend query calls the workspace members endpoint; the response shape includes `role` but not space-level roles.
   - What's unclear: Whether the server computes the `userType` field as a DB join or whether it should be a separate API call.
   - Recommendation: Extend the existing workspace members query to JOIN against `space_members` table and return a `userType: 'staff' | 'client'` field. Avoids N+1 fetches.

3. **SpaceSidebar `!isMember` bug scope**
   - What we know: `SpaceSidebar` checks `!isMember && spaceAbility.can(Manage, Page)` for the "New page" button — since Staff are `UserRole.MEMBER`, `!isMember` is `false` for Staff, blocking the button.
   - What's unclear: Was this intentional (i.e., Staff were not expected to use the sidebar new-page button)? Or a pre-existing bug?
   - Recommendation: Treat as a Phase 1 bug to fix — replace `!isMember &&` with just `spaceAbility.can(Manage, Page)` in those two locations in `space-sidebar.tsx`. This ensures Staff with WRITER role see the new page button.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (NestJS server only) |
| Config file | `apps/server/package.json` scripts |
| Quick run command | `cd apps/server && npx jest --testPathPattern="page.controller" --no-coverage` |
| Full suite command | `cd apps/server && npx jest --no-coverage` |

No client-side test framework is configured (no vitest.config.*, jest.config.* found in `apps/client`). Client changes must be verified manually.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ISOL-03 | `findById` with wrong workspaceId returns null | unit | `cd apps/server && npx jest page.controller --no-coverage` | ✅ (stub only — needs real test) |
| ISOL-01 | READER user cannot call Manage/Page CASL action | unit | `cd apps/server && npx jest space-ability` | ❌ Wave 0 |
| ISOL-04 | Editor chrome absent for READER | manual | Open page as READER, verify no edit/delete/create buttons | manual-only |
| ISOL-05 | No WebSocket connection for READER | manual | Network tab: no WSS connection for Client user | manual-only |
| ROLE-01 | Admin/Staff/Client role combos produce correct abilities | unit | `cd apps/server && npx jest space-ability` | ❌ Wave 0 |
| ROLE-02 | Admin can manage all content | manual | Verify admin sees all settings/billing sections | manual-only |
| ROLE-03 | Staff cannot access billing/admin settings | manual | Verify Staff (MEMBER) is blocked from /settings/billing | manual-only |
| ISOL-02 | Client cannot see non-client spaces | manual | Log in as Client, verify sidebar shows only client space | manual-only |

### Sampling Rate
- **Per task commit:** `cd apps/server && npx jest --testPathPattern="page" --no-coverage`
- **Per wave merge:** `cd apps/server && npx jest --no-coverage`
- **Phase gate:** Server tests green + manual spot-check of READER UI before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/server/src/core/casl/abilities/space-ability.factory.spec.ts` — unit tests for `buildSpaceReaderAbility`, `buildSpaceWriterAbility`, `buildSpaceAdminAbility` covering all CASL permission combinations (REQ: ROLE-01, ISOL-01)
- [ ] Extend `apps/server/src/core/page/page.controller.spec.ts` — add test case for `getPage` with mismatched workspaceId returning 404 (REQ: ISOL-03)

---

## Sources

### Primary (HIGH confidence)

All findings are derived from direct source file inspection. No external docs required.

- `apps/server/src/core/casl/abilities/space-ability.factory.ts` — confirmed READER/WRITER/ADMIN ability builders
- `apps/server/src/common/helpers/types/permission.ts` — confirmed `UserRole`, `SpaceRole`, `SpaceVisibility` enums
- `apps/server/src/database/repos/page/page.repo.ts` — confirmed `findById` has no workspaceId filter
- `apps/client/src/pages/page/page.tsx` — confirmed `spaceAbility` pipeline and `ContentProtection` call site
- `apps/client/src/components/ContentProtection.tsx` — confirmed `isMember` bug
- `apps/client/src/features/editor/page-editor.tsx` — confirmed unconditional Hocuspocus init
- `apps/client/src/features/editor/full-editor.tsx` — confirmed `editable` prop interface
- `apps/client/src/features/space/components/sidebar/space-sidebar.tsx` — confirmed sidebar role checks including `!isMember` pattern
- `apps/client/src/features/page/components/header/page-header-menu.tsx` — confirmed menu gating patterns
- `apps/client/src/features/workspace/components/members/components/workspace-members-table.tsx` — confirmed current members table shape (no userType field)
- `apps/client/src/hooks/use-user-role.tsx` — confirmed `isMember` is workspace-level `UserRole.MEMBER` check

### Secondary (MEDIUM confidence)

- None needed — all claims are directly verified from source.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in source imports
- Architecture patterns: HIGH — verified by reading actual component and service source files
- Pitfalls: HIGH — the ContentProtection and Hocuspocus bugs are directly visible in the code; workspaceId gap confirmed from Kysely query in page.repo.ts
- Test infrastructure: HIGH — Jest config confirmed from apps/server/package.json; no client test framework found

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (codebase is stable; no external APIs involved in Phase 1)

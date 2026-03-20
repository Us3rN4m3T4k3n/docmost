# Phase 3: Content Protection - Research

**Researched:** 2026-03-20
**Domain:** Frontend content protection, NestJS backend security, Kysely migrations, React admin panel extension
**Confidence:** HIGH (all findings are from direct source inspection of this repository)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Watermark (PROT-04)**: Diagonal repeating text overlay, email-only content, CSS mix-blend-mode at ~0.06-0.08 opacity, fixed-position `div` overlay with `pointer-events: none`
- **Screenshot detection role gate**: Change `isMember` to `spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)` (same as ContentProtection.tsx)
- **3-strike triggers**: Screenshot keyboard shortcuts ONLY — Cmd+Shift+3/4/5 (Mac), PrintScreen (Windows), Win+Shift+S. Right-click/Ctrl+C/Ctrl+P: blocked silently, NO strikes
- **Strike 1**: Warning modal. Strike 2: Final warning + admin notification. Strike 3+: Account locked, content blocked, admin must reinstate
- **Backend persistence**: `screenshot_attempts` table in database (not in-memory). Endpoint: `POST /api/security/screenshot-attempt`. Status endpoint: `GET /api/security/screenshot-status`
- **Admin Security Panel**: New "Security" tab in existing settings sidebar (not a standalone route). Shows email, strike count, last attempt, account status, and "Reinstate account" button
- **Admin gate**: `isAdmin` from `useUserRole()` hook (same as existing Security & SSO page)
- **Dev tools detection removal (PROT-06)**: Remove the `setInterval` from `ContentProtectionAlways.tsx`. Keep keyboard shortcut blocking in both files

### Claude's Discretion
- Exact CSS/SVG technique for diagonal watermark (CSS repeating-linear-gradient, SVG data URI, or Canvas API)
- Font size and rotation angle (industry standard: 30-45 degrees)
- Exact column names/indexes for `screenshot_attempts` table
- Whether to add admin endpoint to existing SecurityModule or create a sub-controller
- Whether to remove or no-op the `logProtectionAttempt()` calls in ContentProtection.tsx

### Deferred Ideas (OUT OF SCOPE)
- Print dialog UX improvement (replace `alert()` with toast)
- Automated admin notification on 3rd strike via email
- Screenshot detection for browser extensions via MutationObserver (or verify/remove if too noisy)
- In-app appeal form for suspended users
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROT-01 | Right-click context menu disabled for READER role | ContentProtection.tsx already implements this; role gate verified correct |
| PROT-02 | Text selection and copy-paste disabled for READER users | ContentProtection.tsx already implements this; role gate verified correct |
| PROT-03 | Print and Ctrl+P blocked for READER users | ContentProtection.tsx + CSS @media print already implements this |
| PROT-04 | Dynamic watermark with authenticated user's email | ContentProtection.css has a placeholder `::after`; needs upgrade to diagonal repeating; email from `userAtom` (jotai) |
| PROT-05 | Content protection on READER space role, not workspace member role | Bug confirmed: ScreenshotDetection.tsx uses `isMember` (workspace role) — must be changed to spaceAbility gate |
| PROT-06 | Dev tools detection removed (false positives) | `setInterval` on lines 55-62 in ContentProtectionAlways.tsx; `devToolsOpen` state and blurred JSX also removable |
| PROT-V2-01 | Screenshot attempts persisted to database | service.ts has in-memory Map; database commented out; needs migration + Kysely update |
| PROT-V2-02 | Admin violation log with reinstatement | Security settings page pattern established; new route + sidebar entry needed |
</phase_requirements>

---

## Summary

All existing content protection components are already wired in `page.tsx` using the correct `spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)` role gate for `ContentProtection`. The backend `SecurityModule` already exists at `apps/server/src/integrations/security/` with controllers and services for both `screenshot-attempt` and `protection-attempt` endpoints. However, the `ScreenshotDetectionService` uses an in-memory `Map` for strike counts — it must be migrated to the database.

The two critical bugs to fix are: (1) `ScreenshotDetection.tsx` line 35 uses `isMember` (workspace-level) instead of the READER space role gate, meaning protection triggers for the wrong users; (2) `ContentProtectionAlways.tsx` lines 55-62 run a `setInterval` that fires on window resize/docking, causing false positive content blur for legitimate clients.

The admin panel is a settings sidebar (`/settings/security` already exists for SSO). Adding a "Content Security" entry follows the same `groupedData` array pattern and `isAdmin` gate already used in `settings-sidebar.tsx`.

**Primary recommendation:** Fix the role gate bug first (PROT-05), then remove the dev tools interval (PROT-06), then wire the database for screenshot persistence (PROT-V2-01), then add the diagonal watermark (PROT-04), then build the admin panel tab (PROT-V2-02).

---

## 1. Admin Panel Structure

### Location
The settings panel is **not** under `pages/admin/`. It lives at:
- `apps/client/src/components/settings/settings-sidebar.tsx` — the sidebar nav (where to add a new entry)
- `apps/client/src/pages/settings/` — individual settings pages
- `apps/client/src/ee/security/pages/security.tsx` — closest structural analogue (Security & SSO page)

### Route Registration
Routes are defined inline in `apps/client/src/App.tsx` inside the `<Route path="/settings">` block:

```tsx
// apps/client/src/App.tsx, lines 95-112
<Route path={"/settings"}>
  <Route path={"account/profile"} element={<AccountSettings />} />
  <Route path={"workspace"} element={<WorkspaceSettings />} />
  <Route path={"members"} element={<WorkspaceMembers />} />
  <Route path={"security"} element={<Security />} />   // existing EE security page
  {!isCloud() && <Route path={"license"} element={<License />} />}
  {isCloud() && <Route path={"billing"} element={<Billing />} />}
</Route>
```

New Security Violations route should be added here:
```tsx
<Route path={"content-security"} element={<ContentSecurity />} />
```

### Sidebar Entry Pattern
`settings-sidebar.tsx` uses a `groupedData` array of `DataGroup` objects. Each `DataItem` has optional flags: `isAdmin`, `isCloud`, `isEnterprise`, `showDisabledInNonEE`.

Add to the "Workspace" group in `groupedData`:
```tsx
{
  label: "Content Security",
  icon: IconShieldLock,   // or IconShield from @tabler/icons-react
  path: "/settings/content-security",
  isAdmin: true,          // only admins see this entry
}
```

### Admin Gate Pattern
All settings pages gate on `isAdmin` from `useUserRole()`:

```tsx
// apps/client/src/ee/security/pages/security.tsx, lines 22-24
const { isAdmin } = useUserRole();
if (!isAdmin) {
  return null;
}
```

`isAdmin` comes from `useUserRole()` hook (`apps/client/src/hooks/use-user-role.tsx`) which reads `currentUserAtom` and checks `role === UserRole.ADMIN || role === UserRole.OWNER`.

The sidebar additionally hides the entire "Workspace" group from non-admins:
```tsx
// settings-sidebar.tsx, lines 183-185
if (group.heading === "Workspace" && !isAdmin) {
  return null;
}
```

---

## 2. User Account Locking

### Existing Fields (confirmed in DB)
The `users` table already has TWO relevant fields for suspension, added by migration `20241019T200000-add-user-suspended.ts`:

```typescript
// apps/server/src/database/types/db.d.ts, lines 313-314
suspendedAt: Timestamp | null;
suspensionReason: string | null;
```

There is also a separate `deactivatedAt` field (line 298) used for admin-deactivated accounts.

### Login Flow Check
The JWT strategy validates both fields on every authenticated request:

```typescript
// apps/server/src/core/auth/strategies/jwt.strategy.ts, line 56
if (!user || user.deactivatedAt || user.deletedAt) {
  throw new UnauthorizedException();
}
```

**Critical gap**: The JWT strategy checks `deactivatedAt` and `deletedAt` but NOT `suspendedAt`. The `ScreenshotDetectionService.suspendUserAccount()` sets `suspendedAt` in the DB, but the JWT strategy will still let suspended users log in.

**Fix needed**: Add `user.suspendedAt` to the JWT strategy check to enforce login blocking:
```typescript
// jwt.strategy.ts line 56 — add suspendedAt
if (!user || user.deactivatedAt || user.deletedAt || user.suspendedAt) {
  throw new UnauthorizedException();
}
```

The `TokenService` (`apps/server/src/core/auth/services/token.service.ts`) has the same gap — checks `deactivatedAt`/`deletedAt` but not `suspendedAt` (lines 27, 41, 82, 101).

### baseFields in UserRepo
`suspendedAt` and `suspensionReason` are NOT in the `baseFields` array (`user.repo.ts` lines 21-38). They must be added to `baseFields` for the JWT strategy and admin endpoints to read them via `findById`.

### Admin Reinstatement Query Pattern
To reinstate a user (clear suspension), use Kysely updateTable directly in the service:
```typescript
await this.db
  .updateTable('users')
  .set({ suspendedAt: null, suspensionReason: null, updatedAt: new Date() })
  .where('id', '=', userId)
  .execute();
```
(Same Kysely pattern used by `suspendUserAccount()` in `screenshot-detection.service.ts` lines 164-172.)

---

## 3. NestJS Backend Patterns

### Module Structure
Server modules live in `apps/server/src/core/` (domain logic) and `apps/server/src/integrations/` (cross-cutting concerns). The SecurityModule already lives in integrations:

```
apps/server/src/integrations/security/
├── security.module.ts                      — module definition
├── content-protection.controller.ts        — POST /security/protection-attempt
├── content-protection.service.ts           — logging service (console-only today)
├── screenshot-detection.controller.ts      — POST /security/screenshot-attempt, GET /security/screenshot-status
├── screenshot-detection.service.ts         — in-memory strike tracking (needs DB migration)
├── robots.txt.controller.ts
├── version.controller.ts
├── version.service.ts
└── dto/
    ├── screenshot-attempt.dto.ts
    └── content-protection-attempt.dto.ts
```

`SecurityModule` is already registered in `app.module.ts`.

### Auth Guard
Standard pattern: `@UseGuards(JwtAuthGuard)` on the controller class (already applied to both security controllers).

### AuthUser Decorator
Use `@AuthUser()` (custom decorator) to extract the user from the JWT context, rather than `req.user.userId`:

```typescript
// apps/server/src/common/decorators/auth-user.decorator.ts
export const AuthUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user.user;   // returns full User entity
  },
);
```

**Current controllers use `req.user?.userId`** — this is a bug. The correct pattern from the rest of the codebase is `@AuthUser() user: User`, which gives you `user.id` directly. See `page.controller.ts` line 51 as canonical example.

### Kysely Injection
```typescript
@Injectable()
export class ScreenshotDetectionService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly userRepo: UserRepo,
  ) {}
}
```

---

## 4. Kysely Migration Pattern

### File Naming Convention
```
YYYYMMDDTHHMMSS-kebab-case-description.ts
```
Example: `20260319T120000-add-language-to-spaces.ts`

### createTable Pattern
No createTable example exists in recent migrations (all recent ones use `alterTable`). For a new table, pattern from older migrations:

```typescript
// Pattern for new table migration
import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('screenshot_attempts')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull())
    .addColumn('workspace_id', 'uuid', (col) => col.notNull())
    .addColumn('method', 'varchar', (col) => col.notNull())
    .addColumn('details', 'text')
    .addColumn('user_agent', 'text')
    .addColumn('ip_address', 'varchar')
    .addColumn('attempt_number', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`).notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('screenshot_attempts').execute();
}
```

### alterTable Pattern (confirmed from Phase 2 migration)
```typescript
// apps/server/src/database/migrations/20260319T120000-add-language-to-spaces.ts
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('spaces')
    .addColumn('language', 'varchar', (col) => col)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('spaces')
    .dropColumn('language')
    .execute();
}
```

### DB Type Registration
After creating the migration, add the new table interface to `apps/server/src/database/types/db.d.ts` and add it to the `DB` interface at the bottom (lines 366-387).

---

## 5. ScreenshotDetection Analysis

### File
`apps/client/src/components/ScreenshotDetection.tsx`

### Role Gate Bug (PROT-05)
**Line 35**: `const { isMember } = useUserRole();`
**Lines 48-50**: early return if NOT `isMember` — meaning detection is active for members and inactive for non-members. This is INVERTED. `isMember` means workspace `MEMBER` role, not READER space role.

**Fix**: Remove the `useUserRole` import and `isMember` usage. Replace with the `protected` prop pattern:

```tsx
// page.tsx — pass the gate as a prop (same as ContentProtection)
<ScreenshotDetection protected={spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)}>
```

```tsx
// ScreenshotDetection.tsx — accept the prop and early-return when not protected
interface ScreenshotDetectionProps {
  children: React.ReactNode;
  protected: boolean;
}

export const ScreenshotDetection: React.FC<ScreenshotDetectionProps> = ({ children, protected: isProtected }) => {
  if (!isProtected) {
    return <>{children}</>;
  }
  // ... rest of component
```

### Backend Endpoint URLs (Inconsistency)
- `logScreenshotAttempt()` at line 21 calls: `POST /api/security/screenshot-attempt` — correct
- `checkSuspensionStatus()` at line 249 calls: `GET /security/screenshot-status` — **missing `/api` prefix** — this call will 404

Fix line 249: `await api.get('/api/security/screenshot-status')`

### Copy Event Handler (Lines 199-206)
The `handleCopy` listener at line 285 attaches to `document` in capture phase and calls `showScreenshotWarning()`. This will fire on every copy attempt (which ContentProtection.tsx already blocks silently). Per the locked decisions, copy events must NOT trigger strikes. Remove the `handleCopy` listener registration from line 285 and the corresponding `document.addEventListener('copy', handleCopy, true)`.

### Suspension Check on Mount (Lines 243-272)
The `checkSuspensionStatus` useEffect correctly fetches from the backend on mount and shows the suspended modal if `attemptCount >= 3`. This logic is correct and should be kept once the `/api` prefix bug is fixed.

### In-Memory Strike State Problem
`setAttemptCount(localCount)` (line 63) increments a local React state. On page reload the count resets to 0. The response from the backend API will return the real DB count (once persisted), overwriting the local increment. The current fallback to local count on API failure remains acceptable for offline resilience.

---

## 6. ContentProtectionAlways Lines to Remove

### File
`apps/client/src/components/ContentProtectionAlways.tsx`

### What Must Be Removed (PROT-06)
The dev tools detection interval causes false positives when users resize the window, zoom the browser, or dock/undock the devtools panel without opening them.

**Lines to remove / simplify:**

1. **State declarations (lines 24-26):**
   ```tsx
   const [devToolsOpen, setDevToolsOpen] = useState(false);  // remove
   const [blurred, setBlurred] = useState(false);             // remove
   const devToolsCheckInterval = useRef<NodeJS.Timeout | null>(null);  // remove
   ```

2. **`checkDevTools` callback (lines 30-51):** Remove entirely.

3. **`useEffect` that starts the interval (lines 53-62):** Remove entirely:
   ```tsx
   useEffect(() => {
     devToolsCheckInterval.current = setInterval(checkDevTools, 1000);
     return () => {
       if (devToolsCheckInterval.current) {
         clearInterval(devToolsCheckInterval.current);
       }
     };
   }, [checkDevTools]);
   ```

4. **JSX that uses `blurred`/`devToolsOpen` (lines 307-321):**
   ```tsx
   {blurred && devToolsOpen && (
     <div className="dev-tools-warning">...</div>    // remove entire block
   )}
   <div className={blurred ? 'content-blurred' : 'content-protected'}>  // simplify to always 'content-protected'
   ```

5. **In `ContentProtection.css` — the dev tools CSS** (lines 70-130): The `.content-blurred`, `.dev-tools-warning`, `.dev-tools-warning-content` classes and `@keyframes pulse` can be removed since nothing will use them after the fix. Keep `.content-protected` and all other classes.

### What Must NOT Be Removed
- All keyboard event listeners (F12, Ctrl+Shift+I blocking) — these stay
- Right-click, copy, cut, selectstart, drag, touch event listeners — these stay
- Print `beforeprint` listener — stays
- The Safari Reader Mode prevention MutationObserver — stays

---

## 7. Watermark User Email Access

### Pattern
Email is available via Jotai atom `userAtom` from `apps/client/src/features/user/atoms/current-user-atom.ts`:

```typescript
export const userAtom = atom((get) => {
  const currentUser = get(currentUserAtom);
  return currentUser?.user ?? null;  // returns IUser | null
});
```

`IUser.email` is typed as `string` (`user.types.ts` line 6).

### Usage in ContentProtection.tsx
```tsx
import { useAtom } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom";

export const ContentProtection: React.FC<ContentProtectionProps> = ({ children, protected: isProtected }) => {
  const [user] = useAtom(userAtom);
  const userEmail = user?.email ?? '';

  // Pass to CSS via data attribute or inject into SVG watermark
  return (
    <div ref={protectionRef} className="content-protection">
      <div className="content-protected" data-watermark-email={userEmail}>
        {children}
      </div>
    </div>
  );
};
```

### CSS Watermark Approach
The current `ContentProtection.css` has a placeholder `::after` at lines 189-201 that uses `content: attr(data-user-id)` at 0.05 opacity — corner only, not diagonal tiled.

For the real diagonal watermark, two approaches work:

**Option A — SVG data URI (recommended for dynamic text):**
The email cannot be injected into pure CSS `content`. Use an inline `div` element with a dynamically generated SVG background:
```tsx
// In the component render
const watermarkStyle = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200'>
      <text x='50%' y='50%' font-size='14' fill='rgba(128,128,128,0.07)'
        text-anchor='middle' transform='rotate(-35,150,100)'>${userEmail}</text>
    </svg>`
  )}")`,
  backgroundRepeat: 'repeat',
};
```

**Option B — CSS `::before` with `repeating-linear-gradient`:**
Cannot inject the email text via CSS alone. Would require either a data attribute or a separate React element.

The canonical approach for dynamic email watermarks (similar to Notion Enterprise) is Option A with a separate `div` overlay:
```tsx
<div
  className="content-watermark"
  style={{ backgroundImage: `url(...)` }}
  aria-hidden="true"
/>
```
```css
.content-watermark {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 9998;
  mix-blend-mode: multiply;   /* transparent on white bg, visible in screenshots */
  opacity: 0.07;
}
```

---

## 8. Existing Security Endpoints

### SecurityModule (confirmed exists)
`apps/server/src/integrations/security/security.module.ts` — already in `app.module.ts`

### Existing Endpoints

| Method | Path | Controller | Status |
|--------|------|------------|--------|
| POST | `/api/security/screenshot-attempt` | `ScreenshotDetectionController` | Exists, in-memory only |
| GET | `/api/security/screenshot-status` | `ScreenshotDetectionController` | Exists, in-memory only |
| POST | `/api/security/protection-attempt` | `ContentProtectionController` | Exists, console-log only |

### What Needs to Be Built

**Database migration**: New `screenshot_attempts` table (separate from `users.suspendedAt` — the table stores individual attempt records for the admin log; `suspendedAt` on `users` stores the account state).

**`ScreenshotDetectionService` DB migration** (replacing in-memory Map):
- `logScreenshotAttempt()`: Insert row into `screenshot_attempts`, update `users.suspendedAt` on strike 3
- `getUserStatus()`: Query `screenshot_attempts` for count, join with `users.suspendedAt`
- `resetUserAttempts()`: Delete `screenshot_attempts` rows for user, clear `users.suspendedAt`
- `getUsersWithViolations()`: Query for admin panel table

**New admin endpoint** needed:
- `GET /api/security/violations` — returns list of users with attempts (for admin panel)
- `POST /api/security/reinstate/:userId` — clears suspension (for admin panel reinstate button)

### req.user.userId Bug
Both existing controllers extract user ID as `req.user?.userId` (lines 26/27 in each controller). The JWT strategy stores the user as `request.user.user` (full User entity). The correct extraction is via `@AuthUser() user: User` decorator and then `user.id`. The `userId` field does not exist on the User entity as returned by `@AuthUser()`.

---

## Architecture Patterns

### Recommended Implementation Order
1. Fix role gate bug in `ScreenshotDetection.tsx` (pass `protected` prop from `page.tsx`)
2. Remove dev tools interval from `ContentProtectionAlways.tsx`
3. Fix `/api` prefix bug in `ScreenshotDetection.tsx` line 249
4. Fix `req.user?.userId` to `@AuthUser()` in security controllers
5. Add `suspendedAt` to JWT strategy + TokenService checks
6. Add `suspendedAt` to `UserRepo.baseFields`
7. Create Kysely migration for `screenshot_attempts` table
8. Add `ScreenshotAttempts` interface to `db.d.ts` + DB map
9. Migrate `ScreenshotDetectionService` from Map to Kysely queries
10. Add diagonal watermark to ContentProtection.tsx + CSS
11. Add admin `GET /api/security/violations` + `POST /api/security/reinstate/:userId` endpoints
12. Create `ContentSecurity` settings page component
13. Register route in `App.tsx`
14. Add sidebar entry in `settings-sidebar.tsx`

### Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| User auth extraction in controllers | Manual `req.user.userId` parsing | `@AuthUser()` decorator (already exists at `common/decorators/auth-user.decorator.ts`) |
| Watermark SVG generation | Custom canvas renderer | Inline SVG data URI with `encodeURIComponent` |
| User suspension DB query | Raw SQL | Kysely `updateTable('users').set({ suspendedAt: new Date() })` pattern (already in service) |

---

## Common Pitfalls

### Pitfall 1: Role Gate Direction Confusion
**What goes wrong:** `ScreenshotDetection.tsx` `if (!isMember) return children` means detection fires FOR members, not for readers. The fix inverts this: `if (!isProtected) return children` where `isProtected = spaceAbility.cannot(Manage, Page)` = true for readers, false for writers/admins.
**Warning signs:** Protection triggers when an admin/staff user loads a page, not when a client does.

### Pitfall 2: suspendedAt Not Blocking Login
**What goes wrong:** `jwt.strategy.ts` only checks `deactivatedAt` and `deletedAt`. Setting `suspendedAt` on a user has no effect on login until the strategy check is updated.
**Warning signs:** Admin suspends user, user reloads and is still able to access content.

### Pitfall 3: Missing `/api` Prefix on Screenshot Status Endpoint
**What goes wrong:** `ScreenshotDetection.tsx` line 249 calls `/security/screenshot-status` (no `/api` prefix). The API client likely has a baseURL of `/api`, making this resolve to the wrong URL.
**Warning signs:** 404 on the status check, console.warn fires on every page load for reader users.

### Pitfall 4: screenshot_attempts Table Not in DB Type Map
**What goes wrong:** Kysely is fully typed. Querying a table not listed in the `DB` interface causes TypeScript compilation errors.
**Fix:** After migration, add interface to `db.d.ts` and entry to `DB` map.

### Pitfall 5: Watermark Invisible in All Conditions
**What goes wrong:** `mix-blend-mode: multiply` is transparent on white but also transparent in screenshot if opacity is too low.
**Prevention:** Test at 0.06-0.08 opacity with multiply blend mode. The watermark should be essentially invisible to the naked eye but captured by screen capture tools which record raw pixel values.

---

## Sources

### Primary (HIGH confidence — direct file inspection)
- `apps/client/src/components/ScreenshotDetection.tsx` — full file read
- `apps/client/src/components/ContentProtectionAlways.tsx` — full file read
- `apps/client/src/components/ContentProtection.tsx` — full file read
- `apps/client/src/components/ContentProtection.css` — full file read
- `apps/client/src/pages/page/page.tsx` — full file read
- `apps/client/src/components/settings/settings-sidebar.tsx` — full file read
- `apps/client/src/App.tsx` — full file read (routes)
- `apps/client/src/features/user/atoms/current-user-atom.ts` — full file read
- `apps/client/src/features/user/types/user.types.ts` — full file read
- `apps/client/src/ee/security/pages/security.tsx` — full file read (admin panel pattern)
- `apps/server/src/integrations/security/security.module.ts` — full file read
- `apps/server/src/integrations/security/screenshot-detection.controller.ts` — full file read
- `apps/server/src/integrations/security/screenshot-detection.service.ts` — full file read
- `apps/server/src/integrations/security/content-protection.controller.ts` — full file read
- `apps/server/src/integrations/security/content-protection.service.ts` — full file read
- `apps/server/src/core/auth/strategies/jwt.strategy.ts` — full file read
- `apps/server/src/core/auth/services/token.service.ts` — partial read (suspension check gap)
- `apps/server/src/database/types/db.d.ts` — key sections read (Users interface, DB map)
- `apps/server/src/database/repos/user/user.repo.ts` — baseFields verified
- `apps/server/src/database/migrations/20241019T200000-add-user-suspended.ts` — full file read
- `apps/server/src/database/migrations/20260319T120000-add-language-to-spaces.ts` — full file read (migration pattern)
- `apps/server/src/common/decorators/auth-user.decorator.ts` — full file read

---

## Metadata

**Confidence breakdown:**
- Admin panel structure: HIGH — files read directly
- User account locking: HIGH — JWT strategy and DB types verified
- NestJS patterns: HIGH — multiple controllers and services inspected
- Kysely migration pattern: HIGH — two migration files read directly
- ScreenshotDetection analysis: HIGH — full file read; bugs confirmed with line numbers
- ContentProtectionAlways removal: HIGH — all affected lines identified
- Watermark email access: HIGH — atom structure and IUser type verified
- Security endpoints: HIGH — all four controller/service files read directly

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable codebase, no fast-moving dependencies)

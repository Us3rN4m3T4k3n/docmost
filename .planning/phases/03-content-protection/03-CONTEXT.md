# Phase 3: Content Protection - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify and fix all existing content protection features so they work correctly for READER-role clients (PROT-01 through PROT-06). Implement a visible-in-screenshots dynamic watermark with user email. Fix the inverted role gate in ScreenshotDetection. Remove the dev tools false-positive detection.

**Scope expansion (user-requested):** The full 3-strike screenshot enforcement system — originally scoped as PROT-V2-01/V2-02 — is included in Phase 3. This adds: a backend `screenshot_attempts` table with persistent counts, a `/api/security/screenshot-attempt` endpoint, a `/api/security/screenshot-status` endpoint, and a new "Security" tab in the admin panel with violation log and account reinstatement.

Does NOT include: content access filtering by language (LANG-04, Phase 4), Stripe billing integration, or deployment.

</domain>

<decisions>
## Implementation Decisions

### Watermark Design (PROT-04)

- **Style**: Diagonal repeating text overlay across the full content area — same approach as Google Docs / Notion Enterprise. Text repeats at ~45° angle, tiled across the page.
- **Content**: Email address only (e.g., `client@agency.com`). No name required — email is always available and unambiguous.
- **Visibility approach**: Always-on via CSS `mix-blend-mode` at very low opacity (~0.06–0.08). During normal reading: nearly invisible (white background washes it out). In screenshots: screen capture captures raw pixel values, revealing the watermark text. This is the industry-standard approach for "invisible to the eye but visible in screenshots."
- **Implementation**: Fixed-position `::before` or separate `div` overlay with `pointer-events: none` and `z-index` above content. Text rendered via SVG data URI background or CSS `content` with `repeating-linear-gradient` or Canvas. The email must be injected dynamically from the authenticated user session.

### Screenshot Detection and 3-Strike System (PROT-05 + scope expansion)

- **What triggers a strike**: Screenshot keyboard shortcuts ONLY — `Cmd+Shift+3`, `Cmd+Shift+4`, `Cmd+Shift+5` (Mac), `PrintScreen` (Windows), `Win+Shift+S` (Windows Snipping Tool).
- **Right-click, Ctrl+C, Ctrl+P**: Blocked silently — NO strike counter, NO warning modal. These are common accidental actions.
- **Strike 1**: Warning modal — "This screenshot attempt has been logged. Further attempts will suspend your account."
- **Strike 2**: Final warning modal — "Admins have been notified. One more attempt will suspend your account immediately."
- **Strike 3+**: Account locked. Content is blocked, user sees a "Account Suspended" modal with a contact/support note. No automatic re-access. Admin must reinstate manually.
- **Backend persistence**: Strikes are stored in a `screenshot_attempts` table (or `security_violations` table) in the database. Counts persist across page reloads and deploys. The existing ScreenshotDetection.tsx `logScreenshotAttempt()` already calls `/api/security/screenshot-attempt` — build this endpoint.
- **Role gate fix**: ScreenshotDetection.tsx currently uses `isMember` (workspace-level hook). Must be changed to gate on READER space role — use `spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)` consistent with ContentProtection.tsx.

### Admin Security Panel (scope expansion)

- **Location**: New "Security" tab/section within the existing Docmost admin panel (not a standalone route).
- **Content**: Table showing — user email, total strike count, last attempt timestamp, account status (Active / Locked).
- **Admin actions**: "Reinstate account" button per row — clears the suspended status and allows the user to log back in.
- **Who can see it**: Admin role only (same gate as other admin panel pages).

### Dev Tools Detection Removal (PROT-06)

- Remove the `setInterval` dev tools detection from `ContentProtectionAlways.tsx` — this is the source of false positives that block legitimate clients (window resize, browser zoom, and docking/undocking all trigger it).
- `ContentProtection.tsx` does NOT have a dev tools interval check — nothing to remove there.
- The `content-blurred` and `dev-tools-warning` CSS classes and the related JSX can be removed from `ContentProtectionAlways.tsx` entirely.
- Dev tools keyboard shortcuts (F12, Ctrl+Shift+I) are still blocked by ContentProtection.tsx — that stays.

### Existing Protection Features Verification (PROT-01, PROT-02, PROT-03, PROT-05)

- `ContentProtection.tsx` already has the correct role gate: `protected={spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)}` in `page.tsx`.
- Existing protections implemented (need verification they actually work):
  - Right-click context menu disabled via `contextmenu` event listener
  - Text selection/copy disabled via `selectstart`, `copy`, `cut` listeners + CSS `user-select: none`
  - Print blocked via `beforeprint` event + CSS `@media print { display: none }`
  - Keyboard shortcuts (Ctrl+C, Ctrl+P, Ctrl+S, Ctrl+U) blocked via `keydown` listener
- Phase 3 must run the existing features against a READER-role test user and confirm they work. Any failures are bugs to fix.

### Print Dialog UX (PROT-03)

- Not explicitly discussed — default to the existing approach: `alert('Printing is disabled')` on `beforeprint` event + `@media print { display: none }` in CSS.
- Both mechanisms are already implemented. Claude can clean up or improve the UX (e.g., replace alert with a toast notification) at discretion.

### Backend API for logProtectionAttempt (ContentProtection.tsx)

- The `logProtectionAttempt()` in `ContentProtection.tsx` calls `/api/security/protection-attempt` — this endpoint likely doesn't exist.
- Since right-click/copy/print are blocked silently (no strikes), this logging call is not critical for Phase 3 functionality.
- **Claude's discretion**: Either remove the `logProtectionAttempt()` calls from `ContentProtection.tsx` (simplest — no console errors), or keep them and ensure the endpoint exists as a no-op. Do NOT create a full backend logging system for these — that's v2.

### Claude's Discretion

- Exact CSS/SVG technique for the diagonal watermark overlay (CSS `repeating-linear-gradient` with transparent background, SVG data URI, or Canvas API)
- Font size and rotation angle of watermark text (industry standard is ~30–45°)
- Exact table schema for `screenshot_attempts` / `security_violations` (column names, indexes)
- Whether to use Kysely migrations or another pattern for the new table (follow existing migration patterns)
- Whether to use a new NestJS module (e.g., `SecurityModule`) or add to an existing one for the `/api/security/` endpoints

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs or ADRs exist in this project. Requirements are fully captured in the decisions above and the files below.

### Requirements
- `.planning/REQUIREMENTS.md` — Phase 3 covers PROT-01 through PROT-06 (v1) + PROT-V2-01, PROT-V2-02 (pulled into Phase 3 by user decision)
- `.planning/PROJECT.md` — Project context, constraints (client-side protection only, acknowledged limitation)

### Existing Content Protection Code (read before any modification)
- `apps/client/src/components/ContentProtection.tsx` — Main protection component; already correctly gated; do NOT re-introduce dev tools detection here
- `apps/client/src/components/ContentProtection.css` — Protection styles; watermark placeholder exists at bottom (`::after` with `0.05` opacity) — replace with real diagonal watermark
- `apps/client/src/components/ContentProtectionAlways.tsx` — Remove the `setInterval` dev tools detection from this file (PROT-06)
- `apps/client/src/components/ScreenshotDetection.tsx` — Fix role gate (`isMember` → READER space role); backend endpoint target is `/api/security/screenshot-attempt`
- `apps/client/src/pages/page/page.tsx` — Where ContentProtection and ScreenshotDetection are wired; already uses correct `spaceAbility` prop

### Phase 1 Context (role gate pattern)
- `.planning/phases/01-client-isolation-and-read-only-access/01-CONTEXT.md` — Documents the correct role gate pattern (`spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)`) that must be applied to ScreenshotDetection.tsx

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ContentProtection.tsx` — All 5 protection behaviors (right-click, copy, cut, print, selectstart) already implemented with event listeners. Role gate already correct. Use as-is.
- `ScreenshotDetection.tsx` — 3-strike warning modal UI already built. Backend API call pattern already coded (`/api/security/screenshot-attempt`). Fix role gate and build the backend endpoint.
- `ContentProtection.css` — `@media print { display: none }` already in place. `::after` pseudo-element watermark placeholder exists — upgrade it to diagonal repeating overlay.
- Kysely migration pattern — Use same `alterTable addColumn` or `createTable` pattern as Phase 2 migration for the new `screenshot_attempts` table.

### Established Patterns
- CASL space ability pattern: `spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)` → true for READER users, false for WRITER/ADMIN
- Role gate in ContentProtection.tsx: receives `protected={boolean}` prop from page.tsx — same pattern should apply to ScreenshotDetection.tsx
- NestJS service pattern: injectable service + repository pattern (see `locale-detection.service.ts` from Phase 2 for simple injectable service example)

### Integration Points
- `page.tsx` — Both `ContentProtection` and `ScreenshotDetection` are wired here; `spaceAbility` is already available for the fixed role gate
- Admin panel — Research where to add the Security tab (likely in `apps/client/src/features/workspace/` or `apps/client/src/pages/admin/`)
- Docmost auth on suspension: need to investigate how to lock a user account (set `isActive: false` or similar on the `users` table), and how the login flow checks this

</code_context>

<specifics>
## Specific Ideas

- The watermark should look like enterprise SOP platform watermarks (Google Docs confidential mode, Notion Enterprise) — diagonal text tiled across the page, barely visible during normal reading, revealed in screenshots
- The 3-strike system is about screenshot capture specifically — users should understand WHY they received the warning, not just "something was blocked"
- Admin reinstatement should be a simple one-click action per user row in the Security panel — no complex workflow needed for v1

</specifics>

<deferred>
## Deferred Ideas

- Print dialog UX improvement (replace `alert()` with toast notification) — Claude's discretion to improve if easy, not a hard requirement
- Automated admin notification on 3rd strike (email to admin) — could be added as a small enhancement if Phase 4's email infrastructure is ready; defer for now
- Screenshot detection for browser extensions (Nimbus, Lightshot) via MutationObserver on DOM injection — exists in ScreenshotDetection.tsx, verify it works or remove if too noisy
- In-app appeal form for suspended users — for now, suspension message just says "contact support"; formal appeal workflow is future

</deferred>

---

*Phase: 03-content-protection*
*Context gathered: 2026-03-20*

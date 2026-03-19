# Domain Pitfalls

**Domain:** Paid SOP knowledge base with content protection — Docmost fork
**Researched:** 2026-03-19
**Confidence:** HIGH (all findings verified directly against production codebase)

---

## Critical Pitfalls

Mistakes that cause rewrites, security breaches, or total feature failure.

---

### Pitfall 1: Content Protection Applies Only to `MEMBER` Role — Clients Get No Protection

**What goes wrong:** `ContentProtection.tsx` gates all protection logic behind `if (!isMember) return <>{children}</>`. The `isMember` check reads workspace-level role via `useUserRole()`, which maps `UserRole.MEMBER` to `isMember = true`. If external clients are assigned any other workspace role (ADMIN, OWNER, or a custom role not yet defined), the protection wrapper is a no-op and renders entirely unprotected content.

**Why it happens:** The protection component was written assuming internal staff == MEMBER and external clients == some protected class. The workspace-level roles (OWNER, ADMIN, MEMBER) do not map cleanly to "internal vs external" without a deliberate role assignment convention. No dedicated "external client" workspace role exists.

**Consequences:** External paying clients get zero content protection — no right-click suppression, no copy blocking, no watermark — without any visible error. The failure is silent.

**Prevention:**
- Decide at the start of Phase 1 what workspace role external clients receive and document it explicitly.
- Invert the guard logic: protect by default and only skip protection for explicitly-internal roles (ADMIN/OWNER), not by checking `isMember`.
- Add an integration test that creates a client-role user and asserts protection listeners are active.

**Warning signs:** A client user can right-click and select text with no console warnings. The React component tree shows `ContentProtection` returning bare `children` without the wrapper `div.content-protection`.

**Phase:** Phase 1 (Client Isolation and Read-Only Access) — must be resolved before any client-facing work.

---

### Pitfall 2: Dev Tools Detection Triggers on Normal Browser Configurations

**What goes wrong:** The devtools detector uses `window.outerWidth - window.innerWidth > 160` as its primary heuristic. This fires on:
- Any browser window that is not full-screen on a secondary monitor
- Browsers with high-DPI scaling
- Browsers docked to one side of a split-screen desktop
- Any user who has window chrome (extensions toolbar, bookmarks bar open)

The interval runs every 1,000 ms and blurs content, showing a "Developer Tools Detected" warning. Legitimate clients using normal browser configurations will see their content blurred repeatedly.

**Why it happens:** The threshold check is inherently unreliable. `outerWidth - innerWidth` measures the browser chrome plus any attached panels, not only devtools. The `debugger` statement approach (run every 5,000 ms) pauses execution on any system where a debugger is attached, which includes some browser extensions and profiling tools.

**Consequences:** Client-facing UX break with no recourse. Clients cannot close devtools because devtools are not open. Trust damage and refund requests.

**Prevention:**
- Remove or disable the `window.outerWidth` heuristic. It produces too many false positives to be useful.
- The `debugger;` approach should also be removed from production; it degrades page performance measurably on slower machines.
- Keep only the keyboard shortcut and clipboard event blocking, which are low-false-positive methods.
- Test the protection component on Chrome, Firefox, Safari, and Edge, each at 80%, 100%, and 125% zoom, before marking the protection feature as complete.

**Warning signs:** Internal team members report seeing the "Developer Tools Detected" overlay with devtools closed. Any report of blurred content from a client is this pitfall until proven otherwise.

**Phase:** Phase 1 — Must be resolved before client onboarding begins.

---

### Pitfall 3: Screenshot Detection Data Vanishes on Every Deploy

**What goes wrong:** `ScreenshotDetectionService` stores all violation state in `private userAttempts = new Map<string, UserScreenshotStatus>()`. The three-strike suspension threshold (warning → final_warning → suspended) is therefore reset on every Railway deploy, every server restart, and every crash-restart cycle. A user who has received two warnings can get a fresh slate by simply waiting for the next deployment.

**Why it happens:** The database persistence layer is stubbed — the `TODO` block that was supposed to write to `screenshotAttempts` and `users` tables is commented out. The in-memory Map is the only store.

**Consequences:** The security feature is inoperable in production. User suspension relies on a counter that resets on restarts. This is confirmed by `CONCERNS.md` as known tech debt.

**Prevention:**
- Do not deploy the screenshot detection feature as a security control until database persistence is implemented.
- The schema additions (`screenshotAttempts` count, `accountStatus`, `isSuspended` columns on `users`) need to be in a migration before the feature is enabled.
- Add a feature flag env var (e.g., `SCREENSHOT_DETECTION_ENABLED=false`) so it can be disabled until the DB layer is solid.
- When implementing, also implement session revocation on suspension — currently `suspendedAt` is set in the DB but active JWT tokens remain valid (noted `TODO` at line 176-179 of the service).

**Warning signs:** Server logs show "Screenshot Attempt" warnings but the same user is never suspended. A restarted server shows `getUsersWithViolations()` returning an empty array despite prior violations being logged.

**Phase:** Phase 2 (Content Protection) — implement DB persistence before enabling enforcement.

---

### Pitfall 4: Stripe Webhooks Without Idempotency Lead to Double Account Provisioning

**What goes wrong:** Railway can replay webhook delivery if a response is not returned within Stripe's timeout window (typically 30 seconds). If the account provisioning logic creates a user and workspace in one request, a replayed webhook will either create duplicate rows or crash with a unique constraint violation — neither of which leaves the system in a clean state.

**Why it happens:** Stripe's webhook delivery guarantee is "at least once." Without an idempotency check keyed on the Stripe event ID, every delivery triggers provisioning. The billing migration shows `stripe_subscription_id` has a unique constraint, but there is no Stripe event deduplication table and no webhook handler implementation yet to audit.

**Consequences:** A paying client gets two accounts or no account (if the second delivery hits the unique constraint and throws, leaving the client unprovisioned). Stripe retries on 5xx responses, which makes a failed second delivery retry multiple times.

**Prevention:**
- Store processed Stripe event IDs in a `stripe_webhook_events` table with the event ID as the primary key.
- Before executing any provisioning logic, attempt `INSERT ... ON CONFLICT DO NOTHING` on that table. If 0 rows were inserted, the event was already processed — return 200 immediately.
- The webhook endpoint must return 200 to Stripe as quickly as possible. Move provisioning into a Bull queue job that processes asynchronously; the webhook handler only enqueues and returns 200.
- Verify webhook signatures using the Stripe signing secret before processing. A missing signature check allows arbitrary POST requests to provision accounts.

**Warning signs:** Duplicate rows in `users` or `billing` tables with the same `stripe_customer_id`. A client reports being charged but having no access (failed second delivery caused an uncaught exception, stopping provisioning).

**Phase:** Phase 3 (Stripe Billing) — idempotency must be designed into the webhook handler before any other provisioning logic is written.

---

### Pitfall 5: Space-Level CASL Does Not Verify Workspace Membership

**What goes wrong:** `SpaceAbilityFactory.createForUser()` builds a user's abilities from `spaceMembers` rows. If a user from Workspace A knows (or guesses) a page UUID or space UUID belonging to Workspace B, and somehow has a `spaceMembers` row for that space (e.g., a data migration error or cross-workspace group assignment bug), the CASL check will grant access to Workspace B's content. Separately, `getUserSpaces()` has a commented-out `.where('workspaceId', '=', workspaceId)` filter — this is not a current bypass, but it signals that workspace scoping was not complete at the time this code was written.

**What is the actual exposure:** `PageRepo.findById()` looks up pages by UUID or slugId without filtering by workspaceId. The CASL check in `PageController.getPage()` runs *after* the DB fetch. If the CASL check passes (space membership confirmed), the page is returned regardless of workspace boundary. The protection against cross-workspace reads depends entirely on no cross-workspace space membership existing in `spaceMembers`.

**Why it happens:** The data model is workspace → spaces → pages, but the spaceMembers lookup does not enforce the workspace boundary. Cross-workspace space membership should be impossible by FK constraints alone (spaces have a workspaceId FK), but the lookup joins do not double-check this.

**Consequences:** An external client who discovers the space UUID of an internal space could gain access to internal pages if they also have a space membership row for that space. This is the core security guarantee of the product.

**Prevention:**
- Add `workspaceId` filtering to `PageRepo.findById()` so that a cross-workspace page lookup returns null before reaching the CASL check.
- Add `workspaceId` filtering to all space membership queries — restore the commented-out `.where('workspaceId', '=', workspaceId)` line in `getUserSpaces()`.
- Write a server-side integration test: create two workspaces, authenticate as a user in workspace A, attempt to fetch a page from workspace B by UUID — expect 404, not 403.
- In the client role assignment flow (when Stripe provisions an account), explicitly scope the user to only the external client space.

**Warning signs:** A user authenticated in one workspace can receive data from another workspace's page endpoint by supplying a known UUID. Space listing for a user returns spaces from workspaces they are not members of.

**Phase:** Phase 1 (Client Isolation) — this must be closed before external clients are onboarded.

---

### Pitfall 6: API Route Serving Content That Bypasses All Client-Side Protection

**What goes wrong:** All content protection is client-side (CSS, JS event listeners). The TipTap page content is returned as JSON via `/api/pages/info` and as a Yjs CRDT binary via the Hocuspocus WebSocket. Any user with a valid JWT token — including external clients — can call `/api/pages/info` directly with `curl` or Postman, receive the full document JSON, and extract the complete SOP text with no keyboard shortcut blocking, no devtools detection, and no watermark.

**Why it happens:** This is the acknowledged limitation of "client-side protection only." The PROJECT.md explicitly states "true DRM is impossible on web." The risk is that the team treats client-side protection as security rather than as UX friction.

**Consequences:** Any technically proficient paying client (or anyone they share credentials with) can trivially extract all SOP content via the API. This is not a bug — it is the architectural decision — but it becomes a problem if sales messaging implies strong content protection.

**Prevention:**
- Communicate to stakeholders clearly: the protection raises the cost of copying, it does not prevent copying by someone with technical knowledge.
- Do not add rate limiting to content API routes as a "protection" measure — it will break the editor.
- Focus protection UX on deterrence (watermarks with client name, visible warning banners) rather than prevention. A visible watermark on screenshots is more enforceable than blocking copy.
- Do not ship features like "audit trail of who copied content" based on the server-side `ContentProtectionService` — it is a stub and cannot enforce anything.

**Warning signs:** Team members saying "the content is protected" in sales contexts. Any marketing language that implies clients cannot extract content.

**Phase:** Phase 2 (Content Protection) — set expectations before implementation begins.

---

## Moderate Pitfalls

### Pitfall 7: Railway Deployment Uses Local File Storage by Default

**What goes wrong:** `RAILWAY_DEPLOY.md` and the `railway.json` default to `STORAGE_DRIVER=local`. Railway containers are ephemeral — every redeploy destroys the filesystem. All uploaded attachments (images, PDFs, embedded files in SOPs) will be lost on any deploy, crash, or container restart.

**Why it happens:** Local storage is easier to configure for initial testing. The documentation notes S3 as "recommended for production" but does not make it a hard requirement.

**Consequences:** SOP documents with embedded images will show broken image links after any Railway redeploy. This is not recoverable without S3 backup.

**Prevention:**
- Configure S3 (or Cloudflare R2) as the storage driver before adding any attachment content to the production instance. Make this a required step in the deployment checklist, not optional.
- The env vars `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY`, `AWS_S3_REGION`, `AWS_S3_BUCKET` must be set before first production deploy.
- Add a health check or startup validation that refuses to start if `STORAGE_DRIVER=local` in a production environment.

**Warning signs:** Attachments work fine during initial deploy testing, then break after the first code push to Railway.

**Phase:** Phase 4 (Railway Deployment) — must be addressed before any content is added to production.

---

### Pitfall 8: SPA Routing Has Active Instability

**What goes wrong:** Five recent commits (all within the git history visible at project start) are successive fixes to SPA routing and static file serving. The issue manifests as the app URL being inaccessible — the problem described in `PROJECT.md` ("Railway deployment was attempted but the app URL was inaccessible"). The root cause involves conflicts between NestJS controller routing, Fastify's static file plugin, and the React SPA catch-all route.

**Why it happens:** Fastify-static and NestJS's route registration order interact in non-obvious ways. The `CONCERNS.md` file flags this as a known bug with high severity.

**Consequences:** The app cannot load in production until this is stable. Any modification to server startup, middleware order, or static file configuration can reintroduce the issue.

**Prevention:**
- Do not modify `apps/server/src/integrations/static/` without a Railway deploy test immediately after.
- Write an end-to-end test that hits the Railway URL's root and confirms the React app loads (HTTP 200 with HTML content, not API JSON).
- When adding new NestJS controllers (e.g., for Stripe webhooks), verify they do not conflict with the catch-all static route by testing the SPA routes still work.

**Warning signs:** `GET /` returns JSON instead of HTML. `GET /some-spa-route` returns 404. Browser console shows failed chunk loads.

**Phase:** Phase 4 (Railway Deployment) — validate routing stability before declaring deployment complete.

---

### Pitfall 9: Docmost Fork Divergence Accumulates Over Time

**What goes wrong:** As upstream Docmost ships fixes and features, this fork will diverge. Every merge from upstream is a potential conflict with the custom additions: `ContentProtection.tsx`, the security module, the billing migration, and any custom role logic. The more features are added to the fork without merging upstream periodically, the more expensive each future merge becomes.

**Why it happens:** Fork maintenance is often deprioritized until a critical upstream fix is needed urgently. At that point, the merge conflict surface is large.

**Consequences:** A critical security fix or editor bug fix in upstream Docmost becomes a multi-day merge project instead of a one-hour cherry-pick. The team may defer upstream fixes and accumulate security debt.

**Prevention:**
- Keep all custom code in clearly delineated files and directories (e.g., `apps/server/src/integrations/billing/`, `apps/client/src/components/ContentProtection.tsx`). Avoid modifying Docmost's core files where possible.
- Do not inline custom behavior into existing Docmost controllers — add new controllers and modules.
- Establish a monthly upstream sync cadence. Set up a `upstream-sync` branch and run merges there first.
- Tag the current commit as `fork-base-v0` so the divergence point is always clear.

**Warning signs:** Merge conflicts appearing in `page.controller.ts`, `app.module.ts`, or any file that both Docmost and the custom work touch. More than two months since last upstream merge.

**Phase:** Ongoing — establish the discipline in Phase 1 before any custom code is written.

---

## Minor Pitfalls

### Pitfall 10: `beforeprint` Event Fires Alert That Cannot Be Dismissed in Some Browsers

**What goes wrong:** The print protection calls `alert('Printing is disabled for this content.')` inside the `beforeprint` event handler. On some browser/OS combinations (particularly Chrome on macOS), the alert fires but the print dialog also opens behind it. On mobile browsers, `beforeprint` may not fire at all — the system print sheet opens via the browser chrome, bypassing JavaScript entirely.

**Prevention:** Replace the `alert()` with an in-page UI notification (toast or modal). Accept that mobile system print cannot be blocked and focus protection effort elsewhere. Document this limitation explicitly.

**Phase:** Phase 2 (Content Protection) — handle when polishing the protection UX.

---

### Pitfall 11: Stripe Webhook Raw Body Must Not Be Parsed by NestJS/Fastify

**What goes wrong:** Stripe webhook signature verification requires the raw, unparsed request body. NestJS with Fastify uses `@fastify/multipart` or the built-in body parser which parses JSON before the controller receives it. The parsed JSON body is re-serialized to a different byte sequence, causing `stripe.webhooks.constructEvent()` to throw a signature verification error on every webhook.

**Prevention:** Designate the Stripe webhook endpoint with a custom Fastify route (not a NestJS controller decorated route) or use a raw body buffer middleware. Add a startup integration test that sends a test webhook event with a valid signature and confirms it passes verification.

**Phase:** Phase 3 (Stripe Billing) — must be solved at the first webhook handler implementation.

---

### Pitfall 12: Hocuspocus Collaboration Connection Leaks for Suspended Users

**What goes wrong:** The `SuspendedUserGuard` blocks HTTP requests from suspended users but does not close their active WebSocket connection to the Hocuspocus collab server. A suspended user who was actively editing when suspended can continue to read document updates over the open WebSocket for the duration of the connection.

**Prevention:** On suspension, emit an event that triggers a Hocuspocus connection close for the target user. Hocuspocus supports server-side connection management via the `onDisconnect` / `onClose` hooks. This is lower priority for this project since external clients are read-only, but warrants attention if clients are ever given edit access.

**Phase:** Phase 2 or later — lower priority for read-only external clients, but noted for completeness.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Client role assignment | Content protection guard gates on `isMember` — wrong role = no protection | Define client role convention before any code; invert the guard |
| Dev tools heuristic | `outerWidth` difference check causes false positives | Remove width threshold; keep only event listener approach |
| Stripe webhook handler | Raw body parsing breaks signature verification | Use raw buffer middleware or dedicated Fastify route |
| Stripe provisioning | Replayed webhooks create duplicate accounts | Implement event ID deduplication table before any provisioning logic |
| Space isolation | `PageRepo.findById()` lacks workspaceId filter | Add workspaceId to all page lookups; write cross-workspace bypass test |
| Screenshot detection | Suspension counter resets on deploy | No production enforcement until DB persistence is implemented |
| Railway deployment | Local file storage destroyed on redeploy | Require S3 before first content-carrying deploy |
| SPA routing | Recent instability in static/Fastify integration | Test `GET /` and all SPA routes after any server-side routing change |
| Fork maintenance | Upstream merges get exponentially harder | Isolate custom code in new files/modules; establish monthly sync |

---

## Sources

All findings verified directly against production codebase files:

- `apps/client/src/components/ContentProtection.tsx` — content protection implementation and role gating
- `apps/client/src/components/ContentProtectionAlways.tsx` — shared-page protection variant
- `apps/client/src/hooks/use-user-role.tsx` — role mapping for protection guard
- `apps/server/src/integrations/security/content-protection.service.ts` — stub enforcement (all TODOs)
- `apps/server/src/integrations/security/screenshot-detection.service.ts` — in-memory state, DB persistence commented out
- `apps/server/src/common/guards/suspended-user.guard.ts` — HTTP-only guard, WebSocket not covered
- `apps/server/src/core/casl/abilities/space-ability.factory.ts` — CASL space role building
- `apps/server/src/core/casl/abilities/workspace-ability.factory.ts` — workspace role building
- `apps/server/src/database/repos/page/page.repo.ts` — `findById` lacks workspaceId filter
- `apps/server/src/database/repos/space/space-member.repo.ts` — commented-out workspaceId filter (line 238)
- `apps/server/src/core/page/page.controller.ts` — CASL check order relative to page fetch
- `apps/server/src/database/migrations/20250106T195516-billing.ts` — billing schema
- `apps/server/src/integrations/security/security.module.ts` — module composition
- `.planning/codebase/CONCERNS.md` — known tech debt and fragile areas
- `.planning/PROJECT.md` — project constraints and decisions
- `Dockerfile` — build and runtime configuration
- `railway.json` — Railway deployment configuration
- `RAILWAY_DEPLOY.md` — deployment guide and known troubleshooting

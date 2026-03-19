# Architecture Patterns

**Domain:** Paid SOP knowledge base — content protection, Stripe billing, external client isolation, Railway multi-process deployment
**Project:** Agency SOP Platform (Docmost fork)
**Researched:** 2026-03-19
**Confidence:** HIGH (sourced directly from codebase analysis)

---

## Recommended Architecture

The four additions (content protection, Stripe billing, client isolation, Railway deployment) slot into an existing well-structured system. None require inventing new patterns — each maps to an existing extension point in the codebase.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Railway: Service A — NestJS (port 8080)                                │
│                                                                         │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────────────────┐  │
│  │  NestJS App │   │  BillingModule│   │  SecurityModule (existing)  │  │
│  │  (core/)    │   │  (integrations│   │  ContentProtection endpoint  │  │
│  │             │◄──│  /stripe/ or  │   │  /api/security/protection-  │  │
│  │  SpaceAbility   │  ee/billing/) │   │  attempt (JWT-gated)        │  │
│  │  Factory    │   │  Webhook      │   └─────────────────────────────┘  │
│  │  (CASL)     │   │  /api/billing │                                     │
│  └──────┬──────┘   │  /webhook     │                                     │
│         │          └──────┬────────┘                                     │
│         │                 │ upserts User + SpaceMember                   │
│         ▼                 ▼                                              │
│  ┌─────────────────────────────────┐                                     │
│  │  PostgreSQL (Railway add-on)    │                                     │
│  │  Tables: users, spaces,         │                                     │
│  │  space_members, billing,        │                                     │
│  │  workspaces (stripe_customer_id)│                                     │
│  └─────────────────────────────────┘                                     │
│         │                                                                │
│  ┌──────▼──────────────────────────┐                                     │
│  │  Redis (Railway add-on)         │                                     │
│  │  • WebSocket pub/sub            │                                     │
│  │  • BullMQ job queue             │                                     │
│  └─────────────────────────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  Railway: Service B — Hocuspocus collab server (port 3001)               │
│                                                                          │
│  Started via: pnpm collab (collab-main.ts)                               │
│  Connects to same PostgreSQL + Redis as Service A                        │
│  Exposes WebSocket at COLLAB_SERVER_URL for frontend HocuspocusProvider  │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  React SPA (served as static build from Service A)                       │
│                                                                          │
│  ProtectionContext (client-only role check)                              │
│    └── ContentProtection wrapper (page.tsx wraps FullEditor)             │
│          • CSS: user-select: none, print: display: none                  │
│          • JS: keydown, copy, contextmenu, beforeprint event listeners   │
│          • dev-tools blur overlay                                         │
│    └── Watermark overlay (email/name from currentUserAtom)               │
│                                                                          │
│  CASL (spaceAbility from space.membership.permissions)                   │
│    └── editable={spaceAbility.can(Manage, Page)} on FullEditor           │
│    └── readOnly prop on PageHeader                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `ContentProtection` (React) | Wraps page content; attaches JS event interceptors and CSS `user-select: none`; blurs on devtools detection | `useUserRole` hook (Jotai `currentUserAtom`); backend `/api/security/protection-attempt` for audit logging |
| `ContentProtectionAlways` (React) | Same as above but bypasses the `isMember` check; used on public share pages | Same backend endpoint (may fail silently for unauthenticated) |
| `useUserRole` hook | Reads `currentUserAtom` Jotai atom → derives `isAdmin`, `isOwner`, `isMember` | `currentUserAtom` (Jotai global state) |
| `useSpaceAbility` hook | Converts serialised CASL rules from `space.membership.permissions` into a callable ability object | Called in `page.tsx` with `spaceRules` from `useGetSpaceBySlugQuery` |
| `SpaceAbilityFactory` (NestJS) | Converts user's SpaceRole (ADMIN / WRITER / READER) into a CASL MongoAbility; sole source of truth for server-side permission checks | `SpaceMemberRepo.getUserSpaceRoles()` |
| `BillingModule` (NestJS, to be built) | Handles Stripe Checkout session creation, customer portal links, webhook ingestion; provisions user accounts on `customer.subscription.created` | `AuthService` / `SignupService` for account creation; `SpaceMemberService` for adding new user to client space as READER; Stripe SDK |
| `SecurityModule` (NestJS, existing) | Exposes `/api/security/protection-attempt` and `/api/security/screenshot-attempt`; logs attempt with `userId`, `workspaceId`, `ip` | `ContentProtectionService` (logs to console today; TODO: database table) |
| `CollabServer` (standalone NestJS) | Hocuspocus WebSocket server for real-time Yjs sync; separate process/Railway service | Same PostgreSQL + Redis as main server; authenticated via JWT in WebSocket upgrade query param |
| `SpaceMemberRepo` | Inserts/queries `space_members` rows tying a user to a space with a role | PostgreSQL via Kysely; used by `SpaceAbilityFactory` and `SpaceMemberService` |
| `WorkspaceRepo` | Stores `stripe_customer_id`, `status`, `plan`, `trial_end_at` on the workspace row | PostgreSQL; used by billing webhook handler to look up workspace by Stripe customer ID |

---

## Data Flow

### 1. Content Protection — Page View

```
Browser navigates to /s/:spaceSlug/p/:pageSlug
  → React Router loads page.tsx
  → usePageQuery() → POST /api/pages/info
  → useGetSpaceBySlugQuery() returns space with space.membership.permissions
  → useSpaceAbility(spaceRules) builds CASL ability
  → editable={spaceAbility.can(Manage, Page)} passed to FullEditor
     (false for READER role → editor renders in read-only mode)
  → <ContentProtection> wraps FullEditor + ScreenshotDetection
     → checks useUserRole().isMember
     → if isMember=false (i.e. ADMIN or OWNER): renders children with NO protection
     → if isMember=true: attaches event listeners + CSS classes
```

**BUG / GAP IDENTIFIED:** The `ContentProtection` component activates for `isMember` (workspace `member` role) and deactivates for `admin`/`owner`. But the feature requirement is to protect content for *external clients* — who are workspace `member` role users assigned to the client space as READER. Internal staff who are also workspace `member` role will also get protections applied. This logic needs to be corrected to check *space role = READER* rather than *workspace role = member*.

### 2. External Client Isolation — Server-Side Enforcement

```
Client requests any page/space:
  → JwtAuthGuard validates JWT → injects authUser
  → Workspace middleware injects workspaceId into req.raw
  → Controller calls SpaceAbilityFactory.createForUser(user, spaceId)
  → Factory queries SpaceMemberRepo.getUserSpaceRoles(userId, spaceId)
  → If user has no membership in requested space → NotFoundException thrown
  → If user has READER role → buildSpaceReaderAbility() applied
     → can(Read, Page) only; cannot(Manage, Page)
  → Any write operation (create/edit/delete page) guarded by
     ability.cannot(Manage, Page) check in PageService → throws ForbiddenException
```

**Space visibility constraint:** Spaces must be `SpaceVisibility.PRIVATE` for the external client space. This ensures internal OPEN spaces are invisible to users who are not members. A user with no membership in a space cannot even see its existence via the API.

### 3. Stripe Billing — Webhook-Driven Account Provisioning

```
External client visits checkout page (to be built)
  → POST /api/billing/checkout {priceId}
  → BillingService creates Stripe Checkout Session
     → metadata: {workspaceId, clientEmail}
  → Client redirected to Stripe-hosted checkout
  → Stripe charges card → fires webhook

Stripe webhook → POST /api/billing/webhook (raw body, signature verified)
  → On event 'checkout.session.completed':
      1. Extract clientEmail + workspaceId from metadata
      2. SignupService.signup({email, ...}) → creates User record
      3. SpaceMemberService.addUserToSpace(userId, clientSpaceId, SpaceRole.READER, workspaceId)
      4. BillingRepo.upsert({stripeSubscriptionId, stripeCustomerId, workspaceId, status})
      5. WorkspaceRepo.update({stripeCustomerId}) on workspaces row
      6. MailService.send(invite/welcome email with login link)

  → On event 'customer.subscription.deleted':
      1. Lookup workspaceId via stripeCustomerId on billing table
      2. SpaceMemberRepo.removeUserFromSpace(userId, clientSpaceId)
         OR set user.suspendedAt → blocks future logins
      3. BillingRepo.update({status: 'canceled'})
```

**Webhook route must be excluded from NestJS body parsing middleware.** Stripe signature verification requires the raw request body. Use `rawBody: true` in FastifyAdapter or register the webhook route before body parser middleware.

### 4. Railway Multi-Process Deployment

```
GitHub push to main
  → Railway builds monorepo Docker image (pnpm install + nx build)

Service A: NestJS main server
  Start command: pnpm start   (→ pnpm --filter ./apps/server run start:prod)
  Port: 8080 (PORT env var)
  Env: DATABASE_URL, REDIS_URL, APP_SECRET, STRIPE_SECRET_KEY,
       STRIPE_WEBHOOK_SECRET, COLLAB_SERVER_URL

Service B: Hocuspocus collab server
  Start command: pnpm collab  (→ pnpm --filter ./apps/server run collab:prod)
  Port: 3001 (COLLAB_PORT env var)
  Env: DATABASE_URL, REDIS_URL
  Railway internal networking: Service A does NOT proxy to Service B;
  the frontend HocuspocusProvider connects directly to Service B's
  Railway-provided public URL via WebSocket

Shared add-ons (Railway project-level):
  - PostgreSQL: DATABASE_URL injected into both services
  - Redis: REDIS_URL injected into both services
```

Both services build from the same Docker image or the same Railway source. They diverge only at start command. The collab server (`collab-main.ts`) uses its own `CollabAppModule` which imports only the modules it needs (DB, Redis, auth, collaboration extensions) — it does not load the full `AppModule`.

---

## Patterns to Follow

### Pattern 1: Space READER as the Client Access Tier

**What:** External clients are workspace `member` users added to the client space with `SpaceRole.READER`. No new role or permission concept is needed.

**When:** Always for external clients.

**Why this works:** `SpaceAbilityFactory.buildSpaceReaderAbility()` already exists and grants only `Read` on all CASL subjects. The server enforces this at every page/space operation through CASL ability checks in service methods. The client uses `spaceAbility.can(Manage, Page)` to decide whether to show edit UI.

**What you must add:** A flag or convention to distinguish a "client space" from internal spaces (e.g., a `isClientSpace: boolean` column on spaces, or simply by enforcing that all users in the client space are READER). The business rule "client users may only be added as READER" must be enforced in the provisioning code (Stripe webhook handler), not in CASL itself.

### Pattern 2: Wrapper Component for Content Protection (Not HOC, Not Context Provider)

**What:** `<ContentProtection>` is a wrapper component placed at the page level (`page.tsx`) wrapping `FullEditor`. This is the correct pattern for the codebase.

**Why not HOC:** HOCs add indirection and complicate prop threading. The existing code uses wrapper components (see `ContentProtection`, `ContentProtectionAlways`, `ScreenshotDetection`).

**Why not Context Provider:** Content protection is scoped to the page view, not the entire app. A provider at the app root would activate on every route unnecessarily.

**The fix needed — role check correction:**
```typescript
// CURRENT (incorrect for this use case):
const { isMember } = useUserRole();
if (!isMember) return <>{children}</>;  // skips protection for admin/owner

// SHOULD BE (protects all users with space READER role):
const spaceAbility = useSpaceAbility(spaceRules);
const isReadOnly = spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page);
if (!isReadOnly) return <>{children}</>;  // only protect read-only viewers
```

The `spaceRules` are already available in `page.tsx` via `useSpaceAbility`. The `ContentProtection` component needs to accept and use this signal instead of checking the workspace-level role.

### Pattern 3: Watermark via CSS `content` Attribute

**What:** The existing CSS already has a hook for a user-identifier watermark:
```css
.content-protected::after {
  content: attr(data-user-id);
  ...
}
```

The `data-user-id` attribute must be set on the `.content-protection` div. The `currentUserAtom` Jotai atom already holds the authenticated user's email and name — pass it as a prop to `ContentProtection` or read the atom inside the component.

**Build order implication:** Watermark is a small addition to the existing component. Do it alongside the role-check fix.

### Pattern 4: NestJS Billing Module Placement

**What:** New billing webhook + provisioning code belongs in `apps/server/src/integrations/stripe/` (new directory), following the pattern of existing integrations (`storage/`, `mail/`, `queue/`). The module is registered in `AppModule` alongside other integration modules.

**Alternatively:** If the existing `ee/` billing code in the server is present (it wasn't found at `apps/server/src/ee/`), check whether it can be adapted. The frontend `ee/billing/` has a Stripe billing type system and service calls to `/billing/info`, `/billing/checkout`, `/billing/portal`, `/billing/plans` — these API routes need backend implementations.

**Why not in `core/`:** Stripe is an external integration, not a domain entity. The `integrations/` directory is the established location for third-party service wrappers.

### Pattern 5: Stripe Webhook Raw Body

**What:** Stripe signature verification requires the raw (unparsed) request body. NestJS with Fastify requires explicit configuration to preserve the raw body on specific routes.

**Pattern:**
```typescript
// In main.ts FastifyAdapter setup, add rawBody support:
app.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (req, body, done) => {
    req.rawBody = body;
    done(null, JSON.parse(body.toString()));
  }
);

// In webhook controller:
@Post('webhook')
@HttpCode(200)
async handleWebhook(@Req() req: FastifyRequest) {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(
    req.rawBody,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET,
  );
  // ... handle event
}
```

The webhook route must NOT be protected by `JwtAuthGuard`. Stripe calls it without a JWT.

### Pattern 6: Railway Two-Service Config

**What:** Railway supports multiple services within a single project from the same GitHub repo. Each service specifies a different start command. Both share the same PostgreSQL and Redis add-ons via Railway's internal networking / environment variable injection.

**Nixpacks / Dockerfile approach:** Both services use the same `Dockerfile` (or Nixpacks config). They diverge only at `CMD` / start command. In Railway dashboard: Service A sets start command to `pnpm start`, Service B sets it to `pnpm collab`.

**COLLAB_SERVER_URL:** The frontend `HocuspocusProvider` must know Service B's public URL. Set `VITE_COLLAB_SERVER_URL` (or equivalent env var name in `apps/client/src/lib/config.ts`) to Service B's Railway-generated URL. This is injected at build time by Vite.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Checking Workspace Role for Content Protection

**What:** Using `useUserRole().isMember` to determine whether to activate content protection.

**Why bad:** The workspace `member` role includes both internal staff (who might be workspace members but space ADMINs/WRITERs) and external client users (who are space READERs). An internal staff member who is a workspace `member` gets protection wrongly applied. An `admin` or `owner` who is also a client-facing user would bypass protection.

**Instead:** Check the space-level CASL ability: `spaceAbility.cannot(Manage, Page)`. This is already derived from the space membership role, which is the correct boundary.

### Anti-Pattern 2: Creating a New `client` UserRole

**What:** Adding a `client` value to the `UserRole` enum (OWNER / ADMIN / MEMBER).

**Why bad:** The `UserRole` enum governs workspace-level permissions (admin settings, billing management, member management). Adding `client` here would require updating guards and checks throughout the codebase. The space-level role system (READER / WRITER / ADMIN) already models the "read-only access" concept correctly.

**Instead:** External clients are workspace `member` users restricted to the client space with `SpaceRole.READER`. Enforce this exclusively through the provisioning flow (Stripe webhook handler adds them as READER). The space `SpaceVisibility.PRIVATE` prevents them from discovering or joining internal spaces.

### Anti-Pattern 3: Proxy-ing Collab Traffic Through Service A

**What:** Routing WebSocket connections for Hocuspocus through the main NestJS server to the collab server.

**Why bad:** The collab server is already a standalone Fastify+Hocuspocus server with its own authentication. Proxying adds latency, complexity, and a potential single point of failure with no benefit.

**Instead:** Configure the frontend to connect directly to Service B's Railway URL. Both services share the same JWT secret (`APP_SECRET`) so authentication works independently.

### Anti-Pattern 4: Storing Stripe Webhook Payload Only in Memory / Logger

**What:** The current `ContentProtectionService` only logs to the NestJS Logger (console). Planned billing webhook handling that only logs and does not persist.

**Why bad:** Railway containers restart; logs are ephemeral. A webhook retry after restart with no idempotency check will double-provision users.

**Instead:** Upsert billing records to the `billing` table using `stripeSubscriptionId` as the unique key (unique constraint already exists in the migration). Use `ON CONFLICT DO UPDATE` (Kysely's `onConflict`) for idempotency.

### Anti-Pattern 5: Activating ContentProtection on Every Route

**What:** Moving `ContentProtection` to a high-level layout component so it wraps all routes.

**Why bad:** `ContentProtection` installs document-level event listeners (`document.addEventListener('keydown', ...)` with `{ capture: true }`). This blocks keyboard shortcuts globally, including in settings pages and admin UIs. Internal admin users would lose copy-paste everywhere.

**Instead:** Keep `ContentProtection` scoped to the `Page` component (`page.tsx`) and activate it conditionally based on space READER status. The component renders as a passthrough (`return <>{children}</>`) when protection is not needed.

---

## Scalability Considerations

| Concern | At current scale (< 100 users) | At growth (1K users) | Notes |
|---------|-------------------------------|----------------------|-------|
| Stripe webhook reliability | Single Railway service | Add webhook retry handling + idempotency key in DB | Stripe retries webhooks for 72h on failure |
| Collab server memory | Single process fine | Scale Railway service horizontally; Redis adapter already in place | `@hocuspocus/extension-redis` already wired |
| Space membership enforcement | Per-request DB query in SpaceAbilityFactory | Add Redis cache layer for `getUserSpaceRoles` | Existing Redis infrastructure supports this |
| Content protection bypass | Client-side only friction | Acceptable; acknowledged limitation per PROJECT.md | True DRM not achievable on web |

---

## Build Order (Phase Dependencies)

The four features have this dependency graph:

```
1. External client isolation (space setup)
   └── Must exist before any client can be onboarded
   └── Work: Create client space (PRIVATE), verify CASL READER enforcement works E2E

2. Stripe billing integration
   └── Depends on: client space + user provisioning path
   └── Work: BillingModule (integrations/stripe/), webhook handler,
            signup + addUserToSpace in webhook, migration for billing table
            (migration already exists from upstream Docmost)

3. Content protection (React layer)
   └── Depends on: space isolation (to know which users are READER)
   └── Work: Fix role-check bug (workspace member → space READER CASL check),
            add dynamic watermark (data-user-id from currentUserAtom),
            verify CSS print protection, test dev-tools blur

4. Railway deployment
   └── Depends on: all features working locally
   └── Work: Create two Railway services from monorepo,
            set COLLAB_SERVER_URL env var for frontend build,
            configure STRIPE_WEBHOOK_SECRET, verify health checks pass
```

---

## Sources

- Direct codebase analysis: `apps/server/src/core/casl/abilities/space-ability.factory.ts` — CASL role structure
- Direct codebase analysis: `apps/client/src/components/ContentProtection.tsx` — existing protection component
- Direct codebase analysis: `apps/client/src/pages/page/page.tsx` — where ContentProtection is placed
- Direct codebase analysis: `apps/client/src/hooks/use-user-role.tsx` — workspace role hook (bug source)
- Direct codebase analysis: `apps/server/src/database/migrations/20250106T195516-billing.ts` — existing billing schema
- Direct codebase analysis: `apps/server/src/app.module.ts` — module registration pattern for integrations
- Direct codebase analysis: `apps/server/src/collaboration/server/collab-main.ts` — standalone collab server entry point
- Direct codebase analysis: `apps/server/src/common/helpers/types/permission.ts` — UserRole + SpaceRole enums
- Direct codebase analysis: `package.json` scripts — `pnpm start` and `pnpm collab` as the two Railway start commands
- Confidence: HIGH — all findings are from live codebase, not external sources

---

*Architecture analysis: 2026-03-19*

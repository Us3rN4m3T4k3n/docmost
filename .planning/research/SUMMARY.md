# Project Research Summary

**Project:** Agency SOP Platform (Docmost Fork)
**Domain:** Paid read-only knowledge base with content protection and self-serve subscription billing
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

This project extends an existing Docmost fork into a commercial, client-facing SOP access platform. The product has four discrete additions to bolt onto the existing NestJS + React + PostgreSQL + Redis system: client space isolation (read-only access enforcement), client-side content protection, Stripe subscription billing with automated account provisioning, and Railway production deployment. None of these require inventing new architectural patterns — each maps directly to an extension point already present in the codebase. The recommended approach is to build in strict dependency order: isolation first (it is the security foundation), then content protection (depends on knowing who is a client), then billing (depends on provisioning into an isolated space), then deployment hardening.

The highest-leverage technical decisions are already resolved by the existing codebase: CASL for permission enforcement, SpaceRole.READER as the client access tier, Stripe-hosted Checkout for PCI-compliant self-serve billing, and two Railway services (NestJS + Hocuspocus) sharing the same PostgreSQL and Redis add-ons. No new npm packages are needed on the client side; the server needs only `stripe` and `@fastify/raw-body`. The watermark and all content protection use native browser APIs — no third-party library is credible in this space.

The critical risk is a cluster of bugs and stubs already present in the codebase: the content protection component gates on the wrong role (workspace member instead of space READER), the screenshot detection counter resets on every deploy, the page repository lacks workspace-scoping on its lookups (a potential cross-workspace data leak), and webhook handling does not yet exist with idempotency controls. These are not design decisions to be made — they are known defects that must be fixed in the correct phase order before any client is onboarded. Stakeholders must also understand that client-side content protection is friction, not DRM; the watermark is the enforcement mechanism, not the event listeners.

---

## Key Findings

### Recommended Stack

No new frameworks are introduced. The additions are surgical: one NestJS module (`integrations/stripe/`) for billing, one React hook (`useContentProtection`) for event blocking, and infrastructure configuration for Railway. The Stripe integration uses the official `stripe` npm SDK directly in an `@Injectable()` service — the community `nestjs-stripe` wrapper lags the SDK and adds no value. Railway deployment uses a Dockerfile (not Nixpacks auto-detect) because the two-step monorepo build (server + client) is not reliably detected by Nixpacks for this setup.

**Core technologies:**
- `stripe` ^17.x — official Stripe Node.js SDK; used directly in NestJS injectable service with pinned API version string
- `@fastify/raw-body` ^3.x — required to preserve raw request body for Stripe webhook signature verification; Fastify parses JSON by default and destroys the raw bytes Stripe needs
- Native browser APIs (CSS `user-select`, `beforeprint` event, `contextmenu` event) — content protection; no library exists that is credible or maintained; these are the correct primitives
- CSS `::after` pseudo-element — watermark overlay; more resilient than Canvas (blocked by ad blockers) and SVG backgrounds (inspectable)
- Railway Dockerfile builder — deterministic two-step build for pnpm monorepo; Nixpacks auto-detect is unreliable for this structure

**Critical version/configuration requirements:**
- Pin Stripe API version in code: `apiVersion: '2024-06-20'` (verify current version before installing)
- NestJS must listen on `process.env.PORT ?? 3000` with host `0.0.0.0` — Railway injects PORT dynamically and requires binding to all interfaces
- S3 storage driver required before any content is added to production — Railway containers are ephemeral; local file storage is destroyed on every redeploy

### Expected Features

**Must have (table stakes — launch blockers):**
- Read-only external client layout — strip editor chrome via CASL `spaceAbility.cannot(Manage, Page)`; this is the product
- Strict space isolation — external users cannot reach internal space content by URL manipulation or search cross-contamination
- Content protection (verified working) — right-click block, text selection disable, print block, dynamic watermark with client email; must be tested, not assumed
- Stripe Checkout to account provisioning to space membership — the revenue and access mechanism end-to-end
- Stripe Customer Portal link — self-serve subscription management; avoids support burden
- Access revocation webhook — `customer.subscription.deleted` must revoke membership; without this, non-paying users retain indefinite access
- Subscription confirmation email — transactional email on payment with login link
- Admin subscriber list with manual revoke and grant — minimum viable operational control

**Should have (differentiators — post-launch hardening):**
- Dynamic per-session watermark with name, email, and timestamp — makes every screenshot traceable
- Screenshot detection with DB persistence and threshold escalation — skeleton exists but is in-memory only; cannot be a production security control until persisted
- Content protection violation audit log — stub exists; needs DB table and admin dashboard query
- Graceful "access expired" branded page — better than raw 403 redirect

**Defer to v2+:**
- Activity analytics dashboard — PostHog is wired client-side; add page view events and reporting after launch
- Trial period wiring — `BILLING_TRIAL_DAYS` env var exists; connect to Stripe but not required for launch
- Invitation-only or coupon-gated signup — Stripe coupon support exists; not a launch requirement
- SSO / SAML — not applicable for individual paying subscribers

**Anti-features (do not build):**
- Comment or annotation system for external clients — blurs the read-only product boundary
- Export or download functionality for external clients — directly undermines content protection
- Multi-tenant or white-label version — explicitly out of scope
- DevTools width-threshold detection — produces false positives on legitimate browser configurations; remove it

### Architecture Approach

The four additions slot into the existing system at clearly defined extension points. External clients are workspace `member` users assigned to a private client space with `SpaceRole.READER` — no new role enum value is needed. The `SpaceAbilityFactory` already produces a read-only CASL ability for READER, which all existing service-layer permission checks enforce. The billing module (`integrations/stripe/`) follows the pattern of existing integrations (`storage/`, `mail/`, `queue/`) and registers in `AppModule`. The React content protection component already exists at `page.tsx` but has a role-check bug that must be fixed. Two Railway services (NestJS on port 8080, Hocuspocus on port 3001) share the same PostgreSQL and Redis add-ons via Railway's internal networking.

**Major components:**
1. `BillingModule` (NestJS, new) — Stripe Checkout session creation, Customer Portal link, webhook ingestion, account provisioning via `SignupService` + `SpaceMemberService`; idempotency via `stripe_webhook_events` dedup table
2. `ContentProtection` (React, existing — fix required) — wraps page content with CSS `user-select: none`, JS event interceptors, and CSS `::after` watermark; activation guard must be changed from workspace `isMember` to space-level `spaceAbility.cannot(Manage, Page)`
3. `SpaceAbilityFactory` (NestJS, existing) — sole source of truth for server-side access control; READER role grants `can(Read, Page)` only; provisioning code must enforce clients are added only as READER
4. Railway Service A (NestJS) + Service B (Hocuspocus) — same Docker image, diverging at start command; frontend `HocuspocusProvider` connects directly to Service B's public URL; clients should not initiate a collab WebSocket at all (gate by space role)

### Critical Pitfalls

1. **Content protection guard checks the wrong role** — `ContentProtection.tsx` activates on `useUserRole().isMember` (workspace-level) instead of `spaceAbility.cannot(Manage, Page)` (space-level). Internal staff who are workspace `member` role get protection applied; client users assigned a non-MEMBER workspace role get zero protection with no error. Fix this in Phase 1 before any client is onboarded.

2. **Space-level CASL does not enforce workspace boundary on page lookups** — `PageRepo.findById()` fetches pages by UUID without filtering by `workspaceId`. A user who knows a page UUID from another workspace and has a space membership row for that space (possible via data error) will receive the page. Add `workspaceId` filtering to all page and space membership queries; write a cross-workspace bypass integration test.

3. **Stripe webhook provisioning without idempotency creates duplicate accounts** — Stripe delivers webhooks at least once. Without deduplication keyed on the Stripe event ID, a replayed webhook double-provisions users or crashes with a unique constraint violation (leaving the user without access). Store processed event IDs in a `stripe_webhook_events` table with `INSERT ... ON CONFLICT DO NOTHING` as the first action in any webhook handler.

4. **Screenshot detection suspension counter resets on every deploy** — `ScreenshotDetectionService` stores all violation state in an in-memory `Map`. Every Railway deploy, crash, or restart wipes the three-strike counter. Do not enable suspension enforcement in production until DB persistence is implemented.

5. **Railway local file storage is ephemeral** — Default `STORAGE_DRIVER=local` means all uploaded attachments are destroyed on every redeploy. Configure S3 or Cloudflare R2 before any attachment content is added to the production instance; treat this as a hard deployment prerequisite.

---

## Implications for Roadmap

Based on combined research, the build order is determined by hard dependencies: space isolation must exist before any client is provisioned; content protection is meaningful only once the correct role boundary is known; billing provisions into the isolated space; deployment validates the complete system.

### Phase 1: Client Isolation and Read-Only Access

**Rationale:** This is the security and product foundation. Every other feature depends on knowing which users are external clients and enforcing read-only access. A client cannot be provisioned before the space exists and isolation is verified to work end-to-end. The workspace-boundary bug in `PageRepo` is a security defect that must be closed before any external user has an account.

**Delivers:** A private client space with verified READER enforcement; clean read-only layout with editor chrome stripped; correct content protection activation predicate (space role, not workspace role); cross-workspace data isolation test passing.

**Addresses (from FEATURES.md):** Read-only external client layout, strict space isolation, mobile-responsive reading layout, working page links, search scoped to accessible spaces.

**Avoids (from PITFALLS.md):** Pitfall 1 (wrong role in protection guard), Pitfall 5 (missing workspace filter on page lookups), Pitfall 9 (fork divergence — establish code isolation discipline from the start).

**Research flag:** Standard patterns — CASL and NestJS guard patterns are well-documented in the codebase. No additional research phase needed.

---

### Phase 2: Content Protection

**Rationale:** Once the correct role boundary is established (Phase 1), the content protection component can be wired to the right signal. This phase completes the protection layer and validates it across browsers and zoom levels before any real client is onboarded.

**Delivers:** Verified content protection — right-click suppression, text selection disable, print block, dynamic watermark with client email from `currentUserAtom`; devtools width-heuristic removed; protection tested on Chrome/Firefox/Safari/Edge at multiple zoom levels; `beforeprint` alert replaced with in-page notification.

**Addresses (from FEATURES.md):** All content protection table stakes; dynamic per-session watermark as a differentiator.

**Avoids (from PITFALLS.md):** Pitfall 2 (devtools false positives), Pitfall 6 (set stakeholder expectations: protection is friction not DRM), Pitfall 10 (beforeprint alert UX).

**Note on screenshot detection:** Do NOT enable suspension enforcement. The skeleton exists but is in-memory only (Pitfall 3). Mark it as disabled via feature flag until Phase 2 post-launch hardening adds DB persistence.

**Research flag:** Standard patterns — browser event APIs and CSS are stable. No additional research phase needed.

---

### Phase 3: Stripe Billing and Account Provisioning

**Rationale:** Billing is the revenue mechanism. It depends on the isolated space (Phase 1) to provision clients into and on a working, accessible app (conceptually Phase 4, but billing can be developed locally and tested with Stripe CLI webhooks before deployment). Build billing against the local dev environment; validate with Stripe CLI before Railway deployment.

**Delivers:** Stripe Checkout Session creation endpoint; `checkout.session.completed` webhook handler with idempotency deduplication, user provisioning, space membership assignment as READER, and welcome email; `customer.subscription.deleted` webhook revokes access; Stripe Customer Portal link; admin subscriber list with manual revoke/grant; raw body middleware for webhook signature verification.

**Addresses (from FEATURES.md):** All billing table stakes — Stripe Checkout, automatic account provisioning, Customer Portal, access revocation, idempotent webhook handling, subscription status in account UI.

**Avoids (from PITFALLS.md):** Pitfall 4 (double provisioning — implement `stripe_webhook_events` dedup table first), Pitfall 11 (raw body parsing breaks signature verification — configure raw body middleware at route registration time, not globally).

**Uses (from STACK.md):** `stripe` SDK direct injection into `@Injectable()` service; `@fastify/raw-body` plugin; Stripe-hosted Checkout (not Elements); pinned Stripe API version string.

**Implements (from ARCHITECTURE.md):** `BillingModule` in `apps/server/src/integrations/stripe/`; webhook handler enqueues provisioning job to BullMQ; provisioning job calls `SignupService` + `SpaceMemberService`.

**Research flag:** Standard patterns — Stripe Checkout webhook flow is heavily documented. The Fastify raw body configuration has one non-obvious integration point but is covered in STACK.md. No additional research phase needed.

---

### Phase 4: Railway Production Deployment

**Rationale:** Deployment comes last because SPA routing has active instability (five recent commits attempting to fix it), S3 must be configured before any content is added, and the Hocuspocus two-service setup needs Railway-specific environment variable wiring. Deploy only after Phases 1-3 pass end-to-end locally with Stripe CLI.

**Delivers:** Two Railway services (NestJS + Hocuspocus) running from the same Dockerfile with diverging start commands; PostgreSQL and Redis shared add-ons; S3 storage configured (required before content is added); `STRIPE_WEBHOOK_SECRET` from Railway webhook endpoint; `VITE_COLLAB_SERVER_URL` set to Service B's Railway URL; health check passing; SPA routes (`GET /` and all React routes) returning HTML; DB migrations run on deploy.

**Addresses (from FEATURES.md):** Secure production access, subscription confirmation email working end-to-end, Stripe webhook endpoint reachable.

**Avoids (from PITFALLS.md):** Pitfall 7 (ephemeral local storage — S3 required), Pitfall 8 (SPA routing instability — test all routes after deploy, do not touch static integration without immediate Railway test), Pitfall 6 (Hocuspocus port isolation — separate Railway service).

**Uses (from STACK.md):** Dockerfile over Nixpacks; `railway.toml` for build and start commands; `process.env.PORT` with `0.0.0.0` binding; `DATABASE_URL` internal Railway URL (not `DATABASE_PUBLIC_URL`).

**Research flag:** The Railway Nixpacks and Dockerfile builder behavior is MEDIUM confidence from training data. Verify current Railway monorepo documentation before configuring the build pipeline. This phase may benefit from a `/gsd:research-phase` pass if Railway's build system has changed since August 2025.

---

### Phase Ordering Rationale

- **Isolation before billing:** You cannot provision a client into a space that does not correctly isolate them. The workspace-boundary bug must be closed first or the first real client could access internal content.
- **Content protection before client onboarding:** The protection component has a silent failure mode (wrong role check). A paying client with zero protection and no error is worse than no protection feature at all.
- **Billing before deployment:** Webhook endpoints require the Railway-generated public URL to register in the Stripe Dashboard. The billing feature can be fully developed and unit-tested locally with Stripe CLI; only the final webhook URL registration requires the deployed Railway URL.
- **Deployment last:** The SPA routing instability means any server-side routing changes (adding billing controllers) must be validated before declaring deployment stable. Phase 3 adds a new controller; verify it does not reintroduce the catch-all route conflict.

### Research Flags

Needs research during planning:
- **Phase 4 (Railway Deployment):** Railway's Nixpacks and Dockerfile builder behavior is MEDIUM confidence. Verify current monorepo build documentation, Nixpacks pnpm detection, and Railway's current private networking behavior before configuring build pipeline.

Standard patterns (skip research-phase):
- **Phase 1 (Client Isolation):** CASL, NestJS guards, and space membership patterns are sourced directly from the live codebase. HIGH confidence.
- **Phase 2 (Content Protection):** Browser event APIs are stable MDN-documented primitives. HIGH confidence.
- **Phase 3 (Stripe Billing):** Stripe Checkout + webhook provisioning is a canonical B2B SaaS pattern. HIGH confidence on architecture; MEDIUM on exact SDK version numbers (verify on npm before installing).

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Architecture pattern (direct SDK injection, no wrapper) is HIGH. Specific version numbers (stripe ^17.x, @fastify/raw-body ^3.x, Stripe API version string) are MEDIUM — verify on npm before installing; training data cutoff August 2025 |
| Features | HIGH | Sourced from direct codebase analysis + well-established B2B SaaS and knowledge base domain patterns. Feature dependency graph is accurate |
| Architecture | HIGH | Sourced entirely from live codebase inspection. Component boundaries, data flows, and bugs identified are directly verifiable in the code |
| Pitfalls | HIGH | All critical pitfalls verified against specific files and line numbers in the codebase. Not inference — direct code reading |

**Overall confidence:** HIGH

### Gaps to Address

- **Stripe version numbers:** Verify `stripe` npm package current major version and the current Stripe API version date string before running `pnpm add stripe`. Do not use training-data version strings without checking npmjs.com.
- **Railway Nixpacks behavior:** Railway's build system evolves. The recommendation to use a Dockerfile is sound, but verify current Railway monorepo guide for any updated pnpm detection behavior before configuring the build pipeline.
- **Screenshot detection DB schema:** The `screenshotAttempts` count and `isSuspended`/`accountStatus` fields are referenced in comments as TODOs but are not present in the current migration. A migration must be written before Phase 2 post-launch hardening adds DB persistence.
- **`stripe_webhook_events` dedup table:** This table does not exist in the codebase. A migration must be written as the first step of Phase 3 before any webhook handler code is written.
- **Hocuspocus viewer gate:** Clients are read-only. The frontend `HocuspocusProvider` should not initiate a WebSocket connection for READER-role sessions. The precise hook or condition to gate this needs to be located in the client codebase during Phase 1.

---

## Sources

### Primary (HIGH confidence — direct codebase analysis)

- `apps/client/src/components/ContentProtection.tsx` — protection component and role-check bug
- `apps/server/src/core/casl/abilities/space-ability.factory.ts` — CASL role structure and READER ability
- `apps/server/src/database/repos/page/page.repo.ts` — missing workspaceId filter
- `apps/server/src/database/repos/space/space-member.repo.ts` — commented-out workspaceId filter
- `apps/server/src/integrations/security/screenshot-detection.service.ts` — in-memory state, DB TODOs
- `apps/server/src/database/migrations/20250106T195516-billing.ts` — existing billing schema
- `apps/server/src/app.module.ts` — module registration pattern
- `apps/server/src/collaboration/server/collab-main.ts` — standalone collab server entry point
- `.planning/codebase/CONCERNS.md` — known tech debt registry
- `.planning/PROJECT.md` — project constraints and out-of-scope decisions
- `Dockerfile`, `railway.json`, `RAILWAY_DEPLOY.md` — deployment configuration

### Secondary (MEDIUM confidence — training data, August 2025 cutoff)

- Stripe Node.js SDK architecture and webhook patterns — verify: https://github.com/stripe/stripe-node
- Stripe Checkout hosted flow — verify: https://stripe.com/docs/payments/checkout
- Stripe webhook event handling — verify: https://stripe.com/docs/webhooks
- `@fastify/raw-body` plugin — verify: https://github.com/fastify/fastify-raw-body
- Railway monorepo deployment — verify: https://docs.railway.com/guides/monorepo

### Tertiary (stable specifications — LOW drift risk)

- MDN `user-select` — https://developer.mozilla.org/en-US/docs/Web/CSS/user-select
- MDN `beforeprint` event — https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeprint_event

---

*Research completed: 2026-03-19*
*Ready for roadmap: yes*

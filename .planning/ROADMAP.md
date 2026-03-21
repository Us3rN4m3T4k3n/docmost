# Roadmap: Agency SOP Platform (Docmost Fork)

## Overview

This roadmap transforms a Docmost fork into a commercial SOP access platform for paying external clients. The build sequence is determined by hard dependencies: client isolation must be verified before any client is provisioned; content protection relies on the correct role boundary from isolation; billing provisions users into an isolated space; deployment validates the complete system end-to-end. Language localization sits between isolation and content protection because it depends on knowing who is a client and what space they belong to, but does not depend on the protection layer.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Client Isolation and Read-Only Access** - Enforce server-side READER isolation, strip editor chrome, close workspace-boundary data leak
- [x] **Phase 2: Language and Content Localization** - Language tagging, IP-based detection, client language preference, and filtered SOP visibility (completed 2026-03-19)
- [x] **Phase 3: Content Protection** - Verified right-click, copy, print blocks and dynamic watermark wired to correct space role (completed 2026-03-20)
- [ ] **Phase 4: Stripe Billing and Account Provisioning** - Self-serve checkout, automatic account creation, subscription lifecycle, and admin controls
- [ ] **Phase 5: Railway Production Deployment** - Two-service Railway deployment with S3 storage, health check, SPA routing, and Stripe webhook wired to production URL

## Phase Details

### Phase 1: Client Isolation and Read-Only Access
**Goal**: External clients are restricted to read-only access within a private client space, server-side enforced, with no path to internal content
**Depends on**: Nothing (first phase)
**Requirements**: ROLE-01, ROLE-02, ROLE-03, ISOL-01, ISOL-02, ISOL-03, ISOL-04, ISOL-05
**Success Criteria** (what must be TRUE):
  1. A client user navigating to an internal space URL (by guessing or copying) receives an authorization error — the page content is never served
  2. A client user sees no editor chrome (create page, edit, delete, comment buttons are absent from the UI)
  3. A client user's session does not initiate a real-time collaboration WebSocket connection
  4. An admin can create/edit/delete any content; a staff user can create/edit content but cannot access billing or admin settings
  5. Page fetch API calls include workspaceId filtering so a cross-workspace UUID lookup returns no data
**Plans:** 4 plans

Plans:
- [ ] 01-00-PLAN.md — Wave 0: Test scaffolds for space-ability factory and page controller
- [ ] 01-01-PLAN.md — Close cross-workspace data boundary gap (workspaceId filter in PageRepo.findById)
- [ ] 01-02-PLAN.md — Fix client-side READER isolation (ContentProtection, Hocuspocus, sidebar)
- [x] 01-03-PLAN.md — Staff/Client badge, role hierarchy visibility, and client space PRIVATE enforcement

### Phase 2: Language and Content Localization
**Goal**: Clients see only the SOPs tagged for their language, with language auto-detected on first visit and overridable from account settings
**Depends on**: Phase 1
**Requirements**: LANG-01, LANG-02, LANG-03, LANG-04, LANG-05
**Success Criteria** (what must be TRUE):
  1. A new client visiting for the first time has their language (EN or PT-BR) detected automatically via IP geolocation
  2. A client can change their language preference from account settings and the SOP list updates immediately to show only pages tagged for their selected language
  3. A PT-BR client cannot see EN-only SOPs; an EN client cannot see PT-BR-only SOPs
  4. Admin or Staff can tag any page or space as English, Brazilian Portuguese, or Both when publishing
**Plans:** 2/2 plans complete

Plans:
- [ ] 02-01-PLAN.md — Add language column to spaces, wire server DTOs/service, add Language dropdown to space forms
- [ ] 02-02-PLAN.md — Create LocaleDetectionService with IP geolocation and wire into auth login flow

### Phase 3: Content Protection
**Goal**: All content protection features are verified working across browsers for READER-role users, with the devtools false-positive removed
**Depends on**: Phase 1
**Requirements**: PROT-01, PROT-02, PROT-03, PROT-04, PROT-05, PROT-06
**Success Criteria** (what must be TRUE):
  1. A client user right-clicking on any page content receives no browser context menu
  2. A client user attempting to select text or copy (Ctrl+C / Cmd+C) finds text selection and copy disabled
  3. A client user pressing Ctrl+P / Cmd+P or triggering print finds the print dialog blocked
  4. A client user sees a dynamic watermark showing their email address on every content page
  5. An internal staff user sees none of the above restrictions — their editing experience is unaffected
**Plans**: TBD

### Phase 4: Stripe Billing and Account Provisioning
**Goal**: Prospective clients can self-serve purchase access; accounts are provisioned automatically; subscriptions are managed end-to-end including payment failures and cancellations
**Depends on**: Phase 1
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06, BILL-07, BILL-08, BILL-09, ADMIN-01, ADMIN-02, ADMIN-03
**Success Criteria** (what must be TRUE):
  1. A prospective client can visit the pricing/landing page, complete Stripe Checkout, and receive a welcome email with login credentials — without any manual admin action
  2. A client whose subscription is cancelled (by either party) loses access to the client space automatically
  3. A client whose payment fails has their account locked and cannot access content until payment is resolved, after which access is automatically restored
  4. An admin can view a list of all active subscribers, see their account status, link to their Stripe customer record, and manually grant or revoke space access
  5. Replayed Stripe webhook events do not double-provision users or create duplicate accounts
**Plans:** 5/5 plans complete

Plans:
- [ ] 04-01-PLAN.md — Database migrations (billingLockedAt, webhook dedup tables, Kiwify columns) + BillingModule scaffold + middleware extension
- [ ] 04-02-PLAN.md — UserProvisioningService (provision/revoke/lock/unlock) + welcome email template
- [ ] 04-03-PLAN.md — Stripe and Kiwify webhook handlers with idempotency
- [ ] 04-04-PLAN.md — Client UI: /welcome page, billing-locked error page, customer portal button
- [ ] 04-05-PLAN.md — Admin subscribers view (API + UI + sidebar entry)

### Phase 5: Railway Production Deployment
**Goal**: The application is live and fully functional on Railway with two services, S3 storage, Stripe webhook connected to the production URL, and all routes accessible
**Depends on**: Phases 1, 2, 3, 4
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06
**Success Criteria** (what must be TRUE):
  1. The Railway URL loads the application without 404, timeout, or server error on first visit and on browser refresh of any client-side route
  2. The NestJS server and Hocuspocus collaboration server run as two separate Railway services and the real-time collab connection works for internal staff
  3. File attachments (images, PDFs) persist across Railway redeploys — they are stored in S3, not the ephemeral container filesystem
  4. The `/api/health` endpoint returns HTTP 200, satisfying Railway's deployment health check
  5. Stripe webhooks reach the production endpoint and trigger account provisioning end-to-end in the live environment
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Client Isolation and Read-Only Access | 1/4 | In progress | - |
| 2. Language and Content Localization | 2/2 | Complete   | 2026-03-19 |
| 3. Content Protection | 5/5 | Complete   | 2026-03-20 |
| 4. Stripe Billing and Account Provisioning | 5/5 | Complete   | 2026-03-21 |
| 5. Railway Production Deployment | 0/? | Not started | - |

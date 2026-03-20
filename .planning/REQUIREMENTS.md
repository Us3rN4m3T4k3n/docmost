# Requirements: Agency SOP Platform

**Defined:** 2026-03-19
**Core Value:** Paying clients can access the agency's SOPs in a protected, read-only environment they cannot easily copy or extract from.

## v1 Requirements

### Internal Roles

- [ ] **ROLE-01**: Three internal permission levels exist: Admin (full platform control), Staff (create/edit content), and User (the external paying client — read-only access)
- [ ] **ROLE-02**: Admin can manage all content, users, billing settings, and platform configuration
- [ ] **ROLE-03**: Staff can create, edit, and organize pages and spaces, but cannot access billing/admin settings

### Language & Content Localization

- [x] **LANG-01**: Content can be authored and stored in English (primary) and Brazilian Portuguese (secondary); other languages may be added later without auto-translation
- [x] **LANG-02**: External client's language is detected automatically via IP geolocation on first visit
- [x] **LANG-03**: Client can manually select their language preference from their account settings, overriding IP detection
- [ ] **LANG-04**: Clients see only SOPs tagged for their language — Brazilian Portuguese clients do not see EN-only SOPs and vice versa
- [x] **LANG-05**: Admin and Staff can tag each page/space as English, Brazilian Portuguese, or Both when publishing

### Client Isolation

- [ ] **ISOL-01**: External client users are restricted to READER role in the designated client space — enforced server-side via CASL, not just client UI
- [ ] **ISOL-02**: Client space is set to PRIVATE visibility so clients cannot browse or discover any other space
- [ ] **ISOL-03**: Page fetch API filters by workspaceId to close existing server-side data boundary gap
- [ ] **ISOL-04**: Editor chrome (create page, edit, delete, comment) is hidden for users with READER space role
- [ ] **ISOL-05**: Real-time collaboration WebSocket connection is not established for READER users (read-only document view only)

### Content Protection

- [x] **PROT-01**: Right-click context menu is disabled for users with READER space role
- [x] **PROT-02**: Text selection and copy-paste (Ctrl+C / Cmd+C) is disabled for READER users
- [x] **PROT-03**: Print and Ctrl+P / Cmd+P is blocked for READER users
- [x] **PROT-04**: Dynamic watermark showing the authenticated user's email is visible on all content pages for READER users
- [x] **PROT-05**: Content protection triggers on READER space role (not workspace member role — fixes existing inverted role gate bug)
- [x] **PROT-06**: Dev tools detection is removed (causes false positives that block legitimate clients)

### Stripe Billing

- [ ] **BILL-01**: A pricing/landing page exists where prospective clients can see the offer and start a Stripe Checkout session
- [ ] **BILL-02**: On successful Stripe Checkout (`checkout.session.completed`), a user account is automatically created and added to the client space as READER
- [ ] **BILL-03**: A welcome email is sent to the new client after account provisioning with their login details
- [ ] **BILL-04**: On subscription cancellation (`customer.subscription.deleted`), the user's access to the client space is automatically revoked
- [ ] **BILL-05**: Webhook events are deduplicated (idempotency table) to prevent double provisioning on Stripe retries
- [ ] **BILL-06**: Clients can access Stripe Customer Portal to manage or cancel their own subscription
- [ ] **BILL-07**: One account per purchase (one Stripe subscription = one user login)
- [ ] **BILL-08**: If a subscription payment fails, the client account is locked and access to content is revoked until payment is resolved
- [ ] **BILL-09**: When a locked client's payment succeeds (retry or update), access is automatically restored

### Admin

- [ ] **ADMIN-01**: Admin can view a list of active external client subscribers with their account status
- [ ] **ADMIN-02**: Admin can manually grant or revoke a client's space access (override for edge cases)
- [ ] **ADMIN-03**: Each subscriber entry links to their Stripe customer record in the Stripe Dashboard

### Deployment

- [ ] **DEPLOY-01**: Application is live and fully accessible on Railway URL (no 404, no timeout)
- [ ] **DEPLOY-02**: Main NestJS server and Hocuspocus collaboration server run as two separate Railway services
- [ ] **DEPLOY-03**: File storage is configured to use S3 (not local ephemeral filesystem)
- [ ] **DEPLOY-04**: SPA routing works correctly — all client-side routes resolve to the React app (no 404 on refresh)
- [ ] **DEPLOY-05**: A health check endpoint at `/api/health` returns 200 for Railway deployment verification
- [ ] **DEPLOY-06**: Stripe webhook URL is registered in Stripe Dashboard pointing to the production Railway URL

## v2 Requirements

### Content Protection

- **PROT-V2-01**: Screenshot detection attempts are persisted to database (currently in-memory only, resets on deploy)
- [x] **PROT-V2-02**: Admin can view a log of content protection violations per client account

### Billing

- **BILL-V2-01**: Per-seat pricing — multiple users per subscribing agency under one subscription
- **BILL-V2-02**: Trial period support (env var `BILLING_TRIAL_DAYS` already present in codebase)
- **BILL-V2-03**: Automated refund processing

### Platform

- **PLAT-V2-01**: Clients can be organized by agency (group multiple users under one client organization)
- **PLAT-V2-02**: Content access tiers (e.g., basic SOPs vs premium SOPs at different price points)

### Payments

- **PAY-V2-01**: Brazilian payment gateway (Kiwify or equivalent) as an alternative or complement to Stripe for the PT-BR market — includes sales funnel capabilities; to be scoped in a future milestone

## Out of Scope

| Feature | Reason |
|---------|--------|
| External clients creating or editing their own content | This is read-only access to agency IP; Docmost editing features exist for internal staff only |
| Multi-tenant SaaS (other agencies hosting their own instance) | Not the business model; single-tenant for this agency's SOPs |
| Mobile native app | Web-first; browser is sufficient for read-only SOP access |
| Real DRM / technical copy prevention | Impossible on the web; client-side friction is the intended approach |
| Automated refund processing | Manual via Stripe Dashboard is sufficient for v1 |
| SSO / SAML for external clients | Email/password is sufficient for v1 |
| Auto-translation of content | Content is manually authored per language; translation is a human editorial process |
| Brazilian payment gateway (Kiwify) | Deferred — to be discussed and scoped in a future milestone once Stripe is live |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROLE-01 | Phase 1 | Pending |
| ROLE-02 | Phase 1 | Pending |
| ROLE-03 | Phase 1 | Pending |
| ISOL-01 | Phase 1 | Pending |
| ISOL-02 | Phase 1 | Pending |
| ISOL-03 | Phase 1 | Pending |
| ISOL-04 | Phase 1 | Pending |
| ISOL-05 | Phase 1 | Pending |
| LANG-01 | Phase 2 | Complete |
| LANG-02 | Phase 2 | Complete |
| LANG-03 | Phase 2 | Complete |
| LANG-04 | Phase 2 | Pending |
| LANG-05 | Phase 2 | Complete |
| PROT-01 | Phase 3 | Complete |
| PROT-02 | Phase 3 | Complete |
| PROT-03 | Phase 3 | Complete |
| PROT-04 | Phase 3 | Complete |
| PROT-05 | Phase 3 | Complete |
| PROT-06 | Phase 3 | Complete |
| BILL-01 | Phase 4 | Pending |
| BILL-02 | Phase 4 | Pending |
| BILL-03 | Phase 4 | Pending |
| BILL-04 | Phase 4 | Pending |
| BILL-05 | Phase 4 | Pending |
| BILL-06 | Phase 4 | Pending |
| BILL-07 | Phase 4 | Pending |
| BILL-08 | Phase 4 | Pending |
| BILL-09 | Phase 4 | Pending |
| ADMIN-01 | Phase 4 | Pending |
| ADMIN-02 | Phase 4 | Pending |
| ADMIN-03 | Phase 4 | Pending |
| DEPLOY-01 | Phase 5 | Pending |
| DEPLOY-02 | Phase 5 | Pending |
| DEPLOY-03 | Phase 5 | Pending |
| DEPLOY-04 | Phase 5 | Pending |
| DEPLOY-05 | Phase 5 | Pending |
| DEPLOY-06 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 — Traceability updated after roadmap creation (5-phase structure; PROT moved to Phase 3, BILL/ADMIN to Phase 4, DEPLOY to Phase 5)*

# Feature Landscape

**Domain:** Paid read-only knowledge base / protected IP access platform
**Project:** Agency SOP Platform (Docmost fork)
**Researched:** 2026-03-19
**Confidence:** HIGH (based on codebase analysis + domain knowledge of Stripe, knowledge base platforms, content protection patterns)

---

## Table Stakes

Features paying readers expect. Missing = users leave or demand refunds.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Clean read-only document view | Paying for access to content, not an editor | Low | Strip all editor chrome (toolbar, inline comment buttons, edit affordances) from client when user role is `viewer` on external space |
| Hierarchical sidebar navigation | Standard knowledge base UX; users need to find documents without search | Low | Docmost tree nav already exists — gate editor actions via CASL `viewer` role |
| Full-text search within accessible content | Customers can't use a 50+ document SOP library without search | Medium | Already exists in Docmost (PostgreSQL FTS or Typesense); must scope search to spaces the viewer has access to — no cross-space leaks |
| Working links between pages | Internal cross-references in SOPs; broken links feel broken product | Low | Already supported; just needs isolation to prevent links resolving to internal spaces |
| Embedded images and videos load correctly | SOPs include screenshots, walkthroughs; content must render completely | Low | Already works via attachment system; confirm S3 pre-signed URLs are accessible to external users |
| Mobile-responsive reading layout | Clients read on phones and tablets | Low | Mantine responsive layout; verify read view is not broken on small screens |
| Secure login (email + password) | Paying customers need to authenticate | Low | JWT auth already exists; onboarding flow just needs to provision accounts |
| Subscription confirmation email | Proof of purchase; account access instructions | Low | Email system (Postmark/SMTP) already wired; need transactional email template |
| Access persists for subscription duration | Content remains accessible as long as subscription is active | Medium | Stripe webhook `customer.subscription.deleted` must revoke access promptly |
| Account/password management | Self-service password reset; customers can't call support for basic account issues | Low | Docmost already has password reset flow |

---

## Content Protection Table Stakes

Content protection features expected for a paid IP product. Clients who paid for exclusive know-how expect the product not to trivially enable bulk extraction.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Right-click / context menu disabled | Prevents "Save image as", "Inspect element" shortcuts for casual users | Low | CSS `user-select: none` + `oncontextmenu` handler; already partially built in client |
| Text selection disabled | Prevents Ctrl+A → Ctrl+C bulk copy | Low | CSS `user-select: none`; already partially built |
| Print / Ctrl+P blocked | Prevents print-to-PDF extraction of entire document | Low | `window.onbeforeprint` + CSS `@media print { display: none }` overlay; partially built |
| Dynamic watermark with client email | Visible deterrent; creates attribution trail if content leaks | Medium | Floating overlay with `position: fixed`, user email from session; partially built |
| Content protection applies universally | Must not be opt-in per page; every page in external space must be protected | Low | Apply at layout level, not page level |

---

## Billing / Subscription Table Stakes

Self-serve subscription flow that B2B SaaS customers expect.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Stripe Checkout for purchase | Industry standard for self-serve; customers expect card-on-file subscription, not invoice | Medium | Stripe Checkout Session → `checkout.session.completed` webhook → create user + assign space membership |
| Automatic account provisioning on payment | Customers expect immediate access after paying; manual provisioning = refund requests | Medium | Webhook handler: create `users` row, send welcome email with login link, assign to external space with `viewer` role |
| Stripe Customer Portal for self-management | Customers expect to update card, view invoices, cancel subscription without emailing support | Low | Stripe-hosted portal; just need a "Manage Subscription" link pointing to Stripe portal session URL |
| Access revocation on cancellation/expiry | Paying customer rights; non-paying users must not retain access | Medium | `customer.subscription.deleted` and `invoice.payment_failed` (after grace period) webhooks must set user `suspendedAt` or remove space membership |
| Subscription status visible in account UI | Customers want to know their renewal date and plan | Low | Pull from Stripe or store in DB; show in a minimal "Account" settings page |
| Idempotent webhook handling | Stripe delivers webhooks at least once; duplicate events must not create duplicate accounts | Medium | Store `stripeCustomerId` on user record; check before creating to prevent duplication |

---

## Admin Table Stakes

Admin capabilities needed to manage paying clients operationally.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| View all external subscriber accounts | Admins need to know who has access | Low | List users filtered by external space membership; show subscription status |
| Manually revoke access | Fraud, refunds, terms violations; admin must be able to cut access without Stripe | Low | Set `suspendedAt` on user or remove space membership via existing user management |
| Manually grant / reinstate access | False-positive fraud flags, comp'd accounts, partnerships | Low | Reverse of above |
| View violation logs (screenshot / copy attempts) | Security audit; if content leaks, admin needs to know who tried what | Medium | Requires completing the stub `ContentProtectionService` — currently logging-only |
| Stripe subscription lookup per customer | Admin needs to see what a specific customer is paying, their renewal date, payment history | Low | Link to Stripe dashboard or embed Stripe customer ID → direct link |

---

## Differentiators

Features that are not expected by default but create competitive advantage and justify premium pricing.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Dynamic per-session watermark (name + email + timestamp) | Content can be traced back to the specific session if leaked; stronger than static watermarks | Medium | Render client name + email + current date in semi-transparent overlay; rotate position to cover more of page |
| Screenshot attempt detection + escalation | Adds a software deterrent layer beyond pure CSS; repeated violations trigger account suspension | High | `ScreenshotDetectionService` skeleton exists but is in-memory only; needs DB persistence, session revocation, and admin email notifications to be functional |
| Content protection violation audit log | Professional-grade IP protection story; admin can demonstrate due diligence if content is stolen | Medium | `ContentProtectionService` stub exists; needs database table + threshold logic + admin dashboard query |
| Graceful "access expired" state | Clear UX when subscription lapses; links back to purchase page | Low | Instead of 403 error, show branded "Your subscription has ended. Renew here." page |
| Trial period access | Reduces friction to first purchase; standard in B2B SaaS | Low | `BILLING_TRIAL_DAYS` env var already exists in codebase; wire to Stripe trial |
| Invitation-only or coupon-gated access | Control who can sign up; useful for partnerships, beta cohorts | Medium | Stripe coupon codes or a pre-registration allowlist before Stripe Checkout |
| Activity analytics for admin | Know which SOPs clients actually read; identify most/least valuable content | High | PostHog already integrated client-side; just add page view events and admin reporting dashboard |

---

## Anti-Features

Features to deliberately NOT build. Building these wastes time or creates more problems than they solve.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Comment / annotation system for external clients | Clients are read-only consumers; adding comments blurs the product boundary and creates moderation work | Remove comment UI from external client layout entirely |
| Page duplication / export for external clients | Directly undermines content protection; a "Download as PDF" button defeats the whole product | Confirm export routes are not accessible to `viewer` role; disable keyboard shortcut |
| External client editing their profile beyond password | Email changes could be used to socially engineer access; complex to handle subscription re-association | Restrict account settings to password change + subscription management only |
| Admin-created inline DRM / encryption | True web DRM is impossible; spending engineering time on it creates false security confidence | Acknowledge client-side JS protection as friction, not absolute security; document this honestly |
| Multi-tenant / white-label version | Out of scope per PROJECT.md; adds enormous complexity to billing, data isolation, deployment | Ship single-tenant version; revisit only if there is a validated demand signal |
| Automated refund processing | Stripe does refunds via dashboard; building refund automation is unnecessary complexity for one operator | Admin manually initiates refunds in Stripe dashboard |
| SSO / SAML for external clients | Clients are individuals paying for personal subscriptions, not enterprise IT accounts | Email + password is sufficient; SSO is an enterprise upsell that does not apply here |
| Mobile native app | Web-first is the right call; mobile responsive browser view covers the use case | Ensure mobile breakpoints render read view correctly |
| Real-time collaboration for external clients | Clients are readers not collaborators; Hocuspocus WebSocket connection should not be opened for viewer-role sessions | Gate WebSocket connection by role; do not initiate collaboration session for external viewers |
| Per-page content protection toggles | Every page in the external space must be protected; toggle adds admin complexity and creates gaps | Apply protection at space layout level, unconditionally |

---

## Feature Dependencies

```
Stripe Checkout
  → Webhook handler (checkout.session.completed)
    → User account provisioning
      → External space membership assignment (viewer role)
        → Content protection layout (applied by role)
          → Dynamic watermark (user email from session)

Stripe webhook (subscription.deleted / payment_failed)
  → Access revocation (suspendedAt or membership removal)
    → Graceful "access expired" UI

Screenshot detection (functional)
  → DB persistence (not in-memory)
    → Threshold escalation
      → Session revocation on suspension
        → Admin email notification

Content protection violation log (functional)
  → DB persistence
    → Threshold checking
      → Admin dashboard view

Admin subscriber list
  → Stripe Customer ID stored on user
    → Stripe Dashboard link per customer
```

---

## MVP Recommendation

### Prioritize (launch blockers)

1. **Read-only external client layout** — strip editor chrome via CASL `viewer` role; this is the product
2. **Strict space isolation** — external users cannot load internal space content by any means (URL manipulation, search cross-contamination)
3. **Content protection (verified working)** — right-click, text selection, print block, dynamic watermark; must be actually tested, not assumed working
4. **Stripe Checkout → account provisioning → space membership** — the revenue mechanism
5. **Stripe Customer Portal link** — self-serve subscription management; avoids support burden
6. **Access revocation webhook** — `customer.subscription.deleted` must cut access; without this, non-paying users retain indefinite access
7. **Subscription confirmation email** — transactional email on successful payment with login link
8. **Admin subscriber list with manual revoke/grant** — minimum viable operational control

### Defer to Post-Launch

- **Screenshot detection persistence** — the skeleton exists but requires significant work (DB table, session revocation, admin notifications); the pure CSS/JS layer is sufficient for launch friction
- **Content protection violation log** — stub exists; implement DB persistence as a post-launch hardening milestone
- **Activity analytics** — PostHog is wired; add page view events after launch
- **Trial period** — `BILLING_TRIAL_DAYS` env var exists; wire to Stripe but not required for launch
- **Graceful access expired page** — nice-to-have; a clean 403 redirect to pricing page is acceptable at launch

---

## Sources

- Codebase analysis: `/Users/rafaelandresberti/docmost/.planning/codebase/CONCERNS.md` (security stubs, tech debt)
- Codebase analysis: `/Users/rafaelandresberti/docmost/.planning/codebase/INTEGRATIONS.md` (Stripe env vars, BullMQ, email)
- Codebase analysis: `/Users/rafaelandresberti/docmost/.planning/PROJECT.md` (requirements, out of scope)
- Source inspection: `apps/server/src/integrations/security/content-protection.service.ts` (stub with TODOs)
- Source inspection: `apps/server/src/integrations/security/screenshot-detection.service.ts` (in-memory implementation)
- Domain knowledge: Stripe Checkout → webhook → provisioning pattern (HIGH confidence, standard B2B SaaS pattern)
- Domain knowledge: Content protection on web (CSS/JS friction, not DRM) (HIGH confidence)
- Domain knowledge: Knowledge base platform UX expectations (HIGH confidence, well-established category)

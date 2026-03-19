# Agency SOP Platform (Docmost Fork)

## What This Is

A forked Docmost instance repurposed as a paid knowledge base for agency SOPs. Internal staff manage and access all company documents. External agencies pay (via Stripe) for read-only access to a curated set of SOPs — sold as access to the agency's proprietary operating methodology.

## Core Value

Paying clients can access the agency's SOPs in a protected, read-only environment they cannot easily copy or extract from.

## Requirements

### Validated

<!-- Capabilities already in the codebase from Docmost. -->

- ✓ Rich text document editing with TipTap (headings, lists, embeds, code blocks) — existing
- ✓ Real-time collaborative editing (Hocuspocus + Yjs) — existing
- ✓ Hierarchical page + space organization (tree navigation) — existing
- ✓ File attachment management (images, videos, PDFs via S3/local) — existing
- ✓ JWT authentication with role-based access (CASL abilities) — existing
- ✓ User and workspace management — existing
- ✓ Email notifications — existing
- ✓ Full-text search — existing

### Active

<!-- Goals for this work — building toward launch. -->

- [ ] External client space is fully isolated from internal spaces (clients cannot see internal docs, company policies, or employee-facing content)
- [ ] External clients get read-only access only — no editor UI, no ability to create/edit pages
- [ ] Content protection: right-click and context menu disabled for external clients
- [ ] Content protection: text selection and copy-paste disabled for external clients
- [ ] Content protection: print / Ctrl+P blocked for external clients
- [ ] Content protection: dynamic watermark showing client's email/name on all pages
- [ ] Content protection features are verified working (tested and confirmed)
- [ ] Stripe-powered self-serve access: external clients can purchase a subscription and get account created automatically
- [ ] Admin can manage external subscriptions (view, cancel, refund)
- [ ] Railway deployment is live and accessible

### Out of Scope

- External clients creating or editing their own content — this is read-only access to the agency's IP
- Multi-tenant SaaS (other agencies hosting their own instance of this platform)
- Mobile app — web-first
- Marketplace or reselling of other agencies' content

## Context

- This is a Docmost fork (MIT licensed). Original repo: collaborative wiki/docs tool.
- Content protection additions were implemented but never properly tested — reliability is unknown.
- Railway deployment was attempted but the app URL was inaccessible.
- The codebase is a monorepo (pnpm + Nx): `apps/server` (NestJS + Fastify) and `apps/client` (React + Vite).
- PostgreSQL + Redis required in production. S3 or local for file storage.
- The `ee/` directories contain enterprise feature modules (loaded conditionally).
- CASL is already wired for role/permission checks on both client and server — space-level roles (viewer, editor, admin) are the foundation for client isolation.

## Constraints

- **Tech Stack**: Must stay on Docmost's stack (NestJS, React, Tiptap, Hocuspocus) — the editor quality is the reason for this fork
- **Deployment**: Railway (with PostgreSQL and Redis add-ons)
- **Content Protection**: Client-side protection only (JS/CSS) — acknowledged limitation; goal is maximum reasonable friction, not absolute DRM
- **Data Isolation**: External client users must never be able to navigate to or load internal space content, even by URL manipulation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork Docmost instead of building from scratch | Editor quality (TipTap), file handling, real-time collab already solved | — Pending |
| Client-side content protection (CSS/JS) | True DRM is impossible on web; goal is friction, not perfection | — Pending |
| Separate spaces for internal vs external | Docmost's space model maps cleanly to this isolation requirement | — Pending |
| Stripe for self-serve billing | Standard, well-supported; webhook-driven account provisioning | — Pending |
| Deploy on Railway | Managed hosting with PostgreSQL + Redis add-ons available | — Pending |

---
*Last updated: 2026-03-19 after initialization*

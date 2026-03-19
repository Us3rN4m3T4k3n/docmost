# Codebase Structure

**Analysis Date:** 2026-03-19

## Directory Layout

```
docmost/
├── apps/                           # Workspace applications
│   ├── client/                     # React frontend SPA
│   │   ├── public/                 # Static assets, locales, icons
│   │   ├── src/
│   │   │   ├── App.tsx             # Root router and route definitions
│   │   │   ├── main.tsx            # React entry point, provider setup
│   │   │   ├── assets/             # Images, fonts, styles
│   │   │   ├── components/         # Shared UI components
│   │   │   ├── features/           # Feature-scoped domain logic
│   │   │   ├── ee/                 # Enterprise edition modules
│   │   │   ├── hooks/              # Custom React hooks (global)
│   │   │   ├── lib/                # Shared utilities, API client, config
│   │   │   └── pages/              # Page components for routes
│   │   ├── dist/                   # Build output
│   │   ├── vite.config.ts          # Vite build configuration
│   │   └── package.json            # Client dependencies
│   │
│   └── server/                     # NestJS backend
│       ├── src/
│       │   ├── main.ts             # Express/Fastify bootstrap entry point
│       │   ├── app.module.ts       # Root NestJS module with imports
│       │   ├── core/               # Domain modules (business logic)
│       │   │   ├── auth/           # Authentication and authorization
│       │   │   ├── page/           # Page management
│       │   │   ├── space/          # Workspace spaces
│       │   │   ├── user/           # User management
│       │   │   ├── workspace/      # Workspace settings
│       │   │   ├── comment/        # Comments and discussions
│       │   │   ├── share/          # Public page sharing
│       │   │   ├── group/          # User groups
│       │   │   ├── attachment/     # File uploads
│       │   │   ├── search/         # Full-text search
│       │   │   └── casl/           # Permission/ability definitions
│       │   ├── collaboration/      # Real-time editing via Hocuspocus
│       │   │   ├── server/         # Standalone collab server
│       │   │   ├── extensions/     # Yjs document extensions
│       │   │   └── adapter/        # WebSocket adapter
│       │   ├── ws/                 # WebSocket event emitter gateway
│       │   ├── common/             # Shared utilities (guards, decorators, filters)
│       │   │   ├── decorators/     # Custom decorators (AuthUser, AuthWorkspace)
│       │   ├── database/           # Data access layer
│       │   │   ├── repos/          # Repository classes (PageRepo, SpaceRepo, etc.)
│       │   │   ├── migrations/     # Database schema migrations
│       │   │   ├── services/       # Database-level services
│       │   │   ├── types/          # Entity and query result types
│       │   │   └── pagination/     # Pagination utilities
│       │   ├── integrations/       # External service integrations
│       │   │   ├── storage/        # S3/file storage service
│       │   │   ├── mail/           # Email service (Postmark/Nodemailer)
│       │   │   ├── queue/          # Job queue (Bull/BullMQ)
│       │   │   ├── redis/          # Redis caching and pub/sub
│       │   │   ├── security/       # Auth providers, SSO, LDAP
│       │   │   ├── export/         # Document export (PDF, Markdown)
│       │   │   ├── import/         # Document import
│       │   │   ├── health/         # Health check endpoints
│       │   │   ├── static/         # Static file serving
│       │   │   ├── telemetry/      # Analytics and observability
│       │   │   └── environment/    # Environment configuration loader
│       │   └── ee/                 # Enterprise edition modules
│       │       └── ee.module.ts    # Optional enterprise features (SSO, billing, etc.)
│       ├── test/                   # Test configuration and fixtures
│       ├── dist/                   # Compiled JavaScript output
│       ├── jest.config.json        # Jest testing configuration
│       └── package.json            # Server dependencies
│
├── packages/                       # Shared libraries
│   ├── editor-ext/                 # Tiptap editor extensions
│   │   ├── src/
│   │   │   └── lib/               # Custom editor extensions (collab, search, etc.)
│   │   └── package.json
│   └── ee/                         # Enterprise shared utilities (types, services)
│       └── package.json
│
├── .planning/                      # Planning and analysis documents
│   └── codebase/                   # Architecture and codebase maps (this directory)
│       ├── ARCHITECTURE.md
│       ├── STRUCTURE.md
│       ├── CONVENTIONS.md
│       ├── TESTING.md
│       ├── STACK.md
│       ├── INTEGRATIONS.md
│       └── CONCERNS.md
│
├── nx.json                         # Nx workspace configuration
├── package.json                    # Monorepo root dependencies and Nx scripts
├── pnpm-workspace.yaml             # pnpm workspace configuration
└── docker-compose.yml              # Local development Docker setup (PostgreSQL, Redis)
```

## Directory Purposes

**apps/client/src/:**

**components/**
- Purpose: Reusable UI components across the application
- Contains: Button variants, modals, forms, layout wrappers, icons
- Organization:
  - `ui/`: Basic UI components (buttons, inputs, cards, dialogs)
  - `common/`: Application-specific common components (user info, pagination)
  - `layouts/`: Page layout wrappers (global layout with sidebar, share layout)
  - `icons/`: Icon component wrappers
  - `settings/`: Settings page shared components

**features/**
- Purpose: Feature-scoped business logic and UI per domain area
- Contains: Each subdirectory is independently scoped (queries, services, components, types, hooks)
- Key features:
  - `page/`: Page CRUD, sidebar tree, breadcrumbs
  - `space/`: Space navigation, settings
  - `auth/`: Login, signup, password reset
  - `workspace/`: Workspace switching, settings
  - `comment/`: Comments and discussions
  - `search/`: Full-text search functionality
  - `attachments/`: File upload and preview
  - `editor/`: Text editor integration

**ee/**
- Purpose: Enterprise-only features (gated by license or cloud mode)
- Contains: Billing, API keys, SSO/security, MFA
- Organization: Same structure as features (queries, services, components, types)

**pages/**
- Purpose: Page-level components that correspond to routes in App.tsx
- Contains: Layout-level components matched to URL paths
- Organization: Mirror the routing structure (/dashboard → pages/dashboard/, /settings → pages/settings/)

**lib/**
- Purpose: Shared utilities, configuration, and helpers
- Key files:
  - `api-client.ts`: Axios instance with interceptors, auth header injection
  - `config.ts`: Environment detection (cloud vs. self-hosted), feature flags
  - `constants.ts`: Application-wide constants
  - `types.ts`: Shared TypeScript types (IPagination, QueryParams)
  - `utils.tsx`: Helper functions (date formatting, URL building, etc.)
  - `jotai-helper.ts`: Jotai atom utilities

**hooks/**
- Purpose: Global custom React hooks for state and side effects
- Contains: Custom hooks for redirects, origin tracking, auth checks

**apps/server/src/:**

**core/***
- Purpose: Domain modules implementing business logic per entity/domain
- Pattern: Each module has:
  - `controller.ts`: HTTP route handlers
  - `module.ts`: NestJS module definition with imports/exports
  - `services/*.service.ts`: Business logic
  - `dto/`: Data Transfer Objects for validation
  - Subdirectories for related functionality (auth has strategies/, guards/)

**common/**
- Purpose: Shared infrastructure utilities for all modules
- Contains:
  - `decorators/`: Custom parameter decorators (@AuthUser, @AuthWorkspace)
  - `guards/`: NestJS guards (JwtAuthGuard, SetupGuard)
  - `interceptors/`: Response/error transformation
  - `filters/`: Exception filters and error handlers
  - `logger/`: Logging utilities
  - `events/`: Event constants and types
  - `helpers/`: General-purpose helper functions
  - `validator/`: Custom validation decorators

**database/**
- Purpose: Data persistence layer with Kysely ORM
- Contains:
  - `repos/`: Repository classes with CRUD and complex queries
  - `migrations/`: Database schema changes (Knex-like migrations)
  - `types/`: TypeScript types generated from database schema
  - `services/`: Database-level services (transaction helpers, etc.)
  - `pagination/`: Pagination utilities and types

**integrations/**
- Purpose: External service adapters and integrations
- Contains:
  - `storage/`: S3 file storage client (presigned URLs, uploads)
  - `mail/`: Email service (Postmark, Nodemailer)
  - `queue/`: Job queue with Bull/BullMQ (async tasks, cron)
  - `redis/`: Redis caching and pub/sub
  - `security/`: SSO providers (Google OAuth, SAML, LDAP, OIDC)
  - `export/`: PDF/Markdown document export
  - `import/`: File import (Markdown, DOCX to Yjs)
  - `health/`: Liveness and readiness probes

**collaboration/**
- Purpose: Real-time document synchronization
- Contains:
  - `server/`: Standalone Hocuspocus WebSocket server
  - `extensions/`: Yjs document event handlers (auth, persistence, logging)
  - `listeners/`: Event listeners that trigger on document changes
  - `adapter/`: WebSocket protocol adapter

**ws/**
- Purpose: General WebSocket gateway for event notifications
- Contains: Socket.io based event emitter for non-collaboration events

**ee/**
- Purpose: Enterprise edition optional modules
- Contains: SSO configuration, billing, API keys, license management
- Note: Dynamically imported in app.module.ts if available

## Key File Locations

**Entry Points:**
- `apps/server/src/main.ts`: Backend HTTP server bootstrap
- `apps/server/src/collaboration/server/collab-main.ts`: Standalone collaboration server
- `apps/client/src/main.tsx`: Frontend React app initialization
- `apps/client/src/App.tsx`: Route definitions and top-level layout

**Configuration:**
- `apps/server/src/integrations/environment/environment.service.ts`: Central env var loader
- `apps/client/src/lib/config.ts`: Frontend feature flags and environment detection
- `apps/client/src/theme/`: Theme configuration for Mantine UI
- `nx.json`: Nx build system configuration
- `package.json` (root): Workspace scripts and shared dependencies

**Core Logic:**
- `apps/server/src/core/page/services/page.service.ts`: Page CRUD and versioning logic
- `apps/server/src/core/auth/services/auth.service.ts`: Authentication logic
- `apps/server/src/core/workspace/services/workspace.service.ts`: Workspace isolation
- `apps/client/src/features/page/queries/page-query.ts`: Page data fetching with React Query
- `apps/client/src/features/editor/`: Rich text editor integration with Tiptap

**Testing:**
- `apps/server/test/`: E2E test configuration and fixtures
- `apps/server/src/**/*.spec.ts`: Unit and integration tests

**Database:**
- `apps/server/src/database/repos/`: All repository classes (PageRepo, SpaceRepo, UserRepo, etc.)
- `apps/server/src/database/migrations/`: All schema changes as timestamped files
- `apps/server/src/database/types/db.d.ts`: Generated TypeScript types from schema

## Naming Conventions

**Files:**
- Controllers: `*.controller.ts` (e.g., `page.controller.ts`)
- Services: `*.service.ts` (e.g., `page.service.ts`)
- Repositories: `*.repo.ts` (e.g., `page.repo.ts`)
- DTOs: `*.dto.ts` (e.g., `create-page.dto.ts`, `update-page.dto.ts`)
- Modules: `*.module.ts` (e.g., `page.module.ts`)
- Guards: `*.guard.ts` (e.g., `jwt-auth.guard.ts`)
- Decorators: `*.decorator.ts` (e.g., `auth-user.decorator.ts`)
- React components: `*.tsx` (e.g., `page.tsx`, `PageList.tsx`)
- React hooks: `use*.ts` or `use*.tsx` (e.g., `usePageQuery.ts`, `useTrackOrigin.tsx`)
- Services (frontend): `*-service.ts` (e.g., `page-service.ts`)
- Queries (frontend): `*-query.ts` (e.g., `page-query.ts`)
- Types: `*.types.ts` (e.g., `page.types.ts`)
- Constants: `*.constants.ts` (e.g., `auth.constants.ts`)
- Tests: `*.spec.ts` or `*.test.ts` (e.g., `page.service.spec.ts`)
- Migrations: Timestamp prefix `YYYYMMDDTHHMMSS-description.ts` (e.g., `20240324T086300-pages.ts`)

**Directories:**
- camelCase for most: `src/common/decorators/`, `src/integrations/storage/`
- kebab-case for multi-word feature names: `ee/api-key/`, `ee/sso-provider/`
- PascalCase only for component directories with default exports: Not standard in this codebase

## Where to Add New Code

**New Feature:**
- Primary code: `apps/client/src/features/{featureName}/` (create subdirs: queries, services, components, types, hooks)
- API endpoint: `apps/server/src/core/{domainName}/{featureName}/` (controller, service, dto, if new domain)
- Tests: `apps/server/src/core/{domainName}/*.spec.ts` (co-located with source)
- Client tests: `apps/client/src/features/{featureName}/__tests__/` (optional, create if needed)

**New Component/Module:**
- If shared across features: `apps/client/src/components/{category}/`
- If feature-specific: `apps/client/src/features/{featureName}/components/`
- If backend infrastructure: `apps/server/src/common/` (decorators, guards, etc.)

**Utilities:**
- Shared helpers (frontend): `apps/client/src/lib/{category}/` (utils.tsx, helpers.ts, etc.)
- Shared helpers (backend): `apps/server/src/common/helpers/`
- Third-party integration wrappers: `apps/server/src/integrations/{serviceName}/`

**Database Changes:**
- New schema migration: Create file in `apps/server/src/database/migrations/` with timestamp prefix
- New repository: `apps/server/src/database/repos/{entityName}/{entity}.repo.ts`
- Generated types: Auto-updated via `npm run migration:codegen` after migration

**Enterprise Features:**
- Features available in EE only: `apps/client/src/ee/{featureName}/` (follow same structure as features/)
- Enterprise backend modules: `apps/server/src/ee/{featureName}/`
- EE guard: Check `isCloud()` in frontend, check license in backend service

## Special Directories

**node_modules/**
- Purpose: Dependency installation
- Generated: Yes (via pnpm install)
- Committed: No

**dist/**
- Purpose: Compiled JavaScript output from TypeScript
- Generated: Yes (via nx build or tsc)
- Committed: No

**.nx/cache/**
- Purpose: Nx build system cache for incremental builds
- Generated: Yes
- Committed: No

**.env** (See .env.example)
- Purpose: Environment variables for local development
- Generated: No (manually created from .env.example)
- Committed: No (in .gitignore)

**apps/client/dist/**
- Purpose: Frontend build output (static HTML/JS/CSS)
- Generated: Yes (via vite build)
- Committed: No

**apps/server/dist/**
- Purpose: Backend compiled output
- Generated: Yes (via nest build)
- Committed: No

**public/** (apps/client)
- Purpose: Static assets served directly, localization JSON files
- Generated: No (manually maintained)
- Committed: Yes
- Subdirs: `icons/` (SVG icons), `locales/` (i18n JSON per language)

---

*Structure analysis: 2026-03-19*

# Architecture

**Analysis Date:** 2026-03-19

## Pattern Overview

**Overall:** Modular monorepo with decoupled backend (NestJS) and frontend (React+Vite). Enterprise features isolated in `ee/` directories.

**Key Characteristics:**
- Monorepo structure using pnpm workspaces with Nx build system
- Separation of concerns via NestJS modules for backend
- Feature-based organization on frontend (queries, services, components per feature)
- Real-time collaboration via WebSocket with Hocuspocus and Yjs
- Optional enterprise modules dynamically loaded at runtime

## Layers

**API Layer (Backend):**
- Purpose: HTTP request handling via NestJS controllers
- Location: `apps/server/src/core/*/` (auth, page, space, user, etc.)
- Contains: Controllers, DTOs, route handlers, request/response validation
- Depends on: Services, database repos, guards, decorators
- Used by: Frontend via REST API, public share endpoints

**Service Layer (Backend):**
- Purpose: Business logic, domain operations, orchestration
- Location: `apps/server/src/core/*/services/` (e.g., `apps/server/src/core/page/services/page.service.ts`)
- Contains: Service classes with domain logic, validation, calculations
- Depends on: Database repos, external integrations, event emitters
- Used by: Controllers, other services, event listeners

**Database Layer (Backend):**
- Purpose: Data persistence and querying with Kysely ORM
- Location: `apps/server/src/database/` (repos, migrations, types)
- Contains: Repository classes, type definitions, migrations, pagination utilities
- Depends on: PostgreSQL via Kysely query builder
- Used by: Services, event listeners, direct repository injections

**Infrastructure Layer (Backend):**
- Purpose: External integrations and cross-cutting concerns
- Location: `apps/server/src/integrations/` (storage, mail, queue, redis, security, etc.)
- Contains: Service wrappers for S3, Redis, SMTP, Stripe, database connections
- Depends on: Third-party SDKs (AWS S3, Postmark, Bull, etc.)
- Used by: Core modules, event handlers

**WebSocket/Collaboration Layer (Backend):**
- Purpose: Real-time document synchronization and live editing
- Location: `apps/server/src/collaboration/` and `apps/server/src/ws/`
- Contains: Hocuspocus gateway, Yjs extensions, WebSocket adapters
- Depends on: Redis for distributed collaboration, auth services
- Used by: Frontend WebSocket clients

**UI/Component Layer (Frontend):**
- Purpose: User interface rendering and interaction
- Location: `apps/client/src/components/` and `apps/client/src/pages/`
- Contains: React components, layouts, modals, forms
- Depends on: Features, hooks, Mantine UI, Tabler icons
- Used by: Pages and feature-level components

**Query/Service Layer (Frontend):**
- Purpose: Data fetching and mutation management
- Location: `apps/client/src/features/*/queries/` and `apps/client/src/features/*/services/`
- Contains: React Query hooks (useQuery, useMutation), API calls via axios
- Depends on: API client, types, services
- Used by: Components, pages, hooks

**Feature Layer (Frontend):**
- Purpose: Feature-specific logic and UI isolated by domain
- Location: `apps/client/src/features/` (auth, page, space, comment, attachments, etc.)
- Contains: Feature-scoped components, queries, services, types, hooks, utilities
- Depends on: UI components, lib utilities, shared hooks
- Used by: Pages, layout components, other features

**Shared Utilities Layer (Frontend):**
- Purpose: Common utilities, helpers, configuration
- Location: `apps/client/src/lib/` and `apps/client/src/hooks/`
- Contains: API client config, theme, constants, utility functions, custom hooks
- Depends on: External libraries (Mantine, axios, jotai)
- Used by: All frontend features and components

## Data Flow

**Page View Request (Primary User Workflow):**

1. User navigates to `/s/:spaceSlug/p/:pageSlug` in browser
2. React Router loads `Page` component from `apps/client/src/pages/page/page.tsx`
3. Page component calls `usePageQuery()` hook
4. `usePageQuery` (from `apps/client/src/features/page/queries/page-query.ts`) invokes `getPageById()` service
5. Service makes POST request to `/api/pages/info` via axios client
6. Request hits `PageController.info()` in `apps/server/src/core/page/page.controller.ts`
7. Controller injects `PageService` and calls `getPageInfo()` method
8. Service queries database via `PageRepo.findById()` in `apps/server/src/database/repos/page/page.repo.ts`
9. Database layer returns page entity with metadata
10. Service applies CASL permission checks via `SpaceAbilityFactory`
11. Controller returns paginated/serialized response
12. Frontend receives data, updates React Query cache
13. Component re-renders with page content
14. Jotai atoms update tree state for sidebar navigation

**Collaboration (Real-Time Editing):**

1. Editor detects content change in Tiptap editor
2. Change propagated to Yjs shared type (Y.Doc)
3. WebSocket client connects to `/collab` endpoint (separate server in collaboration module)
4. `CollaborationGateway.handleConnection()` authenticates via JWT
5. `AuthenticationExtension` validates user and page access
6. `PersistenceExtension` handles Y.Doc state updates
7. Hocuspocus provider broadcasts updates to other connected clients via WebSocket
8. Redis adapter synchronizes across multiple server instances
9. `HistoryListener` emits page update events
10. `PageRepo` persists final state to PostgreSQL
11. Other connected clients receive updates via Yjs subscriptions
12. Editor re-renders with merged changes

**State Management (Frontend):**

- **React Query**: Server state (pages, spaces, users, settings) - refetch on demand, cached
- **Jotai atoms**: UI state (sidebar tree, collapsed nodes, search input) - ephemeral, local
- **Socket.io client**: Real-time event subscriptions for page updates, comment notifications
- **Browser localStorage**: User preferences (theme, sidebar width, editor settings)

## Key Abstractions

**Service Abstraction:**
- Purpose: Encapsulate domain business logic separate from HTTP concerns
- Examples: `PageService`, `AuthService`, `WorkspaceService`, `SpaceService`
- Pattern: Dependency injection via NestJS, request context passed as parameters
- Location: `apps/server/src/core/*/services/*.service.ts`

**Repository Abstraction:**
- Purpose: Data access layer with type-safe Kysely queries
- Examples: `PageRepo`, `SpaceRepo`, `UserRepo`, `GroupRepo`
- Pattern: Injectable services with transaction support, event emission
- Location: `apps/server/src/database/repos/*/`

**Query Hooks (Frontend):**
- Purpose: Encapsulate React Query configuration and side effects per data resource
- Examples: `usePageQuery()`, `useSpaceQuery()`, `useWorkspaceQuery()`
- Pattern: Custom hooks wrapping useQuery/useMutation with refetch keys, handlers
- Location: `apps/client/src/features/*/queries/*.ts`

**Feature Modules (Frontend):**
- Purpose: Self-contained, domain-scoped features with internal dependencies
- Examples: `/ee/api-key/`, `/features/page/`, `/features/comment/`
- Pattern: Each feature has queries, services, components, types, hooks in subdirectories
- Location: `apps/client/src/features/*/` and `apps/client/src/ee/*/`

**CASL Ability Factory:**
- Purpose: Role-based access control (RBAC) evaluated on client and server
- Examples: `SpaceAbilityFactory`, `PageAbilityFactory`
- Pattern: Define abilities per role (viewer, editor, admin), check before rendering/action
- Location: `apps/server/src/core/casl/abilities/` (server), `apps/client/src/features/casl/` (client)

**Event System:**
- Purpose: Decouple domain events from handlers
- Examples: Page created, page updated, user invited, attachment uploaded
- Pattern: NestJS EventEmitter2 dispatches events, listeners subscribe
- Location: `apps/server/src/common/events/` (event constants), feature modules (listeners)

## Entry Points

**Backend:**
- Location: `apps/server/src/main.ts`
- Triggers: `npm run server:dev` or Docker container start
- Responsibilities:
  - Initialize NestJS FastifyAdapter
  - Register middleware (multipart, cookies, CORS)
  - Load enterprise modules conditionally
  - Attach WebSocket adapters (Redis for clustering)
  - Listen on port 8080

**Frontend:**
- Location: `apps/client/src/main.tsx`
- Triggers: Vite dev server or production build output
- Responsibilities:
  - Mount React DOM to `#root`
  - Initialize Mantine theme and providers
  - Setup React Router for SPA navigation
  - Initialize React Query with cache config
  - Initialize PostHog for analytics (cloud only)
  - Wrap app with context providers (modals, notifications, i18n)

**Collaboration Server (Separate Process):**
- Location: `apps/server/src/collaboration/server/collab-main.ts`
- Triggers: `npm run collab:prod` or `npm run collab:dev`
- Responsibilities:
  - Standalone Hocuspocus server for document synchronization
  - Manages Yjs document instances per page
  - Persists document state to PostgreSQL

## Error Handling

**Strategy:** Layered with global interceptors and exception filters

**Patterns:**

**Backend:**
- Request-level: Validation pipes transform and validate DTOs
- Service-level: Catch specific errors, throw HttpException with status codes
- Global: `TransformHttpResponseInterceptor` wraps responses, error responses include status/message
- Logger: `InternalLogFilter` captures unhandled exceptions

**Frontend:**
- Network errors: Axios interceptor catches 4xx/5xx, notifications show user message
- Component errors: `ErrorBoundary` catches render-time errors, fallback UI
- Query errors: React Query error state, UI shows error message or retry button
- Validation: Zod schema validation in forms before submission

## Cross-Cutting Concerns

**Logging:**
- Backend: `InternalLogFilter` wraps console logs, Winston-like structure
- Frontend: PostHog event tracking (cloud only), console logs for development

**Validation:**
- Backend: `class-validator` decorators on DTOs, `ValidationPipe` enforces
- Frontend: Zod schemas on forms, axios interceptors validate response shape

**Authentication:**
- Backend: JWT strategy via `passport-jwt`, header: `Authorization: Bearer <token>`
- Frontend: Token stored in httpOnly cookie or localStorage, axios includes in requests
- Guards: `JwtAuthGuard` on controller routes, workspace check via middleware

**Authorization:**
- Backend: CASL abilities defined per role, checked in services before actions
- Frontend: CASL abilities in component render conditions, optimistic UI updates
- Workspace isolation: Request middleware injects `workspaceId` into req.raw

**WebSocket Security:**
- Authentication: JWT token extracted from query param or header in WebSocket upgrade
- Per-page authorization: User's CASL ability checked before allowing edits

---

*Architecture analysis: 2026-03-19*

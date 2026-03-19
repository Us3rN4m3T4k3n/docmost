# Technology Stack

**Analysis Date:** 2026-03-19

## Languages

**Primary:**
- TypeScript 5.7.x - Used in both server and client applications
- JavaScript - Build scripts and utilities

**Secondary:**
- React 18.3.1 - Frontend UI framework
- HTML/CSS - Client-side rendering

## Runtime

**Environment:**
- Node.js 22 (Alpine Linux in Docker) - Backend runtime
- Browser APIs - Client-side runtime

**Package Manager:**
- pnpm 10.4.0
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- NestJS 11.1.3 - Backend framework with Fastify platform integration (`@nestjs/platform-fastify` 11.1.3)
- React 18.3.1 - Frontend UI library

**Editor & Collaboration:**
- TipTap 2.10.3 - Rich text editor with multiple extensions (core, collaboration, code block, highlighting, etc.)
- Hocuspocus 2.15.2 - Real-time collaborative editing server (`@hocuspocus/server` 2.15.2)
- Y.js 13.6.27 - CRDT implementation for collaborative features

**UI Framework:**
- Mantine 8.1.3+ - React UI components with core, forms, modals, notifications, spotlight
- Tabler Icons React 3.34.0 - Icon set

**Build/Dev:**
- Vite 6.3.5 - Client-side bundler and dev server (`apps/client/vite.config.ts`)
- Nx 20.4.5 - Monorepo task runner with caching
- TypeScript compilation - Server uses tsc with NestJS CLI

**Testing:**
- Jest 29.7.0 - Test runner with ts-jest transformer
- Supertest 7.0.0 - HTTP testing library
- NestJS Testing 11.0.10 - Testing utilities

## Key Dependencies

**Critical:**
- `@nestjs/core` 11.1.3 - Core NestJS framework
- `@nestjs/platform-fastify` 11.1.3 - Fastify adapter for NestJS
- `kysely` 0.28.2 - SQL query builder (database abstraction)
- `pg` 8.16.0 - PostgreSQL client
- `ioredis` 5.4.1 - Redis client
- `@nestjs-labs/nestjs-ioredis` 11.0.4 - Redis module for NestJS

**Infrastructure:**
- `@aws-sdk/client-s3` 3.701.0 - AWS S3 file storage
- `@aws-sdk/lib-storage` 3.701.0 - S3 upload utilities
- `@socket.io/redis-adapter` 8.3.0 - Redis adapter for Socket.IO
- `socket.io` 4.8.1 - WebSocket communication
- `bullmq` 5.61.0 - Task queue implementation
- `@nestjs/bullmq` 11.0.2 - BullMQ integration for NestJS

**Authentication & Security:**
- `@nestjs/jwt` 11.0.0 - JWT token handling
- `@nestjs/passport` 11.0.5 - Passport.js integration
- `passport-jwt` 4.0.1 - JWT strategy
- `passport-google-oauth20` 2.0.0 - Google OAuth integration
- `@node-saml/passport-saml` 5.1.0 - SAML authentication
- `openid-client` 5.7.1 - OpenID Connect client
- `jsonwebtoken` 9.0.2 - JWT library
- `bcrypt` 5.1.1 - Password hashing

**Email & Transactional:**
- `nodemailer` 7.0.3 - SMTP email sending
- `postmark` 4.0.5 - Postmark email service
- `@react-email/components` 0.0.28 - React email templates
- `@react-email/render` 1.0.2 - Render React email to HTML

**Search & Documents:**
- `typesense` 2.1.0 - Search engine (optional, configurable with database search)
- `marked` 13.0.3 - Markdown parsing
- `pg-tsquery` 8.4.2 - PostgreSQL full-text search
- `pdfjs-dist` 5.4.54 - PDF processing
- `mammoth` 1.10.0 - DOCX to HTML conversion
- `cheerio` 1.1.0 - HTML parsing

**Media & Files:**
- `sharp` 0.34.3 - Image processing and resizing
- `jszip` 3.10.1 - ZIP file handling
- `yauzl` 3.2.0 - ZIP extraction

**Data & Utilities:**
- `yjs` 13.6.27 - CRDT for collaboration
- `uuid` 11.1.0 - UUID generation
- `nanoid` 3.3.11 - Unique ID generation
- `date-fns` 4.1.0 - Date utilities
- `zod` 3.25.56 - Schema validation
- `class-validator` 0.14.1 - DTO validation
- `class-transformer` 0.5.1 - Object transformation
- `dompurify` 3.2.6 - HTML sanitization
- `@braintree/sanitize-url` 7.1.0 - URL sanitization

**Client Libraries:**
- `axios` 1.9.0 - HTTP client
- `@tanstack/react-query` 5.80.6 - Server state management
- `jotai` 2.12.5 - Atomic state management
- `react-router-dom` 7.0.1 - Routing
- `i18next` 23.14.0 - Internationalization
- `posthog-js` 1.255.1 - Analytics (optional)
- `socket.io-client` 4.8.1 - WebSocket client

**Admin Tools:**
- `reflect-metadata` 0.2.2 - Metadata reflection for TypeScript decorators

## Configuration

**Environment:**
- Configured via `.env` file (see `.env.example` for defaults)
- Key configs:
  - `APP_URL` - Application domain
  - `APP_SECRET` - Encryption secret (minimum 32 characters)
  - `DATABASE_URL` - PostgreSQL connection string
  - `REDIS_URL` - Redis connection string
  - `STORAGE_DRIVER` - local or s3
  - `MAIL_DRIVER` - smtp or postmark
  - `SEARCH_DRIVER` - database or typesense (optional)
  - `COLLAB_URL` - Collaboration server URL
  - `CLOUD` - Enable cloud multi-tenant mode

**Build:**
- Server: `nest build` via NestJS CLI (outputs to `apps/server/dist`)
- Client: `vite build` via Vite
- Monorepo: Orchestrated with Nx caching and parallel builds

## Platform Requirements

**Development:**
- Node.js 22+
- pnpm 10.4.0
- PostgreSQL 16+ (for database)
- Redis 7.2+ (for caching and pub/sub)

**Production:**
- Docker container (Node.js 22 Alpine)
- PostgreSQL 16+ database
- Redis instance
- Optional: AWS S3 bucket (if using S3 storage)
- Optional: Postmark account (if using Postmark email)
- Optional: Typesense instance (if using Typesense search)
- Optional: SMTP server (if using SMTP email)

---

*Stack analysis: 2026-03-19*

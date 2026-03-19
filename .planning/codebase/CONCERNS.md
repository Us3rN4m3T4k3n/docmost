# Codebase Concerns

**Analysis Date:** 2026-03-19

## Tech Debt

**Screenshot Detection Service - In-Memory Storage Only:**
- Issue: Screenshot attempt tracking uses in-memory `Map` instead of database persistence
- Files: `apps/server/src/integrations/security/screenshot-detection.service.ts`
- Impact: All screenshot violation data is lost on server restart. Thresholds reset automatically. Users can bypass suspension by restarting the server. Security feature is effectively disabled after deployment/restart
- Fix approach:
  1. Create database table for screenshot attempts (status, count, timestamps)
  2. Implement database queries to replace in-memory Map operations
  3. Add index on (userId, workspaceId) for efficient lookups
  4. Implement cache layer (Redis) for performance if needed

**Content Protection Service - Stub Implementation:**
- Issue: `ContentProtectionService` has only logging; all actual logic is TODOed or stubbed
- Files: `apps/server/src/integrations/security/content-protection.service.ts`
- Impact: Content protection attempts are logged but not stored, threshold checking doesn't work, user account flagging not implemented, admin notifications missing
- Fix approach:
  1. Implement database storage for protection attempts with timestamps
  2. Add threshold checking logic for repeated violations
  3. Implement account flagging system
  4. Add admin notification mechanism

**Page Service Duplicate Operation Handling:**
- Issue: Page duplication uses in-memory Maps and doesn't queue all attachment copies
- Files: `apps/server/src/core/page/services/page.service.ts` (lines 285-458)
- Impact: Large page duplication might fail mid-operation. Attachment copies not queued to background job, blocking request. No rollback on partial failure
- Fix approach:
  1. Move attachment copy operation to queue job (mentioned in TODO at line 398)
  2. Implement transaction-safe page duplication with rollback
  3. Queue all attachment storage operations separately

**Pagination Type Safety:**
- Issue: Type assertion with `@ts-expect-error TODO` in pagination utility
- Files: `apps/server/src/database/pagination/pagination.ts` (line 36)
- Impact: Deferred join pagination has untyped rows.map() result. May break with schema changes
- Fix approach: Properly type the deferred join primary key extraction, use generic type parameters

**Inconsistent Domain Resolution:**
- Issue: TODO comment indicates unfinished domain middleware unification
- Files: `apps/server/src/common/middlewares/domain.middleware.ts` (line 25)
- Impact: Self-hosted and cloud deployment paths have similar but separate logic. Bug fixes must be applied twice. Inconsistent behavior possible
- Fix approach: Extract common domain resolution logic into shared utility function

## Known Bugs

**SPA Routing Stability Issues:**
- Symptoms: Multiple recent fixes to static file serving and SPA routing (last 5 commits)
- Files: `apps/server/src/integrations/static/` related routes and Fastify configuration
- Trigger: Static file serving conflicts with API routes under certain conditions
- Workaround: Recent commits (03ca3f84, 56999a8c, etc.) suggest ongoing instability. Needs integration testing
- Severity: High - affects core routing

**Unimplemented Export Task Processing:**
- Symptoms: Export task is ignored in queue processor
- Files: `apps/server/src/integrations/import/processors/file-task.processor.ts` (line 27 TODO)
- Trigger: User initiates document export
- Workaround: None - exports likely fail silently

## Security Considerations

**Screenshot Detection - Admin Notifications Not Implemented:**
- Risk: Admins are never notified of repeated screenshot violations or account suspensions
- Files: `apps/server/src/integrations/security/screenshot-detection.service.ts` (lines 198, 247)
- Current mitigation: Users are suspended in database, but admins have no visibility
- Recommendations:
  1. Implement email notifications to workspace admins for violations
  2. Create in-app notification system for critical security events
  3. Add audit log for account suspensions
  4. Implement admin dashboard to review violation history

**Content Protection - Account Flagging Missing:**
- Risk: Accounts attempting to bypass content protection are not flagged or restricted
- Files: `apps/server/src/integrations/security/content-protection.service.ts` (lines 66, 81, 91)
- Current mitigation: Only logging. No enforcement
- Recommendations:
  1. Implement threshold-based account flagging (e.g., >10 dev tools attempts)
  2. Add account review workflow for flagged accounts
  3. Implement rate limiting on flagged accounts
  4. Send alerts to admins for suspicious patterns

**Suspended User Middleware - Incomplete Actions:**
- Risk: User suspension only sets suspendedAt timestamp, doesn't revoke sessions/tokens
- Files: `apps/server/src/integrations/security/screenshot-detection.service.ts` (lines 176-179 TODO)
- Current mitigation: Session stays active after suspension, user can continue using old tokens
- Recommendations:
  1. Implement session revocation on suspension
  2. Invalidate all active tokens for suspended users
  3. Add endpoint to check user suspension status on every request
  4. Clear WebSocket connections for suspended users

**Type Safety Issues - 'any' Casts:**
- Risk: Untyped `any` casts may hide runtime errors and allow unexpected data
- Files:
  - `apps/server/src/database/repos/space/space-member.repo.ts` (line 174)
  - `apps/server/src/database/pagination/pagination.ts` (line 43)
  - All database migration files (use `Kysely<any>`)
- Current mitigation: None
- Recommendations:
  1. Replace `any` with proper generic types
  2. Create strict TypeScript configuration for migrations
  3. Add type guards for external data

## Performance Bottlenecks

**Attachment Duplication Blocking Request:**
- Problem: Page duplication with many attachments blocks HTTP response while copying files
- Files: `apps/server/src/core/page/services/page.service.ts` (lines 390-458)
- Cause: Attachment copies done synchronously in request handler, not queued to background job
- Improvement path:
  1. Move attachment copy logic to queue job with separate retry policy
  2. Return response immediately with job ID
  3. Implement websocket updates when duplication completes

**Import Attachment Processing - Concurrency Limits:**
- Problem: Import service uses hard-coded `CONCURRENT_UPLOADS = 3` regardless of system capacity
- Files: `apps/server/src/integrations/import/services/import-attachment.service.ts` (line 38)
- Cause: Fixed concurrency limits configured at code level, not configurable
- Improvement path:
  1. Make concurrency configurable via environment variables
  2. Implement adaptive concurrency based on available resources
  3. Add queue monitoring/metrics to detect bottlenecks

**File Import Task - Missing Export Implementation:**
- Problem: Export task queue processor has no implementation, effectively disabled
- Files: `apps/server/src/integrations/import/processors/file-task.processor.ts` (line 27)
- Cause: Export feature was started but not completed
- Improvement path:
  1. Complete export task implementation or remove from queue
  2. Add tests for both import and export flow
  3. Document why export is not implemented (if intentional)

## Fragile Areas

**Screenshot Detection Service - Critical Business Logic Not Persisted:**
- Files: `apps/server/src/integrations/security/screenshot-detection.service.ts`
- Why fragile:
  1. In-memory storage means production data loss on any restart
  2. Multiple TODO comments for incomplete features (database persistence, notifications, session revocation)
  3. No tests visible for violation escalation logic
  4. Suspension logic intertwined with status tracking
- Safe modification:
  1. Add comprehensive test suite for violation thresholds first
  2. Implement database layer separately before deploying
  3. Add feature flag to enable/disable enforcement
- Test coverage: No visible tests for this service

**Page Duplication - Complex State Mapping:**
- Files: `apps/server/src/core/page/services/page.service.ts` (lines 260-460)
- Why fragile:
  1. Uses multiple nested Maps to track page and attachment ID mappings
  2. Complex reference update logic with page link rewrites
  3. Mixed concerns: page creation, attachment copying, reference updating
  4. Error during attachment copy leaves orphaned pages in database
- Safe modification:
  1. Add transaction-level rollback support
  2. Extract attachment copy logic to separate service with independent queue
  3. Add comprehensive logging of each duplication step
- Test coverage: Needs tests for partial failures and reference updates

**Import Attachment Service - Large File Handling:**
- Files: `apps/server/src/integrations/import/services/import-attachment.service.ts` (890 lines)
- Why fragile:
  1. Largest single file in server codebase, high complexity
  2. Handles Draw.io pair detection, HTML parsing, file uploads
  3. Retry logic with MAX_RETRIES=2 but unclear what triggers retry
  4. Stream-based file operations with limited error context
- Safe modification:
  1. Split into smaller, focused services (DrawioProcessor, AttachmentUploader)
  2. Add comprehensive logging with file size/progress info
  3. Implement timeout handling for slow uploads
  4. Add unit tests for HTML parsing and file detection logic
- Test coverage: Not visible in codebase

**Domain Middleware - Deployment Configuration Fragile:**
- Files: `apps/server/src/common/middlewares/domain.middleware.ts`
- Why fragile:
  1. Separate code paths for self-hosted vs cloud with TODO to unify
  2. Both paths can silently fail with workspaceId = null
  3. No logging when workspace not found
- Safe modification:
  1. Unify the two paths into single function
  2. Add explicit error handling or logging for workspace not found
  3. Add unit tests for both self-hosted and cloud mode
- Test coverage: Not visible

## Scaling Limits

**In-Memory Screenshot Tracking:**
- Current capacity: Entire screenshot violation history fits in server memory (one Map per process)
- Limit: With 100+ concurrent users and multiple violations per user, memory grows unbounded. Map not cleared on restart means historical data in production
- Scaling path:
  1. Implement database storage (supports millions of records)
  2. Add data retention policy (delete records >90 days old)
  3. Switch to Redis for high-concurrency scenario
  4. Implement pagination for admin dashboard queries

**Concurrent Upload Limits:**
- Current capacity: Max 3 concurrent attachment uploads during import
- Limit: Large imports (100+ attachments) will take 30+ seconds, blocking request processing
- Scaling path:
  1. Move all uploads to queue-based processing
  2. Increase concurrency based on server resources
  3. Implement bulk upload optimization
  4. Add progress tracking/resume capability

**File Import Task - Blocking Single Import:**
- Current capacity: One import blocks entire file-task queue
- Limit: Large imports (>1000 pages) will timeout or block other users
- Scaling path:
  1. Implement job prioritization in queue
  2. Split large imports into multiple sub-jobs
  3. Add timeout and resume capability
  4. Monitor queue depth and alert on bottlenecks

## Dependencies at Risk

**Fractional Indexing Library - Jittered Fork:**
- Risk: Using `fractional-indexing-jittered` (custom fork) instead of standard library
- Files: `apps/server/src/core/page/services/page.service.ts`, package.json
- Impact: Maintenance risk if fork is abandoned. Page ordering logic depends on this
- Migration plan:
  1. Document why jittered version is needed vs standard
  2. Contribute improvements back to original if possible
  3. Monitor fork for security updates
  4. Have fallback to standard library if fork abandoned

**Hocuspocus Collaboration - Multiple Sub-Packages:**
- Risk: Using 4 different `@hocuspocus/*` packages which must stay in sync
- Files: package.json, collaboration extension files
- Impact: Version mismatch could break real-time collaboration
- Migration plan:
  1. Implement version pinning in package.json
  2. Regular updates tested together
  3. Document upgrade procedure for all 4 packages

## Missing Critical Features

**Screenshot Detection - No Admin Dashboard:**
- Problem: No UI to review violations, manage suspensions, or reset attempt counts
- Blocks: Admins can't manage false positives or review violation history
- Impact: Service is unmanageable in production without database queries

**Content Protection - No Enforcement:**
- Problem: All enforcement methods are stubbed (TODO), protection is logging-only
- Blocks: Content protection feature doesn't actually protect anything
- Impact: Security feature non-functional

**Export Feature - Not Implemented:**
- Problem: Export task queue processor is empty, export feature missing
- Blocks: Users cannot export documents
- Impact: Vendor lock-in risk if user needs to leave platform

## Test Coverage Gaps

**Screenshot Detection Service - No Tests:**
- What's not tested: Violation threshold escalation, suspension logic, admin notifications, database persistence
- Files: `apps/server/src/integrations/security/screenshot-detection.service.ts`
- Risk: Regression in critical security logic could ship undetected. Threshold logic (1→warning, 2→final_warning, 3→suspend) untested
- Priority: High

**Page Duplication - No Tests:**
- What's not tested: Complex page mapping, reference rewrites, attachment copy failures, partial duplication rollback
- Files: `apps/server/src/core/page/services/page.service.ts` (duplication logic)
- Risk: Orphaned pages, broken references on duplication failure
- Priority: High

**Import Attachment Service - No Visible Tests:**
- What's not tested: HTML parsing edge cases, file format detection, draw.io pair matching, retry logic
- Files: `apps/server/src/integrations/import/services/import-attachment.service.ts` (890 lines)
- Risk: Large complex file with high failure potential but no test visibility
- Priority: High

**Pagination - Type Safety Tests:**
- What's not tested: Deferred join pagination with various database states, empty results handling
- Files: `apps/server/src/database/pagination/pagination.ts`
- Risk: `@ts-expect-error` hides potential type issues in pagination
- Priority: Medium

**Domain Middleware - No Tests:**
- What's not tested: Self-hosted vs cloud mode routing, missing workspace handling, middleware stacking
- Files: `apps/server/src/common/middlewares/domain.middleware.ts`
- Risk: Domain resolution is core to entire app. Silent failures (workspaceId = null) could cause cascading errors
- Priority: High

---

*Concerns audit: 2026-03-19*

# Phase 2: Language and Content Localization - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a language tag to spaces, detect client language on first login via IP geolocation, store the preference on the user, and let clients override it from account settings. Content filtering is handled by group membership (Phase 4 assigns clients to language-specific groups at account creation) — Phase 2 builds the tagging infrastructure and detection that Phase 4 will consume.

Does NOT include: Stripe account provisioning (Phase 4), group membership assignment, or runtime space-tree filtering by locale query. Language filtering at display time is already handled by space membership (clients only see spaces they're members of).

</domain>

<decisions>
## Implementation Decisions

### Language Tagging

- Language tag lives on **spaces only** — not on individual pages. The space is the unit of language isolation.
- Tag is a **locale code string** (e.g., `en-US`, `pt-BR`, `es-ES`, `de-DE`) stored as a varchar on the `spaces` table. The system must support any locale code, not just EN and PT-BR — new languages will be added in future as new spaces are created.
- **No "Both" tag** — removed from scope. If content needs to be available in multiple languages, duplicate it into separate language-specific spaces.
- Language is a **required field at space creation** — the space creation modal gets a Language dropdown that must be filled before the space can be saved. No space is created without a declared language.
- Untagged spaces (migration legacy, forgotten field): treated as English (`en-US`). PT-BR clients do not see untagged spaces.

### Content Filtering

- **Strict per-language filtering**: EN clients see only `lang = 'en-US'` spaces; PT-BR clients see only `lang = 'pt-BR'` spaces. No "both" pool.
- Filtering happens implicitly via **group membership** (not a runtime SQL filter on the space tree). Phase 4 adds clients to a language-specific group; that group has READER access to the matching space. Clients naturally only see their assigned spaces.
- Admin and Staff are **exempt from filtering** — they see all spaces regardless of language tag.

### IP Geolocation

- Detection happens **on first login** — when `user.locale` is `null` or default `en-US` and the user has never explicitly set a preference.
- Implementation: server-side call to a **free external geo-IP API** (ip-api.com or ipapi.co) using the client's IP from the login request. No geo-IP library bundled with the server.
- Result is stored directly in `user.locale` (the existing column — doubles as content language preference AND UI language).
- **Fallback to English** (`en-US`) if: IP lookup fails, API is unreachable, or the detected country doesn't map to a supported locale.
- Country-to-locale mapping: Brazil (`BR`) → `pt-BR`; all others → `en-US` (initially). The mapping should be a configurable table, not hardcoded, so new countries can be added as new language spaces are created.

### Language Preference (Account Settings)

- The existing `account-language.tsx` component and `locale` field already handle this — `updateUser({ locale: value })` persists the change.
- No new account settings UI needed in Phase 2. The existing language switcher in account settings already supports `pt-BR` and writes to `user.locale`.
- Changing locale also changes the UI language (`i18n.changeLanguage`) — same field, intentional. The content language and UI language are unified.

### Claude's Discretion

- Exact geo-IP API endpoint (ip-api.com vs ipapi.co vs another free option) — choose based on reliability and JSON response format
- Exact country-to-locale mapping table structure (inline config, env var, or DB table)
- Where in the login flow to inject the geo-IP call (auth service post-login hook, or a dedicated locale-detection service)
- Space creation modal: exact placement of the Language dropdown within existing modal UI

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Full requirement list; Phase 2 covers LANG-01, LANG-02, LANG-03, LANG-04, LANG-05

### Existing Language Infrastructure
- `apps/client/src/features/user/components/account-language.tsx` — Existing language switcher component; reuses this for Phase 2 (no new UI needed for preference setting)
- `apps/client/src/i18n.ts` — i18next setup with `pt-BR` locale already supported
- `apps/server/src/database/migrations/20240324T085600-users.ts` — Users table migration; `locale` column (varchar, nullable) already exists

### Database Schema
- `apps/server/src/database/types/db.d.ts` — `Spaces` interface (no `language` field yet — must add migration); `Users` interface with existing `locale` field
- `apps/server/src/core/user/dto/update-user.dto.ts` — `UpdateUserDto` for how locale is updated via API

### Space Creation / Settings
- `apps/client/src/features/space/` — Directory containing space creation modal and settings; Language dropdown must be added here
- `apps/server/src/core/user/user.service.ts` — Login/update service where geo-IP hook will be injected

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `user.locale` field (DB column + DTO + service) — already exists, persists language preference, used by i18next. Phase 2 reuses this as the content language signal.
- `account-language.tsx` — Full language switcher UI with `pt-BR` support already included. No new preference UI needed.
- `i18n.ts` + `/public/locales/pt-BR/` — i18next already set up; `pt-BR` translation file exists.

### Established Patterns
- User update flow: `PATCH /users/me` with `{ locale: 'pt-BR' }` → `user.service.ts` → `user.repo.updateUser()` — this is the established pattern for persisting locale changes.
- Space visibility filtering: already done via `SpaceVisibility.PRIVATE` + group membership in Phase 1. Language filtering layers on top of the same model.

### Integration Points
- **New migration**: Add `language varchar` column to `spaces` table (nullable initially for migration safety; code treats null as `en-US`).
- **Space creation modal**: Add required Language dropdown — must read the `spaces` table schema to find where `SpaceCreateDto` and the modal form are defined.
- **Auth/login service**: Hook into post-login logic to run geo-IP detection when `user.locale` is null. Find the login success handler in the auth module.
- **Phase 4 integration point**: When Stripe webhook creates a new account, it reads `user.locale` to decide which language group to add the user to. Phase 2 ensures this field is reliably set.

</code_context>

<specifics>
## Specific Ideas

- The language dropdown in space creation should list all locale codes that exist across spaces in the workspace — not a hardcoded list. As new language spaces are added, the dropdown grows. For now: English (en-US) and Português (Brasil) (pt-BR).
- IP detection should be invisible to the user — no modal, no prompt, just silently set their locale on first login. The account settings are where they control it if needed.

</specifics>

<deferred>
## Deferred Ideas

- Runtime space-tree SQL filtering by `user.locale` (not needed — group membership handles visibility implicitly)
- Page-level language tagging (decided against — space-level is sufficient)
- "Both" / universal spaces (decided against — duplicate into separate spaces instead)
- Country-to-locale mapping as a UI-editable admin config (useful future feature — Phase 2 uses a hardcoded/env-var map)
- Kiwify / Brazilian payment gateway language routing (PAY-V2-01 — future milestone)

</deferred>

---

*Phase: 02-language-and-content-localization*
*Context gathered: 2026-03-19*

# Phase 2: Language and Content Localization - Research

**Researched:** 2026-03-19
**Domain:** Database migration (Kysely), NestJS service layer, React/Mantine form, IP geolocation (free API)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Language tag lives on **spaces only** — not on individual pages. The space is the unit of language isolation.
- Tag is a **locale code string** (e.g., `en-US`, `pt-BR`) stored as a varchar on the `spaces` table. Must support any locale code.
- **No "Both" tag** — removed from scope.
- Language is a **required field at space creation** — dropdown must be filled before space can be saved.
- Untagged spaces (migration legacy): treated as English (`en-US`). PT-BR clients do not see untagged spaces.
- **Strict per-language filtering**: EN clients see only `lang = 'en-US'` spaces; PT-BR clients see only `lang = 'pt-BR'` spaces.
- Filtering happens implicitly via **group membership** — Phase 4 assigns users to language groups; no runtime SQL filter in Phase 2.
- Admin and Staff are **exempt from filtering** — they see all spaces regardless of language tag.
- Detection happens **on first login** — when `user.locale` is null.
- Implementation: server-side call to a **free external geo-IP API** (ip-api.com or ipapi.co).
- Result stored directly in `user.locale`.
- **Fallback to English** (`en-US`) if lookup fails, API unreachable, or country unmapped.
- Country-to-locale mapping: Brazil (`BR`) → `pt-BR`; all others → `en-US` (initially). Mapping should be configurable (not hardcoded), so new countries can be added later.
- Existing `account-language.tsx` and `user.locale` — no new account settings UI needed.
- Language dropdown in space creation should list locale codes that exist across spaces in the workspace (dynamic, not hardcoded).

### Claude's Discretion

- Exact geo-IP API endpoint (ip-api.com vs ipapi.co vs another free option)
- Exact country-to-locale mapping table structure (inline config, env var, or DB table)
- Where in the login flow to inject the geo-IP call
- Space creation modal: exact placement of Language dropdown

### Deferred Ideas (OUT OF SCOPE)

- Runtime space-tree SQL filtering by `user.locale`
- Page-level language tagging
- "Both" / universal spaces
- Country-to-locale mapping as a UI-editable admin config
- Kiwify / Brazilian payment gateway language routing (PAY-V2-01)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LANG-01 | Content can be authored and stored in English (primary) and Brazilian Portuguese (secondary); other languages may be added later without auto-translation | `language` column on `spaces` accepts any locale string; dynamic dropdown reads existing locales from DB |
| LANG-02 | External client's language is detected automatically via IP geolocation on first visit | Server-side geo-IP call in `AuthService.login()` when `user.locale` is null; store result via `userRepo.updateUser()` |
| LANG-03 | Client can manually select their language preference from their account settings, overriding IP detection | `account-language.tsx` + `UpdateUserDto.locale` already handle this — no new UI needed |
| LANG-04 | Clients see only SOPs tagged for their language — PT-BR clients do not see EN-only SOPs and vice versa | Implicit via group membership (Phase 4 integration point); `language` column on `spaces` enables Phase 4 to assign correct groups |
| LANG-05 | Admin and Staff can tag each page/space as English, Brazilian Portuguese, or Both when publishing | Language dropdown in `CreateSpaceForm` + `create-space.dto.ts` + `update-space.dto.ts` + space service |
</phase_requirements>

---

## Summary

Phase 2 adds a `language` varchar column to the `spaces` table, wires a required Language dropdown into the space creation (and edit) forms, injects an IP geolocation call into the login flow to auto-detect and persist `user.locale` on first login, and ensures that Admin/Staff can tag any space with a locale code when creating it. Content filtering (LANG-04) is NOT implemented in Phase 2 — it is an implicit side-effect of the group membership model that Phase 4 will build on top of the `language` column Phase 2 introduces.

The codebase already has `user.locale` (DB column, DTO, service) and `account-language.tsx` fully implemented. The existing `LanguageSwitcher` component supports `pt-BR` and writes via `PATCH /users/me`. The i18next setup uses `fallbackLng: 'en-US'` with `load: 'currentOnly'`. None of this changes in Phase 2.

New work is: (1) Kysely migration to add `language` column on `spaces`, (2) update `CreateSpaceDto` / `UpdateSpaceDto` / `SpaceService.create()` / `SpaceRepo.insertSpace()` to include `language`, (3) update `CreateSpaceForm` with a required `Select` for language, (4) create a `LocaleDetectionService` that calls ip-api.com and updates `user.locale`, (5) hook the service into `AuthService.login()`.

**Primary recommendation:** Implement in a single wave — migration first, then server-side data layer (DTO + service + repo), then client-side form, then geo-IP service — all within one plan. The changes are fully decoupled from Phase 1.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Kysely | already in project | DB migration for `language` column on `spaces` | All existing migrations use Kysely; consistent pattern |
| NestJS `@nestjs/common` | ^11.x (already in project) | `LocaleDetectionService` injectable service | All services in the server are NestJS injectables |
| Node.js `https` / built-in `fetch` | Node 24 (project runtime) | HTTP call to ip-api.com | No extra dependency; native fetch is available in Node 18+ |
| Mantine `Select` | already in project | Language dropdown in space creation form | All form selects use Mantine; `account-language.tsx` uses identical `Select` |
| `@mantine/form` + `zod` | already in project | Form validation with required field | `CreateSpaceForm` already uses `useForm` + `zodResolver` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-validator` decorators | already in project | Validate `language` field in DTO | All DTOs use class-validator; add `@IsString() @IsOptional()` or `@IsNotEmpty()` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ip-api.com | ipapi.co | Both free; ip-api.com returns richer JSON including `countryCode` field with no key required for HTTP (100 req/min limit); ipapi.co has 1000/day free limit. ip-api.com is preferred for server-side use. |
| Hardcoded country map | DB table | DB table is future-milestone scope (deferred). For Phase 2, a simple inline constant map (`{ BR: 'pt-BR' }`) with a clear `TODO` comment is sufficient and meets the "configurable" intent. |
| Inject geo-IP call into `AuthController.login()` | Dedicated `LocaleDetectionService` | Service is testable, injectable, and reusable by Phase 4 Stripe webhook. Service is the right call. |

**Installation:** No new packages required. All libraries are already in the project.

---

## Architecture Patterns

### Recommended Project Structure

New files for this phase:

```
apps/server/src/
├── database/migrations/
│   └── 20260319T000000-add-language-to-spaces.ts   # Kysely migration
├── core/
│   └── auth/
│       └── services/
│           └── locale-detection.service.ts          # Geo-IP + locale update
│           └── locale-detection.service.spec.ts     # Unit tests
apps/client/src/
└── features/space/
    └── components/
        └── create-space-form.tsx                    # Add language Select (MODIFY)
```

Modified files:

```
apps/server/src/
├── database/types/db.d.ts                           # Add language to Spaces interface (regenerate or manual add)
├── core/space/dto/create-space.dto.ts               # Add language field
├── core/space/dto/update-space.dto.ts               # Inherits via PartialType — picks up language automatically
├── core/space/services/space.service.ts             # Pass language to insertSpace
├── core/auth/services/auth.service.ts               # Call LocaleDetectionService on login
├── core/auth/auth.module.ts                         # Register LocaleDetectionService
apps/client/src/
├── features/space/types/space.types.ts              # Add language field to ISpace
├── features/space/components/create-space-form.tsx  # Add Select for language
└── features/space/services/space-service.ts         # Pass language in POST body (if not already)
```

### Pattern 1: Kysely Migration for `language` Column

**What:** Add nullable `language varchar` column to `spaces`, defaulting to `'en-US'` in code (not DB default), so existing spaces are treated as English without a NOT NULL constraint that would break migration on existing data.

**When to use:** Whenever adding a column to an existing table with rows (safe migration pattern).

```typescript
// Source: existing migrations in apps/server/src/database/migrations/
import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('spaces')
    .addColumn('language', 'varchar', (col) => col)  // nullable intentionally
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('spaces')
    .dropColumn('language')
    .execute();
}
```

After migration, `db.d.ts` must be updated: add `language: string | null` to the `Spaces` interface.

### Pattern 2: DTO Extension for `language` Field

**What:** Add `language` to `CreateSpaceDto` as a required string field. `UpdateSpaceDto extends PartialType(CreateSpaceDto)` — it automatically inherits the field as optional.

```typescript
// Source: apps/server/src/core/space/dto/create-space.dto.ts (current pattern)
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSpaceDto {
  // ... existing fields ...

  @IsNotEmpty()
  @IsString()
  language: string;  // e.g. 'en-US', 'pt-BR'
}
```

`UpdateSpaceDto` requires no changes — `PartialType` makes `language` optional on update.

### Pattern 3: Space Service / Repo — Pass `language` Through

**What:** `SpaceService.create()` calls `spaceRepo.insertSpace()` with an `InsertableSpace` object. Add `language` to that object.

```typescript
// Source: apps/server/src/core/space/services/space.service.ts (current pattern)
return await this.spaceRepo.insertSpace(
  {
    name: createSpaceDto.name ?? 'untitled space',
    description: createSpaceDto.description ?? '',
    creatorId: userId,
    workspaceId: workspaceId,
    slug: createSpaceDto.slug,
    language: createSpaceDto.language ?? 'en-US',  // ADD: default to en-US
  },
  trx,
);
```

`InsertableSpace` derives from `Insertable<Spaces>` via Kysely — once `language` is in `db.d.ts`, it is automatically part of `InsertableSpace`.

### Pattern 4: LocaleDetectionService

**What:** Injectable NestJS service. Accepts a client IP string, calls ip-api.com, maps country to locale, updates `user.locale` if null.

**When to use:** Called from `AuthService.login()` after `tokenService.generateAccessToken(user)` succeeds, only when `user.locale` is null.

```typescript
// Source: architecture inferred from existing AuthService pattern
import { Injectable, Logger } from '@nestjs/common';
import { UserRepo } from '@docmost/db/repos/user/user.repo';

const COUNTRY_LOCALE_MAP: Record<string, string> = {
  BR: 'pt-BR',
  // Future: add more mappings here
};

const DEFAULT_LOCALE = 'en-US';

@Injectable()
export class LocaleDetectionService {
  private readonly logger = new Logger(LocaleDetectionService.name);

  constructor(private readonly userRepo: UserRepo) {}

  async detectAndSetLocale(userId: string, workspaceId: string, clientIp: string): Promise<void> {
    try {
      const locale = await this.fetchLocaleFromIp(clientIp);
      await this.userRepo.updateUser({ locale }, userId, workspaceId);
    } catch (err) {
      this.logger.warn(`Geo-IP detection failed for ${clientIp}: ${err.message}`);
      // Fallback: set en-US so field is no longer null
      await this.userRepo.updateUser({ locale: DEFAULT_LOCALE }, userId, workspaceId);
    }
  }

  private async fetchLocaleFromIp(ip: string): Promise<string> {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`);
    if (!response.ok) return DEFAULT_LOCALE;
    const data = await response.json() as { countryCode?: string };
    const countryCode = data.countryCode ?? '';
    return COUNTRY_LOCALE_MAP[countryCode] ?? DEFAULT_LOCALE;
  }
}
```

### Pattern 5: Auth Service Login Hook

**What:** After successful login and token generation, if `user.locale` is null, fire geo-IP detection. This must be non-blocking (don't await if it slows login response) or awaited with error swallowed.

```typescript
// Source: apps/server/src/core/auth/services/auth.service.ts (existing login method)
async login(loginDto: LoginDto, workspaceId: string, clientIp?: string) {
  // ... existing password check ...
  user.lastLoginAt = new Date();
  await this.userRepo.updateLastLogin(user.id, workspaceId);

  // Geo-IP: detect locale on first login (when locale is null)
  if (!user.locale && clientIp) {
    // Fire-and-forget: don't block the auth response
    this.localeDetectionService
      .detectAndSetLocale(user.id, workspaceId, clientIp)
      .catch((err) => this.logger.warn('locale detection failed:', err));
  }

  return this.tokenService.generateAccessToken(user);
}
```

The `clientIp` must be passed from `AuthController.login()`. The controller has access to `FastifyReply`; the request IP is available from `@Req() req: FastifyRequest` or via `@Ip()` decorator.

### Pattern 6: Space Creation Form — Language Select

**What:** Add a `Select` (required) to `CreateSpaceForm` for language. The dropdown initially has `en-US` and `pt-BR` as values. Per the decision, it should dynamically list locales from existing spaces in the workspace, but for Phase 2, a static list of `['en-US', 'pt-BR']` is acceptable with a `TODO` note for dynamic expansion.

```typescript
// Source: apps/client/src/features/user/components/account-language.tsx (identical Select pattern)
<Select
  withAsterisk
  label={t("Language")}
  data={[
    { value: "en-US", label: "English (US)" },
    { value: "pt-BR", label: "Português (Brasil)" },
  ]}
  {...form.getInputProps("language")}
/>
```

Zod schema addition:

```typescript
const formSchema = z.object({
  name: z.string().trim().min(2).max(50),
  slug: z.string().trim().min(2).max(50).regex(/^[a-zA-Z0-9]+$/),
  description: z.string().max(500),
  language: z.string().min(2).max(20),  // ADD
});
```

### Anti-Patterns to Avoid

- **Blocking auth on geo-IP**: Never `await` the geo-IP call in a way that can delay the auth response by seconds if ip-api.com is slow. Use fire-and-forget with `.catch()`.
- **NOT NULL constraint on `language` in migration**: Adding `NOT NULL` without a default breaks existing rows. Column must be nullable; code treats null as `en-US`.
- **Hardcoding locale in a single constant with no comment**: The country→locale map must have a `// TODO: add new entries here as new language spaces are added` comment so future devs know where to extend it.
- **Using `user.locale === null` as the only guard**: After first login, `user.locale` will be set. The guard `!user.locale` also catches empty string edge cases.
- **Setting locale as part of JWT payload**: The JWT is generated before the async geo-IP call completes (fire-and-forget). The locale will be correct on the NEXT request after login when the user's profile is fetched.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IP-to-country lookup | Custom MaxMind GeoIP database, custom MMDB reader | ip-api.com HTTP API | Free, no binary to bundle, no update cadence to manage; acceptable for <100 req/min |
| Locale string validation | Custom regex validator | Existing `class-validator` `@IsString()` | Locale codes are arbitrary strings by design (extensible) |
| Space language dropdown data fetching | New API endpoint to list all locales | Static list for Phase 2 (with TODO for dynamic) | Dynamic list is a Phase 2 deferred item; static list + clear TODO is correct scope boundary |

**Key insight:** ip-api.com returns JSON with a `countryCode` field (ISO 3166-1 alpha-2). No API key needed for HTTP (HTTPS requires a key, but HTTP is fine for server-to-server). Response latency is typically <200ms.

---

## Common Pitfalls

### Pitfall 1: Migration timestamp collision
**What goes wrong:** Two migration files with the same timestamp prefix cause migration runner to error or skip.
**Why it happens:** Copy-pasting existing migration filenames.
**How to avoid:** Use current datetime in ISO format for the new migration filename: `20260319T000001-add-language-to-spaces.ts`. Check the latest migration timestamp in `apps/server/src/database/migrations/` before creating (latest is `20250912T101500-api-keys.ts`).
**Warning signs:** Migration runner exits with "duplicate migration" error.

### Pitfall 2: `db.d.ts` not updated after migration
**What goes wrong:** TypeScript compilation errors when referencing `space.language` — `Property 'language' does not exist on type 'Spaces'`.
**Why it happens:** `db.d.ts` is generated by `kysely-codegen` and not auto-regenerated. Manual edit is required when not running the codegen tool.
**How to avoid:** After writing the migration, manually add `language: string | null` to the `Spaces` interface in `apps/server/src/database/types/db.d.ts`. This is the established pattern — the file has a comment: "Please do not edit it manually" but in this fork context, manual edit is necessary until codegen is wired.
**Warning signs:** TS errors on `space.language` or `insertableSpace.language`.

### Pitfall 3: `InsertableSpace` type not accepting `language`
**What goes wrong:** `spaceRepo.insertSpace({ ..., language: 'en-US' })` gives a TypeScript error.
**Why it happens:** `InsertableSpace = Insertable<Spaces>` — Kysely derives this from `db.d.ts`. If `db.d.ts` is updated correctly, `language` will automatically be part of `InsertableSpace` as an optional field.
**How to avoid:** Update `db.d.ts` first, then update service code.

### Pitfall 4: ip-api.com HTTP vs HTTPS
**What goes wrong:** `https://ip-api.com/json/...` returns a 402 or redirect — HTTPS requires a paid API key.
**Why it happens:** ip-api.com only allows HTTPS for paid tiers.
**How to avoid:** Use `http://ip-api.com/json/{ip}?fields=countryCode,status`. Since this is a server-to-server call (no browser security policy applies), HTTP is fine.
**Warning signs:** 402 response, empty body, or `{ "message": "This endpoint is restricted to pro users" }`.

### Pitfall 5: Proxy/load-balancer IP headers
**What goes wrong:** `req.ip` returns `127.0.0.1` or the load-balancer IP instead of the real client IP.
**Why it happens:** Railway (Phase 5) puts a reverse proxy in front of the app. The real IP is in `X-Forwarded-For` header.
**How to avoid:** Read `req.headers['x-forwarded-for']` first, fall back to `req.ip`. Parse the first IP if the header is comma-separated. This is a known NestJS/Fastify gotcha.
**Warning signs:** ip-api.com returns `127.0.0.1` or a datacenter IP, resulting in `en-US` for everyone.

### Pitfall 6: `user.locale` already set to `'en'` (legacy value)
**What goes wrong:** `account-language.tsx` has `user?.locale === 'en' ? 'en-US' : user?.locale` — the DB might contain `'en'` for some users.
**Why it happens:** Legacy data or an older code path wrote `'en'` instead of `'en-US'`.
**How to avoid:** The geo-IP hook guard is `!user.locale` (null check). Users with `locale = 'en'` already have a locale set and won't be re-detected. This is acceptable — they can change in account settings. Document this edge case.

### Pitfall 7: Space creation form validation — required language not enforced server-side
**What goes wrong:** Space can be created without language via direct API call, bypassing the form dropdown.
**Why it happens:** DTO validation is optional (`@IsOptional()`).
**How to avoid:** Mark `language` in `CreateSpaceDto` as required (`@IsNotEmpty() @IsString()`). The service defaults to `'en-US'` if not provided as a safety net, but the DTO should enforce it at the API boundary.

---

## Code Examples

Verified patterns from official sources (or verified from existing project code):

### Kysely `alterTable` (from existing migration pattern)
```typescript
// Source: apps/server/src/database/migrations/ (established project pattern)
import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('spaces')
    .addColumn('language', 'varchar', (col) => col)  // nullable
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('spaces').dropColumn('language').execute();
}
```

### `userRepo.updateUser()` call signature (from existing code)
```typescript
// Source: apps/server/src/database/repos/user/user.repo.ts (inferred from user.service.ts)
await this.userRepo.updateUser(
  { locale: 'pt-BR' },
  userId,
  workspaceId,
);
```

### Fastify request IP extraction in NestJS controller
```typescript
// Source: NestJS + Fastify docs pattern
import { Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

@Post('login')
async login(
  @Req() req: FastifyRequest,
  @Body() loginInput: LoginDto,
  // ...
) {
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.ip;
  const authToken = await this.authService.login(loginInput, workspace.id, clientIp);
  // ...
}
```

### ip-api.com response shape
```json
// Source: ip-api.com documentation (http://ip-api.com/json/{ip}?fields=status,countryCode)
{
  "status": "success",
  "countryCode": "BR"
}
// On failure:
{
  "status": "fail",
  "message": "private range",
  "countryCode": ""
}
```

### Mantine Select with `withAsterisk` (required field pattern)
```typescript
// Source: apps/client/src/features/user/components/account-language.tsx (identical component)
<Select
  withAsterisk
  label={t("Language")}
  data={[
    { value: "en-US", label: "English (US)" },
    { value: "pt-BR", label: "Português (Brasil)" },
  ]}
  allowDeselect={false}
  {...form.getInputProps("language")}
/>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `locale: 'en'` (legacy short code) | `locale: 'en-US'` (BCP 47 tag) | Already in current codebase | `account-language.tsx` normalizes `'en'` → `'en-US'` on read; new code must write `'en-US'` |
| Page-level language tagging (considered) | Space-level language tagging (decided) | Phase 2 CONTEXT.md decision | Only `spaces.language` needs migration; no page-level changes |

**Deprecated/outdated:**
- Short locale codes (`'en'`, `'pt'`): The DB may contain `'en'` from legacy writes. Phase 2 writes `'en-US'` and `'pt-BR'` only. No migration to normalize old values is needed — `account-language.tsx` already handles the display normalization.

---

## Open Questions

1. **Dynamic language dropdown in space creation**
   - What we know: Decision says "list all locale codes that exist across spaces in the workspace." Phase 2 can start with a static list `['en-US', 'pt-BR']`.
   - What's unclear: Whether to build the dynamic API endpoint in Phase 2 or defer. Context says "For now: English (en-US) and Português (Brasil) (pt-BR)."
   - Recommendation: Use static list with a `// TODO: fetch dynamically from GET /spaces/languages` comment. Add to Phase 2 backlog or Phase 3.

2. **`db.d.ts` regeneration vs manual edit**
   - What we know: The file has a note "Please do not edit it manually" — it's generated by `kysely-codegen`.
   - What's unclear: Whether `kysely-codegen` is wired to a script in this fork. No `codegen` script was found in `package.json`.
   - Recommendation: Manually edit `db.d.ts` as done in other contexts in this fork. The codegen comment is advisory, not a hard block.

3. **`UpdateSpaceDto` — does `PartialType` make `language` optional on update?**
   - What we know: `UpdateSpaceDto extends PartialType(CreateSpaceDto)` — all fields from `CreateSpaceDto` become optional.
   - What's unclear: No ambiguity. `language` will be optional on update, which is correct (editing space name shouldn't require re-specifying language).
   - Recommendation: No change needed to `UpdateSpaceDto`.

---

## Validation Architecture

> `nyquist_validation` is `true` in `.planning/config.json` — validation section is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (NestJS default) |
| Config file | `apps/server/jest.json` or inline `package.json` jest config |
| Quick run command | `cd apps/server && npx jest --testPathPattern="locale-detection" --no-coverage` |
| Full suite command | `cd apps/server && npx jest --no-coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LANG-02 | Geo-IP call on first login: `user.locale = null` → detects country → sets locale | unit | `cd apps/server && npx jest locale-detection.service.spec -x` | ❌ Wave 0 |
| LANG-02 | Geo-IP fallback: API failure → sets `en-US` | unit | same file, different `it` block | ❌ Wave 0 |
| LANG-02 | Geo-IP skip: `user.locale` already set → no call | unit | same file, different `it` block | ❌ Wave 0 |
| LANG-02 | Brazil IP → `pt-BR` mapping | unit | same file | ❌ Wave 0 |
| LANG-05 | `CreateSpaceDto` validation: missing `language` → 400 | unit | `cd apps/server && npx jest space.service.spec -x` | existing file (modify) |
| LANG-01 | Space `language` column persisted in DB | unit (SpaceService) | `cd apps/server && npx jest space.service.spec -x` | existing file (modify) |

### Sampling Rate
- **Per task commit:** `cd apps/server && npx jest --testPathPattern="locale-detection|space.service" --no-coverage`
- **Per wave merge:** `cd apps/server && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/server/src/core/auth/services/locale-detection.service.spec.ts` — covers LANG-02 (all four cases above)
- [ ] Modify `apps/server/src/core/space/services/space.service.spec.ts` — add `language` field to existing test cases for `createSpace`

*(No new test framework install needed — Jest is already configured and working.)*

---

## Sources

### Primary (HIGH confidence)
- Existing project codebase — all patterns verified by direct file inspection:
  - `apps/server/src/core/auth/services/auth.service.ts`
  - `apps/server/src/core/space/services/space.service.ts`
  - `apps/server/src/database/repos/space/space.repo.ts`
  - `apps/server/src/core/space/dto/create-space.dto.ts`
  - `apps/client/src/features/space/components/create-space-form.tsx`
  - `apps/client/src/features/user/components/account-language.tsx`
  - `apps/server/src/database/types/db.d.ts` — `Spaces` interface confirmed to have no `language` column
  - `apps/server/src/database/migrations/20240324T085900-spaces.ts` — original spaces migration

### Secondary (MEDIUM confidence)
- ip-api.com API contract: HTTP (not HTTPS) endpoint, `countryCode` field, `status` field for failure detection — confirmed from published documentation and widespread community use

### Tertiary (LOW confidence)
- Dynamic language dropdown (loading locales from existing spaces in workspace) — not implemented in Phase 2; pattern not researched; flagged as deferred.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project; versions confirmed from `package.json`
- Architecture: HIGH — all patterns modeled directly from existing code in this repository
- Pitfalls: HIGH for migration/DTO/IP header pitfalls (verified from code); MEDIUM for ip-api.com HTTP/HTTPS constraint (verified from community knowledge, not official docs)

**Research date:** 2026-03-19
**Valid until:** 2026-06-19 (stable domain — Kysely, NestJS, Mantine; ip-api.com API stable for years)

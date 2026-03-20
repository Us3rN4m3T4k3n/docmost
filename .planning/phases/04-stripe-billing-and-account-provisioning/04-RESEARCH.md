# Phase 4: Stripe Billing and Account Provisioning - Research

**Researched:** 2026-03-20
**Domain:** Stripe webhooks, account provisioning, subscription lifecycle management, NestJS billing module
**Confidence:** HIGH — all findings verified directly against project source code

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Checkout Entry Point**
- Purchase starts from external site; no pricing page built in app
- Stripe handles checkout UI — we only handle post-payment webhook and redirect
- Brazilian clients purchase via Kiwify (same backend provisioning logic)
- Post-payment redirect: `/welcome` page in the React app — simple confirmation, no auth required

**Customer Portal**
- READER-role users see "Manage Subscription" in Account Settings
- Button calls `/api/billing/portal` → redirects to Stripe Customer Portal
- Kiwify subscriptions: no portal link

**Account Provisioning**
- Webhook creates user with no password set
- Sends welcome email with a one-time set-password link
- Use existing password-reset token mechanism (UserTokenType.FORGOT_PASSWORD)
- Display name = email prefix (before `@`)
- Duplicate email: reactivate existing account — clear `billingLockedAt`, re-add to space, link new subscription, send welcome-back email

**Welcome email content:** set-password magic link + portal URL, minimal

**Space + Subscription Mapping**
- Stripe → EN → `CLIENT_SPACE_ID` env var
- Kiwify → PT-BR → `KIWIFY_CLIENT_SPACE_ID` env var
- Space role: READER

**Payment Failure & Account Locking**
- Add `billingLockedAt timestamptz` column to users table (nullable)
- JWT strategy checks BOTH `suspendedAt` AND `billingLockedAt`
- Cancellation: remove from space + set `billingLockedAt = now()`
- Payment restored: clear `billingLockedAt = null` + re-add to space

**Subscription data storage**
- All Stripe data stays in existing `billing` table
- Link user via `stripe_customer_id` on billing table
- For Kiwify: add `kiwify_subscription_id` and `kiwify_customer_email` to billing table (planner decides: extend billing table OR separate `kiwify_billing` table)

**Webhook Architecture**
- Stripe: `POST /api/billing/stripe/webhook` (already wired — raw body OK)
- Kiwify: `POST /api/billing/kiwify/webhook`
- Both call shared `UserProvisioningService` with standard interface

**Webhook Idempotency**
- `stripe_webhook_events` dedup table with `event_id` (unique) + `processed_at`
- `kiwify_webhook_events` table with `order_id` as dedup key

**Admin Subscriber View**
- New "Subscribers" tab in existing admin settings panel
- Route: `/settings/subscribers` or `/settings/billing`
- Pattern: follow "Content Security" tab from Phase 3
- Columns: Email, Name, Gateway, Status, Stripe Customer link
- "Revoke Access" and "Restore Access" buttons

**Required New Env Vars**
```
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, CLIENT_SPACE_ID
KIWIFY_WEBHOOK_TOKEN, KIWIFY_CLIENT_SPACE_ID
APP_URL (already exists in EnvironmentService)
```

### Claude's Discretion

- Whether to extend existing `billing` table with Kiwify columns or create separate `kiwify_billing` table

### Deferred Ideas (OUT OF SCOPE)

- Kiwify Customer Portal
- Trial periods (BILL-V2-02)
- Per-seat pricing (BILL-V2-01)
- Automated refunds (BILL-V2-03)
- Zapier/ActiveCampaign integrations with Kiwify
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BILL-01 | Pricing/landing page where clients can start a Stripe Checkout session | External landing page (not in this app); `/welcome` redirect page needed; confirmed App.tsx has no `/welcome` route yet |
| BILL-02 | On `checkout.session.completed`, create user + add to client space as READER | `UserProvisioningService.provision()` using `insertUser()` + `insertSpaceMember()` + `UserTokenType.FORGOT_PASSWORD` token |
| BILL-03 | Welcome email sent after provisioning with login details | `mailService.sendToQueue()` pattern confirmed; `WelcomeEmail` template needed; `nanoIdGen(16)` for token |
| BILL-04 | On `customer.subscription.deleted`, revoke space access + lock account | `removeSpaceMemberById()` + set `billingLockedAt = now()` |
| BILL-05 | Webhook deduplication via idempotency table | New migration: `stripe_webhook_events` + `kiwify_webhook_events` tables |
| BILL-06 | Clients can access Stripe Customer Portal | `/api/billing/portal` endpoint + `stripe.billingPortal.sessions.create()` |
| BILL-07 | One account per purchase | Enforce in `provision()`: find-or-create, link by `stripe_customer_id` |
| BILL-08 | Payment failure → lock account until payment resolved | On `invoice.payment_failed`: set `billingLockedAt`; SuspendedUserMiddleware pattern for billingLockedAt check |
| BILL-09 | Payment retry succeeds → auto restore access | On `invoice.payment_succeeded`: clear `billingLockedAt`, re-add to space |
| ADMIN-01 | Admin view of active client subscribers with status | New `/settings/subscribers` page; query billing table joined with users |
| ADMIN-02 | Admin can manually grant/revoke client space access | POST `/api/billing/admin/revoke` + `/api/billing/admin/restore` calling `UserProvisioningService` |
| ADMIN-03 | Each subscriber links to Stripe customer record | `https://dashboard.stripe.com/customers/{stripe_customer_id}` in subscriber list |
</phase_requirements>

---

## Summary

The billing infrastructure is partially pre-built in this codebase. The `billing` table exists with all Stripe subscription fields. The Stripe webhook path (`/api/billing/stripe/webhook`) is already excluded from domain middleware and the raw body requirement is already satisfied (`rawBody: true` in NestFactory options with Fastify). The `stripe` npm package (v17.5.0) is already installed. Queue constants include `BILLING_QUEUE`, `WELCOME_EMAIL`, and `FIRST_PAYMENT_EMAIL`.

What is NOT yet built: the billing NestJS module/controller/service (no `src/core/billing/` or `src/integrations/billing/` directory exists), the `billingLockedAt` column on users, the deduplication tables, the Kiwify webhook endpoint, the `/welcome` client route, and the admin subscriber tab. The password-reset token mechanism (`UserTokenType.FORGOT_PASSWORD` via `userTokens` table) is the exact mechanism to reuse for the "set password" magic link on account creation.

**Primary recommendation:** Build a new `BillingModule` in `apps/server/src/core/billing/` following the SecurityModule pattern. Use the existing `spaceMemberRepo.insertSpaceMember()` and `userRepo.insertUser()` infrastructure. The SuspendedUserMiddleware in `core.module.ts` must be extended to also check `billingLockedAt`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | ^17.5.0 | Stripe Node.js SDK | Already installed; `constructEvent()` for webhook verification |
| @nestjs/bullmq | ^11.0.4 | Queue for async email dispatch | Already used for all async jobs |
| nestjs-kysely | current | DB queries via InjectKysely | All repos use this pattern |
| @react-email/components | current | Transactional email templates | Already used for all email templates |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid (customAlphabet) | current | Generate set-password tokens | `nanoIdGen(16)` — same as forgotPassword flow |
| @mantine/core | current | React UI for subscriber table | All settings pages use Mantine |

**Installation:** Nothing new to install — all dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure

New server module:
```
apps/server/src/core/billing/
├── billing.module.ts
├── billing.controller.ts        # /api/billing/* endpoints
├── services/
│   ├── billing.service.ts       # Stripe portal, billing queries
│   ├── stripe-webhook.service.ts
│   ├── kiwify-webhook.service.ts
│   └── user-provisioning.service.ts   # Shared: provision/revoke/lock/unlock
├── dto/
│   └── ...
└── billing.constants.ts         # gateway enum, event type constants
```

New client page:
```
apps/client/src/pages/settings/subscribers.tsx        # Admin subscriber table
apps/client/src/pages/billing-success.tsx             # /welcome public page
```

New migrations:
```
apps/server/src/database/migrations/
├── YYYYMMDDTHHMMSS-add-billing-locked-at.ts
├── YYYYMMDDTHHMMSS-create-webhook-event-tables.ts
└── YYYYMMDDTHHMMSS-add-kiwify-billing-columns.ts     # or separate table
```

### Pattern 1: NestJS Module Registration

Follow SecurityModule pattern — register in `app.module.ts`:

```typescript
// Source: apps/server/src/app.module.ts (existing pattern)
import { BillingModule } from './core/billing/billing.module';

@Module({
  imports: [
    // ...existing modules
    BillingModule,
  ],
})
export class AppModule {}
```

### Pattern 2: Webhook Controller (Raw Body Already Available)

`main.ts` already has `rawBody: true` in NestFactory options and `Fastify` adapter. The `/api/billing/stripe/webhook` path is already excluded from `DomainMiddleware` in `core.module.ts`. The controller can access the raw body for Stripe signature verification.

```typescript
// Source: apps/server/src/main.ts — rawBody already enabled
app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({ ... }),
  { rawBody: true }
);
```

The Stripe webhook endpoint path is already in the exclusion lists:
- `core.module.ts` DomainMiddleware exclude: `billing/stripe/webhook`
- `main.ts` preHandler exclusions: `/api/billing/stripe/webhook`

The Kiwify webhook endpoint `/api/billing/kiwify/webhook` needs to be added to both exclusion lists.

### Pattern 3: Password-Reset Token as Set-Password Magic Link

```typescript
// Source: apps/server/src/core/auth/services/auth.service.ts
const token = nanoIdGen(16);
const resetLink = `${this.domainService.getUrl(workspace.hostname)}/password-reset?token=${token}`;
await this.userTokenRepo.insertUserToken({
  token,
  userId: user.id,
  workspaceId: user.workspaceId,
  expiresAt: new Date(new Date().getTime() + 60 * 60 * 1000), // 1 hour
  type: UserTokenType.FORGOT_PASSWORD,
});
```

For account provisioning, use the same `FORGOT_PASSWORD` token type. The existing `/password-reset` route on the client already validates this token. The provisioned user has no password (`password: null`) — the set-password link is their first-login mechanism.

**IMPORTANT:** `userRepo.insertUser()` calls `hashPassword(insertableUser.password)` unconditionally. For provisioned users (no password), either pass an empty string and immediately nullify, or bypass `insertUser()` and use direct DB insert.

Checking `user.repo.ts` line 118: `password: await hashPassword(insertableUser.password)` — if `insertableUser.password` is undefined/null, `hashPassword(undefined)` likely throws or produces a bcrypt hash of an empty string. The provisioning service must handle this carefully — recommend direct Kysely insert rather than `userRepo.insertUser()` to set `password: null`.

### Pattern 4: Space Member Add (Direct Service Call)

```typescript
// Source: apps/server/src/core/space/services/space-member.service.ts
await this.spaceMemberRepo.insertSpaceMember({
  userId: userId,
  spaceId: spaceId,
  role: SpaceRole.READER,  // 'reader'
});
```

`SpaceRole.READER = 'reader'` — confirmed in `apps/server/src/common/helpers/types/permission.ts`.

### Pattern 5: Remove Space Member (for Revoke)

```typescript
// Source: apps/server/src/core/space/services/space-member.service.ts
const spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
  spaceId, { userId: userId }
);
if (spaceMember) {
  await this.spaceMemberRepo.removeSpaceMemberById(spaceMember.id, spaceId);
}
```

### Pattern 6: BillingLockedAt Check (Extend SuspendedUserMiddleware)

```typescript
// Source: apps/server/src/common/middlewares/suspended-user.middleware.ts (pattern to extend)
const dbUser = await this.db
  .selectFrom('users')
  .select(['suspendedAt', 'suspensionReason', 'billingLockedAt'])  // ADD THIS
  .where('id', '=', user.id)
  .executeTakeFirst();

if (dbUser?.suspendedAt || dbUser?.billingLockedAt) {  // CHECK BOTH
  throw new ForbiddenException({
    message: dbUser?.billingLockedAt ? 'Billing Payment Failed' : 'Account Suspended',
    error: dbUser?.billingLockedAt ? 'BillingLocked' : 'AccountSuspended',
    statusCode: 403,
  });
}
```

Also update `suspended-user.guard.ts` with same logic.

### Pattern 7: Admin Role Check Pattern

```typescript
// Source: apps/server/src/integrations/security/screenshot-detection.controller.ts
if (user.role !== 'admin' && user.role !== 'owner') {
  throw new ForbiddenException();
}
```

No dedicated admin guard class exists — use inline role check as per project pattern.

### Pattern 8: Email Template

```typescript
// Source: apps/server/src/integrations/transactional/emails/forgot-password-email.tsx (pattern)
import { Button, Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import { button, content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';

export const WelcomeEmail = ({ username, setPasswordLink, appUrl }: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi {username},</Text>
        <Text style={paragraph}>Your account has been created. Click below to set your password and log in.</Text>
        <Button href={setPasswordLink} style={button}>Set Password & Log In</Button>
      </Section>
    </MailBody>
  );
};
```

Send via `mailService.sendToQueue()` — same as forgotPassword flow.

### Pattern 9: Settings Admin Tab

```typescript
// Source: apps/client/src/components/settings/settings-sidebar.tsx (groupedData)
// Add to "Workspace" group items:
{
  label: "Subscribers",
  icon: IconUsers,  // or IconCreditCard
  path: "/settings/subscribers",
  isAdmin: true,    // only admins see it
},
```

Then in `App.tsx`, add:
```tsx
<Route path={"subscribers"} element={<Subscribers />} />
```

`isCloud: true` is NOT needed here — the `canShowItem` logic for `isAdmin: true` with no `isCloud` shows to all admins regardless of cloud mode.

### Anti-Patterns to Avoid

- **Using `userRepo.insertUser()` for provisioned users:** It always calls `hashPassword()`. Provisioned users need `password: null`. Use direct Kysely insert.
- **Registering Kiwify webhook path only in main.ts:** Also add to `core.module.ts` DomainMiddleware and SuspendedUserMiddleware exclusions.
- **Calling `spaceMemberRepo.insertSpaceMember()` without checking for existing membership:** The batch method has duplicate-prevention logic; the single-insert does not. Check existence first for the re-activation case.
- **Storing `billingLockedAt` on the billing table:** The decision is to store it on the users table. This is separate from the subscription data on the billing table.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stripe signature verification | Custom HMAC logic | `stripe.webhooks.constructEvent(rawBody, sig, secret)` | Handles timing attacks, encoding edge cases |
| Email sending + rendering | Custom HTML builder | `mailService.sendToQueue()` + React Email component | Queue retry, render, existing SMTP/Postmark drivers |
| Set-password link token | Custom token generation | `nanoIdGen(16)` + `userTokens` table + `UserTokenType.FORGOT_PASSWORD` | Expiry, single-use semantics, existing UI already handles it |
| Space membership deduplication | Custom SQL | Check via `getSpaceMemberByTypeId()` before insert | Existing method handles userId/groupId lookup |
| Password hashing | bcrypt directly | `hashPassword()` from common helpers | Already wraps bcrypt consistently |

---

## Common Pitfalls

### Pitfall 1: Raw Body Lost Before Stripe Verification
**What goes wrong:** Stripe's `constructEvent()` requires the exact raw bytes of the request body. If the body is parsed as JSON first, the signature will not match.
**Why it happens:** NestJS parses bodies by default; most interceptors/pipes touch the body.
**How to avoid:** The `rawBody: true` in `main.ts` Fastify options already buffers the raw body. In the Stripe webhook controller method, access `req.rawBody` (the raw Buffer) rather than `@Body()`. With Fastify, use `@Req() req: FastifyRequest` and read `req.rawBody`.
**Warning signs:** Stripe throws `No signatures found matching the expected signature for payload` — always a raw body problem.

### Pitfall 2: `userRepo.insertUser()` Hashes Null Password
**What goes wrong:** `insertUser()` unconditionally calls `await hashPassword(insertableUser.password)`. If password is `undefined`, bcrypt may hash an empty string, creating a non-null password hash on a supposedly passwordless account.
**How to avoid:** For provisioned users, do a direct Kysely insert bypassing `insertUser()`:
```typescript
await this.db.insertInto('users').values({
  email: email.toLowerCase(),
  name: name,
  password: null,
  workspaceId: workspaceId,
  role: UserRole.MEMBER,
  locale: 'en-US',
}).returningAll().executeTakeFirst();
```
**Warning signs:** Provisioned user can log in without going through set-password flow.

### Pitfall 3: Kiwify Webhook Path Not Excluded from Middleware
**What goes wrong:** `DomainMiddleware` requires `workspaceId` on request. Kiwify POSTs have no domain header or workspaceId — request will 404 before reaching the controller.
**How to avoid:** Add `{ path: 'billing/kiwify/webhook', method: RequestMethod.POST }` to the DomainMiddleware exclusion list in `core.module.ts`. Also add `/api/billing/kiwify/webhook` to main.ts preHandler exclusions.
**Warning signs:** Kiwify webhook returns 404 or `Workspace not found` in Railway logs.

### Pitfall 4: `billingLockedAt` Field Not in db.d.ts After Migration
**What goes wrong:** The `db.d.ts` file is auto-generated by `kysely-codegen`. If the migration runs but codegen is not re-run, TypeScript types will be stale — `users.billingLockedAt` will be a type error.
**How to avoid:** After adding the migration, run `npx kysely-codegen` (or whatever command regenerates `db.d.ts`). Alternatively, manually add the field to the `Users` interface in `db.d.ts`.
**Warning signs:** TypeScript error `Property 'billingLockedAt' does not exist on type 'Users'`.

### Pitfall 5: Stripe Event Already Processed (Idempotency)
**What goes wrong:** Stripe retries webhooks on 5xx or timeout. Without dedup, `checkout.session.completed` fires twice → two accounts for the same customer.
**How to avoid:** Before processing any event, check `stripe_webhook_events` table for `event_id`. If found, return 200 immediately. If not found, insert and then process.
**Warning signs:** Duplicate user accounts or duplicate billing records in production.

### Pitfall 6: Re-activation Race Condition
**What goes wrong:** If a user re-subscribes and the webhook fires while their old `spaceMembers` record is being deleted (concurrent revoke + provision), the insert may succeed but then the delete removes it.
**How to avoid:** Use Kysely transactions (`executeTx`) for the provision and revoke operations.

### Pitfall 7: `isCloud()` Gate on Billing Tab in App.tsx
**What goes wrong:** The existing `<Route path={"billing"} element={<Billing />} />` is wrapped in `{isCloud() && ...}`. The new Subscribers route must NOT be gated on `isCloud()` — this is a self-hosted instance.
**How to avoid:** Add the `subscribers` route outside any `isCloud()` conditional. The sidebar item uses `isAdmin: true` (no `isCloud: true`) — confirm the route registration matches.

---

## Code Examples

### Stripe Webhook Event Construction (Fastify)

```typescript
// Source: stripe docs + Fastify rawBody pattern
@Post('stripe/webhook')
@HttpCode(HttpStatus.OK)
async stripeWebhook(@Req() req: any, @Headers('stripe-signature') sig: string) {
  let event: Stripe.Event;
  try {
    event = this.stripe.webhooks.constructEvent(
      req.rawBody,          // Buffer — NOT req.body
      sig,
      this.environmentService.getStripeWebhookSecret(),
    );
  } catch (err) {
    throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
  }
  await this.stripeWebhookService.handle(event);
}
```

### Kiwify Token Verification

```typescript
// Source: CONTEXT.md specification
if (payload.token !== this.environmentService.getKiwifyWebhookToken()) {
  throw new UnauthorizedException('Invalid Kiwify webhook token');
}
```

### UserTokenRepo Insert (Set-Password Token)

```typescript
// Source: apps/server/src/core/auth/services/auth.service.ts
const token = nanoIdGen(16);
await this.userTokenRepo.insertUserToken({
  token,
  userId: user.id,
  workspaceId: workspaceId,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h for welcome links
  type: UserTokenType.FORGOT_PASSWORD,
});
const setPasswordLink = `${this.environmentService.getAppUrl()}/password-reset?token=${token}`;
```

### Billing Table Query for Subscriber List

```typescript
// Pattern based on existing Kysely repo patterns
const subscribers = await this.db
  .selectFrom('billing')
  .innerJoin('users', 'users.id', /* linked via stripe_customer_id lookup */)
  .select([
    'users.id',
    'users.email',
    'users.name',
    'users.billingLockedAt',
    'billing.stripeCustomerId',
    'billing.status',
    'billing.stripeSubscriptionId',
  ])
  .where('billing.workspaceId', '=', workspaceId)
  .execute();
```

Note: The billing table links to `workspaceId`, not directly to `userId`. The `stripe_customer_id` is on both the billing table and will need to be findable from the user. The provisioning service should store `stripe_customer_id` on the billing record when creating it. Consider whether to also denormalize it to the user record for easy lookup — or keep the join through billing. Based on CONTEXT.md: "Link user to billing record via `stripe_customer_id` stored on billing table."

---

## Existing Infrastructure Audit

### What Already Exists (Use Directly)

| Item | Location | Notes |
|------|----------|-------|
| `billing` table | `20250106T195516-billing.ts` + `20250623T215045-more-billing-columns.ts` | Has all Stripe fields; `workspaceId` FK; no `userId` column yet — link via `stripeCustomerId` |
| `stripe` npm package v17.5.0 | `apps/server/package.json` | Already installed |
| Raw body support | `apps/server/src/main.ts` | `rawBody: true` in NestFactory |
| Stripe webhook path exclusion | `main.ts` + `core.module.ts` | Already excluded from domain middleware |
| `BILLING_QUEUE` | `queue.constants.ts` | Already registered in `QueueModule` |
| `WELCOME_EMAIL`, `FIRST_PAYMENT_EMAIL` | `queue.constants.ts` | Job names defined, no processor yet |
| `UserTokenType.FORGOT_PASSWORD` | `auth.constants.ts` | Reuse for set-password magic link |
| `nanoIdGen(16)` | `common/helpers/nanoid.utils.ts` | Token generation utility |
| `userTokenRepo` | `repos/user-token/user-token.repo.ts` | Full CRUD for tokens |
| `spaceMemberRepo.insertSpaceMember()` | `repos/space/space-member.repo.ts` | Add to space |
| `spaceMemberRepo.getSpaceMemberByTypeId()` | same | Existence check before insert |
| `spaceMemberRepo.removeSpaceMemberById()` | same | Remove from space |
| `userRepo.findByEmail()` | `repos/user/user.repo.ts` | Case-insensitive lookup |
| `userRepo.updateUser()` | same | Update `billingLockedAt` |
| `SpaceRole.READER` | `common/helpers/types/permission.ts` | `'reader'` enum value |
| `mailService.sendToQueue()` | `integrations/mail/mail.service.ts` | Async email send |
| `EnvironmentService.getStripeSecretKey/WebhookSecret` | `environment.service.ts` | Already implemented |
| `EnvironmentService.getAppUrl()` | same | For set-password link generation |
| `DomainService.getUrl()` | used in auth.service.ts | Gets workspace URL |
| `suspendedAt` on Users | `db.d.ts` Users interface | Phase 3 added — confirmed present |
| `SuspendedUserMiddleware` | `common/middlewares/suspended-user.middleware.ts` | Extend to also check `billingLockedAt` |
| `SuspendedUserGuard` | `common/guards/suspended-user.guard.ts` | Same extension needed |
| Billing client-side service | `ee/billing/services/billing-service.ts` | Has `getBillingPortalLink()` calling `/billing/portal` — reusable |
| Settings sidebar | `components/settings/settings-sidebar.tsx` | Add "Subscribers" item (no `isCloud` gate needed) |

### What Needs to Be Built (Gaps)

| Item | Gap Type | Notes |
|------|----------|-------|
| `BillingModule` + controller + services | New NestJS module | No `billing/` module exists anywhere in `src/core/` or `src/integrations/` |
| `billingLockedAt timestamptz` on users | New migration | Also update `db.d.ts` |
| `stripe_webhook_events` table | New migration | `event_id` unique + `processed_at` |
| `kiwify_webhook_events` table | New migration | `order_id` unique + `processed_at` |
| Kiwify billing storage | New migration | Extend `billing` table OR create `kiwify_billing` table |
| `UserProvisioningService` | New service | shared provision/revoke/lock/unlock |
| `WelcomeEmail` template | New email template | In `integrations/transactional/emails/` |
| `/welcome` route in App.tsx | New client route | Public, no auth, simple confirmation page |
| `/settings/subscribers` page | New client page | Admin-only table, follows ContentSecurity pattern |
| Kiwify webhook endpoint + service | New controller + service | `POST /api/billing/kiwify/webhook` |
| `EnvironmentService` additions | Extension | Add `getClientSpaceId()`, `getKiwifyWebhookToken()`, `getKiwifyClientSpaceId()` |
| Extend `SuspendedUserMiddleware` | Modification | Add `billingLockedAt` check |
| Extend `SuspendedUserGuard` | Modification | Same `billingLockedAt` check |
| Add Kiwify webhook to exclusion lists | Modification | `main.ts` + `core.module.ts` |
| Billing route in App.tsx | Modification | Add `subscribers` route outside `isCloud()` gate |

### Kiwify: Separate Table vs Extend Billing Table

**Recommendation: Extend existing `billing` table with nullable Kiwify columns.**

Rationale: The billing table's `stripe_subscription_id` is NOT NULL — this is a constraint problem. Adding `kiwify_subscription_id` as an alternative FK means we cannot satisfy both `stripe_subscription_id NOT NULL` and a Kiwify record. The cleanest approach is a separate `kiwify_billing` table with its own schema, similar to the billing table structure but with Kiwify-specific columns. This avoids wrestling with NOT NULL constraints and keeps the data models clean.

`kiwify_billing` table columns:
- `id` (uuid, pk)
- `kiwify_order_id` varchar not null unique
- `kiwify_subscription_id` varchar
- `kiwify_customer_email` varchar not null
- `user_id` uuid (FK to users.id, nullable — before provisioning)
- `status` varchar not null
- `workspace_id` uuid FK
- `created_at`, `updated_at`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Express raw body middleware | Fastify `rawBody: true` option | This codebase uses Fastify | Must use `req.rawBody` not `req.body` for Stripe |
| `@nestjs/bull` | `@nestjs/bullmq` | Codebase already on bullmq | Use `@InjectQueue` from `@nestjs/bullmq`, `WorkerHost` from `@nestjs/bullmq` |
| Stripe v14 `Stripe.Event` | Stripe v17 same interface | Minor — same webhook API | `stripe.webhooks.constructEvent()` signature unchanged |

---

## Open Questions

1. **How to link billing record to user**
   - What we know: `billing` table has `workspaceId` and `stripeCustomerId`, but no `userId` column
   - What's unclear: The admin subscriber view needs to join billing records to users — currently no direct FK
   - Recommendation: During provisioning, store `stripeCustomerId` on the billing record. For subscriber list query, join `users` to `billing` via `stripeCustomerId`. For Kiwify, use `kiwify_customer_email` to join to `users.email`.

2. **Token expiry for welcome set-password link**
   - What we know: Forgot-password tokens expire in 1 hour
   - What's unclear: 1 hour may be too short if the user doesn't check email immediately
   - Recommendation: Use 24 hours for the welcome/provisioning link, since it's the user's first login and email may sit unread.

3. **`userRepo.insertUser()` password null handling**
   - What we know: `insertUser()` calls `hashPassword(password)` unconditionally
   - What's unclear: What happens when `password` is `undefined` — does `hashPassword(undefined)` throw or produce garbage?
   - Recommendation: Do a direct `db.insertInto('users')` for provisioned users to explicitly set `password: null`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (client) + Jest/NestJS Test (server) |
| Config file | `apps/client/vite.config.ts` (vitest config embedded) |
| Quick run command | `cd apps/client && npx vitest run --reporter=verbose` |
| Full suite command | `cd apps/client && npx vitest run && cd ../server && npx jest --passWithNoTests` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-02 | `UserProvisioningService.provision()` creates user, adds to space, sends email | unit | `npx jest apps/server/src/core/billing/services/user-provisioning.service.spec.ts` | ❌ Wave 0 |
| BILL-04 | `UserProvisioningService.revoke()` removes space member + sets `billingLockedAt` | unit | same file | ❌ Wave 0 |
| BILL-05 | Stripe event dedup — second call with same `event_id` is skipped | unit | `npx jest apps/server/src/core/billing/services/stripe-webhook.service.spec.ts` | ❌ Wave 0 |
| BILL-08 | `billingLockedAt` blocks login — `SuspendedUserMiddleware` rejects with 403 | unit | `npx jest apps/server/src/common/middlewares/suspended-user.middleware.spec.ts` | ❌ Wave 0 |
| BILL-09 | `UserProvisioningService.unlock()` clears `billingLockedAt` + re-adds space | unit | same as BILL-02 spec | ❌ Wave 0 |
| ADMIN-01 | Subscribers page renders table rows for admin user, returns null for non-admin | unit (vitest) | `cd apps/client && npx vitest run src/pages/settings/subscribers.test.tsx` | ❌ Wave 0 |
| ADMIN-02 | Revoke/restore buttons call correct API endpoints | unit (vitest) | same file | ❌ Wave 0 |
| BILL-03 | Welcome email template renders set-password link | unit | manual-only (email preview) | N/A |
| BILL-06 | Portal endpoint returns URL from Stripe | manual-only | Stripe test mode required | N/A |

### Sampling Rate
- **Per task commit:** `cd apps/client && npx vitest run --reporter=verbose` (client tests only, fast)
- **Per wave merge:** `cd apps/client && npx vitest run && cd apps/server && npx jest --testPathPattern=billing --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/server/src/core/billing/services/user-provisioning.service.spec.ts` — covers BILL-02, BILL-04, BILL-09
- [ ] `apps/server/src/core/billing/services/stripe-webhook.service.spec.ts` — covers BILL-05
- [ ] `apps/server/src/common/middlewares/suspended-user.middleware.spec.ts` — covers BILL-08 (extended billingLockedAt check)
- [ ] `apps/client/src/pages/settings/subscribers.test.tsx` — covers ADMIN-01, ADMIN-02; follow `content-security.test.tsx` mock patterns exactly (Mantine sub-components, useUserRole, api-client)

---

## Sources

### Primary (HIGH confidence)
- Direct read of `apps/server/src/database/migrations/20250106T195516-billing.ts` — confirmed billing table schema
- Direct read of `apps/server/src/database/migrations/20250623T215045-more-billing-columns.ts` — confirmed additional columns
- Direct read of `apps/server/src/database/types/db.d.ts` — confirmed all table interfaces including `suspendedAt` on Users, no `billingLockedAt` yet, no `stripeWebhookEvents` table
- Direct read of `apps/server/src/main.ts` — confirmed `rawBody: true`, Fastify adapter, webhook path exclusions
- Direct read of `apps/server/src/core/core.module.ts` — confirmed DomainMiddleware exclusion for `billing/stripe/webhook`
- Direct read of `apps/server/src/core/auth/services/auth.service.ts` — confirmed `forgotPassword()` token flow (exact pattern to reuse)
- Direct read of `apps/server/src/database/repos/space/space-member.repo.ts` — confirmed `insertSpaceMember()`, `removeSpaceMemberById()`, `getSpaceMemberByTypeId()`
- Direct read of `apps/server/src/common/helpers/types/permission.ts` — confirmed `SpaceRole.READER = 'reader'`
- Direct read of `apps/server/src/integrations/queue/constants/queue.constants.ts` — confirmed `BILLING_QUEUE`, `WELCOME_EMAIL`, `FIRST_PAYMENT_EMAIL` exist
- Direct read of `apps/server/src/integrations/queue/queue.module.ts` — confirmed `BILLING_QUEUE` registered; uses `@nestjs/bullmq`
- Direct read of `apps/server/src/integrations/mail/mail.service.ts` — confirmed `sendToQueue()` pattern
- Direct read of `apps/server/src/integrations/environment/environment.service.ts` — confirmed `getStripeSecretKey()`, `getStripeWebhookSecret()` already implemented
- Direct read of `apps/client/src/App.tsx` — confirmed no `/welcome` route exists; billing route is `isCloud()` gated
- Direct read of `apps/client/src/components/settings/settings-sidebar.tsx` — confirmed "Content Security" uses `isAdmin: true` (no `isCloud`) — same pattern for Subscribers
- Direct read of `apps/client/src/pages/settings/content-security.tsx` — confirmed admin tab pattern (table, Mantine, useUserRole, api calls)
- Direct read of `apps/client/src/pages/settings/content-security.test.tsx` — confirmed Vitest mock patterns for Mantine, useUserRole, api-client
- Direct read of `apps/server/package.json` grep — confirmed `stripe: ^17.5.0` already installed

### Secondary (MEDIUM confidence)
- `apps/server/src/core/auth/auth.constants.ts` — only one token type exists (`FORGOT_PASSWORD`); no `SET_PASSWORD` type. Recommendation to reuse `FORGOT_PASSWORD` for provisioning is sound.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages verified directly from package.json and source
- Architecture: HIGH — all patterns verified from live source code
- Pitfalls: HIGH — derived from direct code reading (e.g., `hashPassword` issue observed directly in `user.repo.ts`)
- Gap list: HIGH — confirmed by directory listing (no billing module exists)

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable codebase, no fast-moving dependencies)

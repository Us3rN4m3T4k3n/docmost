# Technology Stack — Additive Research

**Project:** Agency SOP Platform (Docmost Fork)
**Researched:** 2026-03-19
**Scope:** New capabilities only — content protection, Stripe billing, Railway deployment
**Note on sources:** External fetch tools were unavailable in this session. All findings are from training data (cutoff August 2025). Confidence levels reflect this constraint. Stripe's API and browser content-protection APIs are highly stable; Railway's build system matured in 2023-2024. Recommend verifying version numbers against npm before installing.

---

## 1. Client-Side Content Protection (React)

### Approach: Native Browser APIs — No Library Needed

**Confidence: HIGH**

There is no authoritative third-party library for content protection in React as of 2025. The ecosystem has repeatedly produced abandoned packages (`react-copy-to-clipboard` etc.) that go the opposite direction. The correct approach for _preventing_ copy/print/screenshot is direct browser API usage wrapped in a React hook. This is what every production implementation uses.

### Recommended Implementation

#### CSS Layer (zero-JS overhead for most cases)

```css
/* Apply to the protected content container */
.protected-content {
  user-select: none;          /* disables text selection in all modern browsers */
  -webkit-user-select: none;  /* Safari */
}

@media print {
  .protected-content {
    display: none !important; /* blocks print entirely */
  }
  .print-blocked-message {
    display: block !important;
  }
}
```

**Why:** `user-select: none` is supported in all modern browsers with no prefixes needed except `-webkit-` for Safari. It is the first line of defense and requires no JS.

#### JavaScript Event Blocking (React hook)

```typescript
// useContentProtection.ts
export function useContentProtection(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const blockEvent = (e: Event) => e.preventDefault();
    const blockKey = (e: KeyboardEvent) => {
      // Block Ctrl+C, Ctrl+A, Ctrl+P, Ctrl+S, F12 (DevTools)
      if (e.ctrlKey && ['c', 'a', 'p', 's', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
      }
      if (e.key === 'PrintScreen') {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', blockEvent);
    document.addEventListener('copy', blockEvent);
    document.addEventListener('cut', blockEvent);
    document.addEventListener('keydown', blockKey);
    window.addEventListener('beforeprint', blockEvent);

    return () => {
      document.removeEventListener('contextmenu', blockEvent);
      document.removeEventListener('copy', blockEvent);
      document.removeEventListener('cut', blockEvent);
      document.removeEventListener('keydown', blockKey);
      window.removeEventListener('beforeprint', blockEvent);
    };
  }, [enabled]);
}
```

**Why `beforeprint` not `@media print`:** `beforeprint` fires before the print dialog opens and can cancel it via `preventDefault()`. The CSS `@media print` rule is a belt-and-suspenders fallback in case JS is disabled.

#### Dynamic Watermark (CSS pseudo-element approach)

```typescript
// Watermark via CSS custom property — injected via inline style
// No library needed. Renders as a repeating diagonal overlay.
const watermarkStyle = {
  '--watermark-text': `"${userEmail}"`,
  position: 'relative',
} as React.CSSProperties;

// In CSS:
// .watermarked::after {
//   content: var(--watermark-text);
//   position: fixed; top: 0; left: 0; right: 0; bottom: 0;
//   opacity: 0.08;
//   font-size: 24px;
//   color: #000;
//   transform: rotate(-30deg);
//   pointer-events: none;
//   z-index: 9999;
//   white-space: nowrap;
//   overflow: hidden;
//   display: flex; align-items: center; justify-content: center;
// }
```

**Why CSS pseudo-element:** Canvas-based watermarks can be blocked by ad blockers. SVG backgrounds are inspectable. CSS `::after` with `pointer-events: none` and a fixed position is the most resilient approach that also survives TipTap's own DOM manipulation.

### Screenshot Prevention: Acknowledged Limitation

**Confidence: HIGH (that no JS solution works)**

Browser JS cannot prevent OS-level screenshots (`Cmd+Shift+3`, `PrtSc`, Windows Snipping Tool). The Screen Capture API (`getDisplayMedia`) can detect screen-sharing sessions but cannot block them. The watermark is the correct mitigation: it makes every screenshot traceable to the individual client account.

**Do NOT use:** Any npm package claiming screenshot prevention (e.g., `react-screenshot-prevent`) — these are ineffective and often unmaintained.

### What NOT to Use

| Approach | Why Not |
|----------|---------|
| `html2canvas` blocking | Wrong direction — this enables screenshots |
| DevTools detection libraries | Unreliable, causes false positives, breaks legitimate users |
| Iframe sandboxing for content | Breaks TipTap's collaborative editor entirely |
| `document.execCommand('copy')` interception | Deprecated API, unreliable cross-browser |
| `MutationObserver` to detect DOM extraction | High CPU cost, easily bypassed |

---

## 2. Stripe Subscription Integration (NestJS)

### Recommended Package: `stripe` (official) — No NestJS wrapper

**Version:** `stripe` ^17.x (latest stable as of mid-2025; verify on npm)
**Confidence: HIGH for approach, MEDIUM for exact version**

**Why not `nestjs-stripe`:** The community package `nestjs-stripe` wraps the official SDK but adds an abstraction layer that lags behind Stripe's frequent SDK updates. Stripe's official Node.js SDK is extremely well-designed for direct use. NestJS DI is satisfied by wrapping it in a simple `@Injectable()` service — no wrapper needed.

### Installation

```bash
pnpm add stripe
pnpm add -D @types/stripe  # only needed if stripe package doesn't ship types
```

Note: The official `stripe` npm package ships its own TypeScript types since v12. No `@types/stripe` needed.

### Architecture Pattern: Stripe Service + Webhook Guard

```typescript
// stripe/stripe.module.ts
@Module({
  providers: [StripeService, StripeWebhookGuard],
  exports: [StripeService],
})
export class StripeModule {}

// stripe/stripe.service.ts
@Injectable()
export class StripeService {
  private client: Stripe;

  constructor(private config: ConfigService) {
    this.client = new Stripe(config.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-06-20', // Pin API version — critical for stability
    });
  }

  async createCheckoutSession(params: {...}): Promise<Stripe.Checkout.Session> { ... }
  async createPortalSession(customerId: string): Promise<Stripe.BillingPortal.Session> { ... }
  async constructWebhookEvent(payload: Buffer, sig: string): Promise<Stripe.Event> { ... }
}
```

**Critical: Pin the Stripe API version.** Stripe's API versions are dated strings (e.g. `'2024-06-20'`). Without pinning, upgrading the SDK can silently change API behavior. Always pin to a specific version in code.

### Webhook Handling — The Core Integration Point

```typescript
// stripe/stripe-webhook.controller.ts
@Controller('webhooks/stripe')
export class StripeWebhookController {
  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() req: FastifyRequest,  // Must use raw body — Fastify-specific
    @Headers('stripe-signature') sig: string,
  ) {
    // CRITICAL for Fastify: raw body must be preserved
    // Fastify parses body as JSON by default — must configure rawBody: true
    const event = await this.stripeService.constructWebhookEvent(
      req.rawBody,  // requires rawBody plugin
      sig,
    );
    await this.webhookHandler.handle(event);
    return { received: true };
  }
}
```

**Fastify raw body requirement:** NestJS on Fastify does NOT preserve the raw request body by default. Stripe webhook signature verification requires the exact raw bytes. Must configure:

```typescript
// main.ts — Fastify raw body setup
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter(),
);
await app.register(require('@fastify/raw-body'), {
  field: 'rawBody',
  global: false,  // only enable on webhook route
  encoding: false, // preserve as Buffer
  runFirst: true,
});
```

**Package:** `@fastify/raw-body` (Fastify official plugin)
**Version:** ^3.x (verify on npm)

### Key Webhooks to Handle

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create user account, provision space access |
| `customer.subscription.created` | Set subscription metadata on user record |
| `customer.subscription.updated` | Handle plan changes, reactivations |
| `customer.subscription.deleted` | Revoke access, deactivate user |
| `invoice.payment_failed` | Grace period logic, notify user |
| `invoice.payment_succeeded` | Extend access period, reset failure count |

### Checkout Flow

```
Client → POST /api/stripe/checkout (authenticated or anonymous)
       → StripeService.createCheckoutSession({
           mode: 'subscription',
           price: STRIPE_PRICE_ID,
           success_url: APP_URL + '/access/success?session_id={CHECKOUT_SESSION_ID}',
           cancel_url: APP_URL + '/access/cancel',
           customer_email: email,  // pre-fill for new users
           metadata: { workspace_id, plan_id },
         })
       → Returns { url: checkoutUrl }
Client → Redirect to checkoutUrl (Stripe-hosted checkout)
Stripe → Redirect to success_url after payment
Stripe → POST /webhooks/stripe (checkout.session.completed)
Server → Create user + assign external role + send welcome email
```

**Why Stripe-hosted checkout over Elements:** Stripe Checkout handles PCI compliance, SCA/3DS, Apple Pay, Google Pay, and coupon codes automatically. Building custom Elements UI adds complexity with no benefit for a single-product subscription.

### Customer Portal

```typescript
async createPortalSession(customerId: string, returnUrl: string) {
  return this.client.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
```

The portal handles subscription cancellation, plan changes, and payment method updates without any custom UI. Must be configured in the Stripe Dashboard (which features to expose).

### Environment Variables Required

```
STRIPE_SECRET_KEY=sk_live_...       # or sk_test_... for development
STRIPE_PUBLISHABLE_KEY=pk_live_...  # for client-side if needed
STRIPE_WEBHOOK_SECRET=whsec_...     # from Dashboard > Webhooks
STRIPE_PRICE_ID=price_...           # the subscription price to sell
```

### What NOT to Use

| Approach | Why Not |
|----------|---------|
| `nestjs-stripe` npm package | Lags behind official SDK, adds unnecessary abstraction |
| Stripe Elements (custom UI) | Overhead not justified for single-product subscription |
| Polling instead of webhooks | Misses events, delays provisioning, brittle |
| Storing card data server-side | PCI scope violation — Stripe handles this |

---

## 3. Railway Deployment (NestJS + Vite Monorepo)

### Build System: Nixpacks (Railway's default)

**Confidence: MEDIUM** — Railway's behavior evolves; some specifics require verification against current Railway docs.

Railway uses Nixpacks to auto-detect and build applications. For a pnpm monorepo, Nixpacks has known detection quirks.

### railway.toml Configuration (Critical)

Railway requires a `railway.toml` at the repo root to control build and start behavior for monorepos:

```toml
[build]
builder = "nixpacks"
buildCommand = "pnpm install --frozen-lockfile && pnpm nx build server --prod && pnpm nx build client --prod"

[deploy]
startCommand = "node apps/server/dist/main.js"
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

**Alternatively**, use a Dockerfile for deterministic builds:

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.4.0 --activate

FROM base AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile
RUN pnpm nx build server --configuration=production
RUN pnpm nx build client --configuration=production

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/client/dist ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
```

**Why Dockerfile over Nixpacks for this project:** The monorepo has a custom NestJS + Fastify setup with static file serving for the Vite client. Nixpacks may not correctly handle the two-step build (server + client) or know where the client dist ends up. A Dockerfile gives deterministic control.

### Common Railway + pnpm Monorepo Pitfalls

#### Pitfall 1: pnpm not recognized by Nixpacks

**Problem:** Nixpacks defaults to npm. pnpm requires explicit configuration.
**Fix:** Add `packageManager` field to root `package.json`:
```json
{ "packageManager": "pnpm@10.4.0" }
```
Or set `NIXPACKS_PKGS=nodejs-22_x` environment variable in Railway dashboard.

#### Pitfall 2: Nx cache not available in Railway CI

**Problem:** Nx's local cache doesn't persist between Railway builds, making builds slower. Cloud cache (Nx Cloud) adds cost and complexity.
**Fix:** Use `--skip-nx-cache` in build commands on Railway, or bypass Nx and call build scripts directly:
```bash
pnpm --filter server build && pnpm --filter client build
```

#### Pitfall 3: Static files not found at runtime

**Problem:** NestJS serves the Vite client build at a path that doesn't exist in the deployed container.
**Fix:** Ensure the build copies `apps/client/dist` to where the server expects it (typically `apps/server/public` or similar). This is explicitly the problem in the current codebase (recent commits show SPA routing fixes). Verify `STATIC_DIR` env var or hardcoded path in `StaticController`.

#### Pitfall 4: PORT env variable

**Problem:** Railway injects `PORT` dynamically (often 3000, but not guaranteed). NestJS must listen on `process.env.PORT`, not a hardcoded port.
**Fix:**
```typescript
// main.ts
await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
```
`0.0.0.0` is required — `127.0.0.1` only binds to loopback and Railway's proxy cannot reach it.

#### Pitfall 5: Database migrations not run on deploy

**Problem:** Railway deploys the new container but DB schema is stale.
**Fix:** Add a migration step to `startCommand`:
```toml
[deploy]
startCommand = "node apps/server/dist/scripts/migrate.js && node apps/server/dist/main.js"
```
Or use Railway's "Deploy Hook" to run migrations before the new deployment activates.

#### Pitfall 6: Hocuspocus collaboration server

**Problem:** Hocuspocus is a separate WebSocket server process. Running it in the same Railway service as NestJS requires a process manager or forking within the Node process.
**Fix options:**
1. Deploy Hocuspocus as a separate Railway service (cleanest) — set `COLLAB_URL` to point to it.
2. Start both in `main.ts` using `fork` / `cluster` — couples them but avoids a second service.

Separate service is recommended. Railway's private networking allows inter-service communication without public exposure.

#### Pitfall 7: Redis and PostgreSQL connection strings

**Problem:** Railway's PostgreSQL and Redis add-ons inject connection strings as env vars with specific names (`DATABASE_URL`, `REDIS_URL`). Docmost already uses these exact variable names — this is compatible but must be verified in Railway dashboard.
**Fix:** No code change needed if env vars match. Railway's PostgreSQL uses `DATABASE_PUBLIC_URL` for external access and `DATABASE_URL` for internal — use `DATABASE_URL` (internal) to avoid SSL complications.

### Environment Variables for Railway

```
NODE_ENV=production
APP_URL=https://your-domain.up.railway.app
APP_SECRET=<32+ char random string>
DATABASE_URL=${{Postgres.DATABASE_URL}}          # Railway template syntax
REDIS_URL=${{Redis.REDIS_URL}}                   # Railway template syntax
STORAGE_DRIVER=local                             # or s3
COLLAB_URL=https://collab-service.up.railway.app # if separate Hocuspocus service
MAIL_DRIVER=smtp
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_ID=...
```

### What NOT to Use

| Approach | Why Not |
|----------|---------|
| Nixpacks without `railway.toml` | Unpredictable build for custom monorepos |
| Hardcoded port (3000) | Railway assigns PORT dynamically |
| Single service for NestJS + Hocuspocus | WebSocket and HTTP port conflicts, harder to scale |
| `DATABASE_PUBLIC_URL` | External URL requires SSL config; internal URL is simpler |

---

## Recommended Additions to package.json

### Server (`apps/server`)

```bash
pnpm add stripe @fastify/raw-body
```

| Package | Version (verify npm) | Purpose |
|---------|----------------------|---------|
| `stripe` | ^17.x | Official Stripe Node.js SDK |
| `@fastify/raw-body` | ^3.x | Preserve raw body for webhook signature verification |

### Client (`apps/client`)

No new npm packages needed. Content protection is implemented via:
- CSS (`user-select`, `@media print`)
- Native browser event listeners in a React hook
- CSS `::after` pseudo-element for watermark

### Infrastructure

No new packages. Railway uses existing PostgreSQL + Redis add-ons.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Stripe NestJS integration | Direct `stripe` SDK in `@Injectable()` service | `nestjs-stripe` package | Community wrapper lags SDK, adds abstraction with no benefit |
| Stripe checkout | Stripe-hosted Checkout (`mode: 'subscription'`) | Stripe Elements custom UI | PCI compliance, Apple/Google Pay, coupons handled automatically |
| Content protection | Native browser APIs + CSS | Third-party library | No credible library exists; browser APIs are the correct primitive |
| Watermark | CSS `::after` pseudo-element | Canvas overlay | Canvas blocked by ad blockers; CSS survives DOM manipulation |
| Railway builds | Dockerfile | Nixpacks auto-detect | Deterministic; monorepo detection is unreliable in Nixpacks |
| Hocuspocus deployment | Separate Railway service | Same process as NestJS | Avoids port conflicts; allows independent scaling and restart |

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Content protection APIs | HIGH | Browser APIs are stable, documented in MDN; no library needed is a well-established pattern |
| Content protection (screenshot) | HIGH | Documented limitation; no JS solution exists at OS level |
| Stripe SDK version | MEDIUM | `stripe` v17.x was current at training cutoff; verify on npm before installing |
| Stripe API version string | MEDIUM | `2024-06-20` was valid at training cutoff; Stripe releases new versions quarterly |
| Stripe NestJS architecture | HIGH | DI pattern is idiomatic NestJS; webhook raw body requirement is documented |
| Railway Nixpacks behavior | MEDIUM | Nixpacks evolves; some pitfalls may have been fixed or changed since training cutoff |
| Railway Dockerfile approach | HIGH | Docker is Railway's alternative builder; behavior is stable |
| Railway PORT binding | HIGH | `0.0.0.0` + `process.env.PORT` is Railway's documented requirement |

---

## Sources

All findings from training data (cutoff August 2025). External fetch tools were unavailable during this research session.

**Authoritative sources to verify before implementation:**
- Stripe Node.js SDK: https://github.com/stripe/stripe-node (check latest version, current API version string)
- Stripe webhook docs: https://stripe.com/docs/webhooks
- Stripe Checkout: https://stripe.com/docs/payments/checkout
- Fastify raw-body: https://github.com/fastify/fastify-raw-body
- Railway docs (monorepo): https://docs.railway.com/guides/monorepo
- Railway Nixpacks: https://nixpacks.com/docs/providers/node
- MDN user-select: https://developer.mozilla.org/en-US/docs/Web/CSS/user-select
- MDN beforeprint: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeprint_event

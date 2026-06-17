# Sprout — Fresh Build Prompt

## Product

Sprout is a multi-tenant SaaS nursery management platform for the UK market. Two separate client applications share one Supabase project:

1. **Staff & Admin App** — full management web interface for nursery managers and staff (React + Vite, browser)
2. **Parent App** — native iOS and Android app for parents to follow their child's day (React Native + Expo)

Both apps read and write the **same database** via the same Hono API. Access is enforced by role (`manager` | `staff` | `parent`) at both the API layer and the database (Postgres Row-Level Security). A parent can only see their own child's data. Tenants are completely isolated from each other.

---

## Stack

| Layer | Technology | Why |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | shared packages, parallel builds |
| **Staff app** | React 18 + Vite + TypeScript | browser, component-based, fast HMR |
| **Parent app** | React Native + Expo (SDK 52) | native iOS + Android from one codebase |
| Staff styling | Tailwind CSS v3 | utility-first, consistent design tokens |
| Parent styling | NativeWind v4 | Tailwind syntax for React Native |
| Data fetching | TanStack Query v5 | same API in both apps; cache, optimistic updates |
| Staff routing | TanStack Router | fully type-safe browser routes |
| Parent routing | Expo Router v4 | file-based, deep-linking, native tabs |
| Forms | React Hook Form + Zod | same Zod schema validates form AND API |
| Global state | Zustand | auth user + nursery context only |
| Backend runtime | Bun + Hono.js | TypeScript-native, fast, clean API |
| Database | Supabase Postgres | managed Postgres, one project |
| Auth | Supabase Auth | email/password + OTP; JWT with custom claims |
| File storage | Supabase Storage | photos, documents, logos |
| Realtime | Supabase Realtime | message badge, live register |
| Background jobs | Separate Railway Worker service (same repo) | invoice gen, reminders, backups |
| Email | Resend | transactional email |
| Payments | Stripe | subscription billing (nursery plans) |
| Direct Debit | GoCardless | parent invoice collection |
| AI | Anthropic claude-haiku-4-5 | observation drafting, photo analysis |
| Push (parent) | Expo Push Notifications (APNs + FCM) | iOS + Android native push |
| Parent builds | Expo EAS Build | managed iOS .ipa + Android .aab |
| App Store / Play | Expo EAS Submit | automated store submission |
| OTA updates | Expo EAS Update | JS-only updates without store review |
| Error tracking | Sentry (`@sentry/react-native` + `@sentry/react`) | both apps + API |
| Testing | Vitest (staff + API) + Jest + RNTL (parent) | unit + integration |
| CI | GitHub Actions | lint → typecheck → test → deploy |
| Deploy | Railway (staff static + API + jobs worker) + EAS (parent iOS/Android) | one platform for all server-side |

---

## Repository Structure

```
sprout/                          # monorepo root
├── apps/
│   ├── staff/                   # Staff & Admin React web app (Vite)
│   ├── parent/                  # Parent native app (Expo / React Native)
│   └── api/                     # Hono.js API server (Bun)
├── packages/
│   ├── db/                      # Supabase client + generated types + query helpers
│   ├── ui/                      # Web-only React components (staff app only — NOT shared with parent)
│   ├── schemas/                 # Zod schemas shared between staff web, parent native, AND API
│   └── config/                  # Shared tsconfig bases, eslint.config
├── supabase/
│   ├── migrations/              # SQL migration files (applied by Supabase CLI)
│   └── seed.sql                 # Dev seed data
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
├── turbo.json                   # see pipeline definition below
├── pnpm-workspace.yaml          # packages: ['apps/*', 'packages/*']
├── .npmrc                       # REQUIRED for pnpm + Expo — see note below
└── package.json
```

**`.npmrc` — required at the monorepo root:**

```ini
# Metro (Expo's bundler) cannot traverse pnpm's symlinked node_modules.
# This makes pnpm hoist packages flat like npm/yarn, which Metro can resolve.
node-linker=hoisted
shamefully-hoist=true
```

Without these two lines, `pnpm install` will complete successfully but Metro will throw `Unable to resolve module @sprout/schemas` at runtime. Add `.npmrc` before running any `pnpm install`.

### `turbo.json` — pipeline definition

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": ["NODE_ENV", "DATABASE_URL", "SUPABASE_URL"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "env": ["DATABASE_URL", "JWT_SECRET"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

Note: the parent Expo app (`apps/parent`) uses Metro/EAS, not Vite, so its `build` task is not part of the Turborepo pipeline — exclude it by not defining a `build` script in `apps/parent/package.json`. Only `typecheck`, `lint`, and `test` run through Turbo for the parent app.

---

### `apps/staff/` layout

```
apps/staff/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── src/
│   ├── main.tsx                 # Supabase auth init, TanStack Router provider
│   ├── router.ts                # TanStack Router route tree
│   ├── store.ts                 # Zustand: auth user, nursery, plan
│   ├── routes/                  # One file per page route
│   │   ├── __root.tsx           # Shell: sidebar + page outlet
│   │   ├── dashboard.tsx
│   │   ├── children/
│   │   │   ├── index.tsx        # children list
│   │   │   └── $childId.tsx     # child detail (tabs)
│   │   ├── relatives.tsx
│   │   ├── rooms.tsx
│   │   ├── staff.tsx
│   │   ├── enquiries.tsx
│   │   ├── waiting-list.tsx
│   │   ├── consents.tsx
│   │   ├── booking-requests.tsx
│   │   ├── messages.tsx
│   │   ├── rota.tsx
│   │   ├── sessions.tsx
│   │   ├── planning.tsx
│   │   ├── monitoring.tsx
│   │   ├── register.tsx
│   │   ├── fire-register.tsx
│   │   ├── calendar.tsx
│   │   ├── assessment.tsx
│   │   ├── daily-logs.tsx
│   │   ├── journal.tsx
│   │   ├── reflections.tsx
│   │   ├── send.tsx
│   │   ├── newsfeed.tsx
│   │   ├── medications.tsx
│   │   ├── incidents.tsx
│   │   ├── accident-book.tsx
│   │   ├── invoices.tsx
│   │   ├── finance.tsx
│   │   ├── revenue-report.tsx
│   │   ├── funded-hours.tsx
│   │   ├── funding.tsx
│   │   ├── reports.tsx
│   │   ├── ofsted.tsx
│   │   ├── compliance/
│   │   │   ├── index.tsx        # compliance overview
│   │   │   ├── policies.tsx
│   │   │   ├── risk-assessments.tsx
│   │   │   └── training.tsx
│   │   ├── gdpr.tsx
│   │   ├── staff-dev.tsx
│   │   ├── settings.tsx
│   │   ├── users.tsx
│   │   └── billing.tsx
│   ├── features/                # Self-contained feature sections (may cross routes)
│   │   ├── children/
│   │   │   ├── ChildForm.tsx
│   │   │   ├── ChildCard.tsx
│   │   │   └── useChildren.ts
│   │   ├── invoices/
│   │   │   ├── InvoiceModal.tsx
│   │   │   ├── InvoicePrint.tsx
│   │   │   └── useInvoices.ts
│   │   ├── messages/
│   │   │   ├── ConversationList.tsx
│   │   │   ├── MessageThread.tsx
│   │   │   └── useMessages.ts
│   │   └── ... (one folder per domain)
│   ├── components/              # Dumb, reusable UI components
│   │   ├── Sidebar.tsx
│   │   ├── StatCard.tsx
│   │   ├── Modal.tsx
│   │   ├── DataTable.tsx
│   │   ├── Avatar.tsx
│   │   ├── Badge.tsx
│   │   └── EmptyState.tsx
│   └── hooks/
│       ├── useAuth.ts
│       ├── useNursery.ts
│       └── usePlan.ts           # feature gate checker
```

### `apps/parent/` layout (Expo)

```
apps/parent/
├── app.json                     # Expo config — bundle IDs baked into first EAS Build, choose carefully
├── eas.json                     # EAS Build + Submit profiles (development, preview, production)
├── metro.config.js              # Metro bundler config — CRITICAL for monorepo resolution
├── babel.config.js              # expo preset + NativeWind
├── tailwind.config.ts           # NativeWind tokens (same colour palette as staff app)
├── app/                         # Expo Router file-based routes
│   ├── _layout.tsx              # Root layout: auth guard + Supabase session provider
│   ├── (auth)/
│   │   ├── login.tsx            # Email + password login
│   │   └── otp.tsx             # OTP verify (6-digit code sent via Resend)
│   └── (tabs)/                  # Bottom tab navigator (shown when authenticated)
│       ├── _layout.tsx          # Tab bar: Home | Daily | Journal | Messages
│       ├── index.tsx            # Home — child summary, today's mood, newsfeed
│       ├── daily.tsx            # Daily report card with date navigation
│       ├── journal.tsx          # Shared observations (photos + EYFS tags)
│       ├── messages.tsx         # Message thread with staff
│       ├── invoices.tsx         # Outstanding + paid invoices (accessible from Home alert)
│       ├── forms.tsx            # Pending consent forms + signature pad
│       └── bookings.tsx         # Current sessions + booking/holiday requests
├── src/
│   ├── store.ts                 # Zustand: auth user, child, nursery
│   ├── api.ts                   # Fetch wrapper: attaches Supabase JWT to every request
│   ├── features/
│   │   ├── messages/
│   │   │   ├── useMessages.ts   # TanStack Query + Supabase Realtime subscription
│   │   │   └── MessageBubble.tsx
│   │   ├── daily/
│   │   │   └── useReportCard.ts
│   │   ├── journal/
│   │   │   └── ObservationCard.tsx
│   │   └── bookings/
│   │       └── BookingRequest.tsx
│   └── components/
│       ├── LogCard.tsx          # Daily log entry card (meal/sleep/nappy/mood/note)
│       ├── StatRow.tsx          # Summary count bar (meals · naps · nappies · mood)
│       ├── InvoiceCard.tsx
│       ├── ConsentForm.tsx      # Full consent text + expo-signature-canvas
│       └── Avatar.tsx
├── assets/
│   ├── icon.png                 # 1024×1024 app icon
│   ├── splash.png
│   └── adaptive-icon.png        # Android adaptive icon foreground
```

**Metro monorepo config** (`apps/parent/metro.config.js`) — required for pnpm workspaces. Without this, Metro cannot resolve `@sprout/schemas`, `@sprout/db`, etc.:

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro sees package changes
config.watchFolders = [monorepoRoot];

// Resolve packages from the monorepo node_modules first, then the app's
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './global.css' });
```

**NativeWind `global.css`** — `withNativeWind` references `./global.css` in the metro config above. If this file does not exist, Metro compiles successfully but all Tailwind/NativeWind `className` props are silently ignored — no error, no styles. Create `apps/parent/global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Then import it at the top of `apps/parent/app/_layout.tsx`:

```typescript
import '../global.css';  // MUST be the first import in _layout.tsx
import { Stack } from 'expo-router';
// ... rest of layout
```

**Key Expo libraries:**

```json
{
  "expo": "~52.0.0",
  "expo-router": "~4.0.0",
  "expo-notifications": "~0.29.0",
  "expo-secure-store": "~14.0.0",
  "expo-image-picker": "~16.0.0",
  "expo-camera": "~16.0.0",
  "nativewind": "^4.0.0",
  "@supabase/supabase-js": "^2.0.0",
  "@tanstack/react-query": "^5.0.0",
  "react-hook-form": "^7.0.0",
  "zustand": "^5.0.0",
  "@sentry/react-native": "^6.0.0",
  "react-native-signature-canvas": "^4.0.0"
}
```

**Auth token storage:** Use `expo-secure-store` (encrypted, hardware-backed) to persist the Supabase session — never `AsyncStorage` for tokens.

**Push notifications — permission timing:** Do NOT request push notification permission on first app launch. On iOS, users who see the permission prompt before understanding the app's value deny it ~70% of the time, and iOS never asks again. Instead, request permission the first time the user opens the **Messages tab**, immediately before showing the thread — at that point they understand why they'd want notifications.

```typescript
// apps/parent/src/routes/(tabs)/messages.tsx
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

export default function MessagesScreen() {
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus === 'granted') {
          const token = (await Notifications.getExpoPushTokenAsync()).data;
          await api.post('/parent/push-token', { expoPushToken: token, platform: Platform.OS });
        }
      }
    })();
  }, []);
  // ... rest of screen
}
```

Use `expo-notifications` to register the device for push and obtain an Expo push token. POST the token to `POST /api/parent/push-token`. The API stores it in `push_subscriptions` and sends push via the Expo Push API (`https://exp.host/--/api/v2/push/send`). Remove the VAPID env vars — they are web-only.

**Realtime (messages):** Supabase Realtime `postgres_changes` subscriptions do **NOT** enforce RLS — a misconfigured channel could deliver another child's messages to the wrong parent. Always include explicit `filter` clauses on the channel subscription. Never rely on RLS to scope realtime events.

```typescript
// Correct — explicitly scoped to this child
supabase
  .channel(`messages:child:${childId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `child_id=eq.${childId}`,   // REQUIRED — RLS does not apply here
  }, (payload) => {
    queryClient.invalidateQueries({ queryKey: ['messages', childId] });
    scheduleLocalNotification(payload.new);
  })
  .subscribe();
```

For the **staff app** messages page, scope to `nursery_id` so a manager only receives their nursery's messages:

```typescript
supabase
  .channel(`messages:nursery:${nurseryId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `nursery_id=eq.${nurseryId}`,
  }, () => queryClient.invalidateQueries({ queryKey: ['messages'] }))
  .subscribe();
```

On a new message event, refetch the query and in the parent app show a local notification if the app is in the background via `expo-notifications`.

**OTA updates:** Configure EAS Update. JS-only changes (bug fixes, copy changes) can be pushed instantly without App Store or Play Store review. Native changes (new library, config change) require a new EAS Build + store submission.

### `apps/api/` layout

```
apps/api/
├── src/
│   ├── index.ts                 # Hono app + route mounting + Sentry
│   ├── db.ts                    # Barrel re-export: supabaseAdmin + pool + withTenant from @sprout/db — keeps route imports clean
│   ├── auth.ts                  # JWT middleware: verify Supabase JWT → c.var.user
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── children.ts
│   │   ├── relatives.ts
│   │   ├── rooms.ts
│   │   ├── staff.ts
│   │   ├── planning.ts
│   │   ├── monitoring.ts
│   │   ├── assessments.ts
│   │   ├── finance.ts
│   │   ├── invoices.ts
│   │   ├── settings.ts
│   │   ├── daily-logs.ts
│   │   ├── observations.ts
│   │   ├── reflections.ts
│   │   ├── send.ts
│   │   ├── medications.ts
│   │   ├── incidents.ts
│   │   ├── enquiries.ts
│   │   ├── messages.ts
│   │   ├── child-sessions.ts
│   │   ├── funding.ts
│   │   ├── rota.ts
│   │   ├── ai.ts
│   │   ├── ofsted.ts
│   │   ├── users.ts
│   │   ├── parent.ts
│   │   ├── waiting-list.ts
│   │   ├── consents.ts
│   │   ├── accident-book.ts
│   │   ├── child-documents.ts
│   │   ├── calendar.ts
│   │   ├── compliance.ts
│   │   ├── gdpr.ts
│   │   ├── staff-dev.ts
│   │   ├── billing.ts
│   │   ├── billing-webhook.ts
│   │   ├── payments.ts
│   │   ├── gocardless-webhook.ts
│   │   ├── push.ts
│   │   ├── requests.ts
│   │   └── admin.ts
│   ├── services/
│   │   ├── storage.ts
│   │   ├── email.ts
│   │   ├── push.ts
│   │   ├── gocardless.ts
│   │   ├── stripe.ts
│   │   ├── ai.ts
│   │   ├── funding.ts           # LA funding calculation helpers
│   │   ├── ageBands.ts          # age-band rate lookup
│   │   ├── sessionPatterns.ts   # child_sessions expand/count helpers
│   │   └── backup.ts
│   ├── jobs/
│   │   ├── invoiceGenerator.ts
│   │   ├── invoiceReminders.ts
│   │   ├── trialWarnings.ts
│   │   └── backup.ts
│   └── middleware/
│       ├── auth.ts              # requireAuth: verifies Supabase JWT
│       ├── requireRole.ts       # requireRole('manager' | 'staff' | 'parent')
│       ├── trial.ts             # 402 if trial expired + no Stripe subscription
│       ├── audit.ts             # writes to audit_log
│       └── adminAuth.ts         # X-Admin-Key header check
```

**`apps/api/src/middleware/audit.ts`** — GDPR requires an audit trail of who accessed or modified what. Apply this middleware to any route that reads PII or modifies records. It writes asynchronously and never blocks the response:

```typescript
import { createMiddleware } from 'hono/factory';
import type { HonoEnv } from '../types';
import { pool } from '@sprout/db/pool';

export const auditLog = createMiddleware<HonoEnv>(async (c, next) => {
  await next();
  // Fire-and-forget — do not await; response is already sent
  const user = c.get('user');
  if (!user) return;
  pool.query(
    `INSERT INTO audit_log (nursery_id, user_id, action, resource, resource_id, ip, status_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      user.nurseryId,
      user.id,
      c.req.method,                          // 'GET' | 'POST' | 'PATCH' | 'DELETE'
      c.req.routePath,                       // e.g. '/children/:id'
      c.req.param('id') ?? null,
      c.req.header('x-forwarded-for') ?? c.req.header('cf-connecting-ip') ?? null,
      c.res.status,
    ]
  ).catch(() => {});                         // silent — audit failure must never break the API
});
```

Apply it on routes that touch sensitive data:

```typescript
// apps/api/src/routes/children.ts
app.get('/:id', requireAuth, auditLog, async (c) => { ... });
app.patch('/:id', requireAuth, requireRole('manager','staff'), auditLog, async (c) => { ... });

// Apply globally to all GDPR-relevant routes (gdpr.ts, daily-logs.ts, observations.ts, messages.ts)
```

The `audit_log` table is in Migration 013. Do NOT expose audit_log via any parent-facing API route.

### `packages/db/`

```
packages/db/
├── src/
│   ├── client.ts                # createClient() — Supabase JS client (browser + React Native)
│   ├── client.native.ts         # React Native variant: same API, expo-secure-store storage adapter
│   ├── admin.ts                 # createAdminClient() — service role key (API server ONLY, never frontend)
│   ├── pool.ts                  # pg Pool + withTenant() — API server ONLY, never imported by apps
│   └── types.ts                 # Generated: `supabase gen types typescript --local > src/types.ts`
└── package.json
```

**`packages/db/package.json`** — subpath imports (`@sprout/db/admin`, `@sprout/db/native`, `@sprout/db/pool`) require an `exports` field. Without it TypeScript and the bundlers throw `Cannot find module '@sprout/db/admin'`:

```json
{
  "name": "@sprout/db",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": "./src/client.ts",
    "./native": "./src/client.native.ts",
    "./admin": "./src/admin.ts",
    "./pool": "./src/pool.ts",
    "./types": "./src/types.ts"
  }
}
```

**`packages/schemas/package.json`:**

```json
{
  "name": "@sprout/schemas",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

**`packages/ui/package.json`** (web-only React components, staff app only):

```json
{
  "name": "@sprout/ui",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

**`packages/config/package.json`** — tsconfig subpath references (`"extends": "@sprout/config/tsconfig.web.json"`) resolve via the `exports` field:

```json
{
  "name": "@sprout/config",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./tsconfig.base.json": "./tsconfig.base.json",
    "./tsconfig.web.json": "./tsconfig.web.json",
    "./tsconfig.native.json": "./tsconfig.native.json",
    "./tsconfig.node.json": "./tsconfig.node.json"
  }
}
```

Each app and package `package.json` must list its `@sprout/*` dependencies in `"dependencies"` so pnpm links them correctly in the workspace:

```json
{
  "dependencies": {
    "@sprout/db": "workspace:*",
    "@sprout/schemas": "workspace:*"
  }
}
```

**`packages/db/src/admin.ts`** — service role client, API server only. Used for auth admin operations, storage uploads, and OTP. Never import this in `apps/staff` or `apps/parent`:

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Singleton — one admin client per process
let _admin: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdmin() {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  _admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

// Convenience alias used throughout the API routes
export const supabaseAdmin = getSupabaseAdmin();
```

Import in every API route that needs auth admin or storage: `import { supabaseAdmin } from '@sprout/db/admin'`.

---

**Supabase client for React Native** (`client.native.ts`) must use a custom storage adapter so sessions survive app restarts:

```typescript
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storage: SecureStoreAdapter, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }
);
```

The parent app imports from `@sprout/db/native`; the staff web app imports from `@sprout/db`. The API imports from `@sprout/db/admin` and `@sprout/db/pool`. The service role key and pg Pool never reach a frontend bundle.

### `packages/schemas/`

```
packages/schemas/
├── src/
│   ├── child.ts                 # z.object({ name, dob, room, ... })
│   ├── invoice.ts               # includes lineItemSchema — see below
│   ├── session.ts
│   ├── user.ts
│   └── index.ts                 # re-exports all schemas
```

Types are inferred from schemas on the frontend for form validation, and used with `.parse()` on the API for request body validation.

**`packages/schemas/src/invoice.ts`** — the `lineItemSchema` is the single source of truth used by the invoice form, the auto-generator, and the print layout:

```typescript
import { z } from 'zod';

export const lineItemSchema = z.object({
  description: z.string().min(1),
  hours:       z.number().positive().optional(), // session-based lines only
  rate:        z.number().positive().optional(), // session-based lines only
  amount:      z.number().nonnegative(),         // always required; hours * rate for session lines
});

export const invoiceCreateSchema = z.object({
  childId:   z.number().int().positive(),
  period:    z.string().min(1),                  // e.g. '2026-06'
  lineItems: z.array(lineItemSchema).min(1),
  dueDate:   z.string().optional(),
  notes:     z.string().optional(),
});

export type LineItem = z.infer<typeof lineItemSchema>;
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
```

The `amount` on the invoice row is always derived: `lineItems.reduce((s, l) => s + l.amount, 0)` — never stored independently of the line items.

---

## Supabase Auth Setup

Users authenticate via Supabase Auth. On the API, all JWTs are verified using the Supabase JWT secret.

### Custom claims in `user_metadata`

When creating a user (via `/api/auth/register-nursery` or `/api/users`), call:

```typescript
supabase.auth.admin.updateUserById(uid, {
  user_metadata: {
    nursery_id,          // integer — used by RLS on every table
    role,                // 'manager' | 'staff' | 'parent'
    name,
    // For parents: child_ids is an array (siblings supported)
    child_ids: role === 'parent' ? [childId, ...] : [],
  }
});
```

RLS tenant isolation reads `nursery_id`: `(auth.jwt()->'user_metadata'->>'nursery_id')::int`.

Parent-scoped policies (messages, daily_logs, etc.) use the JSONB containment operator `@>` — do NOT use `::int[]` cast, which fails because JSONB arrays serialize as `[1,2]` not `{1,2}` (Postgres array literal format):

```sql
-- CORRECT — use @> to_jsonb() for JSONB array membership check
(auth.jwt()->'user_metadata'->>'role') != 'parent'
OR (auth.jwt()->'user_metadata'->'child_ids') @> to_jsonb(child_id)

-- WRONG — ::int[] cast throws a Postgres error on JSONB arrays
-- child_id = ANY((auth.jwt()->'user_metadata'->'child_ids')::int[])
```

So a parent with two children (`child_ids: [12, 15]`) can see data for both. Staff and managers skip the child_id check entirely via the `!= 'parent'` branch.

### Auth flows

| Flow | Who | Endpoint | Notes |
|---|---|---|---|
| Register nursery | Manager (web) | `POST /api/auth/register-nursery` | Creates `nurseries` row, `users` row, Supabase Auth user |
| Login | Manager/Staff (web) | `POST /api/auth/login` | `supabase.auth.signInWithPassword` → returns session |
| Email verification | Manager/Staff (web) | Supabase handles | Magic link in email → clicks in browser → works fine for web |
| Forgot password | Manager/Staff (web) | `POST /api/auth/forgot-password` | `supabase.auth.resetPasswordForEmail` → browser link |
| Reset password | Manager/Staff (web) | Supabase redirect | Handled by Supabase hosted UI |
| Add staff user | Manager (web) | `POST /api/users` | Creates Auth user + `users` row; staff logs in via web |
| Add parent user | Manager (web) | `POST /api/users` | Creates Auth user + `users` row + `user_children` rows; sends welcome email with OTP instructions |
| Parent login (native) | Parent (mobile) | `POST /api/auth/send-otp` | Sends 6-digit code via Resend to parent's email |
| Parent verify OTP | Parent (mobile) | `POST /api/auth/verify-otp` | Verifies code → calls `supabase.auth.verifyOtp` → returns session stored in `expo-secure-store` |

**Critical: do not use magic links for the parent native app.** Supabase email verification sends a magic link. When a parent taps it on their phone, iOS/Android opens a browser tab — not the Sprout app — because Universal Links require additional Apple/Google configuration and a hosted `/.well-known/apple-app-site-association` file. Avoid this complexity entirely: disable email confirmation for parent accounts when creating them via the admin API (`supabase.auth.admin.createUser({ email_confirm: true })`), and use OTP login exclusively for the parent app.

```typescript
// POST /api/auth/send-otp
const { error } = await supabaseAdmin.auth.signInWithOtp({
  email: body.email,
  options: { shouldCreateUser: false }, // parent must already exist
});

// POST /api/auth/verify-otp
const { data, error } = await supabaseAdmin.auth.verifyOtp({
  email: body.email,
  token: body.token,
  type: 'email',
});
// Return data.session to the native app — store in expo-secure-store
```

---

## Database

All schema is expressed as numbered Supabase migration files in `supabase/migrations/`. Each file is idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

### Tenancy model

- Every tenant is a row in `nurseries`
- Every user belongs to exactly one nursery (`users.nursery_id`)
- Every other table has `nursery_id INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE`
- RLS policy on every table: `nursery_id = (auth.jwt()->'user_metadata'->>'nursery_id')::int`
- `app_user` role (NOSUPERUSER NOBYPASSRLS NOLOGIN) is used for all API queries via `SET LOCAL ROLE app_user` inside transactions so RLS evaluates even via pooled connections

### `withTenant` pattern (API)

Every database-writing or multi-table query goes through this helper:

```typescript
// packages/db/src/pool.ts
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export async function withTenant<T>(nurseryId: number, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE app_user');
    await client.query("SELECT set_config('app.current_nursery_id', $1, true)", [String(nurseryId)]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
```

### Migration 001 — Nurseries & Auth

```sql
CREATE TABLE nurseries (
  id                      SERIAL PRIMARY KEY,
  name                    TEXT    NOT NULL,
  address                 TEXT    DEFAULT '',
  phone                   TEXT    DEFAULT '',
  email                   TEXT    DEFAULT '',
  ofsted_no               TEXT    DEFAULT '',
  logo_url                TEXT    DEFAULT '',
  plan                    TEXT    NOT NULL DEFAULT 'seedling'
                                  CHECK(plan IN ('seedling','blossom','grove','forest','cancelled')),
  billing_cycle           TEXT    NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly','annual')),
  plan_started_at         TIMESTAMPTZ,
  trial_ends_at           TIMESTAMPTZ,
  stripe_customer_id      TEXT    DEFAULT '',
  stripe_subscription_id  TEXT    DEFAULT '',
  trial_warning_sent      BOOLEAN NOT NULL DEFAULT FALSE,
  conversion_emails_sent  JSONB   NOT NULL DEFAULT '[]',
  status                  TEXT    NOT NULL DEFAULT 'active',
  admin_notes             TEXT    DEFAULT '',
  -- fee rates per age band
  fee_rate                NUMERIC NOT NULL DEFAULT 5.50,
  fee_rate_under2         NUMERIC NOT NULL DEFAULT 7.00,
  fee_rate_2yo            NUMERIC NOT NULL DEFAULT 5.50,
  fee_rate_3to4           NUMERIC NOT NULL DEFAULT 4.50,
  funding_rate_under2     NUMERIC NOT NULL DEFAULT 0,
  funding_rate_2yo        NUMERIC NOT NULL DEFAULT 0,
  funding_rate_3to4       NUMERIC NOT NULL DEFAULT 0,
  -- auto invoice
  auto_invoice_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  auto_invoice_day        INTEGER NOT NULL DEFAULT 1,
  auto_invoice_last_run   DATE,
  -- email / reminder
  smtp_host               TEXT NOT NULL DEFAULT '',
  smtp_port               INTEGER NOT NULL DEFAULT 587,
  smtp_user               TEXT NOT NULL DEFAULT '',
  smtp_pass               TEXT NOT NULL DEFAULT '',
  smtp_from               TEXT NOT NULL DEFAULT '',
  reminder_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_days_overdue   INTEGER NOT NULL DEFAULT 3,
  reminder_interval_days  INTEGER NOT NULL DEFAULT 7,
  -- gocardless
  gocardless_access_token TEXT NOT NULL DEFAULT '',
  -- created
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mirror of auth.users for app profile data
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  role        TEXT    NOT NULL DEFAULT 'staff'
                      CHECK(role IN ('manager','staff','parent')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No child_id here: one parent can have multiple children (siblings).
  -- Use user_children junction table below.
);

-- Many-to-many: one parent user → one or more children
-- Also supports: one child → multiple parent/guardian accounts
CREATE TABLE user_children (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id    INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  UNIQUE(user_id, child_id)
);

-- RLS: parent can only see their own child links
ALTER TABLE user_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_children FORCE ROW LEVEL SECURITY;
CREATE POLICY user_children_tenant ON user_children
  USING (nursery_id = (auth.jwt()->'user_metadata'->>'nursery_id')::int);

-- RLS: each user sees only rows in their own nursery
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_tenant ON users
  USING (nursery_id = (auth.jwt()->'user_metadata'->>'nursery_id')::int);
```

### Migration 002 — Core tables

```sql
CREATE TABLE children (
  id                SERIAL PRIMARY KEY,
  nursery_id        INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  name              TEXT    NOT NULL,
  dob               DATE,
  gender            TEXT    DEFAULT '',
  room              TEXT    DEFAULT '',
  status            TEXT    NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
  allergy           TEXT    DEFAULT 'None',
  medical_info      TEXT    DEFAULT '',
  emergency_contact TEXT    DEFAULT '',
  contact_phone     TEXT    DEFAULT '',
  notes             TEXT    DEFAULT '',
  photo_url         TEXT    DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE relatives (
  id                   SERIAL PRIMARY KEY,
  nursery_id           INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id             INTEGER REFERENCES children(id) ON DELETE SET NULL,
  name                 TEXT    NOT NULL,
  relation             TEXT    DEFAULT '',
  phone                TEXT    DEFAULT '',
  email                TEXT    DEFAULT '',
  address              TEXT    DEFAULT '',
  is_primary_contact   BOOLEAN NOT NULL DEFAULT FALSE,
  is_emergency_contact BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE rooms (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  capacity    INTEGER NOT NULL DEFAULT 10,
  age_group   TEXT    DEFAULT '',
  staff_lead  TEXT    DEFAULT '',
  color       TEXT    NOT NULL DEFAULT '#4f8ef7'
);

CREATE TABLE staff (
  id            SERIAL PRIMARY KEY,
  nursery_id    INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  role          TEXT    DEFAULT '',
  room          TEXT    DEFAULT '',
  qualification TEXT    DEFAULT '',
  phone         TEXT    DEFAULT '',
  start_date    DATE,
  status        TEXT    NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive'))
);
```

### Migration 003 — Daily operations

```sql
CREATE TABLE attendance (
  id            SERIAL PRIMARY KEY,
  nursery_id    INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id      INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date          DATE    NOT NULL DEFAULT CURRENT_DATE,
  status        TEXT    NOT NULL DEFAULT 'absent' CHECK(status IN ('present','absent','late')),
  sign_in       TIME,
  sign_out      TIME,
  absent_reason TEXT    DEFAULT '',
  signed_in_by  TEXT    DEFAULT '',
  collected_by  TEXT    DEFAULT '',
  att_notes     TEXT    DEFAULT '',
  UNIQUE(child_id, date)
);

CREATE TABLE daily_logs (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id    INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date        DATE    NOT NULL DEFAULT CURRENT_DATE,
  time        TIME,
  type        TEXT    NOT NULL CHECK(type IN ('meal','sleep','nappy','mood','activity','note')),
  details     TEXT    DEFAULT '',
  added_by    TEXT    DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE medications (
  id              SERIAL PRIMARY KEY,
  nursery_id      INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id        INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  medication_name TEXT    NOT NULL,
  dose            TEXT    DEFAULT '',
  dose_given      TEXT    DEFAULT '',
  frequency       TEXT    DEFAULT '',
  route           TEXT    DEFAULT '',
  prescribed_by   TEXT    DEFAULT '',
  start_date      DATE,
  end_date        DATE,
  given_by        TEXT    DEFAULT '',
  witness_by      TEXT    DEFAULT '',
  time_given      TIMESTAMPTZ,
  refused_reason  TEXT    DEFAULT '',
  notes           TEXT    DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE incidents (
  id                SERIAL PRIMARY KEY,
  nursery_id        INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id          INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name        TEXT    DEFAULT '',
  date              DATE    NOT NULL DEFAULT CURRENT_DATE,
  time              TIME,
  type              TEXT    DEFAULT '',
  location          TEXT    DEFAULT '',
  description       TEXT    DEFAULT '',
  action_taken      TEXT    DEFAULT '',
  witness           TEXT    DEFAULT '',
  reported_by       TEXT    DEFAULT '',
  parent_informed   BOOLEAN NOT NULL DEFAULT FALSE,
  parent_informed_at TIMESTAMPTZ,
  signed_by         TEXT    DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE accident_book (
  id                SERIAL PRIMARY KEY,
  nursery_id        INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id          INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name        TEXT    DEFAULT '',
  date              DATE    NOT NULL DEFAULT CURRENT_DATE,
  time              TIME,
  location          TEXT    DEFAULT '',
  description       TEXT    DEFAULT '',
  injury_type       TEXT    DEFAULT '',
  body_part         TEXT    DEFAULT '',
  first_aid_given   TEXT    DEFAULT '',
  first_aider       TEXT    DEFAULT '',
  witness           TEXT    DEFAULT '',
  parent_notified_at TIMESTAMPTZ,
  follow_up         TEXT    DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE calendar_events (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  start_date  DATE    NOT NULL,
  end_date    DATE,
  all_day     BOOLEAN NOT NULL DEFAULT TRUE,
  color       TEXT    NOT NULL DEFAULT '#4f8ef7',
  description TEXT    DEFAULT '',
  created_by  TEXT    DEFAULT ''
);

CREATE TABLE nursery_events (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL,
  title       TEXT    NOT NULL,
  description TEXT    DEFAULT '',
  date        DATE    NOT NULL DEFAULT CURRENT_DATE,
  created_by  TEXT    DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Migration 004 — EYFS / Learning

```sql
CREATE TABLE observations (
  id           SERIAL PRIMARY KEY,
  nursery_id   INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id     INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  child_name   TEXT    DEFAULT '',
  obs_date     DATE    NOT NULL DEFAULT CURRENT_DATE,
  areas        TEXT[]  NOT NULL DEFAULT '{}',
  text         TEXT    NOT NULL,
  photo_url    TEXT    DEFAULT '',
  is_shared    BOOLEAN NOT NULL DEFAULT FALSE,
  practitioner TEXT    DEFAULT '',
  score        INTEGER CHECK(score BETWEEN 1 AND 5),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE assessments (
  id           SERIAL PRIMARY KEY,
  nursery_id   INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id     INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  area         TEXT    NOT NULL,
  score        INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
  notes        TEXT    DEFAULT '',
  practitioner TEXT    DEFAULT '',
  assessed_at  DATE    NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reflections (
  id                    SERIAL PRIMARY KEY,
  nursery_id            INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id              INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date                  DATE    NOT NULL DEFAULT CURRENT_DATE,
  what_went_well        TEXT    DEFAULT '',
  areas_for_development TEXT    DEFAULT '',
  next_steps            TEXT    DEFAULT '',
  practitioner          TEXT    DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE planning (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  day         TEXT    DEFAULT 'Mon',
  time        TIME,
  category    TEXT    NOT NULL DEFAULT 'Other',
  room        TEXT    NOT NULL DEFAULT 'All',
  description TEXT    DEFAULT '',
  date        DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE send_flags (
  id           SERIAL PRIMARY KEY,
  nursery_id   INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id     INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  category     TEXT    NOT NULL,
  details      TEXT    DEFAULT '',
  support_plan TEXT    DEFAULT '',
  review_date  DATE,
  flagged_by   TEXT    DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Migration 005 — Scheduling

```sql
-- child_sessions: single source of truth for all bookings (recurring + one-off)
-- Recurring: end_date IS NULL or end_date > today
-- One-off:   end_date = start_date
CREATE TABLE child_sessions (
  id           SERIAL PRIMARY KEY,
  nursery_id   INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id     INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  day          TEXT    NOT NULL CHECK(day IN ('Mon','Tue','Wed','Thu','Fri')),
  session_type TEXT    NOT NULL DEFAULT 'Full Day'
                       CHECK(session_type IN ('AM','PM','Full Day','Custom')),
  start_time   TIME,
  end_time     TIME,
  funded_hours NUMERIC NOT NULL DEFAULT 0,
  fee_hours    NUMERIC NOT NULL DEFAULT 0,
  room         TEXT    DEFAULT '',
  start_date   DATE    NOT NULL,
  end_date     DATE,
  notes        TEXT    DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rota (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  staff_name  TEXT    NOT NULL,
  week_start  DATE    NOT NULL,
  mon         TEXT    DEFAULT '',
  tue         TEXT    DEFAULT '',
  wed         TEXT    DEFAULT '',
  thu         TEXT    DEFAULT '',
  fri         TEXT    DEFAULT '',
  UNIQUE(nursery_id, staff_name, week_start)
);

CREATE TABLE booking_requests (
  id            SERIAL PRIMARY KEY,
  nursery_id    INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id      INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name    TEXT    DEFAULT '',
  week_start    DATE,
  day           TEXT    DEFAULT '',
  session_type  TEXT    DEFAULT '',
  room          TEXT    DEFAULT '',
  parent_note   TEXT    DEFAULT '',
  capacity_note TEXT    DEFAULT '',
  status        TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
  decided_by    TEXT    DEFAULT '',
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE holiday_credit_requests (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id    INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name  TEXT    DEFAULT '',
  start_date  DATE    NOT NULL,
  end_date    DATE    NOT NULL,
  reason      TEXT    DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
  decided_by  TEXT    DEFAULT '',
  decided_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Migration 006 — Finance

```sql
CREATE TABLE invoices (
  id               SERIAL PRIMARY KEY,
  nursery_id       INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id         INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name       TEXT    DEFAULT '',
  invoice_ref      TEXT    DEFAULT '',
  period           TEXT    DEFAULT '',
  amount           NUMERIC NOT NULL DEFAULT 0,
  amount_paid      NUMERIC NOT NULL DEFAULT 0,
  status           TEXT    NOT NULL DEFAULT 'Pending'
                           CHECK(status IN ('Pending','Paid','Overdue','Cancelled')),
  due_date         DATE,
  -- line_items shape: Array<{ description: string, hours?: number, rate?: number, amount: number }>
  -- Example: [{ "description": "2026-06 sessions", "hours": 40, "rate": 5.50, "amount": 220.00 },
  --           { "description": "Registration fee", "amount": 50.00 }]
  -- amount is always required; hours and rate are optional (for session-based lines only)
  -- The invoice total = line_items.reduce((sum, l) => sum + l.amount, 0)
  line_items       JSONB   NOT NULL DEFAULT '[]',
  notes            TEXT    DEFAULT '',
  sent_at          TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  reminder_count   INTEGER NOT NULL DEFAULT 0,
  gocardless_payment_id TEXT DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  invoice_id  INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  child_id    INTEGER REFERENCES children(id) ON DELETE SET NULL,
  amount      NUMERIC NOT NULL,
  method      TEXT    NOT NULL DEFAULT 'manual',
  reference   TEXT    DEFAULT '',
  notes       TEXT    DEFAULT '',
  paid_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_mandates (
  id               SERIAL PRIMARY KEY,
  nursery_id       INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id         INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name       TEXT    DEFAULT '',
  mandate_id       TEXT    DEFAULT '',
  redirect_flow_id TEXT    DEFAULT '',   -- GoCardless redirect flow ID (stored on create)
  session_token    TEXT    DEFAULT '',   -- GoCardless session token (must match on complete)
  status           TEXT    NOT NULL DEFAULT 'pending',
  parent_email     TEXT    DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoice_jobs (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  run_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period      TEXT    DEFAULT '',
  count       INTEGER NOT NULL DEFAULT 0,
  total       NUMERIC NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'success',
  error       TEXT    DEFAULT ''
);

CREATE TABLE reminder_log (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  invoice_id  INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  to_email    TEXT    DEFAULT '',
  result      TEXT    DEFAULT ''
);

CREATE TABLE funding_periods (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  label       TEXT    NOT NULL,
  start_date  DATE    NOT NULL,
  end_date    DATE    NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE funding_claims (
  id                SERIAL PRIMARY KEY,
  nursery_id        INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  funding_period_id INTEGER REFERENCES funding_periods(id) ON DELETE CASCADE,
  child_id          INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name        TEXT    DEFAULT '',
  claimed_hours     NUMERIC NOT NULL DEFAULT 0,
  expected_hours    NUMERIC NOT NULL DEFAULT 0,
  status            TEXT    NOT NULL DEFAULT 'draft',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Migration 007 — Admissions

```sql
CREATE TABLE enquiries (
  id           SERIAL PRIMARY KEY,
  nursery_id   INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_name   TEXT    NOT NULL,
  parent_name  TEXT    DEFAULT '',
  email        TEXT    DEFAULT '',
  phone        TEXT    DEFAULT '',
  dob          DATE,
  room         TEXT    DEFAULT '',
  start_date   DATE,
  priority     TEXT    NOT NULL DEFAULT 'Normal' CHECK(priority IN ('Low','Normal','High','Urgent')),
  status       TEXT    NOT NULL DEFAULT 'New'
                       CHECK(status IN ('New','Contacted','Toured','Offered','Enrolled','Declined')),
  notes        TEXT    DEFAULT '',
  source       TEXT    DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE waiting_list (
  id             SERIAL PRIMARY KEY,
  nursery_id     INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_name     TEXT    NOT NULL,
  parent_name    TEXT    DEFAULT '',
  email          TEXT    DEFAULT '',
  phone          TEXT    DEFAULT '',
  dob            DATE,
  desired_start  DATE,
  room           TEXT    DEFAULT '',
  days_required  TEXT    DEFAULT '',
  notes          TEXT    DEFAULT '',
  position       INTEGER NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL DEFAULT 'waiting'
                         CHECK(status IN ('waiting','offered','enrolled','withdrawn')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Migration 008 — Communication

```sql
CREATE TABLE messages (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id    INTEGER REFERENCES children(id) ON DELETE SET NULL,
  from_role   TEXT    NOT NULL CHECK(from_role IN ('staff','parent')),
  from_name   TEXT    DEFAULT '',
  body        TEXT    NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expo push tokens (APNs + FCM handled by Expo's push service)
-- NOT web-push — no endpoint/p256dh/auth_key needed
CREATE TABLE push_subscriptions (
  id               SERIAL PRIMARY KEY,
  nursery_id       INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  user_id          UUID    REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token  TEXT    NOT NULL UNIQUE,  -- e.g. ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
  platform         TEXT    NOT NULL CHECK(platform IN ('ios','android')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_log (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  user_id     UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  type        TEXT    DEFAULT '',
  title       TEXT    DEFAULT '',
  body        TEXT    DEFAULT '',
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result      TEXT    DEFAULT ''
);
```

### Migration 009 — Consents & Documents

```sql
CREATE TABLE consent_templates (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  version     TEXT    NOT NULL DEFAULT '1.0',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE consent_forms (
  id             SERIAL PRIMARY KEY,
  nursery_id     INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  template_id    INTEGER REFERENCES consent_templates(id) ON DELETE SET NULL,
  child_id       INTEGER REFERENCES children(id) ON DELETE SET NULL,
  child_name     TEXT    DEFAULT '',
  signed_by      TEXT    DEFAULT '',
  signed_at      TIMESTAMPTZ,
  signature_data TEXT    DEFAULT '',
  status         TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','signed','declined')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE child_documents (
  id           SERIAL PRIMARY KEY,
  nursery_id   INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  child_id     INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  file_url     TEXT    NOT NULL,
  file_type    TEXT    DEFAULT '',
  uploaded_by  TEXT    DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Migration 010 — Compliance

```sql
CREATE TABLE risk_assessments (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  location    TEXT    DEFAULT '',
  reviewed_by TEXT    DEFAULT '',
  review_date DATE,
  next_review DATE,
  status      TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE risk_assessment_items (
  id                  SERIAL PRIMARY KEY,
  nursery_id          INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  risk_assessment_id  INTEGER NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
  hazard              TEXT    NOT NULL,
  who_affected        TEXT    DEFAULT '',
  existing_controls   TEXT    DEFAULT '',
  likelihood          INTEGER NOT NULL DEFAULT 3 CHECK(likelihood BETWEEN 1 AND 5),
  severity            INTEGER NOT NULL DEFAULT 3 CHECK(severity BETWEEN 1 AND 5),
  additional_controls TEXT    DEFAULT '',
  responsible_person  TEXT    DEFAULT '',
  target_date         DATE
);

CREATE TABLE policies (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  category    TEXT    DEFAULT '',
  content     TEXT    DEFAULT '',
  version     TEXT    NOT NULL DEFAULT '1.0',
  reviewed_at DATE,
  next_review DATE,
  status      TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE policy_signoffs (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  policy_id   INTEGER NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  staff_name  TEXT    NOT NULL,
  signed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_training (
  id              SERIAL PRIMARY KEY,
  nursery_id      INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  staff_id        INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  staff_name      TEXT    DEFAULT '',
  course_name     TEXT    NOT NULL,
  provider        TEXT    DEFAULT '',
  completed_date  DATE,
  expiry_date     DATE,
  certificate_url TEXT    DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'completed' CHECK(status IN ('planned','completed','expired')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_appraisals (
  id             SERIAL PRIMARY KEY,
  nursery_id     INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  staff_id       INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  staff_name     TEXT    DEFAULT '',
  date           DATE    NOT NULL DEFAULT CURRENT_DATE,
  appraiser      TEXT    DEFAULT '',
  strengths      TEXT    DEFAULT '',
  areas_for_dev  TEXT    DEFAULT '',
  targets        TEXT    DEFAULT '',
  next_review    DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE qualifications (
  id              SERIAL PRIMARY KEY,
  nursery_id      INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  staff_id        INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  staff_name      TEXT    DEFAULT '',
  qualification   TEXT    NOT NULL,
  awarding_body   TEXT    DEFAULT '',
  date_achieved   DATE,
  expiry_date     DATE,
  level           TEXT    DEFAULT '',
  certificate_url TEXT    DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wellbeing_checkins (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  staff_id    INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  staff_name  TEXT    DEFAULT '',
  date        DATE    NOT NULL DEFAULT CURRENT_DATE,
  mood        INTEGER NOT NULL CHECK(mood BETWEEN 1 AND 5),
  workload    INTEGER NOT NULL CHECK(workload BETWEEN 1 AND 5),
  support     INTEGER NOT NULL CHECK(support BETWEEN 1 AND 5),
  notes       TEXT    DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Migration 011 — GDPR

```sql
CREATE TABLE gdpr_settings (
  id                  SERIAL PRIMARY KEY,
  nursery_id          INTEGER NOT NULL UNIQUE REFERENCES nurseries(id) ON DELETE CASCADE,
  data_controller     TEXT    DEFAULT '',
  dpo_name            TEXT    DEFAULT '',
  dpo_email           TEXT    DEFAULT '',
  retention_children  INTEGER NOT NULL DEFAULT 3,
  retention_staff     INTEGER NOT NULL DEFAULT 7,
  retention_cctv      INTEGER NOT NULL DEFAULT 30,
  lawful_basis        TEXT    NOT NULL DEFAULT 'contract',
  last_audit_date     DATE,
  next_audit_date     DATE
);

CREATE TABLE sar_requests (
  id              SERIAL PRIMARY KEY,
  nursery_id      INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  requester_name  TEXT    NOT NULL,
  requester_email TEXT    DEFAULT '',
  subject         TEXT    DEFAULT '',
  received_at     DATE    NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  status          TEXT    NOT NULL DEFAULT 'received'
                          CHECK(status IN ('received','in_progress','completed','refused')),
  notes           TEXT    DEFAULT '',
  completed_at    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE erasure_requests (
  id           SERIAL PRIMARY KEY,
  nursery_id   INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  data_subject TEXT    NOT NULL,
  email        TEXT    DEFAULT '',
  reason       TEXT    DEFAULT '',
  requested_at DATE    NOT NULL DEFAULT CURRENT_DATE,
  due_date     DATE,
  status       TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','refused')),
  completed_at DATE,
  notes        TEXT    DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE retention_policies (
  id                      SERIAL PRIMARY KEY,
  nursery_id              INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  data_category           TEXT    NOT NULL,
  retention_period_years  INTEGER NOT NULL,
  legal_basis             TEXT    DEFAULT '',
  notes                   TEXT    DEFAULT '',
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE privacy_notice_ack (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  user_id     UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   TEXT    DEFAULT '',
  version     TEXT    NOT NULL DEFAULT '1.0',
  acked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Migration 012 — Audit

```sql
CREATE TABLE audit_log (
  id          SERIAL PRIMARY KEY,
  nursery_id  INTEGER NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  user_id     UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   TEXT    DEFAULT '',
  action      TEXT    NOT NULL,
  table_name  TEXT    DEFAULT '',
  record_id   INTEGER,
  details     JSONB   NOT NULL DEFAULT '{}',
  ip_address  TEXT    DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Migration 013 — RLS on all tenant tables

Apply this block for every table with a `nursery_id` column:

```sql
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'children','relatives','rooms','staff','attendance','daily_logs',
    'medications','incidents','accident_book','calendar_events','nursery_events',
    'observations','assessments','reflections','planning','send_flags',
    'child_sessions','rota','booking_requests','holiday_credit_requests',
    'invoices','payments','payment_mandates','invoice_jobs','reminder_log',
    'funding_periods','funding_claims','enquiries','waiting_list',
    'messages','push_subscriptions','notification_log',
    'consent_templates','consent_forms','child_documents',
    'risk_assessments','risk_assessment_items','policies','policy_signoffs',
    'staff_training','staff_appraisals','qualifications','wellbeing_checkins',
    'gdpr_settings','sar_requests','erasure_requests','retention_policies',
    'privacy_notice_ack','audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'DROP POLICY IF EXISTS %I_tenant_isolation ON %I',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_tenant_isolation ON %I
       USING (nursery_id = (auth.jwt()->>''user_metadata''->>''nursery_id'')::int)',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- Parent-child scoping helper macro (same pattern on every child-scoped table)
-- Uses @> to_jsonb() — NOT ::int[] cast, which fails on JSONB arrays
-- Staff/managers pass through; parents are filtered to their own children only

CREATE POLICY messages_parent_child ON messages
  USING (
    nursery_id = (auth.jwt()->'user_metadata'->>'nursery_id')::int
    AND (
      (auth.jwt()->'user_metadata'->>'role') <> 'parent'
      OR (auth.jwt()->'user_metadata'->'child_ids') @> to_jsonb(child_id)
    )
  );

CREATE POLICY daily_logs_parent_child ON daily_logs
  USING (
    nursery_id = (auth.jwt()->'user_metadata'->>'nursery_id')::int
    AND (
      (auth.jwt()->'user_metadata'->>'role') <> 'parent'
      OR (auth.jwt()->'user_metadata'->'child_ids') @> to_jsonb(child_id)
    )
  );

-- Apply the IDENTICAL pattern (copy-paste, change table name) to:
-- observations, assessments, consent_forms, invoices, attendance,
-- medications, incidents, child_sessions, booking_requests,
-- holiday_credit_requests, daily_logs (already above)
-- Template:
-- CREATE POLICY {table}_parent_child ON {table}
--   USING (
--     nursery_id = (auth.jwt()->'user_metadata'->>'nursery_id')::int
--     AND (
--       (auth.jwt()->'user_metadata'->>'role') <> 'parent'
--       OR (auth.jwt()->'user_metadata'->'child_ids') @> to_jsonb(child_id)
--     )
--   );
```

### Migration 014 — app_user role

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
```

### Migration 015 — Supabase Realtime publication

`postgres_changes` subscriptions silently receive zero events unless each table is added to the `supabase_realtime` Postgres publication. This is separate from RLS — a table can have RLS enabled and still not fire Realtime events if it's not in the publication.

```sql
-- Add only the tables that need real-time subscriptions.
-- Do NOT add all tables — unnecessary replication overhead.
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE booking_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE holiday_credit_requests;
```

Verify in Supabase dashboard: Database → Replication → `supabase_realtime` publication → tables list. If a Realtime subscription silently receives no events, this is the first thing to check.

### Migration 016 — Indexes

```sql
-- Tenant isolation — every query filters by nursery_id
CREATE INDEX IF NOT EXISTS idx_children_nursery          ON children(nursery_id);
CREATE INDEX IF NOT EXISTS idx_attendance_nursery_date   ON attendance(nursery_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_child_date     ON attendance(child_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_child_date     ON daily_logs(child_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_nursery_status   ON invoices(nursery_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_child            ON invoices(child_id);
CREATE INDEX IF NOT EXISTS idx_messages_nursery_child    ON messages(nursery_id, child_id);
CREATE INDEX IF NOT EXISTS idx_messages_created          ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_child_sessions_child      ON child_sessions(child_id);
CREATE INDEX IF NOT EXISTS idx_child_sessions_nursery_day ON child_sessions(nursery_id, day);
CREATE INDEX IF NOT EXISTS idx_observations_child        ON observations(child_id, obs_date DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_child         ON assessments(child_id);
CREATE INDEX IF NOT EXISTS idx_push_token                ON push_subscriptions(expo_push_token);
CREATE INDEX IF NOT EXISTS idx_user_children_user        ON user_children(user_id);
CREATE INDEX IF NOT EXISTS idx_user_children_child       ON user_children(child_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_nursery         ON audit_log(nursery_id, created_at DESC);
```

---

## Trial & Onboarding Flow

### New nursery registration

1. Manager visits the staff web app and clicks "Start free trial"
2. `POST /api/auth/register-nursery` — creates:
   - `nurseries` row: `plan='seedling'`, `trial_ends_at = now() + 14 days`
   - `users` row: `role='manager'`
   - Supabase Auth user with `user_metadata: { nursery_id, role: 'manager' }`
3. Supabase sends email verification automatically
4. Manager is logged in and lands on the Dashboard — full access for 14 days

### Trial expiry

The `trial` middleware (runs after `requireAuth` on all non-auth routes) checks:

```typescript
export const requireActiveSubscription = createMiddleware(async (c, next) => {
  const { nurseryId } = c.get('user');
  const { rows } = await pool.query(
    'SELECT plan, trial_ends_at, stripe_subscription_id FROM nurseries WHERE id=$1', [nurseryId]
  );
  const n = rows[0];
  const trialActive = n.trial_ends_at && new Date(n.trial_ends_at) > new Date();
  const subscribed = !!n.stripe_subscription_id;
  if (!trialActive && !subscribed && n.plan !== 'cancelled') {
    return c.json({ error: 'trial_expired', message: 'Your trial has ended. Please upgrade to continue.' }, 402);
  }
  await next();
});
```

The staff app catches `402` globally in the TanStack Query error handler and redirects to `/billing`.

### Upgrade flow

1. Manager goes to `/billing` and clicks "Upgrade"
2. `POST /api/billing/checkout` — creates a Stripe Checkout session with the chosen price ID, `success_url`, `cancel_url`, and `client_reference_id = nursery_id`
3. Manager is redirected to Stripe Checkout (hosted page)
4. On success, Stripe fires `checkout.session.completed` webhook → `POST /api/billing/webhook`
5. Webhook handler updates `nurseries.plan`, `stripe_subscription_id`, `plan_started_at`
6. Manager is redirected back to the app — full access unlocked

---

## API Server (Hono)

### TypeScript context type declaration

Every Hono router must be typed so `c.get('user')` compiles. Declare once and import everywhere:

```typescript
// apps/api/src/types.ts
export type AuthUser = {
  id: string;
  nurseryId: number;
  role: 'manager' | 'staff' | 'parent';
  name: string;
  childIds: number[];
};

export type HonoEnv = {
  Variables: { user: AuthUser };
};
```

```typescript
// apps/api/src/middleware/auth.ts
import { createMiddleware } from 'hono/factory';
import type { HonoEnv } from '../types';

export const requireAuth = createMiddleware<HonoEnv>(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const payload = await verifySupabaseJwt(token, process.env.JWT_SECRET!);
    c.set('user', {
      id: payload.sub,
      nurseryId: Number(payload.user_metadata?.nursery_id),
      role: payload.user_metadata?.role as AuthUser['role'],
      name: payload.user_metadata?.name ?? '',
      childIds: (payload.user_metadata?.child_ids ?? []).map(Number),
    });
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});
```

Every route file uses `new Hono<HonoEnv>()` — not `new Hono()`:

```typescript
// apps/api/src/routes/children.ts — and every other route file
import { Hono } from 'hono';
import type { HonoEnv } from '../types';

const app = new Hono<HonoEnv>(); // <-- required for c.get('user') to typecheck
```

### Standard API error response format

All error responses use this shape — no exceptions:

```typescript
// Error response
{ "error": "human-readable message", "code": "MACHINE_CODE" }

// Examples:
{ "error": "Unauthorized", "code": "UNAUTHORIZED" }               // 401
{ "error": "Forbidden", "code": "FORBIDDEN" }                    // 403
{ "error": "Child not found", "code": "NOT_FOUND" }              // 404
{ "error": "trial_expired", "code": "TRIAL_EXPIRED" }            // 402
{ "error": "Validation failed", "code": "VALIDATION_ERROR",
  "issues": [{ "field": "name", "message": "Required" }] }       // 422
{ "error": "Internal server error", "code": "INTERNAL_ERROR" }   // 500
```

Add a global error handler in `index.ts`:

```typescript
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
});
```

The frontend catches these by `code` field, not HTTP status alone, so error messages can be localised independently of status codes.

### `requireRole` middleware

```typescript
// apps/api/src/middleware/requireRole.ts
import { createMiddleware } from 'hono/factory';
import { pool } from '@sprout/db/pool';  // required by requirePlanFeature
import type { HonoEnv } from '../types';

type Role = 'manager' | 'staff' | 'parent';
type PlanFeature = 'autoInvoice' | 'compliance' | 'staffDev' | 'ai';

const PLAN_FEATURES: Record<string, Record<PlanFeature, boolean>> = {
  seedling: { autoInvoice: false, compliance: false, staffDev: false, ai: false },
  blossom:  { autoInvoice: true,  compliance: true,  staffDev: true,  ai: false },
  grove:    { autoInvoice: true,  compliance: true,  staffDev: true,  ai: true  },
  forest:   { autoInvoice: true,  compliance: true,  staffDev: true,  ai: true  },
};

// Role check — pass one or more allowed roles
export function requireRole(...roles: Role[]) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const user = c.get('user');
    if (!roles.includes(user.role)) {
      return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
    }
    await next();
  });
}

// Plan-feature check — use alongside requireRole for gated features
export function requirePlanFeature(feature: PlanFeature) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const { rows } = await pool.query(
      'SELECT plan FROM nurseries WHERE id=$1', [c.get('user').nurseryId]
    );
    const plan = rows[0]?.plan ?? 'seedling';
    if (!PLAN_FEATURES[plan]?.[feature]) {
      return c.json(
        { error: `This feature requires a higher plan`, code: 'PLAN_UPGRADE_REQUIRED', requiredFeature: feature },
        402
      );
    }
    await next();
  });
}
```

Usage:

```typescript
// Manager only
app.post('/', requireRole('manager'), ...)

// Manager or staff
app.post('/observations', requireRole('manager', 'staff'), ...)

// Manager only + Blossom+ plan
app.get('/compliance', requireRole('manager'), requirePlanFeature('compliance'), ...)

// Manager only + Grove+ plan
app.post('/ai/observation', requireRole('manager', 'staff'), requirePlanFeature('ai'), ...)
```

### Route example

```typescript
// apps/api/src/routes/children.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { childCreateSchema } from '@sprout/schemas';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

const app = new Hono<HonoEnv>();
app.use('*', requireAuth);

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT * FROM children WHERE nursery_id=$1 ORDER BY name', [nurseryId])
  );
  return c.json(rows);
});

app.post('/', requireRole('manager', 'staff'), zValidator('json', childCreateSchema), async (c) => {
  const { nurseryId } = c.get('user');
  const body = c.req.valid('json');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      'INSERT INTO children (nursery_id,name,dob,room,gender,allergy,medical_info,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [nurseryId, body.name, body.dob, body.room, body.gender, body.allergy, body.medical_info, body.notes]
    )
  );
  return c.json(rows[0], 201);
});

// ... put, delete
export default app;
```

### Hono app entry

```typescript
// apps/api/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { rateLimiter } from 'hono-rate-limiter';
import { logger } from 'hono/logger';
import { Bun } from 'bun';

import children from './routes/children';
// ... all other routers

const app = new Hono();

// CORS: staff web app only. React Native does not send Origin headers,
// so the parent mobile app does not need to be listed here.
app.use('*', cors({ origin: [process.env.STAFF_APP_URL!] }));
app.use('*', logger());
app.use('/api/*', rateLimiter({ windowMs: 15 * 60 * 1000, limit: 600 }));

app.get('/health', (c) => c.json({ ok: true }));

app.route('/api/auth', auth);
app.route('/api/children', children);
app.route('/api/relatives', relatives);
// ... mount all 40+ routers

export default { port: process.env.PORT || 3000, fetch: app.fetch };
```

---

## Subscription Plans

```typescript
// packages/schemas/src/plans.ts
export const PLANS = {
  seedling: {
    name: 'Seedling', priceMonthly: 49, priceAnnual: 490, childrenLimit: 20,
    features: { autoInvoice: false, compliance: false, staffDev: false, ai: false }
  },
  blossom: {
    name: 'Blossom', priceMonthly: 99, priceAnnual: 990, childrenLimit: 50,
    features: { autoInvoice: true, compliance: true, staffDev: true, ai: false }
  },
  grove: {
    name: 'Grove', priceMonthly: 179, priceAnnual: 1790, childrenLimit: 100,
    features: { autoInvoice: true, compliance: true, staffDev: true, ai: true }
  },
  forest: {
    name: 'Forest', priceMonthly: 299, priceAnnual: 2990, childrenLimit: null,
    features: { autoInvoice: true, compliance: true, staffDev: true, ai: true }
  },
} as const;

export type PlanKey = keyof typeof PLANS;
```

Feature gate in the frontend:

```typescript
// apps/staff/src/hooks/usePlan.ts
export function usePlan() {
  const plan = useStore((s) => s.nursery?.plan ?? 'seedling');
  const features = PLANS[plan as PlanKey]?.features ?? PLANS.seedling.features;
  const can = (feature: keyof typeof features) => features[feature];
  return { plan, can };
}

// Usage in a page:
const { can } = usePlan();
if (!can('ai')) return <UpgradePrompt feature="AI Assistant" requiredPlan="Grove" />;
```

---

## Parent API Routes (`apps/api/src/routes/parent.ts`)

All routes require `requireAuth` + `requireRole('parent')`. The `childIds` array from the JWT is used to scope every query — a parent only ever sees data for their own children.

```
GET  /api/parent/me
     → { user, children[], nursery }
     children = rows from user_children JOIN children for this user_id

GET  /api/parent/children
     → Child[]   (same as /me but children only — used to populate child-switcher UI)

GET  /api/parent/daily-logs?childId=&date=
     → DailyLog[]  filtered to childId IN childIds AND date

GET  /api/parent/report-card?childId=&date=
     → { attendance, dailyLogs[], mood, mealsCount, napsCount, nappiesCount }
     summary view used on the Daily tab

GET  /api/parent/observations?childId=&page=&limit=
     → paginated Observation[]  where is_shared=true AND childId IN childIds

GET  /api/parent/assessments?childId=
     → Assessment[]  latest score per area for this child

GET  /api/parent/invoices?page=&limit=&status=
     → paginated Invoice[]  where child_id IN childIds

GET  /api/parent/messages?childId=&page=&limit=
     → paginated Message[]  where child_id = childId (must be in childIds)

POST /api/parent/messages
     body: { childId, body }
     → Message  inserts with from_role='parent', triggers push to staff

GET  /api/parent/unread
     → { count: number }  unread messages where from_role='staff' AND is_read=false

PATCH /api/parent/messages/read?childId=
     → marks all staff messages for this child as is_read=true

GET  /api/parent/consent-forms?childId=
     → ConsentForm[]  where status='pending' AND child_id IN childIds

PATCH /api/parent/consent-forms/:id
     body: { signatureData, signedBy }
     → updates status='signed', signed_at, signature_data

GET  /api/parent/child-sessions?childId=
     → ChildSession[]  active recurring sessions for this child

POST /api/parent/booking-requests
     body: { childId, day, sessionType, weekStart, parentNote }
     → BookingRequest

POST /api/parent/holiday-requests
     body: { childId, startDate, endDate, reason }
     → HolidayRequest

GET  /api/parent/newsfeed
     → NurseryEvent[]  latest 20 events for this nursery (no child scoping)

POST /api/parent/push-token
     body: { expoPushToken, platform }
     → upserts push_subscriptions row for this user
```

---

## Key Business Logic Services

### `sessionPatterns.ts` — child_sessions calculations

```typescript
const DAY_INDEX: Record<string, number> = { Mon:1, Tue:2, Wed:3, Thu:4, Fri:5 };

export function countWeekdayOccurrences(start: string, end: string, day: string): number {
  const target = DAY_INDEX[day];
  if (!target || !start || !end) return 0;
  const cur = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');
  let count = 0;
  while (cur <= endDate) {
    if (cur.getUTCDay() === target) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

export function expandPatternsForRange(
  patterns: ChildSession[], rangeStart: string, rangeEnd: string
): { feeHours: number; fundedHours: number } {
  let feeHours = 0, fundedHours = 0;
  for (const pat of patterns) {
    const overlapStart = pat.start_date > rangeStart ? pat.start_date : rangeStart;
    const overlapEnd = (pat.end_date && pat.end_date < rangeEnd) ? pat.end_date : rangeEnd;
    const n = countWeekdayOccurrences(overlapStart, overlapEnd, pat.day);
    feeHours += (pat.fee_hours ?? 0) * n;
    fundedHours += (pat.funded_hours ?? 0) * n;
  }
  return { feeHours, fundedHours };
}
```

### `ageBands.ts`

```typescript
export type AgeBand = 'under2' | '2yo' | '3to4';

export function ageBandForDob(dob: string | null, asOf?: Date): AgeBand {
  if (!dob) return '3to4';
  const birth = new Date(dob);
  const ref = asOf ?? new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  if (age < 2) return 'under2';
  if (age === 2) return '2yo';
  return '3to4';
}

export function ratesForBand(nursery: Nursery, band: AgeBand) {
  const map = { under2: nursery.fee_rate_under2, '2yo': nursery.fee_rate_2yo, '3to4': nursery.fee_rate_3to4 };
  const fundingMap = { under2: nursery.funding_rate_under2, '2yo': nursery.funding_rate_2yo, '3to4': nursery.funding_rate_3to4 };
  return { feeRate: map[band] ?? nursery.fee_rate, fundingRate: fundingMap[band] ?? 0 };
}
```

---

## Frontend Conventions

### `api.ts` — authenticated fetch wrapper

Both apps need a thin wrapper that attaches the Supabase Bearer token to every request and throws on non-2xx responses. Without this, every query function reimplements auth header logic differently.

**Staff app** (`apps/staff/src/api.ts`):

```typescript
import { supabase } from '@sprout/db';

const BASE = import.meta.env.VITE_API_URL;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText, code: 'UNKNOWN' }));
    throw Object.assign(new Error(err.error), { code: err.code, status: res.status });
  }
  return res.json() as Promise<T>;
}

export const api = {
  get:    <T>(path: string)                  => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown)   => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown)   => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body: unknown)   => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                  => request<T>('DELETE', path),
};
```

**Parent app** (`apps/parent/src/api.ts`) — identical except uses `EXPO_PUBLIC_API_URL` and the native Supabase client:

```typescript
import { supabase } from '@sprout/db/native';

const BASE = process.env.EXPO_PUBLIC_API_URL;

// Same request() function as above — only BASE and supabase import differ
export const api = { get, post, put, patch, delete: del };
```

TanStack Query catches errors thrown by the wrapper and exposes them via `query.error`. Wire up a global handler in the QueryClient so every route automatically handles auth expiry and trial expiry without per-page boilerplate:

```typescript
// apps/staff/src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Never retry auth or billing errors — they won't resolve on retry
        if (['UNAUTHORIZED', 'FORBIDDEN', 'TRIAL_EXPIRED', 'PLAN_UPGRADE_REQUIRED']
              .includes(error?.code)) return false;
        return failureCount < 2;
      },
    },
  },
});

// Global error boundary — catches all query/mutation errors
queryClient.setDefaultOptions({
  mutations: {
    onError: (error: any) => {
      if (error?.code === 'UNAUTHORIZED') {
        supabase.auth.signOut();
        router.navigate({ to: '/login' });
      } else if (error?.code === 'TRIAL_EXPIRED' || error?.code === 'PLAN_UPGRADE_REQUIRED') {
        router.navigate({ to: '/billing' });
      }
    },
  },
});

// For query errors, use the onError in individual hooks or a global observer:
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'observerResultsUpdated') return;
  const error = event.query?.state?.error as any;
  if (error?.code === 'UNAUTHORIZED') {
    supabase.auth.signOut();
    router.navigate({ to: '/login' });
  }
});
```

The parent native app uses the same pattern but navigates via Expo Router: `router.replace('/(auth)/login')` instead of TanStack Router.

### TanStack Query pattern

```typescript
// apps/staff/src/features/children/useChildren.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api'; // thin fetch wrapper with auth header

export const childrenKeys = {
  all: ['children'] as const,
  list: () => [...childrenKeys.all, 'list'] as const,
  detail: (id: number) => [...childrenKeys.all, id] as const,
};

export function useChildren() {
  return useQuery({ queryKey: childrenKeys.list(), queryFn: () => api.get('/children') });
}

export function useCreateChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateChildInput) => api.post('/children', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: childrenKeys.list() }),
  });
}
```

### Form pattern

```typescript
// apps/staff/src/features/children/ChildForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { childCreateSchema, type ChildCreateInput } from '@sprout/schemas';

export function ChildForm({ onSubmit }: { onSubmit: (data: ChildCreateInput) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<ChildCreateInput>({
    resolver: zodResolver(childCreateSchema),
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Name" error={errors.name?.message}>
        <input {...register('name')} className="input" />
      </Field>
      <Field label="Date of Birth" error={errors.dob?.message}>
        <input type="date" {...register('dob')} className="input" />
      </Field>
      {/* ... */}
      <button type="submit" className="btn-primary">Save</button>
    </form>
  );
}
```

### Shared component library (`packages/ui`)

Export these components from `@sprout/ui`. This package is **staff web app only** — React Native uses View/Text/Pressable which is incompatible with these HTML-based components. The parent app has its own component folder at `apps/parent/src/components/`.

- `<StatCard icon label value onClick? />` — KPI card with coloured icon
- `<DataTable columns data loading emptyState />` — sortable, filterable table
- `<Modal open onClose title children footer />` — accessible modal
- `<Badge variant="success|warning|danger|info|muted" />` — status badge
- `<Avatar name size="sm|md|lg" photoUrl? />` — initials chip with deterministic colour
- `<Toast />` — success/error notifications via a `useToast()` hook
- `<EmptyState icon title description action? />` — zero-state placeholder
- `<ProgressBar value max color? />` — horizontal progress
- `<Field label error children />` — form field wrapper with label + error

### `packages/config` — tsconfig bases

Three base configs. Each app extends the one matching its runtime.

**`packages/config/tsconfig.base.json`** — shared strictness settings:
```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleResolution": "bundler",
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**`packages/config/tsconfig.web.json`** — for `apps/staff` and `packages/ui`:
```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "jsx": "react-jsx"
  }
}
```

**`packages/config/tsconfig.native.json`** — for `apps/parent`:
```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "CommonJS",
    "jsx": "react-native",
    "allowSyntheticDefaultImports": true
  }
}
```

**`packages/config/tsconfig.node.json`** — for `apps/api` and `packages/db` (pool/admin):
```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext"
  }
}
```

No `jsx` field — the API is pure Hono TypeScript, no JSX.

Each app's `tsconfig.json` extends the matching base: `{ "extends": "@sprout/config/tsconfig.web.json" }` etc.

### Tailwind tokens (in `packages/config/tailwind.config.ts`)

```typescript
export const sproutColors = {
  primary:  { DEFAULT: '#4f8ef7', light: '#e8f0fe' },
  success:  { DEFAULT: '#28c76f', light: '#e8f8f0' },
  warning:  { DEFAULT: '#ff9f43', light: '#fff5e8' },
  danger:   { DEFAULT: '#ea5455', light: '#fde8e8' },
  info:     { DEFAULT: '#00cfe8', light: '#e0f9fc' },
  muted:    '#8a8fa3',
  border:   '#e8eaf0',
  surface:  '#ffffff',
  bg:       '#f4f6fb',
  sidebar:  '#1a1d27',
};
```

---

## Staff App Pages — Detailed Spec

### Dashboard
- Stat cards: Active Children, Present Today (%), Overdue Invoices (£), Unread Messages
- Upcoming calendar events (next 7 days) — click → calendar page
- EYFS average score badge
- Quick-action buttons: Open Register, New Child, New Invoice, Message Parent

### Children (list)
- Table: Name | Room | DOB | Age | Status | Actions
- Filter by room and status; search by name
- Add/Edit modal with all fields; photo upload to Supabase Storage
- Click row → child detail page

### Child Detail (`/children/:childId`)
- Tabs: Profile | Documents | Sessions | Observations | Assessments | SEND
- Profile: all fields, editable inline
- Documents: upload/download, delete
- Sessions: weekly child_sessions grid for this child; add/edit/delete session patterns
- Observations: journal entries for this child; add + AI draft
- Assessments: scores per EYFS area
- SEND: active flags for this child

### Relatives
- Grouped by child; shows all contacts/relatives
- Primary contact + emergency contact toggles
- Add/edit/delete relative inline

### Rooms
- Card grid: Room name, capacity, occupancy bar (current children / capacity)
- Edit room details; colour picker

### Staff
- Table: Name | Role | Room | Status
- Add/edit/deactivate; filter by room and status

### Enquiries (manager only)
- Kanban: New → Contacted → Toured → Offered → Enrolled / Declined
- Priority badge; add notes; convert to waiting list or child

### Waiting List (manager only)
- Ordered list with drag-to-reorder
- Mark as offered / enrolled / withdrawn; export CSV

### Consent Forms (manager only)
- Template management: create, version, activate/archive
- Per-child tracking: pending / signed / declined
- Bulk send to all active children

### Booking Requests (manager only)
- Pending requests table: child, day, session type, parent note, capacity status
- Approve / Decline with optional comment; auto-creates child_session on approve

### Messages
- Left sidebar: conversation per child (sorted by latest, unread dot)
- Thread: grouped consecutive messages, relative timestamps, hover-reveal delete
- Compose: rounded input + send button
- Realtime via Supabase Realtime channel subscription
- Nav badge shows unread count (also realtime)

### Rota
- Weekly grid: staff rows × Mon–Fri columns
- Editable cells (shift times / Off)
- Week navigation; print view

### Sessions
- Weekly grid: children rows × Mon–Fri columns
- Shows session type badge per cell based on child_sessions active on that date
- Click cell → add/edit session for that child + day
- Room capacity overlay: rooms × days showing booked vs capacity
- Week navigation

### Planning
- Weekly activity grid: days × time slots
- Add/edit/delete activities (title, category, room, description, time)
- Print week plan button

### Monitoring
- Daily check grid: children × monitoring categories (mood, meals, toileting, outdoor, activity)
- Click-to-mark; summary counts at column bottom
- Date picker; export as PDF

### Live Register
- Cards for children expected today (child_sessions active on today's weekday)
- Sign In button (captures time + who signed in); Sign Out button; Absent modal
- Running count: present / expected / absent
- Realtime: subscribe to `attendance` table so sign-ins from other devices appear instantly:
  ```typescript
  supabase.channel(`register:nursery:${nurseryId}`)
    .on('postgres_changes', {
      event: 'UPDATE',               // sign-in/out updates existing rows
      schema: 'public',
      table: 'attendance',
      filter: `nursery_id=eq.${nurseryId}`,
    }, () => queryClient.invalidateQueries({ queryKey: ['attendance', today] }))
    .subscribe();
  ```

### Fire Register
- Fast-loading read-only list: child name + today's attendance status
- Optimised for tablet/phone; large print button

### Calendar
- Monthly calendar view (custom, no library dependency)
- Add/edit/delete events; iCal export
- Event colour picker

### Assessment
- Per-child EYFS scores: 7 areas × 5-point scale
- Progress bars; add assessment modal (child, area, score, notes, practitioner)
- AI draft from rough notes or photo (Grove+ plan gate)
- Group view: average per area across all children, radar-style display

### Daily Logs
- Timeline of logs for selected child + date (default: today)
- Add log entry: type (meal/sleep/nappy/mood/activity/note), details, time
- Filter by child and date; delete

### Learning Journal
- Observation cards with photo thumbnails and EYFS area tags
- Filter by child, area, date range; search text
- Add observation modal: child, date, areas (multi-select checkboxes), text, optional photo, share-with-parent toggle
- AI draft from rough notes + optional photo (Grove+ plan)

### Reflections
- Per-child reflection records: what went well, areas for development, next steps
- Add/edit/delete; filter by child and date

### SEND
- SEND register: children with active flags grouped by category
- Per-child: categories, support plan, review date; add/edit/close flag

### Newsfeed
- Chronological nursery announcements (nursery_events)
- Add/delete; parents see this on Parent App Home

### Medications
- Active medication records per child
- Add: name, dose, frequency, route, prescribed by, dates
- Record dose: time given, given by, witness, refused reason
- Full history log per medication

### Incidents
- Incident log with child, date/time, type, location, description, action taken, witness
- Parent-informed toggle with timestamp; filter by child and date

### Accident Book
- Formal accident records: injury type, body part, first aid, first aider
- Parent notification timestamp; free-text follow-up
- Print single accident report (printable layout)

### Invoices (manager only)
- Full invoice list: filter by status, child, date range; search
- Add invoice: child, period, line items (description + amount rows), due date, notes
- Run monthly auto-invoicing: generates invoices for all active children from child_sessions × age-band rates; previews total before confirming
- Mark paid; send reminder email; cancel; delete
- Print invoice: full printable layout with nursery logo, line items, totals, bank details
- GoCardless: collect via Direct Debit for children with mandates
- Invoice job history table (invoice_jobs)

### Finance (manager only)
- KPI cards: Collected | Pending | Overdue | Collection Rate %
- Quick-action buttons: View Invoices, Run Monthly Invoicing, Create Invoice, Revenue Report →, Collect Direct Debits
- Overdue invoices priority list: child, amount, one-click Send Reminder

### Revenue Report (manager only)
- Period selector: 3M / 6M / 12M / 24M
- KPIs: Total Invoiced, Collected, Collection Rate, Outstanding, Avg per Child
- SVG bar chart: monthly invoiced vs collected bars
- Debt Aging Analysis: 0–30 / 31–60 / 61–90 / 90+ days
- Outstanding by Child table
- Export: CSV and Print (PDF via browser print)

### Funded Hours Report (manager only)
- Week picker
- Table: each active child × funded hours per day (from child_sessions)
- Total funded hours for week; LA rate input; expected funding amount
- Export CSV for LA submission

### Funding Reconciliation (manager only)
- Funding period management (create, label, date range)
- Per-child claimed vs expected funded hours
- Status: draft / submitted / paid; notes field

### Reports (manager only)
- Stat row: Attendance Today % | Active Children | Activities (30 days) | Avg EYFS Score
- Attendance breakdown chart: present / absent / not yet marked bars
- Children by Room horizontal bars
- EYFS by Area grid: area × average score × count, colour-coded

### Ofsted Mode (manager only)
- Read-only compliance summary: Safeguarding, Attendance, Staffing Ratios, Policies, Risk Assessments, Training
- RAG status (green/amber/red) per section based on data
- Print-optimised layout

### Compliance Hub (manager only, Blossom+)
- **Policies tab**: list + version + status; add/edit/archive; staff sign-off tracking
- **Risk Assessments tab**: list with risk scores; add/edit items; review dates
- **Training tab**: training matrix by staff; expiry alerts; add/edit records

### GDPR (manager only)
- Settings: data controller, DPO, retention periods, lawful basis, audit dates
- SAR tracker: received → in progress → completed / refused
- Erasure request tracker
- Retention policy table
- Privacy notice acknowledgement log

### Staff Development (manager only, Blossom+)
- Expiring/due training dashboard (next 30 days)
- Per-staff profile: qualifications, training history, appraisals, wellbeing trend chart
- Add training, appraisal, wellbeing check-in
- Export training matrix as CSV

### Settings (manager only)
- Nursery profile: name, address, phone, email, Ofsted number, logo upload
- Fee rates per age band (Under 2s, 2-year-olds, 3–4 year olds) + funding rates
- Auto-invoice settings: enable toggle, day of month
- Reminder settings: enable, days overdue, interval days
- SMTP: host, port, username, password, from address; test connection button

### Staff Accounts (manager only)
- All users for this nursery (staff + parents)
- Add staff account (name, email, role); add parent account (link to child)
- Reset password (Supabase Auth reset email); deactivate account

### Subscription & Billing (manager only)
- Current plan with feature list and usage (children count vs limit, days left in trial)
- Upgrade/downgrade via Stripe Checkout redirect
- Stripe invoice history
- Cancel subscription

---

## Parent App Pages — Detailed Spec

Native iOS + Android app. Bottom tab bar: Home | Daily | Journal | Messages. Uses React Native `ScrollView`, `FlatList`, `Pressable`. No `<div>` or browser APIs.

### Child switcher (multi-child parents)

A parent with siblings at the same nursery needs to switch between children. Implement this as a **persistent top-of-screen pill** visible on every tab, not a separate page.

```typescript
// apps/parent/src/store.ts
type ParentStore = {
  children: Child[];          // all children for this parent (from /api/parent/children)
  activeChildId: number | null;
  setActiveChild: (id: number) => void;
};

// On login, fetch children and default activeChildId to children[0].id
```

The switcher renders above the tab content on every screen when `children.length > 1`:

```typescript
// apps/parent/src/components/ChildSwitcher.tsx
export function ChildSwitcher() {
  const { children, activeChildId, setActiveChild } = useStore();
  if (children.length <= 1) return null;        // hidden for single-child parents

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 py-2">
      {children.map(child => (
        <Pressable
          key={child.id}
          onPress={() => setActiveChild(child.id)}
          className={`mr-2 px-4 py-1 rounded-full ${
            child.id === activeChildId ? 'bg-primary' : 'bg-gray-100'
          }`}
        >
          <Text className={child.id === activeChildId ? 'text-white' : 'text-gray-700'}>
            {child.name.split(' ')[0]}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
```

Place `<ChildSwitcher />` inside the `(tabs)/_layout.tsx` above the `<Slot />` so it appears on every tab. Every data-fetching hook uses `activeChildId` as a query key dependency — switching child invalidates all child-scoped queries automatically.

### Home
- Child photo + name + room + today's attendance badge
- Today's last mood emoji (from daily_logs)
- Nursery name + logo
- Latest nursery_event card (newsfeed)
- Alert banners: unseen invoices, pending consent forms

### Daily Report Card
- Date header with prev/next arrows (only dates that have logs are navigable)
- Grouped log sections: Meals | Naps | Nappies | Mood | Activities & Notes
- Summary counts bar: 🍽 meals · 💤 naps · 🧷 nappies · 😊 last mood
- Empty state if no logs for selected date

### Daily Logs
- Reverse-chronological scroll of all logs for the child
- Date group headers; filter chip bar (type filter)

### Learning Journal
- Observation cards with photo, EYFS area chips, observation text, date, practitioner
- Only `is_shared = true` observations are returned by the parent API
- Tap photo to expand full-screen

### Invoices
- Outstanding invoices: amount, period, due date, status badge
- Paid invoices history section
- Line items expandable per invoice
- Print invoice button

### Forms & Consents
- List of pending consent forms (status = 'pending')
- Tap to open full form text in a `ScrollView` modal
- `react-native-signature-canvas` WebView-based signature pad at bottom
- Submit signature → PATCH consent_forms; confirmation toast
- Signed forms shown with signed-by name and date

### Bookings
- **Bookings tab**: current child_sessions displayed by day (Mon–Fri cards)
- **Requests tab**: pending and past booking_requests + holiday_credit_requests
- Request session change modal: day, session type, week, parent note
- Request holiday credit modal: date range, reason

### Messages
- Conversation thread (child-scoped, all messages for this child)
- Grouped consecutive messages from same sender; timestamp on group header
- Green bubble for parent messages, grey for staff
- `KeyboardAvoidingView` + multiline `TextInput` pinned to bottom
- Supabase Realtime channel subscription updates the `FlatList` in real time
- Expo push notification fires when a new staff message arrives and app is backgrounded
- Badge count on tab icon via `expo-notifications` `setBadgeCountAsync`

---

## Background Jobs

All jobs run in `apps/api/src/jobs/` on a `setInterval` loop, scheduled by the Hono server on startup. Deploy as a separate Railway service ("worker") to keep the API server stateless.

| Job | Interval | Logic |
|---|---|---|
| `invoiceGenerator` | Hourly | See detailed spec below — duplicate prevention is critical |
| `invoiceReminders` | Hourly | For each nursery with `reminder_enabled=true`: find invoices where `status=Overdue` and `(reminder_sent_at IS NULL OR reminder_sent_at < now() - interval '7 days')` and invoice age > `reminder_days_overdue`; send reminder email via Resend; update reminder_sent_at and reminder_count |
| `trialWarnings` | Daily | Nurseries where `trial_ends_at` is within 3 days and `trial_warning_sent=false`; send warning email; set trial_warning_sent=true |
| `backup` | Daily | Dump all table data to JSON; upload to Supabase Storage or R2 with date prefix; delete backups older than 30 days |

### Invoice generator — duplicate prevention

The job runs hourly. The `auto_invoice_day` check alone is not safe against restarts or redeployments. Use a two-layer guard:

```typescript
// apps/api/src/jobs/invoiceGenerator.ts
export async function runInvoiceGenerator() {
  const today = new Date();
  const dayOfMonth = today.getDate();
  const periodLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  // Layer 1: nursery-level gate — only run on the configured day, and not already run this month
  const { rows: nurseries } = await pool.query(`
    SELECT * FROM nurseries
    WHERE auto_invoice_enabled = true
      AND auto_invoice_day = $1
      AND (auto_invoice_last_run IS NULL OR auto_invoice_last_run < date_trunc('month', CURRENT_DATE))
  `, [dayOfMonth]);

  for (const nursery of nurseries) {
    const activeChildren = await pool.query(
      `SELECT c.*, cs.* FROM children c
       JOIN child_sessions cs ON cs.child_id = c.id
       WHERE c.nursery_id = $1 AND c.status = 'Active'
       GROUP BY c.id`, [nursery.id]
    );

    for (const child of activeChildren.rows) {
      // Layer 2: child-level guard — skip if an invoice for this period already exists
      const { rows: existing } = await pool.query(
        `SELECT id FROM invoices WHERE nursery_id=$1 AND child_id=$2 AND period=$3 LIMIT 1`,
        [nursery.id, child.id, periodLabel]
      );
      if (existing.length > 0) continue; // already invoiced this period — skip

      const { feeHours } = expandPatternsForRange(child.sessions, periodStart, periodEnd);
      const { feeRate } = ratesForBand(nursery, ageBandForDob(child.dob));
      const amount = feeHours * feeRate;
      if (amount <= 0) continue;

      await pool.query(
        `INSERT INTO invoices (nursery_id, child_id, child_name, invoice_ref, period, amount,
           status, due_date, line_items)
         VALUES ($1,$2,$3,$4,$5,$6,'Pending',$7,$8)`,
        [nursery.id, child.id, child.name,
         `INV-${nursery.id}-${child.id}-${periodLabel}`,
         periodLabel, amount,
         new Date(today.getFullYear(), today.getMonth() + 1, 0), // last day of month
         JSON.stringify([{ description: `${periodLabel} sessions`, hours: feeHours, rate: feeRate, amount }])]
      );
    }

    // Mark this nursery's run — only after all children processed successfully
    await pool.query(
      `UPDATE nurseries SET auto_invoice_last_run = CURRENT_DATE WHERE id = $1`,
      [nursery.id]
    );
  }
}
```

The double guard (nursery `auto_invoice_last_run` + child-level `period` uniqueness) means a job restart or double-fire cannot create duplicate invoices.

---

## Environment Variables

```env
# Supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=postgresql://...      # Supabase Postgres direct / pooler connection string
JWT_SECRET=                        # Supabase JWT secret (Settings → API → JWT Secret)

# Apps
STAFF_APP_URL=https://app.sproutnursery.co.uk   # used by API for CORS + GoCardless redirect URLs
# No PARENT_APP_URL — the parent app is native iOS/Android, not a web URL
NODE_ENV=production
PORT=3000

# --- Staff web app env vars (VITE_ prefix required by Vite) ---
# Set these in apps/staff/.env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=https://api.sproutnursery.co.uk

# --- Parent native app env vars (EXPO_PUBLIC_ prefix required by Expo) ---
# Set these in apps/parent/.env
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_URL=https://api.sproutnursery.co.uk

# Storage (Supabase Storage or R2)
STORAGE_PROVIDER=supabase          # or 'r2'
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=sprout-files
SUPABASE_STORAGE_BUCKET=sprout-files

# Email
RESEND_API_KEY=
EMAIL_FROM=noreply@sproutnursery.co.uk

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_SEEDLING_MONTHLY=
STRIPE_PRICE_SEEDLING_ANNUAL=
STRIPE_PRICE_BLOSSOM_MONTHLY=
STRIPE_PRICE_BLOSSOM_ANNUAL=
STRIPE_PRICE_GROVE_MONTHLY=
STRIPE_PRICE_GROVE_ANNUAL=
STRIPE_PRICE_FOREST_MONTHLY=
STRIPE_PRICE_FOREST_ANNUAL=

# GoCardless
GOCARDLESS_ACCESS_TOKEN=
GOCARDLESS_WEBHOOK_SECRET=

# Push (Expo Push API — no VAPID needed; APNs + FCM handled by Expo)
EXPO_ACCESS_TOKEN=               # EAS token for server-side push sends (optional — open push API is free)

# AI
ANTHROPIC_API_KEY=

# Admin
ADMIN_API_KEY=

# Monitoring
SENTRY_DSN=
```

---

## CI/CD

### `.github/workflows/ci.yml` — runs on every push and PR

```yaml
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo typecheck    # tsc --noEmit on all packages
      - run: pnpm turbo lint         # eslint
      - run: pnpm turbo test         # vitest (staff + API) + jest (parent)
  deploy-api:
    needs: ci
    if: github.ref == 'refs/heads/main'
    # Railway redeploy webhook (set RAILWAY_WEBHOOK_URL secret in GitHub)
    run: curl -X POST ${{ secrets.RAILWAY_WEBHOOK_URL }}
  deploy-staff:
    needs: ci
    if: github.ref == 'refs/heads/main'
    # Railway static site redeploy (separate Railway service, same project)
    run: curl -X POST ${{ secrets.RAILWAY_STAFF_WEBHOOK_URL }}
```

### Parent app — EAS pipelines (separate from GitHub Actions CI)

The parent app is built and published through Expo EAS, not GitHub Actions.

```
# Local / EAS CLI commands:

# Development build (installs on device via Expo Go or Dev Client)
eas build --profile development --platform all

# Preview build (internal testing, no store)
eas build --profile preview --platform all

# Production build (store-ready)
eas build --profile production --platform all

# Submit to App Store (iOS) and Play Store (Android)
eas submit --platform all

# Push a JS-only OTA update (instant, no store review)
eas update --branch production --message "Fix invoice display"
```

**`app.json`** — bundle identifiers are permanent once submitted to the stores. Set them before the first EAS Build:

```json
{
  "expo": {
    "name": "Sprout",
    "slug": "sprout-parent",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": { "image": "./assets/splash.png", "resizeMode": "contain", "backgroundColor": "#ffffff" },
    "ios": {
      "bundleIdentifier": "uk.co.sproutnursery.parent",
      "supportsTablet": false,
      "infoPlist": {
        "NSCameraUsageDescription": "Used to add photos to observations",
        "NSPhotoLibraryUsageDescription": "Used to attach photos from your library"
      }
    },
    "android": {
      "package": "uk.co.sproutnursery.parent",
      "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "#ffffff" },
      "permissions": ["CAMERA", "READ_EXTERNAL_STORAGE"]
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      ["expo-notifications", {
        "icon": "./assets/icon.png",
        "color": "#4f8ef7",
        "sounds": ["./assets/notification.wav"]
      }],
      ["expo-camera", { "cameraPermission": "Used to add photos to observations" }]
    ],
    "extra": {
      "eas": { "projectId": "YOUR_EAS_PROJECT_ID" }
    },
    "scheme": "sprout"
  }
}
```

**`eas.json`:**
```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "your@apple.id", "ascAppId": "XXXXXXXXXX" },
      "android": { "serviceAccountKeyPath": "./google-service-account.json" }
    }
  }
}
```

---

## Supabase Storage

One bucket: `sprout-files`. Set it to **private** (not public). All file access goes through the API, which generates short-lived signed URLs — the frontend never constructs storage URLs directly.

### Path conventions

```
nursery-{nurseryId}/
  logo.{ext}                             # nursery logo
  children/
    {childId}/
      photo.{ext}                        # child profile photo
      documents/
        {documentId}-{filename}          # child_documents records
  observations/
    {observationId}-{filename}           # observation photos
  staff/
    {staffId}/
      training/
        {trainingId}-certificate.{ext}
  policies/
    {policyId}-{filename}.pdf
  risk-assessments/
    {riskAssessmentId}-{filename}.pdf
  backups/
    {YYYY-MM-DD}/
      {tableExport}.json
```

### Upload pattern (API route)

```typescript
// POST /api/children/:id/photo
app.post('/:id/photo', requireAuth, requireRole('manager','staff'), async (c) => {
  const { nurseryId } = c.get('user');
  const childId = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const file = body['file'] as File;

  const ext = file.name.split('.').pop();
  const path = `nursery-${nurseryId}/children/${childId}/photo.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from('sprout-files')
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: true,      // replace existing photo
    });

  if (error) return c.json({ error: error.message }, 500);

  // Store the path (not a URL) in the database
  await withTenant(nurseryId, (client) =>
    client.query('UPDATE children SET photo_url=$1 WHERE id=$2 AND nursery_id=$3',
      [path, childId, nurseryId])
  );
  return c.json({ path });
});
```

### Signed URL pattern (API route)

```typescript
// GET /api/children/:id/photo-url  →  { url, expiresAt }
app.get('/:id/photo-url', requireAuth, async (c) => {
  const { nurseryId } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query('SELECT photo_url FROM children WHERE id=$1 AND nursery_id=$2',
      [c.req.param('id'), nurseryId])
  );
  if (!rows[0]?.photo_url) return c.json({ url: null });

  const { data, error } = await supabaseAdmin.storage
    .from('sprout-files')
    .createSignedUrl(rows[0].photo_url, 3600); // 1-hour expiry

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ url: data.signedUrl });
});
```

The frontend calls the signed URL endpoint and caches the result in TanStack Query with `staleTime: 50 * 60 * 1000` (50 min — safely inside the 1-hour expiry).

---

## Pagination

All list endpoints that can return more than ~50 rows use **offset-based pagination**. Cursor-based is not required at this scale.

### Standard query parameters

```
GET /api/invoices?page=1&limit=25&status=Overdue
GET /api/children?page=1&limit=50&room=Toddlers
GET /api/daily-logs?page=1&limit=30&childId=42&date=2026-06-01
GET /api/messages?page=1&limit=40&childId=42
```

### Standard response envelope

Every paginated endpoint returns:

```typescript
{
  data: T[],
  pagination: {
    page: number,       // current page (1-indexed)
    limit: number,      // rows per page
    total: number,      // total matching rows (COUNT(*))
    pages: number,      // Math.ceil(total / limit)
  }
}
```

### API implementation helper

```typescript
// apps/api/src/lib/paginate.ts
export function paginationParams(query: Record<string, string>) {
  const page  = Math.max(1, parseInt(query.page  ?? '1',  10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '25', 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
```

### Endpoints that MUST be paginated

`/children`, `/invoices`, `/daily-logs`, `/messages`, `/observations`, `/assessments`, `/audit-log`, `/enquiries`, `/waiting-list`, `/incidents`, `/accident-book`, `/staff-training`, `/sar-requests`, `/erasure-requests`

### Endpoints that do NOT need pagination (always small sets)

`/rooms`, `/staff`, `/rota`, `/planning`, `/monitoring`, `/funding-periods`, `/consent-templates`, `/policies`, `/risk-assessments`

### TanStack Query pagination pattern (frontend)

```typescript
// Infinite scroll variant (messages, daily logs)
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['daily-logs', childId],
  queryFn: ({ pageParam = 1 }) => api.get(`/daily-logs?childId=${childId}&page=${pageParam}&limit=30`),
  getNextPageParam: (last) => last.pagination.page < last.pagination.pages
    ? last.pagination.page + 1 : undefined,
});

// Paged table variant (invoices, children)
const [page, setPage] = useState(1);
const { data } = useQuery({
  queryKey: ['invoices', page, filters],
  queryFn: () => api.get(`/invoices?page=${page}&limit=25&status=${filters.status}`),
});
```

---

## GoCardless — Direct Debit Mandate Flow

GoCardless is used to collect parent invoice payments via Direct Debit. It is optional per child — not all parents set it up.

### Setup flow

1. **Manager initiates** from the Invoices page ("Set up Direct Debit" button next to a child's name)
2. `POST /api/payments/gocardless/mandate` `{ childId }` — the API creates a `session_token`, stores it, then calls GoCardless:
   ```typescript
   // The session_token MUST be stored and reused on complete — do NOT call Date.now() twice
   const sessionToken = `mandate-${childId}-${crypto.randomUUID()}`;

   const redirectFlow = await gocardless.redirectFlows.create({
     description: 'Sprout Nursery invoice payments',
     session_token: sessionToken,
     success_redirect_url: `${process.env.STAFF_APP_URL}/invoices?gc_success=1`,
     prefilled_customer: { email: parentEmail, given_name: parentName },
   });

   // Store session_token alongside redirect_flow_id — needed for step 6
   await pool.query(
     `INSERT INTO payment_mandates (nursery_id, child_id, child_name, mandate_id, status, parent_email,
       redirect_flow_id, session_token)
      VALUES ($1,$2,$3,'',$4,$5,$6,$7)`,
     [nurseryId, childId, childName, 'pending', parentEmail,
      redirectFlow.id, sessionToken]
   );
   ```
   Add `redirect_flow_id TEXT DEFAULT ''` and `session_token TEXT DEFAULT ''` columns to `payment_mandates` via migration.

3. API returns `{ url: redirectFlow.redirect_url }` to the frontend
4. **Frontend opens** the GoCardless-hosted URL (new tab) — the parent fills in bank details on GoCardless's pages
5. On success, GoCardless redirects to `success_redirect_url` with `?redirect_flow_id=xxx`
6. **Staff app** calls `POST /api/payments/gocardless/mandate/complete` `{ redirectFlowId }`. The API looks up the stored `session_token` for this `redirect_flow_id` — it does NOT generate a new one:
   ```typescript
   const { rows } = await pool.query(
     'SELECT session_token, child_id FROM payment_mandates WHERE redirect_flow_id=$1',
     [redirectFlowId]
   );
   const { session_token, child_id } = rows[0];

   const completed = await gocardless.redirectFlows.complete(redirectFlowId, { session_token });
   const mandateId = completed.links.mandate;

   await pool.query(
     'UPDATE payment_mandates SET mandate_id=$1, status=$2 WHERE redirect_flow_id=$3',
     [mandateId, 'active', redirectFlowId]
   );
   ```
7. `payment_mandates` row updated: `mandate_id` populated, `status='active'`

### Collecting a payment

When an invoice is ready to collect:

```typescript
// POST /api/payments/gocardless/collect  { invoiceId }
const mandate = await pool.query(
  'SELECT mandate_id FROM payment_mandates WHERE child_id=$1 AND status=$2',
  [invoice.child_id, 'active']
);
const payment = await gocardless.payments.create({
  amount: Math.round(invoice.amount * 100),  // pence
  currency: 'GBP',
  description: `Sprout invoice ${invoice.invoice_ref}`,
  links: { mandate: mandate.rows[0].mandate_id },
});
// UPDATE invoices SET gocardless_payment_id=$1, status='Pending' WHERE id=$2
```

### GoCardless webhook (`POST /api/payments/gocardless-webhook`)

Listen for these events and update invoice status accordingly:

| GoCardless event | Action |
|---|---|
| `payments.confirmed` | `UPDATE invoices SET status='Paid', amount_paid=amount WHERE gocardless_payment_id=$1` |
| `payments.failed` | `UPDATE invoices SET status='Overdue'` — optionally email manager |
| `mandates.cancelled` | `UPDATE payment_mandates SET status='cancelled'` |
| `mandates.expired` | `UPDATE payment_mandates SET status='expired'` |

Verify webhook signature using `GOCARDLESS_WEBHOOK_SECRET` before processing any event.

---

## What NOT to do

- Do not use a single monolithic HTML file. Every page is a React component in its own file.
- Do not use PostgREST (Supabase's auto-generated REST API) for data queries — use the Hono API server with `withTenant` so `SET LOCAL ROLE app_user` is applied and RLS is enforced for every query.
- Do not use the Supabase JS client on the API server for database queries — use the pg Pool with `withTenant`. The Supabase JS client is used only for Auth admin operations (creating users, updating metadata).
- Do not skip RLS. Every table with a `nursery_id` must have `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, and a tenant-isolation policy before that table is considered done.
- Do not mix parent and staff pages in the same app. Parent app is a completely separate Expo project built and distributed via EAS.
- Do not use Redux, Context for server state, or prop-drilling for data. All server state lives in TanStack Query.
- Do not use any CSS framework other than Tailwind. No CSS-in-JS.
- Do not use `any` types in TypeScript. All database rows must use generated types from `supabase gen types typescript`.
- Do not put business logic in React components. Logic lives in custom hooks (`useChildren`, `useInvoices`, etc.) and API route handlers.
- Do not inline Supabase credentials in frontend code. The staff app uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; the parent app uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. These prefixes are required by Vite and Expo respectively — without them the variable is `undefined` at runtime. The service role key never leaves the API server.

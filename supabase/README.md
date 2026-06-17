# Sprout — backend (Supabase)

One Supabase project, one Postgres database, two frontends (staff/admin web + parent app),
access governed entirely by Row-Level Security. This directory is the **spine**: data model,
RLS, the adversarial test gate, and the sign-in → push Edge Function.

## Layout

```
supabase/
  migrations/
    0001_signin_slice.sql          schema + helper fns + RLS (slice 1)
    0002_event_immutability.sql    append-only hardening (trigger + corrects_event_id)
    0003_admin_write_policies.sql  admin manages profiles + guardianships (own nursery)
    0004_safety_critical.sql       medical / safeguarding / emergency contacts + optimistic concurrency
    0005_children_admin_writes.sql admin manages children (own nursery)
    0006_fix_rls_recursion.sql     break children<->guardianships policy recursion via SECURITY DEFINER helpers
  tests/
    0001_rls_adversarial_test.sql      THE HARD GATE — 14 tenant/role/idempotency/ordering tests
    0002_admin_writes_test.sql         12 tests — admin writes are nursery-scoped, admin-only
    0003_safety_concurrency_test.sql   15 tests — stale-write rejection + safeguarding privacy
    0004_children_admin_test.sql       5 tests — children writes are admin-only, nursery-scoped
    e2e/slice1_e2e.mjs                 end-to-end through real JWTs (needs `supabase start`)
  functions/
    notify-guardians/
      index.ts      Deno entry: wires Supabase + FCM deps to the core handler
      core.ts       runtime-agnostic decision logic (which events notify, message, pruning)
      fcm.ts        FCM HTTP v1 send + cached OAuth token + dead-token detection
      core.test.ts  9 unit tests for core.ts (run with `node --test`)
```

## Edge Function tests (no stack, no secrets needed)

The decision logic is split into `core.ts` with all I/O injected, so it runs under
plain Node:

```bash
cd supabase/functions/notify-guardians && node --test
```

9 tests cover: only sign-ins notify; missing record is ignored; no-token children are
skipped; the message is composed correctly (with a "Your child" fallback); dead tokens
reported by FCM are pruned while live and merely-failing tokens are not; one rejected
send doesn't sink the rest; and the constant-time webhook-secret check. `node` strips
the TypeScript types directly — no build step. (FCM/OAuth network code in `fcm.ts` is
exercised by the end-to-end path below, not by these unit tests.)

## Demo data & logins

`seed.sql` runs automatically on `supabase start` and `supabase db reset` (via
`[db.seed]` in `config.toml`, enabled by default). It creates two nurseries, a roster,
guardianship links, sample safety records, and four working logins — **password
`password123`** for all:

| Email | Role | Scope |
|---|---|---|
| `admin@demo.test` | admin | Sunrise Nursery |
| `staff@demo.test` | staff | Sunrise Nursery |
| `parent@demo.test` | parent | guardian of Ava + Noah |
| `staffb@demo.test` | staff | Meadow Nursery (proves isolation — won't see Sunrise) |

Sign into the staff app with `admin@demo.test` / `password123`. The seed uses UUIDs and
tenants disjoint from the test fixtures, so it never interferes with `supabase test db`.

## Run the gate (do this before building any UI)

```bash
supabase init          # if not already a project (creates config.toml)
supabase start         # local Postgres + auth, with pgTAP available
supabase test db       # runs tests/*.sql; every assertion must pass
```

`supabase test db` applies all migrations to a throwaway database and runs each
test file inside a transaction that is rolled back, so the seed data never persists.

### What the suite proves (maps 1:1 to slice-1 acceptance criteria)

| # | Assertion | Acceptance criterion |
|---|-----------|----------------------|
| A1 | staff signs in a child in its **own** nursery | staff insert only within nursery |
| A2/A3 | staff **cannot** sign in another nursery's child, nor spoof `nursery_id` | tenant isolation on writes |
| B1/B2 | nursery B staff sees **zero** of nursery A's children/events | cross-nursery read returns empty |
| C1 | a parent's unfiltered `SELECT *` returns **only** their guarded child | feed via RLS, **no client filtering** |
| C2/C3 | parent sees own child's events, **zero** for a non-guarded child | parent scoped to guarded children |
| D1/D2/D3 | parent **cannot** insert / update / delete events | parents read-only on event data |
| E1 | a parent of another family sees **zero** of this child's events | guardianship is the boundary |
| F1 | re-submitting the same client UUID leaves **exactly one** row | idempotent on client-generated `id` |
| G1 | feed orders by `occurred_at`, not arrival | late-synced offline event slots in at real time |

### Admin writes — `0002_admin_writes_test.sql`

Proves the migration-0003 policies: an admin can create/update/delete profiles and
guardianship links **only in its own nursery** (A1, A6, A11, A12); cannot create a
profile in another nursery (A2), move a profile across nurseries (A4), or touch a
nursery-B profile (A5); cannot link an out-of-nursery child (A7) or guardian (A8).
Non-admin staff cannot create profiles (A3) or delete links (A10); parents cannot
create links (A9).

### Safety-critical optimistic concurrency — `0003_safety_concurrency_test.sql`

Proves the migration-0004 rules. A save declaring the correct base version succeeds and
the **server** bumps `version`/`updated_at`/`updated_by` (S1–S3). A stale save — based on
an old version — is **rejected, never silently overwritten** (S4), including the classic
two-writer lost-update race (S5–S7). Parents read their own child's medical record and
emergency contacts but **cannot write** them (P1, P2, P4, P5); parents **cannot read
safeguarding notes at all** (P3) while in-nursery staff can (P6); cross-nursery staff see
and write nothing (P7, P8).

**End-to-end through real auth** — `tests/e2e/slice1_e2e.mjs` (needs `supabase start`):
where pgTAP impersonates via `set_config`, this drives the actual PostgREST + Auth layer
the apps use. It creates real users, logs in for JWTs, then: a staff JWT signs in its
own-nursery child; the same client UUID re-submitted stays one row with `occurred_at`
preserved; a parent JWT sees exactly that event via an **unfiltered** `SELECT` (RLS scopes
it); a parent write is refused (401/403); a nursery-B staff JWT sees nothing. Pure Node
`fetch` — no dependencies. Run:

```bash
supabase start
export SUPABASE_URL=http://127.0.0.1:54321
export SERVICE_ROLE_KEY=...   # from `supabase status`
export ANON_KEY=...           # from `supabase status`
node supabase/tests/e2e/slice1_e2e.mjs
```

**Still not covered anywhere automated** (needs Firebase creds): real FCM push delivery
to a device, i.e. the Webhook → `notify-guardians` → FCM round-trip. The dispatch/pruning
*logic* is unit-tested (below); only the live network hop is manual.

## Gaps found while reviewing the slice-1 SQL

| # | Gap | Status |
|---|-----|--------|
| 1 | Event immutability bypassed by service-role / owner (RLS only omits client policies) | **Fixed** — trigger in `0002` |
| 2 | No correction/void model | **Partial** — `corrects_event_id` in `0002`; extend `kind` CHECK with `void` when correction UX lands |
| 3 | No write policy for `profiles` / `guardianships` (admin screens couldn't work) | **Fixed** — `0003` + tests `0002_admin_writes_test.sql` |
| 4 | `device_tokens` dead-token cleanup — FCM `UNREGISTERED`/invalid only logged, not deleted | **Fixed** — `fcm.ts` flags dead tokens, `core.ts` prunes them |
| 5 | `getFcmAccessToken()` mints a JWT per call | **Fixed** — cached in `fcm.ts` until ~5 min before expiry |
| 6 | Webhook `x-webhook-secret` is a no-op unless the header is actually set on the Database Webhook | **Hardened** — now a constant-time check (`secretsMatch`); still set the header on the webhook |

## Optimistic concurrency contract (for frontend devs)

Safety-critical tables (`child_medical`, `child_safeguarding`, `emergency_contacts`) use
optimistic concurrency. To save, send `version` = the value you last read:

```ts
const { error } = await supabase
  .from("child_medical")
  .update({ allergies, version: baseVersion })   // baseVersion = what you read
  .eq("child_id", childId);
// error.code === "40001"  -> someone changed it underneath you.
//   Re-fetch the row, show the conflict, let the user reconcile, retry.
```

The server overwrites `version`/`updated_at`/`updated_by` itself — the `version` you send
is only the *base* you claim to have edited. Ordinary mutable fields (room, contact
details, nursery settings) stay plain last-write-wins by server timestamp; only the
safety-critical tables carry this gate.

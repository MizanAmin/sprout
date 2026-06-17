// End-to-end test for slice 1 through REAL auth (JWTs), not set_config.
// Complements the pgTAP suite by exercising the PostgREST + Auth layer the
// apps actually use: a staff JWT writes, a parent JWT reads the RLS-filtered
// feed, a parent write is refused, and a re-submit is idempotent.
//
// Requires a running local stack and its keys:
//   supabase start
//   export SUPABASE_URL=http://127.0.0.1:54321
//   export SERVICE_ROLE_KEY=...   # from `supabase status`
//   export ANON_KEY=...           # from `supabase status`
//   node supabase/tests/e2e/slice1_e2e.mjs
//
// Pure Node (global fetch + node:assert) — no dependencies to install.
//
// NOT covered here: real FCM push delivery (needs Firebase creds). Verify that
// manually, or with the notify-guardians unit tests (node --test in the
// function dir) for the dispatch/pruning logic.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SERVICE_ROLE_KEY;
const ANON = process.env.ANON_KEY;
if (!URL || !SERVICE || !ANON) {
  console.error("Set SUPABASE_URL, SERVICE_ROLE_KEY and ANON_KEY (see `supabase status`).");
  process.exit(2);
}

// ---- tiny REST helpers ----
const svc = (path, opts = {}) =>
  fetch(`${URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });

const asUser = (jwt, path, opts = {}) =>
  fetch(`${URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });

async function createUser(email) {
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Passw0rd!23", email_confirm: true }),
  });
  assert.ok(res.ok, `create user ${email}: ${res.status} ${await res.text()}`);
  return (await res.json()).id;
}

async function login(email) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Passw0rd!23" }),
  });
  assert.ok(res.ok, `login ${email}: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

const tag = randomUUID().slice(0, 8); // unique per run, so reruns don't collide

async function main() {
  // ---------- Seed as service role (bypasses RLS) ----------
  const nurseryA = randomUUID();
  const nurseryB = randomUUID();
  const childA = randomUUID();

  let r = await svc("nurseries", {
    method: "POST",
    body: JSON.stringify([{ id: nurseryA, name: `A-${tag}` }, { id: nurseryB, name: `B-${tag}` }]),
  });
  assert.ok(r.ok, `seed nurseries: ${r.status} ${await r.text()}`);

  r = await svc("children", {
    method: "POST",
    body: JSON.stringify([{ id: childA, nursery_id: nurseryA, full_name: `Child-${tag}` }]),
  });
  assert.ok(r.ok, `seed child: ${r.status} ${await r.text()}`);

  const staffId = await createUser(`staffa-${tag}@a.test`);
  const parentId = await createUser(`parenta-${tag}@a.test`);
  const staffBId = await createUser(`staffb-${tag}@b.test`);

  r = await svc("profiles", {
    method: "POST",
    body: JSON.stringify([
      { id: staffId, nursery_id: nurseryA, role: "staff", full_name: "Staff A" },
      { id: parentId, nursery_id: nurseryA, role: "parent", full_name: "Parent A" },
      { id: staffBId, nursery_id: nurseryB, role: "staff", full_name: "Staff B" },
    ]),
  });
  assert.ok(r.ok, `seed profiles: ${r.status} ${await r.text()}`);

  r = await svc("guardianships", {
    method: "POST",
    body: JSON.stringify([{ guardian_id: parentId, child_id: childA, relationship: "parent" }]),
  });
  assert.ok(r.ok, `seed guardianship: ${r.status} ${await r.text()}`);

  const staffJwt = await login(`staffa-${tag}@a.test`);
  const parentJwt = await login(`parenta-${tag}@a.test`);
  const staffBJwt = await login(`staffb-${tag}@b.test`);

  // ---------- 1. Staff signs in their own-nursery child (client-generated UUID) ----------
  const eventId = randomUUID();
  const occurredAt = "2026-06-16T08:05:00Z"; // captured "offline" earlier than now
  const body = JSON.stringify({
    id: eventId, nursery_id: nurseryA, child_id: childA,
    kind: "sign_in", occurred_at: occurredAt, recorded_by: staffId,
  });

  r = await asUser(staffJwt, "attendance_events", { method: "POST", body });
  assert.equal(r.status, 201, `[1] staff insert should be 201, got ${r.status} ${await r.text()}`);
  console.log("✔ [1] staff signs in own-nursery child");

  // ---------- 2. Idempotent re-submit (same client UUID) ----------
  r = await asUser(staffJwt, "attendance_events", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" }, // upsert on PK
    body,
  });
  assert.ok(r.ok, `[2] re-submit should succeed, got ${r.status} ${await r.text()}`);

  r = await asUser(staffJwt, `attendance_events?id=eq.${eventId}&select=id,occurred_at`);
  const rows = await r.json();
  assert.equal(rows.length, 1, `[2] same UUID must not duplicate — found ${rows.length}`);
  assert.equal(rows[0].occurred_at.startsWith("2026-06-16T08:05"), true,
    `[2] occurred_at must be the captured time, got ${rows[0].occurred_at}`);
  console.log("✔ [2] re-submit is idempotent; occurred_at preserved");

  // ---------- 3. Parent reads the event via the RLS-filtered feed (no client filter) ----------
  r = await asUser(parentJwt, "attendance_events?select=id,child_id"); // NB: no WHERE clause
  const feed = await r.json();
  assert.ok(Array.isArray(feed), `[3] feed should be an array, got ${JSON.stringify(feed)}`);
  assert.equal(feed.length, 1, `[3] parent should see exactly their child's 1 event, got ${feed.length}`);
  assert.equal(feed[0].id, eventId, "[3] parent sees the staff-recorded event");
  console.log("✔ [3] parent sees the event through an unfiltered SELECT (RLS did the scoping)");

  // ---------- 4. Parent cannot write an event ----------
  r = await asUser(parentJwt, "attendance_events", {
    method: "POST",
    body: JSON.stringify({ id: randomUUID(), nursery_id: nurseryA, child_id: childA, kind: "sign_in" }),
  });
  assert.ok(r.status === 401 || r.status === 403,
    `[4] parent write must be refused (401/403), got ${r.status} ${await r.text()}`);
  console.log("✔ [4] parent write is refused by RLS");

  // ---------- 5. Cross-nursery staff sees nothing ----------
  r = await asUser(staffBJwt, `attendance_events?id=eq.${eventId}`);
  const crossed = await r.json();
  assert.equal(crossed.length, 0, `[5] nursery-B staff must see 0 of nursery-A's events, got ${crossed.length}`);
  console.log("✔ [5] cross-nursery read returns empty");

  console.log("\nAll slice-1 e2e checks passed.");
}

main().catch((e) => { console.error("\n✗ e2e failed:\n", e); process.exit(1); });

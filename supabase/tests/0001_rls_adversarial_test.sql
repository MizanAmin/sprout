-- ============================================================
-- Sprout — ADVERSARIAL RLS test suite for the sign-in slice.
-- This is the HARD GATE: do not build any UI until every test here passes.
--
-- Run with:  supabase test db
-- (pgTAP wraps each file in a transaction and rolls it back, so the seed
--  data below never persists.)
--
-- Strategy: seed two nurseries and their people as the superuser (which
-- bypasses RLS), then SET ROLE authenticated and impersonate each user by
-- swapping request.jwt.claims->>'sub'. auth.uid() reads that claim, so every
-- query below is evaluated under the *exact* RLS context a real client gets.
-- Counts asserted while impersonating ARE the RLS-filtered result — there is
-- no client-side filtering anywhere in these assertions.
-- ============================================================

begin;
select plan(14);

-- ---------- Fixed IDs (deterministic) ----------
-- nurseryA 0a..  nurseryB 0b..
-- staffA 11..  adminA 22..  parentA1 33..  staffB 44..  parentB1 55..
-- childA1 c1..  childA2 c2..  childB1 cb..

-- ---------- Seed (as superuser: RLS bypassed) ----------

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'staffa@a.test'),
  ('22222222-2222-2222-2222-222222222222', 'admina@a.test'),
  ('33333333-3333-3333-3333-333333333333', 'parenta1@a.test'),
  ('44444444-4444-4444-4444-444444444444', 'staffb@b.test'),
  ('55555555-5555-5555-5555-555555555555', 'parentb1@b.test');

insert into nurseries (id, name) values
  ('0a000000-0000-0000-0000-000000000001', 'Nursery A'),
  ('0b000000-0000-0000-0000-000000000001', 'Nursery B');

insert into profiles (id, nursery_id, role, full_name) values
  ('11111111-1111-1111-1111-111111111111', '0a000000-0000-0000-0000-000000000001', 'staff',  'Staff A'),
  ('22222222-2222-2222-2222-222222222222', '0a000000-0000-0000-0000-000000000001', 'admin',  'Admin A'),
  ('33333333-3333-3333-3333-333333333333', '0a000000-0000-0000-0000-000000000001', 'parent', 'Parent A1'),
  ('44444444-4444-4444-4444-444444444444', '0b000000-0000-0000-0000-000000000001', 'staff',  'Staff B'),
  ('55555555-5555-5555-5555-555555555555', '0b000000-0000-0000-0000-000000000001', 'parent', 'Parent B1');

insert into children (id, nursery_id, full_name) values
  ('c1000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', 'Child A1'),
  ('c2000000-0000-0000-0000-000000000002', '0a000000-0000-0000-0000-000000000001', 'Child A2'),
  ('cb000000-0000-0000-0000-000000000001', '0b000000-0000-0000-0000-000000000001', 'Child B1');

insert into guardianships (guardian_id, child_id, relationship) values
  ('33333333-3333-3333-3333-333333333333', 'c1000000-0000-0000-0000-000000000001', 'parent'),
  ('55555555-5555-5555-5555-555555555555', 'cb000000-0000-0000-0000-000000000001', 'parent');

-- Pre-seeded events so cross-tenant "returns empty" tests are meaningful
-- (a row exists but must be invisible across the boundary).
insert into attendance_events (id, nursery_id, child_id, kind, occurred_at) values
  ('e0000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001',
     'c1000000-0000-0000-0000-000000000001', 'sign_in', '2026-06-15 09:00+00'),
  ('eb000000-0000-0000-0000-000000000001', '0b000000-0000-0000-0000-000000000001',
     'cb000000-0000-0000-0000-000000000001', 'sign_in', '2026-06-15 09:00+00');

-- Grants the `authenticated` role relies on for RLS to even be evaluated.
-- (Supabase configures these by default; included here so the suite is
--  self-contained. Rolled back with the test transaction.)
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Helper: impersonate a user by swapping the JWT 'sub' claim.
create function pg_temp.act_as(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text,
    true);
end$$;

-- Runs a write as the current (authenticated) role and returns the affected
-- row count. SECURITY INVOKER => RLS applies, so a denied write reports 0 rows.
-- Keeps the data-modifying statement at top level (illegal inside an is() arg).
create function pg_temp.rows_affected(p_sql text) returns int
language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end$$;

-- Drop into the role real clients use. RLS now applies to everything below.
set local role authenticated;

-- ============================================================
-- A. Staff writes are tenant-scoped (the insert boundary)
-- ============================================================
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');  -- Staff A

select lives_ok($$
  insert into attendance_events (id, nursery_id, child_id, kind, occurred_at, recorded_by)
  values ('ea000000-0000-0000-0000-0000000000a1',
          '0a000000-0000-0000-0000-000000000001',
          'c1000000-0000-0000-0000-000000000001',
          'sign_in', '2026-06-16 08:30+00',
          '11111111-1111-1111-1111-111111111111')
$$, 'A1: staff CAN sign in a child in its OWN nursery');

select throws_ok($$
  insert into attendance_events (id, nursery_id, child_id, kind)
  values ('ea000000-0000-0000-0000-0000000000a2',
          '0a000000-0000-0000-0000-000000000001',   -- own nursery_id ...
          'cb000000-0000-0000-0000-000000000001',   -- ... but a child in nursery B
          'sign_in')
$$, '42501', NULL,
   'A2: staff CANNOT sign in a child from another nursery (cross-tenant child)');

select throws_ok($$
  insert into attendance_events (id, nursery_id, child_id, kind)
  values ('ea000000-0000-0000-0000-0000000000a3',
          '0b000000-0000-0000-0000-000000000001',   -- spoofed: nursery B
          'c1000000-0000-0000-0000-000000000001',
          'sign_in')
$$, '42501', NULL,
   'A3: staff CANNOT spoof nursery_id to another tenant');

-- ============================================================
-- B. Cross-nursery reads return empty
-- ============================================================
select pg_temp.act_as('44444444-4444-4444-4444-444444444444');  -- Staff B
select is(
  (select count(*) from children where nursery_id = '0a000000-0000-0000-0000-000000000001')::int,
  0,
  'B1: staff of nursery B sees ZERO children of nursery A');

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');  -- Staff A
select is(
  (select count(*) from attendance_events
     where child_id = 'cb000000-0000-0000-0000-000000000001')::int,
  0,
  'B2: staff of nursery A sees ZERO events for a nursery B child (row exists, invisible)');

-- ============================================================
-- C. Parent reads are scoped to guarded children — via RLS, not client filter
-- ============================================================
select pg_temp.act_as('33333333-3333-3333-3333-333333333333');  -- Parent A1

-- The whole-table count a parent gets back == the count for their own child.
-- If RLS leaked, these would differ. No WHERE clause does the scoping here.
select is(
  (select count(*) from attendance_events)::int,
  (select count(*) from attendance_events
     where child_id = 'c1000000-0000-0000-0000-000000000001')::int,
  'C1: parent''s unfiltered SELECT * returns ONLY their guarded child''s events');

select cmp_ok(
  (select count(*) from attendance_events
     where child_id = 'c1000000-0000-0000-0000-000000000001')::int,
  '>', 0,
  'C2: parent actually sees their own child''s events (non-empty)');

select is(
  (select count(*) from attendance_events
     where child_id = 'c2000000-0000-0000-0000-000000000002')::int,
  0,
  'C3: parent sees ZERO events for a non-guarded child in the SAME nursery');

-- ============================================================
-- D. Parents are read-only on event data
-- ============================================================
-- (Still Parent A1.)
select throws_ok($$
  insert into attendance_events (nursery_id, child_id, kind)
  values ('0a000000-0000-0000-0000-000000000001',
          'c1000000-0000-0000-0000-000000000001', 'sign_in')
$$, '42501', NULL,
   'D1: parent CANNOT insert an event (no write policy => denied)');

-- No UPDATE/DELETE policy => USING is false => 0 rows touched, even for the
-- parent's OWN child.
select is(
  pg_temp.rows_affected($$
    update attendance_events set kind = 'sign_out'
     where child_id = 'c1000000-0000-0000-0000-000000000001'
  $$),
  0,
  'D2: parent CANNOT update events (append-only; 0 rows mutated)');

select is(
  pg_temp.rows_affected($$
    delete from attendance_events
     where child_id = 'c1000000-0000-0000-0000-000000000001'
  $$),
  0,
  'D3: parent CANNOT delete events (0 rows removed)');

-- ============================================================
-- E. A parent cannot read another family's child
-- ============================================================
select pg_temp.act_as('55555555-5555-5555-5555-555555555555');  -- Parent B1
select is(
  (select count(*) from attendance_events
     where child_id = 'c1000000-0000-0000-0000-000000000001')::int,
  0,
  'E1: parent of nursery B sees ZERO events for a nursery A child');

-- ============================================================
-- F. Idempotency: same client-generated UUID never duplicates
-- ============================================================
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');  -- Staff A
insert into attendance_events (id, nursery_id, child_id, kind, occurred_at)
  values ('ed000000-0000-0000-0000-0000000000dd',
          '0a000000-0000-0000-0000-000000000001',
          'c1000000-0000-0000-0000-000000000001', 'sign_in', '2026-06-16 09:00+00');
-- A retried / double-tapped / re-synced submission with the SAME id:
insert into attendance_events (id, nursery_id, child_id, kind, occurred_at)
  values ('ed000000-0000-0000-0000-0000000000dd',
          '0a000000-0000-0000-0000-000000000001',
          'c1000000-0000-0000-0000-000000000001', 'sign_in', '2026-06-16 09:00+00')
  on conflict (id) do nothing;
select is(
  (select count(*) from attendance_events
     where id = 'ed000000-0000-0000-0000-0000000000dd')::int,
  1,
  'F1: re-submitting the same client UUID leaves exactly one row');

-- ============================================================
-- G. Ordering is by occurred_at, NOT arrival/created_at
-- ============================================================
-- Insert "happened later" first, then a late-synced "happened earlier" event.
insert into attendance_events (id, nursery_id, child_id, kind, occurred_at)
  values ('60000000-0000-0000-0000-000000000001',
          '0a000000-0000-0000-0000-000000000001',
          'c1000000-0000-0000-0000-000000000001', 'sign_out', '2026-06-16 12:00+00');
insert into attendance_events (id, nursery_id, child_id, kind, occurred_at)
  values ('60000000-0000-0000-0000-000000000002',
          '0a000000-0000-0000-0000-000000000001',
          'c1000000-0000-0000-0000-000000000001', 'sign_in', '2026-06-16 11:30+00');
-- Even though row ...0002 has the LATER created_at, ordering by occurred_at
-- puts it first because it happened earlier in the real world.
select is(
  (select id from attendance_events
     where id in ('60000000-0000-0000-0000-000000000001',
                  '60000000-0000-0000-0000-000000000002')
     order by occurred_at asc limit 1),
  '60000000-0000-0000-0000-000000000002'::uuid,
  'G1: feed orders by occurred_at, so a late-synced earlier event slots in correctly');

select * from finish();
rollback;

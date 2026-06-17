-- ============================================================
-- Adversarial tests for safety-critical optimistic concurrency (migration 0004).
--   * stale writes are REJECTED, never silently overwritten
--   * version / updated_at / updated_by are server-authoritative
--   * parents read their own child's medical + emergency contacts (read-only)
--   * parents CANNOT read safeguarding notes at all
--   * cross-nursery reads/writes are blocked
-- Run with:  supabase test db
-- ============================================================

begin;
select plan(15);

-- ---------- Seed (as superuser) ----------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'staffa@a.test'),   -- Staff A
  ('33333333-3333-3333-3333-333333333333', 'parenta1@a.test'), -- Parent A1
  ('44444444-4444-4444-4444-444444444444', 'staffb@b.test');   -- Staff B

insert into nurseries (id, name) values
  ('0a000000-0000-0000-0000-000000000001', 'Nursery A'),
  ('0b000000-0000-0000-0000-000000000001', 'Nursery B');

insert into profiles (id, nursery_id, role, full_name) values
  ('11111111-1111-1111-1111-111111111111', '0a000000-0000-0000-0000-000000000001', 'staff',  'Staff A'),
  ('33333333-3333-3333-3333-333333333333', '0a000000-0000-0000-0000-000000000001', 'parent', 'Parent A1'),
  ('44444444-4444-4444-4444-444444444444', '0b000000-0000-0000-0000-000000000001', 'staff',  'Staff B');

insert into children (id, nursery_id, full_name) values
  ('c1000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', 'Child A1'),
  ('c2000000-0000-0000-0000-000000000002', '0a000000-0000-0000-0000-000000000001', 'Child A2');

insert into guardianships (guardian_id, child_id, relationship) values
  ('33333333-3333-3333-3333-333333333333', 'c1000000-0000-0000-0000-000000000001', 'parent');

-- Pre-seed safety rows at version 1.
insert into child_medical (child_id, nursery_id, allergies, version) values
  ('c1000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', 'none known', 1);
insert into child_safeguarding (child_id, nursery_id, safeguarding_notes, version) values
  ('c1000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', 'CONFIDENTIAL', 1);
insert into emergency_contacts (id, child_id, nursery_id, contact_name, phone, version) values
  ('ec000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   '0a000000-0000-0000-0000-000000000001', 'Gran', '07000000000', 1);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

create function pg_temp.act_as(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end$$;

-- Runs a write as the current role, returns affected row count (RLS applies).
create function pg_temp.rows_affected(p_sql text) returns int
language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end$$;

set local role authenticated;

-- ============================================================
-- Optimistic concurrency (Staff A)
-- ============================================================
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

-- S1: save declaring the correct base version (1) -> succeeds, server bumps to 2.
select lives_ok($$
  update child_medical set allergies = 'peanuts', version = 1
   where child_id = 'c1000000-0000-0000-0000-000000000001'
$$, 'S1: save with correct base version succeeds');

select is(
  (select version from child_medical where child_id = 'c1000000-0000-0000-0000-000000000001'),
  2,
  'S2: server bumps version authoritatively (1 -> 2)');

select is(
  (select updated_by from child_medical where child_id = 'c1000000-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'S3: updated_by is stamped server-side from auth.uid()');

-- S4: a save still based on version 1 (now stale, live is 2) -> REJECTED.
select throws_ok($$
  update child_medical set allergies = 'WRONG', version = 1
   where child_id = 'c1000000-0000-0000-0000-000000000001'
$$, '40001', NULL,
   'S4: stale write (based on v1, live is v2) is rejected, not overwritten');

-- S5/S6: two writers both read v2; first wins to v3, second (still v2) is rejected.
select lives_ok($$
  update child_medical set allergies = 'peanuts, dairy', version = 2
   where child_id = 'c1000000-0000-0000-0000-000000000001'
$$, 'S5: first concurrent writer (base v2) succeeds -> v3');

select throws_ok($$
  update child_medical set allergies = 'LOST UPDATE', version = 2
   where child_id = 'c1000000-0000-0000-0000-000000000001'
$$, '40001', NULL,
   'S6: second concurrent writer (still base v2) is rejected');

select is(
  (select allergies from child_medical where child_id = 'c1000000-0000-0000-0000-000000000001'),
  'peanuts, dairy',
  'S7: the rejected write left the winning value intact (no silent overwrite)');

-- ============================================================
-- Parent access (Parent A1)
-- ============================================================
select pg_temp.act_as('33333333-3333-3333-3333-333333333333');

select is(
  (select count(*) from child_medical
     where child_id = 'c1000000-0000-0000-0000-000000000001')::int,
  1,
  'P1: parent CAN read their own child''s medical record');

select is(
  pg_temp.rows_affected($$
    update child_medical set allergies = 'parent edit', version = 3
     where child_id = 'c1000000-0000-0000-0000-000000000001'
  $$),
  0,
  'P2: parent CANNOT write safety-critical medical data (read-only, 0 rows)');

select is(
  (select count(*) from child_safeguarding
     where child_id = 'c1000000-0000-0000-0000-000000000001')::int,
  0,
  'P3: parent CANNOT read safeguarding notes at all (row exists, invisible)');

select is(
  (select count(*) from emergency_contacts
     where child_id = 'c1000000-0000-0000-0000-000000000001')::int,
  1,
  'P4: parent CAN read their own child''s emergency contacts');

select is(
  pg_temp.rows_affected($$
    update emergency_contacts set phone = '07999999999', version = 1
     where id = 'ec000000-0000-0000-0000-000000000001'
  $$),
  0,
  'P5: parent CANNOT edit emergency contacts (read-only, 0 rows)');

-- ============================================================
-- Staff access boundaries
-- ============================================================
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');  -- Staff A
select is(
  (select count(*) from child_safeguarding
     where child_id = 'c1000000-0000-0000-0000-000000000001')::int,
  1,
  'P6: staff in the nursery CAN read safeguarding notes');

select pg_temp.act_as('44444444-4444-4444-4444-444444444444');  -- Staff B
select is(
  (select count(*) from child_medical
     where child_id = 'c1000000-0000-0000-0000-000000000001')::int,
  0,
  'P7: staff of another nursery sees ZERO of this child''s medical record');

-- Targets Child A2 (no medical row yet) so this is unambiguously an RLS denial,
-- not a primary-key conflict.
select throws_ok($$
  insert into child_medical (child_id, nursery_id, allergies)
  values ('c2000000-0000-0000-0000-000000000002',
          '0b000000-0000-0000-0000-000000000001', 'cross-tenant')
$$, '42501', NULL,
   'P8: staff of another nursery CANNOT insert a medical row for a nursery-A child');

select * from finish();
rollback;

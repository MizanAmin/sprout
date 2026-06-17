-- ============================================================
-- Adversarial tests for admin management writes (migration 0003).
-- Admins manage staff/parents and guardianship links — OWN nursery only.
-- Run with:  supabase test db
-- ============================================================

begin;
select plan(12);

-- ---------- Seed (as superuser) ----------
insert into auth.users (id, email) values
  ('22222222-2222-2222-2222-222222222222', 'admina@a.test'),   -- Admin A
  ('11111111-1111-1111-1111-111111111111', 'staffa@a.test'),   -- Staff A (non-admin)
  ('33333333-3333-3333-3333-333333333333', 'parenta1@a.test'), -- Parent A1
  ('66666666-6666-6666-6666-666666666666', 'parenta2@a.test'), -- Parent A2
  ('44444444-4444-4444-4444-444444444444', 'staffb@b.test'),   -- Staff B
  ('55555555-5555-5555-5555-555555555555', 'parentb1@b.test'), -- Parent B1
  ('77777777-7777-7777-7777-777777777777', 'newstaff@a.test'), -- created in A1
  ('88888888-8888-8888-8888-888888888888', 'spoof@x.test');    -- used in A2

insert into nurseries (id, name) values
  ('0a000000-0000-0000-0000-000000000001', 'Nursery A'),
  ('0b000000-0000-0000-0000-000000000001', 'Nursery B');

insert into profiles (id, nursery_id, role, full_name) values
  ('22222222-2222-2222-2222-222222222222', '0a000000-0000-0000-0000-000000000001', 'admin',  'Admin A'),
  ('11111111-1111-1111-1111-111111111111', '0a000000-0000-0000-0000-000000000001', 'staff',  'Staff A'),
  ('33333333-3333-3333-3333-333333333333', '0a000000-0000-0000-0000-000000000001', 'parent', 'Parent A1'),
  ('66666666-6666-6666-6666-666666666666', '0a000000-0000-0000-0000-000000000001', 'parent', 'Parent A2'),
  ('44444444-4444-4444-4444-444444444444', '0b000000-0000-0000-0000-000000000001', 'staff',  'Staff B'),
  ('55555555-5555-5555-5555-555555555555', '0b000000-0000-0000-0000-000000000001', 'parent', 'Parent B1');

insert into children (id, nursery_id, full_name) values
  ('c1000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', 'Child A1'),
  ('cb000000-0000-0000-0000-000000000001', '0b000000-0000-0000-0000-000000000001', 'Child B1');

-- An existing link so the "staff cannot delete" test has something to target.
insert into guardianships (guardian_id, child_id, relationship) values
  ('33333333-3333-3333-3333-333333333333', 'c1000000-0000-0000-0000-000000000001', 'parent');

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
-- profiles
-- ============================================================
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');  -- Admin A

select lives_ok($$
  insert into profiles (id, nursery_id, role, full_name)
  values ('77777777-7777-7777-7777-777777777777',
          '0a000000-0000-0000-0000-000000000001', 'staff', 'New Staff')
$$, 'A1: admin CAN create a profile in its own nursery');

select throws_ok($$
  insert into profiles (id, nursery_id, role, full_name)
  values ('88888888-8888-8888-8888-888888888888',
          '0b000000-0000-0000-0000-000000000001', 'staff', 'Spoof')
$$, '42501', NULL,
   'A2: admin CANNOT create a profile in another nursery');

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');  -- Staff A (non-admin)
select throws_ok($$
  insert into profiles (id, nursery_id, role, full_name)
  values ('88888888-8888-8888-8888-888888888888',
          '0a000000-0000-0000-0000-000000000001', 'staff', 'By Staff')
$$, '42501', NULL,
   'A3: non-admin staff CANNOT create profiles');

select pg_temp.act_as('22222222-2222-2222-2222-222222222222');  -- Admin A
select throws_ok($$
  update profiles set nursery_id = '0b000000-0000-0000-0000-000000000001'
   where id = '77777777-7777-7777-7777-777777777777'
$$, '42501', NULL,
   'A4: admin CANNOT move a profile to another nursery (WITH CHECK blocks it)');

select is(
  pg_temp.rows_affected($$
    update profiles set full_name = 'hijack'
     where id = '44444444-4444-4444-4444-444444444444'   -- Staff B (nursery B)
  $$),
  0,
  'A5: admin CANNOT touch a profile in another nursery (0 rows)');

-- ============================================================
-- guardianships
-- ============================================================
select lives_ok($$
  insert into guardianships (guardian_id, child_id, relationship)
  values ('66666666-6666-6666-6666-666666666666',
          'c1000000-0000-0000-0000-000000000001', 'parent')
$$, 'A6: admin CAN link a parent and child in its own nursery');

select throws_ok($$
  insert into guardianships (guardian_id, child_id, relationship)
  values ('66666666-6666-6666-6666-666666666666',
          'cb000000-0000-0000-0000-000000000001', 'parent')   -- child in nursery B
$$, '42501', NULL,
   'A7: admin CANNOT link to a child in another nursery');

select throws_ok($$
  insert into guardianships (guardian_id, child_id, relationship)
  values ('55555555-5555-5555-5555-555555555555',               -- guardian in nursery B
          'c1000000-0000-0000-0000-000000000001', 'parent')
$$, '42501', NULL,
   'A8: admin CANNOT link a guardian from another nursery');

select pg_temp.act_as('33333333-3333-3333-3333-333333333333');  -- Parent A1
-- Targets a link that does not already exist, so this is unambiguously an RLS
-- denial (parent role), not a primary-key conflict.
select throws_ok($$
  insert into guardianships (guardian_id, child_id, relationship)
  values ('33333333-3333-3333-3333-333333333333',
          'cb000000-0000-0000-0000-000000000001', 'parent')
$$, '42501', NULL,
   'A9: a parent CANNOT create guardianship links');

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');  -- Staff A (still non-admin here)
select is(
  pg_temp.rows_affected($$
    delete from guardianships
     where guardian_id = '33333333-3333-3333-3333-333333333333'
       and child_id = 'c1000000-0000-0000-0000-000000000001'
  $$),
  0,
  'A10: non-admin staff CANNOT delete guardianship links (0 rows)');

select pg_temp.act_as('22222222-2222-2222-2222-222222222222');  -- Admin A
select is(
  pg_temp.rows_affected($$
    delete from guardianships
     where guardian_id = '66666666-6666-6666-6666-666666666666'
       and child_id = 'c1000000-0000-0000-0000-000000000001'
  $$),
  1,
  'A11: admin CAN delete a guardianship link in its own nursery');

select lives_ok($$
  update profiles set role = 'admin'
   where id = '11111111-1111-1111-1111-111111111111'   -- promote Staff A within nursery A
$$, 'A12: admin CAN update a profile within its own nursery');

select * from finish();
rollback;

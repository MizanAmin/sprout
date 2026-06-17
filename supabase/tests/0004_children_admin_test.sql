-- ============================================================
-- Adversarial tests for children management writes (migration 0005).
-- Run with:  supabase test db
-- ============================================================

begin;
select plan(5);

insert into auth.users (id, email) values
  ('22222222-2222-2222-2222-222222222222', 'admina@a.test'),
  ('11111111-1111-1111-1111-111111111111', 'staffa@a.test'),
  ('33333333-3333-3333-3333-333333333333', 'parenta1@a.test');

insert into nurseries (id, name) values
  ('0a000000-0000-0000-0000-000000000001', 'Nursery A'),
  ('0b000000-0000-0000-0000-000000000001', 'Nursery B');

insert into profiles (id, nursery_id, role, full_name) values
  ('22222222-2222-2222-2222-222222222222', '0a000000-0000-0000-0000-000000000001', 'admin',  'Admin A'),
  ('11111111-1111-1111-1111-111111111111', '0a000000-0000-0000-0000-000000000001', 'staff',  'Staff A'),
  ('33333333-3333-3333-3333-333333333333', '0a000000-0000-0000-0000-000000000001', 'parent', 'Parent A1');

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

create function pg_temp.act_as(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end$$;

set local role authenticated;

select pg_temp.act_as('22222222-2222-2222-2222-222222222222');  -- Admin A
select lives_ok($$
  insert into children (nursery_id, full_name, room)
  values ('0a000000-0000-0000-0000-000000000001', 'New Child', 'Bluebell')
$$, 'C1: admin CAN add a child to its own nursery');

select throws_ok($$
  insert into children (nursery_id, full_name)
  values ('0b000000-0000-0000-0000-000000000001', 'Cross Child')
$$, '42501', NULL,
   'C2: admin CANNOT add a child to another nursery');

select lives_ok($$
  update children set room = 'Sunflower'
   where nursery_id = '0a000000-0000-0000-0000-000000000001'
$$, 'C3: admin CAN edit children in its own nursery');

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');  -- Staff A
select throws_ok($$
  insert into children (nursery_id, full_name)
  values ('0a000000-0000-0000-0000-000000000001', 'By Staff')
$$, '42501', NULL,
   'C4: on-site staff CANNOT add children (roster is read-only to them)');

select pg_temp.act_as('33333333-3333-3333-3333-333333333333');  -- Parent A1
select throws_ok($$
  insert into children (nursery_id, full_name)
  values ('0a000000-0000-0000-0000-000000000001', 'By Parent')
$$, '42501', NULL,
   'C5: a parent CANNOT add children');

select * from finish();
rollback;

create extension if not exists pgcrypto;

create table if not exists public.drawings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  child_name text,
  age_category text not null check (age_category in ('4–7 нас', '8–11 нас', '12–16 нас')),
  image_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  sap_code text unique not null,
  first_name text not null,
  last_name text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references public.drawings(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  sap_code text,
  employee_first_name text,
  employee_last_name text,
  age_category text not null check (age_category in ('4–7 нас', '8–11 нас', '12–16 нас')),
  device_hash text,
  ip_hash text,
  user_agent_hash text,
  browser_summary text,
  deleted_at timestamptz,
  deleted_by text,
  delete_reason text,
  created_at timestamptz not null default now()
);

alter table public.votes add column if not exists age_category text;
alter table public.votes add column if not exists employee_id uuid references public.employees(id) on delete cascade;
alter table public.votes add column if not exists sap_code text;
alter table public.votes add column if not exists employee_first_name text;
alter table public.votes add column if not exists employee_last_name text;
alter table public.votes add column if not exists browser_summary text;
alter table public.votes add column if not exists deleted_at timestamptz;
alter table public.votes add column if not exists deleted_by text;
alter table public.votes add column if not exists delete_reason text;
alter table public.votes alter column device_hash drop not null;

alter table public.drawings drop constraint if exists drawings_age_category_check;
alter table public.votes drop constraint if exists votes_age_category_check;

update public.drawings
set age_category = case
  when age_category in ('3-6', '3–6 нас', '3-6 нас') then '4–7 нас'
  when age_category in ('7-10', '7–10 нас', '7-10 нас') then '8–11 нас'
  when age_category in ('11-16', '11–16 нас', '11-16 нас') then '12–16 нас'
  else age_category
end;

update public.votes
set age_category = public.drawings.age_category
from public.drawings
where public.votes.drawing_id = public.drawings.id
  and public.votes.age_category is null;

update public.votes
set age_category = case
  when age_category in ('3-6', '3–6 нас', '3-6 нас') then '4–7 нас'
  when age_category in ('7-10', '7–10 нас', '7-10 нас') then '8–11 нас'
  when age_category in ('11-16', '11–16 нас', '11-16 нас') then '12–16 нас'
  else age_category
end;

alter table public.votes
  alter column age_category set not null;

delete from public.votes
where employee_id is null;

alter table public.votes
  alter column employee_id set not null,
  alter column sap_code set not null;

alter table public.drawings
  add constraint drawings_age_category_check
  check (age_category in ('4–7 нас', '8–11 нас', '12–16 нас'));

alter table public.votes
  add constraint votes_age_category_check
  check (age_category in ('4–7 нас', '8–11 нас', '12–16 нас'));

alter table public.votes drop constraint if exists votes_device_hash_unique;
drop index if exists votes_device_category_active_unique;
drop index if exists votes_device_hash_key;
drop index if exists votes_device_category_unique;
drop index if exists votes_employee_category_active_unique;
create unique index if not exists votes_employee_category_active_unique
on public.votes(employee_id, age_category)
where deleted_at is null;

create index if not exists drawings_created_at_idx on public.drawings(created_at desc);
create index if not exists drawings_age_category_idx on public.drawings(age_category);
create index if not exists employees_sap_code_idx on public.employees(sap_code);
create index if not exists employees_status_idx on public.employees(status);
create index if not exists votes_drawing_id_idx on public.votes(drawing_id);
create index if not exists votes_employee_id_idx on public.votes(employee_id);
create index if not exists votes_age_category_idx on public.votes(age_category);
create index if not exists votes_created_at_idx on public.votes(created_at desc);

create or replace view public.public_drawings_with_votes as
select
  public.drawings.id,
  public.drawings.title,
  public.drawings.child_name,
  public.drawings.age_category,
  public.drawings.image_url,
  public.drawings.created_at,
  count(public.votes.id)::integer as vote_count
from public.drawings
left join public.votes
  on public.votes.drawing_id = public.drawings.id
  and public.votes.deleted_at is null
group by public.drawings.id
order by public.drawings.created_at desc;

alter table public.drawings enable row level security;
alter table public.employees enable row level security;
alter table public.votes enable row level security;

drop policy if exists "Public can read drawings" on public.drawings;
create policy "Public can read drawings"
on public.drawings
for select
to anon, authenticated
using (true);

drop policy if exists "Service role can manage drawings" on public.drawings;
create policy "Service role can manage drawings"
on public.drawings
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can manage employees" on public.employees;
create policy "Service role can manage employees"
on public.employees
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can insert votes" on public.votes;
create policy "Service role can insert votes"
on public.votes
for insert
to service_role
with check (true);

drop policy if exists "Service role can read votes" on public.votes;
create policy "Service role can read votes"
on public.votes
for select
to service_role
using (true);

grant usage on schema public to anon, authenticated, service_role;
grant select on public.drawings to anon, authenticated;
grant select on public.public_drawings_with_votes to anon, authenticated, service_role;
grant all on public.drawings to service_role;
grant all on public.employees to service_role;
grant select, insert, update, delete on public.votes to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'drawing-images',
  'drawing-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read drawing images" on storage.objects;
create policy "Public can read drawing images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'drawing-images');

drop policy if exists "Service role can manage drawing images" on storage.objects;
create policy "Service role can manage drawing images"
on storage.objects
for all
to service_role
using (bucket_id = 'drawing-images')
with check (bucket_id = 'drawing-images');

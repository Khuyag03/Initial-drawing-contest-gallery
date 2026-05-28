create extension if not exists pgcrypto;

create table if not exists public.drawings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  child_name text,
  age_category text not null check (age_category in ('3-6', '7-10', '11-16')),
  image_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references public.drawings(id) on delete cascade,
  device_hash text not null,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'votes_device_hash_unique'
      and conrelid = 'public.votes'::regclass
  ) then
    alter table public.votes
      add constraint votes_device_hash_unique unique (device_hash);
  end if;
end $$;

create index if not exists drawings_created_at_idx on public.drawings(created_at desc);
create index if not exists drawings_age_category_idx on public.drawings(age_category);
create index if not exists votes_drawing_id_idx on public.votes(drawing_id);
create index if not exists votes_created_at_idx on public.votes(created_at desc);

alter table public.drawings enable row level security;
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
grant all on public.drawings to service_role;
grant select, insert, delete on public.votes to service_role;

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

create table if not exists public.profiles (
  id text primary key,
  auth_user_id uuid,
  email text unique not null,
  name text not null,
  initials text not null,
  title text not null,
  app_role text not null,
  product_persona text not null,
  access_scope text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  invited_by text
);

alter table public.profiles enable row level security;

create or replace function public.current_sprintpulse_persona()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select product_persona
  from public.profiles
  where auth_user_id = auth.uid()
    or (
      auth_user_id is null
      and lower(email) = lower(auth.jwt() ->> 'email')
      and status in ('active', 'invited')
    )
  order by case when auth_user_id = auth.uid() then 0 else 1 end
  limit 1
$$;

grant execute on function public.current_sprintpulse_persona() to authenticated;

create or replace function public.current_sprintpulse_profile_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where auth_user_id = auth.uid()
    or (
      auth_user_id is null
      and lower(email) = lower(auth.jwt() ->> 'email')
      and status in ('active', 'invited')
    )
  order by case when auth_user_id = auth.uid() then 0 else 1 end
  limit 1
$$;

grant execute on function public.current_sprintpulse_profile_id() to authenticated;

create or replace function public.claim_sprintpulse_profile()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_profile_id text;
begin
  update public.profiles
  set
    auth_user_id = auth.uid(),
    status = 'active'
  where lower(email) = lower(auth.jwt() ->> 'email')
    and (auth_user_id is null or auth_user_id = auth.uid())
  returning id into claimed_profile_id;

  return claimed_profile_id;
end;
$$;

grant execute on function public.claim_sprintpulse_profile() to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_own_or_elevated" on public.profiles;
create policy "profiles_select_own_or_elevated"
  on public.profiles
  for select
  using (
    auth.uid() = auth_user_id
    or public.current_sprintpulse_persona() in ('product-owner', 'scrum-master', 'engineering-manager', 'qa-lead')
  );

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (
    auth.uid() = auth_user_id
    and lower(email) = lower(auth.jwt() ->> 'email')
  );

drop policy if exists "profiles_insert_invited_by_elevated" on public.profiles;
create policy "profiles_insert_invited_by_elevated"
  on public.profiles
  for insert
  with check (
    auth_user_id is null
    and status = 'invited'
    and public.current_sprintpulse_persona() in ('product-owner', 'scrum-master', 'engineering-manager')
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  using (
    auth.uid() = auth_user_id
    or (
      auth_user_id is null
      and status = 'invited'
      and lower(email) = lower(auth.jwt() ->> 'email')
    )
  )
  with check (
    auth.uid() = auth_user_id
    and lower(email) = lower(auth.jwt() ->> 'email')
  );

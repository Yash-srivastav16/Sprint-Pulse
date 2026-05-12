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

create or replace function public.can_create_sprintpulse_project(creator_profile_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = creator_profile_id
      and profile.id = public.current_sprintpulse_profile_id()
      and profile.product_persona in ('scrum-master', 'engineering-manager')
  )
$$;

grant execute on function public.can_create_sprintpulse_project(text) to authenticated;

create or replace function public.can_manage_sprintpulse_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects project
    join public.profiles profile on profile.id = project.created_by
    where project.id = target_project_id
      and profile.id = public.current_sprintpulse_profile_id()
      and profile.product_persona in ('scrum-master', 'engineering-manager')
  )
$$;

grant execute on function public.can_manage_sprintpulse_project(uuid) to authenticated;

create or replace function public.accept_sprintpulse_project_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_count integer := 0;
begin
  perform public.claim_sprintpulse_profile();

  insert into public.project_members (project_id, profile_id, role)
  select
    invite.project_id,
    profile.id,
    invite.role
  from public.project_invites invite
  join public.profiles profile
    on lower(profile.email) = lower(invite.email)
  where invite.status = 'pending'
    and lower(invite.email) = lower(auth.jwt() ->> 'email')
    and profile.id = public.current_sprintpulse_profile_id()
  on conflict (project_id, profile_id) do update
    set role = excluded.role;

  update public.project_invites invite
  set
    status = 'accepted',
    accepted_at = coalesce(invite.accepted_at, now())
  where invite.status = 'pending'
    and lower(invite.email) = lower(auth.jwt() ->> 'email')
    and exists (
      select 1
      from public.profiles profile
      where lower(profile.email) = lower(invite.email)
        and profile.id = public.current_sprintpulse_profile_id()
    );

  get diagnostics accepted_count = row_count;
  return accepted_count;
end;
$$;

grant execute on function public.accept_sprintpulse_project_invites() to authenticated;

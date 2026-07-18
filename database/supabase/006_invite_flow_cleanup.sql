delete from public.project_members member
using public.project_invites invite, public.profiles profile
where invite.status = 'pending'
  and invite.project_id = member.project_id
  and profile.id = member.profile_id
  and profile.auth_user_id is null
  and profile.status = 'invited'
  and lower(profile.email) = lower(invite.email);

create or replace function public.accept_sprintpulse_project_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_count integer := 0;
begin
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
    and profile.auth_user_id = auth.uid()
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
        and profile.auth_user_id = auth.uid()
    );

  get diagnostics accepted_count = row_count;
  return accepted_count;
end;
$$;

grant execute on function public.accept_sprintpulse_project_invites() to authenticated;

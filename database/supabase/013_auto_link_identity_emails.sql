create or replace function public.sprintpulse_project_role_for_app_role(app_role text)
returns text
language sql
immutable
as $$
  select case app_role
    when 'product-owner' then 'product-owner'
    when 'scrum-master' then 'scrum-master'
    when 'engineering-manager' then 'engineering-manager'
    when 'qa-lead' then 'qa'
    else 'developer'
  end
$$;

create or replace function public.auto_link_sprintpulse_identity_email(target_profile_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile public.profiles%rowtype;
  linked_count integer := 0;
begin
  select *
  into target_profile
  from public.profiles
  where id = target_profile_id;

  if target_profile.id is null or lower(target_profile.email) like '%@jira.local' then
    return 0;
  end if;

  insert into public.project_members (project_id, profile_id, role)
  select distinct
    git_commit.project_id,
    target_profile.id,
    public.sprintpulse_project_role_for_app_role(target_profile.app_role)
  from public.git_commits git_commit
  where lower(git_commit.author_email) = lower(target_profile.email)
  on conflict (project_id, profile_id) do nothing;

  update public.git_commits
  set author_profile_id = target_profile.id
  where lower(author_email) = lower(target_profile.email)
    and (author_profile_id is null or author_profile_id <> target_profile.id);

  get diagnostics linked_count = row_count;
  return linked_count;
end;
$$;

grant execute on function public.sprintpulse_project_role_for_app_role(text) to authenticated;
grant execute on function public.auto_link_sprintpulse_identity_email(text) to authenticated;

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

  if claimed_profile_id is not null then
    perform public.auto_link_sprintpulse_identity_email(claimed_profile_id);
  end if;

  return claimed_profile_id;
end;
$$;

grant execute on function public.claim_sprintpulse_profile() to authenticated;

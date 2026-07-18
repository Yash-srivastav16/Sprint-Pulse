begin;

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
    left join public.project_members member
      on member.project_id = project.id
      and member.profile_id = public.current_sprintpulse_profile_id()
    where project.id = target_project_id
      and public.current_sprintpulse_profile_id() is not null
      and (
        project.created_by = public.current_sprintpulse_profile_id()
        or member.role in ('product-owner', 'scrum-master', 'engineering-manager')
      )
      and public.current_sprintpulse_persona() in ('product-owner', 'scrum-master', 'engineering-manager')
  )
$$;

grant execute on function public.can_manage_sprintpulse_project(uuid) to authenticated;

create or replace function public.can_submit_sprintpulse_standup(
  target_project_id uuid,
  target_profile_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_view_sprintpulse_project(target_project_id)
    and exists (
      select 1
      from public.project_members member
      where member.project_id = target_project_id
        and member.profile_id = target_profile_id
    )
    and (
      target_profile_id = public.current_sprintpulse_profile_id()
      or public.can_manage_sprintpulse_project(target_project_id)
    )
$$;

grant execute on function public.can_submit_sprintpulse_standup(uuid, text) to authenticated;

drop policy if exists "standups_insert_own_or_manager" on public.standups;
create policy "standups_insert_own_or_manager"
  on public.standups
  for insert
  with check (
    public.can_submit_sprintpulse_standup(project_id, profile_id)
  );

drop policy if exists "standups_update_own_or_manager" on public.standups;
create policy "standups_update_own_or_manager"
  on public.standups
  for update
  using (
    public.can_submit_sprintpulse_standup(project_id, profile_id)
  )
  with check (
    public.can_submit_sprintpulse_standup(project_id, profile_id)
  );

commit;

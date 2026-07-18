create or replace function public.can_view_sprintpulse_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_sprintpulse_persona() = 'product-owner'
    or exists (
      select 1
      from public.projects project
      where project.id = target_project_id
        and project.created_by = public.current_sprintpulse_profile_id()
    )
    or exists (
      select 1
      from public.project_members member
      where member.project_id = target_project_id
        and member.profile_id = public.current_sprintpulse_profile_id()
    )
$$;

grant execute on function public.can_view_sprintpulse_project(uuid) to authenticated;

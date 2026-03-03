-- Phase 2.1: Paths — step_paths junction table + extend paths

-- step_paths junction (many-to-many: steps <-> paths)
create table public.step_paths (
  step_id    uuid not null references public.steps(id) on delete cascade,
  path_id    uuid not null references public.paths(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (step_id, path_id)
);

create index step_paths_path_id on public.step_paths (path_id);
create index step_paths_step_id on public.step_paths (step_id);

alter table public.step_paths enable row level security;

create policy "Users can manage own step_paths"
  on public.step_paths for all
  using (
    exists (
      select 1 from public.steps s
      where s.id = step_paths.step_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.steps s
      where s.id = step_paths.step_id and s.user_id = auth.uid()
    )
  );

-- Extend paths table with description and archive support
alter table public.paths
  add column description text,
  add column is_archived boolean not null default false;

-- Update claim RPC to also transfer paths
create or replace function public.claim_anonymous_todos(anon_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() = anon_user_id then return; end if;

  update public.journeys   set user_id = auth.uid() where user_id = anon_user_id;
  update public.paths       set user_id = auth.uid() where user_id = anon_user_id;
  update public.milestones set user_id = auth.uid() where user_id = anon_user_id;
  update public.steps      set user_id = auth.uid() where user_id = anon_user_id;
  -- step_paths rows follow steps via FK, no user_id column needed
end;
$$;

-- Phase 2.2: Milestones — extend with goal tracking fields

alter table public.milestones
  add column description  text,
  add column target_count integer check (target_count > 0),
  add column target_date  date,
  add column completed_at timestamptz;

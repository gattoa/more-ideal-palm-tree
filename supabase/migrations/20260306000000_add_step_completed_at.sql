-- Add completed_at to steps
-- Records when a step was marked complete (null = incomplete).
-- Powers the archive mechanic (completed steps age out of Today at midnight)
-- and provides timestamped data for progress tracking and framework visualizations.

alter table public.steps
  add column completed_at timestamptz;

-- Backfill: rows that are already marked complete get a best-guess timestamp
-- of their created_at (we have no better signal for historical rows).
update public.steps
  set completed_at = created_at
  where completed = true;

-- Index supports "show me steps completed today" queries efficiently.
create index steps_user_completed_at
  on public.steps (user_id, completed_at);

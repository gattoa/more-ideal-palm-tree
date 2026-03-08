-- Revert: remove promoted_from_step_id (restores single FK between steps and milestones)
ALTER TABLE public.milestones DROP COLUMN IF EXISTS promoted_from_step_id;

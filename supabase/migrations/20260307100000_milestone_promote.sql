-- Track which step was promoted to create this milestone
ALTER TABLE public.milestones ADD COLUMN promoted_from_step_id uuid REFERENCES public.steps(id) ON DELETE SET NULL;

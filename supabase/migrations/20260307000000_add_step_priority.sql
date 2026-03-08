-- Add nullable priority column to steps
ALTER TABLE public.steps ADD COLUMN priority integer;
CREATE INDEX steps_priority ON public.steps (user_id, priority);

ALTER TABLE public.fast_category_performance
  ADD COLUMN IF NOT EXISTS achievement_level_description text,
  ADD COLUMN IF NOT EXISTS next_steps text;

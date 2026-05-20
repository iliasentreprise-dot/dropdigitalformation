
-- Ensure moderator role exists in enum
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

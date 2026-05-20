
-- Soft-delete columns
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Private messages
CREATE TABLE IF NOT EXISTS public.private_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX IF NOT EXISTS idx_pm_pair ON public.private_messages (
  LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at
);
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

-- View own conversations or admin sees all
CREATE POLICY pm_select ON public.private_messages
  FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY pm_insert ON public.private_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR NOT EXISTS (SELECT 1 FROM public.muted_users WHERE user_id = auth.uid())
    )
  );

-- Soft-delete: own message or admin/moderator can soft-delete
CREATE POLICY pm_update ON public.private_messages
  FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
  WITH CHECK (
    sender_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  );

-- Admin can update any profile
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;

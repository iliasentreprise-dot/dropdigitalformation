CREATE TABLE IF NOT EXISTS public.dm_acceptances (
  recipient_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recipient_id, sender_id)
);

ALTER TABLE public.dm_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm_acc_select" ON public.dm_acceptances
  FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id OR auth.uid() = sender_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "dm_acc_insert" ON public.dm_acceptances
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "dm_acc_delete" ON public.dm_acceptances
  FOR DELETE TO authenticated
  USING (auth.uid() = recipient_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_acceptances;
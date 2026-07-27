ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_reason text;

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  reason text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON public.admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit_logs(actor_id, created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_select_admin_audit_logs ON public.admin_audit_logs;
CREATE POLICY super_admin_select_admin_audit_logs ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin');

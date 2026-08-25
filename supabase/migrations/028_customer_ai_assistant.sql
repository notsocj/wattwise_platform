-- Customer AI Assistant message history and confirmed-action audit state.
-- Browser clients may read their own history, but only trusted server routes
-- (service role) may create or mutate messages and proposals.

CREATE TABLE IF NOT EXISTS public.customer_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  proposal jsonb,
  proposal_status text CHECK (
    proposal_status IS NULL OR proposal_status IN (
      'pending', 'processing', 'confirmed', 'expired', 'failed'
    )
  ),
  proposal_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  CONSTRAINT customer_ai_proposal_state_check CHECK (
    (proposal IS NULL AND proposal_status IS NULL)
    OR (proposal IS NOT NULL AND role = 'assistant' AND proposal_status IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_customer_ai_messages_user_created
  ON public.customer_ai_messages(user_id, created_at DESC);

ALTER TABLE public.customer_ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_customer_ai_messages"
  ON public.customer_ai_messages;
CREATE POLICY "users_select_own_customer_ai_messages"
  ON public.customer_ai_messages
  FOR SELECT
  USING (user_id = auth.uid());

REVOKE ALL ON public.customer_ai_messages FROM anon, authenticated;
GRANT SELECT ON public.customer_ai_messages TO authenticated;


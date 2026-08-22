-- Budget notification preferences and provider delivery audit trail.
-- External delivery remains asynchronous: a Supabase Database Webhook invokes
-- dispatch-budget-notifications after a device_budget_events INSERT.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  onesignal_external_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  budget_push_enabled boolean NOT NULL DEFAULT false,
  budget_email_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.notification_preferences (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_notification_preferences_for_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_create_notification_preferences
  ON public.profiles;
CREATE TRIGGER on_profile_created_create_notification_preferences
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_notification_preferences_for_profile();

CREATE OR REPLACE FUNCTION public.touch_notification_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_notification_preferences_updated_at
  ON public.notification_preferences;
CREATE TRIGGER touch_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_notification_preferences_updated_at();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_notification_preferences"
  ON public.notification_preferences;
CREATE POLICY "users_select_own_notification_preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_notification_preferences"
  ON public.notification_preferences;
CREATE POLICY "users_update_own_notification_preferences"
  ON public.notification_preferences
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.notification_preferences FROM anon, authenticated;
GRANT SELECT ON public.notification_preferences TO authenticated;
GRANT UPDATE (budget_push_enabled, budget_email_enabled)
  ON public.notification_preferences TO authenticated;

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_event_id uuid REFERENCES public.device_budget_events(id) ON DELETE SET NULL,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('push', 'email')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  provider_message_id text,
  error_code text,
  error_message text,
  is_test boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_delivery_event_recipient_channel
  ON public.notification_deliveries(budget_event_id, recipient_id, channel)
  WHERE budget_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient_created
  ON public.notification_deliveries(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_test_cooldown
  ON public.notification_deliveries(recipient_id, channel, created_at DESC)
  WHERE is_test = true;

CREATE OR REPLACE FUNCTION public.touch_notification_delivery_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_notification_delivery_updated_at
  ON public.notification_deliveries;
CREATE TRIGGER touch_notification_delivery_updated_at
  BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.touch_notification_delivery_updated_at();

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_notification_deliveries"
  ON public.notification_deliveries;
CREATE POLICY "users_select_own_notification_deliveries"
  ON public.notification_deliveries
  FOR SELECT
  USING (recipient_id = auth.uid());

REVOKE ALL ON public.notification_deliveries FROM anon, authenticated;
GRANT SELECT ON public.notification_deliveries TO authenticated;

-- Atomically reserves one test delivery per recipient/channel in any rolling
-- 60-second window. Only the service-role dispatcher may call this function.
CREATE OR REPLACE FUNCTION public.reserve_notification_test_delivery(
  p_recipient_id uuid,
  p_channel text
)
RETURNS TABLE (delivery_id uuid, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_created_at timestamptz;
  reserved_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF p_channel NOT IN ('push', 'email') THEN
    RAISE EXCEPTION 'Unsupported notification channel';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_recipient_id::text || ':' || p_channel, 0)
  );

  SELECT created_at INTO last_created_at
  FROM public.notification_deliveries
  WHERE recipient_id = p_recipient_id
    AND channel = p_channel
    AND is_test = true
    AND created_at >= now() - interval '60 seconds'
  ORDER BY created_at DESC
  LIMIT 1;

  IF last_created_at IS NOT NULL THEN
    RETURN QUERY SELECT
      NULL::uuid,
      GREATEST(
        1,
        CEIL(EXTRACT(epoch FROM (last_created_at + interval '60 seconds' - now())))::integer
      );
    RETURN;
  END IF;

  INSERT INTO public.notification_deliveries (
    budget_event_id, recipient_id, channel, is_test
  ) VALUES (
    NULL, p_recipient_id, p_channel, true
  )
  RETURNING id INTO reserved_id;

  RETURN QUERY SELECT reserved_id, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_notification_test_delivery(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_notification_test_delivery(uuid, text)
  TO service_role;

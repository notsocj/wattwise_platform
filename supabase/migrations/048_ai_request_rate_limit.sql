-- Per-account limit for the signed-in AI features (OWASP A06 Insecure Design:
-- unrestricted resource consumption). Anyone can register, so without a limit
-- one account could send unlimited customer-assistant, manager-assistant or
-- insight requests and run up the OpenAI bill. Same shape as the public
-- chatbot limiter (migration 042), but its own table so signed-in use never
-- counts against the landing page's daily cap. Server (service role) only.

CREATE TABLE IF NOT EXISTS public.ai_request_hits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_request_hits_user_time
  ON public.ai_request_hits (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_hits_time
  ON public.ai_request_hits (created_at);

ALTER TABLE public.ai_request_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_request_hits FROM anon, authenticated;

-- Records one AI request and returns 'ok', or returns 'minute' or 'day'
-- without recording when that account's limit is already used up.
CREATE OR REPLACE FUNCTION public.take_ai_request_slot(
  p_user_id uuid,
  p_per_minute integer,
  p_per_day integer
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_minute integer;
  v_day integer;
BEGIN
  -- One account's parallel requests queue here, so they cannot overshoot.
  PERFORM pg_advisory_xact_lock(hashtext('ai_request:' || p_user_id::text));

  -- Keep the table small: nothing older than a day is ever read.
  DELETE FROM public.ai_request_hits WHERE created_at < now() - interval '1 day';

  SELECT count(*) FILTER (WHERE created_at > now() - interval '1 minute'), count(*)
    INTO v_minute, v_day
    FROM public.ai_request_hits
   WHERE user_id = p_user_id;

  IF v_minute >= p_per_minute THEN RETURN 'minute'; END IF;
  IF v_day >= p_per_day THEN RETURN 'day'; END IF;

  INSERT INTO public.ai_request_hits (user_id) VALUES (p_user_id);
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.take_ai_request_slot(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.take_ai_request_slot(uuid, integer, integer) TO service_role;

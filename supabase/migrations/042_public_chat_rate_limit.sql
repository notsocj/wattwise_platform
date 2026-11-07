-- Rate limit for the public landing-page chatbot (/api/public-assistant).
--
-- Anyone can open the landing page, so each visitor (a salted hash of their
-- IP, never the raw address) gets a small per-minute and per-day allowance,
-- and the whole chatbot has a daily cap so a botnet cannot run up the OpenAI
-- bill. Only the server (service role) can touch the table or the function.

CREATE TABLE IF NOT EXISTS public.public_chat_hits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_chat_hits_client_time
  ON public.public_chat_hits (client_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_chat_hits_time
  ON public.public_chat_hits (created_at);

ALTER TABLE public.public_chat_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_chat_hits FROM anon, authenticated;

-- Records one message and returns 'ok', or returns 'minute', 'day', or
-- 'global' without recording when that limit is already used up.
CREATE OR REPLACE FUNCTION public.take_public_chat_slot(
  p_client_hash text,
  p_per_minute integer,
  p_per_day integer,
  p_global_per_day integer
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_minute integer;
  v_day integer;
  v_global integer;
BEGIN
  -- One visitor's parallel requests queue here, so they cannot overshoot.
  PERFORM pg_advisory_xact_lock(hashtext('public_chat:' || p_client_hash));

  -- Keep the table small: nothing older than a day is ever read.
  DELETE FROM public.public_chat_hits WHERE created_at < now() - interval '1 day';

  SELECT count(*) FILTER (WHERE created_at > now() - interval '1 minute'), count(*)
    INTO v_minute, v_day
    FROM public.public_chat_hits
   WHERE client_hash = p_client_hash;

  IF v_minute >= p_per_minute THEN RETURN 'minute'; END IF;
  IF v_day >= p_per_day THEN RETURN 'day'; END IF;

  SELECT count(*) INTO v_global FROM public.public_chat_hits;
  IF v_global >= p_global_per_day THEN RETURN 'global'; END IF;

  INSERT INTO public.public_chat_hits (client_hash) VALUES (p_client_hash);
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.take_public_chat_slot(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.take_public_chat_slot(text, integer, integer, integer) TO service_role;

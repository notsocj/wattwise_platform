-- One round trip for the middleware: the caller's profile fields plus whether
-- their session still exists.
--
-- The middleware verifies the access token locally (supabase.auth.getClaims),
-- which no longer asks the Auth server on every request. A signed-out or
-- "log out of all devices" session would otherwise stay usable until its token
-- expires (up to an hour). Checking auth.sessions here keeps sign-outs
-- immediate without adding a round trip. Returns no row for a caller without a
-- profile; session_active is false once the session is gone or past not_after.

CREATE OR REPLACE FUNCTION public.middleware_session_profile()
RETURNS TABLE (
  role text,
  must_update_password boolean,
  billing_cycle_start_day integer,
  disabled_at timestamptz,
  session_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.role::text,
    p.must_update_password,
    p.billing_cycle_start_day,
    p.disabled_at,
    EXISTS (
      SELECT 1
      FROM auth.sessions s
      WHERE s.id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid
        AND s.user_id = (SELECT auth.uid())
        AND (s.not_after IS NULL OR s.not_after > now())
    )
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION public.middleware_session_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.middleware_session_profile() TO authenticated;

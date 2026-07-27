-- Anonymous ESP32 requests must never query profiles while PostgREST is
-- evaluating RLS policies. That query recursively re-enters profiles RLS.

CREATE OR REPLACE FUNCTION current_profile_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  profile_role text;
BEGIN
  IF auth.role() = 'anon' THEN
    RETURN NULL;
  END IF;

  SELECT role INTO profile_role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN profile_role;
END;
$$;

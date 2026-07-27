-- Prevent profiles RLS policies from recursively calling themselves through
-- current_profile_role(). The helper is SECURITY DEFINER and explicitly
-- disables row security for its internal role lookup.

CREATE OR REPLACE FUNCTION current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Short-circuit anonymous hardware requests before any profile lookup.

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
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO profile_role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN profile_role;
END;
$$;

CREATE OR REPLACE FUNCTION can_access_device(target_device devices)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN true;
  END IF;

  RETURN current_profile_role() = 'super_admin'
    OR target_device.owner_id = auth.uid()
    OR target_device.user_id = auth.uid()
    OR target_device.tenant_id = auth.uid();
END;
$$;

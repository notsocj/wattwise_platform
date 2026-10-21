-- Prevent signed-in users from escalating privileges through their own
-- profiles row. The users_update_own_profile / users_insert_own_profile
-- policies (014) only check id = auth.uid(), so without this guard a user
-- could set role = 'super_admin', clear disabled_at, or attach a manager_id.
--
-- The guard applies only to requests made as the PostgREST `authenticated`
-- or `anon` roles. The service-role admin client and SECURITY DEFINER
-- functions such as handle_new_user() run as other roles and are unaffected,
-- so admin edits, tenant creation, and signup keep working.

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF current_profile_role() = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.role, 'user') NOT IN ('user', 'manager')
      OR NEW.manager_id IS NOT NULL
      OR NEW.disabled_at IS NOT NULL
      OR NEW.disabled_reason IS NOT NULL THEN
      RAISE EXCEPTION 'Not allowed to set privileged profile fields'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.manager_id IS DISTINCT FROM OLD.manager_id
    OR NEW.disabled_at IS DISTINCT FROM OLD.disabled_at
    OR NEW.disabled_reason IS DISTINCT FROM OLD.disabled_reason
    OR (NEW.must_update_password AND NOT OLD.must_update_password) THEN
    RAISE EXCEPTION 'Not allowed to change privileged profile fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER guard_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_privileged_columns();

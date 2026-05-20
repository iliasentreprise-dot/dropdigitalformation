-- Protect original super-admin from being demoted
DROP TRIGGER IF EXISTS protect_original_admin_update ON public.user_roles;
DROP TRIGGER IF EXISTS protect_original_admin_delete ON public.user_roles;

CREATE OR REPLACE FUNCTION public.protect_original_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user uuid;
  original_email text;
BEGIN
  target_user := COALESCE(OLD.user_id, NEW.user_id);
  SELECT email INTO original_email FROM auth.users WHERE id = target_user;
  IF original_email = 'ilias.entreprise@gmail.com' AND OLD.role = 'admin' THEN
    RAISE EXCEPTION 'Cannot modify or remove admin role of original super-admin';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER protect_original_admin_update
BEFORE UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_original_admin();

CREATE TRIGGER protect_original_admin_delete
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_original_admin();
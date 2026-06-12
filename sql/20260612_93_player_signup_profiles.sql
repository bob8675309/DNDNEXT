-- DNDNext player self-registration and profile provisioning.
--
-- New email/password accounts are always provisioned as players. User-supplied
-- metadata is used only for the player-facing name and can never assign roles.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS players_user_id_uidx
ON public.players (user_id);

CREATE OR REPLACE FUNCTION public.sync_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  profile_name text;
BEGIN
  profile_name := left(
    COALESCE(
      NULLIF(btrim(NEW.raw_user_meta_data->>'character_name'), ''),
      NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''),
      NULLIF(btrim(split_part(COALESCE(NEW.email, ''), '@', 1)), ''),
      'New Player'
    ),
    80
  );

  -- Never trust user-editable metadata for authorization. New accounts always
  -- start as players; only an existing administrator may elevate a role later.
  INSERT INTO public.user_profiles (id, role)
  VALUES (NEW.id, 'player')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.players (user_id, name)
  VALUES (NEW.id, profile_name)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_user_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_profile() TO service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_profile();

-- Backfill the player-facing row for existing accounts without changing any
-- existing role or player record.
INSERT INTO public.user_profiles (id, role)
SELECT users.id, 'player'
FROM auth.users AS users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.players (user_id, name)
SELECT
  users.id,
  left(
    COALESCE(
      NULLIF(btrim(users.raw_user_meta_data->>'character_name'), ''),
      NULLIF(btrim(users.raw_user_meta_data->>'display_name'), ''),
      NULLIF(btrim(split_part(COALESCE(users.email, ''), '@', 1)), ''),
      'New Player'
    ),
    80
  )
FROM auth.users AS users
ON CONFLICT (user_id) DO NOTHING;

-- Replace the duplicated legacy player policies with one explicit policy set.
DO $policies$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'players'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.players', policy_row.policyname);
  END LOOP;
END;
$policies$;

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.players FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.players TO authenticated;
GRANT ALL ON TABLE public.players TO service_role;

CREATE POLICY players_select_self
ON public.players
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY players_insert_self
ON public.players
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY players_update_self
ON public.players
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY players_admin_all
ON public.players
FOR ALL
TO authenticated
USING ((SELECT private.current_user_is_admin()))
WITH CHECK ((SELECT private.current_user_is_admin()));

NOTIFY pgrst, 'reload schema';

COMMIT;

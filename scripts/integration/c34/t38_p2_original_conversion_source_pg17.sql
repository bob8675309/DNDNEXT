-- T38-P2-R1 research: exact source snapshot from read-only DnDWeb pg_get_functiondef, 2026-11-17.
-- HOSTED SOURCE IS INTENTIONALLY VULNERABLE. Run only in disposable local PG17.
\if :{?T38_P2_DISPOSABLE_LOCAL_CONFIRMED}
\else
\echo 'T38 REFUSE: required disposable-only confirmation missing'
\quit 1
\endif
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $gate$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('public.characters') IS NULL
 OR to_regclass('public.character_sheets') IS NULL
 OR to_regclass('public.character_stock') IS NULL
 OR to_regclass('public.character_permissions') IS NULL
 OR to_regclass('public.user_profiles') IS NULL
 OR to_regprocedure('public.create_character_v1(jsonb)') IS NULL
 OR md5(pg_get_functiondef('private.can_access_character_v1(uuid,text)'::regprocedure))
 <> '97b5e6b059e6467e24c4283fe420c83e'
 OR to_regprocedure('public.set_character_kind(uuid,text)') IS NOT NULL
 OR to_regprocedure('public.convert_character_type(uuid,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'T38 REFUSE: not a fresh disposable signed original fixture'; END IF;
END $gate$;
-- These original storefront metadata columns are absent only in the reduced scratch database.
ALTER TABLE public.characters
 ADD COLUMN IF NOT EXISTS storefront_title text,
 ADD COLUMN IF NOT EXISTS storefront_tagline text,
 ADD COLUMN IF NOT EXISTS storefront_bg_url text,
 ADD COLUMN IF NOT EXISTS storefront_bg_video_url text,
 ADD COLUMN IF NOT EXISTS storefront_bg_image_url text;
-- Hosted authenticated grant: narrow kind/storefront UPDATE, no table-wide UPDATE.
GRANT UPDATE (kind,storefront_enabled) ON public.characters TO authenticated;
-- DO NOT MODIFY either exact live function body; preserve source CRLF and search_path.
CREATE OR REPLACE FUNCTION public.set_character_kind(p_character_id uuid, p_target text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  caller uuid := auth.uid();
  caller_role text;
  target_kind text;
begin
  if caller is null then
    raise exception 'Not signed in';
  end if;

  select role into caller_role from public.user_profiles where id = caller;
  caller_role := coalesce(caller_role, 'player');
  if caller_role = 'player' then
    raise exception 'Not authorized';
  end if;

  target_kind := lower(coalesce(p_target, 'npc'));
  if target_kind not in ('npc','merchant') then
    raise exception 'Invalid target kind: %', p_target;
  end if;

  -- wipe stock on conversion (prevents cross-contamination)
  delete from public.character_stock where character_id = p_character_id;

  if target_kind = 'merchant' then
    update public.characters
       set kind = 'merchant',
           storefront_enabled = true,
           updated_at = now()
     where id = p_character_id;
  else
    update public.characters
       set kind = 'npc',
           storefront_enabled = false,
           storefront_title = null,
           storefront_tagline = null,
           storefront_bg_url = null,
           storefront_bg_video_url = null,
           storefront_bg_image_url = null,
           updated_at = now()
     where id = p_character_id;
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.convert_character_type(p_character_id uuid, p_target_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
begin
  -- Backward-compatible alias used by older helpers.
  perform public.set_character_kind(p_character_id, p_target_type);
end;
$function$
;
DO $source_identity$
BEGIN
 IF md5(pg_get_functiondef('public.set_character_kind(uuid,text)'::regprocedure))
 <> '04588d4b433b13c92e612039a7c7e56e'
 OR md5(pg_get_functiondef('public.convert_character_type(uuid,text)'::regprocedure))
 <> '1a6ab5aa4bc58eceace51ad3803ed961'
 THEN RAISE EXCEPTION 'T38 REFUSE: source fingerprint changed'; END IF;
END $source_identity$;
REVOKE ALL ON FUNCTION public.set_character_kind(uuid,text),
 public.convert_character_type(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_character_kind(uuid,text),
 public.convert_character_type(uuid,text) TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';

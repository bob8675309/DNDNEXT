-- C3M: source-exact live guard (read-only captured 2026-11-08).
-- Disposable PG17 only. Do NOT run on production or touch world-map triggers.
\set ON_ERROR_STOP on
DO $local$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('public.characters') IS NULL OR to_regprocedure('private.protect_mog_delete_v1()') IS NOT NULL
 THEN RAISE EXCEPTION 'C3M requires source-shaped empty disposable PG17 fixture'; END IF;
END $local$;
CREATE OR REPLACE FUNCTION private.protect_mog_delete_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if current_setting('app.allow_delete_mog', true) = 'on' then
    return old;
  end if;

  if old.id = 'c0a40081-9bab-402d-8437-62267e596c4f'::uuid
     or lower(btrim(old.name)) = 'mog' then
    raise exception 'Mog is protected and cannot be deleted' using errcode = '42501';
  end if;

  return old;
end;
$function$;
CREATE TRIGGER protect_mog_delete_v1
BEFORE DELETE ON public.characters
FOR EACH ROW EXECUTE FUNCTION private.protect_mog_delete_v1();
DO $fingerprint$
BEGIN
 IF md5(pg_get_functiondef('private.protect_mog_delete_v1()'::regprocedure))
 <> '80798b0ae487f01f1b9c3025fbfe992b'
 OR (SELECT pg_get_triggerdef(oid,true) FROM pg_trigger
  WHERE tgrelid='public.characters'::regclass AND tgname='protect_mog_delete_v1' AND NOT tgisinternal)
  NOT LIKE '%BEFORE DELETE%'
 THEN RAISE EXCEPTION 'C3M source fingerprint or trigger timing drift'; END IF;
END $fingerprint$;
\echo 'PASS C3M00: source-identical original non-map character delete guard installed in disposable C3.3'

-- C3.3 source-exact live PG17.4 character_progression cancellation trigger.
-- One of the 14 original creation-adjacent DDL missing from the historical
-- 17/31 staged test suite. NON-PRODUCTION; used only in joined local JWT PG17.
-- Captured source MD5: f6dcf56f72091961d0e9958e86367dd1
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres'
    OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
    OR to_regclass('auth.users') IS NULL
    OR to_regclass('public.character_progression') IS NULL
    OR to_regclass('public.character_level_up_sessions') IS NOT NULL
    OR to_regprocedure('private.cancel_invalid_level_up_session_v1()') IS NOT NULL
 THEN RAISE EXCEPTION 'C3.3 progression session guard is restricted to disposable PG17';
 END IF;
END $guard$;

-- Reduced session data shape required solely to exercise original trigger
-- state transitions; NOT a copy of the full production level-up session API.
CREATE TABLE public.character_level_up_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL REFERENCES public.characters(id),
 status text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);

-- Exact copied source from read-only live pg_get_functiondef.
CREATE OR REPLACE FUNCTION private.cancel_invalid_level_up_session_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
  if not new.pending_level_up or new.class_level is distinct from old.class_level then
    update public.character_level_up_sessions
    set status = 'cancelled', updated_at = now()
    where character_id = new.character_id and status = 'open';
  end if;
  return new;
end;
$function$;

CREATE TRIGGER cancel_invalid_level_up_session_v1
 AFTER UPDATE OF class_level, pending_level_up ON public.character_progression
 FOR EACH ROW EXECUTE FUNCTION private.cancel_invalid_level_up_session_v1();

DO $verify$
DECLARE v_sql text;
BEGIN
 IF md5(pg_get_functiondef('private.cancel_invalid_level_up_session_v1()'::regprocedure))
      <> 'f6dcf56f72091961d0e9958e86367dd1'
 THEN RAISE EXCEPTION 'Original level-up cancellation handler source drift'; END IF;
 SELECT pg_get_triggerdef(oid,true) INTO v_sql
 FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass
   AND tgname='cancel_invalid_level_up_session_v1'
   AND NOT tgisinternal;
 IF v_sql IS NULL OR v_sql NOT LIKE '%AFTER UPDATE OF class_level, pending_level_up%'
 THEN RAISE EXCEPTION 'Original level-up cancel trigger timing drift: %',v_sql; END IF;
END $verify$;
\echo 'PASS C3L00: source-original level-up session cancel trigger installed with reduced status-only session table'

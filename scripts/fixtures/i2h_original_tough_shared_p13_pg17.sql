-- I2-H: exact read-only live original private Tough level-up progression
-- and its source name normalization helper, DnDWeb PG17 2026-11-12.
-- Local PG17+GoTrue signed source research only. Not a hosted migration.
\set ON_ERROR_STOP on
DO $i2h_pre$
BEGIN
 IF current_database()<>'postgres'
   OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
   OR to_regclass('private.p13_levelup_case_guard') IS NULL
   OR to_regclass('auth.users') IS NULL
   OR to_regclass('public.character_option_grant_instances') IS NOT NULL
   OR md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))
       <> '02d74b973a763c53c595be20e35e512f'
   OR md5(pg_get_functiondef('private.complete_character_level_up_base_v3(uuid,jsonb)'::regprocedure))
       <> 'e33639d549ef557976a3970ea51f5238'
   OR md5(pg_get_functiondef('private.sync_player_forge_class_spell_summary_v1(uuid)'::regprocedure))
       <> '5b1b275a268a57591a2e35a05ce7480d'
 THEN RAISE EXCEPTION 'I2H only in clean original signed P1.3 PG17 scratch';
 END IF;
END $i2h_pre$;

-- Synthetic LOCAL feat-instance table captures ONLY the original helper's
-- required columns. This is NOT the actual grant/ownership/Forge schema or flow.
CREATE TABLE public.character_option_grant_instances(
 character_id uuid NOT NULL REFERENCES public.characters(id),
 option_name text NOT NULL,
 acquisition_level integer NOT NULL CHECK(acquisition_level BETWEEN 1 AND 20)
);
ALTER TABLE public.character_option_grant_instances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.character_option_grant_instances FROM PUBLIC,anon,authenticated;

-- SOURCE-ORIGINAL name helper pg_get_functiondef MD5 dd8cdd5b47efe99b1cfff9c2bf7635dd
CREATE OR REPLACE FUNCTION private.normalize_player_choice_name_v1(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$
  select regexp_replace(
    lower(
      case
        when coalesce(btrim(p_value), '') ~ '^[^|[:space:]{}\[\]":,]+\|[^|[:space:]{}\[\]":,]+(?:\|.*)?$'
          then split_part(btrim(p_value), '|', 1)
        else coalesce(btrim(p_value), '')
      end
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$function$
;
-- SOURCE-ORIGINAL Tough helper pg_get_functiondef MD5 2b8bca48b7067e2e67b66defcb7f2c10
CREATE OR REPLACE FUNCTION private.apply_tough_progression_bonus_v1(p_character_id uuid, p_to_level integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_tough_acquired integer;
  v_sheet jsonb:='{}'::jsonb;
  v_hp integer:=0;
  v_max integer:=0;
begin
  select min(gi.acquisition_level) into v_tough_acquired
  from public.character_option_grant_instances gi
  where gi.character_id=p_character_id
    and private.normalize_player_choice_name_v1(gi.option_name)='tough';

  if v_tough_acquired is null or v_tough_acquired >= p_to_level then return 0; end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=p_character_id for update;
  begin v_hp:=coalesce((v_sheet->>'hp')::integer,0); exception when others then v_hp:=0; end;
  begin v_max:=coalesce((v_sheet->>'maxHp')::integer,v_hp); exception when others then v_max:=v_hp; end;
  v_sheet:=jsonb_set(v_sheet,'{hp}',to_jsonb(greatest(1,v_hp+2)),true);
  v_sheet:=jsonb_set(v_sheet,'{maxHp}',to_jsonb(greatest(1,v_max+2)),true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
  return 2;
end;
$function$
;
REVOKE ALL ON FUNCTION private.normalize_player_choice_name_v1(text),
 private.apply_tough_progression_bonus_v1(uuid,integer)
 FROM PUBLIC,anon,authenticated;
DO $i2h_md5$
BEGIN
 IF md5(pg_get_functiondef('private.normalize_player_choice_name_v1(text)'::regprocedure))
     <> 'dd8cdd5b47efe99b1cfff9c2bf7635dd'
 OR md5(pg_get_functiondef('private.apply_tough_progression_bonus_v1(uuid,integer)'::regprocedure))
     <> '2b8bca48b7067e2e67b66defcb7f2c10'
 OR has_function_privilege('authenticated','private.apply_tough_progression_bonus_v1(uuid,integer)','EXECUTE')
 OR has_function_privilege('anon','private.apply_tough_progression_bonus_v1(uuid,integer)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.complete_character_level_up_v5(uuid,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'I2H exact original Tough/helper signature or ACL drift'; END IF;
END $i2h_md5$;
NOTIFY pgrst,'reload schema';

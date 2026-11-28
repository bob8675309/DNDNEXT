-- I1-P source-exact REST graph extracted by READ-ONLY live pg_get_functiondef.
-- Disposable P1.3 genuine signed local Auth/PG17 only. NEVER hosted SQL.
-- This fixture preserves full original rest helper and orchestrator bodies.
-- Reduced Fighter/Barbarian scratch schema has NO encounter-rest-log veto trigger,
-- and is NOT a full production spell-slot/encounter/caster source matrix.
\set ON_ERROR_STOP on
DO $start$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.p13_levelup_case_guard') IS NULL
 OR to_regclass('auth.users') IS NULL
 OR to_regprocedure('public.complete_character_level_up_v5(uuid,jsonb)') IS NULL
 OR md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))<>'02d74b973a763c53c595be20e35e512f'
 OR to_regprocedure('public.complete_character_rest_v1(uuid,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'I1-P requires prior P1.3 original v5 disposable signed fixture'; END IF;
END $start$;
-- Only TEST-generated character UUIDs/creation markers for preservation checks.
ALTER TABLE public.characters ADD COLUMN creation_request_id uuid;
ALTER TABLE public.class_catalog ADD COLUMN caster_progression text;
ALTER TABLE public.character_spells
 ADD COLUMN uses_max integer,
 ADD COLUMN uses_remaining integer,
 ADD COLUMN recharge text,
 ADD COLUMN created_at timestamptz DEFAULT now(),
 ADD COLUMN updated_at timestamptz DEFAULT now();
CREATE TABLE public.character_spell_slots(
 character_id uuid NOT NULL REFERENCES public.characters(id),
 pool_key text NOT NULL,slot_level integer NOT NULL,
 slots_max integer NOT NULL,slots_remaining integer NOT NULL,
 recharge_key text NOT NULL,source_class_id uuid,
 source_class_key text,source_book text,
 source_ruleset text,source_class_level integer,
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
 PRIMARY KEY(character_id,pool_key,slot_level)
);
CREATE TABLE public.character_rest_log(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL REFERENCES public.characters(id),
 rest_type text NOT NULL,completed_by uuid,
 restored_spell_slots integer NOT NULL DEFAULT 0,
 restored_spell_uses integer NOT NULL DEFAULT 0,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 completed_at timestamptz DEFAULT now()
);
INSERT INTO public.class_catalog(id,class_key,class_name,source,ruleset,hit_die,spellcasting_ability,caster_progression)
VALUES('00000000-0000-0000-0000-000000008521','barbarian','Barbarian','XPHB','2024',12,NULL,NULL);
INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots)
VALUES('00000000-0000-0000-0000-000000008521',1,0,2,'[]'::jsonb);

-- ORIGINAL function sync_character_spell_slots_v1: live pg_get_functiondef MD5 6c276ab2135fb90894fd8684e39ce1c3
CREATE OR REPLACE FUNCTION private.sync_character_spell_slots_v1(p_character_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_class_id uuid;
  v_class_level integer;
  v_class_key text;
  v_source text;
  v_ruleset text;
  v_caster_progression text;
  v_spellcasting_ability text;
  v_spell_slots jsonb;
  v_pool_key text;
  v_recharge_key text;
  v_levels integer[] := '{}'::integer[];
  v_slot record;
  v_rows integer := 0;
  v_changed integer := 0;
begin
  if p_character_id is null then return 0; end if;

  select cp.class_id,cp.class_level,c.class_key,c.source,c.ruleset,
         c.caster_progression,c.spellcasting_ability,lp.spell_slots
  into v_class_id,v_class_level,v_class_key,v_source,v_ruleset,
       v_caster_progression,v_spellcasting_ability,v_spell_slots
  from public.character_progression cp
  join public.class_catalog c on c.id=cp.class_id
  left join public.class_level_progression lp
    on lp.class_id=cp.class_id and lp.class_level=cp.class_level
  where cp.character_id=p_character_id;

  if not found
     or nullif(btrim(coalesce(v_spellcasting_ability,'')),'') is null
     or jsonb_typeof(coalesce(v_spell_slots,'[]'::jsonb)) <> 'array' then
    delete from public.character_spell_slots where character_id=p_character_id;
    get diagnostics v_rows=row_count;
    return v_rows;
  end if;

  v_pool_key := case when lower(coalesce(v_caster_progression,''))='pact'
    then 'pact_magic' else 'spellcasting' end;
  v_recharge_key := case when v_pool_key='pact_magic'
    then 'short_rest' else 'long_rest' end;

  for v_slot in
    select ordinality::integer as slot_level,value::integer as slots_max
    from jsonb_array_elements_text(v_spell_slots) with ordinality
  loop
    if v_slot.slot_level between 1 and 9 and v_slot.slots_max > 0 then
      v_levels := array_append(v_levels,v_slot.slot_level);
      insert into public.character_spell_slots(
        character_id,pool_key,slot_level,slots_max,slots_remaining,recharge_key,
        source_class_id,source_class_key,source_book,source_ruleset,source_class_level
      ) values(
        p_character_id,v_pool_key,v_slot.slot_level,v_slot.slots_max,v_slot.slots_max,v_recharge_key,
        v_class_id,v_class_key,v_source,v_ruleset,v_class_level
      )
      on conflict(character_id,pool_key,slot_level) do update
      set slots_max=excluded.slots_max,
          slots_remaining=least(public.character_spell_slots.slots_remaining,excluded.slots_max),
          recharge_key=excluded.recharge_key,
          source_class_id=excluded.source_class_id,
          source_class_key=excluded.source_class_key,
          source_book=excluded.source_book,
          source_ruleset=excluded.source_ruleset,
          source_class_level=excluded.source_class_level,
          updated_at=timezone('utc',now());
      get diagnostics v_changed=row_count;
      v_rows := v_rows + v_changed;
    end if;
  end loop;

  if coalesce(array_length(v_levels,1),0)=0 then
    delete from public.character_spell_slots where character_id=p_character_id;
  else
    delete from public.character_spell_slots
    where character_id=p_character_id
      and (pool_key<>v_pool_key or not (slot_level=any(v_levels)));
  end if;

  return v_rows;
end;
$function$
;

-- ORIGINAL function character_sheet_resource_profile_json_v1: live pg_get_functiondef MD5 2c798f8351282d80e63ab8e9e9019272
CREATE OR REPLACE FUNCTION private.character_sheet_resource_profile_json_v1(p_character_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_class_key text;
  v_class_name text;
  v_class_level integer;
  v_slots jsonb:='[]'::jsonb;
  v_spell_uses jsonb:='[]'::jsonb;
  v_last_short timestamptz;
  v_last_long timestamptz;
begin
  select c.class_key,c.class_name,cp.class_level
  into v_class_key,v_class_name,v_class_level
  from public.character_progression cp
  join public.class_catalog c on c.id=cp.class_id
  where cp.character_id=p_character_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'poolKey',s.pool_key,'slotLevel',s.slot_level,'max',s.slots_max,'remaining',s.slots_remaining,
    'rechargeKey',s.recharge_key,'sourceClassKey',s.source_class_key,'sourceBook',s.source_book,
    'sourceRuleset',s.source_ruleset,'sourceClassLevel',s.source_class_level
  ) order by s.pool_key,s.slot_level),'[]'::jsonb)
  into v_slots
  from public.character_spell_slots s
  where s.character_id=p_character_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId',cs.id,
    'spellId',sp.id,
    'name',sp.name,
    'resourceLabel',coalesce(nullif(cs.raw_payload->>'resourceLabel',''),sp.name),
    'resourceFeature',nullif(cs.raw_payload->>'resourceFeature',''),
    'level',sp.level,
    'max',cs.uses_max,
    'remaining',coalesce(cs.uses_remaining,cs.uses_max),
    'recharge',cs.recharge,
    'sourceType',cs.source_type,
    'sourceLabel',cs.source_label
  ) order by sp.level,sp.name,cs.created_at),'[]'::jsonb)
  into v_spell_uses
  from public.character_spells cs
  join public.spells_catalog sp on sp.id=cs.spell_id
  where cs.character_id=p_character_id and cs.uses_max is not null and cs.uses_max>0;

  select max(completed_at) filter(where rest_type='short_rest'),
         max(completed_at) filter(where rest_type='long_rest')
  into v_last_short,v_last_long
  from public.character_rest_log
  where character_id=p_character_id;

  return jsonb_build_object(
    'schemaVersion',1,
    'characterId',p_character_id,
    'classKey',v_class_key,
    'className',v_class_name,
    'classLevel',v_class_level,
    'canManage',true,
    'slots',coalesce(v_slots,'[]'::jsonb),
    'limitedSpellUses',coalesce(v_spell_uses,'[]'::jsonb),
    'lastShortRest',v_last_short,
    'lastLongRest',v_last_long
  );
end;
$function$
;

-- ORIGINAL function restore_character_rest_action_state_v1: live pg_get_functiondef MD5 d75edf2ac583e3790882155c702e2165
CREATE OR REPLACE FUNCTION private.restore_character_rest_action_state_v1(p_character_id uuid, p_rest_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_sheet jsonb;
  v_class_key text := '';
  v_class_source text := '';
  v_level integer := 1;
  v_current jsonb := '{}'::jsonb;
  v_next jsonb := '{}'::jsonb;
  v_max integer := 0;
  v_remaining integer := 0;
  v_next_remaining integer := 0;
  v_restored integer := 0;
  v_active boolean := false;
begin
  select cs.sheet,
         lower(coalesce(cc.class_key,'')),
         upper(coalesce(cc.source,'')),
         greatest(1,least(20,coalesce(cp.class_level,1)))
  into v_sheet,v_class_key,v_class_source,v_level
  from public.character_sheets cs
  left join public.character_progression cp on cp.character_id=cs.character_id
  left join public.class_catalog cc on cc.id=cp.class_id
  where cs.character_id=p_character_id
  for update of cs;

  if v_sheet is null then
    return jsonb_build_object('restoredClassFeatureUses',0,'sheet',null,'features','[]'::jsonb);
  end if;

  if v_class_key <> 'barbarian' then
    return jsonb_build_object('restoredClassFeatureUses',0,'sheet',v_sheet,'features','[]'::jsonb);
  end if;

  if coalesce(v_sheet->>'rages','') ~ '^\d+$' then
    v_max := greatest(0,least(99,(v_sheet->>'rages')::integer));
  else
    v_max := case
      when v_level <= 2 then 2
      when v_level <= 5 then 3
      when v_level <= 11 then 4
      when v_level <= 16 then 5
      else 6
    end;
  end if;

  v_current := case
    when jsonb_typeof(v_sheet#>'{actionState,rage}')='object' then v_sheet#>'{actionState,rage}'
    else '{}'::jsonb
  end;
  v_active := coalesce((v_current->>'active')::boolean,false);
  if coalesce(v_current->>'usesRemaining','') ~ '^\d+$' then
    v_remaining := greatest(0,least(v_max,(v_current->>'usesRemaining')::integer));
  else
    v_remaining := v_max;
  end if;

  v_next_remaining := v_remaining;
  if v_class_source='XPHB' and p_rest_type='short_rest' then
    v_next_remaining := least(v_max,v_remaining+1);
  elsif p_rest_type='long_rest' then
    v_next_remaining := v_max;
  end if;
  v_restored := greatest(0,v_next_remaining-v_remaining);

  v_next := jsonb_build_object(
    'active',false,
    'usesRemaining',v_next_remaining,
    'usesMax',v_max,
    'updatedAt',timezone('utc',now())
  );
  v_sheet := jsonb_set(v_sheet,'{actionState}',coalesce(v_sheet->'actionState','{}'::jsonb),true);
  v_sheet := jsonb_set(v_sheet,'{actionState,rage}',v_next,true);

  update public.character_sheets
  set sheet=v_sheet,updated_at=now()
  where character_id=p_character_id;

  -- Preserve the existing legacy player-sheet compatibility projection used by the
  -- sheet action RPC. Character-scoped character_sheets remains authoritative.
  update public.players p
  set sheet=v_sheet,updated_at=now()
  where p.user_id in (
    select cp.user_id
    from public.character_permissions cp
    where cp.character_id=p_character_id and cp.can_edit
  );

  return jsonb_build_object(
    'restoredClassFeatureUses',v_restored,
    'sheet',v_sheet,
    'features',jsonb_build_array(jsonb_build_object(
      'actionKey','rage',
      'classSource',v_class_source,
      'usesBefore',v_remaining,
      'usesRemaining',v_next_remaining,
      'usesMax',v_max,
      'restoredUses',v_restored,
      'activeBeforeRest',v_active,
      'active',false
    ))
  );
end;
$function$
;

-- ORIGINAL function complete_character_rest_v1: live pg_get_functiondef MD5 fffbf0705d640a7d2bfb08aa78ad521a
CREATE OR REPLACE FUNCTION public.complete_character_rest_v1(p_character_id uuid, p_rest_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_rest_type text := lower(replace(replace(btrim(coalesce(p_rest_type,'')),' ','_'),'-','_'));
  v_slots_restored integer := 0;
  v_uses_restored integer := 0;
  v_class_uses_restored integer := 0;
  v_profile jsonb;
  v_action_result jsonb := '{}'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to complete rests for this character.' using errcode='42501';
  end if;
  if v_rest_type not in ('short_rest','long_rest') then
    raise exception 'Rest type must be short_rest or long_rest.' using errcode='22023';
  end if;

  perform private.sync_character_spell_slots_v1(p_character_id);

  select coalesce(sum(slots_max-slots_remaining),0)::integer
  into v_slots_restored
  from public.character_spell_slots
  where character_id=p_character_id
    and slots_remaining<slots_max
    and (v_rest_type='long_rest' or recharge_key='short_rest');

  update public.character_spell_slots
  set slots_remaining=slots_max,updated_at=timezone('utc',now())
  where character_id=p_character_id
    and slots_remaining<slots_max
    and (v_rest_type='long_rest' or recharge_key='short_rest');

  select coalesce(sum(uses_max-coalesce(uses_remaining,uses_max)),0)::integer
  into v_uses_restored
  from public.character_spells
  where character_id=p_character_id
    and uses_max is not null and uses_max>0
    and coalesce(uses_remaining,uses_max)<uses_max
    and case
      when v_rest_type='long_rest' then lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_')) in ('short_rest','long_rest')
      else lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_'))='short_rest'
    end;

  update public.character_spells
  set uses_remaining=uses_max,updated_at=timezone('utc',now())
  where character_id=p_character_id
    and uses_max is not null and uses_max>0
    and coalesce(uses_remaining,uses_max)<uses_max
    and case
      when v_rest_type='long_rest' then lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_')) in ('short_rest','long_rest')
      else lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_'))='short_rest'
    end;

  v_action_result := private.restore_character_rest_action_state_v1(p_character_id,v_rest_type);
  v_class_uses_restored := coalesce((v_action_result->>'restoredClassFeatureUses')::integer,0);

  insert into public.character_rest_log(
    character_id,rest_type,completed_by,restored_spell_slots,restored_spell_uses,details
  ) values(
    p_character_id,v_rest_type,auth.uid(),v_slots_restored,v_uses_restored,
    jsonb_build_object(
      'scope','standalone_character_sheet',
      'encounterStateChanged',false,
      'restoredClassFeatureUses',v_class_uses_restored,
      'classFeatures',coalesce(v_action_result->'features','[]'::jsonb),
      'restores',case when v_rest_type='short_rest'
        then jsonb_build_array('short-rest spell slots','short-rest limited spell uses','source-backed short-rest class feature uses')
        else jsonb_build_array('all spell slots','short-rest limited spell uses','long-rest limited spell uses','source-backed long-rest class feature uses')
      end
    )
  );

  -- The rest-log insert above still passes through the existing active-encounter guard.
  -- If that guard rejects the rest, this entire transaction (including sheet action state)
  -- rolls back atomically.
  v_profile:=private.character_sheet_resource_profile_json_v1(p_character_id);
  return v_profile || jsonb_build_object(
    'sheet',v_action_result->'sheet',
    'restResult',jsonb_build_object(
      'restType',v_rest_type,
      'restoredSpellSlots',v_slots_restored,
      'restoredSpellUses',v_uses_restored,
      'restoredClassFeatureUses',v_class_uses_restored,
      'classFeatures',coalesce(v_action_result->'features','[]'::jsonb)
    )
  );
end;
$function$
;

DO $originals$
BEGIN
 IF md5(pg_get_functiondef('private.sync_character_spell_slots_v1(uuid)'::regprocedure))<>'6c276ab2135fb90894fd8684e39ce1c3' THEN RAISE EXCEPTION 'I1-P source drift sync_character_spell_slots_v1'; END IF;
 IF md5(pg_get_functiondef('private.character_sheet_resource_profile_json_v1(uuid)'::regprocedure))<>'2c798f8351282d80e63ab8e9e9019272' THEN RAISE EXCEPTION 'I1-P source drift character_sheet_resource_profile_json_v1'; END IF;
 IF md5(pg_get_functiondef('private.restore_character_rest_action_state_v1(uuid,text)'::regprocedure))<>'d75edf2ac583e3790882155c702e2165' THEN RAISE EXCEPTION 'I1-P source drift restore_character_rest_action_state_v1'; END IF;
 IF md5(pg_get_functiondef('public.complete_character_rest_v1(uuid,text)'::regprocedure))<>'fffbf0705d640a7d2bfb08aa78ad521a' THEN RAISE EXCEPTION 'I1-P source drift complete_character_rest_v1'; END IF;
 IF md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))<>'02d74b973a763c53c595be20e35e512f' THEN RAISE EXCEPTION 'I1-P inherited v5 drift'; END IF;
END $originals$;
REVOKE ALL ON FUNCTION public.complete_character_rest_v1(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_character_rest_v1(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION private.sync_character_spell_slots_v1(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.character_sheet_resource_profile_json_v1(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.restore_character_rest_action_state_v1(uuid,text) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
\echo 'PASS I1P-REST-SOURCE: exact original rest orchestrator + 3 private helpers, five source fingerprints, no encounter-log guard in reduced scratch'

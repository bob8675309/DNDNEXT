-- C34 T16 SOURCE-ORIGINAL held I1-E #353 Wizard finalizer, with
-- ORIGINAL account-mirroring signature helper temporarily active for RED.
-- Original raw code Git blob c0322578db9e848b20a476b32681c07e316f0870;
-- original setup Git blob 0b833150367ce01297acf82d750de3f01be66044.
-- DISPOSABLE PostgreSQL17 only, no hosted SQL/Storage, no deployment.
\set ON_ERROR_STOP on
DO $t16_pre$
DECLARE n integer;
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('public.spells_catalog_preferred') IS NULL
 OR to_regprocedure('private.materialize_player_forge_battle_master_maneuvers_v1()') IS NULL
 OR to_regprocedure('private.materialize_player_forge_wizard_final_v1()') IS NOT NULL
 OR md5(pg_get_functiondef('private.normalize_player_choice_name_v1(text)'::regprocedure))<>'dd8cdd5b47efe99b1cfff9c2bf7635dd'
 OR md5(pg_get_functiondef('private.materialize_player_forge_battle_master_maneuvers_v1()'::regprocedure))<>'daf3fc12e7c30165dca50ca650f9d308'
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
 ('trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'T16 original Wizard source requires exact safe T15 disposable baseline'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O' AND c.relname IN
 ('character_progression','character_sheets','characters','inventory_items');
 IF n<>27 THEN RAISE EXCEPTION 'T16 expected 24 original +3 held triggers, got %',n; END IF;
END $t16_pre$;
CREATE OR REPLACE FUNCTION private.wizard_savant_school_v1(p_subclass_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case private.normalize_player_choice_name_v1(coalesce(p_subclass_name,''))
    when 'abjurer' then 'Abjuration'
    when 'diviner' then 'Divination'
    when 'evoker' then 'Evocation'
    when 'illusionist' then 'Illusion'
    else null end;
$function$;

CREATE OR REPLACE FUNCTION private.highest_spell_level_from_slots_v1(p_slots jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_index integer;
  v_highest integer := 0;
begin
  if jsonb_typeof(coalesce(p_slots,'[]'::jsonb)) = 'array' then
    if jsonb_array_length(p_slots) > 0 then
      for v_index in 0..jsonb_array_length(p_slots)-1 loop
        if coalesce((p_slots->>v_index)::integer,0) > 0 then
          v_highest := v_index + 1;
        end if;
      end loop;
    end if;
  elsif jsonb_typeof(p_slots) = 'object' then
    v_highest := greatest(0,coalesce((p_slots->>'pactSlotLevel')::integer,0));
  end if;
  return v_highest;
exception when invalid_text_representation then
  return 0;
end;
$function$;

CREATE OR REPLACE FUNCTION private.wizard_spellbook_has_spell_v1(p_character_id uuid, p_spell_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  select exists(
    select 1
    from public.character_progression cp
    join public.class_catalog c on c.id=cp.class_id
    join public.character_spells cs on cs.character_id=cp.character_id and cs.spell_id=p_spell_id
    join public.spells_catalog s on s.id=cs.spell_id
    where cp.character_id=p_character_id
      and lower(coalesce(c.class_key,''))='wizard'
      and (
        (cs.source_type='class' and s.level>=1)
        or (
          cs.source_type='class-feature'
          and coalesce((cs.raw_payload->>'wizardSpellbook')::boolean,false)
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION private.apply_wizard_signature_spell_ids_v1(p_character_id uuid, p_selected jsonb, p_cadence text, p_creator text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_selected jsonb:=coalesce(p_selected,'[]'::jsonb);
  v_key text;
  v_spell_id uuid;
  v_spell public.spells_catalog%rowtype;
  v_assignment public.character_spells%rowtype;
  v_summary jsonb:='[]'::jsonb;
  v_serialized jsonb:='[]'::jsonb;
  v_sheet jsonb:='{}'::jsonb;
  v_choices jsonb:='{}'::jsonb;
  v_existing_summary jsonb:='[]'::jsonb;
  v_choice_summary jsonb:='[]'::jsonb;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression has not been initialized.'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' then
    if jsonb_typeof(v_selected)='array' and jsonb_array_length(v_selected)>0 then raise exception 'Signature Spells are only valid for an XPHB Wizard.'; end if;
    return '[]'::jsonb;
  end if;
  if v_progression.class_level<>20 then
    if jsonb_typeof(v_selected)='array' and jsonb_array_length(v_selected)>0 then raise exception 'Signature Spells require Wizard level 20.'; end if;
    return '[]'::jsonb;
  end if;
  if jsonb_typeof(v_selected)<>'array' or jsonb_array_length(v_selected)<>2 then
    raise exception 'Signature Spells require exactly two level-3 spells from this Wizard''s spellbook.';
  end if;
  if (select count(distinct value) from jsonb_array_elements_text(v_selected))<>2 then
    raise exception 'Signature Spell selections must be distinct.';
  end if;

  for v_key in select value from jsonb_array_elements_text(v_selected) loop
    begin
      v_spell_id:=v_key::uuid;
    exception when others then
      raise exception 'Signature Spells require canonical spell ids.';
    end;
    select * into v_spell from public.spells_catalog_preferred where id=v_spell_id;
    if not found
       or v_spell.level<>3
       or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)='wizard') then
      raise exception '% is not a level-3 Wizard spell eligible for Signature Spells.',coalesce(v_spell.name,'The selected spell');
    end if;
    if not private.wizard_spellbook_has_spell_v1(p_character_id,v_spell.id) then
      raise exception '% is not in this Wizard''s spellbook and cannot be a Signature Spell.',v_spell.name;
    end if;

    select cs.* into v_assignment
    from public.character_spells cs
    where cs.character_id=p_character_id
      and cs.spell_id=v_spell.id
      and (
        cs.source_type='class'
        or (cs.source_type='class-feature' and coalesce((cs.raw_payload->>'wizardSpellbook')::boolean,false))
      )
    order by cs.created_at,cs.id
    limit 1
    for update of cs;
    if not found then raise exception '% could not be resolved to one authoritative Wizard spellbook assignment.',v_spell.name; end if;

    update public.character_spells cs
    set prepared=true,
        always_available=true,
        uses_max=1,
        uses_remaining=1,
        recharge='short_rest',
        raw_payload=coalesce(cs.raw_payload,'{}'::jsonb)||jsonb_build_object(
          'signatureSpell',true,
          'signatureSpellFeature','Signature Spells',
          'signatureSpellLevel',3,
          'signatureSpellGrantedAtLevel',20,
          'signatureSpellCreator',coalesce(nullif(btrim(p_creator),''),'character_progression_v5')
        ),
        updated_at=now()
    where cs.id=v_assignment.id;

    v_summary:=v_summary||jsonb_build_array(jsonb_build_object(
      'family','wizard-signature-spells',
      'type','signature-spell',
      'groupId','wizard-signature-spells',
      'feature','Signature Spells',
      'assignmentId',v_assignment.id,
      'spellId',v_spell.id,
      'spellKey',v_spell.spell_key,
      'name',v_spell.name,
      'source',v_spell.source,
      'school',v_spell.school,
      'level',20,
      'spellLevel',3,
      'membershipSourceType',v_assignment.source_type,
      'membershipSourceKey',v_assignment.source_key,
      'usesMax',1,
      'usesRemaining',1,
      'recharge','short_rest_or_long_rest'
    ));
    v_serialized:=v_serialized||jsonb_build_array(jsonb_build_object(
      'key',v_spell.id::text,
      'name',v_spell.name,
      'source',v_spell.source,
      'kind','spell',
      'spell',jsonb_build_object('id',v_spell.id,'spellKey',v_spell.spell_key,'level',3,'school',v_spell.school)
    ));
  end loop;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_sheet:=jsonb_set(v_sheet,'{meta}',case when jsonb_typeof(v_sheet->'meta')='object' then v_sheet->'meta' else '{}'::jsonb end,true);
  v_choices:=case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end;
  v_choices:=jsonb_set(v_choices,array['wizard-signature-spells'],jsonb_build_object(
    'label','Signature Spells',
    'kind','spell',
    'sourceFeature','Signature Spells',
    'source','XPHB',
    'level',20,
    'count',2,
    'placement','spells',
    'allowRepeatAcrossGroups',true,
    'cadence',coalesce(nullif(btrim(p_cadence),''),'level-up'),
    'replacementCadence',null,
    'constraints',jsonb_build_object('spellLevel',3,'spellClasses',jsonb_build_array('Wizard'),'wizardSpellbookRequired',true,'freeCastUses',1,'recharge','short_rest'),
    'selections',v_serialized
  ),true);

  v_existing_summary:=case when jsonb_typeof(v_sheet->'classFeatureChoiceSummary')='array' then v_sheet->'classFeatureChoiceSummary' else '[]'::jsonb end;
  select coalesce(jsonb_agg(e.item),'[]'::jsonb) into v_choice_summary
  from jsonb_array_elements(v_existing_summary) as e(item)
  where coalesce(e.item->>'groupId','')<>'wizard-signature-spells';
  v_choice_summary:=v_choice_summary||(
    select coalesce(jsonb_agg(jsonb_build_object(
      'groupId','wizard-signature-spells',
      'groupLabel','Signature Spells',
      'groupKind','spell',
      'level',20,
      'placement','spells',
      'cadence',coalesce(nullif(btrim(p_cadence),''),'level-up'),
      'key',e.entry->>'key',
      'name',e.entry->>'name',
      'source',e.entry->>'source',
      'kind','spell'
    )),'[]'::jsonb)
    from jsonb_array_elements(v_serialized) as e(entry)
  );

  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoiceSummary}',v_choice_summary,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoiceSummary}',v_choice_summary,true);
  v_sheet:=jsonb_set(v_sheet,'{signatureSpells}',v_serialized,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,signatureSpells}',v_serialized,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);

  return v_summary;
end;
$function$;

CREATE OR REPLACE FUNCTION private.materialize_player_forge_wizard_savant_for_character_v1(p_character_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_level public.class_level_progression%rowtype;
  v_sheet jsonb:='{}'::jsonb;
  v_choices jsonb:='{}'::jsonb;
  v_school text;
  v_feature text;
  v_max integer:=0;
  v_expected_levels integer[]:='{}'::integer[];
  v_level_gate integer;
  v_group_key text;
  v_group jsonb;
  v_selected jsonb;
  v_expected integer;
  v_selection jsonb;
  v_spell public.spells_catalog%rowtype;
  v_spell_id uuid;
  v_seen uuid[]:='{}'::uuid[];
  v_summary jsonb:='[]'::jsonb;
  v_group_count integer:=0;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found then return '[]'::jsonb; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' then return '[]'::jsonb; end if;
  if v_progression.class_level<3 then return '[]'::jsonb; end if;

  v_school:=private.wizard_savant_school_v1(v_progression.subclass_name);
  if v_school is null then return '[]'::jsonb; end if;
  v_feature:=v_school||' Savant';

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  if coalesce(v_sheet#>>'{meta,creator}','')<>'shared_character_forge_player_v2' then return '[]'::jsonb; end if;
  v_choices:=case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end;

  select * into v_level from public.class_level_progression where class_id=v_progression.class_id and class_level=v_progression.class_level;
  if not found then raise exception 'Wizard progression metadata is unavailable for Forge Savant materialization.'; end if;
  v_max:=private.highest_spell_level_from_slots_v1(coalesce(v_level.spell_slots,'[]'::jsonb));
  if v_max<2 then raise exception 'Savant cannot be materialized before Wizard level 3.'; end if;

  v_expected_levels:=array[3];
  for v_level_gate in 5..least(17,v_progression.class_level) by 2 loop
    v_expected_levels:=array_append(v_expected_levels,v_level_gate);
  end loop;

  foreach v_level_gate in array v_expected_levels loop
    select entry.key,entry.value into v_group_key,v_group
    from jsonb_each(v_choices) entry
    where private.normalize_player_choice_name_v1(coalesce(entry.value->>'sourceFeature',''))=private.normalize_player_choice_name_v1(v_feature)
      and coalesce((entry.value->>'level')::integer,0)=v_level_gate
      and private.normalize_player_choice_name_v1(coalesce(entry.value->>'subclassName',v_progression.subclass_name))=private.normalize_player_choice_name_v1(v_progression.subclass_name)
    order by entry.key
    limit 1;
    if v_group_key is null then raise exception '% requires a Forge choice group for Wizard level %.',v_feature,v_level_gate; end if;

    v_expected:=case when v_level_gate=3 then 2 else 1 end;
    v_selected:=case when jsonb_typeof(v_group->'selections')='array' then v_group->'selections' else '[]'::jsonb end;
    if coalesce((v_group->>'count')::integer,0)<>v_expected or jsonb_array_length(v_selected)<>v_expected then
      raise exception '% at Wizard level % requires exactly % spellbook selection(s).',v_feature,v_level_gate,v_expected;
    end if;

    for v_selection in select value from jsonb_array_elements(v_selected) loop
      begin
        v_spell_id:=coalesce(nullif(v_selection#>>'{spell,id}',''),nullif(v_selection->>'key',''))::uuid;
      exception when others then
        v_spell_id:=null;
      end;
      if v_spell_id is null then
        select s.id into v_spell_id
        from public.spells_catalog s
        where private.normalize_player_choice_name_v1(s.name)=private.normalize_player_choice_name_v1(v_selection->>'name')
          and (coalesce(v_selection->>'source','')='' or s.source=v_selection->>'source')
        order by case when s.source='XPHB' then 0 when s.source='PHB' then 1 else 2 end,s.name
        limit 1;
      end if;
      select * into v_spell from public.spells_catalog where id=v_spell_id;
      if not found then raise exception '% contains an unavailable spellbook selection.',v_feature; end if;
      if v_spell.level<1
         or v_spell.level>(case when v_level_gate=3 then 2 else least(9,ceil(v_level_gate/2.0)::integer) end)
         or v_spell.school<>v_school
         or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)='wizard') then
        raise exception '% is not a legal % selection for the Wizard level % Savant acquisition.',v_spell.name,v_feature,v_level_gate;
      end if;
      if v_spell.id=any(v_seen) then raise exception 'Savant spellbook selections must be distinct across every acquisition level.'; end if;
      if private.wizard_spellbook_has_spell_v1(p_character_id,v_spell.id) then raise exception '% is already in this Wizard spellbook.',v_spell.name; end if;
      v_seen:=array_append(v_seen,v_spell.id);

      insert into public.character_spells(
        character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,raw_payload
      ) values(
        p_character_id,v_spell.id,'class-feature',v_group_key,v_feature,true,false,false,'int',
        jsonb_build_object('creator','shared_character_forge_player_v3','wizardSpellbook',true,'forgeSavant',true,'feature',v_feature,'school',v_school,'grantedAtLevel',v_level_gate,'subclass',v_progression.subclass_name)
      );
      v_summary:=v_summary||jsonb_build_array(jsonb_build_object('groupId',v_group_key,'feature',v_feature,'school',v_school,'spellId',v_spell.id,'name',v_spell.name,'grantedAtLevel',v_level_gate));
    end loop;
  end loop;

  select count(*) into v_group_count
  from jsonb_each(v_choices) entry
  where private.normalize_player_choice_name_v1(coalesce(entry.value->>'sourceFeature',''))=private.normalize_player_choice_name_v1(v_feature);
  if v_group_count<>cardinality(v_expected_levels) then
    raise exception '% Forge chronology contains % acquisition group(s), but Wizard level % requires %.',v_feature,v_group_count,v_progression.class_level,cardinality(v_expected_levels);
  end if;

  return v_summary;
end;
$function$;

CREATE OR REPLACE FUNCTION private.materialize_player_forge_wizard_signature_for_character_v1(p_character_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_sheet jsonb:='{}'::jsonb;
  v_choices jsonb:='{}'::jsonb;
  v_group jsonb;
  v_selected jsonb:='[]'::jsonb;
  v_selection jsonb;
  v_spell_id uuid;
  v_spell public.spells_catalog%rowtype;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or v_progression.class_level<>20 then return '[]'::jsonb; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' then return '[]'::jsonb; end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  if coalesce(v_sheet#>>'{meta,creator}','')<>'shared_character_forge_player_v2' then return '[]'::jsonb; end if;
  v_choices:=case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end;
  v_group:=v_choices->'wizard-signature-spells';
  if v_group is null then
    select entry.value into v_group
    from jsonb_each(v_choices) as entry
    where private.normalize_player_choice_name_v1(coalesce(entry.value->>'sourceFeature',''))='signaturespells'
    order by entry.key
    limit 1;
  end if;
  if v_group is null then raise exception 'A level-20 Wizard created in Player Forge requires a Signature Spells choice group.'; end if;
  if coalesce((v_group->>'level')::integer,0)<>20 or coalesce((v_group->>'count')::integer,0)<>2 or coalesce(v_group->>'placement','')<>'spells' then
    raise exception 'The Player Forge Signature Spells choice group has an invalid level, count, or placement.';
  end if;
  if coalesce(jsonb_typeof(v_group->'selections'),'')<>'array' or jsonb_array_length(v_group->'selections')<>2 then
    raise exception 'A level-20 Wizard created in Player Forge must choose exactly two Signature Spells.';
  end if;

  for v_selection in select value from jsonb_array_elements(v_group->'selections') loop
    begin
      v_spell_id:=nullif(v_selection#>>'{spell,id}','')::uuid;
    exception when others then
      v_spell_id:=null;
    end;
    if v_spell_id is null then
      select s.id into v_spell_id
      from public.spells_catalog_preferred s
      where private.normalize_player_choice_name_v1(s.name)=private.normalize_player_choice_name_v1(v_selection->>'name')
        and (coalesce(v_selection->>'source','')='' or s.source=v_selection->>'source')
      order by case when s.source='XPHB' then 0 when s.source='PHB' then 1 else 2 end,s.name
      limit 1;
    end if;
    select * into v_spell from public.spells_catalog_preferred where id=v_spell_id;
    if not found then raise exception 'Player Forge Signature Spells contain an unavailable spell selection.'; end if;
    v_selected:=v_selected||jsonb_build_array(v_spell.id::text);
  end loop;

  return private.apply_wizard_signature_spell_ids_v1(p_character_id,v_selected,'creation','shared_character_forge_player_v2');
end;
$function$;

CREATE OR REPLACE FUNCTION private.materialize_player_forge_wizard_final_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
begin
  perform private.materialize_player_forge_wizard_savant_for_character_v1(new.character_id);
  perform private.materialize_player_forge_wizard_signature_for_character_v1(new.character_id);
  return new;
end;
$function$;
-- CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_wizard_final_v1
-- AFTER INSERT ON character_progression DEFERRABLE INITIALLY DEFERRED
-- FOR EACH ROW EXECUTE FUNCTION private.materialize_player_forge_wizard_final_v1()
CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_wizard_final_v1
 AFTER INSERT ON public.character_progression DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION private.materialize_player_forge_wizard_final_v1();


-- All original source fingerprints retained; T5 normalizer sourced already.
DO $t16_original_verified$
DECLARE n integer;
BEGIN
 IF md5(pg_get_functiondef('private.wizard_savant_school_v1(text)'::regprocedure))<>'39cb0f3c7041e7d5f63538f03c6abb7f'
 OR md5(pg_get_functiondef('private.highest_spell_level_from_slots_v1(jsonb)'::regprocedure))<>'84ff66ed7dcdeccc6593c05a6d24c4cb'
 OR md5(pg_get_functiondef('private.wizard_spellbook_has_spell_v1(uuid,uuid)'::regprocedure))<>'f902c2d45de3ae7b9c63132117fc99e0'
 OR md5(pg_get_functiondef('private.apply_wizard_signature_spell_ids_v1(uuid,jsonb,text,text)'::regprocedure))<>'c6d23dc8eccb824e9199ca027139a7da'
 OR md5(pg_get_functiondef('private.materialize_player_forge_wizard_savant_for_character_v1(uuid)'::regprocedure))<>'49594930f540d308b43ce00461462829'
 OR md5(pg_get_functiondef('private.materialize_player_forge_wizard_signature_for_character_v1(uuid)'::regprocedure))<>'02395e9d544ef6d5d1e6e5436d080294'
 OR md5(pg_get_functiondef('private.materialize_player_forge_wizard_final_v1()'::regprocedure))<>'3c71ad65cde45d74bef4ea63f25847ac'
 THEN RAISE EXCEPTION 'T16 original Wizard source executable MD5 diverged from hosted I1E source'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O' AND c.relname IN
 ('character_progression','character_sheets','characters','inventory_items');
 IF n<>28 THEN RAISE EXCEPTION 'T16 expects 25 original +3 held, got %',n; END IF;
END $t16_original_verified$;
REVOKE ALL ON FUNCTION
 private.apply_wizard_signature_spell_ids_v1(uuid,jsonb,text,text),
 private.materialize_player_forge_wizard_savant_for_character_v1(uuid),
 private.materialize_player_forge_wizard_signature_for_character_v1(uuid),
 private.materialize_player_forge_wizard_final_v1()
FROM PUBLIC,anon,authenticated;
\echo 'PASS C34-T16 original Wizard finalizer functions+trigger incl. UNCHANGED unsafe account writer (RED only), 25/31'

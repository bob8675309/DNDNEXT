-- I2-G source-exact ORIGINAL v1 legacy level-up writer, obtained via SELECT-only
-- pg_get_functiondef from DnDWeb PostgreSQL 17.4 on 2026-11-12.
-- For isolated signed local PG17+GoTrue CI ONLY. Not a production migration.
-- Do NOT use this for any hosted database. Historical RED first; candidate later.
\set ON_ERROR_STOP on
DO $i2g_guard$
BEGIN
 IF current_database()<>'postgres'
    OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
    OR to_regclass('private.p13_levelup_case_guard') IS NULL
    OR to_regclass('auth.users') IS NULL
    OR to_regprocedure('public.complete_character_level_up_v1(uuid,jsonb)') IS NOT NULL
    OR md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))<>'02d74b973a763c53c595be20e35e512f'
 THEN RAISE EXCEPTION 'I2G source-original level-up v1 install requires source-original P1.3 Fighter-only signed PG17 fixture';
 END IF;
END $i2g_guard$;

-- Deliberately REDUCED support for featureless XPHB Fighter level 1->2 ONLY.
-- Original level-up writer below is unchanged. This helper is not production
-- source and refuses unsupported/feature-bearing levels and classes.
CREATE OR REPLACE FUNCTION private.unsupported_level_choice_features_v1(p_features jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $i2g_fighter_only$
BEGIN
 IF coalesce(p_features,'[]'::jsonb)<>'[]'::jsonb
 THEN RAISE EXCEPTION 'I2G reduced Fighter-only fixture rejects nonempty features'; END IF;
 RETURN '[]'::jsonb;
END $i2g_fighter_only$;

-- SOURCE-ORIGINAL pg_get_functiondef, no modifications:
-- MD5 1500703592c3cb8e1738126eac508e6a
CREATE OR REPLACE FUNCTION public.complete_character_level_up_v1(p_character_id uuid, p_selections jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_selections jsonb := coalesce(p_selections,'{}'::jsonb);
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_current public.class_level_progression%rowtype;
  v_next public.class_level_progression%rowtype;
  v_session public.character_level_up_sessions%rowtype;
  v_sheet jsonb;
  v_hp_method text;
  v_hit_roll integer;
  v_hp_gain integer;
  v_con_score integer := 10;
  v_con_mod integer := 0;
  v_current_hp integer := 0;
  v_current_max_hp integer := 0;
  v_subclass text;
  v_requires_subclass boolean;
  v_requires_advancement boolean;
  v_advancement_type text;
  v_ability_increases jsonb;
  v_ability_key text;
  v_increment_json jsonb;
  v_increment integer;
  v_total_increase integer := 0;
  v_score integer;
  v_feat_name text;
  v_feats jsonb;
  v_new_cantrips integer := 0;
  v_new_leveled integer := 0;
  v_highest_spell_level integer := 0;
  v_spell_choices jsonb;
  v_choice jsonb;
  v_spell_id uuid;
  v_spell public.spells_catalog%rowtype;
  v_seen uuid[] := '{}'::uuid[];
  v_selected_cantrips integer := 0;
  v_selected_leveled integer := 0;
  v_prepared boolean;
  v_pending_next boolean;
  v_unsupported jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to level this character.' using errcode='42501';
  end if;
  if jsonb_typeof(v_selections) <> 'object' then
    raise exception 'Level-up selections must be a JSON object.';
  end if;

  select * into v_progression
  from public.character_progression
  where character_id=p_character_id
  for update;
  if v_progression.character_id is null then
    raise exception 'Character progression has not been initialized.' using errcode='P0002';
  end if;

  select * into v_session
  from public.character_level_up_sessions
  where character_id=p_character_id and status='open'
  for update;
  if v_session.id is null then raise exception 'Open a level-up review first.' using errcode='P0002'; end if;
  if v_session.from_level <> v_progression.class_level or v_session.to_level <> v_progression.class_level+1 then
    raise exception 'This level-up review is stale. Refresh it before applying.';
  end if;
  if not v_session.metadata_ready then
    raise exception '%',coalesce(v_session.preview->>'blockedReason','This level cannot be applied yet.');
  end if;

  select * into v_class from public.class_catalog where id=v_progression.class_id;
  select * into v_current from public.class_level_progression where class_id=v_progression.class_id and class_level=v_progression.class_level;
  select * into v_next from public.class_level_progression where class_id=v_progression.class_id and class_level=v_progression.class_level+1;
  if not public.is_preferred_class_version_v1(v_class.id) then raise exception 'Only the preferred class version can be applied.'; end if;
  if v_progression.experience_points < v_next.xp_threshold then raise exception 'The required XP threshold has not been reached.'; end if;

  v_unsupported := private.unsupported_level_choice_features_v1(v_next.features);
  if jsonb_array_length(v_unsupported) > 0 then
    raise exception 'This level still has unsupported class-specific choices.';
  end if;

  select sheet into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_sheet := coalesce(v_sheet,'{}'::jsonb);

  v_hp_method := lower(btrim(coalesce(v_selections->>'hp_method','')));
  if v_hp_method not in ('fixed','roll') then raise exception 'Choose fixed or roll for the hit point increase.'; end if;
  begin
    v_con_score := coalesce(nullif(v_sheet->'abilities'->'con'->>'score','')::integer,nullif(v_sheet->'abilities'->>'con','')::integer,10);
  exception when others then
    v_con_score := 10;
  end;
  v_con_mod := floor((v_con_score-10)/2.0)::integer;
  if v_hp_method='roll' then
    v_hit_roll := 1+floor(random()*greatest(1,coalesce(v_class.hit_die,8)))::integer;
  else
    v_hit_roll := floor(coalesce(v_class.hit_die,8)/2.0)::integer+1;
  end if;
  v_hp_gain := greatest(1,v_hit_roll+v_con_mod);
  begin
    v_current_max_hp := coalesce(nullif(v_sheet->>'maxHp','')::integer,nullif(v_sheet->>'hp','')::integer,0);
    v_current_hp := coalesce(nullif(v_sheet->>'hp','')::integer,v_current_max_hp,0);
  exception when others then
    v_current_max_hp := 0;
    v_current_hp := 0;
  end;

  v_requires_subclass := v_next.class_level=3 and nullif(btrim(coalesce(v_progression.subclass_name,'')),'') is null;
  v_subclass := nullif(btrim(coalesce(v_selections->>'subclass_name',v_progression.subclass_name,'')),'');
  if v_requires_subclass and v_subclass is null then raise exception 'Choose a subclass.'; end if;
  if v_subclass is not null and char_length(v_subclass)>100 then raise exception 'Subclass names must be 100 characters or fewer.'; end if;

  v_requires_advancement := private.level_has_feature_v1(v_next.features,'Ability Score Improvement');
  if v_requires_advancement then
    v_advancement_type := lower(btrim(coalesce(v_selections->>'advancement_type','')));
    if v_advancement_type='asi' then
      v_ability_increases := coalesce(v_selections->'ability_increases','{}'::jsonb);
      if jsonb_typeof(v_ability_increases)<>'object' then raise exception 'Ability increases must be an object.'; end if;
      for v_ability_key,v_increment_json in select key,value from jsonb_each(v_ability_increases) loop
        if v_ability_key not in ('str','dex','con','int','wis','cha') then raise exception 'Invalid ability increase: %',v_ability_key; end if;
        begin v_increment := (v_increment_json #>> '{}')::integer; exception when others then raise exception 'Ability increases must be whole numbers.'; end;
        if v_increment not in (1,2) then raise exception 'Each ability increase must be 1 or 2.'; end if;
        v_total_increase := v_total_increase+v_increment;
        begin
          v_score := coalesce(nullif(v_sheet->'abilities'->v_ability_key->>'score','')::integer,nullif(v_sheet->'abilities'->>v_ability_key,'')::integer,10);
        exception when others then
          v_score := 10;
        end;
        if v_score+v_increment>20 then raise exception '% cannot be increased above 20.',upper(v_ability_key); end if;
        if jsonb_typeof(v_sheet->'abilities')<>'object' then v_sheet:=jsonb_set(v_sheet,'{abilities}','{}'::jsonb,true); end if;
        if jsonb_typeof(v_sheet->'abilities'->v_ability_key)<>'object' then
          v_sheet:=jsonb_set(v_sheet,array['abilities',v_ability_key],jsonb_build_object('score',v_score),true);
        end if;
        v_sheet:=jsonb_set(v_sheet,array['abilities',v_ability_key,'score'],to_jsonb(v_score+v_increment),true);
      end loop;
      if v_total_increase<>2 then raise exception 'Ability Score Improvement must grant exactly two total points.'; end if;
    elsif v_advancement_type='feat' then
      v_feat_name := nullif(btrim(v_selections->>'feat_name'),'');
      if v_feat_name is null then raise exception 'Choose a feat.'; end if;
      if not exists (
        select 1 from unnest(array[
          'Ability Score Improvement','Actor','Athlete','Charger','Chef','Crossbow Expert','Crusher',
          'Defensive Duelist','Dual Wielder','Durable','Elemental Adept','Fey-Touched','Grappler',
          'Great Weapon Master','Heavily Armored','Heavy Armor Master','Inspiring Leader','Keen Mind',
          'Lightly Armored','Mage Slayer','Martial Weapon Training','Medium Armor Master','Moderately Armored',
          'Mounted Combatant','Observant','Piercer','Poisoner','Polearm Master','Resilient','Ritual Caster',
          'Sentinel','Shadow-Touched','Sharpshooter','Shield Master','Skill Expert','Skulker','Slasher',
          'Speedy','Spell Sniper','Telekinetic','Telepathic','War Caster','Weapon Master'
        ]::text[]) allowed(name)
        where lower(allowed.name)=lower(v_feat_name)
      ) then raise exception 'That feat is not in the current 2024 general-feat list.'; end if;
      v_feats := coalesce(v_sheet->'feats','[]'::jsonb);
      if jsonb_typeof(v_feats)<>'array' then v_feats:='[]'::jsonb; end if;
      if not exists(select 1 from jsonb_array_elements_text(v_feats) f where lower(f)=lower(v_feat_name)) then
        v_feats:=v_feats||to_jsonb(v_feat_name);
      end if;
      v_sheet:=jsonb_set(v_sheet,'{feats}',v_feats,true);
    else
      raise exception 'Choose Ability Score Improvement or a feat.';
    end if;
  end if;

  v_new_cantrips := greatest(0,coalesce(v_next.cantrips_known,0)-coalesce(v_current.cantrips_known,0));
  if v_class.class_key='wizard' then
    v_new_leveled:=2;
  elsif v_class.spellcasting_ability is not null then
    if v_current.spells_known is null or v_next.spells_known is null then
      raise exception 'Prepared/known spell progression metadata is unavailable.';
    end if;
    v_new_leveled:=greatest(0,v_next.spells_known-v_current.spells_known);
  end if;
  v_highest_spell_level:=private.highest_spell_level_from_slots_v1(v_next.spell_slots);
  v_spell_choices:=coalesce(v_selections->'spell_choices','[]'::jsonb);
  if jsonb_typeof(v_spell_choices)<>'array' then raise exception 'Spell choices must be an array.'; end if;

  for v_choice in select value from jsonb_array_elements(v_spell_choices) loop
    begin v_spell_id:=(v_choice->>'spell_id')::uuid; exception when others then raise exception 'Every spell choice needs a valid spell_id.'; end;
    if v_spell_id=any(v_seen) then raise exception 'Duplicate spell choices are not allowed.'; end if;
    v_seen:=array_append(v_seen,v_spell_id);
    select * into v_spell from public.spells_catalog where id=v_spell_id;
    if v_spell.id is null then raise exception 'A selected spell was not found.'; end if;
    if not public.is_preferred_spell_version_v1(v_spell.id) then raise exception '% must use the preferred catalog version.',v_spell.name; end if;
    if not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)=lower(v_class.class_name)) then
      raise exception '% is not on the % spell list.',v_spell.name,v_class.class_name;
    end if;
    if exists(select 1 from public.character_spells where character_id=p_character_id and spell_id=v_spell_id) then
      raise exception '% is already in this character spellbook.',v_spell.name;
    end if;
    if v_spell.level=0 then
      v_selected_cantrips:=v_selected_cantrips+1;
    elsif v_spell.level between 1 and v_highest_spell_level then
      v_selected_leveled:=v_selected_leveled+1;
    else
      raise exception '% is not unlocked at level %.',v_spell.name,v_next.class_level;
    end if;
    begin v_prepared:=coalesce((v_choice->>'prepared')::boolean,true); exception when others then v_prepared:=true; end;
    insert into public.character_spells(
      character_id,spell_id,source_type,source_label,prepared,always_available,casting_stat,raw_payload
    ) values(
      p_character_id,v_spell_id,'class',v_class.class_name,
      case when v_spell.level=0 then true else v_prepared end,
      v_spell.level=0,
      v_class.spellcasting_ability,
      jsonb_build_object('grantedAtLevel',v_next.class_level,'rulesetSource',v_class.source,'creator','level_up_v1')
    );
  end loop;
  if v_selected_cantrips<>v_new_cantrips then raise exception 'Choose exactly % new cantrip(s).',v_new_cantrips; end if;
  if v_selected_leveled<>v_new_leveled then raise exception 'Choose exactly % new leveled spell(s).',v_new_leveled; end if;

  v_sheet:=v_sheet||jsonb_build_object(
    'level',v_next.class_level,
    'proficiencyBonus',v_next.proficiency_bonus,
    'hitDice',v_next.class_level::text||'d'||coalesce(v_class.hit_die,8)::text,
    'hp',v_current_hp+v_hp_gain,
    'maxHp',v_current_max_hp+v_hp_gain,
    'rulesetSource',v_class.source,
    'ruleset',v_class.ruleset
  );
  if v_subclass is not null then v_sheet:=v_sheet||jsonb_build_object('subclass',v_subclass); end if;
  v_sheet:=v_sheet||jsonb_build_object(
    'meta',coalesce(v_sheet->'meta','{}'::jsonb)||jsonb_strip_nulls(jsonb_build_object(
      'classKey',v_class.class_key,'className',v_class.class_name,'level',v_next.class_level,
      'subclass',v_subclass,'rulesetSource',v_class.source,'ruleset',v_class.ruleset
    ))
  );

  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in (select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);

  v_pending_next:=v_next.class_level<20 and v_progression.experience_points>=public.xp_threshold_for_level_v1(v_next.class_level+1);
  update public.character_progression
  set class_level=v_next.class_level,
      subclass_name=coalesce(v_subclass,subclass_name),
      subclass_source=case when v_subclass is not null then 'XPHB' else subclass_source end,
      pending_level_up=v_pending_next,
      level_choices=coalesce(level_choices,'{}'::jsonb)||jsonb_build_object(v_next.class_level::text,v_selections),
      updated_at=now()
  where character_id=p_character_id;

  update public.character_level_up_sessions
  set status='completed',selections=v_selections,completed_at=now(),updated_at=now()
  where id=v_session.id;

  insert into public.character_level_events(
    character_id,event_type,from_level,to_level,xp_before,xp_after,details,created_by
  ) values(
    p_character_id,'level_up_completed',v_progression.class_level,v_next.class_level,
    v_progression.experience_points,v_progression.experience_points,
    jsonb_build_object(
      'sessionId',v_session.id,'hpMethod',v_hp_method,'hitDieResult',v_hit_roll,'hpGain',v_hp_gain,
      'subclass',v_subclass,'advancementType',v_advancement_type,
      'newCantrips',v_new_cantrips,'newLeveledSpells',v_new_leveled
    ),auth.uid()
  );

  return jsonb_build_object(
    'progression',public.get_character_progression_v1(p_character_id),
    'levelUp',jsonb_build_object(
      'fromLevel',v_progression.class_level,'toLevel',v_next.class_level,
      'hpMethod',v_hp_method,'hitDieResult',v_hit_roll,'hpGain',v_hp_gain
    )
  );
end;
$function$;

REVOKE ALL ON FUNCTION public.complete_character_level_up_v1(uuid,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_character_level_up_v1(uuid,jsonb)
  TO authenticated,service_role;
DO $i2g_hash$
BEGIN
 IF md5(pg_get_functiondef('public.complete_character_level_up_v1(uuid,jsonb)'::regprocedure))<>'1500703592c3cb8e1738126eac508e6a'
 OR NOT has_function_privilege('authenticated','public.complete_character_level_up_v1(uuid,jsonb)','EXECUTE')
 OR has_function_privilege('anon','public.complete_character_level_up_v1(uuid,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'I2G original v1 source fingerprint or role ACL drift'; END IF;
END $i2g_hash$;
NOTIFY pgrst,'reload schema';

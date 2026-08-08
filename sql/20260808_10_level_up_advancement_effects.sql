-- Materialize a source-validated General feat / Epic Boon acquired through a
-- level-up.  Canonical catalogue metadata, not client-supplied effect payloads,
-- controls abilities and permanent proficiencies.  Spell-granting General feats
-- receive dedicated exact validators below.

create or replace function private.materialize_level_up_advancement_spells_v1(
  p_character_id uuid,
  p_to_level integer,
  p_option_id uuid,
  p_instance jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $function$
declare
  v_option public.character_option_catalog%rowtype;
  v_progression public.character_progression%rowtype;
  v_level public.class_level_progression%rowtype;
  v_selected jsonb := '[]'::jsonb;
  v_choice jsonb;
  v_spell public.spells_catalog%rowtype;
  v_spell_id uuid;
  v_selected_count integer := 0;
  v_required_count integer := 0;
  v_fixed_names text[] := '{}'::text[];
  v_fixed_name text;
  v_source_key text := 'level-'||p_to_level::text||'-advancement';
  v_casting_stat text;
  v_school text;
  v_free_cast boolean := false;
  v_output jsonb := '[]'::jsonb;
begin
  select * into v_option from public.character_option_catalog where id=p_option_id and option_type in ('feat','boon');
  if not found then raise exception 'Advancement option was not found.'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id;
  select * into v_level from public.class_level_progression where class_id=v_progression.class_id and class_level=p_to_level;

  select coalesce(jsonb_agg(choice),'[]'::jsonb),count(*) into v_selected,v_selected_count
  from jsonb_each(coalesce(p_instance->'choices','{}'::jsonb)) field
  cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
  where choice->>'kind'='spell';
  select coalesce(choice->>'value','') into v_casting_stat
  from jsonb_each(coalesce(p_instance->'choices','{}'::jsonb)) field
  cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
  where choice->>'kind'='ability'
  limit 1;
  if v_casting_stat not in ('str','dex','con','int','wis','cha') then v_casting_stat:=null; end if;

  if jsonb_array_length(coalesce(v_option.metadata->'additionalSpells','[]'::jsonb))=0 then
    if v_selected_count<>0 then raise exception '% does not grant selected spells.',v_option.name; end if;
    return '[]'::jsonb;
  end if;

  case lower(v_option.name)
    when 'fey-touched' then v_required_count:=1; v_fixed_names:=array['Misty Step']; v_free_cast:=true;
    when 'shadow-touched' then v_required_count:=1; v_fixed_names:=array['Invisibility']; v_free_cast:=true;
    when 'ritual caster' then v_required_count:=greatest(2,coalesce(v_level.proficiency_bonus,2));
    when 'telekinetic' then v_required_count:=0; v_fixed_names:=array['Mage Hand'];
    when 'telepathic' then v_required_count:=0; v_fixed_names:=array['Detect Thoughts']; v_free_cast:=true;
    else raise exception 'Spell grants for % are not yet supported by the level-up authority.',v_option.name;
  end case;
  if v_selected_count<>v_required_count then raise exception '% requires exactly % selected spell(s); received %.',v_option.name,v_required_count,v_selected_count; end if;

  for v_choice in select value from jsonb_array_elements(v_selected) loop
    begin v_spell_id:=coalesce(nullif(v_choice #>> '{metadata,spellId}',''),nullif(v_choice->>'value',''))::uuid; exception when others then raise exception '% contains an invalid selected spell.',v_option.name; end;
    select * into v_spell from public.spells_catalog where id=v_spell_id;
    if not found or not public.is_preferred_spell_version_v1(v_spell.id) then raise exception 'A selected feat spell is unavailable or not the preferred version.'; end if;
    if lower(v_option.name)='ritual caster' then
      if v_spell.level<>1 or not coalesce(v_spell.ritual,false) then raise exception 'Ritual Caster selections must be level-1 Ritual spells.'; end if;
    elsif lower(v_option.name)='fey-touched' then
      v_school:=upper(coalesce(v_spell.school_code,v_spell.school,''));
      if v_spell.level<>1 or v_school not in ('E','D','ENCHANTMENT','DIVINATION') then raise exception 'Fey-Touched requires a level-1 Divination or Enchantment spell.'; end if;
    elsif lower(v_option.name)='shadow-touched' then
      v_school:=upper(coalesce(v_spell.school_code,v_spell.school,''));
      if v_spell.level<>1 or v_school not in ('I','N','ILLUSION','NECROMANCY') then raise exception 'Shadow-Touched requires a level-1 Illusion or Necromancy spell.'; end if;
    end if;
    if exists(select 1 from jsonb_array_elements(v_output) existing where existing->>'spell_id'=v_spell.id::text) then raise exception 'Duplicate spell selections are not allowed.'; end if;
    insert into public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,raw_payload)
    values(p_character_id,v_spell.id,'feat',v_source_key,v_option.name,true,true,true,v_casting_stat,
      jsonb_strip_nulls(jsonb_build_object('creator','character_progression_v3','grantedAtLevel',p_to_level,'advancementOptionId',v_option.id,'freeCastUses',case when v_free_cast then 1 else null end,'freeCastRecharge',case when v_free_cast then 'long-rest' else null end)))
    on conflict(character_id,spell_id,source_type,source_key) do update set known=true,prepared=true,always_available=true,casting_stat=excluded.casting_stat,raw_payload=excluded.raw_payload,updated_at=now();
    v_output:=v_output||jsonb_build_array(jsonb_build_object('spell_id',v_spell.id,'name',v_spell.name,'source',v_spell.source,'level',v_spell.level,'fixed',false));
  end loop;

  foreach v_fixed_name in array v_fixed_names loop
    select * into v_spell from public.spells_catalog s
    where lower(s.name)=lower(v_fixed_name) and public.is_preferred_spell_version_v1(s.id)
    order by case when s.source='XPHB' then 0 when s.source='PHB' then 1 else 2 end limit 1;
    if not found then raise exception 'The fixed spell % for % is unavailable.',v_fixed_name,v_option.name; end if;
    insert into public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,raw_payload)
    values(p_character_id,v_spell.id,'feat',v_source_key,v_option.name,true,true,true,v_casting_stat,
      jsonb_strip_nulls(jsonb_build_object('creator','character_progression_v3','grantedAtLevel',p_to_level,'advancementOptionId',v_option.id,'freeCastUses',case when v_free_cast then 1 else null end,'freeCastRecharge',case when v_free_cast then 'long-rest' else null end,'fixedGrant',true)))
    on conflict(character_id,spell_id,source_type,source_key) do update set known=true,prepared=true,always_available=true,casting_stat=excluded.casting_stat,raw_payload=excluded.raw_payload,updated_at=now();
    v_output:=v_output||jsonb_build_array(jsonb_build_object('spell_id',v_spell.id,'name',v_spell.name,'source',v_spell.source,'level',v_spell.level,'fixed',true));
  end loop;
  return v_output;
end;
$function$;

create or replace function private.apply_character_level_advancement_v1(
  p_character_id uuid,
  p_to_level integer,
  p_option_id uuid,
  p_instance jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_option public.character_option_catalog%rowtype;
  v_sheet jsonb;
  v_increases jsonb;
  v_effects jsonb := '[]'::jsonb;
  v_ability text;
  v_increment_json jsonb;
  v_increment integer;
  v_score integer;
  v_cap integer;
  v_old_con integer := 10;
  v_new_con integer := 10;
  v_old_con_mod integer := 0;
  v_new_con_mod integer := 0;
  v_hp_delta integer := 0;
  v_hp integer := 0;
  v_max_hp integer := 0;
  v_skill_entry jsonb;
  v_skill_choice jsonb;
  v_skill_choices jsonb := '[]'::jsonb;
  v_selected_skill_count integer := 0;
  v_expected_skill_count integer := 0;
  v_skill_label text;
  v_skill_key text;
  v_allowed boolean;
  v_key text;
  v_value jsonb;
  v_count integer;
  v_tools jsonb;
  v_armor jsonb;
  v_weapons jsonb;
  v_saves jsonb;
  v_expertise jsonb;
  v_expertise_choice jsonb;
  v_damage_choices jsonb := '[]'::jsonb;
  v_damage_count integer := 0;
  v_damage text;
  v_spell_grants jsonb := '[]'::jsonb;
  v_instance_key text := 'level-'||p_to_level::text||'-advancement';
  v_instances jsonb;
  v_feats jsonb;
  v_sanitized jsonb;
  v_repeatable boolean;
  v_class_spells jsonb;
begin
  select * into v_option from public.character_option_catalog where id=p_option_id and option_type in ('feat','boon');
  if not found then raise exception 'Advancement option was not found.'; end if;
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_increases:=private.level_up_ability_increases_v1(p_option_id,p_instance);
  begin v_old_con:=coalesce(nullif(v_sheet #>> '{abilities,con,score}','')::integer,nullif(v_sheet #>> '{abilities,con}','')::integer,10); exception when others then v_old_con:=10; end;

  for v_ability,v_increment_json in select key,value from jsonb_each(v_increases) loop
    v_increment:=(v_increment_json #>> '{}')::integer;
    begin v_score:=coalesce(nullif(v_sheet->'abilities'->v_ability->>'score','')::integer,nullif(v_sheet->'abilities'->>v_ability,'')::integer,10); exception when others then v_score:=10; end;
    v_cap:=case when v_option.option_type='boon' or v_option.category='EB' then 30 else 20 end;
    if v_score+v_increment>v_cap then raise exception '% cannot be increased above % by %.',upper(v_ability),v_cap,v_option.name; end if;
    if jsonb_typeof(v_sheet->'abilities')<>'object' then v_sheet:=jsonb_set(v_sheet,'{abilities}','{}'::jsonb,true); end if;
    if jsonb_typeof(v_sheet->'abilities'->v_ability)<>'object' then v_sheet:=jsonb_set(v_sheet,array['abilities',v_ability],jsonb_build_object('score',v_score),true); end if;
    v_sheet:=jsonb_set(v_sheet,array['abilities',v_ability,'score'],to_jsonb(v_score+v_increment),true);
    v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','ability-increase','ability',v_ability,'amount',v_increment,'cap',v_cap));
  end loop;

  begin v_new_con:=coalesce(nullif(v_sheet #>> '{abilities,con,score}','')::integer,v_old_con); exception when others then v_new_con:=v_old_con; end;
  v_old_con_mod:=floor((v_old_con-10)/2.0)::integer; v_new_con_mod:=floor((v_new_con-10)/2.0)::integer;
  v_hp_delta:=(v_new_con_mod-v_old_con_mod)*p_to_level;
  if v_hp_delta<>0 then
    begin v_max_hp:=coalesce(nullif(v_sheet->>'maxHp','')::integer,nullif(v_sheet->>'hp','')::integer,0); v_hp:=coalesce(nullif(v_sheet->>'hp','')::integer,v_max_hp); exception when others then v_max_hp:=0; v_hp:=0; end;
    v_sheet:=v_sheet||jsonb_build_object('maxHp',greatest(1,v_max_hp+v_hp_delta),'hp',greatest(1,v_hp+v_hp_delta));
    v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','constitution-hit-points','amount',v_hp_delta,'levelCount',p_to_level));
  end if;

  select coalesce(jsonb_agg(choice),'[]'::jsonb),count(*) into v_skill_choices,v_selected_skill_count
  from jsonb_each(coalesce(p_instance->'choices','{}'::jsonb)) field
  cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
  where choice->>'kind'='skill';

  for v_skill_entry in select value from jsonb_array_elements(coalesce(v_option.metadata->'skillProficiencies','[]'::jsonb)) loop
    if jsonb_typeof(v_skill_entry)<>'object' then continue; end if;
    if v_skill_entry ? 'any' then v_expected_skill_count:=v_expected_skill_count+greatest(1,coalesce((v_skill_entry->>'any')::integer,1)); end if;
    if jsonb_typeof(v_skill_entry->'choose')='object' then v_expected_skill_count:=v_expected_skill_count+greatest(1,coalesce((v_skill_entry #>> '{choose,count}')::integer,1)); end if;
    for v_key,v_value in select key,value from jsonb_each(v_skill_entry) loop
      if v_key in ('any','choose') then continue; end if;
      if coalesce((v_value #>> '{}')::boolean,false) then
        v_skill_key:=private.player_sheet_skill_key_v1(v_key);
        if v_skill_key is not null then
          if jsonb_typeof(v_sheet #> '{proficiencies,skills}')<>'object' then v_sheet:=jsonb_set(v_sheet,'{proficiencies,skills}','{}'::jsonb,true); end if;
          v_sheet:=jsonb_set(v_sheet,array['proficiencies','skills',v_skill_key],coalesce(v_sheet #> array['proficiencies','skills',v_skill_key],'{}'::jsonb)||jsonb_build_object('proficient',true),true);
          v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','skill-proficiency','skill',v_skill_key));
        end if;
      end if;
    end loop;
  end loop;
  if v_selected_skill_count<>v_expected_skill_count then raise exception '% requires exactly % selected skill proficiency choice(s); received %.',v_option.name,v_expected_skill_count,v_selected_skill_count; end if;
  for v_skill_choice in select value from jsonb_array_elements(v_skill_choices) loop
    v_skill_label:=coalesce(nullif(v_skill_choice->>'label',''),v_skill_choice->>'value','');
    v_skill_key:=private.player_sheet_skill_key_v1(v_skill_label);
    if v_skill_key is null then raise exception '% contains an invalid skill choice.',v_option.name; end if;
    v_allowed:=exists(select 1 from jsonb_array_elements(coalesce(v_option.metadata->'skillProficiencies','[]'::jsonb)) entry where entry ? 'any' or exists(select 1 from jsonb_array_elements_text(coalesce(entry #> '{choose,from}','[]'::jsonb)) allowed where private.normalize_player_choice_name_v1(allowed)=private.normalize_player_choice_name_v1(v_skill_label)));
    if not v_allowed then raise exception '% does not allow % as a skill proficiency.',v_option.name,v_skill_label; end if;
    if jsonb_typeof(v_sheet #> '{proficiencies,skills}')<>'object' then v_sheet:=jsonb_set(v_sheet,'{proficiencies,skills}','{}'::jsonb,true); end if;
    v_sheet:=jsonb_set(v_sheet,array['proficiencies','skills',v_skill_key],coalesce(v_sheet #> array['proficiencies','skills',v_skill_key],'{}'::jsonb)||jsonb_build_object('proficient',true),true);
    v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','skill-proficiency','skill',v_skill_key));
  end loop;

  v_tools:=case when jsonb_typeof(v_sheet->'tools')='array' then v_sheet->'tools' else '[]'::jsonb end;
  for v_skill_entry in select value from jsonb_array_elements(coalesce(v_option.metadata->'toolProficiencies','[]'::jsonb)) loop
    if jsonb_typeof(v_skill_entry)<>'object' then continue; end if;
    for v_key,v_value in select key,value from jsonb_each(v_skill_entry) loop
      if v_key like 'any%' or v_key='choose' then raise exception 'Variable tool proficiency effects for % require a dedicated validator.',v_option.name; end if;
      if coalesce((v_value #>> '{}')::boolean,false) and not exists(select 1 from jsonb_array_elements_text(v_tools) t where private.normalize_player_choice_name_v1(t)=private.normalize_player_choice_name_v1(v_key)) then
        v_tools:=v_tools||to_jsonb(v_key); v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','tool-proficiency','tool',v_key));
      end if;
    end loop;
  end loop;
  v_sheet:=jsonb_set(v_sheet,'{tools}',v_tools,true);

  v_armor:=case when jsonb_typeof(v_sheet->'armorProficiencies')='array' then v_sheet->'armorProficiencies' else '[]'::jsonb end;
  for v_skill_entry in select value from jsonb_array_elements(coalesce(v_option.metadata->'armorProficiencies','[]'::jsonb)) loop
    for v_key,v_value in select key,value from jsonb_each(v_skill_entry) loop
      if coalesce((v_value #>> '{}')::boolean,false) and not exists(select 1 from jsonb_array_elements_text(v_armor) a where lower(a)=lower(v_key)) then v_armor:=v_armor||to_jsonb(v_key); v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','armor-proficiency','armor',v_key)); end if;
    end loop;
  end loop;
  v_sheet:=jsonb_set(v_sheet,'{armorProficiencies}',v_armor,true);
  v_weapons:=case when jsonb_typeof(v_sheet->'weaponProficiencies')='array' then v_sheet->'weaponProficiencies' else '[]'::jsonb end;
  for v_skill_entry in select value from jsonb_array_elements(coalesce(v_option.metadata->'weaponProficiencies','[]'::jsonb)) loop
    for v_key,v_value in select key,value from jsonb_each(v_skill_entry) loop
      if coalesce((v_value #>> '{}')::boolean,false) and not exists(select 1 from jsonb_array_elements_text(v_weapons) a where lower(a)=lower(v_key)) then v_weapons:=v_weapons||to_jsonb(v_key); v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','weapon-proficiency','weapon',v_key)); end if;
    end loop;
  end loop;
  v_sheet:=jsonb_set(v_sheet,'{weaponProficiencies}',v_weapons,true);

  if lower(v_option.name)='resilient' then
    select choice into v_expertise_choice from jsonb_each(coalesce(p_instance->'choices','{}'::jsonb)) field cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice where choice->>'kind'='ability' limit 1;
    v_ability:=lower(coalesce(v_expertise_choice->>'value',''));
    if v_ability not in ('str','dex','con','int','wis','cha') then raise exception 'Resilient requires a valid saving-throw ability.'; end if;
    if coalesce((v_sheet #>> array['proficiencies','saves',v_ability,'proficient'])::boolean,false) then raise exception 'Resilient must choose an ability in which the character lacks saving throw proficiency.'; end if;
    if jsonb_typeof(v_sheet #> '{proficiencies,saves}')<>'object' then v_sheet:=jsonb_set(v_sheet,'{proficiencies,saves}','{}'::jsonb,true); end if;
    v_sheet:=jsonb_set(v_sheet,array['proficiencies','saves',v_ability],coalesce(v_sheet #> array['proficiencies','saves',v_ability],'{}'::jsonb)||jsonb_build_object('proficient',true),true);
    v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','saving-throw-proficiency','ability',v_ability));
  end if;

  select choice into v_expertise_choice from jsonb_each(coalesce(p_instance->'choices','{}'::jsonb)) field cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice where choice->>'kind'='expertise' limit 1;
  if lower(v_option.name)='skill expert' then
    if v_expertise_choice is null then raise exception 'Skill Expert requires one Expertise choice.'; end if;
    v_skill_label:=coalesce(nullif(v_expertise_choice->>'label',''),v_expertise_choice->>'value',''); v_skill_key:=private.player_sheet_skill_key_v1(v_skill_label);
    if v_skill_key is null or not coalesce((v_sheet #>> array['proficiencies','skills',v_skill_key,'proficient'])::boolean,false) then raise exception 'Skill Expert Expertise must use a skill the character is proficient in.'; end if;
    v_sheet:=jsonb_set(v_sheet,array['proficiencies','skills',v_skill_key],coalesce(v_sheet #> array['proficiencies','skills',v_skill_key],'{}'::jsonb)||jsonb_build_object('expertise',true),true);
    v_expertise:=case when jsonb_typeof(v_sheet->'expertiseSkills')='array' then v_sheet->'expertiseSkills' else '[]'::jsonb end;
    if not exists(select 1 from jsonb_array_elements_text(v_expertise) e where e=v_skill_key) then v_expertise:=v_expertise||to_jsonb(v_skill_key); end if;
    v_sheet:=jsonb_set(v_sheet,'{expertiseSkills}',v_expertise,true); v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','expertise','skill',v_skill_key));
  elsif v_expertise_choice is not null then raise exception '% does not grant an Expertise selection.',v_option.name; end if;

  select coalesce(jsonb_agg(choice),'[]'::jsonb),count(*) into v_damage_choices,v_damage_count from jsonb_each(coalesce(p_instance->'choices','{}'::jsonb)) field cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice where choice->>'kind'='damage-type';
  if lower(v_option.name)='elemental adept' then
    if v_damage_count<>1 then raise exception 'Elemental Adept requires one damage type.'; end if;
    v_damage:=lower(coalesce(v_damage_choices #>> '{0,value}',v_damage_choices #>> '{0,label}',''));
    if v_damage not in ('acid','cold','fire','lightning','thunder') then raise exception 'Elemental Adept damage type is invalid.'; end if;
    if exists(select 1 from public.character_option_grant_instances gi cross join lateral jsonb_each(coalesce(gi.choices,'{}'::jsonb)) field cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice where gi.character_id=p_character_id and gi.option_id=v_option.id and choice->>'kind'='damage-type' and lower(coalesce(choice->>'value',choice->>'label',''))=v_damage) then raise exception 'Elemental Adept must choose a different damage type each time.'; end if;
  elsif v_damage_count<>0 then raise exception '% does not grant a damage-type selection.',v_option.name; end if;

  v_spell_grants:=private.materialize_level_up_advancement_spells_v1(p_character_id,p_to_level,p_option_id,p_instance);
  if jsonb_array_length(v_spell_grants)>0 then v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','spell-grants','spells',v_spell_grants)); end if;

  v_repeatable:=coalesce((v_option.metadata->>'repeatable')::boolean,false);
  v_sanitized:=jsonb_build_object('instanceId',v_instance_key,'optionId',v_option.id,'optionKey',v_option.option_key,'optionType',v_option.option_type,'name',v_option.name,'source',v_option.source,'category',v_option.category,'repeatable',v_repeatable,'acquisitionOwnerType','advancement','acquisitionOwnerKey','level:'||p_to_level::text,'acquisitionLabel',case when v_option.option_type='boon' then 'Level '||p_to_level::text||' Epic Boon' else 'Level '||p_to_level::text||' feat' end,'acquisitionLevel',p_to_level,'fixedEffects',v_effects,'fixedSpellTokens','[]'::jsonb,'choices',coalesce(p_instance->'choices','{}'::jsonb));
  v_instances:=case when jsonb_typeof(v_sheet->'featGrantInstances')='array' then v_sheet->'featGrantInstances' else '[]'::jsonb end;
  if exists(select 1 from jsonb_array_elements(v_instances) existing where existing->>'instanceId'=v_instance_key) then raise exception 'This level already has an advancement grant instance.'; end if;
  v_sheet:=jsonb_set(v_sheet,'{featGrantInstances}',v_instances||jsonb_build_array(v_sanitized),true);
  v_feats:=case when jsonb_typeof(v_sheet->'feats')='array' then v_sheet->'feats' else '[]'::jsonb end;
  if not exists(select 1 from jsonb_array_elements_text(v_feats) f where private.normalize_player_choice_name_v1(f)=private.normalize_player_choice_name_v1(v_option.name)) then v_feats:=v_feats||to_jsonb(v_option.name); end if;
  v_sheet:=jsonb_set(v_sheet,'{feats}',v_feats,true);

  select coalesce(jsonb_agg(s.name order by s.level,s.name),'[]'::jsonb) into v_class_spells from public.character_spells cs join public.spells_catalog s on s.id=cs.spell_id where cs.character_id=p_character_id and cs.source_type='class';
  v_sheet:=jsonb_set(v_sheet,'{spells}',coalesce(v_class_spells,'[]'::jsonb),true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in (select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);

  insert into public.character_option_grant_instances(character_id,option_id,option_key,option_type,option_name,option_source,instance_key,acquisition_owner_type,acquisition_owner_key,acquisition_label,acquisition_level,choices,effects,fixed_spell_tokens,repeatable,granted_by,updated_at)
  values(p_character_id,v_option.id,v_option.option_key,v_option.option_type,v_option.name,v_option.source,v_instance_key,'advancement','level:'||p_to_level::text,case when v_option.option_type='boon' then 'Level '||p_to_level::text||' Epic Boon' else 'Level '||p_to_level::text||' feat' end,p_to_level,coalesce(p_instance->'choices','{}'::jsonb),v_effects,'[]'::jsonb,v_repeatable,auth.uid(),now());
  insert into public.character_option_grants(character_id,option_id,notes,granted_by,updated_at) values(p_character_id,v_option.id,'Earned through character progression at level '||p_to_level::text||'.',auth.uid(),now()) on conflict(character_id,option_id) do nothing;
  return v_sanitized;
end;
$function$;

-- Correct the 2024 armor-training provenance used by later prerequisite checks:
-- Lightly Armored grants Light Armor and Shields; Moderately Armored grants
-- Medium Armor.
create or replace function private.character_has_progression_proficiency_v1(p_character_id uuid,p_class_id uuid,p_kind text,p_value text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private'
as $function$
declare v_class public.class_catalog%rowtype; v_wanted text:=lower(btrim(coalesce(p_value,''))); v_values jsonb;
begin
  select * into v_class from public.class_catalog where id=p_class_id; if not found or v_wanted='' then return false; end if;
  if lower(coalesce(p_kind,''))='armor' then
    v_values:=coalesce(v_class.raw_payload #> '{starting_proficiencies,armor}','[]'::jsonb);
    if exists(select 1 from jsonb_array_elements_text(v_values) value where lower(btrim(value))=v_wanted) then return true; end if;
    if v_wanted in ('light','shield') and exists(select 1 from public.character_option_grant_instances where character_id=p_character_id and lower(option_name)='lightly armored') then return true; end if;
    if v_wanted='medium' and exists(select 1 from public.character_option_grant_instances where character_id=p_character_id and lower(option_name)='moderately armored') then return true; end if;
    if v_wanted='heavy' and exists(select 1 from public.character_option_grant_instances where character_id=p_character_id and lower(option_name)='heavily armored') then return true; end if;
    return false;
  end if;
  if lower(coalesce(p_kind,'')) in ('weapon','weapongroup') then
    v_values:=coalesce(v_class.raw_payload #> '{starting_proficiencies,weapons}','[]'::jsonb);
    if exists(select 1 from jsonb_array_elements_text(v_values) value where lower(btrim(value))=v_wanted) then return true; end if;
    if v_wanted='martial' and exists(select 1 from public.character_option_grant_instances where character_id=p_character_id and lower(option_name)='martial weapon training') then return true; end if;
    return false;
  end if;
  return false;
end;
$function$;

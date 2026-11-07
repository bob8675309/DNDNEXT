-- DNDNext P1.3 verified live PostgreSQL 17 definitions, SELECT-only extraction, 2026-11-05.
-- Disposable PG17/GoTrue F17-F21 fixture only. NEVER APPLY TO PRODUCTION.

-- md5(pg_get_functiondef): private.apply_character_level_advancement_v1(p_character_id uuid, p_to_level integer, p_option_id uuid, p_instance jsonb) = 46dd0af4f6ca816422a75e91a292c634
CREATE OR REPLACE FUNCTION private.apply_character_level_advancement_v1(p_character_id uuid, p_to_level integer, p_option_id uuid, p_instance jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$ declare v_option public.character_option_catalog%rowtype; v_sheet jsonb; v_increases jsonb; v_effects jsonb:='[]'::jsonb; v_ability text; v_increment_json jsonb; v_increment integer; v_score integer; v_cap integer; v_old_con integer:=10; v_new_con integer:=10; v_old_con_mod integer:=0; v_new_con_mod integer:=0; v_hp_delta integer:=0; v_hp integer:=0; v_max_hp integer:=0; v_skill_entry jsonb; v_skill_choice jsonb; v_skill_choices jsonb:='[]'::jsonb; v_selected_skill_count integer:=0; v_expected_skill_count integer:=0; v_skill_label text; v_skill_key text; v_allowed boolean; v_key text; v_value jsonb; v_tools jsonb; v_armor jsonb; v_weapons jsonb; v_expertise jsonb; v_expertise_choice jsonb; v_damage_choices jsonb:='[]'::jsonb; v_damage_count integer:=0; v_damage text; v_spell_grants jsonb:='[]'::jsonb; v_instance_key text:='level-'||p_to_level::text||'-advancement'; v_instances jsonb; v_feats jsonb; v_sanitized jsonb; v_repeatable boolean; v_class_spells jsonb; begin select * into v_option from public.character_option_catalog where id=p_option_id and option_type in ('feat','boon'); if not found then raise exception 'Advancement option was not found.'; end if; select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update; v_increases:=private.level_up_ability_increases_v1(p_option_id,p_instance); begin v_old_con:=coalesce(nullif(v_sheet #>> '{abilities,con,score}','')::integer,nullif(v_sheet #>> '{abilities,con}','')::integer,10); exception when others then v_old_con:=10; end; for v_ability,v_increment_json in select key,value from jsonb_each(v_increases) loop v_increment:=(v_increment_json #>> '{}')::integer; begin v_score:=coalesce(nullif(v_sheet->'abilities'->v_ability->>'score','')::integer,nullif(v_sheet->'abilities'->>v_ability,'')::integer,10); exception when others then v_score:=10; end; v_cap:=case when v_option.option_type='boon' or v_option.category='EB' then 30 else 20 end; if v_score+v_increment>v_cap then raise exception '% cannot be increased above % by %.',upper(v_ability),v_cap,v_option.name; end if; if jsonb_typeof(v_sheet->'abilities')<>'object' then v_sheet:=jsonb_set(v_sheet,'{abilities}','{}'::jsonb,true); end if; if jsonb_typeof(v_sheet->'abilities'->v_ability)<>'object' then v_sheet:=jsonb_set(v_sheet,array['abilities',v_ability],jsonb_build_object('score',v_score),true); end if; v_sheet:=jsonb_set(v_sheet,array['abilities',v_ability,'score'],to_jsonb(v_score+v_increment),true); v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','ability-increase','ability',v_ability,'amount',v_increment,'cap',v_cap)); end loop; begin v_new_con:=coalesce(nullif(v_sheet #>> '{abilities,con,score}','')::integer,v_old_con); exception when others then v_new_con:=v_old_con; end; v_old_con_mod:=floor((v_old_con-10)/2.0)::integer; v_new_con_mod:=floor((v_new_con-10)/2.0)::integer; v_hp_delta:=(v_new_con_mod-v_old_con_mod)*p_to_level; if v_hp_delta<>0 then begin v_max_hp:=coalesce(nullif(v_sheet->>'maxHp','')::integer,nullif(v_sheet->>'hp','')::integer,0); v_hp:=coalesce(nullif(v_sheet->>'hp','')::integer,v_max_hp); exception when others then v_max_hp:=0; v_hp:=0; end; v_sheet:=v_sheet||jsonb_build_object('maxHp',greatest(1,v_max_hp+v_hp_delta),'hp',greatest(1,v_hp+v_hp_delta)); v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','constitution-hit-points','amount',v_hp_delta,'levelCount',p_to_level)); end if; select coalesce(jsonb_agg(choice),'[]'::jsonb),count(*) into v_skill_choices,v_selected_skill_count from jsonb_each(coalesce(p_instance->'choices','{}'::jsonb)) field cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice where choice->>'kind'='skill'; for v_skill_entry in select value from jsonb_array_elements(coalesce(v_option.metadata->'skillProficiencies','[]'::jsonb)) loop if jsonb_typeof(v_skill_entry)<>'object' then continue; end if; if v_skill_entry?'any' then v_expected_skill_count:=v_expected_skill_count+greatest(1,coalesce((v_skill_entry->>'any')::integer,1)); end if; if jsonb_typeof(v_skill_entry->'choose')='object' then v_expected_skill_count:=v_expected_skill_count+greatest(1,coalesce((v_skill_entry #>> '{choose,count}')::integer,1)); end if; for v_key,v_value in select key,value from jsonb_each(v_skill_entry) loop if v_key in ('any','choose') then continue; end if; if coalesce((v_value #>> '{}')::boolean,false) then v_skill_key:=private.player_sheet_skill_key_v1(v_key); if v_skill_key is not null then if jsonb_typeof(v_sheet #> '{proficiencies,skills}')<>'object' then v_sheet:=jsonb_set(v_sheet,'{proficiencies,skills}','{}'::jsonb,true); end if; v_sheet:=jsonb_set(v_sheet,array['proficiencies','skills',v_skill_key],coalesce(v_sheet #> array['proficiencies','skills',v_skill_key],'{}'::jsonb)||jsonb_build_object('proficient',true),true); v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','skill-proficiency','skill',v_skill_key)); end if; end if; end loop; end loop; if v_selected_skill_count<>v_expected_skill_count then raise exception '% requires exactly % selected skill proficiency choice(s); received %.',v_option.name,v_expected_skill_count,v_selected_skill_count; end if; for v_skill_choice in select value from jsonb_array_elements(v_skill_choices) loop v_skill_label:=coalesce(nullif(v_skill_choice->>'label',''),v_skill_choice->>'value',''); v_skill_key:=private.player_sheet_skill_key_v1(v_skill_label); if v_skill_key is null then raise exception '% contains an invalid skill choice.',v_option.name; end if; v_allowed:=exists(select 1 from jsonb_array_elements(coalesce(v_option.metadata->'skillProficiencies','[]'::jsonb)) entry where entry?'any' or exists(select 1 from jsonb_array_elements_text(coalesce(entry #> '{choose,from}','[]'::jsonb)) allowed where private.normalize_player_choice_name_v1(allowed)=private.normalize_player_choice_name_v1(v_skill_label))); if not v_allowed then raise exception '% does not allow % as a skill proficiency.',v_option.name,v_skill_label; end if; if jsonb_typeof(v_sheet #> '{proficiencies,skills}')<>'object' then v_sheet:=jsonb_set(v_sheet,'{proficiencies,skills}','{}'::jsonb,true); end if; v_sheet:=jsonb_set(v_sheet,array['proficiencies','skills',v_skill_key],coalesce(v_sheet #> array['proficiencies','skills',v_skill_key],'{}'::jsonb)||jsonb_build_object('proficient',true),true); v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','skill-proficiency','skill',v_skill_key)); end loop; v_tools:=case when jsonb_typeof(v_sheet->'tools')='array' then v_sheet->'tools' else '[]'::jsonb end; for v_skill_entry in select value from jsonb_array_elements(coalesce(v_option.metadata->'toolProficiencies','[]'::jsonb)) loop if jsonb_typeof(v_skill_entry)<>'object' then continue; end if; for v_key,v_value in select key,value from jsonb_each(v_skill_entry) loop if v_key like 'any%' or v_key='choose' then raise exception 'Variable tool proficiency effects for % require a dedicated validator.',v_option.name; end if; if coalesce((v_value #>> '{}')::boolean,false) and not exists(select 1 from jsonb_array_elements_text(v_tools) t where private.normalize_player_choice_name_v1(t)=private.normalize_player_choice_name_v1(v_key)) then v_tools:=v_tools||to_jsonb(v_key); v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','tool-proficiency','tool',v_key)); end if; end loop; end loop; v_sheet:=jsonb_set(v_sheet,'{tools}',v_tools,true); v_armor:=case when jsonb_typeof(v_sheet->'armorProficiencies')='array' then v_sheet->'armorProficiencies' else '[]'::jsonb end; for v_skill_entry in select value from jsonb_array_elements(coalesce(v_option.metadata->'armorProficiencies','[]'::jsonb)) loop for v_key,v_value in select key,value from jsonb_each(v_skill_entry) loop if coalesce((v_value #>> '{}')::boolean,false) and not exists(select 1 from jsonb_array_elements_text(v_armor) a where lower(a)=lower(v_key)) then v_armor:=v_armor||to_jsonb(v_key); v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','armor-proficiency','armor',v_key)); end if; end loop; end loop; v_sheet:=jsonb_set(v_sheet,'{armorProficiencies}',v_armor,true); v_weapons:=case when jsonb_typeof(v_sheet->'weaponProficiencies')='array' then v_sheet->'weaponProficiencies' else '[]'::jsonb end; for v_skill_entry in select value from jsonb_array_elements(coalesce(v_option.metadata->'weaponProficiencies','[]'::jsonb)) loop for v_key,v_value in select key,value from jsonb_each(v_skill_entry) loop if coalesce((v_value #>> '{}')::boolean,false) and not exists(select 1 from jsonb_array_elements_text(v_weapons) a where lower(a)=lower(v_key)) then v_weapons:=v_weapons||to_jsonb(v_key); v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','weapon-proficiency','weapon',v_key)); end if; end loop; end loop; v_sheet:=jsonb_set(v_sheet,'{weaponProficiencies}',v_weapons,true); if lower(v_option.name)='resilient' then select choice into v_expertise_choice from jsonb_each(coalesce(p_instance->'choices','{}'::jsonb)) field cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice where choice->>'kind'='ability' limit 1; v_ability:=lower(coalesce(v_expertise_choice->>'value','')); if v_ability not in ('str','dex','con','int','wis','cha') then raise exception 'Resilient requires a valid saving-throw ability.'; end if; if coalesce((v_sheet #>> array['proficiencies','saves',v_ability,'proficient'])::boolean,false) then raise exception 'Resilient must choose an ability in which the character lacks saving throw proficiency.'; end if; if jsonb_typeof(v_sheet #> '{proficiencies,saves}')<>'object' then v_sheet:=jsonb_set(v_sheet,'{proficiencies,saves}','{}'::jsonb,true); end if; v_sheet:=jsonb_set(v_sheet,array['proficiencies','saves',v_ability],coalesce(v_sheet #> array['proficiencies','saves',v_ability],'{}'::jsonb)||jsonb_build_object('proficient',true),true); v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','saving-throw-proficiency','ability',v_ability)); end if; select choice into v_expertise_choice from jsonb_each(coalesce(p_instance->'choices','{}'::jsonb)) field cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice where choice->>'kind'='expertise' limit 1; if lower(v_option.name)='skill expert' then if v_expertise_choice is null then raise exception 'Skill Expert requires one Expertise choice.'; end if; v_skill_label:=coalesce(nullif(v_expertise_choice->>'label',''),v_expertise_choice->>'value',''); v_skill_key:=private.player_sheet_skill_key_v1(v_skill_label); if v_skill_key is null or not coalesce((v_sheet #>> array['proficiencies','skills',v_skill_key,'proficient'])::boolean,false) then raise exception 'Skill Expert Expertise must use a skill the character is proficient in.'; end if; v_sheet:=jsonb_set(v_sheet,array['proficiencies','skills',v_skill_key],coalesce(v_sheet #> array['proficiencies','skills',v_skill_key],'{}'::jsonb)||jsonb_build_object('expertise',true),true); v_expertise:=case when jsonb_typeof(v_sheet->'expertiseSkills')='array' then v_sheet->'expertiseSkills' else '[]'::jsonb end; if not exists(select 1 from jsonb_array_elements_text(v_expertise) e where e=v_skill_key) then v_expertise:=v_expertise||to_jsonb(v_skill_key); end if; v_sheet:=jsonb_set(v_sheet,'{expertiseSkills}',v_expertise,true); v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','expertise','skill',v_skill_key)); elsif v_expertise_choice is not null then raise exception '% does not grant an Expertise selection.',v_option.name; end if; select coalesce(jsonb_agg(choice),'[]'::jsonb),count(*) into v_damage_choices,v_damage_count from jsonb_each(coalesce(p_instance->'choices','{}'::jsonb)) field cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice where choice->>'kind'='damage-type'; if lower(v_option.name)='elemental adept' then if v_damage_count<>1 then raise exception 'Elemental Adept requires one damage type.'; end if; v_damage:=lower(coalesce(v_damage_choices #>> '{0,value}',v_damage_choices #>> '{0,label}','')); if v_damage not in ('acid','cold','fire','lightning','thunder') then raise exception 'Elemental Adept damage type is invalid.'; end if; if exists(select 1 from public.character_option_grant_instances gi cross join lateral jsonb_each(coalesce(gi.choices,'{}'::jsonb)) field cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice where gi.character_id=p_character_id and gi.option_id=v_option.id and choice->>'kind'='damage-type' and lower(coalesce(choice->>'value',choice->>'label',''))=v_damage) then raise exception 'Elemental Adept must choose a different damage type each time.'; end if; elsif v_damage_count<>0 then raise exception '% does not grant a damage-type selection.',v_option.name; end if; v_spell_grants:=private.materialize_level_up_advancement_spells_v1(p_character_id,p_to_level,p_option_id,p_instance); if jsonb_array_length(v_spell_grants)>0 then v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','spell-grants','spells',v_spell_grants)); end if; v_repeatable:=coalesce((v_option.metadata->>'repeatable')::boolean,false); v_sanitized:=jsonb_build_object('instanceId',v_instance_key,'optionId',v_option.id,'optionKey',v_option.option_key,'optionType',v_option.option_type,'name',v_option.name,'source',v_option.source,'category',v_option.category,'repeatable',v_repeatable,'acquisitionOwnerType','advancement','acquisitionOwnerKey','level:'||p_to_level::text,'acquisitionLabel',case when v_option.option_type='boon' then 'Level '||p_to_level::text||' Epic Boon' else 'Level '||p_to_level::text||' feat' end,'acquisitionLevel',p_to_level,'fixedEffects',v_effects,'fixedSpellTokens','[]'::jsonb,'choices',coalesce(p_instance->'choices','{}'::jsonb)); v_instances:=case when jsonb_typeof(v_sheet->'featGrantInstances')='array' then v_sheet->'featGrantInstances' else '[]'::jsonb end; if exists(select 1 from jsonb_array_elements(v_instances) existing where existing->>'instanceId'=v_instance_key) then raise exception 'This level already has an advancement grant instance.'; end if; v_sheet:=jsonb_set(v_sheet,'{featGrantInstances}',v_instances||jsonb_build_array(v_sanitized),true); v_feats:=case when jsonb_typeof(v_sheet->'feats')='array' then v_sheet->'feats' else '[]'::jsonb end; if not exists(select 1 from jsonb_array_elements_text(v_feats) f where private.normalize_player_choice_name_v1(f)=private.normalize_player_choice_name_v1(v_option.name)) then v_feats:=v_feats||to_jsonb(v_option.name); end if; v_sheet:=jsonb_set(v_sheet,'{feats}',v_feats,true); select coalesce(jsonb_agg(s.name order by s.level,s.name),'[]'::jsonb) into v_class_spells from public.character_spells cs join public.spells_catalog s on s.id=cs.spell_id where cs.character_id=p_character_id and cs.source_type='class'; v_sheet:=jsonb_set(v_sheet,'{spells}',coalesce(v_class_spells,'[]'::jsonb),true); update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id; update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id); insert into public.character_option_grant_instances(character_id,option_id,option_key,option_type,option_name,option_source,instance_key,acquisition_owner_type,acquisition_owner_key,acquisition_label,acquisition_level,choices,effects,fixed_spell_tokens,repeatable,granted_by,updated_at) values(p_character_id,v_option.id,v_option.option_key,v_option.option_type,v_option.name,v_option.source,v_instance_key,'advancement','level:'||p_to_level::text,case when v_option.option_type='boon' then 'Level '||p_to_level::text||' Epic Boon' else 'Level '||p_to_level::text||' feat' end,p_to_level,coalesce(p_instance->'choices','{}'::jsonb),v_effects,'[]'::jsonb,v_repeatable,auth.uid(),now()); insert into public.character_option_grants(character_id,option_id,notes,granted_by,updated_at) values(p_character_id,v_option.id,'Earned through character progression at level '||p_to_level::text||'.',auth.uid(),now()) on conflict(character_id,option_id) do nothing; return v_sanitized; end; $function$;

-- md5(pg_get_functiondef): private.character_option_prerequisites_met_v1(p_character_id uuid, p_option_id uuid, p_acquisition_level integer) = 21f370cac373521d64a55eebbd61d1bd
CREATE OR REPLACE FUNCTION private.character_option_prerequisites_met_v1(p_character_id uuid, p_option_id uuid, p_acquisition_level integer)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$ declare v_option public.character_option_catalog%rowtype; v_progression public.character_progression%rowtype; v_class public.class_catalog%rowtype; v_sheet jsonb:='{}'::jsonb; v_prereqs jsonb; v_alt jsonb; v_alt_ok boolean; v_key text; v_value jsonb; v_req jsonb; v_ability text; v_min integer; v_score integer; v_known_keys constant text[]:=array['level','ability','spellcasting2020','spellcastingFeature','feature','proficiency','feat','background','race','campaign']; begin select * into v_option from public.character_option_catalog where id=p_option_id and option_type in ('feat','boon'); if not found then return false; end if; select * into v_progression from public.character_progression where character_id=p_character_id; if not found then return false; end if; select * into v_class from public.class_catalog where id=v_progression.class_id; select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id; v_prereqs:=coalesce(v_option.metadata->'prerequisite','[]'::jsonb); if jsonb_typeof(v_prereqs)<>'array' then return false; end if; if jsonb_array_length(v_prereqs)=0 then return true; end if; for v_alt in select value from jsonb_array_elements(v_prereqs) loop if jsonb_typeof(v_alt)<>'object' then continue; end if; v_alt_ok:=true; for v_key,v_value in select key,value from jsonb_each(v_alt) loop if not (v_key=any(v_known_keys)) then v_alt_ok:=false; exit; end if; if v_key='level' then if jsonb_typeof(v_value)='number' then if p_acquisition_level < (v_value #>> '{}')::integer then v_alt_ok:=false; exit; end if; elsif jsonb_typeof(v_value)='object' then if p_acquisition_level < coalesce((v_value->>'level')::integer,1) then v_alt_ok:=false; exit; end if; if nullif(v_value #>> '{class,name}','') is not null and lower(v_value #>> '{class,name}')<>lower(v_class.class_name) then v_alt_ok:=false; exit; end if; else v_alt_ok:=false; exit; end if; elsif v_key='ability' then if jsonb_typeof(v_value)<>'array' then v_alt_ok:=false; exit; end if; for v_req in select value from jsonb_array_elements(v_value) loop for v_ability,v_value in select key,value from jsonb_each(v_req) loop if v_ability not in ('str','dex','con','int','wis','cha') then continue; end if; v_min:=(v_value #>> '{}')::integer; begin v_score:=coalesce(nullif(v_sheet->'abilities'->v_ability->>'score','')::integer,nullif(v_sheet->'abilities'->>v_ability,'')::integer,10); exception when others then v_score:=10; end; if v_score<v_min then v_alt_ok:=false; exit; end if; end loop; exit when not v_alt_ok; end loop; exit when not v_alt_ok; elsif v_key in ('spellcasting2020','spellcastingFeature') then if coalesce((v_value #>> '{}')::boolean,false) and not (v_class.spellcasting_ability is not null or lower(coalesce(v_class.caster_progression,'')) like '%pact%' or lower(v_class.class_key)='warlock' or coalesce(v_sheet->'spellcasting'->>'ability','')<>'') then v_alt_ok:=false; exit; end if; elsif v_key='feature' then if jsonb_typeof(v_value)<>'array' then v_alt_ok:=false; exit; end if; if not exists(select 1 from jsonb_array_elements_text(v_value) wanted where (lower(wanted) in ('spellcasting','pact magic') and (v_class.spellcasting_ability is not null or lower(v_class.class_key)='warlock')) or exists(select 1 from public.class_feature_catalog f where f.class_name=v_class.class_name and f.class_source=v_class.source and f.level<=p_acquisition_level and lower(f.name)=lower(wanted))) then v_alt_ok:=false; exit; end if; elsif v_key='proficiency' then if jsonb_typeof(v_value)<>'array' then v_alt_ok:=false; exit; end if; for v_req in select value from jsonb_array_elements(v_value) loop if nullif(v_req->>'armor','') is not null and not private.character_has_progression_proficiency_v1(p_character_id,v_class.id,'armor',v_req->>'armor') then v_alt_ok:=false; exit; end if; if nullif(v_req->>'weapon','') is not null and not private.character_has_progression_proficiency_v1(p_character_id,v_class.id,'weapon',v_req->>'weapon') then v_alt_ok:=false; exit; end if; if nullif(v_req->>'weaponGroup','') is not null and not private.character_has_progression_proficiency_v1(p_character_id,v_class.id,'weaponGroup',v_req->>'weaponGroup') then v_alt_ok:=false; exit; end if; end loop; exit when not v_alt_ok; elsif v_key='feat' then if jsonb_typeof(v_value)<>'array' then v_alt_ok:=false; exit; end if; if not exists(select 1 from jsonb_array_elements_text(v_value) token where exists(select 1 from public.character_option_grant_instances gi where gi.character_id=p_character_id and private.normalize_player_choice_name_v1(gi.option_name)=private.normalize_player_choice_name_v1(split_part(token,'|',1)))) then v_alt_ok:=false; exit; end if; elsif v_key='background' then if jsonb_typeof(v_value)<>'array' then v_alt_ok:=false; exit; end if; if not exists(select 1 from jsonb_array_elements(v_value) req where private.normalize_player_choice_name_v1(req->>'name')=private.normalize_player_choice_name_v1(coalesce(v_sheet->>'background',v_sheet #>> '{meta,background}',''))) then v_alt_ok:=false; exit; end if; elsif v_key='race' then if jsonb_typeof(v_value)<>'array' then v_alt_ok:=false; exit; end if; if not exists(select 1 from jsonb_array_elements(v_value) req where private.normalize_player_choice_name_v1(req->>'name')=private.normalize_player_choice_name_v1(coalesce(v_sheet->>'species',v_sheet->>'race',v_sheet #>> '{meta,species}',''))) then v_alt_ok:=false; exit; end if; elsif v_key='campaign' then if jsonb_typeof(v_value)<>'array' then v_alt_ok:=false; exit; end if; if coalesce(v_sheet #>> '{meta,campaign}','')='' then v_alt_ok:=false; exit; end if; if not exists(select 1 from jsonb_array_elements_text(v_value) wanted where lower(wanted)=lower(v_sheet #>> '{meta,campaign}')) then v_alt_ok:=false; exit; end if; end if; end loop; if v_alt_ok then return true; end if; end loop; return false; end; $function$;

-- md5(pg_get_functiondef): private.level_has_feature_v1(p_features jsonb, p_name text) = 7616660880fb69db21c4d9b2416c1694
CREATE OR REPLACE FUNCTION private.level_has_feature_v1(p_features jsonb, p_name text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(p_features,'[]'::jsonb)) feature(value)
    where lower(coalesce(value->>'name', value #>> '{}', value::text)) like '%' || lower(coalesce(p_name,'')) || '%'
  );
$function$;

-- md5(pg_get_functiondef): private.level_up_ability_increases_v1(p_option_id uuid, p_instance jsonb) = 6ac310ae1358a3e827e6b15446d3d5f0
CREATE OR REPLACE FUNCTION private.level_up_ability_increases_v1(p_option_id uuid, p_instance jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$ declare v_option public.character_option_catalog%rowtype; v_result jsonb:='{}'::jsonb; v_entry jsonb; v_choose jsonb; v_ability text; v_amount integer; v_current integer; v_choice jsonb; v_ability_choices jsonb:='[]'::jsonb; v_choice_count integer:=0; v_choose_count integer:=0; v_plus_two jsonb; v_plus_ones jsonb; v_mode text; begin select * into v_option from public.character_option_catalog where id=p_option_id and option_type in ('feat','boon'); if not found then raise exception 'Advancement option was not found.'; end if; if lower(v_option.name)='ability score improvement' then v_plus_two:=coalesce(p_instance #> '{choices,asi-plus-two}','[]'::jsonb); v_plus_ones:=coalesce(p_instance #> '{choices,asi-plus-ones}','[]'::jsonb); v_mode:=coalesce(p_instance #>> '{choices,asi-mode,0,value}',''); if jsonb_typeof(v_plus_two)<>'array' or jsonb_typeof(v_plus_ones)<>'array' then raise exception 'Ability Score Improvement choices are malformed.'; end if; if v_mode='plus-two' and jsonb_array_length(v_plus_two)=1 and jsonb_array_length(v_plus_ones)=0 then v_ability:=lower(v_plus_two #>> '{0,value}'); if v_ability not in ('str','dex','con','int','wis','cha') then raise exception 'Choose a valid ability for Ability Score Improvement.'; end if; return jsonb_build_object(v_ability,2); elsif v_mode='split' and jsonb_array_length(v_plus_two)=0 and jsonb_array_length(v_plus_ones)=2 then if lower(v_plus_ones #>> '{0,value}')=lower(v_plus_ones #>> '{1,value}') then raise exception 'Split Ability Score Improvement must use two different abilities.'; end if; for v_choice in select value from jsonb_array_elements(v_plus_ones) loop v_ability:=lower(coalesce(v_choice->>'value','')); if v_ability not in ('str','dex','con','int','wis','cha') then raise exception 'Choose valid abilities for Ability Score Improvement.'; end if; v_result:=jsonb_set(v_result,array[v_ability],to_jsonb(1),true); end loop; return v_result; end if; raise exception 'Ability Score Improvement must be either +2 to one ability or +1 to two different abilities.'; end if; select coalesce(jsonb_agg(choice),'[]'::jsonb),count(*) into v_ability_choices,v_choice_count from jsonb_each(coalesce(p_instance->'choices','{}'::jsonb)) field cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice where choice->>'kind'='ability'; for v_entry in select value from jsonb_array_elements(coalesce(v_option.metadata->'ability','[]'::jsonb)) loop if jsonb_typeof(v_entry)<>'object' then continue; end if; v_choose:=v_entry->'choose'; if jsonb_typeof(v_choose)='object' then v_choose_count:=v_choose_count+1; if v_choice_count<v_choose_count then raise exception '% requires an ability choice.',v_option.name; end if; v_choice:=v_ability_choices->(v_choose_count-1); v_ability:=lower(coalesce(v_choice->>'value','')); if not exists(select 1 from jsonb_array_elements_text(coalesce(v_choose->'from','[]'::jsonb)) allowed where lower(allowed)=v_ability) then raise exception '% does not allow % as its ability choice.',v_option.name,upper(v_ability); end if; v_amount:=coalesce(nullif(v_choose->>'amount','')::integer,nullif(v_entry->>'amount','')::integer,1); v_current:=coalesce(nullif(v_result->>v_ability,'')::integer,0); v_result:=jsonb_set(v_result,array[v_ability],to_jsonb(v_current+v_amount),true); else for v_ability,v_choice in select key,value from jsonb_each(v_entry) loop if v_ability not in ('str','dex','con','int','wis','cha') then continue; end if; begin v_amount:=(v_choice #>> '{}')::integer; exception when others then v_amount:=0; end; if v_amount<>0 then v_current:=coalesce(nullif(v_result->>v_ability,'')::integer,0); v_result:=jsonb_set(v_result,array[v_ability],to_jsonb(v_current+v_amount),true); end if; end loop; end if; end loop; if v_choice_count<>v_choose_count then raise exception '% has unexpected ability selections.',v_option.name; end if; return v_result; end; $function$;

-- md5(pg_get_functiondef): private.level_up_advancement_option_id_v1(p_character_id uuid, p_to_level integer, p_instance jsonb, p_epic boolean) = ee7e6204a499abfe69aaa0c7f304aed2
CREATE OR REPLACE FUNCTION private.level_up_advancement_option_id_v1(p_character_id uuid, p_to_level integer, p_instance jsonb, p_epic boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$ declare v_option_id uuid; v_option public.character_option_catalog%rowtype; v_repeatable boolean:=false; begin if jsonb_typeof(coalesce(p_instance,'{}'::jsonb))<>'object' then raise exception 'Advancement instance must be a JSON object.'; end if; begin v_option_id:=nullif(btrim(p_instance->>'optionId'),'')::uuid; exception when invalid_text_representation then raise exception 'Advancement optionId must be a valid UUID.'; end; if v_option_id is null then raise exception 'Choose a canonical advancement option.'; end if; select o.* into v_option from public.character_option_catalog o where o.id=v_option_id and exists(select 1 from public.character_option_catalog_preferred preferred where preferred.id=o.id); if not found then raise exception 'The selected advancement option is not in the preferred catalogue.'; end if; if p_epic then if not ((v_option.option_type='boon' and v_option.category='EB') or (v_option.option_type='feat' and v_option.category='G')) then raise exception 'Level % requires an Epic Boon or eligible General feat.',p_to_level; end if; elsif not (v_option.option_type='feat' and v_option.category='G') then raise exception 'This advancement requires a 2024 General feat.'; end if; if nullif(btrim(p_instance->>'name'),'') is not null and private.normalize_player_choice_name_v1(p_instance->>'name')<>private.normalize_player_choice_name_v1(v_option.name) then raise exception 'Advancement instance name does not match its canonical option.'; end if; if nullif(btrim(p_instance->>'source'),'') is not null and upper(btrim(p_instance->>'source'))<>upper(v_option.source) then raise exception 'Advancement instance source does not match its canonical option.'; end if; if nullif(btrim(p_instance->>'optionType'),'') is not null and lower(btrim(p_instance->>'optionType'))<>lower(v_option.option_type) then raise exception 'Advancement instance type does not match its canonical option.'; end if; if coalesce(nullif(p_instance->>'acquisitionLevel','')::integer,p_to_level)<>p_to_level then raise exception 'Advancement acquisition level must equal the level being gained.'; end if; if jsonb_typeof(coalesce(p_instance->'choices','{}'::jsonb))<>'object' then raise exception 'Advancement choices must be a JSON object.'; end if; if not private.character_option_prerequisites_met_v1(p_character_id,v_option.id,p_to_level) then raise exception 'The character does not meet the prerequisites for % at level %.',v_option.name,p_to_level; end if; v_repeatable:=coalesce((v_option.metadata->>'repeatable')::boolean,false); if not v_repeatable and exists(select 1 from public.character_option_grant_instances gi where gi.character_id=p_character_id and gi.option_id=v_option.id) then raise exception '% is not repeatable and is already known.',v_option.name; end if; return v_option.id; end; $function$;

-- md5(pg_get_functiondef): private.materialize_boon_energy_resistance_instance_v1() = 35cb3d6560ffde5a94b019a9f373f65d
CREATE OR REPLACE FUNCTION private.materialize_boon_energy_resistance_instance_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_pair text[];
  v_feature_key text;
  v_names jsonb;
  v_state jsonb;
begin
  if private.normalize_player_choice_name_v1(new.option_name)<>private.normalize_player_choice_name_v1('Boon of Energy Resistance')
     or upper(coalesce(new.option_source,''))<>'XPHB' then
    return new;
  end if;

  v_pair:=private.validate_boon_energy_resistance_pair_v1(private.boon_energy_resistance_choices_v1(new.choices));
  select jsonb_agg(entry.value->>'name' order by array_position(v_pair,entry.value->>'key')) into v_names
  from jsonb_array_elements(private.boon_energy_resistance_options_v1()) entry(value)
  where entry.value->>'key'=any(v_pair);

  v_feature_key:=private.boon_energy_resistance_feature_key_v1(new.instance_key);
  v_state:=jsonb_build_object(
    'configured',true,
    'instanceKey',new.instance_key,
    'optionId',new.option_id,
    'resistances',to_jsonb(v_pair),
    'resistanceNames',coalesce(v_names,'[]'::jsonb),
    'configuredAt',timezone('utc',now()),
    'configuredBy','acquisition'
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    new.character_id,v_feature_key,'Boon of Energy Resistance','XPHB','long_rest',v_state,now(),now(),now()
  ) on conflict(character_id,feature_key) do nothing;

  perform private.sync_boon_energy_resistance_projection_v1(new.character_id);
  return new;
end;
$function$;

-- md5(pg_get_functiondef): private.materialize_cartomancer_instance_v1() = 30939673464de80a0791a89017d48065
CREATE OR REPLACE FUNCTION private.materialize_cartomancer_instance_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_context jsonb;
  v_stat text;
  v_spell public.spells_catalog%rowtype;
begin
  if not private.cartomancer_family_v1(new.option_name,new.option_source) then return new; end if;
  v_context:=private.cartomancer_character_context_v1(new.character_id);
  v_stat:=nullif(v_context->>'spellcastingAbility','');
  if v_stat is null then raise exception 'Cartomancer requires a class with the Spellcasting feature.'; end if;

  select * into v_spell from public.spells_catalog_preferred
  where private.normalize_player_choice_name_v1(name)=private.normalize_player_choice_name_v1('Prestidigitation')
    and level=0
  order by case when source='XPHB' then 0 when source='PHB' then 1 else 2 end,name
  limit 1;
  if v_spell.id is null then raise exception 'Cartomancer could not resolve Prestidigitation.'; end if;

  if not exists(
    select 1 from public.character_spells
    where character_id=new.character_id and spell_id=v_spell.id and source_type='feat' and source_key=new.instance_key
  ) then
    insert into public.character_spells(
      character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,
      casting_stat,raw_payload,created_at,updated_at
    ) values(
      new.character_id,v_spell.id,'feat',new.instance_key,'Cartomancer • Card Tricks',true,true,true,
      v_stat,jsonb_build_object(
        'cartomancer',true,'cardTricks',true,'sourceFeat','Cartomancer','source','BMT',
        'instanceKey',new.instance_key,'grantedAtLevel',new.acquisition_level
      ),now(),now()
    );
  end if;
  return new;
end;
$function$;

-- md5(pg_get_functiondef): private.materialize_feat_runtime_expertise_instance_v1() = c56af0b4f49f024a18baf396eeb2d1e2
CREATE OR REPLACE FUNCTION private.materialize_feat_runtime_expertise_instance_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_family text;
  v_sheet jsonb:='{}'::jsonb;
  v_skills text[]:='{}'::text[];
  v_choice jsonb;
  v_skill_key text;
  v_expertise_key text;
  v_expertise_name text;
  v_language text;
  v_languages jsonb:='[]'::jsonb;
  v_feature_key text;
  v_state jsonb;
begin
  v_family:=private.feat_runtime_expertise_family_v1(new.option_name,new.option_source);
  if v_family is null then return new; end if;

  if v_family='zhentarim-tactics' then
    if exists(
      select 1 from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
      cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
      where choice->>'kind'='runtime-expertise'
    ) then
      raise exception 'Zhentarim Tactics does not grant Expertise until a Long Rest is completed.';
    end if;
    return new;
  end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=new.character_id for update;
  if not found then raise exception 'Echoing Soul could not resolve the character sheet.'; end if;

  for v_choice in
    select choice from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
    cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
    where choice->>'kind'='skill'
  loop
    v_skill_key:=private.player_sheet_skill_key_v1(coalesce(nullif(v_choice->>'value',''),v_choice->>'label',''));
    if v_skill_key is null or not exists(
      select 1 from public.character_option_catalog_preferred s
      where s.option_type='skill' and private.player_sheet_skill_key_v1(s.name)=v_skill_key
    ) then raise exception 'Echoing Soul contains an invalid skill proficiency choice.'; end if;
    if v_skill_key=any(v_skills) then raise exception 'Echoing Soul skill proficiency choices must be distinct.'; end if;
    v_skills:=array_append(v_skills,v_skill_key);
  end loop;
  if cardinality(v_skills)<>2 then raise exception 'Echoing Soul requires exactly two skill proficiency choices.'; end if;

  if coalesce(jsonb_typeof(v_sheet#>'{proficiencies,skills}'),'')<>'object' then
    if coalesce(jsonb_typeof(v_sheet->'proficiencies'),'')<>'object' then v_sheet:=jsonb_set(v_sheet,'{proficiencies}','{}'::jsonb,true); end if;
    v_sheet:=jsonb_set(v_sheet,'{proficiencies,skills}','{}'::jsonb,true);
  end if;
  foreach v_skill_key in array v_skills loop
    v_sheet:=jsonb_set(v_sheet,array['proficiencies','skills',v_skill_key],coalesce(v_sheet#>array['proficiencies','skills',v_skill_key],'{}'::jsonb)||jsonb_build_object('proficient',true),true);
  end loop;

  select private.phb_additional_language_name_v1(coalesce(nullif(choice->>'value',''),choice->>'label','')) into v_language
  from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
  cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
  where choice->>'kind'='language'
  limit 1;
  if v_language is null then raise exception 'Echoing Soul requires one additional Player''s Handbook language.'; end if;
  if (
    select count(*) from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
    cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
    where choice->>'kind'='language'
  )<>1 then raise exception 'Echoing Soul requires exactly one additional language.'; end if;
  v_languages:=case when jsonb_typeof(v_sheet->'languages')='array' then v_sheet->'languages' else '[]'::jsonb end;
  if exists(select 1 from jsonb_array_elements_text(v_languages) known where private.normalize_player_choice_name_v1(known)=private.normalize_player_choice_name_v1(v_language)) then
    raise exception 'Echoing Soul must grant a language the character does not already know.';
  end if;
  v_sheet:=jsonb_set(v_sheet,'{languages}',v_languages||to_jsonb(v_language),true);

  select private.player_sheet_skill_key_v1(coalesce(nullif(choice->>'value',''),choice->>'label','')) into v_expertise_key
  from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
  cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
  where choice->>'kind'='runtime-expertise'
  limit 1;
  if v_expertise_key is null then raise exception 'Echoing Soul requires one initial Expertise choice.'; end if;
  if (
    select count(*) from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
    cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
    where choice->>'kind'='runtime-expertise'
  )<>1 then raise exception 'Echoing Soul requires exactly one initial Expertise choice.'; end if;
  if not coalesce((v_sheet#>>array['proficiencies','skills',v_expertise_key,'proficient'])::boolean,false) then
    raise exception 'Echoing Soul Expertise must use a skill the character is proficient in.';
  end if;
  select name into v_expertise_name from public.character_option_catalog_preferred
  where option_type='skill' and private.player_sheet_skill_key_v1(name)=v_expertise_key limit 1;
  if v_expertise_name is null then raise exception 'Echoing Soul Expertise skill is unavailable.'; end if;

  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=new.character_id;

  v_feature_key:=private.feat_runtime_expertise_feature_key_v1(v_family,new.instance_key);
  v_state:=jsonb_build_object(
    'configured',true,'family',v_family,'instanceKey',new.instance_key,'optionId',new.option_id,
    'skill',jsonb_build_object('key',v_expertise_key,'name',v_expertise_name),
    'configuredAt',timezone('utc',now()),'configuredBy','acquisition'
  );
  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    new.character_id,v_feature_key,'Echoing Soul Expertise','RHW','long_rest',v_state,now(),now(),now()
  ) on conflict(character_id,feature_key) do nothing;
  perform private.sync_feat_runtime_expertise_projection_v1(new.character_id);
  return new;
end;
$function$;

-- md5(pg_get_functiondef): private.materialize_level_up_advancement_spells_v1(p_character_id uuid, p_to_level integer, p_option_id uuid, p_instance jsonb) = 805b8ea43cdc2b9e4f88f7adb637f0fb
CREATE OR REPLACE FUNCTION private.materialize_level_up_advancement_spells_v1(p_character_id uuid, p_to_level integer, p_option_id uuid, p_instance jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$ declare v_option public.character_option_catalog%rowtype; v_progression public.character_progression%rowtype; v_level public.class_level_progression%rowtype; v_selected jsonb:='[]'::jsonb; v_choice jsonb; v_spell public.spells_catalog%rowtype; v_spell_id uuid; v_selected_count integer:=0; v_required_count integer:=0; v_fixed_names text[]:='{}'::text[]; v_fixed_name text; v_source_key text:='level-'||p_to_level::text||'-advancement'; v_casting_stat text; v_school text; v_free_cast boolean:=false; v_output jsonb:='[]'::jsonb; begin select * into v_option from public.character_option_catalog where id=p_option_id and option_type in ('feat','boon'); if not found then raise exception 'Advancement option was not found.'; end if; select * into v_progression from public.character_progression where character_id=p_character_id; select * into v_level from public.class_level_progression where class_id=v_progression.class_id and class_level=p_to_level; select coalesce(jsonb_agg(choice),'[]'::jsonb),count(*) into v_selected,v_selected_count from jsonb_each(coalesce(p_instance->'choices','{}'::jsonb)) field cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice where choice->>'kind'='spell'; select coalesce(choice->>'value','') into v_casting_stat from jsonb_each(coalesce(p_instance->'choices','{}'::jsonb)) field cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice where choice->>'kind'='ability' limit 1; if v_casting_stat not in ('str','dex','con','int','wis','cha') then v_casting_stat:=null; end if; if jsonb_array_length(coalesce(v_option.metadata->'additionalSpells','[]'::jsonb))=0 then if v_selected_count<>0 then raise exception '% does not grant selected spells.',v_option.name; end if; return '[]'::jsonb; end if; case lower(v_option.name) when 'fey-touched' then v_required_count:=1; v_fixed_names:=array['Misty Step']; v_free_cast:=true; when 'shadow-touched' then v_required_count:=1; v_fixed_names:=array['Invisibility']; v_free_cast:=true; when 'ritual caster' then v_required_count:=greatest(2,coalesce(v_level.proficiency_bonus,2)); when 'telekinetic' then v_required_count:=0; v_fixed_names:=array['Mage Hand']; when 'telepathic' then v_required_count:=0; v_fixed_names:=array['Detect Thoughts']; v_free_cast:=true; else raise exception 'Spell grants for % are not yet supported by the level-up authority.',v_option.name; end case; if v_selected_count<>v_required_count then raise exception '% requires exactly % selected spell(s); received %.',v_option.name,v_required_count,v_selected_count; end if; for v_choice in select value from jsonb_array_elements(v_selected) loop begin v_spell_id:=coalesce(nullif(v_choice #>> '{metadata,spellId}',''),nullif(v_choice->>'value',''))::uuid; exception when others then raise exception '% contains an invalid selected spell.',v_option.name; end; select * into v_spell from public.spells_catalog where id=v_spell_id; if not found or not public.is_preferred_spell_version_v1(v_spell.id) then raise exception 'A selected feat spell is unavailable or not the preferred version.'; end if; if lower(v_option.name)='ritual caster' then if v_spell.level<>1 or not coalesce(v_spell.ritual,false) then raise exception 'Ritual Caster selections must be level-1 Ritual spells.'; end if; elsif lower(v_option.name)='fey-touched' then v_school:=upper(coalesce(v_spell.school_code,v_spell.school,'')); if v_spell.level<>1 or v_school not in ('E','D','ENCHANTMENT','DIVINATION') then raise exception 'Fey-Touched requires a level-1 Divination or Enchantment spell.'; end if; elsif lower(v_option.name)='shadow-touched' then v_school:=upper(coalesce(v_spell.school_code,v_spell.school,'')); if v_spell.level<>1 or v_school not in ('I','N','ILLUSION','NECROMANCY') then raise exception 'Shadow-Touched requires a level-1 Illusion or Necromancy spell.'; end if; end if; if exists(select 1 from jsonb_array_elements(v_output) existing where existing->>'spell_id'=v_spell.id::text) then raise exception 'Duplicate spell selections are not allowed.'; end if; insert into public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,raw_payload) values(p_character_id,v_spell.id,'feat',v_source_key,v_option.name,true,true,true,v_casting_stat,jsonb_strip_nulls(jsonb_build_object('creator','character_progression_v3','grantedAtLevel',p_to_level,'advancementOptionId',v_option.id,'freeCastUses',case when v_free_cast then 1 else null end,'freeCastRecharge',case when v_free_cast then 'long-rest' else null end))) on conflict(character_id,spell_id,source_type,source_key) do update set known=true,prepared=true,always_available=true,casting_stat=excluded.casting_stat,raw_payload=excluded.raw_payload,updated_at=now(); v_output:=v_output||jsonb_build_array(jsonb_build_object('spell_id',v_spell.id,'name',v_spell.name,'source',v_spell.source,'level',v_spell.level,'fixed',false)); end loop; foreach v_fixed_name in array v_fixed_names loop select * into v_spell from public.spells_catalog s where lower(s.name)=lower(v_fixed_name) and public.is_preferred_spell_version_v1(s.id) order by case when s.source='XPHB' then 0 when s.source='PHB' then 1 else 2 end,s.name limit 1; if not found then raise exception 'The fixed spell % for % is unavailable.',v_fixed_name,v_option.name; end if; insert into public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,raw_payload) values(p_character_id,v_spell.id,'feat',v_source_key,v_option.name,true,true,true,v_casting_stat,jsonb_strip_nulls(jsonb_build_object('creator','character_progression_v3','grantedAtLevel',p_to_level,'advancementOptionId',v_option.id,'freeCastUses',case when v_free_cast then 1 else null end,'freeCastRecharge',case when v_free_cast then 'long-rest' else null end,'fixedGrant',true))) on conflict(character_id,spell_id,source_type,source_key) do update set known=true,prepared=true,always_available=true,casting_stat=excluded.casting_stat,raw_payload=excluded.raw_payload,updated_at=now(); v_output:=v_output||jsonb_build_array(jsonb_build_object('spell_id',v_spell.id,'name',v_spell.name,'source',v_spell.source,'level',v_spell.level,'fixed',true)); end loop; return v_output; end; $function$;

-- md5(pg_get_functiondef): private.normalize_player_choice_name_v1(p_value text) = dd8cdd5b47efe99b1cfff9c2bf7635dd
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
$function$;

-- md5(pg_get_functiondef): private.player_sheet_skill_key_v1(p_value text) = 3b44b44ce828c6ac46ff9eaa935fa150
CREATE OR REPLACE FUNCTION private.player_sheet_skill_key_v1(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$ select case lower(regexp_replace(btrim(coalesce(p_value,'')),'[^a-zA-Z0-9]+',' ','g')) when 'animal handling' then 'animalHandling' when 'sleight of hand' then 'sleightOfHand' when 'acrobatics' then 'acrobatics' when 'arcana' then 'arcana' when 'athletics' then 'athletics' when 'deception' then 'deception' when 'history' then 'history' when 'insight' then 'insight' when 'intimidation' then 'intimidation' when 'investigation' then 'investigation' when 'medicine' then 'medicine' when 'nature' then 'nature' when 'perception' then 'perception' when 'performance' then 'performance' when 'persuasion' then 'persuasion' when 'religion' then 'religion' when 'stealth' then 'stealth' when 'survival' then 'survival' else null end; $function$;

-- md5(pg_get_functiondef): private.resolve_subclass_choice_v1(p_class_key text, p_class_source text, p_subclass_name text, p_subclass_source text) = df25069121f0889de0574e0a28151301
CREATE OR REPLACE FUNCTION private.resolve_subclass_choice_v1(p_class_key text, p_class_source text, p_subclass_name text, p_subclass_source text)
 RETURNS TABLE(subclass_name text, subclass_short_name text, subclass_source text, subclass_class_source text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select
    c.subclass_name,
    coalesce(nullif(btrim(c.subclass_short_name),''), c.subclass_name),
    c.source,
    c.class_source
  from public.class_feature_catalog c
  where c.feature_type = 'subclass'
    and lower(btrim(c.class_key)) = lower(btrim(coalesce(p_class_key,'')))
    and upper(btrim(c.source)) = upper(btrim(coalesce(p_subclass_source,'')))
    and (
      lower(btrim(c.subclass_name)) = lower(btrim(coalesce(p_subclass_name,'')))
      or lower(btrim(coalesce(c.subclass_short_name,''))) = lower(btrim(coalesce(p_subclass_name,'')))
    )
  group by c.subclass_name, c.subclass_short_name, c.source, c.class_source
  order by
    (upper(c.class_source) = upper(btrim(coalesce(p_class_source,'')))) desc,
    count(*) filter (where nullif(btrim(coalesce(c.description,'')),'') is not null) desc,
    count(*) desc,
    c.subclass_name
  limit 1;
$function$;

-- md5(pg_get_functiondef): private.cartomancer_family_v1(p_option_name text, p_option_source text) = 3801761f8bc46c5af10fca5e5ae73e60
CREATE OR REPLACE FUNCTION private.cartomancer_family_v1(p_option_name text, p_option_source text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select lower(regexp_replace(coalesce(p_option_name,''),'[^a-zA-Z0-9]+','','g'))='cartomancer'
     and upper(coalesce(p_option_source,''))='BMT';
$function$;

-- md5(pg_get_functiondef): private.feat_runtime_expertise_family_v1(p_option_name text, p_option_source text) = be000f9e6d6e129cb9505b110a1021ed
CREATE OR REPLACE FUNCTION private.feat_runtime_expertise_family_v1(p_option_name text, p_option_source text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when lower(regexp_replace(coalesce(p_option_name,''),'[^a-zA-Z0-9]+','','g'))='echoingsoul' and upper(coalesce(p_option_source,''))='RHW' then 'echoing-soul'
    when lower(regexp_replace(coalesce(p_option_name,''),'[^a-zA-Z0-9]+','','g'))='zhentarimtactics' and upper(coalesce(p_option_source,''))='FRHOF' then 'zhentarim-tactics'
    else null
  end;
$function$;

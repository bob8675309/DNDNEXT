-- Aggregate post-rest runtime choices without changing any character state.
-- Temporary rest-cycle benefits are separated from persistent choices whose current
-- benefit remains active and from optional post-rest actions.

create or replace function private.safe_character_runtime_profile_v1(p_function text,p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_result jsonb;
  v_allowed constant text[]:=array[
    'get_character_astral_trance_v1','get_character_bestial_soul_v1','get_character_circle_land_v1','get_character_eladrin_trance_v1','get_character_githyanki_astral_knowledge_v1','get_character_feat_runtime_expertise_v1','get_character_fiendish_resilience_v1','get_character_whispers_of_the_dead_v1','get_character_wild_heart_aspect_v1','get_character_hunter_prey_v1','get_character_defensive_tactics_v1','get_character_armorer_armor_model_v1','get_character_dread_allegiance_v1','get_character_eladrin_season_v1','get_character_khoravar_skill_versatility_v1','get_character_species_replaceable_cantrip_v1','get_character_weapon_mastery_v1','get_character_weapon_master_feat_v1','get_character_boon_energy_resistance_v1','get_character_cartomancer_v1','get_character_wizard_memorize_spell_v1','get_character_wizard_cantrip_formulas_v1'
  ];
begin
  if not p_function=any(v_allowed) then raise exception 'Unsupported runtime profile getter.'; end if;
  begin
    execute format('select public.%I($1)',p_function) into v_result using p_character_id;
  exception when others then
    return null;
  end;
  return v_result;
end;
$$;

create or replace function public.get_character_pending_rest_choices_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_needs jsonb:='[]'::jsonb;
  v_optional jsonb:='[]'::jsonb;
  v_actions jsonb:='[]'::jsonb;
  v_profile jsonb;
  v_instance jsonb;
  v_latest_rest_type text;
  v_latest_rest_at timestamptz;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review post-rest choices for this character.' using errcode='42501';
  end if;
  select rest_type,completed_at into v_latest_rest_type,v_latest_rest_at from public.character_rest_log where character_id=p_character_id order by completed_at desc,id desc limit 1;

  v_profile:=private.safe_character_runtime_profile_v1('get_character_astral_trance_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canConfigure')::boolean,false) then
    v_needs:=v_needs||jsonb_build_array(jsonb_build_object('featureKey','astral-trance','featureName','Astral Trance','source','AAG','cadence','long_rest','kind','temporary','restType','long_rest','message','No Astral Trance proficiencies are active for the current Long-Rest cycle. Choose one skill and one weapon or tool proficiency.'));
  end if;
  v_profile:=private.safe_character_runtime_profile_v1('get_character_bestial_soul_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canConfigure')::boolean,false) and not coalesce((v_profile->>'active')::boolean,false) then
    v_needs:=v_needs||jsonb_build_array(jsonb_build_object('featureKey','barbarian-beast-bestial-soul','featureName','Bestial Soul','source','TCE','cadence','short_or_long_rest','kind','temporary','restType','short_or_long_rest','message','The previous Bestial Soul adaptation ended at the latest Short or Long Rest. Choose the adaptation for this rest cycle.'));
  end if;
  v_profile:=private.safe_character_runtime_profile_v1('get_character_circle_land_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canConfigure')::boolean,false) then
    v_needs:=v_needs||jsonb_build_array(jsonb_build_object('featureKey','circle-of-the-land','featureName','Circle Spells','source','XPHB','cadence','long_rest','kind','temporary','restType','long_rest','message','The prior Circle Spells land package ended at the latest Long Rest. Choose the land package for this rest cycle.'));
  end if;
  v_profile:=private.safe_character_runtime_profile_v1('get_character_eladrin_trance_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canConfigure')::boolean,false) then
    v_needs:=v_needs||jsonb_build_array(jsonb_build_object('featureKey','eladrin-trance-training','featureName','Eladrin Trance Training','source','MPMM','cadence','long_rest','kind','temporary','restType','long_rest','message','The previous Trance training proficiencies ended at the latest Long Rest. Choose two weapon or tool proficiencies for this rest cycle.'));
  end if;
  v_profile:=private.safe_character_runtime_profile_v1('get_character_githyanki_astral_knowledge_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canConfigure')::boolean,false) then
    v_needs:=v_needs||jsonb_build_array(jsonb_build_object('featureKey','githyanki-astral-knowledge','featureName','Astral Knowledge','source','MPMM','cadence','long_rest','kind','temporary','restType','long_rest','message','The previous Astral Knowledge proficiencies ended at the latest Long Rest. Choose the proficiencies for this rest cycle.'));
  end if;

  v_profile:=private.safe_character_runtime_profile_v1('get_character_feat_runtime_expertise_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) then
    for v_instance in select value from jsonb_array_elements(coalesce(v_profile->'instances','[]'::jsonb)) loop
      if coalesce(v_instance->>'family','')='zhentarim-tactics' and coalesce((v_instance->>'canConfigure')::boolean,false) then
        v_needs:=v_needs||jsonb_build_array(jsonb_build_object('featureKey',v_instance->>'featureKey','featureName',coalesce(v_instance->>'name','Zhentarim Tactics Expertise'),'source',coalesce(v_instance->>'source',''),'cadence','long_rest','kind','temporary','restType','long_rest','message','The previous temporary Expertise ended at the latest Long Rest. Choose an eligible proficient skill for this rest cycle.'));
      elsif coalesce(v_instance->>'family','')='echoing-soul' and coalesce((v_instance->>'canReplace')::boolean,false) then
        v_optional:=v_optional||jsonb_build_array(jsonb_build_object('featureKey',v_instance->>'featureKey','featureName',coalesce(v_instance->>'name','Echoing Soul Expertise'),'source',coalesce(v_instance->>'source',''),'cadence','long_rest','kind','persistent','message','Your current Expertise remains active. The latest Long Rest unlocked an optional replacement.'));
      end if;
    end loop;
  end if;

  v_profile:=private.safe_character_runtime_profile_v1('get_character_fiendish_resilience_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) then
    if not coalesce((v_profile->>'configured')::boolean,false) and coalesce((v_profile->>'canConfigure')::boolean,false) then
      v_needs:=v_needs||jsonb_build_array(jsonb_build_object('featureKey','fiendish-resilience','featureName','Fiendish Resilience','source','XPHB','cadence','short_or_long_rest','kind','initial_rest_choice','restType','short_or_long_rest','message','Fiendish Resilience has no active damage resistance yet. The latest qualifying rest unlocked the initial choice.'));
    elsif coalesce((v_profile->>'configured')::boolean,false) and coalesce((v_profile->>'canReplace')::boolean,false) then
      v_optional:=v_optional||jsonb_build_array(jsonb_build_object('featureKey','fiendish-resilience','featureName','Fiendish Resilience','source','XPHB','cadence','short_or_long_rest','kind','persistent','message','Your current resistance remains active. The latest Short or Long Rest unlocked an optional replacement.'));
    end if;
  end if;

  v_profile:=private.safe_character_runtime_profile_v1('get_character_whispers_of_the_dead_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) then
    if not coalesce((v_profile->>'configured')::boolean,false) and coalesce((v_profile->>'canConfigure')::boolean,false) then
      v_needs:=v_needs||jsonb_build_array(jsonb_build_object('featureKey','rogue-phantom-whispers-of-the-dead','featureName','Whispers of the Dead','source','TCE','cadence','short_or_long_rest','kind','initial_rest_choice','restType','short_or_long_rest','message','No borrowed proficiency is active yet. The latest qualifying rest unlocked the initial Whispers of the Dead choice.'));
    elsif coalesce((v_profile->>'configured')::boolean,false) and coalesce((v_profile->>'canConfigure')::boolean,false) then
      v_optional:=v_optional||jsonb_build_array(jsonb_build_object('featureKey','rogue-phantom-whispers-of-the-dead','featureName','Whispers of the Dead','source','TCE','cadence','short_or_long_rest','kind','persistent','message','Your borrowed proficiency remains active. The latest Short or Long Rest unlocked an optional replacement.'));
    end if;
  end if;

  v_profile:=private.safe_character_runtime_profile_v1('get_character_wild_heart_aspect_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canReplace')::boolean,false) then v_optional:=v_optional||jsonb_build_array(jsonb_build_object('featureKey','barbarian-wild-heart-aspect-of-the-wilds','featureName','Aspect of the Wilds','source','XPHB','cadence','long_rest','kind','persistent','message','Your current aspect remains active. The latest Long Rest unlocked an optional replacement.')); end if;
  v_profile:=private.safe_character_runtime_profile_v1('get_character_hunter_prey_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canReplace')::boolean,false) then v_optional:=v_optional||jsonb_build_array(jsonb_build_object('featureKey','ranger-hunter-hunters-prey','featureName','Hunter''s Prey','source','XPHB','cadence','short_or_long_rest','kind','persistent','message','Your current Hunter''s Prey remains active. The latest Short or Long Rest unlocked an optional replacement.')); end if;
  v_profile:=private.safe_character_runtime_profile_v1('get_character_defensive_tactics_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canReplace')::boolean,false) then v_optional:=v_optional||jsonb_build_array(jsonb_build_object('featureKey','ranger-hunter-defensive-tactics','featureName','Defensive Tactics','source','XPHB','cadence','short_or_long_rest','kind','persistent','message','Your current Defensive Tactics option remains active. The latest Short or Long Rest unlocked an optional replacement.')); end if;
  v_profile:=private.safe_character_runtime_profile_v1('get_character_armorer_armor_model_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canReplace')::boolean,false) then v_optional:=v_optional||jsonb_build_array(jsonb_build_object('featureKey','artificer-armorer-armor-model','featureName','Armor Model','source',coalesce(v_profile->>'source',''),'cadence','short_or_long_rest','kind','persistent','message','Your current Armor Model remains active. The latest Short or Long Rest unlocked an optional replacement while Smith''s Tools are available.')); end if;
  v_profile:=private.safe_character_runtime_profile_v1('get_character_dread_allegiance_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canReplace')::boolean,false) then v_optional:=v_optional||jsonb_build_array(jsonb_build_object('featureKey','dread-allegiance','featureName','Dread Allegiance','source','XPHB','cadence','long_rest','kind','persistent','message','Your current allegiance remains active. The latest Long Rest unlocked an optional replacement.')); end if;
  v_profile:=private.safe_character_runtime_profile_v1('get_character_eladrin_season_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canReplace')::boolean,false) then v_optional:=v_optional||jsonb_build_array(jsonb_build_object('featureKey','eladrin-season','featureName','Eladrin Season','source','MPMM','cadence','long_rest','kind','persistent','message','Your current season remains active. The latest Long Rest unlocked an optional replacement.')); end if;
  v_profile:=private.safe_character_runtime_profile_v1('get_character_khoravar_skill_versatility_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canReplace')::boolean,false) then v_optional:=v_optional||jsonb_build_array(jsonb_build_object('featureKey','khoravar-skill-versatility','featureName','Skill Versatility','source','EFA','cadence','long_rest','kind','persistent','message','Your current proficiency remains active. The latest Long Rest unlocked an optional replacement.')); end if;
  v_profile:=private.safe_character_runtime_profile_v1('get_character_species_replaceable_cantrip_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canReplace')::boolean,false) then v_optional:=v_optional||jsonb_build_array(jsonb_build_object('featureKey',coalesce(v_profile->>'featureKey','species-replaceable-cantrip'),'featureName',coalesce(v_profile->>'featureName','Species Cantrip'),'source',coalesce(v_profile->>'source',''),'cadence','long_rest','kind','persistent','message','Your current cantrip remains active. The latest Long Rest unlocked an optional replacement.')); end if;
  v_profile:=private.safe_character_runtime_profile_v1('get_character_weapon_mastery_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canReplaceOne')::boolean,false) then v_optional:=v_optional||jsonb_build_array(jsonb_build_object('featureKey','class-weapon-mastery','featureName','Weapon Mastery','source','XPHB','cadence','long_rest','kind','persistent','message','Your current weapon masteries remain active. The latest Long Rest unlocked one optional weapon-kind replacement.')); end if;

  v_profile:=private.safe_character_runtime_profile_v1('get_character_weapon_master_feat_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) then for v_instance in select value from jsonb_array_elements(coalesce(v_profile->'instances','[]'::jsonb)) loop if coalesce((v_instance->>'canReplaceOne')::boolean,false) then v_optional:=v_optional||jsonb_build_array(jsonb_build_object('featureKey',v_instance->>'featureKey','featureName','Weapon Master','source','XPHB','cadence','long_rest','kind','persistent','message','This Weapon Master feat instance keeps its current mastery. The latest Long Rest unlocked one optional replacement.')); end if; end loop; end if;
  v_profile:=private.safe_character_runtime_profile_v1('get_character_boon_energy_resistance_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) then for v_instance in select value from jsonb_array_elements(coalesce(v_profile->'instances','[]'::jsonb)) loop if coalesce((v_instance->>'canReplace')::boolean,false) then v_optional:=v_optional||jsonb_build_array(jsonb_build_object('featureKey',v_instance->>'featureKey','featureName','Boon of Energy Resistance','source','XPHB','cadence','long_rest','kind','persistent','message','Your two current resistances remain active. The latest Long Rest unlocked an optional replacement of the pair.')); end if; end loop; end if;

  v_profile:=private.safe_character_runtime_profile_v1('get_character_cartomancer_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canConfigureHiddenAce')::boolean,false) then v_actions:=v_actions||jsonb_build_array(jsonb_build_object('featureKey','cartomancer-hidden-ace','featureName','Cartomancer — Hidden Ace','source','BMT','cadence','long_rest','kind','post_rest_action','message','A recent Long Rest opened the Hidden Ace imbue window. This is optional and expires eight hours after that rest.')); end if;
  v_profile:=private.safe_character_runtime_profile_v1('get_character_wizard_memorize_spell_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canConfigure')::boolean,false) then v_actions:=v_actions||jsonb_build_array(jsonb_build_object('featureKey','wizard-memorize-spell','featureName','Memorize Spell','source','XPHB','cadence','short_rest','kind','post_rest_action','message','The latest qualifying Short Rest allows one optional prepared-spell swap.')); end if;
  v_profile:=private.safe_character_runtime_profile_v1('get_character_wizard_cantrip_formulas_v1',p_character_id);
  if coalesce((v_profile->>'available')::boolean,false) and coalesce((v_profile->>'canConfigure')::boolean,false) then v_actions:=v_actions||jsonb_build_array(jsonb_build_object('featureKey','wizard-cantrip-formulas','featureName','Cantrip Formulas','source','TCE','cadence','long_rest','kind','post_rest_action','message','The latest qualifying Long Rest allows one optional Wizard cantrip replacement.')); end if;

  return jsonb_build_object('characterId',p_character_id,'latestRestType',v_latest_rest_type,'latestRestAt',v_latest_rest_at,'needsSelection',v_needs,'optionalChanges',v_optional,'availableActions',v_actions,'needsSelectionCount',jsonb_array_length(v_needs),'optionalChangeCount',jsonb_array_length(v_optional),'availableActionCount',jsonb_array_length(v_actions),'hasAttention',jsonb_array_length(v_needs)>0,'hasAnyPostRestChoice',jsonb_array_length(v_needs)+jsonb_array_length(v_optional)+jsonb_array_length(v_actions)>0);
end;
$$;

revoke all on function private.safe_character_runtime_profile_v1(text,uuid) from public,anon,authenticated;
grant execute on function private.safe_character_runtime_profile_v1(text,uuid) to service_role;
revoke all on function public.get_character_pending_rest_choices_v1(uuid) from public,anon;
grant execute on function public.get_character_pending_rest_choices_v1(uuid) to authenticated,service_role;

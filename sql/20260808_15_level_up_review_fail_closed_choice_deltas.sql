-- Fold the v3 persistent-choice gap guard into the existing review RPC so old
-- callers cannot bypass it.  This protects cumulative source choices (for
-- example Warlock invocation count increases) until their shared delta payload
-- is fully materialized by progression v3.

create or replace function public.begin_character_level_up_v1(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_current public.class_level_progression%rowtype;
  v_next public.class_level_progression%rowtype;
  v_session public.character_level_up_sessions%rowtype;
  v_required jsonb := '[]'::jsonb;
  v_preview jsonb;
  v_metadata_ready boolean;
  v_spell_metadata_ready boolean := true;
  v_created boolean := false;
  v_new_cantrips integer := 0;
  v_new_leveled integer := 0;
  v_highest_spell_level integer := 0;
  v_unsupported jsonb := '[]'::jsonb;
  v_persistent_gaps jsonb := '[]'::jsonb;
  v_requires_subclass boolean := false;
  v_requires_advancement boolean := false;
  v_requires_epic boolean := false;
  v_blocked_reason text;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to level this character.' using errcode='42501'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if v_progression.character_id is null then raise exception 'Character progression has not been initialized.' using errcode='P0002'; end if;
  if v_progression.class_level>=20 then raise exception 'This character is already level 20.'; end if;
  if not v_progression.pending_level_up then raise exception 'The XP threshold for the next level has not been reached.'; end if;

  select * into v_class from public.class_catalog where id=v_progression.class_id;
  select * into v_current from public.class_level_progression where class_id=v_progression.class_id and class_level=v_progression.class_level;
  select * into v_next from public.class_level_progression where class_id=v_progression.class_id and class_level=v_progression.class_level+1;
  if v_next.class_id is null then raise exception 'Next-level progression metadata is unavailable.' using errcode='P0002'; end if;

  v_new_cantrips:=greatest(0,coalesce(v_next.cantrips_known,0)-coalesce(v_current.cantrips_known,0));
  if v_class.class_key='wizard' then
    v_new_leveled:=2;
  elsif v_class.spellcasting_ability is not null then
    if v_current.spells_known is null or v_next.spells_known is null then v_spell_metadata_ready:=false; v_new_leveled:=0;
    else v_new_leveled:=greatest(0,v_next.spells_known-v_current.spells_known); end if;
  end if;
  v_highest_spell_level:=private.highest_spell_level_from_slots_v1(v_next.spell_slots);
  v_requires_subclass:=v_next.class_level=3 and nullif(btrim(coalesce(v_progression.subclass_name,'')),'') is null;
  v_requires_advancement:=private.level_has_feature_v1(v_next.features,'Ability Score Improvement');
  v_requires_epic:=private.level_has_feature_v1(v_next.features,'Epic Boon');
  v_unsupported:=private.unsupported_level_choice_features_v1(v_next.features);
  if v_requires_epic and jsonb_array_length(v_unsupported)=1 and lower(v_unsupported->>0)='epic boon' then v_unsupported:='[]'::jsonb; end if;
  v_persistent_gaps:=private.level_up_persistent_choice_gaps_v1(v_class.class_key,v_class.source,v_progression.class_level,v_progression.class_level+1);

  v_required:=v_required||jsonb_build_array(jsonb_build_object('key','hp_method','type','single','label','Hit Point Increase','options',jsonb_build_array('fixed','roll'),'required',true,'hitDie',v_class.hit_die));
  if v_requires_subclass then v_required:=v_required||jsonb_build_array(jsonb_build_object('key','subclass_name','type','text','label','Subclass','required',true)); end if;
  if v_requires_advancement or v_requires_epic then
    v_required:=v_required||jsonb_build_array(jsonb_build_object('key','advancement','type',case when v_requires_epic then 'epic_boon_or_feat' else 'asi_or_feat' end,'label',case when v_requires_epic then 'Epic Boon or General Feat' else 'Ability Score Improvement or Feat' end,'required',true));
  end if;
  if v_new_cantrips>0 or v_new_leveled>0 then
    v_required:=v_required||jsonb_build_array(jsonb_build_object('key','spell_choices','type','spells','label','New Class Spells','required',true,'cantrips',v_new_cantrips,'leveled',v_new_leveled,'highestSpellLevel',v_highest_spell_level));
  end if;

  v_metadata_ready:=public.is_preferred_class_version_v1(v_class.id)
    and coalesce(v_next.raw_payload->>'source','')='5etools_class_progression'
    and v_spell_metadata_ready
    and jsonb_array_length(v_unsupported)=0
    and jsonb_array_length(v_persistent_gaps)=0;

  if jsonb_array_length(v_persistent_gaps)>0 then
    v_blocked_reason:='This level has persistent class choices that are being migrated to the shared progression resolver: '
      ||(select string_agg(value,', ') from jsonb_array_elements_text(v_persistent_gaps));
  elsif not v_spell_metadata_ready then
    v_blocked_reason:='Refresh the reviewed 2024 class metadata so prepared/known spell progression is available.';
  elsif jsonb_array_length(v_unsupported)>0 then
    v_blocked_reason:='This level has class-specific choices that are not modeled yet: '||(select string_agg(value,', ') from jsonb_array_elements_text(v_unsupported));
  elsif not v_metadata_ready then
    v_blocked_reason:='Reviewed 2024 class metadata is required before this level can be applied.';
  end if;

  v_preview:=jsonb_build_object(
    'classKey',v_class.class_key,'className',v_class.class_name,'source',v_class.source,'ruleset',v_class.ruleset,
    'fromLevel',v_progression.class_level,'toLevel',v_progression.class_level+1,'xp',v_progression.experience_points,'requiredXp',v_next.xp_threshold,
    'proficiencyBonus',v_next.proficiency_bonus,'cantripsKnown',v_next.cantrips_known,'spellsKnown',v_next.spells_known,'spellSlots',v_next.spell_slots,
    'highestSpellLevel',v_highest_spell_level,'newCantrips',v_new_cantrips,'newLeveledSpells',v_new_leveled,'features',v_next.features,
    'choices',v_required,'unsupportedChoices',v_unsupported,'persistentChoiceGaps',v_persistent_gaps,
    'metadataReady',v_metadata_ready,'blockedReason',v_blocked_reason
  );

  select * into v_session from public.character_level_up_sessions where character_id=p_character_id and status='open' for update;
  if v_session.id is null then
    insert into public.character_level_up_sessions(character_id,from_level,to_level,status,metadata_ready,required_choices,selections,preview,created_by)
    values(p_character_id,v_progression.class_level,v_progression.class_level+1,'open',v_metadata_ready,v_required,'{}'::jsonb,v_preview,auth.uid())
    returning * into v_session;
    v_created:=true;
  else
    update public.character_level_up_sessions
    set from_level=v_progression.class_level,to_level=v_progression.class_level+1,metadata_ready=v_metadata_ready,required_choices=v_required,preview=v_preview,updated_at=now()
    where id=v_session.id returning * into v_session;
  end if;

  if v_created then
    insert into public.character_level_events(character_id,event_type,from_level,to_level,xp_before,xp_after,details,created_by)
    values(p_character_id,'level_up_review_started',v_progression.class_level,v_progression.class_level+1,v_progression.experience_points,v_progression.experience_points,
      jsonb_build_object('sessionId',v_session.id,'source',v_class.source,'metadataReady',v_metadata_ready,'persistentChoiceGaps',v_persistent_gaps),auth.uid());
  end if;

  return jsonb_build_object('session',to_jsonb(v_session),'preview',v_preview,'metadataReady',v_metadata_ready,'canComplete',v_metadata_ready,
    'message',case when v_metadata_ready then 'All required choices in this level are supported and can be applied transactionally.' else v_blocked_reason end);
end;
$function$;

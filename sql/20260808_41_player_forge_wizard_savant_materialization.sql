-- Materialize higher-level Player Forge Wizard Savant spellbook choices into the
-- same class-feature spellbook provenance used by earned progression.
--
-- The current Forge UI serializes Savant cumulatively: two entry selections plus
-- one additional selection for each higher Wizard spell-slot level reached. This
-- trigger validates the chronology server-side before creating spellbook rows.

create or replace function private.player_forge_wizard_savant_expected_count_v1(
  p_class_id uuid,
  p_class_level integer
)
returns integer
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_slots jsonb:='[]'::jsonb;
  v_max integer:=0;
begin
  select coalesce(p.spell_slots,'[]'::jsonb) into v_slots
  from public.class_level_progression p
  join public.class_catalog c on c.id=p.class_id
  where p.class_id=p_class_id
    and p.class_level=greatest(1,least(20,coalesce(p_class_level,1)))
    and lower(coalesce(c.class_key,''))='wizard'
    and upper(coalesce(c.source,''))='XPHB';
  if not found then return 0; end if;
  v_max:=private.highest_spell_level_from_slots_v1(v_slots);
  if greatest(1,least(20,coalesce(p_class_level,1)))<3 then return 0; end if;
  return greatest(2,v_max);
end;
$$;

create or replace function private.materialize_player_forge_wizard_savant_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_school text;
  v_expected integer:=0;
  v_group_count integer:=0;
  v_selected jsonb:='[]'::jsonb;
  v_choice jsonb;
  v_spell public.spells_catalog%rowtype;
  v_resolved jsonb:='[]'::jsonb;
  v_slot integer:=0;
  v_slot_cap integer:=0;
  v_granted_level integer:=0;
  v_source_key text;
  v_feature_name text;
  v_cantrip_count integer:=0;
  v_distinct_count integer:=0;
  v_class_key text;
  v_class_source text;
begin
  select coalesce(cs.sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets cs
  where cs.character_id=new.character_id;

  if coalesce(v_sheet#>>'{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;

  select lower(coalesce(c.class_key,'')),upper(coalesce(c.source,''))
  into v_class_key,v_class_source
  from public.class_catalog c where c.id=new.class_id;
  if coalesce(v_class_key,'')<>'wizard' or coalesce(v_class_source,'')<>'XPHB' then return new; end if;

  v_school:=private.wizard_savant_school_v1(new.subclass_name);
  if v_school is null then return new; end if;

  v_expected:=private.player_forge_wizard_savant_expected_count_v1(new.class_id,new.class_level);
  if v_expected<2 then raise exception 'XPHB Wizard Savant Forge materialization requires Wizard level 3 or higher.'; end if;
  v_feature_name:=v_school||' Savant';

  select count(*),coalesce(jsonb_agg(sel.value order by grp.key,sel.ord),'[]'::jsonb)
  into v_group_count,v_selected
  from jsonb_each(case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end) grp
  cross join lateral jsonb_array_elements(case when jsonb_typeof(grp.value->'selections')='array' then grp.value->'selections' else '[]'::jsonb end) with ordinality sel(value,ord)
  where grp.value->>'kind'='spell'
    and private.normalize_player_choice_name_v1(coalesce(grp.value->>'sourceFeature',''))=private.normalize_player_choice_name_v1(v_feature_name)
    and private.normalize_player_choice_name_v1(coalesce(grp.value->>'subclassName',new.subclass_name,''))=private.normalize_player_choice_name_v1(new.subclass_name);

  -- The current Forge represents each Savant family as one cumulative group.
  select count(*) into v_group_count
  from jsonb_each(case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end) grp
  where grp.value->>'kind'='spell'
    and private.normalize_player_choice_name_v1(coalesce(grp.value->>'sourceFeature',''))=private.normalize_player_choice_name_v1(v_feature_name)
    and private.normalize_player_choice_name_v1(coalesce(grp.value->>'subclassName',new.subclass_name,''))=private.normalize_player_choice_name_v1(new.subclass_name);

  if v_group_count<>1 then
    raise exception '% Player Forge requires exactly one cumulative Savant choice group; found %.',v_feature_name,v_group_count;
  end if;
  if jsonb_array_length(v_selected)<>v_expected then
    raise exception '% Wizard level % requires exactly % cumulative Savant spellbook choice(s); received %.',v_feature_name,new.class_level,v_expected,jsonb_array_length(v_selected);
  end if;

  for v_choice in select value from jsonb_array_elements(v_selected) loop
    if nullif(v_choice#>>'{spell,id}','') is null then
      raise exception '% Forge selections must include canonical spell ids.',v_feature_name;
    end if;
    begin
      select * into v_spell from public.spells_catalog_preferred where id=(v_choice#>>'{spell,id}')::uuid;
    exception when others then
      raise exception '% contains an invalid canonical spell id.',v_feature_name;
    end;
    if not found
       or v_spell.school<>v_school
       or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) listed where lower(listed)='wizard') then
      raise exception '% contains a spell that is not a source-legal % Wizard spell.',v_feature_name,v_school;
    end if;
    v_resolved:=v_resolved||jsonb_build_array(jsonb_build_object(
      'id',v_spell.id,'name',v_spell.name,'source',v_spell.source,'level',v_spell.level,'school',v_spell.school
    ));
  end loop;

  select count(distinct entry.value->>'id'),count(*) filter(where coalesce((entry.value->>'level')::integer,0)=0)
  into v_distinct_count,v_cantrip_count
  from jsonb_array_elements(v_resolved) entry(value);
  if v_distinct_count<>v_expected then raise exception '% spellbook choices must be distinct.',v_feature_name; end if;
  if v_cantrip_count>2 then raise exception '% can include cantrips only among its two level-3 entry selections.',v_feature_name; end if;

  -- Sort by spell level so the selected set is assigned to the earliest legal
  -- acquisition slots. Slot caps are 2,2,3,4,5,6,7,8,9.
  for v_choice in
    select value
    from jsonb_array_elements(v_resolved)
    order by coalesce((value->>'level')::integer,0),value->>'name',value->>'id'
  loop
    v_slot:=v_slot+1;
    v_slot_cap:=case when v_slot<=2 then 2 else v_slot end;
    if coalesce((v_choice->>'level')::integer,0)>v_slot_cap then
      raise exception '% selection % cannot fit its historical acquisition slots: Savant slot % allows spell level % or lower.',v_feature_name,v_choice->>'name',v_slot,v_slot_cap;
    end if;
    if v_slot>2 and coalesce((v_choice->>'level')::integer,0)<1 then
      raise exception '% later spellbook additions must be leveled spells because they require a spell-slot level.',v_feature_name;
    end if;

    v_granted_level:=case when v_slot<=2 then 3 else (v_slot*2)-1 end;
    if v_granted_level>new.class_level then
      raise exception '% contains a spellbook selection from future Wizard level %.',v_feature_name,v_granted_level;
    end if;
    v_source_key:=case when v_slot<=2
      then 'wizard-'||lower(v_school)||'-savant'
      else 'wizard-'||lower(v_school)||'-savant-level-'||v_granted_level::text end;

    if private.wizard_spellbook_has_spell_v1(new.character_id,(v_choice->>'id')::uuid) then
      raise exception '% is already in this Wizard spellbook and cannot also be granted by %.',v_choice->>'name',v_feature_name;
    end if;

    insert into public.character_spells(
      character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,raw_payload
    ) values(
      new.character_id,(v_choice->>'id')::uuid,'class-feature',v_source_key,v_feature_name,
      true,false,false,'int',jsonb_build_object(
        'creator','player-forge-savant-v1',
        'wizardSpellbook',true,
        'feature',v_feature_name,
        'school',v_school,
        'grantedAtLevel',v_granted_level,
        'startingLevel',new.class_level,
        'acquisitionSlot',v_slot
      )
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists character_progression_materialize_player_forge_wizard_savant_v1 on public.character_progression;
create constraint trigger character_progression_materialize_player_forge_wizard_savant_v1
after insert on public.character_progression
deferrable initially deferred
for each row execute function private.materialize_player_forge_wizard_savant_v1();

revoke all on function private.player_forge_wizard_savant_expected_count_v1(uuid,integer) from public,anon,authenticated;
revoke all on function private.materialize_player_forge_wizard_savant_v1() from public,anon,authenticated;
grant execute on function private.player_forge_wizard_savant_expected_count_v1(uuid,integer) to service_role;
grant execute on function private.materialize_player_forge_wizard_savant_v1() to service_role;

-- EXPERIMENTAL internal rule primitive: not a migration for live Supabase.
-- Used by independently reviewed attack-roll and saving-throw cantrip adapters.
-- Only sourced, currently known XPHB Warlock damaging cantrips may receive it.
create or replace function private.encounter_warlock_agonizing_bonus_candidate_v1(
  p_character_id uuid, p_spell_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $agonizing$
declare
  v_spell_key text;
  v_level integer;
  v_cantrip_eligible boolean:=false;
  v_selected boolean:=false;
  v_score integer;
  v_modifier integer:=0;
begin
  if p_character_id is null or p_spell_id is null then
    raise exception 'Character and catalog spell id required' using errcode='22023';
  end if;
  -- Check the character's class-sourced Warlock assignment and canonical
  -- spell eligibility, not a caller-supplied label or free-form bonus.
  select s.spell_key,cp.class_level,
      s.source='XPHB' and s.level=0
      and coalesce(cardinality(s.damage_types),0)>0
      and exists (
        select 1 from unnest(coalesce(s.classes,'{}'::text[])) as cls
        where lower(cls)='warlock'
      )
    into v_spell_key,v_level,v_cantrip_eligible
  from public.character_spells cs
  join public.spells_catalog s on s.id=cs.spell_id
  join public.character_progression cp on cp.character_id=cs.character_id
  where cs.character_id=p_character_id and cs.spell_id=p_spell_id
    and lower(coalesce(cs.source_type,''))='class'
    and lower(coalesce(cs.source_label,''))='warlock'
    and coalesce(cs.known,false)
  limit 1;
  if not found or not coalesce(v_cantrip_eligible,false)
     or coalesce(v_level,0)<2 then
    return jsonb_build_object('applies',false,'damageModifier',0,
      'featureKey','optional-feature:agonizing-blast|XPHB',
      'spellKey',v_spell_key,'eligibleWarlockCantrip',false);
  end if;

  -- A repeatable invocation may select different cantrips. Several rows
  -- selecting the SAME cantrip do not stack the same modifier repeatedly.
  select exists (
    select 1 from public.character_class_option_grant_instances grant_row
    join public.class_feature_option_catalog catalog
      on catalog.id=grant_row.option_catalog_id
    where grant_row.character_id=p_character_id
      and lower(grant_row.option_type)='eldritch-invocation'
      and lower(catalog.option_key)='optional-feature:agonizing-blast|xphb'
      and catalog.source='XPHB'
      and grant_row.acquired_level<=v_level
      and lower(coalesce(grant_row.choices#>>'{child,metadata,spellKey}',''))
          =lower(v_spell_key)
  ) into v_selected;
  if v_selected then
    v_score:=private.encounter_ability_score_v1(p_character_id,'cha');
    if v_score is null or v_score<1 or v_score>30 then
      raise exception 'Canonical Charisma score not available' using errcode='22023';
    end if;
    v_modifier:=floor((v_score-10)/2.0)::integer;
  end if;
  return jsonb_build_object('applies',v_selected,
    'damageModifier',v_modifier,'eligibleWarlockCantrip',true,
    'featureKey','optional-feature:agonizing-blast|XPHB',
    'spellKey',v_spell_key,'castingAbility','cha',
    'stacking','one_modifier_per_damage_roll');
end;
$agonizing$;
-- Private, unexposed SQL remains non-callable by PostgREST roles.
revoke all on function private.encounter_warlock_agonizing_bonus_candidate_v1(uuid,uuid)
  from public,anon,authenticated,service_role;

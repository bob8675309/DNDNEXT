-- Shadow-only comparison against the actual current tactical weapon profile.
-- Existing encounter profile and attack damage writer are NOT replaced.
-- Trusted input: server encounter participant + equipped inventory UUID.
-- OFF returns the exact original profile. ON filters item magical bonus
-- and recomputes STR/DEX from the prior server-derived ability shadow.
create or replace function private.encounter_attuned_weapon_profile_shadow_v1(
 p_participant_id uuid,p_inventory_item_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $shadow$
declare
 v_p public.encounter_participants%rowtype;
 v_item public.inventory_items%rowtype;
 v_baseline jsonb;
 v_profile jsonb;
 v_ability_result jsonb;
 v_effects jsonb;
 v_gate jsonb;
 v_source jsonb;
 v_catalog jsonb:='{}'::jsonb;
 v_payload jsonb;
 v_bonus_key text;
 v_bonus_raw text;
 v_str_mod integer;
 v_dex_mod integer;
 v_ability text;
 v_mod integer;
 v_magic integer;
 v_old_magic integer;
 v_old_ability_mod integer;
 v_attack integer;
 v_damage_flat integer;
 v_source_eligible boolean;
 v_channel_reason text;
 v_unresolved jsonb:='[]'::jsonb;
begin
 select * into v_p from public.encounter_participants p where p.id=p_participant_id;
 if not found then return null; end if;
 v_baseline:=public.encounter_weapon_profile_internal_v1(p_participant_id,p_inventory_item_id);
 if v_baseline is null then return null; end if;
 v_ability_result:=private.character_attuned_ability_shadow_v1(v_p.character_id);
 if v_ability_result->>'attunementEnabled'='false' then
   return jsonb_build_object('schemaVersion',1,'consumerEnforced',false,
     'attunementEnabled',false,'baseline',v_baseline,'shadow',v_baseline,
     'wouldChange',false,'weaponSourceParityReady',false,
     'unresolvedChannels','[]'::jsonb);
 end if;
 if v_ability_result->>'attunementEnabled' is distinct from 'true' then
   raise exception 'Missing authoritative attunement state' using errcode='22023';
 end if;
 v_gate:=private.character_magic_effect_source_gate_shadow_v1(v_p.character_id);
 select value into v_source from jsonb_array_elements(v_gate->'items')
   where value->>'inventoryItemId'=p_inventory_item_id::text limit 1;
 if v_source is null then
   raise exception 'Weapon profile source is missing from trusted inventory gate'
     using errcode='22023';
 end if;
 select * into strict v_item from public.inventory_items i
   where i.id=p_inventory_item_id and i.is_equipped is true;
 select coalesce(ic.payload,'{}'::jsonb) into v_catalog
 from public.items_catalog ic
 where ic.item_key=coalesce(v_item.card_payload->>'item_key',
       v_item.card_payload->>'item_id',v_item.item_id)
    or ic.item_key=v_item.item_id
    or lower(ic.item_name)=lower(v_item.item_name)
 order by
   case when ic.item_key=coalesce(v_item.card_payload->>'item_key',
           v_item.card_payload->>'item_id',v_item.item_id) then 0
        when ic.item_key=v_item.item_id then 1 else 2 end,
   case when coalesce(ic.payload->>'edition','')='one' then 0 else 1 end
 limit 1;
 v_payload:=coalesce(v_catalog,'{}'::jsonb) || coalesce(v_item.card_payload,'{}'::jsonb);
 v_source_eligible:=coalesce((v_source->>'magicRiderEligible')::boolean,false);
 v_old_magic:=coalesce((v_baseline->>'magicBonus')::integer,0);
 v_old_ability_mod:=coalesce((v_baseline->>'abilityMod')::integer,0);
 v_magic:=v_old_magic;
 v_bonus_key:=case
   when v_payload ? 'bonusWeapon' and v_payload->>'bonusWeapon' is not null then 'bonusWeapon'
   when v_payload ? 'bonus_weapon' and v_payload->>'bonus_weapon' is not null then 'bonus_weapon'
   when v_payload ? 'enhancement_bonus' and v_payload->>'enhancement_bonus' is not null then 'enhancement_bonus'
   when v_payload ? 'smith_tier' and v_payload->>'smith_tier' is not null then 'smith_tier'
   else null end;
 v_bonus_raw:=coalesce(v_payload->>v_bonus_key,'0');
 if v_bonus_key in ('bonusWeapon','bonus_weapon','enhancement_bonus') then
   v_channel_reason:='explicit_weapon_bonus';
   if not v_source_eligible then v_magic:=0; end if;
 elsif v_bonus_key='smith_tier' then
   -- Tempering may be a physical upgrade, not automatically a magical rider.
   v_channel_reason:='smith_tier_unclassified';
   v_unresolved:=v_unresolved||'"smith_tier_physical_or_magic_unknown"'::jsonb;
 else
   v_channel_reason:='no_weapon_bonus';
 end if;
 v_effects:=v_ability_result->'shadow';
 v_str_mod:=coalesce((v_effects#>>'{abilities,str,effectiveMod}')::integer,0);
 v_dex_mod:=coalesce((v_effects#>>'{abilities,dex,effectiveMod}')::integer,0);
 v_ability:=case
   when coalesce((v_baseline->>'isRanged')::boolean,false) then 'dex'
   when coalesce((v_baseline->>'isFinesse')::boolean,false) and v_dex_mod>v_str_mod then 'dex'
   else 'str' end;
 v_mod:=case when v_ability='dex' then v_dex_mod else v_str_mod end;
 v_attack:=v_mod
   +coalesce((v_baseline->>'proficiencyBonus')::integer,0)
   +v_magic;
 v_damage_flat:=v_mod+v_magic;
 v_profile:=v_baseline
   || jsonb_build_object(
     'ability',v_ability,'abilityMod',v_mod,
     'magicBonus',v_magic,'attackBonus',v_attack);
 -- Existing attack writer adds abilityMod + magicBonus to rolled damage.
 -- No dice, reach, thrown/finesse flag, property, equip slot, crit or
 -- encounter snapshot rows are changed by this comparison.
 if coalesce((v_effects->>'unresolvedAcRule')::text,'')<>'' then
   v_unresolved:=v_unresolved||'"character_custom_ac_needs_review"'::jsonb;
 end if;
 return jsonb_build_object(
   'schemaVersion',1,'consumerEnforced',false,'attunementEnabled',true,
   'baseline',v_baseline,'shadow',v_profile,
   'wouldChange',v_profile is distinct from v_baseline,
   'baselineFlatDamageBonus',v_old_ability_mod+v_old_magic,
   'shadowFlatDamageBonus',v_damage_flat,
   'bonusSourceField',v_bonus_key,
   'bonusSourceChannel',v_channel_reason,
   'magicRiderEligible',v_source_eligible,
   'sourceGate',v_source,
   'weaponSourceParityReady',false,
   'fullEffectConsumerParityReady',false,
   'unresolvedChannels',v_unresolved,
   'attackWriterUnchanged',true
 );
end;
$shadow$;
revoke all on function private.encounter_attuned_weapon_profile_shadow_v1(uuid,uuid)
 from public,anon,authenticated;
grant execute on function private.encounter_attuned_weapon_profile_shadow_v1(uuid,uuid)
 to service_role;
comment on function private.encounter_attuned_weapon_profile_shadow_v1(uuid,uuid) is
'Private read-only shadow of tactical weapon profile. OFF baseline exact, ON source-selected weapon bonus plus effective STR/DEX. No combat writer changes; smith_tier and class exceptions unresolved.';

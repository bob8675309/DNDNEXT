-- Read-only shadow of indirect ability score/modifier contributions.
-- Requires prior _06 AC/save shadow and _04 trusted item source gate.
-- Never alter original equipment, tactical snapshot, or encounter functions.
-- This phase explicitly handles 6 abilities and DEX-dependent armor AC,
-- not source-specific magical armor enhancement or spell/weapon consumers.
create or replace function private.character_attuned_ability_shadow_v1(
 p_character_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $shadow$
declare
 v_previous jsonb;
 v_baseline jsonb;
 v_candidate jsonb;
 v_gate jsonb;
 v_source jsonb;
 v_item public.inventory_items%rowtype;
 v_catalog jsonb;
 v_payload jsonb;
 v_modifiers jsonb;
 v_node jsonb;
 v_abilities jsonb;
 v_entry jsonb;
 v_ac jsonb;
 v_sheet jsonb;
 v_score_removed jsonb:='{"str":0,"dex":0,"con":0,"int":0,"wis":0,"cha":0}'::jsonb;
 v_mod_removed jsonb:='{"str":0,"dex":0,"con":0,"int":0,"wis":0,"cha":0}'::jsonb;
 v_audit jsonb:='[]'::jsonb;
 v_key text;
 v_text text;
 v_number integer;
 v_base integer;
 v_score integer;
 v_score_bonus integer;
 v_mod_bonus integer;
 v_mod integer;
 v_old_dex integer;
 v_new_dex integer;
 v_old_applied integer;
 v_new_applied integer;
 v_delta integer:=0;
 v_category text;
 v_ac_changed boolean:=false;
 v_ac_unresolved_reason text;
begin
 if p_character_id is null then
   raise exception 'Character id is required' using errcode='22023';
 end if;
 v_previous:=private.character_attuned_ac_saves_shadow_v1(p_character_id);
 v_baseline:=v_previous->'baseline';
 v_candidate:=v_previous->'shadow';
 if v_previous->>'attunementEnabled'='false' then
   return jsonb_build_object(
     'schemaVersion',1,'consumerEnforced',false,
     'fullEffectConsumerParityReady',false,
     'attunementEnabled',false,'baseline',v_baseline,'shadow',v_baseline,
     'wouldChange',false,'abilityComparisonComplete',true,
     'acDexRecalculationComplete',true,'unresolvedAcRule',null,
     'suppressedAbilityContributions','[]'::jsonb
   );
 end if;
 if v_previous->>'attunementEnabled' is distinct from 'true' then
   raise exception 'Authoritative attunement state unavailable' using errcode='22023';
 end if;
 v_gate:=v_previous->'sourceGate';
 v_abilities:=coalesce(v_candidate->'abilities','{}'::jsonb);
 if jsonb_typeof(v_abilities)<>'object' then
   raise exception 'Legacy ability result must be an object' using errcode='22023';
 end if;

 for v_source in
   select value from jsonb_array_elements(v_gate->'items')
   where value->>'magicRiderEligible'='false'
   order by value->>'inventoryItemId'
 loop
   select * into strict v_item from public.inventory_items i
     where i.id=(v_source->>'inventoryItemId')::uuid and i.is_equipped is true;
   v_catalog:='{}'::jsonb;
   select coalesce(ic.payload,'{}'::jsonb)
     into v_catalog
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
   v_modifiers:=case when jsonb_typeof(v_payload->'modifiers')='object'
      then v_payload->'modifiers' else '{}'::jsonb end;

   -- Copy the ORIGINAL alias precedence, numeric regex and per-ability sum.
   v_node:=case when jsonb_typeof(v_modifiers->'abilities')='object'
      then v_modifiers->'abilities'
      when jsonb_typeof(v_modifiers->'abilityScores')='object'
      then v_modifiers->'abilityScores' else '{}'::jsonb end;
   for v_key in select unnest(array['str','dex','con','int','wis','cha'])
   loop
     v_text:=nullif(v_node->>v_key,'');
     if v_text is not null and v_text ~ '[-+]?[0-9]+' then
       v_number:=substring(v_text from '[-+]?[0-9]+')::integer;
       v_score_removed:=jsonb_set(v_score_removed,array[v_key],
         to_jsonb((v_score_removed->>v_key)::integer+v_number),true);
     end if;
   end loop;

   v_node:=case when jsonb_typeof(v_modifiers->'abilityMods')='object'
      then v_modifiers->'abilityMods'
      when jsonb_typeof(v_modifiers->'abilityModifiers')='object'
      then v_modifiers->'abilityModifiers' else '{}'::jsonb end;
   for v_key in select unnest(array['str','dex','con','int','wis','cha'])
   loop
     v_text:=nullif(v_node->>v_key,'');
     if v_text is not null and v_text ~ '[-+]?[0-9]+' then
       v_number:=substring(v_text from '[-+]?[0-9]+')::integer;
       v_mod_removed:=jsonb_set(v_mod_removed,array[v_key],
         to_jsonb((v_mod_removed->>v_key)::integer+v_number),true);
     end if;
   end loop;
   v_audit:=v_audit || jsonb_build_array(jsonb_build_object(
     'inventoryItemId',v_item.id,'reason',v_source->>'reason',
     'abilityScoreSource',case when v_modifiers ? 'abilities' then 'abilities'
       when v_modifiers ? 'abilityScores' then 'abilityScores' else null end,
     'abilityModifierSource',case when v_modifiers ? 'abilityMods' then 'abilityMods'
       when v_modifiers ? 'abilityModifiers' then 'abilityModifiers' else null end
   ));
 end loop;

 v_old_dex:=coalesce((v_baseline#>>'{abilities,dex,effectiveMod}')::integer,0);
 for v_key in select unnest(array['str','dex','con','int','wis','cha'])
 loop
   v_entry:=coalesce(v_abilities->v_key,'{}'::jsonb);
   v_base:=coalesce((v_entry->>'base')::integer,10);
   v_score_bonus:=coalesce((v_entry->>'scoreBonus')::integer,0)
                  -(v_score_removed->>v_key)::integer;
   v_mod_bonus:=coalesce((v_entry->>'modBonus')::integer,0)
                -(v_mod_removed->>v_key)::integer;
   v_score:=greatest(1,least(30,v_base+v_score_bonus));
   v_mod:=floor((v_score-10)/2.0)::integer+v_mod_bonus;
   v_entry:=jsonb_set(v_entry,'{scoreBonus}',to_jsonb(v_score_bonus),true);
   v_entry:=jsonb_set(v_entry,'{modBonus}',to_jsonb(v_mod_bonus),true);
   v_entry:=jsonb_set(v_entry,'{effectiveScore}',to_jsonb(v_score),true);
   v_entry:=jsonb_set(v_entry,'{effectiveMod}',to_jsonb(v_mod),true);
   v_abilities:=jsonb_set(v_abilities,array[v_key],v_entry,true);
 end loop;
 v_candidate:=jsonb_set(v_candidate,'{abilities}',v_abilities,true);
 v_new_dex:=coalesce((v_abilities#>>'{dex,effectiveMod}')::integer,0);
 v_ac:=coalesce(v_candidate->'ac','{}'::jsonb);
 v_category:=v_ac->>'armorCategory';

 -- The canonical resolver computes equipped body armor base plus applied
 -- DEX, or 10+DEX unarmored UNLESS a manual sheet AC override exists.
 if v_new_dex<>v_old_dex then
   if v_category='light' then
     v_new_applied:=v_new_dex;
   elsif v_category='medium' then
     v_new_applied:=least(v_new_dex,2);
   elsif v_category='heavy' then
     v_new_applied:=0;
   elsif v_category is null then
     select coalesce(sheet,'{}'::jsonb) into v_sheet
     from public.character_sheets where character_id=p_character_id;
     v_text:=nullif(v_sheet->>'ac','');
     if v_text ~ '^-?[0-9]+$' and v_text::integer<>0 then
       v_ac_unresolved_reason:='manual_sheet_ac_override';
     else
       v_ac_unresolved_reason:=null;
       v_delta:=v_new_dex-v_old_dex;
     end if;
   else
     v_ac_unresolved_reason:='unknown_armor_category';
   end if;
   if v_category in ('light','medium','heavy') then
     v_old_applied:=coalesce((v_ac->>'dexApplied')::integer,0);
     v_delta:=v_new_applied-v_old_applied;
     v_ac:=jsonb_set(v_ac,'{dexApplied}',to_jsonb(v_new_applied),true);
   end if;
   if v_ac_unresolved_reason is null then
     v_ac:=jsonb_set(v_ac,'{base}',
       to_jsonb(coalesce((v_ac->>'base')::integer,0)+v_delta),true);
     v_ac:=jsonb_set(v_ac,'{total}',
       to_jsonb(coalesce((v_ac->>'total')::integer,0)+v_delta),true);
     v_ac_changed:=v_delta<>0;
   end if;
 end if;
 v_candidate:=jsonb_set(v_candidate,'{ac}',v_ac,true);
 return jsonb_build_object(
   'schemaVersion',1,'consumerEnforced',false,
   'attunementEnabled',true,'baseline',v_baseline,'shadow',v_candidate,
   'wouldChange',v_candidate is distinct from v_baseline,
   'fullEffectConsumerParityReady',false,
   'abilityComparisonComplete',true,
   'acDexRecalculationComplete',v_ac_unresolved_reason is null,
   'unresolvedAcRule',v_ac_unresolved_reason,
   'suppressedScoreBonuses',v_score_removed,
   'suppressedModifierBonuses',v_mod_removed,
   'suppressedAbilityContributions',v_audit,
   'directBonusAudit',v_previous->'suppressedDirectBonuses',
   'legacyUnresolvedItemIds',v_previous->'unresolvedItemIds'
 );
end;
$shadow$;
revoke all on function private.character_attuned_ability_shadow_v1(uuid)
 from public,anon,authenticated;
grant execute on function private.character_attuned_ability_shadow_v1(uuid)
 to service_role;
comment on function private.character_attuned_ability_shadow_v1(uuid) is
'Inert, trusted read-only attunement comparison of score and modifier bonuses with explicit armor DEX recalculation; not combat or sheet authority.';

-- Inert, read-only, character-specific direct AC/save shadow.
-- Prerequisites: existing private.character_equipment_effects_v1(uuid)
-- plus the optional source-gate stack 20261025_01/_02/_04.
-- No character/encounter calculation or public RPC is replaced.
-- OFF: return the exact original legacy result, with no arithmetic.
-- ON: remove only direct bonusAc/bonusSavingThrow and modifiers.saves
-- from unselected verified magic item sources. Armor, shield and
-- ability-dependent AC remain legacy until separately reconciled.
create or replace function private.character_attuned_ac_saves_shadow_v1(
 p_character_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $shadow$
declare
 v_baseline jsonb;
 v_candidate jsonb;
 v_gate jsonb;
 v_item public.inventory_items%rowtype;
 v_catalog jsonb;
 v_payload jsonb;
 v_modifiers jsonb;
 v_save_map jsonb;
 v_save_bonuses jsonb;
 v_item_audit jsonb:='[]'::jsonb;
 v_unresolved jsonb:='[]'::jsonb;
 v_source jsonb;
 v_key text;
 v_text text;
 v_number integer;
 v_item_ac integer;
 v_item_saves integer;
 v_total_ac integer:=0;
 v_total_saves integer:=0;
 v_current integer;
 v_shadow_saves jsonb;
 v_ac jsonb;
 v_existing jsonb;
begin
 if p_character_id is null then
   raise exception 'Character id required' using errcode='22023';
 end if;
 v_baseline:=private.character_equipment_effects_v1(p_character_id);
 v_gate:=private.character_magic_effect_source_gate_shadow_v1(p_character_id);
 if v_gate->>'attunementEnabled'='false' then
   return jsonb_build_object(
     'schemaVersion',1,'consumerEnforced',false,'attunementEnabled',false,
     'baseline',v_baseline,'shadow',v_baseline,'wouldChange',false,
     'directAcSavesComparisonComplete',true,'unresolvedItemIds','[]'::jsonb,
     'suppressedDirectBonuses','[]'::jsonb
   );
 end if;
 if v_gate->>'attunementEnabled' is distinct from 'true' then
   raise exception 'Unverified campaign attunement state' using errcode='22023';
 end if;
 v_shadow_saves:=coalesce(v_baseline->'saves','{}'::jsonb);
 if jsonb_typeof(v_shadow_saves)<>'object' then
   raise exception 'Legacy save-map contract is not an object' using errcode='22023';
 end if;

 for v_source in
   select value from jsonb_array_elements(v_gate->'items')
   where value->>'magicRiderEligible'='false'
   order by value->>'inventoryItemId'
 loop
   select * into strict v_item from public.inventory_items i
     where i.id=(v_source->>'inventoryItemId')::uuid and i.is_equipped is true;
   v_catalog:='{}'::jsonb;
   -- Exactly the legacy catalogue precedence: key matches first,
   -- then inventory key, then case-insensitive name, one-edition first.
   select coalesce(ic.payload,'{}'::jsonb)
   into v_catalog
   from public.items_catalog ic
   where ic.item_key=coalesce(v_item.card_payload->>'item_key',v_item.card_payload->>'item_id',v_item.item_id)
     or ic.item_key=v_item.item_id
     or lower(ic.item_name)=lower(v_item.item_name)
   order by
     case when ic.item_key=coalesce(v_item.card_payload->>'item_key',v_item.card_payload->>'item_id',v_item.item_id) then 0
          when ic.item_key=v_item.item_id then 1 else 2 end,
     case when coalesce(ic.payload->>'edition','')='one' then 0 else 1 end
   limit 1;
   v_payload:=coalesce(v_catalog,'{}'::jsonb) || coalesce(v_item.card_payload,'{}'::jsonb);
   v_item_ac:=0;
   v_item_saves:=0;
   for v_key in select unnest(array['bonusAc','acBonus','bonus_ac'])
   loop
     v_text:=nullif(v_payload->>v_key,'');
     if v_text is not null and v_text ~ '[-+]?[0-9]+' then
       v_item_ac:=substring(v_text from '[-+]?[0-9]+')::integer;
       exit;
     end if;
   end loop;
   for v_key in select unnest(array['bonusSavingThrow','saveBonus','bonus_saving_throw'])
   loop
     v_text:=nullif(v_payload->>v_key,'');
     if v_text is not null and v_text ~ '[-+]?[0-9]+' then
       v_item_saves:=substring(v_text from '[-+]?[0-9]+')::integer;
       exit;
     end if;
   end loop;
   v_modifiers:=case when jsonb_typeof(v_payload->'modifiers')='object'
                then v_payload->'modifiers' else '{}'::jsonb end;
   v_save_map:=case when jsonb_typeof(v_modifiers->'saves')='object'
              then v_modifiers->'saves' else '{}'::jsonb end;
   for v_key,v_text in select key,value #>> '{}' from jsonb_each(v_save_map)
   loop
     if v_text is not null and v_text ~ '[-+]?[0-9]+' then
       v_number:=substring(v_text from '[-+]?[0-9]+')::integer;
       if lower(v_key)='all' then
         v_item_saves:=v_item_saves+v_number;
       else
         v_current:=coalesce((v_shadow_saves->>lower(v_key))::integer,0);
         v_shadow_saves:=jsonb_set(v_shadow_saves,array[lower(v_key)],
           to_jsonb(v_current-v_number),true);
       end if;
     end if;
   end loop;
   v_total_ac:=v_total_ac+v_item_ac;
   v_total_saves:=v_total_saves+v_item_saves;
   v_item_audit:=v_item_audit || jsonb_build_array(jsonb_build_object(
      'inventoryItemId',v_item.id,'sourceReason',v_source->>'reason',
      'directAcRemoved',v_item_ac,'globalSaveRemoved',v_item_saves
   ));
   -- These fields can indirectly alter AC/DEX/saves or encode physical
   -- shield/armor enhancement. Never silently declare full parity.
   if (v_modifiers ? 'abilities') or (v_modifiers ? 'abilityScores')
      or (v_modifiers ? 'abilityMods') or (v_modifiers ? 'abilityModifiers')
      or (v_payload ? 'ability') or (v_payload ? 'modifySpeed')
      or (v_payload ? 'ac') or (v_payload ? 'armor')
      or (v_payload ? 'bonusShield') then
      v_unresolved:=v_unresolved || jsonb_build_array(v_item.id);
   end if;
 end loop;

 v_ac:=coalesce(v_baseline->'ac','{}'::jsonb);
 if jsonb_typeof(v_ac)<>'object' then
   raise exception 'Legacy armor class contract is not an object' using errcode='22023';
 end if;
 v_ac:=jsonb_set(v_ac,'{total}',
      to_jsonb(coalesce((v_ac->>'total')::integer,0)-v_total_ac),true);
 v_ac:=jsonb_set(v_ac,'{otherBonus}',
      to_jsonb(coalesce((v_ac->>'otherBonus')::integer,0)-v_total_ac),true);
 v_candidate:=jsonb_set(v_baseline,'{ac}',v_ac,true);
 v_candidate:=jsonb_set(v_candidate,'{savesAll}',
    to_jsonb(coalesce((v_baseline->>'savesAll')::integer,0)-v_total_saves),true);
 v_candidate:=jsonb_set(v_candidate,'{saves}',v_shadow_saves,true);

 return jsonb_build_object(
   'schemaVersion',1,'consumerEnforced',false,'attunementEnabled',true,
   'baseline',v_baseline,'shadow',v_candidate,
   'wouldChange',v_candidate is distinct from v_baseline,
   'directAcSavesComparisonComplete',jsonb_array_length(v_unresolved)=0,
   'fullEffectConsumerParityReady',false,
   'unresolvedItemIds',v_unresolved,'suppressedDirectBonuses',v_item_audit,
   'sourceGate',v_gate
 );
end;
$shadow$;
revoke all on function private.character_attuned_ac_saves_shadow_v1(uuid)
 from public,anon,authenticated;
grant execute on function private.character_attuned_ac_saves_shadow_v1(uuid)
 to service_role;
comment on function private.character_attuned_ac_saves_shadow_v1(uuid) is
'Private read-only direct AC/saving throw shadow. Does not replace actual sheet, combat or equipment resolvers, and cannot certify indirect bonuses or magic armor enhancement.';

-- Additive, read-only inventory-backed audit of the PHYSICAL armor/shield
-- AC field versus the separate DIRECT bonusAc magic-rider field.
-- No gameplay resolver is replaced. This audit MUST NOT be treated as
-- attunement enforcement; physical provenance is not fully verified.
create or replace function private.character_attuned_armor_channel_audit_v1(
 p_character_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $audit$
declare
 v_prior jsonb;
 v_baseline jsonb;
 v_candidate jsonb;
 v_gate jsonb;
 v_source jsonb;
 v_inv public.inventory_items%rowtype;
 v_catalog jsonb;
 v_payload jsonb;
 v_category text;
 v_type text;
 v_item_type text;
 v_item_name text;
 v_raw text;
 v_physical_ac integer;
 v_catalog_ac integer;
 v_direct_bonus integer;
 v_legacy_applied integer;
 v_selected boolean;
 v_rider_eligible boolean;
 v_structure_conflict boolean;
 v_provenance_reasons jsonb;
 v_items jsonb:='[]'::jsonb;
 v_direct_audit jsonb;
 v_shadow_removed integer;
 v_key text;
 v_ac jsonb;
 v_baseline_ac jsonb;
 v_item jsonb;
begin
 if p_character_id is null then
   raise exception 'Character id required' using errcode='22023';
 end if;
 v_prior:=private.character_attuned_ability_shadow_v1(p_character_id);
 v_baseline:=v_prior->'baseline';
 v_candidate:=v_prior->'shadow';
 v_gate:=private.character_magic_effect_source_gate_shadow_v1(p_character_id);
 if v_gate->>'attunementEnabled' not in ('true','false') then
   raise exception 'Missing authoritative campaign attunement state' using errcode='22023';
 end if;
 v_ac:=coalesce(v_candidate->'ac','{}'::jsonb);
 v_baseline_ac:=coalesce(v_baseline->'ac','{}'::jsonb);
 v_direct_audit:=coalesce(v_prior->'directBonusAudit','[]'::jsonb);
 if jsonb_typeof(v_ac)<>'object'
   or jsonb_typeof(v_baseline_ac)<>'object'
   or jsonb_typeof(v_gate->'items')<>'array' then
   raise exception 'Invalid trusted equipment/source projection' using errcode='22023';
 end if;
 for v_source in select value from jsonb_array_elements(v_gate->'items')
 loop
   select * into strict v_inv from public.inventory_items
     where id=(v_source->>'inventoryItemId')::uuid and is_equipped is true;
   v_catalog:='{}'::jsonb;
   -- Preserve the EXACT current canonical item-key/edition/name priority.
   select coalesce(ic.payload,'{}'::jsonb) into v_catalog
   from public.items_catalog ic
   where ic.item_key=coalesce(v_inv.card_payload->>'item_key',
     v_inv.card_payload->>'item_id',v_inv.item_id)
      or ic.item_key=v_inv.item_id
      or lower(ic.item_name)=lower(v_inv.item_name)
   order by
    case when ic.item_key=coalesce(v_inv.card_payload->>'item_key',
      v_inv.card_payload->>'item_id',v_inv.item_id) then 0
         when ic.item_key=v_inv.item_id then 1 else 2 end,
    case when coalesce(ic.payload->>'edition','')='one' then 0 else 1 end
   limit 1;
   v_payload:=coalesce(v_catalog,'{}'::jsonb) || coalesce(v_inv.card_payload,'{}'::jsonb);
   v_type:=lower(split_part(coalesce(v_payload->>'type',''),'|',1));
   v_item_type:=lower(coalesce(v_payload->>'item_type',
                                v_payload->>'uiType',v_inv.item_type,''));
   v_item_name:=lower(coalesce(v_payload->>'item_name',
                                v_payload->>'name',v_inv.item_name,''));
   v_category:=case
     when v_type='s' or v_item_type='shield' or v_item_name='shield' then 'shield'
     when v_type='ha' or v_item_name in ('ring mail','chain mail','splint','splint armor','plate','plate armor') then 'heavy'
     when v_type='ma' or v_item_name in ('hide armor','chain shirt','scale mail','breastplate','half plate','half plate armor') then 'medium'
     when v_type='la' or v_item_name in ('padded armor','leather armor','studded leather armor') then 'light'
     else null end;
   if v_category is null then continue; end if;
   -- Body slot is required for armor, just as in the canonical resolver.
   if v_category<>'shield' and lower(coalesce(v_inv.equip_slot,''))<>'body' then
     continue;
   end if;
   v_physical_ac:=null;
   v_raw:=v_payload->>'ac';
   if coalesce(v_raw,'') ~ '^-?[0-9]+$' then
     v_physical_ac:=v_raw::integer;
   elsif coalesce(v_payload->'armor'->>'ac','') ~ '^-?[0-9]+$' then
     v_physical_ac:=(v_payload->'armor'->>'ac')::integer;
   else
     v_physical_ac:=public.craft_payload_inferred_ac(v_inv.item_name);
   end if;
   v_catalog_ac:=null;
   if coalesce(v_catalog->>'ac','') ~ '^-?[0-9]+$' then
     v_catalog_ac:=(v_catalog->>'ac')::integer;
   elsif coalesce(v_catalog->'armor'->>'ac','') ~ '^-?[0-9]+$' then
     v_catalog_ac:=(v_catalog->'armor'->>'ac')::integer;
   end if;
   v_direct_bonus:=0;
   for v_key in select unnest(array['bonusAc','acBonus','bonus_ac'])
   loop
     v_raw:=nullif(v_payload->>v_key,'');
     if v_raw is not null and v_raw ~ '[-+]?[0-9]+' then
       v_direct_bonus:=substring(v_raw from '[-+]?[0-9]+')::integer;
       exit;
     end if;
   end loop;
   v_legacy_applied:=case
     when v_category='shield' and v_baseline_ac->>'shieldItemId'=v_inv.id::text
       then coalesce((v_baseline_ac->>'shieldBonus')::integer,0)
     when v_category<>'shield' and v_baseline_ac->>'armorItemId'=v_inv.id::text
       then coalesce((v_baseline_ac->>'armorBase')::integer,0)
     else 0 end;
   v_selected:=coalesce((v_source->>'selectedForCharacter')::boolean,false);
   v_rider_eligible:=coalesce((v_source->>'magicRiderEligible')::boolean,false);
   v_shadow_removed:=0;
   if v_gate->>'attunementEnabled'='true' and not v_rider_eligible then
     select coalesce((a->>'directAcRemoved')::integer,0) into v_shadow_removed
     from jsonb_array_elements(v_direct_audit) a
     where a->>'inventoryItemId'=v_inv.id::text limit 1;
     v_shadow_removed:=coalesce(v_shadow_removed,0);
   end if;
   -- Legacy ac may encode physical armor *or* a combined magical value.
   -- Even an ordinary-looking 18 or 2 is not proof of provenance.
   v_provenance_reasons:='[]'::jsonb;
   if v_catalog_ac is null then
     v_provenance_reasons:=v_provenance_reasons||'"missing_catalogue_ac_baseline"'::jsonb;
   end if;
   if (v_inv.card_payload ? 'ac') or
      (v_inv.card_payload ? 'armor' and jsonb_typeof(v_inv.card_payload->'armor')='object') then
     v_provenance_reasons:=v_provenance_reasons||'"instance_ac_override_unverified"'::jsonb;
   end if;
   if v_category='shield' and v_physical_ac is distinct from 2 then
     v_provenance_reasons:=v_provenance_reasons||'"nonstandard_shield_base"'::jsonb;
   end if;
   if v_category<>'shield' and v_type not in ('la','ma','ha') then
     v_provenance_reasons:=v_provenance_reasons||'"implicit_armor_type"'::jsonb;
   end if;
   if v_physical_ac is distinct from v_catalog_ac then
     v_provenance_reasons:=v_provenance_reasons||'"catalogue_instance_ac_mismatch"'::jsonb;
   end if;
   if v_source->>'rarityMagicCandidate'='true' then
     v_provenance_reasons:=v_provenance_reasons||'"magic_physical_base_unverified"'::jsonb;
   end if;
   v_item:=jsonb_build_object(
     'inventoryItemId',v_inv.id,
     'itemKey',v_inv.item_id,
     'armorCategory',v_category,
     'equipSlot',v_inv.equip_slot,
     'legacyAcField',v_physical_ac,
     'catalogueAcField',v_catalog_ac,
     'legacyPhysicalAcApplied',v_legacy_applied,
     'legacyDirectBonusAc',v_direct_bonus,
     'magicRiderEligible',v_rider_eligible,
     'selectedForCharacter',v_selected,
     'shadowDirectBonusRemoved',v_shadow_removed,
     'physicalFieldKeptInShadow',
       (v_ac->>'armorBase') is not distinct from (v_baseline_ac->>'armorBase')
       and (v_ac->>'shieldBonus') is not distinct from (v_baseline_ac->>'shieldBonus'),
     'sourceChannelProvenanceReady',false,
     'unresolvedReasons',v_provenance_reasons
   );
   v_items:=v_items||jsonb_build_array(v_item);
 end loop;
 return jsonb_build_object(
   'schemaVersion',1,
   'attunementEnabled',v_gate->'attunementEnabled',
   'consumerEnforced',false,
   'fullEffectConsumerParityReady',false,
   'physicalChannelSourceProofReady',false,
   'baseline',v_baseline,'shadow',v_candidate,
   'items',v_items,
   'wouldChange',v_candidate is distinct from v_baseline
 );
end;
$audit$;
revoke all on function private.character_attuned_armor_channel_audit_v1(uuid)
 from public,anon,authenticated;
grant execute on function private.character_attuned_armor_channel_audit_v1(uuid)
 to service_role;
comment on function private.character_attuned_armor_channel_audit_v1(uuid) is
'Inert item-source audit of physical armor/shield ac versus independent direct magical bonusAc. Not proof of magical base provenance or consumer enforcement.';

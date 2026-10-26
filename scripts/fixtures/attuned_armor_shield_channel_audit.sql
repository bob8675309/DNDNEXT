\set ON_ERROR_STOP on
-- Compose the exact canonical numeric resolver and source-gated ability
-- comparison in a disposable Postgres16 database, never live Supabase.
\i scripts/fixtures/character_attuned_ability_shadow.sql
\i sql/20261025_08_attuned_armor_shield_source_audit.sql

-- Existing fixture ends with heavy Plate and Animated Shield. Replace them
-- with authentic catalogue-shaped magic item sources, without editing the
-- actual production inventory. No crafted/physical slot system is changed.
update public.inventory_items set is_equipped=false
 where id in ('eeeeeeee-0000-4000-8000-000000000011',
              'eeeeeeee-0000-4000-8000-000000000012');
insert into public.items_catalog(item_key,item_rarity,item_name,payload) values
 ('Dwarven Plate|DMG','very rare','Dwarven Plate',
  '{"type":"HA","ac":18,"bonusAc":"+2"}'::jsonb),
 ('Arrow-Catching Shield|XDMG','rare','Arrow-Catching Shield',
  '{"type":"S|XPHB","ac":2,"bonusAc":"+2"}'::jsonb);
insert into public.inventory_items(
  id,item_id,item_name,item_rarity,card_payload,owner_type,owner_id,
  is_equipped,equip_slot,item_type
) values
 ('eeeeeeee-0000-4000-8000-000000000014','Dwarven Plate|DMG',
  'Dwarven Plate','very rare','{}'::jsonb,
  'character','cccccccc-0000-4000-8000-000000000001',true,'body','heavy armor'),
 ('eeeeeeee-0000-4000-8000-000000000015','Arrow-Catching Shield|XDMG',
  'Arrow-Catching Shield','rare','{}'::jsonb,
  'character','cccccccc-0000-4000-8000-000000000001',true,'shield','shield');

do $test$
declare
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 plate uuid:='eeeeeeee-0000-4000-8000-000000000014';
 shield uuid:='eeeeeeee-0000-4000-8000-000000000015';
 cloak uuid:='eeeeeeee-0000-4000-8000-000000000013';
 r jsonb;
 base jsonb;
 projection jsonb;
 item jsonb;
begin
 if has_function_privilege('anon',
      'private.character_attuned_armor_channel_audit_v1(uuid)','EXECUTE')
    or has_function_privilege('authenticated',
      'private.character_attuned_armor_channel_audit_v1(uuid)','EXECUTE')
    or not has_function_privilege('service_role',
      'private.character_attuned_armor_channel_audit_v1(uuid)','EXECUTE')
 then raise exception 'Physical/magic armor audit exposed to browser roles'; end if;

 -- Legacy OFF remains EXACT canonical result; independently stored +2 AC
 -- does not replace physical plate 18 or physical shield 2.
 r:=private.character_attuned_armor_channel_audit_v1(c);
 base:=private.character_equipment_effects_v1(c);
 if r->'baseline' is distinct from base
    or r->'shadow' is distinct from base
    or r->>'consumerEnforced'<>'false'
    or (base#>>'{ac,armorBase}')::integer<>18
    or (base#>>'{ac,shieldBonus}')::integer<>2
 then raise exception 'Legacy armor/shield OFF parity failed %',r; end if;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(true);
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 -- Prior nested fixtures intentionally leave a Cloak selection saved.
 -- Reset character-specific selections explicitly for the no-choice case.
 perform public.set_character_rest_magic_choices_v1(c,array[]::uuid[]);
 -- Magic plate and shield remain physically equipped with no attunement
 -- selected, while their separate +2/+2 magical riders are filtered.
 r:=private.character_attuned_armor_channel_audit_v1(c);
 base:=r->'baseline'; projection:=r->'shadow';
 if (base#>>'{ac,base}')::integer<>18
    or (base#>>'{ac,shieldBonus}')::integer<>2
    or (projection#>>'{ac,base}')::integer<>18
    or (projection#>>'{ac,shieldBonus}')::integer<>2
    or (projection#>>'{ac,total}')::integer<>20
    or (projection#>>'{ac,otherBonus}')::integer<>0
    or r->>'fullEffectConsumerParityReady'<>'false'
    or r->>'physicalChannelSourceProofReady'<>'false'
 then raise exception 'Unselected magical gear lost physical base or retained bonus %',r; end if;

 select value into item from jsonb_array_elements(r->'items')
   where value->>'inventoryItemId'=plate::text;
 if item->>'armorCategory'<>'heavy'
    or (item->>'legacyAcField')::integer<>18
    or (item->>'catalogueAcField')::integer<>18
    or (item->>'legacyDirectBonusAc')::integer<>2
    or (item->>'shadowDirectBonusRemoved')::integer<>2
    or (item->>'legacyPhysicalAcApplied')::integer<>18
    or item->>'physicalFieldKeptInShadow'<>'true'
    or item->>'sourceChannelProvenanceReady'<>'false'
    or not (item->'unresolvedReasons' ? 'magic_physical_base_unverified')
 then raise exception 'Dwarven Plate ac/bonusAc channels not distinguished %',item; end if;
 select value into item from jsonb_array_elements(r->'items')
   where value->>'inventoryItemId'=shield::text;
 if item->>'armorCategory'<>'shield'
    or (item->>'legacyAcField')::integer<>2
    or (item->>'legacyDirectBonusAc')::integer<>2
    or (item->>'shadowDirectBonusRemoved')::integer<>2
    or (item->>'legacyPhysicalAcApplied')::integer<>2
    or item->>'physicalFieldKeptInShadow'<>'true'
 then raise exception 'Arrow-Catching Shield physical AC and magic bonus confused %',item; end if;

 -- Three selected magic inventory IDs authorize their direct magical bonus
 -- independently; another unselected source (the Staff, +3) remains excluded.
 perform public.set_character_rest_magic_choices_v1(c,array[plate,shield,cloak]);
 r:=private.character_attuned_armor_channel_audit_v1(c);
 if (r->'shadow'#>>'{ac,base}')::integer<>18
    or (r->'shadow'#>>'{ac,shieldBonus}')::integer<>2
    or (r->'shadow'#>>'{ac,otherBonus}')::integer<>6
    or (r->'shadow'#>>'{ac,total}')::integer<>26
 then raise exception 'Selected magical +2 +2 +2 not independently restored %',r; end if;
 select value into item from jsonb_array_elements(r->'items')
   where value->>'inventoryItemId'=plate::text;
 if item->>'magicRiderEligible'<>'true'
    or item->>'selectedForCharacter'<>'true'
    or (item->>'shadowDirectBonusRemoved')::integer<>0
 then raise exception 'Selected physical plate did not retain separate rider %',item; end if;

 -- Instance AC override with no trusted physical baseline is not proof that
 -- 21 is physical Plate AC. Do not rewrite this old active resolver behavior;
 -- surface a concrete unresolved provenance conflict.
 update public.inventory_items
   set card_payload='{"ac":21}'::jsonb
 where id=plate;
 r:=private.character_attuned_armor_channel_audit_v1(c);
 select value into item from jsonb_array_elements(r->'items')
   where value->>'inventoryItemId'=plate::text;
 if (r->'baseline'#>>'{ac,armorBase}')::integer<>21
    or (r->'shadow'#>>'{ac,armorBase}')::integer<>21
    or item->>'sourceChannelProvenanceReady'<>'false'
    or not (item->'unresolvedReasons' ? 'instance_ac_override_unverified')
    or not (item->'unresolvedReasons' ? 'catalogue_instance_ac_mismatch')
 then raise exception 'Instance armor AC override silently called physical proof %',r; end if;
 if exists(select 1 from public.character_magic_item_selections_v1
     where inventory_item_id=plate)
 then raise exception 'Item source change failed to revoke prior selection'; end if;

 -- OFF must still return the exact legacy result even after a mismatched
 -- instance has modified the nominal physical armor field.
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(false);
 r:=private.character_attuned_armor_channel_audit_v1(c);
 base:=private.character_equipment_effects_v1(c);
 if r->'shadow' is distinct from base
    or r->'baseline' is distinct from base
    or r->>'consumerEnforced'<>'false'
 then raise exception 'OFF after instance edit changed canonical equipment %',r; end if;
end $test$;
select 'Dwarven Plate/Arrow-Catching Shield physical AC separate from +2 magical rider; catalogue-instance mismatch flagged and OFF exact parity' as result;

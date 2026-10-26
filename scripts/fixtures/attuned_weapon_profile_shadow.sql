\set ON_ERROR_STOP on
-- Compose prior account/character, inventory, attunement, armor and six-
-- ability tests. No production DB connection or gameplay writer runs.
\i scripts/fixtures/attuned_armor_shield_channel_audit.sql

create table public.encounter_participants (
 id uuid primary key,character_id uuid not null
);
create table public.class_catalog_preferred (
 class_key text,raw_payload jsonb
);
insert into public.class_catalog_preferred values
 ('fighter','{"starting_proficiencies":{"weapons":["martial","simple"]}}'::jsonb);
insert into public.encounter_participants(id,character_id) values
 ('dddddddd-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001'),
 ('dddddddd-0000-4000-8000-000000000002','cccccccc-0000-4000-8000-000000000002');
update public.character_sheets set sheet=
 '{"abilities":{"str":{"score":14},"dex":{"score":18}},"meta":{"classKey":"fighter"},"proficiencyBonus":3,"hp":32}'::jsonb
where character_id='cccccccc-0000-4000-8000-000000000001';
update public.character_sheets set sheet=
 '{"abilities":{"str":{"score":14},"dex":{"score":18}},"meta":{"classKey":"fighter"},"proficiencyBonus":3,"hp":27}'::jsonb
where character_id='cccccccc-0000-4000-8000-000000000002';

insert into public.items_catalog(item_key,item_rarity,item_name,payload) values
 ('Longsword +2|XDMG','rare','Longsword +2',
   '{"weapon":true,"type":"M","item_type":"melee weapon","weaponCategory":"martial","dmg1":"1d8","dmgType":"S","bonusWeapon":"+2"}'::jsonb),
 ('Longbow +1|XDMG','uncommon','Longbow +1',
   '{"weapon":true,"type":"R","item_type":"ranged weapon","weaponCategory":"martial","dmg1":"1d8","dmgType":"P","range":"150/600","bonus_weapon":"+1"}'::jsonb),
 ('Rapier|XPHB','mundane','Rapier',
   '{"weapon":true,"type":"M","item_type":"melee weapon","weaponCategory":"martial","dmg1":"1d8","dmgType":"P","property":["F|XPHB"]}'::jsonb);
insert into public.inventory_items(
 id,item_id,item_name,item_rarity,card_payload,owner_type,owner_id,
 is_equipped,equip_slot,item_type
) values
 ('eeeeeeee-0000-4000-8000-000000000016','Longsword +2|XDMG',
   'Longsword +2','rare','{}'::jsonb,
   'character','cccccccc-0000-4000-8000-000000000001',true,'weapon_4','melee weapon'),
 ('eeeeeeee-0000-4000-8000-000000000017','Longbow +1|XDMG',
   'Longbow +1','uncommon','{}'::jsonb,
   'character','cccccccc-0000-4000-8000-000000000001',true,'weapon_5','ranged weapon'),
 ('eeeeeeee-0000-4000-8000-000000000018','Tempered Maul',
   'Tempered Maul','mundane',
   '{"weapon":true,"type":"M","dmg1":"2d6","dmgType":"B","weaponCategory":"martial","smith_tier":2}'::jsonb,
   'character','cccccccc-0000-4000-8000-000000000001',true,'weapon_6','melee weapon');
-- Current known Rapier is mundane and finesse; use canonical catalogue
-- metadata. Unknown rare source has attack bonus text but no source proof.
update public.inventory_items set
 card_payload='{"weapon":true,"type":"M","dmg1":"1d8","dmgType":"P","property":["F|XPHB"],"weaponCategory":"martial"}'::jsonb,
 item_type='melee weapon'
where id='eeeeeeee-0000-4000-8000-000000000006';
update public.inventory_items set
 card_payload='{"weapon":true,"type":"M","dmg1":"1d6","dmgType":"S","weaponCategory":"martial","bonusWeapon":"+5"}'::jsonb,
 item_type='melee weapon'
where id='eeeeeeee-0000-4000-8000-000000000007';
update public.inventory_items set
 item_id='Longsword +2|XDMG',item_name='Shared Longsword',
 item_rarity='rare',item_type='melee weapon',
 card_payload='{"weapon":true,"type":"M","dmg1":"1d8","dmgType":"S","weaponCategory":"martial","bonusWeapon":"+2"}'::jsonb
where id='eeeeeeee-0000-4000-8000-000000000009';

-- EXACT final legacy snapshot and weapon profile, checked byte for byte
-- against the original 20260801_04 migration by source validator.
\i scripts/fixtures/legacy_tactical_weapon_profile_v1.sql
\i sql/20261025_09_attuned_weapon_profile_shadow.sql

do $test$
declare
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 other uuid:='cccccccc-0000-4000-8000-000000000002';
 p uuid:='dddddddd-0000-4000-8000-000000000001';
 other_p uuid:='dddddddd-0000-4000-8000-000000000002';
 sword uuid:='eeeeeeee-0000-4000-8000-000000000016';
 bow uuid:='eeeeeeee-0000-4000-8000-000000000017';
 tempered uuid:='eeeeeeee-0000-4000-8000-000000000018';
 rapier uuid:='eeeeeeee-0000-4000-8000-000000000006';
 unknown_item uuid:='eeeeeeee-0000-4000-8000-000000000007';
 boots uuid:='eeeeeeee-0000-4000-8000-000000000004';
 staff uuid:='eeeeeeee-0000-4000-8000-000000000002';
 shared uuid:='eeeeeeee-0000-4000-8000-000000000009';
 r jsonb;
 baseline jsonb;
 projected jsonb;
begin
 if has_function_privilege('anon','private.encounter_attuned_weapon_profile_shadow_v1(uuid,uuid)','EXECUTE')
 or has_function_privilege('authenticated','private.encounter_attuned_weapon_profile_shadow_v1(uuid,uuid)','EXECUTE')
 or not has_function_privilege('service_role','private.encounter_attuned_weapon_profile_shadow_v1(uuid,uuid)','EXECUTE')
 then raise exception 'Weapon shadow function publicly callable'; end if;

 r:=private.encounter_attuned_weapon_profile_shadow_v1(p,sword);
 baseline:=public.encounter_weapon_profile_internal_v1(p,sword);
 if r->'baseline' is distinct from baseline
    or r->'shadow' is distinct from baseline
    or r->>'wouldChange'<>'false'
    or (baseline->>'magicBonus')::integer<>2
    or (baseline->>'attackBonus')::integer<>9
    or baseline->>'damageDice'<>'1d8'
    or baseline->>'ability'<>'str'
 then raise exception 'Weapon OFF legacy exact profile parity failed %',r; end if;
 if private.encounter_attuned_weapon_profile_shadow_v1(p,'eeeeeeee-0000-4000-8000-000000000008'::uuid)
   is not null
 then raise exception 'Unequipped weapon created valid tactical profile'; end if;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(true);
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 perform public.set_character_rest_magic_choices_v1(c,array[]::uuid[]);
 perform public.set_character_rest_magic_choices_v1(other,array[]::uuid[]);

 -- Zero chosen items: STR 14 -> +2, weapon direct +2 suppressed,
 -- but original 1d8 Slashing and inventory/equip identity are unchanged.
 r:=private.encounter_attuned_weapon_profile_shadow_v1(p,sword);
 projected:=r->'shadow';
 if (r->'baseline'->>'attackBonus')::integer<>9
   or (projected->>'attackBonus')::integer<>5
   or (projected->>'magicBonus')::integer<>0
   or (projected->>'abilityMod')::integer<>2
   or (r->>'shadowFlatDamageBonus')::integer<>2
   or (r->>'baselineFlatDamageBonus')::integer<>6
   or projected->>'damageDice'<>'1d8'
   or projected->>'damageType'<>'slashing'
   or projected->>'inventoryItemId'<>sword::text
   or r->>'consumerEnforced'<>'false'
 then raise exception 'Unselected +2 sword damage/attack separation failed %',r; end if;
 -- Finesse: baseline DEX+7 vs STR+4; no sources selected -> DEX+4.
 r:=private.encounter_attuned_weapon_profile_shadow_v1(p,rapier);
 if r->'baseline'->>'ability'<>'dex'
    or (r->'baseline'->>'attackBonus')::integer<>10
    or r->'shadow'->>'ability'<>'dex'
    or (r->'shadow'->>'attackBonus')::integer<>7
    or (r->'shadow'->>'magicBonus')::integer<>0
 then raise exception 'Mundane finesse kept physical weapon but failed ability parity %',r; end if;

 -- Chosen sword: preserve its magic +2 without re-enabling Boots/Staff.
 perform public.set_character_rest_magic_choices_v1(c,array[sword]);
 r:=private.encounter_attuned_weapon_profile_shadow_v1(p,sword);
 if (r->'shadow'->>'attackBonus')::integer<>7
    or (r->'shadow'->>'magicBonus')::integer<>2
    or (r->>'shadowFlatDamageBonus')::integer<>4
 then raise exception 'Selected +2 sword did not restore item bonus %',r; end if;

 -- Two selected sources: Boots' DEX score/mod bonus now restores ranged
 -- attack ability. Longbow is still unselected, so its +1 disappears.
 perform public.set_character_rest_magic_choices_v1(c,array[boots,sword]);
 r:=private.encounter_attuned_weapon_profile_shadow_v1(p,bow);
 if r->'shadow'->>'ability'<>'dex'
    or (r->'shadow'->>'abilityMod')::integer<>7
    or (r->'shadow'->>'attackBonus')::integer<>10
    or (r->'shadow'->>'magicBonus')::integer<>0
    or r->'shadow'->>'normalRangeFt'<>'150'
    or r->'shadow'->>'longRangeFt'<>'600'
 then raise exception 'Ranged profile incorrectly restored unselected bow magic %',r; end if;
 perform public.set_character_rest_magic_choices_v1(c,array[boots,bow]);
 r:=private.encounter_attuned_weapon_profile_shadow_v1(p,bow);
 if (r->'shadow'->>'attackBonus')::integer<>11
    or (r->'shadow'->>'magicBonus')::integer<>1
    or (r->>'shadowFlatDamageBonus')::integer<>8
 then raise exception 'Selected bow + boots source bonus parity failed %',r; end if;

 -- Finesse must choose the greater available ability AFTER the gate;
 -- selecting only Staff brings STR to +4, DEX falls to +4 (tie -> STR).
 perform public.set_character_rest_magic_choices_v1(c,array[staff]);
 r:=private.encounter_attuned_weapon_profile_shadow_v1(p,rapier);
 if r->'baseline'->>'ability'<>'dex'
    or r->'shadow'->>'ability'<>'str'
    or (r->'shadow'->>'abilityMod')::integer<>4
 then raise exception 'Finesse did not rechoose eligibility-adjusted STR %',r; end if;

 -- Smithing bonus may be a physical temper tier, NOT automatically a
 -- magical rider. Preserve as shadow but explicitly mark unverified.
 r:=private.encounter_attuned_weapon_profile_shadow_v1(p,tempered);
 if (r->'shadow'->>'magicBonus')::integer<>2
    or r->>'bonusSourceChannel'<>'smith_tier_unclassified'
    or not (r->'unresolvedChannels' ? 'smith_tier_physical_or_magic_unknown')
    or r->>'weaponSourceParityReady'<>'false'
 then raise exception 'Smith tier was incorrectly treated as attunement-required %',r; end if;
 -- Spoofed rare item with no catalogue source cannot inject +5 magic.
 r:=private.encounter_attuned_weapon_profile_shadow_v1(p,unknown_item);
 if (r->'baseline'->>'magicBonus')::integer<>5
    or (r->'shadow'->>'magicBonus')::integer<>0
 then raise exception 'Unverified rare weapon bypassed source selection %',r; end if;

 -- Shared account inventory is visible to both characters' legacy
 -- projections. Its direct magical rider can be claimed by only one.
 perform public.set_character_rest_magic_choices_v1(c,array[shared]);
 r:=private.encounter_attuned_weapon_profile_shadow_v1(other_p,shared);
 if (r->'baseline'->>'magicBonus')::integer<>2
    or (r->'shadow'->>'magicBonus')::integer<>0
    or r->'sourceGate'->>'claimedByAnotherCharacter'<>'true'
 then raise exception 'Shared player magic weapon leaked to second character %',r; end if;
 r:=private.encounter_attuned_weapon_profile_shadow_v1(p,shared);
 if (r->'shadow'->>'magicBonus')::integer<>2
 then raise exception 'Explicitly selected shared weapon bonus did not return %',r; end if;

 -- OFF is always exact baseline JSON again, independent of saved choices.
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(false);
 r:=private.encounter_attuned_weapon_profile_shadow_v1(p,sword);
 baseline:=public.encounter_weapon_profile_internal_v1(p,sword);
 if r->'baseline' is distinct from baseline
   or r->'shadow' is distinct from baseline
   or r->>'wouldChange'<>'false'
 then raise exception 'Weapon OFF failed after switching back from ON %',r; end if;
end $test$;
select 'Tactical weapon shadow OFF parity, sword/bow/finesse magic, ability sources, smith tier and shared ownership passed' as result;

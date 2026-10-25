-- Genuine DnDWeb structured item payloads seeded by seed_common_equipment_live_catalog.mjs.
-- Run in isolated PostgreSQL after existing fixtures and actual legacy resolver compilation.
-- This test verifies *current outputs* and explicitly records unsupported fields;
-- it does NOT bless legacy gaps as correct game rules.
\set ON_ERROR_STOP on
insert into public.character_sheets values
 ('30000000-0000-4000-8000-000000000001','{"abilities":{"dex":{"score":8},"str":{"score":16},"con":{"score":12}}}');
insert into public.inventory_items values
 ('31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','character',true,now(),
  '{"item_key":"Ring of Protection|XDMG"}','Ring of Protection|XDMG','Ring of Protection',null,'finger'),
 ('31000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','character',true,now(),
  '{"item_key":"Cloak of Protection|XDMG"}','Cloak of Protection|XDMG','Cloak of Protection',null,'back'),
 ('31000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','character',true,now(),
  '{"item_key":"Staff of Power|XDMG"}','Staff of Power|XDMG','Staff of Power',null,'weapon_1'),
 ('31000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000001','character',true,now(),
  '{"item_key":"+2 Ring of Protection|TDCSR"}','+2 Ring of Protection|TDCSR','+2 Ring of Protection',null,'finger_2'),
 ('31000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000001','character',false,now(),
  '{"item_key":"Staff of Power|XDMG","bonusSavingThrow":"+99"}','Staff of Power|XDMG','Staff of Power',null,'weapon_2'),
 ('31000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000002','character',true,now(),
  '{"item_key":"Staff of Power|XDMG"}','Staff of Power|XDMG','Staff of Power',null,'weapon_1');
do $live_catalogue$
declare
 cid uuid := '30000000-0000-4000-8000-000000000001';
 e jsonb; effects jsonb; resolved jsonb;
begin
 -- 2026-10-24 source payloads: +1 Ring, +1 Cloak, +2 Staff, +2 Ring.
 -- No armor: 10 + (-1 DEX) + (1+1+2+2 item AC) = 15.
 e := private.character_equipment_effects_v1(cid);
 if e->>'schemaVersion'<>'1' or e->>'savesAll'<>'6'
    or e#>>'{ac,total}'<>'15' or e#>>'{ac,otherBonus}'<>'6'
    or jsonb_array_length(e->'equippedItemIds')<>4 then
   raise exception 'Real catalogue numeric/owner/unequipped baseline changed: %',e;
 end if;
 effects:=private.normalize_equipment_bonus_effects_v1(e,'{"event":"saving_throw","ability":"con"}');
 resolved:=private.resolve_effect_bundle_v1('{"saving_throw_bonus":13}',effects);
 if resolved#>>'{stats,saving_throw_bonus}'<>'19'
    or jsonb_array_length(resolved->'appliedEffects')<>1 then
   raise exception 'Real source global saving throw parity failed %, %',effects,resolved; end if;
 effects:=private.normalize_equipment_bonus_effects_v1(e,'{"event":"initiative"}');
 resolved:=private.resolve_effect_bundle_v1('{"initiative":5}',effects);
 if resolved#>>'{stats,initiative}'<>'5' then
   raise exception 'Real source initiative zero overlay changed %',resolved; end if;
 effects:=private.normalize_equipment_bonus_effects_v1(e,'{"event":"ability_check","skill":"athletics"}');
 resolved:=private.resolve_effect_bundle_v1('{"athletics_check":5}',effects);
 if resolved#>>'{stats,athletics_check}'<>'5' then
   raise exception 'Real source skill zero overlay changed %',resolved; end if;

 -- Instance override replaces matching numeric catalog key while retaining
 -- the Ring's unoverridden catalogue AC bonus.
 update public.inventory_items
 set card_payload='{"item_key":"Ring of Protection|XDMG","bonusSavingThrow":"+4"}'
 where id='31000000-0000-4000-8000-000000000001';
 e:=private.character_equipment_effects_v1(cid);
 if e->>'savesAll'<>'9' or e#>>'{ac,total}'<>'15' then
   raise exception 'Actual item instance override precedence failed %',e; end if;
 effects:=private.normalize_equipment_bonus_effects_v1(e,'{"event":"saving_throw","ability":"str"}');
 resolved:=private.resolve_effect_bundle_v1('{"saving_throw_bonus":2}',effects);
 if resolved#>>'{stats,saving_throw_bonus}'<>'11' then
   raise exception 'Override source resolver parity failed %',resolved; end if;
 update public.inventory_items
 set card_payload='{"item_key":"Ring of Protection|XDMG","bonusAc":0}'
 where id='31000000-0000-4000-8000-000000000001';
 e:=private.character_equipment_effects_v1(cid);
 if e#>>'{ac,total}'<>'14' or e->>'savesAll'<>'6' then
   raise exception 'Numeric zero inventory override precedence failed %',e; end if;
 -- Restore the genuine unmodified instance for armor scenarios.
 update public.inventory_items set card_payload='{"item_key":"Ring of Protection|XDMG"}'
 where id='31000000-0000-4000-8000-000000000001';

 insert into public.inventory_items values
 ('31000000-0000-4000-8000-000000000007',cid::text,'character',true,now(),
  '{"item_key":"Leather Armor|XPHB"}','Leather Armor|XPHB','Leather Armor',null,'body');
 e:=private.character_equipment_effects_v1(cid);
 if e#>>'{ac,total}'<>'16' or e#>>'{ac,dexApplied}'<>'-1'
    or e#>>'{ac,armorCategory}'<>'light' then
   raise exception 'Genuine Leather Armor source parity failed %',e; end if;
 update public.inventory_items set card_payload='{"item_key":"Scale Mail|XPHB"}',
 item_id='Scale Mail|XPHB',item_name='Scale Mail'
 where id='31000000-0000-4000-8000-000000000007';
 e:=private.character_equipment_effects_v1(cid);
 if e#>>'{ac,total}'<>'19' or e#>>'{ac,armorCategory}'<>'medium'
    or e#>>'{ac,dexApplied}'<>'-1' then
   raise exception 'Genuine Scale Mail source parity failed %',e; end if;
 update public.inventory_items set card_payload='{"item_key":"Chain Mail|XPHB"}',
 item_id='Chain Mail|XPHB',item_name='Chain Mail'
 where id='31000000-0000-4000-8000-000000000007';
 e:=private.character_equipment_effects_v1(cid);
 if e#>>'{ac,total}'<>'22' or e#>>'{ac,armorCategory}'<>'heavy'
    or e#>>'{ac,dexApplied}'<>'0' then
   raise exception 'Genuine Chain Mail source parity failed %',e; end if;
 insert into public.inventory_items values
 ('31000000-0000-4000-8000-000000000008',cid::text,'character',true,now(),
  '{"item_key":"Shield|XPHB"}','Shield|XPHB','Shield',null,'offhand');
 e:=private.character_equipment_effects_v1(cid);
 if e#>>'{ac,total}'<>'24' or e#>>'{ac,shieldBonus}'<>'2' then
   raise exception 'Genuine Shield source parity failed %',e; end if;
 -- Legacy slot DEFECT probe: any is_equipped shield adds +2, even on back.
 -- Preserve observation for downstream audit; DO NOT treat as approved 5e rule.
 update public.inventory_items set equip_slot='back'
 where id='31000000-0000-4000-8000-000000000008';
 e:=private.character_equipment_effects_v1(cid);
 if e#>>'{ac,total}'<>'24' then
   raise exception 'Legacy shield equip-slot behavior changed, needs review %',e; end if;

 -- Source-only *gap* checks. These items have valid canonical structured keys
 -- but the legacy numeric equipment output has no consumer for them.
 insert into public.inventory_items values
 ('31000000-0000-4000-8000-000000000009',cid::text,'character',true,now(),
  '{"item_key":"Gloves of Soul Catching|CM"}','Gloves of Soul Catching|CM','Gloves of Soul Catching',null,'hands'),
 ('31000000-0000-4000-8000-000000000010',cid::text,'character',true,now(),
  '{"item_key":"Ascendant Scaled Ornament|FTD"}','Ascendant Scaled Ornament|FTD','Ascendant Scaled Ornament',null,'neck'),
 ('31000000-0000-4000-8000-000000000011',cid::text,'character',true,now(),
  '{"item_key":"Ioun Stone, Mastery|XDMG"}','Ioun Stone, Mastery|XDMG','Ioun Stone, Mastery',null,'head'),
 ('31000000-0000-4000-8000-000000000012',cid::text,'character',true,now(),
  '{"item_key":"Robe of the Archmagi|XDMG"}','Robe of the Archmagi|XDMG','Robe of the Archmagi',null,'body_2'),
 ('31000000-0000-4000-8000-000000000013',cid::text,'character',true,now(),
  '{"item_key":"+1 All-Purpose Tool|TCE"}','+1 All-Purpose Tool|TCE','+1 All-Purpose Tool',null,'hands_2');
 e:=private.character_equipment_effects_v1(cid);
 if e#>>'{abilities,con,effectiveScore}'<>'12' or e ? 'spellSaveDc'
    or e ? 'spellAttackBonus' or e ? 'proficiencyBonus'
    or e ? 'flySpeedFt' then
   raise exception 'Unsupported mechanics unexpectedly projected; re-audit %',e; end if;
 -- Ascendant Ornament's +1 AC is supported, despite the uncaptured fly mode.
 if e#>>'{ac,otherBonus}'<>'7' then
   raise exception 'Partially supported source item AC bonus changed %',e; end if;
 -- Guard: "supported" only means legacy numeric projection, NOT attunement,
 -- concentration, charges, magical effect eligibility or tactical gameplay.
end $live_catalogue$;
select 'Genuine catalog snapshot numeric parity passed; unsupported source keys remain GATED' as result;
